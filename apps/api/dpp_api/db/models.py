"""ORM models for the DPP platform.

Tables (per SDD §7.2):
    tenants               — multi-tenant configuration
    users                 — VC-bound identities
    api_keys              — service-to-service auth
    cast_events           — append-only ingestion log
    dpp_records           — issued DPPs (canonical body + signed envelope)
    reference_cfp         — CFP values per (brand, facility, period)
    reference_compliance  — certificate registry
    audit_log             — append-only hash-chained event log
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .session import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Tenant(Base):
    """A platform tenant. EGA is tenant_id=1."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    slug: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    legal_name: Mapped[str] = mapped_column(String(256), nullable=False)
    issuer_did: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    custom_domain: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="active",
        server_default="active",
    )
    tier: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="poc",
        server_default="poc",
    )
    branding: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('trialing','active','suspended','terminated')", name="ck_tenants_status"
        ),
        CheckConstraint("tier IN ('poc','production','enterprise')", name="ck_tenants_tier"),
    )


class CastEvent(Base):
    """Append-only ingestion log. One row per cast event regardless of source."""

    __tablename__ = "cast_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    tracking_id: Mapped[str] = mapped_column(String(128), nullable=False)
    source_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    source_actor: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    schema_version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0.0")
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="received", server_default="received"
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "tracking_id", name="uq_cast_events_tenant_tracking"),
        Index("ix_cast_events_tenant_received", "tenant_id", "received_at"),
        CheckConstraint(
            "status IN ('received','validated','generated','signed','published','failed')",
            name="ck_cast_events_status",
        ),
    )


class DppRecord(Base):
    """An issued DPP. Stores both the canonical body and the signed envelope."""

    __tablename__ = "dpp_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    upi: Mapped[str] = mapped_column(String(512), nullable=False)
    gtin: Mapped[str] = mapped_column(String(14), nullable=False)
    cast_number: Mapped[str] = mapped_column(String(64), nullable=False)
    item_serial: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    brand: Mapped[str] = mapped_column(String(32), nullable=False)
    alloy: Mapped[str] = mapped_column(String(32), nullable=False)
    form: Mapped[str] = mapped_column(String(32), nullable=False)
    weight_kg: Mapped[float] = mapped_column(nullable=False)
    cfp_kg_co2e_per_tonne: Mapped[float] = mapped_column(nullable=False)
    recycled_content_pct: Mapped[float] = mapped_column(nullable=False, default=0.0)
    schema_version: Mapped[str] = mapped_column(String(16), nullable=False, default="1.0.0")
    dpp_version: Mapped[str] = mapped_column(String(8), nullable=False, default="1.0")
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    body: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    envelope: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True, default=None)
    body_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    signature: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    cast_event_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("cast_events.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    issued_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    revision_of: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    revision_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    revision_history: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default_factory=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "upi", name="uq_dpp_records_tenant_upi"),
        Index("ix_dpp_records_tenant_brand", "tenant_id", "brand"),
        Index("ix_dpp_records_tenant_cast", "tenant_id", "cast_number"),
        Index("ix_dpp_records_tenant_issued", "tenant_id", "issued_at"),
        CheckConstraint(
            "state IN ('draft','published','revised','withdrawn','expired')",
            name="ck_dpp_records_state",
        ),
    )


class ReferenceCfp(Base):
    """Verified CFP values per (tenant, brand, facility, period).

    Populated by the verifier surface (DNV uploads a new annual VC) or
    bootstrapped from the seed presets at install time. The generator reads
    from this table during DPP issuance — never inlines values.
    """

    __tablename__ = "reference_cfp"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    brand: Mapped[str] = mapped_column(String(32), nullable=False)
    facility_ufi: Mapped[str | None] = mapped_column(String(13), nullable=True, default=None)
    period_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    value_kg_co2e_per_tonne: Mapped[float] = mapped_column(nullable=False)
    industry_average: Mapped[float | None] = mapped_column(nullable=True, default=None)
    methodology: Mapped[str] = mapped_column(
        String(256),
        nullable=False,
        default="ISO 14067:2018 + IAI v2.0 + PCR 2022:08 v1.0",
    )
    verifier_did: Mapped[str] = mapped_column(String(512), nullable=False)
    verifier_name: Mapped[str] = mapped_column(String(256), nullable=False)
    statement_ref: Mapped[str] = mapped_column(String(256), nullable=False)
    assurance_level: Mapped[str] = mapped_column(String(16), nullable=False, default="limited")
    decomposition: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_reference_cfp_lookup", "tenant_id", "brand", "state", "period_to"),
        CheckConstraint(
            "assurance_level IN ('limited','reasonable')",
            name="ck_reference_cfp_assurance",
        ),
        CheckConstraint(
            "state IN ('active','superseded','revoked')", name="ck_reference_cfp_state"
        ),
    )


class ReferenceCompliance(Base):
    """Compliance certificate registry — ASI, ISO, REACH, RoHS, etc."""

    __tablename__ = "reference_compliance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="compliant", server_default="compliant"
    )
    issuer: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    certificate_ref: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    category: Mapped[str] = mapped_column(
        String(16), nullable=False, default="regulation", server_default="regulation"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_reference_compliance_lookup", "tenant_id", "category", "name"),
        CheckConstraint(
            "status IN ('compliant','non_compliant','n_a','pending')",
            name="ck_reference_compliance_status",
        ),
        CheckConstraint(
            "category IN ('regulation','certification')",
            name="ck_reference_compliance_category",
        ),
    )


class WebhookSubscription(Base):
    """Customer-registered webhook subscription.

    SDD §5.3.3 third workflow. Each subscription has a customer org, a target
    URL, an HMAC secret, and an event-mask. Outbound delivery + DLQ live in a
    separate worker (deferred to v1.5); this table is the authoritative
    registration record.
    """

    __tablename__ = "webhook_subscriptions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    customer_org: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    events: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default_factory=list, server_default="[]"
    )
    hmac_secret_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    last_delivery_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    failure_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        Index("ix_webhooks_tenant_customer", "tenant_id", "customer_org"),
        CheckConstraint("state IN ('active','paused','deleted')", name="ck_webhooks_state"),
    )


class AuditLog(Base):
    """Append-only hash-chained event log. SDD §12.1.8."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    actor_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="info", server_default="info"
    )
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    current_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    __table_args__ = (
        Index("ix_audit_log_tenant_occurred", "tenant_id", "occurred_at"),
        Index("ix_audit_log_tenant_action", "tenant_id", "action"),
        CheckConstraint(
            "severity IN ('debug','info','notice','warn','error','critical')",
            name="ck_audit_log_severity",
        ),
        CheckConstraint(
            "actor_kind IN ('user','system','external_verifier','platform','api_key')",
            name="ck_audit_log_actor_kind",
        ),
    )


# ── Product configuration plane (SDD §11) ───────────────────────────────────


class ProcessStep(Base):
    """Canonical reference list of process steps. Not tenant-scoped — every
    tenant's product chain selects from the same canonical set."""

    __tablename__ = "process_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    tier: Mapped[str] = mapped_column(
        String(32), nullable=False, default="upstream", server_default="upstream"
    )


class Product(Base):
    """A product in the tenant's portfolio (CelestiAL, Standard, …)."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    brand: Mapped[str] = mapped_column(String(64), nullable=False)
    alloy_family: Mapped[str] = mapped_column(String(32), nullable=False)
    form: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_products_tenant_slug"),)


class ProductProcessChain(Base):
    """Ordered process chain that applies to a specific product."""

    __tablename__ = "product_process_chains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    process_step_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("process_steps.id", ondelete="RESTRICT"),
        nullable=False,
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        UniqueConstraint("product_id", "process_step_id", name="uq_chain_product_step"),
    )


class DppManifestAttr(Base):
    """For each (process_step, dpp_version) the roster of attributes expected.

    Canonical reference data — drives the Level-3 editor where the user
    confirms which attributes belong at each version per step.
    """

    __tablename__ = "dpp_manifest_attrs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    process_step_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("process_steps.id", ondelete="CASCADE"),
        nullable=False,
    )
    dpp_version: Mapped[str] = mapped_column(String(8), nullable=False)
    attribute_path: Mapped[str] = mapped_column(String(256), nullable=False)
    label: Mapped[str] = mapped_column(String(256), nullable=False)
    necessity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="mandatory", server_default="mandatory"
    )
    regulatory_anchor: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        UniqueConstraint(
            "process_step_id",
            "dpp_version",
            "attribute_path",
            name="uq_manifest_step_version_attr",
        ),
    )


class ProductDppConfig(Base):
    """Per-(product, dpp_version) lock state + per-step attribute selections.

    Created in draft state during the Level-3 editor. Once the user clicks
    'Finalise DPP X.Y' it transitions to `locked` (Level 4). Data ingestion
    cannot start for the (product, version) pair until this row is locked
    AND all third-party data_sources are `granted` (Level 5 → 6).
    """

    __tablename__ = "product_dpp_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    dpp_version: Mapped[str] = mapped_column(String(8), nullable=False)
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    selections: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    locked_by: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("product_id", "dpp_version", name="uq_pdpcfg_product_version"),
    )


# ── Passport authoring plane (SDD §11 — per-cast draft workflow) ─────────────


class DppDraft(Base):
    """A passport in-progress for a single cast.

    Lifecycle: `entry` → `disclosure` → `published`. Created when an operator
    clicks Create Passport in the console. Backing table for the wizard's
    attribute-entry, assignment, and publish flows.
    """

    __tablename__ = "dpp_drafts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False
    )
    dpp_version: Mapped[str] = mapped_column(String(8), nullable=False)
    cast_number: Mapped[str] = mapped_column(String(64), nullable=False)
    item_serial: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    title: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    state: Mapped[str] = mapped_column(
        String(24), nullable=False, default="entry", server_default="entry"
    )
    created_by: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
        onupdate=func.now(),
    )
    published_dpp_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("dpp_records.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "product_id",
            "dpp_version",
            "cast_number",
            name="uq_dpp_drafts_tenant_product_version_cast",
        ),
        Index("ix_dpp_drafts_tenant_state", "tenant_id", "state"),
        CheckConstraint(
            "state IN ('entry','disclosure','published','archived')",
            name="ck_dpp_drafts_state",
        ),
    )


class DppAttributeValue(Base):
    """Entered value for one attribute on a draft.

    `source` records which entry mode produced the value:
      manual    — operator typed it in
      iot       — pulled from a registered IoT connection
      library   — copied from a tenant preset / reference library
      external  — submitted by an assignee via magic-link
    """

    __tablename__ = "dpp_attribute_values"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    draft_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("dpp_drafts.id", ondelete="CASCADE"), nullable=False
    )
    manifest_attr_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dpp_manifest_attrs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    process_step_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("process_steps.id", ondelete="RESTRICT"),
        nullable=False,
    )
    attribute_path: Mapped[str] = mapped_column(String(256), nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False, default=None)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    source_ref: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="empty", server_default="empty"
    )
    entered_by: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    entered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("draft_id", "manifest_attr_id", name="uq_attribute_values_draft_attr"),
        Index(
            "ix_attribute_values_draft_step",
            "draft_id",
            "process_step_id",
        ),
        CheckConstraint(
            "source IN ('manual','iot','library','external')",
            name="ck_attribute_values_source",
        ),
        CheckConstraint(
            "status IN ('empty','pending','complete')",
            name="ck_attribute_values_status",
        ),
    )


class DppAttributeAssignment(Base):
    """An external delegation of attribute entry to an assignee.

    Carries an `access_token` that authorises the assignee to view + write
    only the assigned attribute's value via the magic-link surface.
    """

    __tablename__ = "dpp_attribute_assignments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    draft_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("dpp_drafts.id", ondelete="CASCADE"), nullable=False
    )
    manifest_attr_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dpp_manifest_attrs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    assignee_email: Mapped[str] = mapped_column(String(256), nullable=False)
    assignee_name: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    assignee_org: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    note: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    access_token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default="pending"
    )
    assigned_by: Mapped[str] = mapped_column(String(256), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    __table_args__ = (
        UniqueConstraint("draft_id", "manifest_attr_id", name="uq_assignments_draft_attr"),
        Index("ix_assignments_assignee_email", "assignee_email", "status"),
        CheckConstraint(
            "status IN ('pending','accepted','submitted','revoked')",
            name="ck_assignments_status",
        ),
    )


class IotConnection(Base):
    """Registered IoT endpoint that can supply attribute values."""

    __tablename__ = "iot_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, default=None
    )
    process_step_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("process_steps.id", ondelete="RESTRICT"),
        nullable=True,
        default=None,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    endpoint: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    attribute_map: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="connected", server_default="connected"
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_iot_connections_tenant_name"),
        Index(
            "ix_iot_connections_product_step",
            "product_id",
            "process_step_id",
        ),
        CheckConstraint(
            "status IN ('connected','disconnected','error')",
            name="ck_iot_connections_status",
        ),
    )


class DppPublishDisclosure(Base):
    """Per-(draft, attribute, audience) visibility flag set during publish.

    Drives what each viewer (public, customer, verifier, authority) can see
    after the passport is finalised. Defaults to `visible=true`.
    """

    __tablename__ = "dpp_publish_disclosures"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    draft_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("dpp_drafts.id", ondelete="CASCADE"), nullable=False
    )
    attribute_path: Mapped[str] = mapped_column(String(256), nullable=False)
    audience: Mapped[str] = mapped_column(String(24), nullable=False)
    visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "draft_id",
            "attribute_path",
            "audience",
            name="uq_disclosures_draft_attr_audience",
        ),
        Index("ix_disclosures_draft_audience", "draft_id", "audience"),
        CheckConstraint(
            "audience IN ('public','customer','verifier','authority')",
            name="ck_disclosures_audience",
        ),
    )


class DataSource(Base):
    """For each (product, process_step) — where the data comes from.

    `internal` data flows through the existing cast-events pipeline.
    `third_party` data is fetched via the configured connector once the
    permission_state reaches `granted`.
    """

    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    process_step_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("process_steps.id", ondelete="RESTRICT"),
        nullable=False,
    )
    origin: Mapped[str] = mapped_column(String(16), nullable=False)
    supplier_name: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    supplier_did: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    connector_kind: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    connector_config: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    permission_state: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="not_requested",
        server_default="not_requested",
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    last_sync_status: Mapped[str | None] = mapped_column(String(16), nullable=True, default=None)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("product_id", "process_step_id", name="uq_data_source_product_step"),
    )


# ── BPDM tables (Chem-X Business Identity Guideline) ──────────────────────
# Three tightly-coupled tables: legal_entities (BPNL), sites (BPNS),
# addresses (BPNA), plus a one-to-many identifiers table for the
# CX-0010 §13/§14 identifier-type taxonomy. Created in migration 0007.

# Common SQL CHECK fragment for BPN syntax validation in Postgres.
_BPN_SQL_CHECK = "{col} ~ '^BPN[LSA][A-Z0-9]{{10}}[A-Z0-9]{{2}}$'"


class LegalEntity(Base):
    """Chem-X / CX-0010 legal entity. Globally identified by BPNL."""

    __tablename__ = "legal_entities"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    bpnl: Mapped[str] = mapped_column(String(16), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(512), nullable=False)
    legal_form: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    short_name: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    trade_name: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    subdivision: Mapped[str | None] = mapped_column(String(8), nullable=True, default=None)
    registered_address_bpna: Mapped[str | None] = mapped_column(
        String(16), ForeignKey("addresses.bpna", ondelete="RESTRICT"), nullable=True, default=None
    )
    did: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    valid_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    incorporated_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata",  # column name in DB; rename Python attr to avoid clash with SA Base.metadata
        JSONB,
        nullable=False,
        default_factory=dict,
        server_default="{}",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("bpnl", name="uq_legal_entities_bpnl"),
        UniqueConstraint("tenant_id", "legal_name", name="uq_legal_entities_tenant_name"),
        CheckConstraint(_BPN_SQL_CHECK.format(col="bpnl"), name="ck_legal_entities_bpnl_syntax"),
        CheckConstraint("country ~ '^[A-Z]{2}$'", name="ck_legal_entities_country_iso"),
        CheckConstraint("state IN ('active','inactive')", name="ck_legal_entities_state"),
    )


class Address(Base):
    """Chem-X / CX-0010 address. Globally identified by BPNA, owned by a BPNL."""

    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    bpna: Mapped[str] = mapped_column(String(16), nullable=False)
    owner_bpnl: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    address_type: Mapped[str] = mapped_column(String(32), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    subdivision: Mapped[str | None] = mapped_column(String(8), nullable=True, default=None)
    admin_area_level_2: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    street: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    house_number: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    address_line2: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    latitude: Mapped[float | None] = mapped_column(nullable=True, default=None)
    longitude: Mapped[float | None] = mapped_column(nullable=True, default=None)
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("bpna", name="uq_addresses_bpna"),
        CheckConstraint(_BPN_SQL_CHECK.format(col="bpna"), name="ck_addresses_bpna_syntax"),
        CheckConstraint(
            _BPN_SQL_CHECK.format(col="owner_bpnl"), name="ck_addresses_owner_bpnl_syntax"
        ),
        CheckConstraint("country ~ '^[A-Z]{2}$'", name="ck_addresses_country_iso"),
        CheckConstraint(
            "address_type IN ('legal_address','site_main_address','legal_and_site_main_address','additional_address')",
            name="ck_addresses_type",
        ),
        CheckConstraint("state IN ('active','inactive')", name="ck_addresses_state"),
    )


class Site(Base):
    """Chem-X / CX-0010 site. Globally identified by BPNS, owned by a BPNL."""

    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    bpns: Mapped[str] = mapped_column(String(16), nullable=False)
    owner_bpnl: Mapped[str] = mapped_column(String(16), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    function: Mapped[str] = mapped_column(String(32), nullable=False)
    main_address_bpna: Mapped[str] = mapped_column(
        String(16), ForeignKey("addresses.bpna", ondelete="RESTRICT"), nullable=False
    )
    production_capacity: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    commissioned_on: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=False), nullable=True, default=None
    )
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("bpns", name="uq_sites_bpns"),
        CheckConstraint(_BPN_SQL_CHECK.format(col="bpns"), name="ck_sites_bpns_syntax"),
        CheckConstraint(_BPN_SQL_CHECK.format(col="owner_bpnl"), name="ck_sites_owner_bpnl_syntax"),
        CheckConstraint(
            "function IN ('mine','concentrator','smelter_hydro','smelter_pyro','refinery','casthouse','rolling_mill','powder_atomiser','warehouse','depot')",
            name="ck_sites_function",
        ),
        CheckConstraint("state IN ('active','inactive')", name="ck_sites_state"),
    )


class LegalEntityIdentifier(Base):
    """One identifier (VAT/TIN/NBR/IBR/OTH) for a legal entity."""

    __tablename__ = "legal_entity_identifiers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, init=False)
    tenant_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )
    bpnl: Mapped[str] = mapped_column(
        String(16), ForeignKey("legal_entities.bpnl", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(8), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[str] = mapped_column(String(128), nullable=False)
    issuing_country: Mapped[str | None] = mapped_column(String(2), nullable=True, default=None)
    issuing_body: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default_factory=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default_factory=_utcnow,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("bpnl", "type", "value", name="uq_legal_entity_identifiers_unique"),
        CheckConstraint(
            "category IN ('VAT','TIN','NBR','IBR','OTH')",
            name="ck_legal_entity_identifiers_category",
        ),
    )
