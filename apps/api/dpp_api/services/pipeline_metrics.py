"""Pipeline KPIs + recent activity for the operator cockpit.

Heavy reads happen against `cast_events` and `dpp_records`. Both tables are
tenant-scoped by RLS; this service does NOT add a tenant filter to the SQL —
the GUC-bound session enforces it.

The metrics here are intentionally simple aggregates over short windows so the
cockpit can refresh on a 5–10s cadence without hammering the DB. Anything more
expensive (per-stage p95, queue lag) belongs in a metrics pipeline.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CastEvent, DppRecord


@dataclass(frozen=True)
class PipelineMetrics:
    issued_24h: int
    issued_today: int
    issued_per_minute: float
    success_rate_pct: float
    avg_cfp_24h: float | None
    error_count_24h: int
    p50_latency_seconds: float | None
    p95_latency_seconds: float | None
    queue_depth: int
    by_brand_24h: list[dict[str, Any]]
    by_status_24h: list[dict[str, Any]]
    sparkline_15min: list[int]


async def compute_metrics(session: AsyncSession) -> PipelineMetrics:
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    window_24h = now - timedelta(hours=24)
    window_60min = now - timedelta(minutes=60)

    # ── Cast events in the last 24h, grouped by status ────────────────────
    rows = (
        await session.execute(
            select(CastEvent.status, func.count())
            .where(CastEvent.received_at >= window_24h)
            .group_by(CastEvent.status)
        )
    ).all()
    by_status_24h = [{"status": s, "count": int(c)} for s, c in rows]
    total_24h = sum(item["count"] for item in by_status_24h)
    error_count_24h = sum(item["count"] for item in by_status_24h if item["status"] == "failed")
    success_rate = ((total_24h - error_count_24h) / total_24h * 100) if total_24h else 100.0

    # ── DPPs issued in 24h, today, per-minute, by brand ───────────────────
    issued_24h = (
        await session.scalar(
            select(func.count())
            .select_from(DppRecord)
            .where(and_(DppRecord.issued_at >= window_24h, DppRecord.state == "published"))
        )
    ) or 0
    issued_today = (
        await session.scalar(
            select(func.count())
            .select_from(DppRecord)
            .where(and_(DppRecord.issued_at >= today_start, DppRecord.state == "published"))
        )
    ) or 0
    issued_60min = (
        await session.scalar(
            select(func.count())
            .select_from(DppRecord)
            .where(and_(DppRecord.issued_at >= window_60min, DppRecord.state == "published"))
        )
    ) or 0
    issued_per_minute = round(issued_60min / 60, 2)

    avg_cfp_24h = await session.scalar(
        select(func.avg(DppRecord.cfp_kg_co2e_per_tonne)).where(DppRecord.issued_at >= window_24h)
    )

    by_brand_rows = (
        await session.execute(
            select(DppRecord.brand, func.count())
            .where(DppRecord.issued_at >= window_24h)
            .group_by(DppRecord.brand)
        )
    ).all()
    by_brand_24h = [{"brand": b, "count": int(c)} for b, c in by_brand_rows]

    # ── Latency: cast received → DPP issued ────────────────────────────────
    latencies_rows = (
        await session.execute(
            select(
                func.extract(
                    "epoch",
                    DppRecord.issued_at - CastEvent.received_at,
                )
            )
            .select_from(DppRecord)
            .join(CastEvent, CastEvent.id == DppRecord.cast_event_id)
            .where(DppRecord.issued_at >= window_24h)
        )
    ).all()
    latencies = sorted(float(r[0]) for r in latencies_rows if r[0] is not None)
    p50 = _percentile(latencies, 0.50)
    p95 = _percentile(latencies, 0.95)

    # ── Queue depth: cast events in flight ─────────────────────────────────
    queue_depth = (
        await session.scalar(
            select(func.count())
            .select_from(CastEvent)
            .where(CastEvent.status.in_(("received", "validated", "generated", "signed")))
        )
    ) or 0

    # ── Sparkline: last 15 minutes, one bucket per minute ──────────────────
    spark_rows = (
        await session.execute(
            select(DppRecord.issued_at).where(
                DppRecord.issued_at >= now - timedelta(minutes=15),
                DppRecord.state == "published",
            )
        )
    ).all()
    spark_minutes = 15
    buckets: Counter[int] = Counter()
    for (ts,) in spark_rows:
        if ts is None:
            continue
        delta_min = int((now - ts).total_seconds() // 60)
        if 0 <= delta_min < spark_minutes:
            buckets[spark_minutes - 1 - delta_min] += 1
    sparkline_15min = [buckets.get(i, 0) for i in range(spark_minutes)]

    return PipelineMetrics(
        issued_24h=int(issued_24h),
        issued_today=int(issued_today),
        issued_per_minute=issued_per_minute,
        success_rate_pct=round(success_rate, 2),
        avg_cfp_24h=float(avg_cfp_24h) if avg_cfp_24h is not None else None,
        error_count_24h=int(error_count_24h),
        p50_latency_seconds=p50,
        p95_latency_seconds=p95,
        queue_depth=int(queue_depth),
        by_brand_24h=by_brand_24h,
        by_status_24h=by_status_24h,
        sparkline_15min=sparkline_15min,
    )


def _percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    if len(values) == 1:
        return round(values[0], 3)
    k = (len(values) - 1) * p
    f = int(k)
    c = min(f + 1, len(values) - 1)
    if f == c:
        return round(values[f], 3)
    return round(values[f] + (values[c] - values[f]) * (k - f), 3)


@dataclass(frozen=True)
class RecentEvent:
    cast_event_id: int
    tracking_id: str
    cast_number: str | None
    brand: str | None
    alloy: str | None
    weight_kg: float | None
    received_at: str
    status: str
    upi: str | None
    cfp_kg_co2e_per_tonne: float | None
    issued_at: str | None
    error: str | None
    pipeline_seconds: float | None


async def issuance_timeseries(session: AsyncSession, *, days: int = 30) -> list[dict[str, Any]]:
    """Daily issuance + CFP average + recycled-content average for the last N days.

    Used by the executive overview to render trend charts. Days with no
    issuance return zero counts (we backfill server-side so the client gets
    a contiguous series).
    """
    now = datetime.now(UTC)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (
        await session.execute(
            select(
                func.date_trunc("day", DppRecord.issued_at).label("day"),
                func.count().label("dpp_count"),
                func.avg(DppRecord.cfp_kg_co2e_per_tonne).label("avg_cfp"),
                func.avg(DppRecord.recycled_content_pct).label("avg_recycled"),
            )
            .where(
                and_(
                    DppRecord.issued_at >= start,
                    DppRecord.state == "published",
                )
            )
            .group_by("day")
            .order_by("day")
        )
    ).all()

    by_day: dict[str, dict[str, Any]] = {}
    for r in rows:
        key = r.day.date().isoformat() if r.day else None
        if key is None:
            continue
        by_day[key] = {
            "date": key,
            "count": int(r.dpp_count),
            "avgCfp": float(r.avg_cfp) if r.avg_cfp is not None else None,
            "avgRecycled": float(r.avg_recycled) if r.avg_recycled is not None else None,
        }

    out: list[dict[str, Any]] = []
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        out.append(by_day.get(d, {"date": d, "count": 0, "avgCfp": None, "avgRecycled": None}))
    return out


async def list_recent_events(session: AsyncSession, *, limit: int = 50) -> list[dict[str, Any]]:
    """Recent cast events with their pipeline outcome.

    Joins cast_events ⟶ dpp_records (LEFT) so we can show in-flight events
    that haven't produced a DPP yet (validation failure, plausibility reject,
    or simply mid-pipeline).
    """
    stmt = (
        select(
            CastEvent.id,
            CastEvent.tracking_id,
            CastEvent.received_at,
            CastEvent.status,
            CastEvent.error,
            CastEvent.payload,
            DppRecord.upi,
            DppRecord.brand,
            DppRecord.alloy,
            DppRecord.weight_kg,
            DppRecord.cfp_kg_co2e_per_tonne,
            DppRecord.issued_at,
        )
        .select_from(CastEvent)
        .outerjoin(DppRecord, DppRecord.cast_event_id == CastEvent.id)
        .order_by(CastEvent.received_at.desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    out: list[dict[str, Any]] = []
    for r in rows:
        cast = r.payload.get("cast", {}) if isinstance(r.payload, dict) else {}
        pipeline_seconds = (
            (r.issued_at - r.received_at).total_seconds() if r.issued_at is not None else None
        )
        out.append(
            {
                "castEventId": int(r.id),
                "trackingId": r.tracking_id,
                "castNumber": cast.get("castNumber"),
                "brand": r.brand or cast.get("brand"),
                "alloy": r.alloy or cast.get("alloyEn"),
                "weightKg": float(r.weight_kg) if r.weight_kg is not None else cast.get("weightKg"),
                "receivedAt": r.received_at.isoformat(),
                "status": r.status,
                "upi": r.upi,
                "cfpKgCo2ePerTonne": (
                    float(r.cfp_kg_co2e_per_tonne) if r.cfp_kg_co2e_per_tonne is not None else None
                ),
                "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
                "error": r.error,
                "pipelineSeconds": (
                    round(pipeline_seconds, 3) if pipeline_seconds is not None else None
                ),
            }
        )
    return out
