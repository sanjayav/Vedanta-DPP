"""Aluminium plant-monitor catalogue.

The battery world has a Battery Management System (BMS) that watches state-of-
charge, state-of-health, cell-balance, thermals — operational signals that
*must* stay in band or the cell goes off-warranty.

Aluminium production has a parallel set of signals — different physics, same
governance posture: if any of these drift outside their target band, the DPP
the operator just issued is suspect and the regulator will eventually catch
it. This module is the single source of truth for which signals matter, what
their bands are, and — critically — *how* the platform sources each one.

Each signal carries a `Provenance` block describing the path from raw
instrument to displayed value: which sensor or system, the read frequency,
the pipeline hops, and the typical end-to-end latency. That metadata feeds
the operator-facing "How we get this" panel, so engineers can see the data
lineage without spelunking through architecture diagrams.

Reading bands cite EGA's published reports (DX+ 12.8 kWh/kg, CelestiAL solar
share, IAI v2.0 sector benchmarks) and ESPR / EU Aluminium Delegated Act
boundary thresholds where they exist.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppRecord

SignalGroup = Literal[
    "electrolysis",
    "power",
    "casthouse",
    "carbon",
    "circularity",
    "verification",
]
SignalStatus = Literal["ok", "warn", "breach", "no_data"]
SourceKind = Literal[
    "sensor",
    "mes",
    "spectrometer",
    "weighbridge",
    "ems",
    "ledger",
    "external_feed",
    "derived",
    "manual",
]


@dataclass
class PipelineStop:
    """One hop in a signal's ingest pipeline (sensor → ... → dashboard)."""

    name: str
    kind: str  # device | system | api | store | aggregator | dashboard
    note: str | None = None


@dataclass
class Provenance:
    source_kind: SourceKind
    source_label: str
    frequency_seconds: int  # how often the source emits a sample
    latency_seconds_p50: int  # typical lag from sample → dashboard
    pipeline: list[PipelineStop]
    data_quality: str | None = None
    real_data: bool = False  # True when value comes from live DB, not synthetic


@dataclass
class SignalDef:
    key: str
    group: SignalGroup
    label: str
    unit: str
    target_min: float | None
    target_max: float | None
    regulatory_anchor: str | None
    description: str
    owner_step: str | None
    provenance: Provenance


@dataclass
class SignalReading:
    key: str
    group: SignalGroup
    label: str
    unit: str
    value: float | None
    target_min: float | None
    target_max: float | None
    status: SignalStatus
    trend: list[float]  # last 12 readings, oldest → newest
    regulatory_anchor: str | None
    description: str
    owner_step: str | None
    is_synthetic: bool
    provenance: Provenance


@dataclass
class GroupRollup:
    group: SignalGroup
    label: str
    ok: int
    warn: int
    breach: int
    no_data: int
    total: int


@dataclass
class PlantStatus:
    generated_at: datetime
    plant_name: str
    line_count: int
    signals: list[SignalReading]
    groups: list[GroupRollup]
    breaches: list[SignalReading] = field(default_factory=list)


@dataclass
class SignalSeriesPoint:
    ts: datetime
    value: float


@dataclass
class SignalDetail:
    reading: SignalReading
    series: list[SignalSeriesPoint]
    range_label: str
    stats: dict[str, float]
    breach_events: list[dict[str, str | float]]


# ── Pipeline templates ──────────────────────────────────────────────────
# Reusable pipelines so signals coming from the same plant system don't
# duplicate the description.

_SCADA_PIPELINE = [
    PipelineStop(name="Pot SCADA controller", kind="device", note="1 Hz raw"),
    PipelineStop(name="Honeywell Experion MES", kind="system", note="5-min rollups"),
    PipelineStop(name="DPP Ingest API", kind="api", note="POST /signals"),
    PipelineStop(name="TimescaleDB hypertable", kind="store", note="signal_readings"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]

_EMS_PIPELINE = [
    PipelineStop(name="PPA / grid meters", kind="device", note="1-min interval"),
    PipelineStop(name="EGA Energy Management System", kind="system"),
    PipelineStop(name="DPP Ingest API", kind="api"),
    PipelineStop(name="TimescaleDB hypertable", kind="store"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]

_WEIGHBRIDGE_PIPELINE = [
    PipelineStop(name="Truck-arrival weighbridge", kind="device", note="per-truck"),
    PipelineStop(name="Scrap-yard MES", kind="system"),
    PipelineStop(name="Mass-balance allocator", kind="aggregator", note="ASI CoC ledger"),
    PipelineStop(name="DPP API", kind="api"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]

_DPP_AGGREGATE_PIPELINE = [
    PipelineStop(name="Cast-event API", kind="api", note="POST /cast-events"),
    PipelineStop(name="DPP generator + Ed25519 signer", kind="aggregator"),
    PipelineStop(name="dpp_records (Postgres)", kind="store"),
    PipelineStop(name="Rolling SQL aggregate", kind="aggregator"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]

_VERIFIER_PIPELINE = [
    PipelineStop(name="Verifier portal upload (DNV / ASI)", kind="api"),
    PipelineStop(name="reference_compliance + reference_cfp", kind="store"),
    PipelineStop(name="Validity-window scanner", kind="aggregator"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]

_SPECTROMETER_PIPELINE = [
    PipelineStop(name="OES / XRF spectrometer", kind="device", note="per-cast"),
    PipelineStop(name="Quality lab MES", kind="system"),
    PipelineStop(name="DPP Ingest API", kind="api"),
    PipelineStop(name="TimescaleDB", kind="store"),
    PipelineStop(name="Plant Monitor", kind="dashboard"),
]


# ── Signal catalogue ────────────────────────────────────────────────────

_CATALOGUE: list[SignalDef] = [
    # ── Electrolysis ─────────────────────────────────────────────────────
    SignalDef(
        key="electrolysis.dc_efficiency_pct",
        group="electrolysis",
        label="Pot DC current efficiency",
        unit="%",
        target_min=93.0,
        target_max=96.5,
        regulatory_anchor="EGA DX+ design envelope",
        description=(
            "Faraday efficiency of the Hall–Héroult cell line. Drift below 93% "
            "means spec power climbs and CFP follows."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="sensor",
            source_label="Pot bus-bar shunt sensors (660 pots × DX+ Ultra)",
            frequency_seconds=1,
            latency_seconds_p50=12,
            pipeline=_SCADA_PIPELINE,
            data_quality="Mass-balance reconciled daily against alumina input.",
        ),
    ),
    SignalDef(
        key="electrolysis.energy_intensity_kwh_per_kg",
        group="electrolysis",
        label="DC energy intensity",
        unit="kWh/kg Al",
        target_min=12.5,
        target_max=13.2,
        regulatory_anchor="EGA DX+ Ultra · 12.8 kWh/kg target",
        description=(
            "Specific DC consumption per kg molten aluminium. Tracks within ±0.4 "
            "of the 12.8 kWh/kg DX+ Ultra target."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="sensor",
            source_label="Rectifier bank energy meters · 6 pot lines",
            frequency_seconds=60,
            latency_seconds_p50=30,
            pipeline=_SCADA_PIPELINE,
        ),
    ),
    SignalDef(
        key="electrolysis.anode_effect_minutes_per_pot_day",
        group="electrolysis",
        label="Anode-effect minutes / pot-day",
        unit="min/pot·d",
        target_min=0.0,
        target_max=0.05,
        regulatory_anchor="IAI PFC Reduction Programme",
        description=(
            "Anode-effect events drive CF₄/C₂F₆ release directly. EGA target is "
            "≤0.05 min/pot-day (IAI top-decile)."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="sensor",
            source_label="Pot voltage spike detector (≥8V threshold)",
            frequency_seconds=1,
            latency_seconds_p50=8,
            pipeline=_SCADA_PIPELINE,
            data_quality="Reconciled with FTIR PFC measurements monthly.",
        ),
    ),
    SignalDef(
        key="electrolysis.pfc_emission_g_per_t",
        group="electrolysis",
        label="PFC emissions",
        unit="g CO₂e/t Al",
        target_min=None,
        target_max=110.0,
        regulatory_anchor="EU CBAM · perfluorocarbon factor",
        description=(
            "PFC contribution to embodied CFP. CBAM declaration treats this as "
            "a non-substitutable line item."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="derived",
            source_label="Anode-effect rate × IPCC tier-3 emission factor",
            frequency_seconds=300,
            latency_seconds_p50=300,
            pipeline=[
                PipelineStop(name="Anode-effect signal", kind="aggregator"),
                PipelineStop(name="IPCC factor library", kind="store"),
                PipelineStop(name="PFC calculator", kind="aggregator"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
        ),
    ),
    SignalDef(
        key="electrolysis.bath_ratio",
        group="electrolysis",
        label="Bath ratio (NaF/AlF₃)",
        unit="ratio",
        target_min=1.10,
        target_max=1.18,
        regulatory_anchor="DX+ operating window",
        description=(
            "Cryolite chemistry. Outside band → liquidus shift, alumina-feed inefficiency."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="spectrometer",
            source_label="Bath-sample XRD analyser",
            frequency_seconds=4 * 3600,
            latency_seconds_p50=2 * 3600,
            pipeline=_SPECTROMETER_PIPELINE,
            data_quality="Sampled per shift (4 samples/24h per pot line).",
        ),
    ),
    # ── Power ────────────────────────────────────────────────────────────
    SignalDef(
        key="power.renewable_share_pct",
        group="power",
        label="Renewable electricity share",
        unit="%",
        target_min=90.0,
        target_max=100.0,
        regulatory_anchor="CelestiAL claim · ISO 14067",
        description=(
            "Solar share consumed at the smelter. Underpins CelestiAL's "
            "<4 t CO₂e/t Al headline number."
        ),
        owner_step="power_generation",
        provenance=Provenance(
            source_kind="ems",
            source_label="Mohammed bin Rashid Solar Park PPA meters",
            frequency_seconds=60,
            latency_seconds_p50=120,
            pipeline=_EMS_PIPELINE,
            data_quality="Reconciled hourly with DEWA grid imports.",
        ),
    ),
    SignalDef(
        key="power.hourly_matched_pct",
        group="power",
        label="Hourly-matched solar coverage",
        unit="%",
        target_min=70.0,
        target_max=100.0,
        regulatory_anchor="EU Delegated Act (Hydrogen) · §3 anal.",
        description=(
            "Share of consumption matched within the same hour. Stricter than "
            "annual matching; aligns with forthcoming EU green-electricity rules."
        ),
        owner_step="power_generation",
        provenance=Provenance(
            source_kind="derived",
            source_label="Hourly-matching engine over PPA + smelter draw",
            frequency_seconds=3600,
            latency_seconds_p50=180,
            pipeline=[
                PipelineStop(name="Solar generation feed", kind="device"),
                PipelineStop(name="Smelter draw feed", kind="device"),
                PipelineStop(name="Hourly-matching engine", kind="aggregator"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
        ),
    ),
    SignalDef(
        key="power.grid_co2_intensity_g_per_kwh",
        group="power",
        label="Grid CO₂ intensity",
        unit="g CO₂e/kWh",
        target_min=None,
        target_max=80.0,
        regulatory_anchor="IEA grid factors",
        description=("Average intensity of imported grid electricity when solar is unavailable."),
        owner_step="power_generation",
        provenance=Provenance(
            source_kind="external_feed",
            source_label="DEWA hourly grid mix · electricityMaps API",
            frequency_seconds=3600,
            latency_seconds_p50=900,
            pipeline=[
                PipelineStop(name="electricityMaps webhook", kind="api"),
                PipelineStop(name="DPP Ingest API", kind="api"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
        ),
    ),
    SignalDef(
        key="power.ppa_days_remaining",
        group="power",
        label="PPA contract runway",
        unit="days",
        target_min=180.0,
        target_max=None,
        regulatory_anchor="Internal supply assurance",
        description=(
            "Days remaining on the active solar PPA. Renewals must close "
            ">180 days before expiry to keep the renewable claim audit-clean."
        ),
        owner_step="power_generation",
        provenance=Provenance(
            source_kind="manual",
            source_label="Procurement contract metadata",
            frequency_seconds=86400,
            latency_seconds_p50=86400,
            pipeline=[
                PipelineStop(name="Procurement system", kind="system"),
                PipelineStop(name="reference_contracts (manual)", kind="store"),
                PipelineStop(name="Validity scanner", kind="aggregator"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
        ),
    ),
    # ── Casthouse ────────────────────────────────────────────────────────
    SignalDef(
        key="casthouse.cast_yield_pct",
        group="casthouse",
        label="Cast yield",
        unit="%",
        target_min=96.0,
        target_max=99.5,
        regulatory_anchor="Internal · scrap budget",
        description=(
            "Mass of saleable product / mass of melt. Below 96% → recirculating "
            "scrap loops, cost & CFP drift."
        ),
        owner_step="casthouse",
        provenance=Provenance(
            source_kind="mes",
            source_label="Casthouse weigh-in/weigh-out station",
            frequency_seconds=3600,
            latency_seconds_p50=120,
            pipeline=_WEIGHBRIDGE_PIPELINE,
        ),
    ),
    SignalDef(
        key="casthouse.alloy_composition_deviation_ppm",
        group="casthouse",
        label="Alloy composition deviation",
        unit="ppm",
        target_min=None,
        target_max=300.0,
        regulatory_anchor="EN 573-3 spec window",
        description=(
            "Max element deviation from grade nominal. Beyond 300 ppm → re-grade or re-melt."
        ),
        owner_step="casthouse",
        provenance=Provenance(
            source_kind="spectrometer",
            source_label="Inline OES spectrometer · per-cast pour sample",
            frequency_seconds=900,
            latency_seconds_p50=60,
            pipeline=_SPECTROMETER_PIPELINE,
            data_quality="Cross-checked with shift QC lab samples.",
        ),
    ),
    SignalDef(
        key="casthouse.casting_temperature_c",
        group="casthouse",
        label="Casting temperature",
        unit="°C",
        target_min=680.0,
        target_max=720.0,
        regulatory_anchor="DC casting envelope",
        description=("Mould-side metal temperature. Outside band → grain-structure defects."),
        owner_step="casthouse",
        provenance=Provenance(
            source_kind="sensor",
            source_label="Mould thermocouples · 4 per casting line",
            frequency_seconds=1,
            latency_seconds_p50=10,
            pipeline=_SCADA_PIPELINE,
        ),
    ),
    SignalDef(
        key="casthouse.quality_pass_rate_pct",
        group="casthouse",
        label="QC pass rate (rolling 24h)",
        unit="%",
        target_min=98.0,
        target_max=100.0,
        regulatory_anchor="Internal · ISO 9001 KPI",
        description=(
            "Cast events that cleared incoming QC on first pass. Tracks alloy + "
            "cast quality together."
        ),
        owner_step="quality_lab",
        provenance=Provenance(
            source_kind="mes",
            source_label="QC inspection station results",
            frequency_seconds=3600,
            latency_seconds_p50=180,
            pipeline=_DPP_AGGREGATE_PIPELINE,
        ),
    ),
    # ── Carbon ───────────────────────────────────────────────────────────
    SignalDef(
        key="carbon.cfp_rolling_kg_per_t",
        group="carbon",
        label="Cradle-to-gate CFP (rolling 24h)",
        unit="kg CO₂e/t Al",
        target_min=None,
        target_max=7000.0,
        regulatory_anchor="ISO 14067 · DNV verified",
        description=(
            "Cradle-to-gate carbon footprint averaged over the last 24h of "
            "issuance. CelestiAL anchor is ~3-4 t/t; standard product up to "
            "~13 t/t."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="derived",
            source_label="Per-DPP CFP × 24h rolling average",
            frequency_seconds=300,
            latency_seconds_p50=60,
            pipeline=_DPP_AGGREGATE_PIPELINE,
            real_data=True,
        ),
    ),
    SignalDef(
        key="carbon.industry_avg_delta_pct",
        group="carbon",
        label="Δ vs IAI sector average",
        unit="%",
        target_min=None,
        target_max=-50.0,
        regulatory_anchor="IAI v2.0 global benchmark",
        description=(
            "How much lower this batch is vs. IAI sector primary average "
            "(14.6 t/t). More negative is better."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="derived",
            source_label="(rolling CFP − 14.6 t) / 14.6 t",
            frequency_seconds=300,
            latency_seconds_p50=60,
            pipeline=[
                PipelineStop(name="Rolling CFP signal", kind="aggregator"),
                PipelineStop(name="IAI benchmark constant", kind="store"),
                PipelineStop(name="Delta calculator", kind="aggregator"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
            real_data=True,
        ),
    ),
    SignalDef(
        key="carbon.scope1_share_pct",
        group="carbon",
        label="Scope 1 share of CFP",
        unit="%",
        target_min=None,
        target_max=25.0,
        regulatory_anchor="GHG Protocol",
        description=(
            "Direct emissions (anode oxidation, PFC, fuels) as a share of "
            "cradle-to-gate CFP. Above 25% → hidden combustion source."
        ),
        owner_step="smelting",
        provenance=Provenance(
            source_kind="derived",
            source_label="DPP body decomposition · scope-1 line items",
            frequency_seconds=900,
            latency_seconds_p50=180,
            pipeline=_DPP_AGGREGATE_PIPELINE,
        ),
    ),
    # ── Circularity (FLAGSHIP) ──────────────────────────────────────────
    SignalDef(
        key="circularity.recycled_content_pct",
        group="circularity",
        label="Recycled content (24h avg)",
        unit="%",
        target_min=0.0,
        target_max=100.0,
        regulatory_anchor="ESPR Art 5(1)(j)",
        description=(
            "Mass-balance allocated recycled aluminium share across all DPPs "
            "issued in the last 24h. CelestiAL-R targets ≥75%; Standard product "
            "is allowed any value ≥0%. Drift downward triggers an ASI Chain-of-"
            "Custody review."
        ),
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="ledger",
            source_label="Mass-balance allocator · ASI CoC ledger v3",
            frequency_seconds=3600,
            latency_seconds_p50=300,
            pipeline=[
                PipelineStop(name="Truck weighbridge (per arrival)", kind="device"),
                PipelineStop(name="OES spectrometer (composition)", kind="device"),
                PipelineStop(name="Scrap-yard MES", kind="system"),
                PipelineStop(
                    name="Mass-balance allocator",
                    kind="aggregator",
                    note="ASI Chain-of-Custody v3 rules · pre/post-consumer split",
                ),
                PipelineStop(
                    name="DPP issuance · recycledContent.totalPercent",
                    kind="api",
                    note="Per-cast write into the signed envelope",
                ),
                PipelineStop(name="dpp_records · 24h rolling agg", kind="store"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
            data_quality=(
                "Allocator reconciles intake (weighbridge tonnes) vs output "
                "(DPP-claimed recycled tonnes) every 24h. Variance >0.5% triggers "
                "a CoC review and freezes downstream issuance."
            ),
            real_data=True,
        ),
    ),
    SignalDef(
        key="circularity.post_consumer_share_pct",
        group="circularity",
        label="Post-consumer share of recycled",
        unit="%",
        target_min=0.0,
        target_max=100.0,
        regulatory_anchor="ESPR Annex III",
        description=(
            "Of the recycled fraction, share that is post-consumer scrap (more "
            "valuable in regulatory terms than pre-consumer drop)."
        ),
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="ledger",
            source_label="Scrap-yard intake classification",
            frequency_seconds=3600,
            latency_seconds_p50=300,
            pipeline=_WEIGHBRIDGE_PIPELINE,
            data_quality=(
                "Each truck arrival is classified pre- vs post-consumer at the "
                "weighbridge by the scrap dealer's certified declaration; "
                "audited by ASI quarterly."
            ),
        ),
    ),
    SignalDef(
        key="circularity.scrap_intake_t_per_h",
        group="circularity",
        label="Scrap intake rate",
        unit="t/h",
        target_min=12.0,
        target_max=28.0,
        regulatory_anchor="Internal · CelestiAL-R supply plan",
        description=(
            "Tonnes of scrap arriving at the molten-metal alloying line per "
            "hour. Drops below 12 t/h → CelestiAL-R production constrained; "
            "above 28 t/h → yard buffer at risk of overflow."
        ),
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="weighbridge",
            source_label="Truck-arrival weighbridge · 3-axle calibrated scale",
            frequency_seconds=300,
            latency_seconds_p50=60,
            pipeline=_WEIGHBRIDGE_PIPELINE,
            data_quality="Calibrated quarterly to OIML R-76 class III.",
        ),
    ),
    SignalDef(
        key="circularity.mass_balance_variance_pct",
        group="circularity",
        label="Mass-balance variance (24h)",
        unit="%",
        target_min=-0.5,
        target_max=0.5,
        regulatory_anchor="ASI CoC v3 · §6.4 reconciliation",
        description=(
            "Difference between recycled tonnes claimed by issued DPPs and "
            "tonnes received at the scrap-yard weighbridge over the same 24h "
            "window. Anything outside ±0.5% breaches ASI CoC and freezes "
            "claim-eligible issuance."
        ),
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="derived",
            source_label="Allocator reconciliation engine",
            frequency_seconds=3600,
            latency_seconds_p50=600,
            pipeline=[
                PipelineStop(name="Weighbridge intake (24h)", kind="aggregator"),
                PipelineStop(name="DPP recycled-claim sum", kind="aggregator"),
                PipelineStop(name="Variance calculator", kind="aggregator"),
                PipelineStop(name="ASI CoC ledger entry", kind="store"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
            data_quality=(
                "Daily ledger snapshot is hash-chained into the audit log; ASI "
                "auditors verify the chain quarterly."
            ),
        ),
    ),
    SignalDef(
        key="circularity.dross_recovery_pct",
        group="circularity",
        label="Dross recovery",
        unit="%",
        target_min=85.0,
        target_max=100.0,
        regulatory_anchor="Internal · ASI Performance",
        description="Aluminium recovered from dross via the recycling line.",
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="mes",
            source_label="Dross-press station · per-batch yield log",
            frequency_seconds=3600,
            latency_seconds_p50=300,
            pipeline=_WEIGHBRIDGE_PIPELINE,
        ),
    ),
    SignalDef(
        key="circularity.asi_coc_compliance_pct",
        group="circularity",
        label="ASI Chain-of-Custody compliance (30d)",
        unit="%",
        target_min=99.5,
        target_max=100.0,
        regulatory_anchor="ASI CoC Standard v3",
        description=(
            "Share of issued DPPs in the last 30 days whose recycled-content "
            "claim is fully traceable through the ASI CoC ledger. Anything "
            "below 100% triggers a CoC investigation."
        ),
        owner_step="molten_metal_alloying",
        provenance=Provenance(
            source_kind="derived",
            source_label="ASI ledger · DPP recycled-claim audit",
            frequency_seconds=3600,
            latency_seconds_p50=600,
            pipeline=[
                PipelineStop(name="ASI CoC ledger", kind="store"),
                PipelineStop(name="DPP recycled-claim scanner", kind="aggregator"),
                PipelineStop(name="Plant Monitor", kind="dashboard"),
            ],
        ),
    ),
    # ── Verification ─────────────────────────────────────────────────────
    SignalDef(
        key="verification.dnv_cfp_statement_days_remaining",
        group="verification",
        label="DNV CFP statement validity",
        unit="days",
        target_min=90.0,
        target_max=None,
        regulatory_anchor="ISO 14067 verification statement",
        description=(
            "Days remaining on the active DNV verification statement. Triggers "
            "re-verify below 90 days."
        ),
        owner_step="third_party_verification",
        provenance=Provenance(
            source_kind="manual",
            source_label="DNV-uploaded verification statement (PDF + DID-signed)",
            frequency_seconds=86400,
            latency_seconds_p50=86400,
            pipeline=_VERIFIER_PIPELINE,
        ),
    ),
    SignalDef(
        key="verification.asi_certificate_days_remaining",
        group="verification",
        label="ASI Performance certificate validity",
        unit="days",
        target_min=180.0,
        target_max=None,
        regulatory_anchor="ASI Performance Standard v3",
        description="Aluminium Stewardship Initiative certificate runway.",
        owner_step="third_party_verification",
        provenance=Provenance(
            source_kind="manual",
            source_label="ASI-uploaded certificate metadata",
            frequency_seconds=86400,
            latency_seconds_p50=86400,
            pipeline=_VERIFIER_PIPELINE,
        ),
    ),
    SignalDef(
        key="verification.dod_coverage_pct",
        group="verification",
        label="Definition-of-Done coverage",
        unit="%",
        target_min=100.0,
        target_max=100.0,
        regulatory_anchor="SDD §8.5 DoD",
        description=("Share of issued DPPs (last 24h) carrying the full DoD attribute set."),
        owner_step="third_party_verification",
        provenance=Provenance(
            source_kind="derived",
            source_label="DoD scanner · 200-DPP rolling window",
            frequency_seconds=900,
            latency_seconds_p50=180,
            pipeline=_DPP_AGGREGATE_PIPELINE,
            real_data=True,
        ),
    ),
    SignalDef(
        key="verification.cbam_declaration_complete_pct",
        group="verification",
        label="CBAM declaration completeness",
        unit="%",
        target_min=100.0,
        target_max=100.0,
        regulatory_anchor="EU Reg 2023/956 (CBAM)",
        description=("Embodied-emissions declaration completeness for in-flight EU shipments."),
        owner_step="third_party_verification",
        provenance=Provenance(
            source_kind="derived",
            source_label="CBAM scanner · EU-bound DPP window",
            frequency_seconds=900,
            latency_seconds_p50=180,
            pipeline=_DPP_AGGREGATE_PIPELINE,
        ),
    ),
]


# ── Classification + synthetic generators ──────────────────────────────


def _classify(
    value: float | None, target_min: float | None, target_max: float | None
) -> SignalStatus:
    if value is None:
        return "no_data"
    if target_min is None and target_max is None:
        return "ok"
    band = (
        (target_max - target_min) * 0.05
        if (target_min is not None and target_max is not None)
        else None
    )
    if target_min is not None and value < target_min:
        if band is not None and value >= target_min - band:
            return "warn"
        return "breach"
    if target_max is not None and value > target_max:
        if band is not None and value <= target_max + band:
            return "warn"
        return "breach"
    return "ok"


def _synthetic_value(
    tenant_id: int,
    signal_key: str,
    target_min: float | None,
    target_max: float | None,
    salt: str = "",
) -> float:
    today = date.today().isoformat()
    seed = f"{tenant_id}:{today}:{signal_key}:{salt}"
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    frac = (h % 10_000) / 10_000.0
    if target_min is not None and target_max is not None:
        if frac < 0.80:
            return target_min + (target_max - target_min) * (frac / 0.80)
        outside_frac = (frac - 0.80) / 0.20
        band = (target_max - target_min) * 0.05
        if outside_frac < 0.5:
            return target_min - band * (1 + outside_frac * 0.6)
        return target_max + band * (1 + (outside_frac - 0.5) * 0.6)
    if target_min is not None:
        return target_min + (1.0 + frac) * abs(target_min) * 0.1
    if target_max is not None:
        return max(0.0, target_max * (0.4 + frac * 0.5))
    return frac * 100


def _synthetic_trend(value: float, n: int = 12, amplitude: float = 0.015) -> list[float]:
    if not math.isfinite(value):
        return []
    out: list[float] = []
    for i in range(n):
        delta = math.sin((i + 1) * 0.7) * value * amplitude + (i - n / 2) * value * 0.001
        out.append(round(value + delta, 4))
    return out


def _synthetic_series(
    value: float,
    *,
    points: int,
    interval_seconds: int,
    target_min: float | None,
    target_max: float | None,
) -> list[SignalSeriesPoint]:
    """Build a `points`-long time-series that ends at `value`. Each point gets a
    plausible random walk centred on a slow sinusoid so the chart is readable.
    Some points may step outside the target band so the chart shows breach
    overlays.
    """
    now = datetime.now(UTC)
    out: list[SignalSeriesPoint] = []
    if not math.isfinite(value):
        return out
    band_amp = (
        (target_max - target_min) * 0.04
        if (target_min is not None and target_max is not None)
        else value * 0.02
    )
    for i in range(points):
        ts = now - timedelta(seconds=interval_seconds * (points - 1 - i))
        # Slow sinusoid + per-step noise drawn from a hash so it's stable.
        seed = f"{value}:{i}:{ts.date().isoformat()}".encode()
        h = int(hashlib.sha256(seed).hexdigest(), 16)
        noise_frac = ((h % 10_000) / 10_000.0) - 0.5  # −0.5 .. +0.5
        slow = math.sin(i / max(1, points / 6)) * band_amp * 0.6
        v = value + slow + noise_frac * band_amp * 1.2
        out.append(SignalSeriesPoint(ts=ts, value=round(v, 4)))
    return out


# ── DB-backed helpers (real data) ──────────────────────────────────────


async def _real_carbon_rolling(session: AsyncSession, tenant_id: int) -> float | None:
    avg = await session.scalar(
        select(func.avg(DppRecord.cfp_kg_co2e_per_tonne)).where(
            DppRecord.tenant_id == tenant_id,
            DppRecord.state == "published",
        )
    )
    return float(avg) if avg is not None else None


async def _real_recycled_rolling(session: AsyncSession, tenant_id: int) -> float | None:
    avg = await session.scalar(
        select(func.avg(DppRecord.recycled_content_pct)).where(
            DppRecord.tenant_id == tenant_id,
            DppRecord.state == "published",
        )
    )
    return float(avg) if avg is not None else None


async def _real_dod_coverage(session: AsyncSession, tenant_id: int) -> float | None:
    rows = (
        await session.scalars(
            select(DppRecord.body)
            .where(
                DppRecord.tenant_id == tenant_id,
                DppRecord.state == "published",
            )
            .limit(200)
        )
    ).all()
    if not rows:
        return None
    full = 0
    for body in rows:
        comp = (body or {}).get("compliance", {})
        regs = comp.get("regulations") or []
        certs = comp.get("certifications") or []
        if len(regs) >= 5 and len(certs) >= 5:
            full += 1
    return round(100.0 * full / len(rows), 1)


async def _real_recycled_recent_dpps(
    session: AsyncSession, tenant_id: int, limit: int = 20
) -> list[dict[str, str | float]]:
    """Recent DPPs that carried a recycled-content claim — used by the detail
    page to show the "by-batch" breakdown.
    """
    rows = (
        await session.execute(
            select(
                DppRecord.upi,
                DppRecord.brand,
                DppRecord.recycled_content_pct,
                DppRecord.cast_number,
                DppRecord.issued_at,
            )
            .where(
                DppRecord.tenant_id == tenant_id,
                DppRecord.state == "published",
            )
            .order_by(DppRecord.issued_at.desc())
            .limit(limit)
        )
    ).all()
    out: list[dict[str, str | float]] = []
    for r in rows:
        out.append(
            {
                "upi": r.upi,
                "brand": r.brand,
                "castNumber": r.cast_number,
                "recycledContentPct": float(r.recycled_content_pct or 0.0),
                "issuedAt": r.issued_at.isoformat() if r.issued_at else "",
            }
        )
    return out


_GROUP_LABELS: dict[SignalGroup, str] = {
    "electrolysis": "Electrolysis cell line",
    "power": "Power & energy mix",
    "casthouse": "Casthouse & QC",
    "carbon": "Carbon footprint",
    "circularity": "Circularity",
    "verification": "Verification & compliance",
}


async def _resolve_real_overrides(session: AsyncSession, tenant_id: int) -> dict[str, float | None]:
    cfp = await _real_carbon_rolling(session, tenant_id)
    overrides: dict[str, float | None] = {
        "carbon.cfp_rolling_kg_per_t": cfp,
        "carbon.industry_avg_delta_pct": (
            round(((cfp - 14600.0) / 14600.0) * 100.0, 1) if cfp is not None else None
        ),
        "circularity.recycled_content_pct": await _real_recycled_rolling(session, tenant_id),
        "verification.dod_coverage_pct": await _real_dod_coverage(session, tenant_id),
    }
    return overrides


def _read_signal(
    sig_def: SignalDef,
    *,
    tenant_id: int,
    real_overrides: dict[str, float | None],
    trend_n: int = 12,
) -> SignalReading:
    real_value = real_overrides.get(sig_def.key)
    is_synthetic = real_value is None
    value = (
        real_value
        if real_value is not None
        else round(
            _synthetic_value(tenant_id, sig_def.key, sig_def.target_min, sig_def.target_max),
            2,
        )
    )
    status = _classify(value, sig_def.target_min, sig_def.target_max)
    trend = _synthetic_trend(value, n=trend_n) if value is not None else []
    provenance = Provenance(
        source_kind=sig_def.provenance.source_kind,
        source_label=sig_def.provenance.source_label,
        frequency_seconds=sig_def.provenance.frequency_seconds,
        latency_seconds_p50=sig_def.provenance.latency_seconds_p50,
        pipeline=sig_def.provenance.pipeline,
        data_quality=sig_def.provenance.data_quality,
        real_data=not is_synthetic,
    )
    return SignalReading(
        key=sig_def.key,
        group=sig_def.group,
        label=sig_def.label,
        unit=sig_def.unit,
        value=value,
        target_min=sig_def.target_min,
        target_max=sig_def.target_max,
        status=status,
        trend=trend,
        regulatory_anchor=sig_def.regulatory_anchor,
        description=sig_def.description,
        owner_step=sig_def.owner_step,
        is_synthetic=is_synthetic,
        provenance=provenance,
    )


async def compute_plant_status(session: AsyncSession, *, tenant_id: int) -> PlantStatus:
    """Snapshot every signal in the catalogue for this tenant."""
    real_overrides = await _resolve_real_overrides(session, tenant_id)

    signals = [
        _read_signal(s, tenant_id=tenant_id, real_overrides=real_overrides) for s in _CATALOGUE
    ]

    groups: dict[SignalGroup, GroupRollup] = {}
    for s in signals:
        g = groups.get(s.group)
        if g is None:
            g = GroupRollup(
                group=s.group,
                label=_GROUP_LABELS[s.group],
                ok=0,
                warn=0,
                breach=0,
                no_data=0,
                total=0,
            )
            groups[s.group] = g
        g.total += 1
        if s.status == "ok":
            g.ok += 1
        elif s.status == "warn":
            g.warn += 1
        elif s.status == "breach":
            g.breach += 1
        else:
            g.no_data += 1

    breaches = [s for s in signals if s.status == "breach"]

    return PlantStatus(
        generated_at=datetime.now(UTC),
        plant_name="EGA Jebel Ali · DX+ Ultra cell line",
        line_count=6,
        signals=signals,
        groups=list(groups.values()),
        breaches=breaches,
    )


_RANGE_CONFIG: dict[str, tuple[int, int, str]] = {
    # range key → (points, interval_seconds, label)
    "24h": (96, 15 * 60, "Last 24 hours · 15-min interval"),
    "7d": (168, 60 * 60, "Last 7 days · 1-hour interval"),
    "30d": (180, 4 * 60 * 60, "Last 30 days · 4-hour interval"),
}


async def compute_signal_detail(
    session: AsyncSession,
    *,
    tenant_id: int,
    signal_key: str,
    range_key: str = "24h",
) -> SignalDetail | None:
    sig_def = next((s for s in _CATALOGUE if s.key == signal_key), None)
    if sig_def is None:
        return None
    real_overrides = await _resolve_real_overrides(session, tenant_id)
    reading = _read_signal(sig_def, tenant_id=tenant_id, real_overrides=real_overrides)

    points, interval, range_label = _RANGE_CONFIG.get(range_key, _RANGE_CONFIG["24h"])
    series = (
        _synthetic_series(
            reading.value,
            points=points,
            interval_seconds=interval,
            target_min=sig_def.target_min,
            target_max=sig_def.target_max,
        )
        if reading.value is not None
        else []
    )

    # Statistics over the rendered series.
    if series:
        vals = [p.value for p in series]
        sorted_vals = sorted(vals)
        n = len(sorted_vals)
        stats = {
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
            "mean": round(sum(vals) / n, 4),
            "p50": round(sorted_vals[n // 2], 4),
            "p95": round(sorted_vals[max(0, int(n * 0.95) - 1)], 4),
            "stddev": round(math.sqrt(sum((v - (sum(vals) / n)) ** 2 for v in vals) / n), 4),
            "samples": float(n),
        }
    else:
        stats = {}

    # Breach events: contiguous runs where the series is outside band.
    breach_events: list[dict[str, str | float]] = []
    if (sig_def.target_min is not None or sig_def.target_max is not None) and series:
        run_start: SignalSeriesPoint | None = None
        run_extreme: float | None = None
        for p in series:
            outside = (sig_def.target_min is not None and p.value < sig_def.target_min) or (
                sig_def.target_max is not None and p.value > sig_def.target_max
            )
            if outside:
                if run_start is None:
                    run_start = p
                    run_extreme = p.value
                elif (
                    run_extreme is None
                    or (sig_def.target_max is not None and p.value > run_extreme)
                    or (sig_def.target_min is not None and p.value < (run_extreme or 0))
                ):
                    run_extreme = p.value
            elif run_start is not None:
                breach_events.append(
                    {
                        "from": run_start.ts.isoformat(),
                        "to": p.ts.isoformat(),
                        "extreme": float(run_extreme) if run_extreme is not None else 0.0,
                    }
                )
                run_start = None
                run_extreme = None
        if run_start is not None:
            breach_events.append(
                {
                    "from": run_start.ts.isoformat(),
                    "to": series[-1].ts.isoformat(),
                    "extreme": float(run_extreme) if run_extreme is not None else 0.0,
                }
            )

    return SignalDetail(
        reading=reading,
        series=series,
        range_label=range_label,
        stats=stats,
        breach_events=breach_events,
    )


async def recycled_content_recent_batches(
    session: AsyncSession, *, tenant_id: int, limit: int = 20
) -> list[dict[str, str | float]]:
    """Per-batch view used by the recycled-content detail page."""
    return await _real_recycled_recent_dpps(session, tenant_id, limit=limit)
