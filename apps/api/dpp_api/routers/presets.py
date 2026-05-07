"""Simulator presets — read-only catalogue of HZL-anchored seed values.

Backs the Operator Console's Sources → Simulator tab (SDD §5.1.5) and the
workshop-mode configurator. Presets ship with the platform; customisation
happens via the manual entry wizard (different endpoint).

Each preset matches a Chem-X v1.0 aligned JSON file in
`packages/schema/presets/` (zinc-ecozen, zinc-cgg-jumbo, lead-pure-99-99).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status

from ..services.presets import PRESETS, get_preset

router = APIRouter(prefix="/presets", tags=["presets"])


def _summarise(p: dict[str, Any]) -> dict[str, Any]:
    """Build a compact preset summary using the new HZL preset shape."""
    sustain = p.get("sustainability") or {}
    pcf = sustain.get("pcf") or {}
    industry_avg = pcf.get("industryAverage") or {}
    recycled = p.get("recycledContent") or {}
    return {
        "id": p.get("id"),
        "label": p.get("label"),
        "summary": p.get("summary"),
        "metal": p.get("metal"),
        "tradeName": p.get("tradeName"),
        "gradeCode": p.get("gradeCode"),
        "form": p.get("form"),
        "carbon": {
            "valueKgCo2ePerKg": pcf.get("value"),
            "industryAverageKgCo2ePerKg": industry_avg.get("value"),
            "unit": pcf.get("unit", "kg CO2e/kg"),
        },
        "recycledContent": {"totalPercent": recycled.get("totalPercent")},
    }


@router.get("/")
async def list_presets() -> dict[str, object]:
    """Return all presets in summary form."""
    return {"items": [_summarise(p) for p in PRESETS.values()]}


@router.get("/{preset_id}")
async def show_preset(preset_id: str) -> dict[str, object]:
    """Return the full preset payload."""
    preset = get_preset(preset_id)
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="preset not found")
    return preset
