"""Initial schema — tenants, cast_events, dpp_records, audit_log + RLS.

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    # ── tenants ────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", postgresql.CITEXT(), nullable=False, unique=True),
        sa.Column("legal_name", sa.String(256), nullable=False),
        sa.Column("issuer_did", sa.String(512), nullable=True),
        sa.Column("custom_domain", sa.String(256), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("tier", sa.String(32), nullable=False, server_default="poc"),
        sa.Column("branding", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('trialing','active','suspended','terminated')",
            name="ck_tenants_status",
        ),
        sa.CheckConstraint("tier IN ('poc','production','enterprise')", name="ck_tenants_tier"),
    )

    # ── cast_events ─────────────────────────────────────────────────────────
    op.create_table(
        "cast_events",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("tracking_id", sa.String(128), nullable=False),
        sa.Column("source_kind", sa.String(32), nullable=False),
        sa.Column("source_actor", sa.String(256), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("schema_version", sa.String(16), nullable=False, server_default="1.0.0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="received"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "received_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("tenant_id", "tracking_id", name="uq_cast_events_tenant_tracking"),
        sa.CheckConstraint(
            "status IN ('received','validated','generated','signed','published','failed')",
            name="ck_cast_events_status",
        ),
    )
    op.create_index("ix_cast_events_tenant_received", "cast_events", ["tenant_id", "received_at"])

    # ── dpp_records ─────────────────────────────────────────────────────────
    op.create_table(
        "dpp_records",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("upi", sa.String(512), nullable=False),
        sa.Column("gtin", sa.String(14), nullable=False),
        sa.Column("cast_number", sa.String(64), nullable=False),
        sa.Column("item_serial", sa.String(64), nullable=True),
        sa.Column("brand", sa.String(32), nullable=False),
        sa.Column("alloy", sa.String(32), nullable=False),
        sa.Column("form", sa.String(32), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("cfp_kg_co2e_per_tonne", sa.Float(), nullable=False),
        sa.Column("recycled_content_pct", sa.Float(), nullable=False, server_default="0"),
        sa.Column("schema_version", sa.String(16), nullable=False, server_default="1.0.0"),
        sa.Column("dpp_version", sa.String(8), nullable=False, server_default="1.0"),
        sa.Column("state", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("envelope", postgresql.JSONB(), nullable=True),
        sa.Column("body_sha256", sa.String(64), nullable=True),
        sa.Column("signature", sa.Text(), nullable=True),
        sa.Column(
            "cast_event_id",
            sa.BigInteger(),
            sa.ForeignKey("cast_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revision_of", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("tenant_id", "upi", name="uq_dpp_records_tenant_upi"),
        sa.CheckConstraint(
            "state IN ('draft','published','revised','withdrawn','expired')",
            name="ck_dpp_records_state",
        ),
    )
    op.create_index("ix_dpp_records_tenant_brand", "dpp_records", ["tenant_id", "brand"])
    op.create_index("ix_dpp_records_tenant_cast", "dpp_records", ["tenant_id", "cast_number"])
    op.create_index("ix_dpp_records_tenant_issued", "dpp_records", ["tenant_id", "issued_at"])

    # ── audit_log ───────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("actor_kind", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.String(256), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_kind", sa.String(64), nullable=False),
        sa.Column("target_id", sa.String(256), nullable=True),
        sa.Column("severity", sa.String(16), nullable=False, server_default="info"),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("prev_hash", sa.String(64), nullable=True),
        sa.Column("current_hash", sa.String(64), nullable=False),
        sa.CheckConstraint(
            "severity IN ('debug','info','notice','warn','error','critical')",
            name="ck_audit_log_severity",
        ),
        sa.CheckConstraint(
            "actor_kind IN ('user','system','external_verifier','platform','api_key')",
            name="ck_audit_log_actor_kind",
        ),
    )
    op.create_index("ix_audit_log_tenant_occurred", "audit_log", ["tenant_id", "occurred_at"])
    op.create_index("ix_audit_log_tenant_action", "audit_log", ["tenant_id", "action"])

    # ── Row-level security ──────────────────────────────────────────────────
    # Every tenant-scoped table enforces RLS based on the
    # `app.current_tenant_id` GUC set at session-open time.
    for table in ("cast_events", "dpp_records", "audit_log"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
                USING (
                    tenant_id = NULLIF(
                        current_setting('app.current_tenant_id', true),
                        ''
                    )::int
                    OR current_setting('app.current_tenant_id', true) IS NULL
                    OR current_setting('app.current_tenant_id', true) = ''
                );
            """
        )

    # ── Seed the HZL tenant ────────────────────────────────────────────────
    # Migration 0008_hzl_seed UPDATEs this row to its final form (full HZL
    # branding + did:web). Seeding a placeholder here keeps the FK chain valid
    # for older migrations that referenced tenant id=1 before the rebrand.
    op.execute(
        """
        INSERT INTO tenants (id, slug, legal_name, issuer_did, status, tier, branding)
        VALUES (
            1,
            'hzl',
            'Hindustan Zinc Limited',
            'did:web:passport.hzlindia.local',
            'active',
            'production',
            '{"primaryColor": "#0E7C5A", "logo": null}'::jsonb
        )
        ON CONFLICT (id) DO NOTHING;
        """
    )
    op.execute(
        "SELECT setval(pg_get_serial_sequence('tenants','id'), "
        "GREATEST(1, (SELECT max(id) FROM tenants)));"
    )


def downgrade() -> None:
    for table in ("cast_events", "dpp_records", "audit_log"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    op.drop_index("ix_audit_log_tenant_action", table_name="audit_log")
    op.drop_index("ix_audit_log_tenant_occurred", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("ix_dpp_records_tenant_issued", table_name="dpp_records")
    op.drop_index("ix_dpp_records_tenant_cast", table_name="dpp_records")
    op.drop_index("ix_dpp_records_tenant_brand", table_name="dpp_records")
    op.drop_table("dpp_records")

    op.drop_index("ix_cast_events_tenant_received", table_name="cast_events")
    op.drop_table("cast_events")

    op.drop_table("tenants")
