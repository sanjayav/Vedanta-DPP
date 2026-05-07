"""Rollover — the critical signature continuity test.

Issue a DPP, then issue a new credential, then roll over. After rollover:
  - The DPP body's CFP value matches the new credential.
  - The new envelope still cryptographically verifies.
  - The original body + envelope are preserved in revision_history.
  - revision_count == 1.
  - An audit-log entry exists with both prior and new SHA-256 hashes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from dpp_api.db.models import AuditLog, DppRecord
from dpp_api.services.cast_events import ingest_cast_event
from dpp_api.services.pipeline import run_dpp_pipeline
from dpp_api.services.rollover import rollover_dpps_to_credential
from dpp_api.services.signer import verify_envelope
from dpp_api.services.verifier_credentials import issue_cfp_credential
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _event() -> dict[str, object]:
    return {
        "schemaVersion": "1.0.0",
        "trackingId": uuid4().hex,
        "source": {
            "kind": "simulator",
            "actor": "tests",
            "presetId": "celestial-extrusion-billet-6063",
        },
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
async def test_rollover_re_signs_and_records_history(db_session: AsyncSession) -> None:
    # 1. Issue a DPP with the seed CFP (4273).
    ingestion = await ingest_cast_event(db_session, _event())
    pipeline = await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    record_before = await db_session.scalar(select(DppRecord).where(DppRecord.upi == pipeline.upi))
    assert record_before is not None
    assert record_before.cfp_kg_co2e_per_tonne == 4273
    assert record_before.revision_count == 0
    original_envelope = record_before.envelope

    # 2. Issue a new credential at a different value.
    issuance = await issue_cfp_credential(
        db_session,
        tenant_id=1,
        brand="CelestiAL",
        period_from=datetime(2026, 1, 1, tzinfo=UTC),
        period_to=datetime(2026, 12, 31, tzinfo=UTC),
        value_kg_co2e_per_tonne=4150,
        verifier_did="did:web:dnv.com:cfp",
        verifier_name="DNV — test",
        statement_ref="DNV-2026-CelestiAL",
        decomposition={"electrolysis": 1500, "casting": 470},
    )

    # 3. Roll over.
    result = await rollover_dpps_to_credential(
        db_session,
        tenant_id=1,
        credential_id=issuance.credential_id,
        actor_did="did:web:dnv.com:cfp",
    )
    assert pipeline.upi in result.succeeded
    assert pipeline.upi not in result.skipped
    assert not result.failed

    # 4. The record is updated, verifies, and preserves history.
    record_after = await db_session.scalar(select(DppRecord).where(DppRecord.upi == pipeline.upi))
    assert record_after is not None
    assert record_after.cfp_kg_co2e_per_tonne == 4150
    assert record_after.body["carbon"]["valueKgCo2ePerTonne"] == 4150
    assert record_after.body["carbon"]["verificationStatementRef"] == "DNV-2026-CelestiAL"
    assert record_after.revision_count == 1
    assert len(record_after.revision_history) == 1
    history = record_after.revision_history[0]
    assert history["priorCfp"] == 4273
    assert history["newCfp"] == 4150
    assert history["priorEnvelope"] == original_envelope

    # The new envelope must verify cleanly.
    verification = verify_envelope(record_after.envelope)
    assert verification.valid is True
    assert verification.body_sha256 == record_after.body_sha256

    # An audit-log entry exists for the rollover.
    audit = await db_session.scalar(
        select(AuditLog).where(
            AuditLog.action == "dpp.rolled_over",
            AuditLog.target_id == pipeline.upi,
        )
    )
    assert audit is not None
    assert audit.actor_id == "did:web:dnv.com:cfp"
    assert audit.details["priorCfp"] == 4273
    assert audit.details["newCfp"] == 4150


@pytest.mark.asyncio
async def test_rollover_skips_dpps_already_on_target(db_session: AsyncSession) -> None:
    ingestion = await ingest_cast_event(db_session, _event())
    pipeline = await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    issuance = await issue_cfp_credential(
        db_session,
        tenant_id=1,
        brand="CelestiAL",
        period_from=datetime(2026, 1, 1, tzinfo=UTC),
        period_to=datetime(2026, 12, 31, tzinfo=UTC),
        value_kg_co2e_per_tonne=4150,
        verifier_did="did:web:dnv.com:cfp",
        verifier_name="DNV",
        statement_ref="DNV-2026-CelestiAL",
    )
    # First rollover updates the DPP.
    await rollover_dpps_to_credential(
        db_session,
        tenant_id=1,
        credential_id=issuance.credential_id,
        actor_did="did:web:dnv.com:cfp",
    )
    # Second rollover finds nothing to do.
    second = await rollover_dpps_to_credential(
        db_session,
        tenant_id=1,
        credential_id=issuance.credential_id,
        actor_did="did:web:dnv.com:cfp",
    )
    assert pipeline.upi in second.skipped
    assert not second.succeeded
    assert not second.failed


@pytest.mark.asyncio
async def test_rollover_dry_run_does_not_mutate(db_session: AsyncSession) -> None:
    ingestion = await ingest_cast_event(db_session, _event())
    pipeline = await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    issuance = await issue_cfp_credential(
        db_session,
        tenant_id=1,
        brand="CelestiAL",
        period_from=datetime(2026, 1, 1, tzinfo=UTC),
        period_to=datetime(2026, 12, 31, tzinfo=UTC),
        value_kg_co2e_per_tonne=4150,
        verifier_did="did:web:dnv.com:cfp",
        verifier_name="DNV",
        statement_ref="DNV-2026-CelestiAL",
    )
    before = await db_session.scalar(select(DppRecord).where(DppRecord.upi == pipeline.upi))
    before_cfp = before.cfp_kg_co2e_per_tonne if before else 0

    result = await rollover_dpps_to_credential(
        db_session,
        tenant_id=1,
        credential_id=issuance.credential_id,
        actor_did="did:web:dnv.com:cfp",
        dry_run=True,
    )
    assert pipeline.upi in result.succeeded

    after = await db_session.scalar(select(DppRecord).where(DppRecord.upi == pipeline.upi))
    assert after is not None
    assert after.cfp_kg_co2e_per_tonne == before_cfp  # unchanged
    assert after.revision_count == 0


@pytest.mark.asyncio
async def test_rollover_rejects_non_active_credential(db_session: AsyncSession) -> None:
    issuance = await issue_cfp_credential(
        db_session,
        tenant_id=1,
        brand="CelestiAL",
        period_from=datetime(2026, 1, 1, tzinfo=UTC),
        period_to=datetime(2026, 12, 31, tzinfo=UTC),
        value_kg_co2e_per_tonne=4150,
        verifier_did="did:web:dnv.com:cfp",
        verifier_name="DNV",
        statement_ref="DNV-2026-CelestiAL",
    )
    # Issue a second one to push the first into superseded.
    await issue_cfp_credential(
        db_session,
        tenant_id=1,
        brand="CelestiAL",
        period_from=datetime(2026, 1, 1, tzinfo=UTC),
        period_to=datetime(2026, 12, 31, tzinfo=UTC),
        value_kg_co2e_per_tonne=4100,
        verifier_did="did:web:dnv.com:cfp",
        verifier_name="DNV",
        statement_ref="DNV-2026-newer",
    )
    with pytest.raises(ValueError, match="not active"):
        await rollover_dpps_to_credential(
            db_session,
            tenant_id=1,
            credential_id=issuance.credential_id,
            actor_did="did:web:dnv.com:cfp",
        )
