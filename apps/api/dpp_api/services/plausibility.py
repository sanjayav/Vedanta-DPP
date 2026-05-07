"""Plausibility checks (SDD §8.5 Definition of Done item 25).

Catches the obviously-wrong cast events before they become signed DPPs.
Two failure modes: hard rejection (raise) or soft warning (return).

Bounds are conservative — derived from HZL's published 2024 PCF data, the
IZA global SHG zinc benchmark and the ILA refined-lead benchmark. They tighten
as v1.5 introduces site-specific data.

CFP bounds are expressed in **kg CO2e per tonne** (the legacy persisted unit
on `dpp_records.cfp_kg_co2e_per_tonne`); preset PCFs use kg CO2e/kg per
Chem-X v1.0, so the generator multiplies by 1000 before persistence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class PlausibilityResult:
    ok: bool
    severity: str = "ok"  # ok | warn | reject
    issues: list[str] = field(default_factory=list)


# DoD §8.5: every DPP must list ≥5 regulations and ≥5 certifications.
MIN_COMPLIANCE_ENTRIES = 5
MAX_PERCENT = 100

# Conservative cradle-to-gate PCF bounds per IZA / ILA + HZL verified data
# (kg CO2e/t). EcoZen lower bound assumes Serentica RE PDA fully consumed;
# upper bound for refined lead reflects the pyro Pb-Zn route.
_CFP_BANDS: dict[str, tuple[float, float]] = {
    "EcoZen": (500.0, 1500.0),
    "CGG": (2500.0, 4500.0),
    "CGG Jumbo": (2500.0, 4500.0),
    "Vedanta 99.99": (1000.0, 2500.0),
}

# Weight bounds per cast form (kg). These are absolute extremes; production
# casts cluster near the centre. Anything outside the band is almost certainly
# a unit mistake.
_WEIGHT_BANDS: dict[str, tuple[float, float]] = {
    "ingot_25kg": (20.0, 30.0),
    "jumbo_1t": (900.0, 1100.0),
    "block_2t": (1800.0, 2200.0),
    "slab_500kg": (450.0, 550.0),
    "anode": (200.0, 1500.0),
}


def check_cast_event(cast_event: dict[str, Any]) -> PlausibilityResult:
    """Validate a canonical cast event before generator runs."""
    issues: list[str] = []
    cast = cast_event.get("cast", {})
    severity = "ok"

    weight = cast.get("weightKg")
    form = cast.get("form")
    if weight is not None and form in _WEIGHT_BANDS:
        lo, hi = _WEIGHT_BANDS[form]
        if not (lo <= weight <= hi):
            issues.append(
                f"weight {weight}kg outside expected band [{lo}, {hi}]kg for form '{form}'"
            )
            severity = "reject"

    # Dimensions sanity — a 25 kg ingot must declare length+width+height,
    # a jumbo block must declare length+width.
    if form == "ingot_25kg":
        for key in ("lengthMm", "widthMm"):
            if not cast.get(key):
                issues.append(f"ingot_25kg must declare {key}")
                severity = "reject"
    if form == "jumbo_1t":
        for key in ("lengthMm", "widthMm"):
            if not cast.get(key):
                issues.append(f"jumbo_1t must declare {key}")
                severity = "reject"

    return PlausibilityResult(ok=severity != "reject", severity=severity, issues=issues)


def check_dpp_body(body: dict[str, Any]) -> PlausibilityResult:
    """Validate a fully-generated DPP body before signing."""
    issues: list[str] = []
    severity = "ok"

    brand = body.get("identification", {}).get("brand")
    cfp = body.get("carbon", {}).get("valueKgCo2ePerTonne")
    if brand and cfp is not None and brand in _CFP_BANDS:
        lo, hi = _CFP_BANDS[brand]
        if not (lo <= cfp <= hi):
            issues.append(
                f"CFP {cfp} kg CO₂e/t outside expected band [{lo}, {hi}] for brand '{brand}'"
            )
            severity = "reject"

    # Compliance must contain the DoD-mandated minimums.
    compliance = body.get("compliance", {})
    regs = compliance.get("regulations", [])
    certs = compliance.get("certifications", [])
    if len(regs) < MIN_COMPLIANCE_ENTRIES:
        issues.append(
            f"compliance.regulations has {len(regs)} entries; "
            f"minimum {MIN_COMPLIANCE_ENTRIES} required"
        )
        severity = "reject"
    if len(certs) < MIN_COMPLIANCE_ENTRIES:
        issues.append(
            f"compliance.certifications has {len(certs)} entries; "
            f"minimum {MIN_COMPLIANCE_ENTRIES} required"
        )
        severity = "reject"

    # Carbon must reference a verifier with a non-empty DID.
    verifier = body.get("carbon", {}).get("verifier", {})
    if not verifier.get("did"):
        issues.append("carbon.verifier.did is empty — every DPP requires a CFP verifier")
        severity = "reject"

    # Recycled-content total must be 0–100.
    reco = body.get("recycledContent", {}).get("totalPercent")
    if reco is not None and not (0 <= reco <= MAX_PERCENT):
        issues.append(f"recycledContent.totalPercent {reco} outside 0–{MAX_PERCENT}")
        severity = "reject"

    return PlausibilityResult(ok=severity != "reject", severity=severity, issues=issues)


class PlausibilityRejection(ValueError):  # noqa: N818
    """Raised when a cast event or DPP body fails hard-reject plausibility checks."""

    def __init__(self, result: PlausibilityResult) -> None:
        super().__init__(f"Plausibility rejection: {'; '.join(result.issues)}")
        self.result = result
