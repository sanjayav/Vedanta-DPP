"""Reference-data lookups — CFP and compliance.

Generator calls into this module rather than inlining values so:
  - Verifiers can update CFP credentials without redeploying code.
  - Compliance certificate expiry is centrally trackable.
  - Multi-tenant configurations can override the platform defaults.

Falls back to the inline preset / SDD-default compliance set when the DB has
no row for the requested context. That fallback is what makes the platform
demoable on a fresh install, and what keeps tests independent of seed data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import ReferenceCfp, ReferenceCompliance


@dataclass(frozen=True)
class CfpReference:
    value_kg_co2e_per_tonne: float
    industry_average: float | None
    methodology: str
    period_from: str
    period_to: str
    verifier_did: str
    verifier_name: str
    statement_ref: str
    assurance_level: str
    decomposition: dict[str, float]


async def lookup_cfp(session: AsyncSession, *, tenant_id: int, brand: str) -> CfpReference | None:
    stmt = (
        select(ReferenceCfp)
        .where(
            ReferenceCfp.tenant_id == tenant_id,
            ReferenceCfp.brand == brand,
            ReferenceCfp.state == "active",
        )
        .order_by(ReferenceCfp.period_to.desc())
        .limit(1)
    )
    row = await session.scalar(stmt)
    if row is None:
        return None
    return CfpReference(
        value_kg_co2e_per_tonne=row.value_kg_co2e_per_tonne,
        industry_average=row.industry_average,
        methodology=row.methodology,
        period_from=row.period_from.date().isoformat(),
        period_to=row.period_to.date().isoformat(),
        verifier_did=row.verifier_did,
        verifier_name=row.verifier_name,
        statement_ref=row.statement_ref,
        assurance_level=row.assurance_level,
        decomposition={k: float(v) for k, v in (row.decomposition or {}).items()},
    )


async def lookup_compliance(
    session: AsyncSession, *, tenant_id: int
) -> dict[str, list[dict[str, Any]]]:
    rows = (
        await session.scalars(
            select(ReferenceCompliance).where(ReferenceCompliance.tenant_id == tenant_id)
        )
    ).all()
    out: dict[str, list[dict[str, Any]]] = {"regulations": [], "certifications": []}
    for r in rows:
        bucket = "regulations" if r.category == "regulation" else "certifications"
        entry: dict[str, Any] = {
            "name": r.name,
            "reference": r.reference,
            "status": r.status,
        }
        if r.issuer:
            entry["issuer"] = r.issuer
        if r.certificate_ref:
            entry["certificateRef"] = r.certificate_ref
        if r.valid_from:
            entry["validFrom"] = r.valid_from.date().isoformat()
        if r.valid_until:
            entry["validUntil"] = r.valid_until.date().isoformat()
        out[bucket].append(entry)
    return out
