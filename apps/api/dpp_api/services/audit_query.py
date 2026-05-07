"""Audit-log read service — filterable timeline + hash-chain verification.

The audit log is append-only and tenant-scoped (SDD §12.1.8). Every mutation
on the platform writes one row via `services.audit.append_audit`. This service
exposes the read side: paginated/filterable list, single-entry fetch, and a
chain-verifier that recomputes SHA-256(prev_hash || canonical(body)) for every
row and reports the first divergence (if any).

Tenant isolation is enforced at the query level — RLS adds belt-and-braces but
we never trust a caller-supplied tenant_id; the dependency layer pins it.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import AuditLog


@dataclass(frozen=True)
class AuditQuery:
    tenant_id: int
    action: str | None = None
    actor_kind: str | None = None
    actor_id: str | None = None
    target_kind: str | None = None
    target_id: str | None = None
    severity: str | None = None
    since: datetime | None = None
    until: datetime | None = None
    limit: int = 100
    offset: int = 0


@dataclass(frozen=True)
class ChainBreak:
    entry_id: int
    expected_hash: str
    stored_hash: str
    reason: str


@dataclass(frozen=True)
class ChainVerification:
    verified: bool
    rows_checked: int
    first_break: ChainBreak | None = None
    breaks: list[ChainBreak] = field(default_factory=list)


async def query_audit_log(
    session: AsyncSession, query: AuditQuery
) -> tuple[list[dict[str, Any]], int]:
    """Return a page of audit-log entries plus the total count for the filter."""
    stmt = select(AuditLog).where(AuditLog.tenant_id == query.tenant_id)
    count_stmt = (
        select(func.count()).select_from(AuditLog).where(AuditLog.tenant_id == query.tenant_id)
    )
    if query.action:
        stmt = stmt.where(AuditLog.action == query.action)
        count_stmt = count_stmt.where(AuditLog.action == query.action)
    if query.actor_kind:
        stmt = stmt.where(AuditLog.actor_kind == query.actor_kind)
        count_stmt = count_stmt.where(AuditLog.actor_kind == query.actor_kind)
    if query.actor_id:
        stmt = stmt.where(AuditLog.actor_id == query.actor_id)
        count_stmt = count_stmt.where(AuditLog.actor_id == query.actor_id)
    if query.target_kind:
        stmt = stmt.where(AuditLog.target_kind == query.target_kind)
        count_stmt = count_stmt.where(AuditLog.target_kind == query.target_kind)
    if query.target_id:
        stmt = stmt.where(AuditLog.target_id == query.target_id)
        count_stmt = count_stmt.where(AuditLog.target_id == query.target_id)
    if query.severity:
        stmt = stmt.where(AuditLog.severity == query.severity)
        count_stmt = count_stmt.where(AuditLog.severity == query.severity)
    if query.since is not None:
        stmt = stmt.where(AuditLog.occurred_at >= query.since)
        count_stmt = count_stmt.where(AuditLog.occurred_at >= query.since)
    if query.until is not None:
        stmt = stmt.where(AuditLog.occurred_at <= query.until)
        count_stmt = count_stmt.where(AuditLog.occurred_at <= query.until)

    stmt = stmt.order_by(AuditLog.id.desc()).limit(query.limit).offset(query.offset)
    rows = (await session.scalars(stmt)).all()
    total = int((await session.scalar(count_stmt)) or 0)
    return [_serialise(r) for r in rows], total


async def get_audit_entry(
    session: AsyncSession, *, tenant_id: int, entry_id: int
) -> dict[str, Any] | None:
    row = await session.get(AuditLog, entry_id)
    if row is None or row.tenant_id != tenant_id:
        return None
    return _serialise(row)


async def verify_audit_chain(
    session: AsyncSession,
    *,
    tenant_id: int,
    since_id: int | None = None,
    until_id: int | None = None,
    max_rows: int = 10_000,
) -> ChainVerification:
    """Recompute every hash and check it against the stored value.

    Walks the chain in id order. The first row's `prev_hash` must be NULL OR
    equal to the previous-in-tenant row's `current_hash`; subsequent rows must
    chain forward consistently. Tampering surfaces as `breaks` rows pointing
    at the offending entry id.
    """
    stmt = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
    if since_id is not None:
        stmt = stmt.where(AuditLog.id >= since_id)
    if until_id is not None:
        stmt = stmt.where(AuditLog.id <= until_id)
    stmt = stmt.order_by(AuditLog.id.asc()).limit(max_rows)

    rows = (await session.scalars(stmt)).all()
    breaks: list[ChainBreak] = []
    expected_prev: str | None = None

    if rows and since_id is not None:
        # Anchor: previous row's hash, if any, is what this window's first
        # entry should chain off of.
        anchor = await session.scalar(
            select(AuditLog.current_hash)
            .where(AuditLog.tenant_id == tenant_id, AuditLog.id < rows[0].id)
            .order_by(AuditLog.id.desc())
            .limit(1)
        )
        expected_prev = anchor

    for row in rows:
        # 1. prev_hash must match the previous row's current_hash.
        if row.prev_hash != expected_prev:
            breaks.append(
                ChainBreak(
                    entry_id=row.id,
                    expected_hash=expected_prev or "",
                    stored_hash=row.prev_hash or "",
                    reason="prev_hash mismatch",
                )
            )
        # 2. current_hash must equal SHA-256 of the canonical body.
        expected = _expected_hash(row)
        if expected != row.current_hash:
            breaks.append(
                ChainBreak(
                    entry_id=row.id,
                    expected_hash=expected,
                    stored_hash=row.current_hash,
                    reason="current_hash recomputation differs",
                )
            )
        expected_prev = row.current_hash

    return ChainVerification(
        verified=not breaks,
        rows_checked=len(rows),
        first_break=breaks[0] if breaks else None,
        breaks=breaks,
    )


def _expected_hash(row: AuditLog) -> str:
    """Reproduce the canonicalisation used by services.audit.append_audit."""
    body: dict[str, Any] = {
        "tenant_id": row.tenant_id,
        "actor_kind": row.actor_kind,
        "actor_id": row.actor_id,
        "action": row.action,
        "target_kind": row.target_kind,
        "target_id": row.target_id,
        "severity": row.severity,
        "details": row.details or {},
        "occurred_at": row.occurred_at.isoformat(),
        "prev_hash": row.prev_hash,
    }
    serialised = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(serialised).hexdigest()


def _serialise(row: AuditLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "occurredAt": row.occurred_at.isoformat(),
        "actorKind": row.actor_kind,
        "actorId": row.actor_id,
        "action": row.action,
        "targetKind": row.target_kind,
        "targetId": row.target_id,
        "severity": row.severity,
        "details": row.details,
        "prevHash": row.prev_hash,
        "currentHash": row.current_hash,
    }
