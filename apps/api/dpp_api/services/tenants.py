"""Platform-tier tenant administration.

Used by the Super Admin surface (`/admin`). Read-only in v1.0; tenant
provisioning + Stripe billing land in Sprint 8.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppRecord, ReferenceCfp


async def list_tenants(session: AsyncSession) -> list[dict[str, Any]]:
    """List every tenant with rough activity counts.

    Caller must be platform-tier (the dependency layer enforces). Runs
    unscoped (tenant_id=0) so RLS lets us see all rows.
    """
    rows = (
        (
            await session.execute(
                text_with_counts(),
            )
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows]


def text_with_counts() -> Any:
    """The aggregation we need is a single LEFT JOIN-driven group-by."""
    from sqlalchemy import text

    return text(
        """
        SELECT
            t.id,
            t.slug,
            t.legal_name AS "legalName",
            t.status,
            t.tier,
            t.created_at AS "createdAt",
            (SELECT count(*) FROM dpp_records d WHERE d.tenant_id = t.id) AS "dppCount",
            (SELECT count(*) FROM reference_cfp r WHERE r.tenant_id = t.id AND r.state = 'active')
                AS "activeCredentialCount"
        FROM tenants t
        ORDER BY t.id ASC
        """
    )


async def trust_list(session: AsyncSession) -> list[dict[str, Any]]:
    """Distinct verifier DIDs that have ever issued a credential on the platform.

    The trust list will become editable in Sprint 8 — for now it's derived from
    actual issuance history so admins can see who is signing.
    """
    stmt = (
        select(
            ReferenceCfp.verifier_did.label("did"),
            ReferenceCfp.verifier_name.label("name"),
            func.count(ReferenceCfp.id).label("credentials"),
            func.max(ReferenceCfp.created_at).label("latest"),
        )
        .group_by(ReferenceCfp.verifier_did, ReferenceCfp.verifier_name)
        .order_by(func.max(ReferenceCfp.created_at).desc())
    )
    rows = (await session.execute(stmt)).mappings().all()
    return [
        {
            "did": r["did"],
            "name": r["name"],
            "credentials": int(r["credentials"]),
            "latest": r["latest"].isoformat() if r["latest"] else None,
        }
        for r in rows
    ]


async def platform_overview(session: AsyncSession) -> dict[str, Any]:
    """Single-row counters for the Admin overview tab."""
    tenants_count = (await session.scalar(select(func.count()).select_from(_tenants_table()))) or 0
    dpp_count = (await session.scalar(select(func.count()).select_from(DppRecord))) or 0
    active_creds = (
        await session.scalar(
            select(func.count()).select_from(ReferenceCfp).where(ReferenceCfp.state == "active")
        )
        or 0
    )
    return {
        "tenants": int(tenants_count),
        "dpps": int(dpp_count),
        "activeCredentials": int(active_creds),
    }


def _tenants_table() -> Any:
    from ..db.session import Base

    return Base.metadata.tables["tenants"]
