"""Product portfolio + DPP-version configuration service.

Read/write surface for the six-level setup workflow (SDD §11):

  L1  list_portfolio + canonical chain
  L2  product_detail
  L3  manifest_for_product (per-step x per-version attribute roster)
  L4  upsert_dpp_config + lock_dpp_config
  L5  upsert_data_source + permission_state transitions
  L6  ingest_readiness — derived state for go-live gating

All writes go through `append_audit` so the platform's hash-chained log
covers configuration changes as well as runtime issuance.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DataSource,
    DppManifestAttr,
    ProcessStep,
    Product,
    ProductDppConfig,
    ProductProcessChain,
)
from .audit import append_audit

# ── L1: portfolio + canonical chain ─────────────────────────────────────


async def list_portfolio(session: AsyncSession, *, tenant_id: int) -> dict[str, Any]:
    """Everything-map view: all products, the canonical chain, version state."""
    products = (
        await session.scalars(
            select(Product).where(Product.tenant_id == tenant_id).order_by(Product.id)
        )
    ).all()
    steps = (await session.scalars(select(ProcessStep).order_by(ProcessStep.ordinal))).all()

    # For each product, fetch chain + config rows in one pass.
    chain_rows = (
        await session.execute(
            select(ProductProcessChain.product_id, ProductProcessChain.process_step_id)
        )
    ).all()
    chain_by_product: dict[int, set[int]] = defaultdict(set)
    for pid, sid in chain_rows:
        chain_by_product[pid].add(sid)

    cfg_rows = (
        await session.scalars(
            select(ProductDppConfig).where(ProductDppConfig.tenant_id == tenant_id)
        )
    ).all()
    cfgs_by_product: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for c in cfg_rows:
        cfgs_by_product[c.product_id].append(
            {
                "version": c.dpp_version,
                "state": c.state,
                "lockedAt": c.locked_at.isoformat() if c.locked_at else None,
                "lockedBy": c.locked_by,
            }
        )

    return {
        "canonicalChain": [
            {
                "id": s.id,
                "slug": s.slug,
                "name": s.name,
                "ordinal": s.ordinal,
                "tier": s.tier,
                "description": s.description,
            }
            for s in steps
        ],
        "products": [
            {
                "id": p.id,
                "slug": p.slug,
                "name": p.name,
                "brand": p.brand,
                "alloyFamily": p.alloy_family,
                "form": p.form,
                "description": p.description,
                "details": p.details,
                "chainStepIds": sorted(chain_by_product.get(p.id, set())),
                "dppConfigs": cfgs_by_product.get(p.id, []),
            }
            for p in products
        ],
    }


# ── L2: per-product detail ─────────────────────────────────────────────


async def product_detail(
    session: AsyncSession, *, tenant_id: int, product_id: int
) -> dict[str, Any] | None:
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        return None

    chain = (
        await session.execute(
            select(
                ProductProcessChain.process_step_id,
                ProductProcessChain.ordinal,
                ProductProcessChain.notes,
                ProcessStep.slug,
                ProcessStep.name,
                ProcessStep.tier,
                ProcessStep.description,
            )
            .join(ProcessStep, ProcessStep.id == ProductProcessChain.process_step_id)
            .where(ProductProcessChain.product_id == product_id)
            .order_by(ProductProcessChain.ordinal)
        )
    ).all()

    cfgs = (
        await session.scalars(
            select(ProductDppConfig).where(
                ProductDppConfig.tenant_id == tenant_id,
                ProductDppConfig.product_id == product_id,
            )
        )
    ).all()

    sources = (
        await session.scalars(
            select(DataSource).where(
                DataSource.tenant_id == tenant_id,
                DataSource.product_id == product_id,
            )
        )
    ).all()

    return {
        "product": _serialise_product(product),
        "chain": [
            {
                "stepId": r.process_step_id,
                "slug": r.slug,
                "name": r.name,
                "tier": r.tier,
                "ordinal": r.ordinal,
                "description": r.description,
                "notes": r.notes,
            }
            for r in chain
        ],
        "dppConfigs": [
            {
                "version": c.dpp_version,
                "state": c.state,
                "selections": c.selections,
                "lockedAt": c.locked_at.isoformat() if c.locked_at else None,
                "lockedBy": c.locked_by,
                "updatedAt": c.updated_at.isoformat(),
            }
            for c in cfgs
        ],
        "dataSources": [_serialise_source(s) for s in sources],
    }


# ── L3: manifest editor ───────────────────────────────────────────────


async def manifest_for_product(
    session: AsyncSession, *, tenant_id: int, product_id: int, dpp_version: str
) -> dict[str, Any] | None:
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        return None

    # Steps in this product's chain.
    chain_rows = (
        await session.execute(
            select(
                ProductProcessChain.process_step_id,
                ProductProcessChain.ordinal,
                ProcessStep.slug,
                ProcessStep.name,
                ProcessStep.tier,
            )
            .join(ProcessStep, ProcessStep.id == ProductProcessChain.process_step_id)
            .where(ProductProcessChain.product_id == product_id)
            .order_by(ProductProcessChain.ordinal)
        )
    ).all()
    step_ids = [r.process_step_id for r in chain_rows]

    # Cumulative attributes: every version up to and including the requested one.
    versions_in_scope = _versions_up_to(dpp_version)
    attrs = (
        await session.scalars(
            select(DppManifestAttr).where(
                DppManifestAttr.process_step_id.in_(step_ids),
                DppManifestAttr.dpp_version.in_(versions_in_scope),
            )
        )
    ).all()
    by_step: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for a in attrs:
        by_step[a.process_step_id].append(
            {
                "id": a.id,
                "version": a.dpp_version,
                "attributePath": a.attribute_path,
                "label": a.label,
                "necessity": a.necessity,
                "regulatoryAnchor": a.regulatory_anchor,
                "description": a.description,
                "newAtThisVersion": a.dpp_version == dpp_version,
            }
        )

    # Existing config (if any).
    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.product_id == product_id,
            ProductDppConfig.dpp_version == dpp_version,
        )
    )

    return {
        "product": _serialise_product(product),
        "version": dpp_version,
        "versionsInScope": versions_in_scope,
        "config": (
            {
                "state": cfg.state,
                "selections": cfg.selections,
                "lockedAt": cfg.locked_at.isoformat() if cfg.locked_at else None,
                "lockedBy": cfg.locked_by,
            }
            if cfg
            else None
        ),
        "stepsWithAttrs": [
            {
                "stepId": r.process_step_id,
                "slug": r.slug,
                "name": r.name,
                "tier": r.tier,
                "ordinal": r.ordinal,
                "attributes": sorted(
                    by_step.get(r.process_step_id, []),
                    key=lambda x: (x["version"], x["attributePath"]),
                ),
            }
            for r in chain_rows
        ],
    }


def _versions_up_to(target: str) -> list[str]:
    order = ["1.0", "1.5", "2", "3", "4"]
    if target not in order:
        return [target]
    idx = order.index(target)
    return order[: idx + 1]


# ── L4: lock workflow ─────────────────────────────────────────────────


async def upsert_dpp_config(
    session: AsyncSession,
    *,
    tenant_id: int,
    product_id: int,
    dpp_version: str,
    selections: dict[str, Any],
    actor_id: str,
) -> dict[str, Any]:
    """Save (or update) the in-progress selections for a (product, version)."""
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        raise ValueError("product not found")
    selections = await _validate_config_selections(
        session,
        product_id=product_id,
        dpp_version=dpp_version,
        selections=selections,
    )

    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.product_id == product_id,
            ProductDppConfig.dpp_version == dpp_version,
        )
    )
    if cfg is None:
        cfg = ProductDppConfig(
            tenant_id=tenant_id,
            product_id=product_id,
            dpp_version=dpp_version,
            state="draft",
            selections=selections,
        )
        session.add(cfg)
    else:
        if cfg.state == "locked":
            raise ValueError("config is locked; create a new version instead")
        cfg.selections = selections
        cfg.updated_at = datetime.now(UTC)
    await session.flush()

    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_config.draft_saved",
        target_kind="product_dpp_config",
        target_id=str(cfg.id),
        details={"productId": product_id, "version": dpp_version},
    )
    return {
        "id": cfg.id,
        "state": cfg.state,
        "version": cfg.dpp_version,
        "selections": cfg.selections,
        "updatedAt": cfg.updated_at.isoformat(),
    }


async def lock_dpp_config(
    session: AsyncSession,
    *,
    tenant_id: int,
    product_id: int,
    dpp_version: str,
    actor_id: str,
) -> dict[str, Any]:
    """Finalise (Level 4). After this, selections are immutable."""
    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.tenant_id == tenant_id,
            ProductDppConfig.product_id == product_id,
            ProductDppConfig.dpp_version == dpp_version,
        )
    )
    if cfg is None:
        raise ValueError("no draft to lock — save selections first")
    if cfg.state == "locked":
        return {
            "id": cfg.id,
            "state": "locked",
            "lockedAt": cfg.locked_at.isoformat() if cfg.locked_at else None,
        }
    if not cfg.selections:
        raise ValueError("cannot lock empty selections")
    missing = await _missing_mandatory_attrs(
        session,
        product_id=product_id,
        dpp_version=dpp_version,
        selections=cfg.selections,
    )
    if missing:
        raise ValueError("cannot lock; mandatory manifest attributes are missing")

    cfg.state = "locked"
    cfg.locked_at = datetime.now(UTC)
    cfg.locked_by = actor_id
    cfg.updated_at = cfg.locked_at
    await session.flush()

    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="dpp_config.locked",
        target_kind="product_dpp_config",
        target_id=str(cfg.id),
        severity="notice",
        details={
            "productId": product_id,
            "version": dpp_version,
            "attributeCount": _count_attrs(cfg.selections),
        },
    )
    return {
        "id": cfg.id,
        "state": "locked",
        "version": cfg.dpp_version,
        "lockedAt": cfg.locked_at.isoformat(),
        "lockedBy": cfg.locked_by,
    }


def _count_attrs(selections: dict[str, Any]) -> int:
    """Count attributes inside a selections dict shaped { stepId: [attrIds] }."""
    if not isinstance(selections, dict):
        return 0
    total = 0
    for v in selections.values():
        if isinstance(v, list):
            total += len(v)
    return total


async def _validate_config_selections(
    session: AsyncSession,
    *,
    product_id: int,
    dpp_version: str,
    selections: dict[str, Any],
) -> dict[str, list[int]]:
    """Normalise and validate selections against this product's manifest."""
    normalised = _normalise_selections(selections)
    chain_step_ids = {
        r[0]
        for r in (
            await session.execute(
                select(ProductProcessChain.process_step_id).where(
                    ProductProcessChain.product_id == product_id
                )
            )
        ).all()
    }
    unknown_steps = sorted(set(normalised) - chain_step_ids)
    if unknown_steps:
        raise ValueError(f"selection references steps outside product chain: {unknown_steps}")

    if not chain_step_ids:
        raise ValueError("product has no configured process chain")

    attrs = (
        await session.scalars(
            select(DppManifestAttr).where(
                DppManifestAttr.process_step_id.in_(chain_step_ids),
                DppManifestAttr.dpp_version.in_(_versions_up_to(dpp_version)),
            )
        )
    ).all()
    allowed_by_step: dict[int, set[int]] = defaultdict(set)
    for attr in attrs:
        allowed_by_step[attr.process_step_id].add(attr.id)

    for step_id, attr_ids in normalised.items():
        invalid = sorted(set(attr_ids) - allowed_by_step.get(step_id, set()))
        if invalid:
            raise ValueError(
                f"selection references manifest attributes outside step {step_id}: {invalid}"
            )

    return {str(step_id): attr_ids for step_id, attr_ids in sorted(normalised.items())}


def _normalise_selections(selections: dict[str, Any]) -> dict[int, list[int]]:
    if not isinstance(selections, dict):
        raise ValueError("selections must be an object shaped {stepId: [attrId, ...]}")

    normalised: dict[int, list[int]] = {}
    for raw_step_id, raw_attr_ids in selections.items():
        try:
            step_id = int(raw_step_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("selection step ids must be numeric") from exc
        if not isinstance(raw_attr_ids, list):
            raise ValueError("selection values must be arrays of manifest attribute ids")
        attr_ids: set[int] = set()
        for raw_attr_id in raw_attr_ids:
            try:
                attr_ids.add(int(raw_attr_id))
            except (TypeError, ValueError) as exc:
                raise ValueError("manifest attribute ids must be numeric") from exc
        normalised[step_id] = sorted(attr_ids)
    return normalised


async def _missing_mandatory_attrs(
    session: AsyncSession,
    *,
    product_id: int,
    dpp_version: str,
    selections: dict[str, Any],
) -> list[int]:
    normalised = _normalise_selections(selections)
    chain_step_ids = {
        r[0]
        for r in (
            await session.execute(
                select(ProductProcessChain.process_step_id).where(
                    ProductProcessChain.product_id == product_id
                )
            )
        ).all()
    }
    attrs = (
        await session.scalars(
            select(DppManifestAttr).where(
                DppManifestAttr.process_step_id.in_(chain_step_ids),
                DppManifestAttr.dpp_version.in_(_versions_up_to(dpp_version)),
                DppManifestAttr.necessity == "mandatory",
            )
        )
    ).all()
    selected = {step_id: set(attr_ids) for step_id, attr_ids in normalised.items()}
    missing: list[int] = []
    for attr in attrs:
        if attr.id not in selected.get(attr.process_step_id, set()):
            missing.append(attr.id)
    return missing


# ── L5: data sources ──────────────────────────────────────────────────


async def upsert_data_source(
    session: AsyncSession,
    *,
    tenant_id: int,
    product_id: int,
    process_step_id: int,
    origin: str,
    actor_id: str,
    supplier_name: str | None = None,
    supplier_did: str | None = None,
    connector_kind: str | None = None,
    connector_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if origin not in ("internal", "third_party"):
        raise ValueError("origin must be 'internal' or 'third_party'")
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        raise ValueError("product not found")
    step = await session.get(ProcessStep, process_step_id)
    if step is None:
        raise ValueError("process_step not found")

    src = await session.scalar(
        select(DataSource).where(
            DataSource.product_id == product_id,
            DataSource.process_step_id == process_step_id,
        )
    )
    if src is None:
        src = DataSource(
            tenant_id=tenant_id,
            product_id=product_id,
            process_step_id=process_step_id,
            origin=origin,
            supplier_name=supplier_name,
            supplier_did=supplier_did,
            connector_kind=connector_kind,
            connector_config=connector_config or {},
            permission_state="not_requested" if origin == "third_party" else "granted",
        )
        session.add(src)
    else:
        src.origin = origin
        src.supplier_name = supplier_name
        src.supplier_did = supplier_did
        src.connector_kind = connector_kind
        if connector_config is not None:
            src.connector_config = connector_config
        if origin == "internal":
            src.permission_state = "granted"

    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="data_source.upserted",
        target_kind="data_source",
        target_id=str(src.id),
        details={
            "productId": product_id,
            "stepId": process_step_id,
            "origin": origin,
            "supplier": supplier_name,
        },
    )
    return _serialise_source(src)


async def transition_permission(
    session: AsyncSession,
    *,
    tenant_id: int,
    source_id: int,
    new_state: str,
    actor_id: str,
) -> dict[str, Any]:
    if new_state not in ("requested", "granted", "denied"):
        raise ValueError("new_state must be requested|granted|denied")
    src = await session.get(DataSource, source_id)
    if src is None or src.tenant_id != tenant_id:
        raise ValueError("data source not found")
    old = src.permission_state
    src.permission_state = new_state
    await session.flush()
    await append_audit(
        session,
        tenant_id=tenant_id,
        actor_kind="user",
        actor_id=actor_id,
        action="data_source.permission_changed",
        target_kind="data_source",
        target_id=str(source_id),
        details={"from": old, "to": new_state},
    )
    return _serialise_source(src)


# ── L6: readiness ─────────────────────────────────────────────────────


async def ingest_readiness(
    session: AsyncSession, *, tenant_id: int, product_id: int, dpp_version: str
) -> dict[str, Any]:
    """Compute go-live gating state for a (product, version)."""
    product = await session.get(Product, product_id)
    if product is None or product.tenant_id != tenant_id:
        raise ValueError("product not found")

    cfg = await session.scalar(
        select(ProductDppConfig).where(
            ProductDppConfig.product_id == product_id,
            ProductDppConfig.dpp_version == dpp_version,
        )
    )
    sources = (
        await session.scalars(select(DataSource).where(DataSource.product_id == product_id))
    ).all()
    chain = (
        await session.execute(
            select(ProductProcessChain.process_step_id, ProcessStep.slug, ProcessStep.name)
            .join(ProcessStep, ProcessStep.id == ProductProcessChain.process_step_id)
            .where(ProductProcessChain.product_id == product_id)
            .order_by(ProductProcessChain.ordinal)
        )
    ).all()

    declared_step_ids = {s.process_step_id for s in sources}
    step_status: list[dict[str, Any]] = []
    for r in chain:
        src = next((s for s in sources if s.process_step_id == r.process_step_id), None)
        step_status.append(
            {
                "stepId": r.process_step_id,
                "slug": r.slug,
                "name": r.name,
                "hasSource": src is not None,
                "origin": src.origin if src else None,
                "supplierName": src.supplier_name if src else None,
                "permissionState": src.permission_state if src else None,
                "lastSyncStatus": src.last_sync_status if src else None,
            }
        )

    config_locked = cfg is not None and cfg.state == "locked"
    every_step_has_source = all(s["hasSource"] for s in step_status)
    third_party_granted = all(
        s.permission_state == "granted" for s in sources if s.origin == "third_party"
    )
    ready = config_locked and every_step_has_source and third_party_granted

    return {
        "product": _serialise_product(product),
        "version": dpp_version,
        "configLocked": config_locked,
        "everyStepHasSource": every_step_has_source,
        "thirdPartyGranted": third_party_granted,
        "ready": ready,
        "stepStatus": step_status,
        "missingSourceStepIds": [
            r.process_step_id for r in chain if r.process_step_id not in declared_step_ids
        ],
        "pendingThirdParties": [
            _serialise_source(s)
            for s in sources
            if s.origin == "third_party" and s.permission_state != "granted"
        ],
    }


# ── helpers ───────────────────────────────────────────────────────────


def _serialise_product(p: Product) -> dict[str, Any]:
    return {
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "brand": p.brand,
        "alloyFamily": p.alloy_family,
        "form": p.form,
        "description": p.description,
        "details": p.details,
    }


def _serialise_source(s: DataSource) -> dict[str, Any]:
    return {
        "id": s.id,
        "productId": s.product_id,
        "stepId": s.process_step_id,
        "origin": s.origin,
        "supplierName": s.supplier_name,
        "supplierDid": s.supplier_did,
        "connectorKind": s.connector_kind,
        "connectorConfig": s.connector_config,
        "permissionState": s.permission_state,
        "lastSyncAt": s.last_sync_at.isoformat() if s.last_sync_at else None,
        "lastSyncStatus": s.last_sync_status,
    }
