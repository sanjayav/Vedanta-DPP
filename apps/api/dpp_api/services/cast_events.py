"""Cast-event ingestion service.

Validates the inbound payload against the canonical schema, persists it
idempotently (one row per (tenant_id, tracking_id)), and returns a handle the
pipeline can use to continue.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from dateutil.parser import isoparse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CastEvent
from .schema_validator import validate_against


@dataclass(frozen=True)
class IngestionResult:
    cast_event_id: int
    tracking_id: str
    duplicate: bool


async def ingest_cast_event(session: AsyncSession, payload: dict[str, Any]) -> IngestionResult:
    """Validate and persist a canonical cast event."""
    validate_against("cast-event/v1.0.0", payload)

    tenant_id = int(payload["tenantId"])
    tracking_id = str(payload["trackingId"])

    # Idempotency: re-submissions with the same tracking id return the prior row.
    existing = await session.scalar(
        select(CastEvent).where(
            CastEvent.tenant_id == tenant_id, CastEvent.tracking_id == tracking_id
        )
    )
    if existing is not None:
        return IngestionResult(cast_event_id=existing.id, tracking_id=tracking_id, duplicate=True)

    record = CastEvent(
        tenant_id=tenant_id,
        tracking_id=tracking_id,
        source_kind=str(payload["source"]["kind"]),
        source_actor=payload["source"].get("actor"),
        occurred_at=_parse_dt(payload["occurredAt"]),
        payload=payload,
        schema_version=str(payload.get("schemaVersion", "1.0.0")),
        status="received",
    )
    session.add(record)
    await session.flush()
    return IngestionResult(cast_event_id=record.id, tracking_id=tracking_id, duplicate=False)


async def get_status_by_tracking_id(
    session: AsyncSession, tracking_id: str
) -> dict[str, Any] | None:
    row = await session.scalar(select(CastEvent).where(CastEvent.tracking_id == tracking_id))
    if row is None:
        return None
    return {
        "tracking_id": row.tracking_id,
        "status": row.status,
        "cast_event_id": row.id,
    }


def _parse_dt(value: str) -> datetime:
    return isoparse(value)
