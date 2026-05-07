"""Bundle export — DPPs in, signed ZIP out, receipt verifies."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from dpp_api.services.bundles import export_bundle
from dpp_api.services.cast_events import ingest_cast_event
from dpp_api.services.pipeline import run_dpp_pipeline
from dpp_api.services.signer import verify_envelope
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
async def test_bundle_round_trip(db_session: AsyncSession) -> None:
    # Issue two DPPs to bundle.
    upis: list[str] = []
    for _ in range(2):
        ingestion = await ingest_cast_event(db_session, _event())
        result = await run_dpp_pipeline(db_session, ingestion.cast_event_id)
        upis.append(result.upi)
    assert len(upis) == 2

    bundle = await export_bundle(db_session, upis=upis, requested_by="bmw")
    assert bundle.item_count == 2
    assert bundle.size_bytes > 0
    assert bundle.sha256

    with zipfile.ZipFile(io.BytesIO(bundle.archive)) as zf:
        names = set(zf.namelist())
        # Required artefacts
        assert "manifest.json" in names
        assert "receipt.signed.json" in names
        assert "audit-log.json" in names
        assert "README.md" in names
        for upi in upis:
            assert f"dpps/{upi}/dpp.json" in names
            assert f"dpps/{upi}/envelope.json" in names

        manifest = json.loads(zf.read("manifest.json"))
        assert manifest["type"] == "DppExportBundle"
        assert manifest["receiptId"] == bundle.receipt_id
        assert {it["upi"] for it in manifest["items"]} == set(upis)

        # Receipt is a signed envelope and verifies cleanly.
        receipt = json.loads(zf.read("receipt.signed.json"))
        result = verify_envelope(receipt)
        assert result.valid is True

        # Tampering with the manifest invalidates the receipt — it's signed over.
        tampered_receipt = json.loads(zf.read("receipt.signed.json"))
        tampered_receipt["credentialSubject"]["dpp"]["_bundle"]["receiptId"] = "FORGED"
        result_bad = verify_envelope(tampered_receipt)
        assert result_bad.valid is False


@pytest.mark.asyncio
async def test_bundle_rejects_unknown_upis(db_session: AsyncSession) -> None:
    with pytest.raises(ValueError, match="not found"):
        await export_bundle(db_session, upis=["00000000000000/UNKNOWN/0001"], requested_by="bmw")


@pytest.mark.asyncio
async def test_bundle_rejects_empty_input(db_session: AsyncSession) -> None:
    with pytest.raises(ValueError, match="at least one"):
        await export_bundle(db_session, upis=[], requested_by="bmw")
