"""Tenant-side view of the external verifiers known to the platform.

Whereas `services.verifier_credentials` is the verifier's own write/read
surface (issue, revoke, list-mine), this service answers the *tenant*'s
question: "which external verifiers are signing my DPPs, and what's the
shape of their issuance?".

Cards are grouped by verifier DID. For each group we surface:
  - All brands the verifier has issued for.
  - The single most recent active credential per brand (the credential
    currently being cited by published DPPs).
  - Counts by state across the verifier's issuance history.
  - Latest validity window per brand (so the UI can flag near-expiry).
  - Total DPP count currently referencing any of this verifier's active
    statement_refs — the number that "depends on" this verifier today.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppRecord, ReferenceCfp


@dataclass(frozen=True)
class _BrandLine:
    brand: str
    facility_ufi: str | None
    period_from: str
    period_to: str
    value_kg_co2e_per_tonne: float
    statement_ref: str
    assurance_level: str
    state: str
    created_at: str


async def list_verifier_registry(session: AsyncSession, *, tenant_id: int) -> list[dict[str, Any]]:
    """Return one card per verifier DID with all brand lines + DPP counts."""
    rows = (
        await session.scalars(
            select(ReferenceCfp)
            .where(ReferenceCfp.tenant_id == tenant_id)
            .order_by(ReferenceCfp.verifier_did, ReferenceCfp.brand, ReferenceCfp.id.desc())
        )
    ).all()

    by_verifier: dict[str, dict[str, Any]] = {}
    active_statement_refs: dict[str, set[str]] = defaultdict(set)

    for r in rows:
        bucket = by_verifier.setdefault(
            r.verifier_did,
            {
                "verifierDid": r.verifier_did,
                "verifierName": r.verifier_name,
                "brands": [],
                "stateCounts": {"active": 0, "superseded": 0, "revoked": 0},
                "latestStatementRef": None,
                "latestPeriodTo": None,
            },
        )
        # Keep the verifier's display name fresh from the most recent row.
        bucket["verifierName"] = r.verifier_name

        bucket["brands"].append(
            {
                "id": r.id,
                "brand": r.brand,
                "facilityUfi": r.facility_ufi,
                "periodFrom": r.period_from.date().isoformat(),
                "periodTo": r.period_to.date().isoformat(),
                "valueKgCo2ePerTonne": r.value_kg_co2e_per_tonne,
                "statementRef": r.statement_ref,
                "assuranceLevel": r.assurance_level,
                "state": r.state,
                "createdAt": r.created_at.isoformat(),
            }
        )
        bucket["stateCounts"][r.state] = bucket["stateCounts"].get(r.state, 0) + 1

        if r.state == "active":
            active_statement_refs[r.verifier_did].add(r.statement_ref)
            iso_to = r.period_to.date().isoformat()
            if bucket["latestPeriodTo"] is None or iso_to > bucket["latestPeriodTo"]:
                bucket["latestPeriodTo"] = iso_to
                bucket["latestStatementRef"] = r.statement_ref

    # Count DPPs whose body cites an active statement_ref of each verifier.
    if active_statement_refs:
        all_active_refs = {ref for refs in active_statement_refs.values() for ref in refs}
        dpp_rows = (
            await session.scalars(
                select(DppRecord).where(
                    DppRecord.tenant_id == tenant_id,
                    DppRecord.state == "published",
                )
            )
        ).all()
        by_ref: dict[str, int] = defaultdict(int)
        for d in dpp_rows:
            ref = d.body.get("carbon", {}).get("verificationStatementRef")
            if ref and ref in all_active_refs:
                by_ref[ref] += 1
        for did, refs in active_statement_refs.items():
            by_verifier[did]["dependentDppCount"] = sum(by_ref.get(r, 0) for r in refs)
    for bucket in by_verifier.values():
        bucket.setdefault("dependentDppCount", 0)

    # Stable ordering: most-depended-on first, then alphabetical.
    return sorted(
        by_verifier.values(),
        key=lambda b: (-int(b["dependentDppCount"]), b["verifierDid"]),
    )
