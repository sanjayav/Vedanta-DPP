"""Audit-log query + hash-chain verification.

The chain check is the load-bearing test: regulators ask the platform to prove
the audit log hasn't been edited, and the verifier walks every row recomputing
SHA-256(prev_hash || canonical(body)). A clean log MUST verify; tampering at
*any* row MUST surface as a break.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from dpp_api.db.models import AuditLog
from dpp_api.services.audit import append_audit
from dpp_api.services.audit_query import (
    AuditQuery,
    get_audit_entry,
    query_audit_log,
    verify_audit_chain,
)
from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession


async def _seed_three(session: AsyncSession) -> list[AuditLog]:
    rows = [
        await append_audit(
            session,
            tenant_id=1,
            actor_kind="system",
            actor_id="pipeline",
            action="dpp.issued",
            target_kind="dpp",
            target_id=f"dpp-{uuid4().hex[:8]}",
            severity="info",
            details={"upi": "01/01/01"},
        ),
        await append_audit(
            session,
            tenant_id=1,
            actor_kind="external_verifier",
            actor_id="did:web:dnv.com:cfp",
            action="credential.issued",
            target_kind="reference_cfp",
            target_id="42",
            severity="notice",
            details={"brand": "CelestiAL", "value": 4150},
        ),
        await append_audit(
            session,
            tenant_id=1,
            actor_kind="external_verifier",
            actor_id="did:web:dnv.com:cfp",
            action="credential.revoked",
            target_kind="reference_cfp",
            target_id="42",
            severity="warn",
            details={"affectedDppCount": 7},
        ),
    ]
    await session.flush()
    return rows


@pytest.mark.asyncio
async def test_query_returns_newest_first(db_session: AsyncSession) -> None:
    rows = await _seed_three(db_session)
    items, total = await query_audit_log(db_session, AuditQuery(tenant_id=1, limit=10))
    assert total >= 3
    # Newest first.
    assert items[0]["id"] == rows[-1].id
    assert items[1]["id"] == rows[-2].id


@pytest.mark.asyncio
async def test_query_filters_by_action_and_actor(db_session: AsyncSession) -> None:
    await _seed_three(db_session)
    issued, _ = await query_audit_log(
        db_session, AuditQuery(tenant_id=1, action="credential.issued", limit=10)
    )
    assert len(issued) == 1
    assert issued[0]["action"] == "credential.issued"

    by_dnv, _ = await query_audit_log(
        db_session,
        AuditQuery(
            tenant_id=1, actor_kind="external_verifier", actor_id="did:web:dnv.com:cfp", limit=10
        ),
    )
    assert len(by_dnv) == 2
    assert {r["action"] for r in by_dnv} == {"credential.issued", "credential.revoked"}


@pytest.mark.asyncio
async def test_query_time_window(db_session: AsyncSession) -> None:
    await _seed_three(db_session)
    future = datetime.now(UTC) + timedelta(days=1)
    past = datetime.now(UTC) - timedelta(days=1)

    none, _ = await query_audit_log(db_session, AuditQuery(tenant_id=1, since=future))
    assert none == []

    some, total = await query_audit_log(db_session, AuditQuery(tenant_id=1, since=past))
    assert total >= 3
    assert len(some) >= 3


@pytest.mark.asyncio
async def test_get_entry_respects_tenant(db_session: AsyncSession) -> None:
    rows = await _seed_three(db_session)
    fetched = await get_audit_entry(db_session, tenant_id=1, entry_id=rows[0].id)
    assert fetched is not None
    assert fetched["id"] == rows[0].id

    # Wrong tenant — return None even though the row exists.
    miss = await get_audit_entry(db_session, tenant_id=999, entry_id=rows[0].id)
    assert miss is None


@pytest.mark.asyncio
async def test_chain_verifies_clean_log(db_session: AsyncSession) -> None:
    await _seed_three(db_session)
    result = await verify_audit_chain(db_session, tenant_id=1)
    assert result.verified is True
    assert result.first_break is None
    assert result.rows_checked >= 3


@pytest.mark.asyncio
async def test_chain_detects_tampered_details(db_session: AsyncSession) -> None:
    rows = await _seed_three(db_session)
    target = rows[1]  # the credential.issued row in the middle of the chain

    # Tamper directly via SQL — bypass the ORM so audit.append_audit can't help.
    await db_session.execute(
        update(AuditLog)
        .where(AuditLog.id == target.id)
        .values(details={"brand": "CelestiAL", "value": 999_999})
    )
    await db_session.flush()

    result = await verify_audit_chain(db_session, tenant_id=1)
    assert result.verified is False
    assert result.first_break is not None
    assert result.first_break.entry_id == target.id
    # Tampering with details breaks the row's own hash AND the next row's
    # prev_hash linkage (because prev_hash is unchanged but our recomputation
    # now treats the tampered row's expected hash as different).
    assert result.first_break.reason == "current_hash recomputation differs"


@pytest.mark.asyncio
async def test_chain_detects_severed_link(db_session: AsyncSession) -> None:
    rows = await _seed_three(db_session)
    # Sever the chain by clearing prev_hash on the second row.
    await db_session.execute(
        update(AuditLog).where(AuditLog.id == rows[1].id).values(prev_hash=None)
    )
    await db_session.flush()

    result = await verify_audit_chain(db_session, tenant_id=1)
    assert result.verified is False
    assert result.first_break is not None
    assert result.first_break.entry_id == rows[1].id
    assert result.first_break.reason == "prev_hash mismatch"


@pytest.mark.asyncio
async def test_query_isolates_tenants(db_session: AsyncSession) -> None:
    """Belt-and-braces: even with RLS, the query must scope to tenant_id."""
    # Seed tenant 1.
    await _seed_three(db_session)
    # Stand up tenant 2 + add one row by hand (avoids needing a fixture).
    await db_session.execute(
        text(
            "INSERT INTO tenants (id, slug, legal_name, status, tier, branding, created_at)"
            " VALUES (2, 'other', 'Other Co', 'active', 'production', '{}', now())"
            " ON CONFLICT (id) DO NOTHING"
        )
    )
    # RLS demands the GUC match the row's tenant_id on INSERT. Swap it so the
    # tenant-2 row is allowed in, then swap back for the queries below.
    await db_session.execute(text("SELECT set_config('app.current_tenant_id', '2', true)"))
    await append_audit(
        db_session,
        tenant_id=2,
        actor_kind="system",
        actor_id="pipeline",
        action="dpp.issued",
        target_kind="dpp",
        target_id="other-dpp",
    )
    await db_session.flush()
    # Unscoped (platform-tier) so both queries can see their respective rows
    # — query_audit_log applies the WHERE tenant_id filter itself.
    await db_session.execute(text("SELECT set_config('app.current_tenant_id', '', true)"))

    items_t1, _ = await query_audit_log(db_session, AuditQuery(tenant_id=1, limit=100))
    items_t2, total_t2 = await query_audit_log(db_session, AuditQuery(tenant_id=2, limit=100))
    assert all(r["targetId"] != "other-dpp" for r in items_t1)
    assert total_t2 == 1
    assert items_t2[0]["targetId"] == "other-dpp"
