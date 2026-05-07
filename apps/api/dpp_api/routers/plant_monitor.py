"""Plant Monitor router — operational health snapshot + per-signal detail.

Read scope: tenant_auditor or above. The catalogue lives in
`services.plant_signals` and is the single source of truth for every signal,
including its data-source provenance.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import Principal, require_tenant_auditor
from ..db import get_tenant_session
from ..services.plant_signals import (
    Provenance,
    SignalReading,
    compute_plant_status,
    compute_signal_detail,
    recycled_content_recent_batches,
)

router = APIRouter(prefix="/plant-monitor", tags=["plant-monitor"])


def _serialize_provenance(p: Provenance) -> dict[str, Any]:
    return {
        "sourceKind": p.source_kind,
        "sourceLabel": p.source_label,
        "frequencySeconds": p.frequency_seconds,
        "latencySecondsP50": p.latency_seconds_p50,
        "dataQuality": p.data_quality,
        "realData": p.real_data,
        "pipeline": [
            {"name": stop.name, "kind": stop.kind, "note": stop.note} for stop in p.pipeline
        ],
    }


def _serialize_reading(s: SignalReading) -> dict[str, Any]:
    return {
        "key": s.key,
        "group": s.group,
        "label": s.label,
        "unit": s.unit,
        "value": s.value,
        "targetMin": s.target_min,
        "targetMax": s.target_max,
        "status": s.status,
        "trend": s.trend,
        "regulatoryAnchor": s.regulatory_anchor,
        "description": s.description,
        "ownerStep": s.owner_step,
        "isSynthetic": s.is_synthetic,
        "provenance": _serialize_provenance(s.provenance),
    }


@router.get("/status")
async def status_endpoint(
    principal: Principal = Depends(require_tenant_auditor),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    snap = await compute_plant_status(session, tenant_id=principal.tenant_id)
    return {
        "generatedAt": snap.generated_at.isoformat(),
        "plantName": snap.plant_name,
        "lineCount": snap.line_count,
        "groups": [
            {
                "key": g.group,
                "label": g.label,
                "ok": g.ok,
                "warn": g.warn,
                "breach": g.breach,
                "noData": g.no_data,
                "total": g.total,
            }
            for g in snap.groups
        ],
        "breaches": [
            {
                "key": s.key,
                "label": s.label,
                "value": s.value,
                "unit": s.unit,
                "targetMin": s.target_min,
                "targetMax": s.target_max,
                "regulatoryAnchor": s.regulatory_anchor,
            }
            for s in snap.breaches
        ],
        "signals": [_serialize_reading(s) for s in snap.signals],
    }


@router.get("/signal/{signal_key:path}")
async def signal_detail_endpoint(
    signal_key: str,
    range_key: str = Query("24h", alias="range", description="24h | 7d | 30d"),
    principal: Principal = Depends(require_tenant_auditor),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    detail = await compute_signal_detail(
        session,
        tenant_id=principal.tenant_id,
        signal_key=signal_key,
        range_key=range_key,
    )
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="signal not found")
    payload: dict[str, Any] = {
        "reading": _serialize_reading(detail.reading),
        "rangeLabel": detail.range_label,
        "rangeKey": range_key,
        "series": [{"ts": p.ts.isoformat(), "value": p.value} for p in detail.series],
        "stats": detail.stats,
        "breachEvents": detail.breach_events,
    }
    # Recycled-content gets a bonus per-batch breakdown so the operator can see
    # which DPPs contributed to the rolling number.
    if signal_key == "circularity.recycled_content_pct":
        payload["recentBatches"] = await recycled_content_recent_batches(
            session, tenant_id=principal.tenant_id, limit=20
        )
    return payload
