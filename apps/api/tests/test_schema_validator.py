"""Schema validator should reject malformed cast events and accept valid ones."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from dpp_api.services.schema_validator import is_valid, validate_against


def _valid_event() -> dict[str, object]:
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
            "castNumber": "C-2026-04-12345",
            "alloyEn": "EN AW-6063",
            "alloyAa": "AA 6063",
            "brand": "CelestiAL",
            "form": "extrusion_billet",
            "temper": "T6",
            "weightKg": 1380,
            "diameterMm": 228,
            "lengthMm": 7000,
            "casthouseUfi": "0814406063812",
            "smelterUfi": "0814406063800",
            "purityGrade": "P1020A",
        },
    }


def test_valid_cast_event_passes() -> None:
    validate_against("cast-event/v1.0.0", _valid_event())


def test_missing_required_fields_fail() -> None:
    bad = _valid_event()
    del bad["trackingId"]
    with pytest.raises(ValueError, match="trackingId"):
        validate_against("cast-event/v1.0.0", bad)


def test_invalid_alloy_pattern_fails() -> None:
    bad = _valid_event()
    bad["cast"]["alloyEn"] = "6063"  # missing the EN AW- prefix
    assert not is_valid("cast-event/v1.0.0", bad)


def test_invalid_brand_fails() -> None:
    bad = _valid_event()
    bad["cast"]["brand"] = "PlatinumPro"
    assert not is_valid("cast-event/v1.0.0", bad)


def test_negative_weight_fails() -> None:
    bad = _valid_event()
    bad["cast"]["weightKg"] = -1
    assert not is_valid("cast-event/v1.0.0", bad)
