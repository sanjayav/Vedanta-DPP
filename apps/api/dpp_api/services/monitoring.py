"""Attribute monitoring — operational health of every mandatory manifest attribute.

The Console's monitoring surface ("Attribute Monitor") asks one question:
  "For every mandatory dynamic attribute the platform must capture, what's the
   freshest value we've issued, and is the data source still alive?"

We aggregate:
  · DPP-level: scan every published `dpp_records.body` for a non-null value at
    the attribute's JSONPath.
  · Source-level: surface every `data_sources` row attached to the same step.
  · Health: roll the freshness into fresh / stale / breach / missing buckets.

Read-only. The numbers don't mutate state — the only side effect this can
have is opening someone's eyes.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DataSource, DppManifestAttr, DppRecord, ProcessStep, ProductProcessChain

# Status thresholds (hours since the most recent DPP that included this attr).
FRESH_HOURS = 24
STALE_HOURS = 72


@dataclass
class AttributeSourceView:
    id: int
    connector_kind: str | None
    supplier_name: str | None
    permission_state: str
    last_sync_at: datetime | None
    last_sync_status: str | None


@dataclass
class AttributeMonitorRow:
    attribute_id: int
    attribute_path: str
    label: str
    description: str | None
    regulatory_anchor: str | None
    dpp_version: str
    necessity: str
    step_id: int
    step_slug: str
    step_name: str
    step_tier: str
    dpp_count: int
    last_seen_at: datetime | None
    last_value: Any
    last_upi: str | None
    status: str  # fresh | stale | breach | missing
    sources: list[AttributeSourceView] = field(default_factory=list)


@dataclass
class AttributeMonitorTotals:
    mandatory: int
    fresh: int
    stale: int
    breach: int
    missing: int
    sources_total: int
    sources_healthy: int


@dataclass
class AttributeMonitorReport:
    generated_at: datetime
    totals: AttributeMonitorTotals
    items: list[AttributeMonitorRow]


def _classify(last_seen: datetime | None, now: datetime) -> str:
    if last_seen is None:
        return "missing"
    age = now - last_seen
    if age <= timedelta(hours=FRESH_HOURS):
        return "fresh"
    if age <= timedelta(hours=STALE_HOURS):
        return "stale"
    return "breach"


def _json_path_array(attribute_path: str) -> list[str]:
    """Convert a manifest dotted path into the array Postgres `#>` expects.

    `carbon.decomposition.aluminaProduction` → ['carbon', 'decomposition', 'aluminaProduction']
    """
    return [seg for seg in attribute_path.split(".") if seg]


async def attribute_monitor_report(
    session: AsyncSession,
    *,
    tenant_id: int,
    dpp_version: str = "1.0",
    necessity: str | None = "mandatory",
) -> AttributeMonitorReport:
    """Build the monitoring rollup for a tenant.

    Filters to the supplied `necessity` (default: mandatory only) and the
    target `dpp_version`. We do not currently merge across versions because
    the Console scopes monitoring to whatever version the locked configs
    target — typically v1.0 in production today.
    """
    now = datetime.now(UTC)

    # Manifest attrs joined with their owning step.
    stmt = (
        select(
            DppManifestAttr.id,
            DppManifestAttr.attribute_path,
            DppManifestAttr.label,
            DppManifestAttr.description,
            DppManifestAttr.regulatory_anchor,
            DppManifestAttr.dpp_version,
            DppManifestAttr.necessity,
            ProcessStep.id.label("step_id"),
            ProcessStep.slug.label("step_slug"),
            ProcessStep.name.label("step_name"),
            ProcessStep.tier.label("step_tier"),
        )
        .join(ProcessStep, ProcessStep.id == DppManifestAttr.process_step_id)
        .where(DppManifestAttr.dpp_version == dpp_version)
        .order_by(ProcessStep.ordinal, DppManifestAttr.attribute_path)
    )
    if necessity is not None:
        stmt = stmt.where(DppManifestAttr.necessity == necessity)
    manifest_rows = (await session.execute(stmt)).all()

    # Data sources per step, scoped to this tenant via Product membership.
    # The data_sources table is tenant-scoped; the join keeps us honest under RLS.
    sources_by_step: dict[int, list[AttributeSourceView]] = defaultdict(list)
    src_rows = (
        (await session.execute(select(DataSource).where(DataSource.tenant_id == tenant_id)))
        .scalars()
        .all()
    )
    for s in src_rows:
        sources_by_step[s.process_step_id].append(
            AttributeSourceView(
                id=s.id,
                connector_kind=s.connector_kind,
                supplier_name=s.supplier_name,
                permission_state=s.permission_state,
                last_sync_at=s.last_sync_at,
                last_sync_status=s.last_sync_status,
            )
        )

    # Pre-fetch the product chains so we can hop step_id → product_id reliably,
    # in case the same step is shared across multiple products. Not used in the
    # rollup directly today but useful for future per-product breakdowns.
    _ = (
        await session.execute(
            select(ProductProcessChain.product_id, ProductProcessChain.process_step_id)
        )
    ).all()

    items: list[AttributeMonitorRow] = []
    for r in manifest_rows:
        path_array = _json_path_array(r.attribute_path)
        # Aggregate over published DPPs in the tenant. We use a parameterised
        # JSONB `#>` lookup; the WHERE filters out null values so the dpp_count
        # only counts DPPs that actually carry this attribute.
        agg = (
            await session.execute(
                select(
                    func.count().label("dpp_count"),
                    func.max(DppRecord.issued_at).label("last_seen_at"),
                ).where(
                    DppRecord.tenant_id == tenant_id,
                    DppRecord.state == "published",
                    text("body #> :path IS NOT NULL").bindparams(path=path_array),
                )
            )
        ).one()
        last_value: Any = None
        last_upi: str | None = None
        if agg.dpp_count and agg.dpp_count > 0:
            latest = (
                await session.execute(
                    select(DppRecord.upi, text("body #> :path AS value"))
                    .where(
                        DppRecord.tenant_id == tenant_id,
                        DppRecord.state == "published",
                        text("body #> :path IS NOT NULL"),
                    )
                    .order_by(DppRecord.issued_at.desc())
                    .limit(1)
                    .params(path=path_array)
                )
            ).first()
            if latest is not None:
                last_upi = latest[0]
                last_value = latest[1]

        status = _classify(agg.last_seen_at, now)
        items.append(
            AttributeMonitorRow(
                attribute_id=r.id,
                attribute_path=r.attribute_path,
                label=r.label,
                description=r.description,
                regulatory_anchor=r.regulatory_anchor,
                dpp_version=r.dpp_version,
                necessity=r.necessity,
                step_id=r.step_id,
                step_slug=r.step_slug,
                step_name=r.step_name,
                step_tier=r.step_tier,
                dpp_count=int(agg.dpp_count or 0),
                last_seen_at=agg.last_seen_at,
                last_value=last_value,
                last_upi=last_upi,
                status=status,
                sources=sources_by_step.get(r.step_id, []),
            )
        )

    sources_total = sum(len(v) for v in sources_by_step.values())
    sources_healthy = sum(
        1
        for vlist in sources_by_step.values()
        for s in vlist
        if s.permission_state == "granted" and s.last_sync_status == "success"
    )
    totals = AttributeMonitorTotals(
        mandatory=len(items),
        fresh=sum(1 for i in items if i.status == "fresh"),
        stale=sum(1 for i in items if i.status == "stale"),
        breach=sum(1 for i in items if i.status == "breach"),
        missing=sum(1 for i in items if i.status == "missing"),
        sources_total=sources_total,
        sources_healthy=sources_healthy,
    )
    return AttributeMonitorReport(generated_at=now, totals=totals, items=items)
