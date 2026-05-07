"""End-to-end pipeline test — needs Postgres."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from dpp_api.db.models import AuditLog, CastEvent, DppRecord
from dpp_api.services.cast_events import ingest_cast_event
from dpp_api.services.pipeline import run_dpp_pipeline
from dpp_api.services.plausibility import PlausibilityRejection
from dpp_api.services.signer import verify_envelope
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _event(preset_id: str = "celestial-extrusion-billet-6063") -> dict[str, object]:
    return {
        "schemaVersion": "1.0.0",
        "trackingId": uuid4().hex,
        "source": {"kind": "simulator", "actor": "tests", "presetId": preset_id},
        "occurredAt": datetime.now(UTC).isoformat(),
        "tenantId": 1,
        "cast": {
            "castNumber": f"C-{uuid4().hex[:8]}",
            "alloyEn": "EN AW-6063",
            "alloyAa": "AA 6063",
            "brand": "CelestiAL",
            "form": "extrusion_billet",
            "weightKg": 1380,
            "diameterMm": 228,
            "lengthMm": 7000,
            "casthouseUfi": "0814406063812",
            "smelterUfi": "0814406063800",
            "purityGrade": "P1020A",
        },
    }


@pytest.mark.asyncio
async def test_full_pipeline_issues_signed_dpp(db_session: AsyncSession) -> None:
    payload = _event()
    ingestion = await ingest_cast_event(db_session, payload)
    assert ingestion.duplicate is False

    result = await run_dpp_pipeline(db_session, ingestion.cast_event_id)
    assert result.state == "published"
    assert result.upi
    assert result.digital_link_url.startswith("http://")

    # The DPP record exists and is signed.
    record = await db_session.scalar(select(DppRecord).where(DppRecord.upi == result.upi))
    assert record is not None
    assert record.state == "published"
    assert record.envelope is not None
    assert record.signature
    assert record.body_sha256

    # The signature verifies cryptographically.
    verify = verify_envelope(record.envelope)
    assert verify.valid is True
    assert verify.body_sha256 == record.body_sha256

    # The cast event flipped to published.
    cast_event = await db_session.scalar(
        select(CastEvent).where(CastEvent.id == ingestion.cast_event_id)
    )
    assert cast_event is not None
    assert cast_event.status == "published"

    # An audit log entry was written with a hash chain.
    audit = await db_session.scalar(select(AuditLog).where(AuditLog.target_id == result.upi))
    assert audit is not None
    assert audit.action == "dpp.issued"
    assert audit.current_hash


@pytest.mark.asyncio
async def test_idempotency_on_duplicate_tracking_id(db_session: AsyncSession) -> None:
    payload = _event()
    first = await ingest_cast_event(db_session, payload)
    second = await ingest_cast_event(db_session, payload)
    assert first.cast_event_id == second.cast_event_id
    assert second.duplicate is True


@pytest.mark.asyncio
async def test_pipeline_rejects_implausible_weight(db_session: AsyncSession) -> None:
    payload = _event()
    payload["cast"]["weightKg"] = 50000  # 50t billet — way out of band
    ingestion = await ingest_cast_event(db_session, payload)
    with pytest.raises(PlausibilityRejection):
        await run_dpp_pipeline(db_session, ingestion.cast_event_id)
