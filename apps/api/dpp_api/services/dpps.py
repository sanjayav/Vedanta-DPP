"""DPP read service — three-tier filtered views, list/search, withdraw."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppDraft, DppPublishDisclosure, DppRecord
from .audit import append_audit

AccessTier = Literal["public", "legitimate", "authority", "internal"]


# Field projection per tier — see SDD §13 + access_rights.publicFields.
# `legitimate` adds chemistry detail, MTC URLs, full SoC entries.
# `authority` returns the entire body including issuer-only fields.
_PUBLIC_TOP_LEVEL = {
    "schemaVersion",
    "dppVersion",
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
    "sustainability",
    "meta",
}

_LEGITIMATE_EXTRA = {"chemistry", "documentation", "soc", "useAndLife"}


def filter_for_tier(body: dict[str, Any], tier: AccessTier) -> dict[str, Any]:
    """Project a canonical DPP body down to the fields visible at `tier`.

    `internal` returns the full body for the producing tenant's own staff —
    same projection as `authority` but used by the console (operator / QA).
    """
    if tier in ("authority", "internal"):
        return body
    keep = _PUBLIC_TOP_LEVEL | (_LEGITIMATE_EXTRA if tier == "legitimate" else set())
    return {k: v for k, v in body.items() if k in keep}


_AUDIENCE_BY_TIER: dict[AccessTier, str | None] = {
    "public": "public",
    "legitimate": "customer",
    "authority": "authority",
    "internal": None,  # producer's own staff — see everything
}


async def fetch_dpp_view(
    session: AsyncSession, *, upi: str, tier: AccessTier = "public"
) -> dict[str, Any] | None:
    record = await session.scalar(select(DppRecord).where(DppRecord.upi == upi))
    if record is None:
        return None
    body = filter_for_tier(record.body, tier)

    audience = _AUDIENCE_BY_TIER[tier]
    if audience is not None:
        hidden_paths = await _hidden_paths_for_record(
            session, record_id=record.id, audience=audience
        )
        if hidden_paths:
            body = _strip_paths(body, hidden_paths)

    return {
        "upi": record.upi,
        "state": record.state,
        "tier": tier,
        "issuedAt": record.issued_at.isoformat() if record.issued_at else None,
        "expiresAt": record.expires_at.isoformat() if record.expires_at else None,
        "envelope": record.envelope if tier in ("authority", "internal") else None,
        "signatureRef": {
            "algorithm": "Ed25519Signature2020",
            "value": record.signature,
            "bodySha256": record.body_sha256,
        }
        if record.signature
        else None,
        "dpp": body,
    }


async def _hidden_paths_for_record(
    session: AsyncSession, *, record_id: int, audience: str
) -> set[str]:
    """Return attribute paths the producer hid from this audience at publish time."""
    draft = await session.scalar(select(DppDraft).where(DppDraft.published_dpp_id == record_id))
    if draft is None:
        return set()
    rows = (
        await session.scalars(
            select(DppPublishDisclosure).where(
                DppPublishDisclosure.draft_id == draft.id,
                DppPublishDisclosure.audience == audience,
                DppPublishDisclosure.visible.is_(False),
            )
        )
    ).all()
    return {r.attribute_path for r in rows}


def _strip_paths(body: dict[str, Any], paths: set[str]) -> dict[str, Any]:
    """Return a copy of `body` with each dotted path unset.

    Empty parent objects are pruned so the JSON sent to the viewer doesn't
    leak the existence of a hidden field via an empty container.
    """
    if not paths:
        return body
    out: dict[str, Any] = {k: _deepcopy_jsonable(v) for k, v in body.items()}
    for path in paths:
        _unset_path(out, path.split("."))
    return out


def _deepcopy_jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _deepcopy_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_deepcopy_jsonable(v) for v in value]
    return value


def _unset_path(node: Any, parts: list[str]) -> None:
    if not parts or not isinstance(node, dict):
        return
    head, *rest = parts
    if not rest:
        node.pop(head, None)
        return
    child = node.get(head)
    if not isinstance(child, dict):
        return
    _unset_path(child, rest)
    if not child:
        node.pop(head, None)


async def list_dpps(
    session: AsyncSession,
    *,
    brand: str | None = None,
    state: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(DppRecord)
    count_stmt = select(func.count()).select_from(DppRecord)
    if brand:
        stmt = stmt.where(DppRecord.brand == brand)
        count_stmt = count_stmt.where(DppRecord.brand == brand)
    if state:
        stmt = stmt.where(DppRecord.state == state)
        count_stmt = count_stmt.where(DppRecord.state == state)
    stmt = stmt.order_by(DppRecord.issued_at.desc().nullslast()).limit(limit).offset(offset)

    rows = (await session.scalars(stmt)).all()
    total = (await session.scalar(count_stmt)) or 0
    items = [
        {
            "upi": r.upi,
            "brand": r.brand,
            "alloy": r.alloy,
            "form": r.form,
            "weightKg": r.weight_kg,
            "cfpKgCo2ePerTonne": r.cfp_kg_co2e_per_tonne,
            "recycledContentPct": r.recycled_content_pct,
            "state": r.state,
            "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
            "digitalLinkUrl": r.body.get("upi", {}).get("digitalLinkUrl"),
        }
        for r in rows
    ]
    return items, int(total)


async def withdraw_dpp(
    session: AsyncSession, *, upi: str, reason: str, actor: str
) -> dict[str, Any] | None:
    record = await session.scalar(select(DppRecord).where(DppRecord.upi == upi))
    if record is None:
        return None
    now = datetime.now(UTC)
    record.state = "withdrawn"
    record.withdrawn_at = now
    await append_audit(
        session,
        tenant_id=record.tenant_id,
        actor_kind="user",
        actor_id=actor,
        action="dpp.withdrawn",
        target_kind="dpp",
        target_id=upi,
        severity="notice",
        details={"reason": reason},
    )
    return {"upi": upi, "state": "withdrawn", "withdrawnAt": now.isoformat()}


async def resolve_by_digital_link(
    session: AsyncSession, *, gtin: str, batch: str, serial: str | None = None
) -> str | None:
    stmt = select(DppRecord.upi).where(DppRecord.gtin == gtin, DppRecord.cast_number == batch)
    if serial:
        stmt = stmt.where(DppRecord.item_serial == serial)
    result: str | None = await session.scalar(stmt)
    return result
