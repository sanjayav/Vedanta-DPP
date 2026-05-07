"""Passport draft authoring service.

Backs the Create Passport wizard. A draft is a per-cast workspace that
collects attribute values via four entry modes — manual, IoT, library, and
external assignment — then graduates through a disclosure review and a
publish step that materialises a signed `DppRecord`.

All writes go through `append_audit` so configuration *and* authoring
events appear in the same hash-chained log.
"""

from __future__ import annotations

import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DataSource,
    DppAttributeAssignment,
    DppAttributeValue,
    DppDraft,
    DppManifestAttr,
    DppPublishDisclosure,
    DppRecord,
    IotConnection,
    ProcessStep,
    Product,
    ProductDppConfig,
    ProductProcessChain,
)
from .audit import append_audit
from .presets import PRESETS
from .schema_validator import is_valid
from .signer import body_sha256, sign_dpp_envelope

ENTRY_SOURCES = ("manual", "iot", "library", "external")
AUDIENCES = ("public", "customer", "verifier", "authority")


# ── Draft lifecycle ─────────────────────────────────────────────────────


async def create_draft(
    session: AsyncSession,
    *,
    tenant_id: int,
    product_id: int,
    dpp_version: str,
    cast_number: str,
    item_serial: str | None,
    title: str | None,
    actor_id: str,
) -> dict[str, Any]:
    """Create a new draft tied to a (product, dpp_version) config.

    The product's config for this version must be `locked` — otherwise the
    attribute selection is still in flux and we have nothing stable to enter
    values against.
    """
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        raise ValueError("product not found")

    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.tenant_id == tenant_id,
            ProductDppConfig.product_id == product_id,
            ProductDppConfig.dpp_version == dpp_version,
        )
    )
    if cfg is None or cfg.state != "locked":
        raise ValueError("product DPP config must be locked before drafting passports")

    existing = await session.scalar(
        select(DppDraft).where(
            DppDraft.tenant_id == tenant_id,
            DppDraft.product_id == product_id,
            DppDraft.dpp_version == dpp_version,
            DppDraft.cast_number == cast_number,
        )
    )
    if existing is not None:
        raise ValueError(f"draft for cast '{cast_number}' already exists")

    draft = DppDraft(
        tenant_id=tenant_id,
        product_id=product_id,
        dpp_version=dpp_version,
        cast_number=cast_number,
        item_serial=item_serial,
        title=title,
        state="entry",
        created_by=actor_id,
    )
    session.add(draft)
    await session.flush()

    # Seed empty attribute_value rows for every selected manifest attribute.
    selected_ids = _flatten_selection(cfg.selections)
    if selected_ids:
        manifest_rows = (
            await session.scalars(
                select(DppManifestAttr).where(DppManifestAttr.id.in_(selected_ids))
            )
        ).all()
        for attr in manifest_rows:
            session.add(
                DppAttributeValue(
                    tenant_id=tenant_id,
                    draft_id=draft.id,
                    manifest_attr_id=attr.id,
                    process_step_id=attr.process_step_id,
                    attribute_path=attr.attribute_path,
                    value=None,
                    source="manual",
                    status="empty",
                )
            )
        await session.flush()

    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_draft.created",
        target_kind="dpp_draft",
        target_id=str(draft.id),
        details={
            "productId": product_id,
            "version": dpp_version,
            "castNumber": cast_number,
            "seededAttributes": len(selected_ids),
        },
    )
    return await get_draft(session, tenant_id=tenant_id, draft_id=draft.id)


async def get_draft(session: AsyncSession, *, tenant_id: int, draft_id: int) -> dict[str, Any]:
    """Full draft view: stages × attributes × values × assignments + completion."""
    draft = await session.get(DppDraft, draft_id)
    if draft is None or draft.tenant_id != tenant_id:
        raise ValueError("draft not found")

    product = await session.get(Product, draft.product_id)
    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.product_id == draft.product_id,
            ProductDppConfig.dpp_version == draft.dpp_version,
        )
    )
    selected_ids = _flatten_selection(cfg.selections) if cfg else []

    manifest_attrs = (
        await session.scalars(
            select(DppManifestAttr).where(DppManifestAttr.id.in_(selected_ids))
            if selected_ids
            else select(DppManifestAttr).where(DppManifestAttr.id == -1)
        )
    ).all()
    chain = (
        await session.execute(
            select(
                ProductProcessChain.process_step_id,
                ProductProcessChain.ordinal,
                ProcessStep.slug,
                ProcessStep.name,
                ProcessStep.tier,
            )
            .join(ProcessStep, ProcessStep.id == ProductProcessChain.process_step_id)
            .where(ProductProcessChain.product_id == draft.product_id)
            .order_by(ProductProcessChain.ordinal)
        )
    ).all()
    values = (
        await session.scalars(
            select(DppAttributeValue).where(DppAttributeValue.draft_id == draft_id)
        )
    ).all()
    values_by_attr = {v.manifest_attr_id: v for v in values}
    assignments = (
        await session.scalars(
            select(DppAttributeAssignment).where(DppAttributeAssignment.draft_id == draft_id)
        )
    ).all()
    assn_by_attr = {a.manifest_attr_id: a for a in assignments}
    sources = (
        await session.scalars(select(DataSource).where(DataSource.product_id == draft.product_id))
    ).all()
    src_by_step = {s.process_step_id: s for s in sources}

    stages: list[dict[str, Any]] = []
    for r in chain:
        step_attrs = [a for a in manifest_attrs if a.process_step_id == r.process_step_id]
        attrs_serialised: list[dict[str, Any]] = []
        complete = 0
        for attr in sorted(step_attrs, key=lambda a: (a.dpp_version, a.attribute_path)):
            v = values_by_attr.get(attr.id)
            assn = assn_by_attr.get(attr.id)
            is_complete = v is not None and v.status == "complete"
            if is_complete:
                complete += 1
            attrs_serialised.append(
                {
                    "manifestAttrId": attr.id,
                    "attributePath": attr.attribute_path,
                    "label": attr.label,
                    "necessity": attr.necessity,
                    "regulatoryAnchor": attr.regulatory_anchor,
                    "version": attr.dpp_version,
                    "value": v.value if v else None,
                    "source": v.source if v else "manual",
                    "sourceRef": v.source_ref if v else None,
                    "status": v.status if v else "empty",
                    "enteredBy": v.entered_by if v else None,
                    "enteredAt": v.entered_at.isoformat() if v and v.entered_at else None,
                    "assignment": _serialise_assignment(assn) if assn else None,
                }
            )
        total = len(step_attrs)
        stages.append(
            {
                "stepId": r.process_step_id,
                "slug": r.slug,
                "name": r.name,
                "tier": r.tier,
                "ordinal": r.ordinal,
                "attributes": attrs_serialised,
                "completion": {
                    "complete": complete,
                    "total": total,
                    "pct": round((complete / total) * 100) if total else 0,
                    "isComplete": total > 0 and complete == total,
                },
                "dataSource": _serialise_source(src_by_step.get(r.process_step_id)),
            }
        )

    overall_total = sum(s["completion"]["total"] for s in stages)
    overall_complete = sum(s["completion"]["complete"] for s in stages)
    return {
        "draft": {
            "id": draft.id,
            "productId": draft.product_id,
            "productName": product.name if product else None,
            "productSlug": product.slug if product else None,
            "dppVersion": draft.dpp_version,
            "castNumber": draft.cast_number,
            "itemSerial": draft.item_serial,
            "title": draft.title,
            "state": draft.state,
            "createdBy": draft.created_by,
            "createdAt": draft.created_at.isoformat(),
            "updatedAt": draft.updated_at.isoformat(),
            "publishedAt": draft.published_at.isoformat() if draft.published_at else None,
            "publishedDppId": draft.published_dpp_id,
        },
        "stages": stages,
        "completion": {
            "complete": overall_complete,
            "total": overall_total,
            "pct": round((overall_complete / overall_total) * 100) if overall_total else 0,
            "stagesComplete": sum(1 for s in stages if s["completion"]["isComplete"]),
            "stagesTotal": len(stages),
            "readyForDisclosure": all(s["completion"]["isComplete"] for s in stages),
        },
    }


async def list_drafts(
    session: AsyncSession, *, tenant_id: int, state: str | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(DppDraft, Product.name, Product.slug)
        .join(Product, Product.id == DppDraft.product_id)
        .where(DppDraft.tenant_id == tenant_id)
        .order_by(DppDraft.created_at.desc())
    )
    if state:
        stmt = stmt.where(DppDraft.state == state)
    rows = (await session.execute(stmt)).all()
    return [
        {
            "id": d.id,
            "productId": d.product_id,
            "productName": pname,
            "productSlug": pslug,
            "dppVersion": d.dpp_version,
            "castNumber": d.cast_number,
            "title": d.title,
            "state": d.state,
            "createdBy": d.created_by,
            "createdAt": d.created_at.isoformat(),
            "updatedAt": d.updated_at.isoformat(),
            "publishedAt": d.published_at.isoformat() if d.published_at else None,
        }
        for d, pname, pslug in rows
    ]


# ── Attribute value entry ───────────────────────────────────────────────


async def set_value(
    session: AsyncSession,
    *,
    tenant_id: int,
    draft_id: int,
    manifest_attr_id: int,
    value: Any,
    source: str,
    source_ref: str | None,
    actor_id: str,
) -> dict[str, Any]:
    """Generic attribute-value writer used by every entry mode."""
    if source not in ENTRY_SOURCES:
        raise ValueError(f"source must be one of {ENTRY_SOURCES}")
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state != "entry":
        raise ValueError("draft is not accepting attribute edits")

    row = await session.scalar(
        select(DppAttributeValue).where(
            DppAttributeValue.draft_id == draft_id,
            DppAttributeValue.manifest_attr_id == manifest_attr_id,
        )
    )
    if row is None:
        raise ValueError("attribute is not part of this draft's selection")

    row.value = value
    row.source = source
    row.source_ref = source_ref
    row.entered_by = actor_id
    row.entered_at = datetime.now(UTC)
    row.status = "complete" if _is_present(value) else "empty"
    row.updated_at = row.entered_at
    await session.flush()

    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_attribute_value.set",
        target_kind="dpp_attribute_value",
        target_id=str(row.id),
        details={
            "draftId": draft_id,
            "manifestAttrId": manifest_attr_id,
            "source": source,
            "status": row.status,
        },
    )
    return await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)


# ── Library pull (pre-filled values from tenant presets) ───────────────


async def list_library_presets(
    session: AsyncSession, *, tenant_id: int, product_id: int
) -> list[dict[str, Any]]:
    """Return preset packs that can populate this product's attribute paths."""
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        raise ValueError("product not found")
    return [
        {
            "id": pid,
            "label": preset.get("label", pid),
            "summary": preset.get("summary"),
            "brand": preset.get("brand"),
            "form": preset.get("form"),
        }
        for pid, preset in PRESETS.items()
        if _preset_matches_product(preset, product)
    ]


async def pull_from_library(
    session: AsyncSession,
    *,
    tenant_id: int,
    draft_id: int,
    process_step_id: int,
    preset_id: str,
    actor_id: str,
) -> dict[str, Any]:
    """Copy every attribute from `preset` whose path matches a row on this step."""
    preset = PRESETS.get(preset_id)
    if preset is None:
        raise ValueError(f"unknown preset '{preset_id}'")
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state != "entry":
        raise ValueError("draft is not accepting attribute edits")

    rows = (
        await session.scalars(
            select(DppAttributeValue).where(
                DppAttributeValue.draft_id == draft_id,
                DppAttributeValue.process_step_id == process_step_id,
            )
        )
    ).all()
    pulled = 0
    now = datetime.now(UTC)
    for row in rows:
        candidate = _resolve_path(preset, row.attribute_path)
        if candidate is None:
            continue
        row.value = candidate
        row.source = "library"
        row.source_ref = preset_id
        row.entered_by = actor_id
        row.entered_at = now
        row.status = "complete"
        row.updated_at = now
        pulled += 1
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_attribute_value.library_pull",
        target_kind="dpp_draft",
        target_id=str(draft_id),
        details={"presetId": preset_id, "stepId": process_step_id, "pulled": pulled},
    )
    return await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)


# ── IoT pull ────────────────────────────────────────────────────────────


async def list_iot_connections(
    session: AsyncSession,
    *,
    tenant_id: int,
    product_id: int | None = None,
    process_step_id: int | None = None,
) -> list[dict[str, Any]]:
    stmt = select(IotConnection).where(IotConnection.tenant_id == tenant_id)
    if product_id is not None:
        stmt = stmt.where(
            (IotConnection.product_id == product_id) | (IotConnection.product_id.is_(None))
        )
    if process_step_id is not None:
        stmt = stmt.where(
            (IotConnection.process_step_id == process_step_id)
            | (IotConnection.process_step_id.is_(None))
        )
    rows = (await session.scalars(stmt.order_by(IotConnection.name))).all()
    return [_serialise_iot(r) for r in rows]


async def upsert_iot_connection(
    session: AsyncSession,
    *,
    tenant_id: int,
    name: str,
    kind: str,
    endpoint: str | None,
    config: dict[str, Any],
    attribute_map: dict[str, Any],
    product_id: int | None,
    process_step_id: int | None,
    actor_id: str,
) -> dict[str, Any]:
    if kind not in ("mes", "scada", "aws_iot", "mqtt", "http_pull"):
        raise ValueError("unsupported IoT kind")
    row = await session.scalar(
        select(IotConnection).where(
            IotConnection.tenant_id == tenant_id,
            IotConnection.name == name,
        )
    )
    if row is None:
        row = IotConnection(
            tenant_id=tenant_id,
            name=name,
            kind=kind,
            endpoint=endpoint,
            config=config,
            attribute_map=attribute_map,
            product_id=product_id,
            process_step_id=process_step_id,
            status="connected",
        )
        session.add(row)
    else:
        row.kind = kind
        row.endpoint = endpoint
        row.config = config
        row.attribute_map = attribute_map
        row.product_id = product_id
        row.process_step_id = process_step_id
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="iot_connection.upserted",
        target_kind="iot_connection",
        target_id=str(row.id),
        details={"name": name, "kind": kind},
    )
    return _serialise_iot(row)


async def pull_from_iot(
    session: AsyncSession,
    *,
    tenant_id: int,
    draft_id: int,
    process_step_id: int,
    iot_connection_id: int,
    actor_id: str,
) -> dict[str, Any]:
    """Apply the IoT connection's `attribute_map` to this step's attribute rows.

    The map is `{ attribute_path: value-spec }`. v1 stores synthetic values
    (the spec is a literal value or `{"value": ..., "unit": ...}`); v1.5
    will swap in a real connector that polls the endpoint.
    """
    iot = await session.get(IotConnection, iot_connection_id)
    if iot is None or iot.tenant_id != tenant_id:
        raise ValueError("IoT connection not found")
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state != "entry":
        raise ValueError("draft is not accepting attribute edits")

    rows = (
        await session.scalars(
            select(DppAttributeValue).where(
                DppAttributeValue.draft_id == draft_id,
                DppAttributeValue.process_step_id == process_step_id,
            )
        )
    ).all()

    pulled = 0
    now = datetime.now(UTC)
    for row in rows:
        spec = iot.attribute_map.get(row.attribute_path)
        if spec is None:
            continue
        row.value = spec["value"] if isinstance(spec, dict) and "value" in spec else spec
        row.source = "iot"
        row.source_ref = f"iot:{iot.id}:{iot.name}"
        row.entered_by = actor_id
        row.entered_at = now
        row.status = "complete"
        row.updated_at = now
        pulled += 1

    iot.last_sync_at = now
    iot.status = "connected"
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_attribute_value.iot_pull",
        target_kind="dpp_draft",
        target_id=str(draft_id),
        details={
            "iotConnectionId": iot_connection_id,
            "stepId": process_step_id,
            "pulled": pulled,
        },
    )
    return await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)


# ── External assignment ────────────────────────────────────────────────


async def assign_attribute(
    session: AsyncSession,
    *,
    tenant_id: int,
    draft_id: int,
    manifest_attr_id: int,
    assignee_email: str,
    assignee_name: str | None,
    assignee_org: str | None,
    note: str | None,
    actor_id: str,
) -> dict[str, Any]:
    """Delegate one attribute to an external assignee. Returns the access link payload."""
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state != "entry":
        raise ValueError("draft is not accepting assignments")

    val_row = await session.scalar(
        select(DppAttributeValue).where(
            DppAttributeValue.draft_id == draft_id,
            DppAttributeValue.manifest_attr_id == manifest_attr_id,
        )
    )
    if val_row is None:
        raise ValueError("attribute not part of draft selection")

    existing = await session.scalar(
        select(DppAttributeAssignment).where(
            DppAttributeAssignment.draft_id == draft_id,
            DppAttributeAssignment.manifest_attr_id == manifest_attr_id,
        )
    )
    if existing is not None and existing.status != "revoked":
        raise ValueError("attribute is already assigned")

    token = secrets.token_urlsafe(32)
    if existing is not None:
        existing.assignee_email = assignee_email
        existing.assignee_name = assignee_name
        existing.assignee_org = assignee_org
        existing.note = note
        existing.access_token = token
        existing.status = "pending"
        existing.assigned_by = actor_id
        existing.assigned_at = datetime.now(UTC)
        existing.submitted_at = None
        row = existing
    else:
        row = DppAttributeAssignment(
            tenant_id=tenant_id,
            draft_id=draft_id,
            manifest_attr_id=manifest_attr_id,
            assignee_email=assignee_email,
            assignee_name=assignee_name,
            assignee_org=assignee_org,
            note=note,
            access_token=token,
            status="pending",
            assigned_by=actor_id,
        )
        session.add(row)

    val_row.source = "external"
    val_row.status = "pending"
    val_row.source_ref = f"assignment:{assignee_email}"
    val_row.updated_at = datetime.now(UTC)
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_attribute.assigned",
        target_kind="dpp_attribute_assignment",
        target_id=str(row.id),
        details={
            "draftId": draft_id,
            "manifestAttrId": manifest_attr_id,
            "assigneeEmail": assignee_email,
        },
    )
    return _serialise_assignment(row, include_token=True)


async def revoke_assignment(
    session: AsyncSession,
    *,
    tenant_id: int,
    assignment_id: int,
    actor_id: str,
) -> dict[str, Any]:
    row = await session.get(DppAttributeAssignment, assignment_id)
    if row is None or row.tenant_id != tenant_id:
        raise ValueError("assignment not found")
    if row.status == "submitted":
        raise ValueError("cannot revoke a submitted assignment")
    row.status = "revoked"
    val = await session.scalar(
        select(DppAttributeValue).where(
            DppAttributeValue.draft_id == row.draft_id,
            DppAttributeValue.manifest_attr_id == row.manifest_attr_id,
        )
    )
    if val is not None and val.status == "pending":
        val.status = "empty"
        val.source = "manual"
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_attribute.assignment_revoked",
        target_kind="dpp_attribute_assignment",
        target_id=str(assignment_id),
        details={},
    )
    return _serialise_assignment(row)


async def list_assignments_for_email(
    session: AsyncSession, *, assignee_email: str
) -> list[dict[str, Any]]:
    """Inbox view for an external assignee — what's been delegated to them."""
    rows = (
        await session.execute(
            select(
                DppAttributeAssignment,
                DppManifestAttr,
                DppDraft,
                Product,
            )
            .join(
                DppManifestAttr,
                DppManifestAttr.id == DppAttributeAssignment.manifest_attr_id,
            )
            .join(DppDraft, DppDraft.id == DppAttributeAssignment.draft_id)
            .join(Product, Product.id == DppDraft.product_id)
            .where(DppAttributeAssignment.assignee_email == assignee_email)
            .order_by(DppAttributeAssignment.assigned_at.desc())
        )
    ).all()

    out: list[dict[str, Any]] = []
    for assn, attr, draft, product in rows:
        out.append(
            {
                **_serialise_assignment(assn),
                "manifestAttr": {
                    "id": attr.id,
                    "attributePath": attr.attribute_path,
                    "label": attr.label,
                    "necessity": attr.necessity,
                    "regulatoryAnchor": attr.regulatory_anchor,
                    "version": attr.dpp_version,
                },
                "draft": {
                    "id": draft.id,
                    "castNumber": draft.cast_number,
                    "title": draft.title,
                    "state": draft.state,
                    "productId": product.id,
                    "productName": product.name,
                    "productBrand": product.brand,
                },
            }
        )
    return out


async def list_assignments_for_email_with_tokens(
    session: AsyncSession, *, assignee_email: str
) -> list[dict[str, Any]]:
    """Same shape as `list_assignments_for_email`, but includes the access token.

    Use only when the caller has authenticated as the assignee; the standard
    inbox helper omits the token by design.
    """
    rows = (
        await session.execute(
            select(
                DppAttributeAssignment,
                DppManifestAttr,
                DppDraft,
                Product,
            )
            .join(
                DppManifestAttr,
                DppManifestAttr.id == DppAttributeAssignment.manifest_attr_id,
            )
            .join(DppDraft, DppDraft.id == DppAttributeAssignment.draft_id)
            .join(Product, Product.id == DppDraft.product_id)
            .where(DppAttributeAssignment.assignee_email == assignee_email)
            .order_by(DppAttributeAssignment.assigned_at.desc())
        )
    ).all()

    out: list[dict[str, Any]] = []
    for assn, attr, draft, product in rows:
        out.append(
            {
                **_serialise_assignment(assn, include_token=True),
                "manifestAttr": {
                    "id": attr.id,
                    "attributePath": attr.attribute_path,
                    "label": attr.label,
                    "necessity": attr.necessity,
                    "regulatoryAnchor": attr.regulatory_anchor,
                    "version": attr.dpp_version,
                },
                "draft": {
                    "id": draft.id,
                    "castNumber": draft.cast_number,
                    "title": draft.title,
                    "state": draft.state,
                    "productId": product.id,
                    "productName": product.name,
                    "productBrand": product.brand,
                },
            }
        )
    return out


async def fetch_assignment_by_token(
    session: AsyncSession, *, access_token: str
) -> dict[str, Any] | None:
    """Token-only prefetch for the public magic-link surface.

    Returns enough metadata for the assignee to know what value the
    requester wants — but never the values entered by anyone else.
    """
    row = await session.scalar(
        select(DppAttributeAssignment).where(DppAttributeAssignment.access_token == access_token)
    )
    if row is None:
        return None
    attr = await session.get(DppManifestAttr, row.manifest_attr_id)
    draft = await session.get(DppDraft, row.draft_id)
    product = await session.get(Product, draft.product_id) if draft is not None else None
    val = await session.scalar(
        select(DppAttributeValue).where(
            DppAttributeValue.draft_id == row.draft_id,
            DppAttributeValue.manifest_attr_id == row.manifest_attr_id,
        )
    )
    return {
        "assignment": _serialise_assignment(row),
        "manifestAttr": {
            "id": attr.id if attr else None,
            "attributePath": attr.attribute_path if attr else None,
            "label": attr.label if attr else None,
            "necessity": attr.necessity if attr else None,
            "regulatoryAnchor": attr.regulatory_anchor if attr else None,
            "version": attr.dpp_version if attr else None,
            "description": attr.description if attr else None,
        },
        "draft": {
            "id": draft.id if draft else None,
            "castNumber": draft.cast_number if draft else None,
            "title": draft.title if draft else None,
            "state": draft.state if draft else None,
            "productName": product.name if product else None,
            "productBrand": product.brand if product else None,
        },
        "currentValue": val.value if val and val.status == "complete" else None,
    }


async def submit_assignment_value(
    session: AsyncSession, *, access_token: str, value: Any
) -> dict[str, Any]:
    """Assignee submits the requested value. Authenticated by access_token only."""
    row = await session.scalar(
        select(DppAttributeAssignment).where(DppAttributeAssignment.access_token == access_token)
    )
    if row is None:
        raise ValueError("invalid access token")
    if row.status == "revoked":
        raise ValueError("assignment was revoked")
    if row.status == "submitted":
        raise ValueError("assignment already submitted")

    val = await session.scalar(
        select(DppAttributeValue).where(
            DppAttributeValue.draft_id == row.draft_id,
            DppAttributeValue.manifest_attr_id == row.manifest_attr_id,
        )
    )
    if val is None:
        raise ValueError("attribute value row missing")

    now = datetime.now(UTC)
    val.value = value
    val.source = "external"
    val.source_ref = f"assignment:{row.assignee_email}"
    val.status = "complete" if _is_present(value) else "pending"
    val.entered_by = row.assignee_email
    val.entered_at = now
    val.updated_at = now

    row.status = "submitted" if val.status == "complete" else "accepted"
    if val.status == "complete":
        row.submitted_at = now
    await session.flush()
    await append_audit(
        session,
        tenant_id=row.tenant_id,
        actor_kind="external_verifier",
        actor_id=row.assignee_email,
        action="dpp_attribute.external_submitted",
        target_kind="dpp_attribute_assignment",
        target_id=str(row.id),
        details={
            "draftId": row.draft_id,
            "manifestAttrId": row.manifest_attr_id,
            "valueStatus": val.status,
        },
    )
    return _serialise_assignment(row)


# ── Disclosure + publish ────────────────────────────────────────────────


async def begin_disclosure(
    session: AsyncSession, *, tenant_id: int, draft_id: int, actor_id: str
) -> dict[str, Any]:
    """Move a fully-entered draft into `disclosure` state and seed defaults."""
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state == "published":
        raise ValueError("draft is already published")
    summary = await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)
    if not summary["completion"]["readyForDisclosure"]:
        raise ValueError("not all stages are complete")

    existing = (
        await session.scalars(
            select(DppPublishDisclosure).where(DppPublishDisclosure.draft_id == draft_id)
        )
    ).all()
    have = {(d.attribute_path, d.audience) for d in existing}
    paths = sorted(
        {attr["attributePath"] for stage in summary["stages"] for attr in stage["attributes"]}
    )
    for path in paths:
        for audience in AUDIENCES:
            if (path, audience) in have:
                continue
            session.add(
                DppPublishDisclosure(
                    tenant_id=tenant_id,
                    draft_id=draft_id,
                    attribute_path=path,
                    audience=audience,
                    visible=_default_visibility(path, audience),
                )
            )
    draft.state = "disclosure"
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_draft.disclosure_started",
        target_kind="dpp_draft",
        target_id=str(draft_id),
        details={"attributeCount": len(paths)},
    )
    # `updated_at` is server-computed via onupdate=func.now() and expires on
    # flush; without an explicit async refresh, the next attribute access
    # triggers a sync lazy-load and raises MissingGreenlet. Refresh now so
    # the downstream get_draft() inside get_disclosure() can serialise it.
    await session.refresh(draft)
    return await get_disclosure(session, tenant_id=tenant_id, draft_id=draft_id)


async def get_disclosure(session: AsyncSession, *, tenant_id: int, draft_id: int) -> dict[str, Any]:
    await _require_draft(session, tenant_id, draft_id)
    rows = (
        await session.scalars(
            select(DppPublishDisclosure).where(DppPublishDisclosure.draft_id == draft_id)
        )
    ).all()
    by_path: dict[str, dict[str, bool]] = defaultdict(dict)
    for r in rows:
        by_path[r.attribute_path][r.audience] = r.visible
    summary = await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)
    matrix: list[dict[str, Any]] = []
    for stage in summary["stages"]:
        for attr in stage["attributes"]:
            path = attr["attributePath"]
            matrix.append(
                {
                    "stepId": stage["stepId"],
                    "stepName": stage["name"],
                    "attributePath": path,
                    "label": attr["label"],
                    "necessity": attr["necessity"],
                    "value": attr["value"],
                    "visibility": {
                        aud: by_path.get(path, {}).get(aud, _default_visibility(path, aud))
                        for aud in AUDIENCES
                    },
                }
            )
    return {
        "draft": summary["draft"],
        "audiences": list(AUDIENCES),
        "matrix": matrix,
    }


async def update_disclosure(
    session: AsyncSession,
    *,
    tenant_id: int,
    draft_id: int,
    attribute_path: str,
    audience: str,
    visible: bool,
    actor_id: str,
) -> dict[str, Any]:
    if audience not in AUDIENCES:
        raise ValueError(f"audience must be one of {AUDIENCES}")
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state != "disclosure":
        raise ValueError("draft is not in disclosure stage")
    row = await session.scalar(
        select(DppPublishDisclosure).where(
            DppPublishDisclosure.draft_id == draft_id,
            DppPublishDisclosure.attribute_path == attribute_path,
            DppPublishDisclosure.audience == audience,
        )
    )
    if row is None:
        row = DppPublishDisclosure(
            tenant_id=tenant_id,
            draft_id=draft_id,
            attribute_path=attribute_path,
            audience=audience,
            visible=visible,
        )
        session.add(row)
    else:
        row.visible = visible
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_disclosure.updated",
        target_kind="dpp_draft",
        target_id=str(draft_id),
        details={"attributePath": attribute_path, "audience": audience, "visible": visible},
    )
    return {"attributePath": attribute_path, "audience": audience, "visible": visible}


async def publish_draft(
    session: AsyncSession, *, tenant_id: int, draft_id: int, actor_id: str
) -> dict[str, Any]:
    """Materialise the draft into a signed `DppRecord`."""
    draft = await _require_draft(session, tenant_id, draft_id)
    if draft.state == "published":
        raise ValueError("already published")
    if draft.state != "disclosure":
        raise ValueError("draft must complete disclosure review before publishing")

    summary = await get_draft(session, tenant_id=tenant_id, draft_id=draft_id)
    product = await session.get(Product, draft.product_id)
    if product is None:
        raise ValueError("product not found")

    # Build the canonical body from attribute_values.
    body = _build_body(summary, product, draft)
    schema_valid = is_valid("dpp/v1.0.0", body)
    digest = body_sha256(body)
    envelope = sign_dpp_envelope(body)

    upi = body["upi"]["digitalLinkUrl"]
    record = DppRecord(
        tenant_id=tenant_id,
        upi=upi,
        gtin=body["upi"]["gtin"],
        cast_number=body["identification"]["castNumber"],
        item_serial=body.get("upi", {}).get("itemSerial"),
        brand=product.brand,
        alloy=body["identification"].get("gradeCode") or product.alloy_family,
        form=body["physical"].get("form", product.form),
        weight_kg=float(
            body["physical"].get("unitMassKg") or body["physical"].get("weightKg") or 0.0
        ),
        cfp_kg_co2e_per_tonne=float(
            body.get("sustainability", {}).get("pcf", {}).get("value", 0.0) * 1000
            or body.get("carbon", {}).get("valueKgCo2ePerTonne", 0.0)
            or 0.0
        ),
        recycled_content_pct=float(
            (body.get("recycledContent", {}).get("totalPercent", 0.0)) or 0.0
        ),
        dpp_version=draft.dpp_version,
        state="published",
        body=body,
        envelope=envelope,
        body_sha256=digest,
        signature=envelope.get("proof", {}).get("proofValue"),
        issued_at=datetime.now(UTC),
    )
    session.add(record)
    await session.flush()

    draft.state = "published"
    draft.published_at = record.issued_at
    draft.published_dpp_id = record.id
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_record.published",
        target_kind="dpp_record",
        target_id=str(record.id),
        severity="notice",
        details={
            "draftId": draft_id,
            "upi": upi,
            "bodySha256": digest,
            "schemaValid": schema_valid,
        },
    )
    return {
        "draftId": draft_id,
        "dppRecordId": record.id,
        "upi": upi,
        "bodySha256": digest,
        "schemaValid": schema_valid,
        "issuedAt": record.issued_at.isoformat() if record.issued_at else None,
    }


# ── helpers ─────────────────────────────────────────────────────────────


async def _require_draft(session: AsyncSession, tenant_id: int, draft_id: int) -> DppDraft:
    draft = await session.get(DppDraft, draft_id)
    if draft is None or draft.tenant_id != tenant_id:
        raise ValueError("draft not found")
    return draft


def _flatten_selection(selections: dict[str, Any]) -> list[int]:
    if not isinstance(selections, dict):
        return []
    out: list[int] = []
    for v in selections.values():
        if isinstance(v, list):
            for x in v:
                try:
                    out.append(int(x))
                except (TypeError, ValueError):
                    continue
    return sorted(set(out))


def _is_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and value.strip() == "":
        return False
    if isinstance(value, (list, dict)) and len(value) == 0:
        return False
    return True


def _resolve_path(source: dict[str, Any], dotted: str) -> Any:
    cur: Any = source
    for part in dotted.split("."):
        if not isinstance(cur, dict):
            return None
        if part not in cur:
            return None
        cur = cur[part]
    return cur


def _set_path(target: dict[str, Any], dotted: str, value: Any) -> None:
    parts = dotted.split(".")
    cur = target
    for part in parts[:-1]:
        nxt = cur.get(part)
        if not isinstance(nxt, dict):
            nxt = {}
            cur[part] = nxt
        cur = nxt
    cur[parts[-1]] = value


def _preset_matches_product(preset: dict[str, Any], product: Product) -> bool:
    if preset.get("brand") and product.brand:
        return str(preset["brand"]).lower() == product.brand.lower()
    return True


def _default_visibility(attribute_path: str, audience: str) -> bool:
    """Sane defaults so authors don't start from a blank matrix.

    Authority sees everything. Verifier sees everything. Customer sees
    everything except internal cost/process detail. Public hides
    chemistry-detail and operational telemetry by default.
    """
    if audience in ("authority", "verifier"):
        return True
    hidden_for_public = (
        "chemistry.fullElementalBreakdown",
        "smelting.cellCurrentDensityAPerM2",
        "smelting.currentEfficiencyPct",
        "casting.solidificationRateMmPerMin",
        "concentration.flotationReagentsKgPerTonne",
        "roasting.acidPlantOutputTpa",
    )
    if audience == "public" and attribute_path in hidden_for_public:
        return False
    return True


def _build_body(summary: dict[str, Any], product: Product, draft: DppDraft) -> dict[str, Any]:
    from ..settings import get_settings

    settings = get_settings()
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=365 * 10)  # ESPR Art 10(3) — 10 year retention

    body: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "dppVersion": draft.dpp_version,
        "issuedAt": now.isoformat(),
    }
    for stage in summary["stages"]:
        for attr in stage["attributes"]:
            if attr["status"] != "complete":
                continue
            if attr["value"] is None:
                continue
            _set_path(body, attr["attributePath"], attr["value"])

    body.setdefault("identification", {}).setdefault("castNumber", draft.cast_number)
    body.setdefault("upi", {})
    body["upi"].setdefault("itemSerial", draft.item_serial or draft.cast_number)
    body["upi"].setdefault("gtin", "08906029930012")
    # GS1 GTINs are 14 digits — coerce anything that doesn't match (synthesized
    # demo values, hand-typed variants) to keep the dpp_records.gtin VARCHAR(14)
    # column happy and the public viewer URL well-formed.
    gtin_raw = str(body["upi"]["gtin"])
    gs1_gtin_digits = 14
    if not (gtin_raw.isdigit() and len(gtin_raw) == gs1_gtin_digits):
        body["upi"]["gtin"] = "08906029930012"
    body["upi"].setdefault(
        "digitalLinkUrl",
        f"https://passport.hzlindia.com/01/{body['upi']['gtin']}/21/{body['upi']['itemSerial']}",
    )
    body.setdefault("physical", {}).setdefault("form", product.form)
    body["physical"].setdefault(
        "unitMassKg",
        body.get("physical", {}).get("unitMassKg") or body.get("physical", {}).get("weightKg", 0),
    )
    body.setdefault("producer", {}).setdefault("brand", product.brand)
    body["producer"].setdefault("name", product.brand or "Hindustan Zinc Limited")

    # Required `meta` block — signer + schema both depend on these defaults.
    # Authored fields (e.g. languages, accessRights.publicFields) match the
    # generator.py shape so a published-from-draft DPP and a generator-built
    # DPP look indistinguishable to verifiers.
    body.setdefault("meta", {})
    body["meta"].setdefault("createdAt", now.isoformat())
    body["meta"].setdefault("lastUpdated", now.isoformat())
    body["meta"].setdefault("expiresAt", expires_at.isoformat())
    body["meta"].setdefault("lifecycleState", "published")
    body["meta"].setdefault("languages", ["en", "hi", "de"])
    body["meta"].setdefault("issuerDid", settings.dpp_issuer_did)
    body["meta"].setdefault(
        "accessRights",
        {
            "model": "three_tier_vc_gated",
            "publicFields": [
                "upi",
                "identification",
                "producer",
                "origin",
                "product",
                "physical",
                "carbon",
                "recycledContent",
                "compliance",
                "circularity",
                "espr",
            ],
        },
    )
    body["meta"].setdefault("tenantId", draft.tenant_id)
    return body


def _serialise_assignment(
    row: DppAttributeAssignment, include_token: bool = False
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id,
        "draftId": row.draft_id,
        "manifestAttrId": row.manifest_attr_id,
        "assigneeEmail": row.assignee_email,
        "assigneeName": row.assignee_name,
        "assigneeOrg": row.assignee_org,
        "note": row.note,
        "status": row.status,
        "assignedBy": row.assigned_by,
        "assignedAt": row.assigned_at.isoformat() if row.assigned_at else None,
        "submittedAt": row.submitted_at.isoformat() if row.submitted_at else None,
    }
    if include_token:
        out["accessToken"] = row.access_token
    return out


def _serialise_iot(row: IotConnection) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "kind": row.kind,
        "endpoint": row.endpoint,
        "config": row.config,
        "attributeMap": row.attribute_map,
        "status": row.status,
        "productId": row.product_id,
        "processStepId": row.process_step_id,
        "lastSyncAt": row.last_sync_at.isoformat() if row.last_sync_at else None,
    }


def _serialise_source(s: DataSource | None) -> dict[str, Any] | None:
    if s is None:
        return None
    return {
        "id": s.id,
        "origin": s.origin,
        "supplierName": s.supplier_name,
        "permissionState": s.permission_state,
    }
