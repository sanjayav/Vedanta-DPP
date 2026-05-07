"""Plausibility checks reject obviously-wrong cast events and DPP bodies."""

from __future__ import annotations

from dpp_api.services.plausibility import check_cast_event, check_dpp_body


def _cast_event(form: str = "extrusion_billet", weight: float = 1380) -> dict[str, object]:
    return {
        "cast": {
            "form": form,
            "weightKg": weight,
            "diameterMm": 228,
        }
    }


def test_valid_billet_passes() -> None:
    result = check_cast_event(_cast_event())
    assert result.ok
    assert result.severity == "ok"


def test_billet_without_diameter_rejected() -> None:
    bad = _cast_event()
    del bad["cast"]["diameterMm"]
    result = check_cast_event(bad)
    assert not result.ok
    assert any("diameter" in i for i in result.issues)


def test_weight_outside_band_rejected() -> None:
    result = check_cast_event(_cast_event(weight=50000))  # 50 t billet — implausible
    assert not result.ok
    assert any("weight" in i for i in result.issues)


def test_celestial_cfp_in_band() -> None:
    body = _dpp_body(brand="CelestiAL", cfp=4273)
    result = check_dpp_body(body)
    assert result.ok


def test_celestial_cfp_too_high_rejected() -> None:
    body = _dpp_body(brand="CelestiAL", cfp=15000)
    result = check_dpp_body(body)
    assert not result.ok
    assert any("CFP" in i for i in result.issues)


def test_too_few_compliance_entries_rejected() -> None:
    body = _dpp_body(brand="CelestiAL", cfp=4273)
    body["compliance"]["regulations"] = [body["compliance"]["regulations"][0]]
    result = check_dpp_body(body)
    assert not result.ok
    assert any("regulations" in i for i in result.issues)


def test_recycled_content_out_of_range_rejected() -> None:
    body = _dpp_body(brand="CelestiAL", cfp=4273)
    body["recycledContent"]["totalPercent"] = 150
    result = check_dpp_body(body)
    assert not result.ok


def _dpp_body(*, brand: str, cfp: float) -> dict[str, object]:
    return {
        "identification": {"brand": brand},
        "carbon": {
            "valueKgCo2ePerTonne": cfp,
            "verifier": {"did": "did:web:dnv.com:cfp"},
        },
        "recycledContent": {"totalPercent": 0},
        "compliance": {
            "regulations": [{"name": n} for n in ("REACH", "RoHS", "TSCA", "Conflict", "PFAS")],
            "certifications": [{"name": n} for n in ("ASI", "CoC", "9001", "14001", "45001")],
        },
    }
