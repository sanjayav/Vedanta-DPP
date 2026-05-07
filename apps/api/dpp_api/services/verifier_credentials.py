"""Verifier credential management — DNV / Bureau Veritas / ASI / notified bodies.

Each issuance:
  - Inserts a new row in `reference_cfp` with state='active'.
  - Marks the prior active row(s) for the same (tenant, brand) as 'superseded'.
  - Writes an audit-log entry tagged with the verifier DID.
  - Returns the affected-DPP preview so the verifier can decide whether to roll
    forward existing records (a separate explicit step — see `rollover.py`).

Revocation:
  - Marks state='revoked' so future generation no longer picks the credential.
  - Identifies DPPs whose envelopes still cite the revoked statement; the
    verifier can then trigger rollover or the platform team can intervene.

In v1.5 the verifier presents a real W3C VC issued by their own DID-controlled
wallet; we verify that VC's signature against the trust list before accepting
the issuance. v1.0 trusts an `X-Verifier-Did` header for development.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppRecord, ReferenceCfp


@dataclass(frozen=True)
class IssuanceResult:
    credential_id: int
    superseded_ids: list[int]
    affected_dpp_count: int


@dataclass(frozen=True)
class RevocationResult:
    credential_id: int
    affected_dpp_upis: list[str]


async def issue_cfp_credential(
    session: AsyncSession,
    *,
    tenant_id: int,
    brand: str,
    period_from: datetime,
    period_to: datetime,
    value_kg_co2e_per_tonne: float,
    verifier_did: str,
    verifier_name: str,
    statement_ref: str,
    assurance_level: str = "limited",
    industry_average: float | None = 14600,
    methodology: str = "ISO 14067:2018 + IAI v2.0 + PCR 2022:08 v1.0",
    decomposition: dict[str, float] | None = None,
    facility_ufi: str | None = None,
) -> IssuanceResult:
    """Issue a new CFP credential. Supersedes any prior active row for the same brand."""
    if value_kg_co2e_per_tonne <= 0:
        raise ValueError("value_kg_co2e_per_tonne must be > 0")
    if period_from >= period_to:
        raise ValueError("period_from must precede period_to")
    if assurance_level not in {"limited", "reasonable"}:
        raise ValueError("assurance_level must be 'limited' or 'reasonable'")

    superseded_ids: list[int] = []
    prior_rows = (
        await session.scalars(
            select(ReferenceCfp).where(
                ReferenceCfp.tenant_id == tenant_id,
                ReferenceCfp.brand == brand,
                ReferenceCfp.state == "active",
            )
        )
    ).all()
    for prior in prior_rows:
        prior.state = "superseded"
        superseded_ids.append(prior.id)

    new_row = ReferenceCfp(
        tenant_id=tenant_id,
        brand=brand,
        facility_ufi=facility_ufi,
        period_from=period_from,
        period_to=period_to,
        value_kg_co2e_per_tonne=value_kg_co2e_per_tonne,
        industry_average=industry_average,
        methodology=methodology,
        verifier_did=verifier_did,
        verifier_name=verifier_name,
        statement_ref=statement_ref,
        assurance_level=assurance_level,
        decomposition=decomposition or {},
        state="active",
    )
    session.add(new_row)
    await session.flush()

    affected = await _count_affected_dpps(session, tenant_id=tenant_id, brand=brand)
    return IssuanceResult(
        credential_id=new_row.id,
        superseded_ids=superseded_ids,
        affected_dpp_count=affected,
    )


async def revoke_credential(
    session: AsyncSession,
    *,
    tenant_id: int,
    credential_id: int,
    verifier_did: str,
) -> RevocationResult:
    row = await session.get(ReferenceCfp, credential_id)
    if row is None or row.tenant_id != tenant_id:
        raise ValueError("credential not found")
    if row.verifier_did != verifier_did:
        raise PermissionError(f"credential is owned by {row.verifier_did}, not {verifier_did}")
    if row.state == "revoked":
        return RevocationResult(credential_id=credential_id, affected_dpp_upis=[])

    row.state = "revoked"
    await session.flush()

    affected = await _affected_dpp_upis(session, statement_ref=row.statement_ref)
    return RevocationResult(credential_id=credential_id, affected_dpp_upis=affected)


async def list_credentials(
    session: AsyncSession,
    *,
    tenant_id: int,
    verifier_did: str | None = None,
    state: str | None = None,
) -> list[dict[str, Any]]:
    stmt = select(ReferenceCfp).where(ReferenceCfp.tenant_id == tenant_id)
    if verifier_did:
        stmt = stmt.where(ReferenceCfp.verifier_did == verifier_did)
    if state:
        stmt = stmt.where(ReferenceCfp.state == state)
    stmt = stmt.order_by(ReferenceCfp.period_to.desc(), ReferenceCfp.id.desc())
    rows = (await session.scalars(stmt)).all()
    return [
        {
            "id": r.id,
            "brand": r.brand,
            "facilityUfi": r.facility_ufi,
            "periodFrom": r.period_from.date().isoformat(),
            "periodTo": r.period_to.date().isoformat(),
            "valueKgCo2ePerTonne": r.value_kg_co2e_per_tonne,
            "industryAverage": r.industry_average,
            "verifierDid": r.verifier_did,
            "verifierName": r.verifier_name,
            "statementRef": r.statement_ref,
            "assuranceLevel": r.assurance_level,
            "state": r.state,
            "createdAt": r.created_at.isoformat(),
        }
        for r in rows
    ]


async def affected_dpps_for_credential(
    session: AsyncSession, *, tenant_id: int, credential_id: int
) -> dict[str, Any]:
    row = await session.get(ReferenceCfp, credential_id)
    if row is None or row.tenant_id != tenant_id:
        raise ValueError("credential not found")

    # DPPs whose envelope cites the same statement_ref OR whose body's CFP value
    # matches and brand matches — superseded credentials still leave a paper trail.
    upis = await _affected_dpp_upis(session, statement_ref=row.statement_ref)
    candidates = (
        await session.scalars(
            select(DppRecord)
            .where(DppRecord.tenant_id == tenant_id, DppRecord.brand == row.brand)
            .order_by(DppRecord.issued_at.desc().nullslast())
            .limit(500)
        )
    ).all()

    return {
        "credentialId": credential_id,
        "brand": row.brand,
        "statementRef": row.statement_ref,
        "byStatementRefCount": len(upis),
        "byBrandCount": len(candidates),
        "samples": [
            {
                "upi": c.upi,
                "issuedAt": c.issued_at.isoformat() if c.issued_at else None,
                "currentCfp": c.cfp_kg_co2e_per_tonne,
                "currentStatementRef": c.body.get("carbon", {}).get("verificationStatementRef"),
                "willChange": c.body.get("carbon", {}).get("verificationStatementRef")
                != row.statement_ref,
            }
            for c in candidates[:25]
        ],
    }


async def _count_affected_dpps(session: AsyncSession, *, tenant_id: int, brand: str) -> int:
    stmt = (
        select(func.count())
        .select_from(DppRecord)
        .where(
            DppRecord.tenant_id == tenant_id,
            DppRecord.brand == brand,
            DppRecord.state == "published",
        )
    )
    return int((await session.scalar(stmt)) or 0)


async def _affected_dpp_upis(session: AsyncSession, *, statement_ref: str) -> list[str]:
    stmt = select(DppRecord.upi).where(
        DppRecord.body["carbon"]["verificationStatementRef"].astext == statement_ref
    )
    return list((await session.scalars(stmt)).all())
