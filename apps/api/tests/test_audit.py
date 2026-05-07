"""Audit log hash chain — every entry hashes its predecessor."""

from __future__ import annotations

import pytest
from dpp_api.db.models import AuditLog
from dpp_api.services.audit import append_audit
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_hash_chain_is_consistent(db_session: AsyncSession) -> None:
    a = await append_audit(
        db_session,
        tenant_id=1,
        actor_kind="system",
        action="test.first",
        target_kind="dpp",
        target_id="t-1",
        details={"i": 1},
    )
    b = await append_audit(
        db_session,
        tenant_id=1,
        actor_kind="system",
        action="test.second",
        target_kind="dpp",
        target_id="t-2",
        details={"i": 2},
    )
    c = await append_audit(
        db_session,
        tenant_id=1,
        actor_kind="system",
        action="test.third",
        target_kind="dpp",
        target_id="t-3",
        details={"i": 3},
    )

    rows = (await db_session.scalars(select(AuditLog).order_by(AuditLog.id.asc()))).all()
    assert len(rows) >= 3
    last_three = rows[-3:]
    assert last_three[0].id == a.id
    assert last_three[1].id == b.id
    assert last_three[2].id == c.id

    assert last_three[0].current_hash
    assert last_three[1].prev_hash == last_three[0].current_hash
    assert last_three[2].prev_hash == last_three[1].current_hash


@pytest.mark.asyncio
async def test_chain_starts_with_null_prev(db_session: AsyncSession) -> None:
    first = (
        await db_session.scalars(
            select(AuditLog).where(AuditLog.tenant_id == 1).order_by(AuditLog.id.asc()).limit(1)
        )
    ).first()
    if first is None:
        # No prior entries — write one and assert.
        first = await append_audit(
            db_session,
            tenant_id=1,
            actor_kind="system",
            action="test.first-ever",
            target_kind="meta",
        )
        assert first.prev_hash is None
        assert first.current_hash
