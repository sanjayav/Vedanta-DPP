"""Passport draft authoring plane.

Revision ID: 0006_passport_drafts
Revises: 0005_product_configuration
Create Date: 2026-05-04

Layers in the per-cast authoring workflow on top of the per-product
configuration plane (migration 0005):

  dpp_drafts                — one row per in-progress passport (per cast).
                              Lifecycle: entry -> disclosure -> published.
  dpp_attribute_values      — entered value per (draft, manifest_attr).
                              `source` is one of manual | iot | library | external.
  dpp_attribute_assignments — external delegations of attribute entry.
  iot_connections           — registered IoT endpoints used as a `source` for
                              attribute values.
  dpp_publish_disclosures   — per (draft, attribute_path, audience) visibility
                              flag that the publish wizard writes before the
                              passport is finalised.

Stage completion is *computed* from `dpp_attribute_values` against the
locked `product_dpp_configs.selections` — no separate cache table.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006_passport_drafts"
down_revision = "0005_product_configuration"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── dpp_drafts ────────────────────────────────────────────────────────
    op.create_table(
        "dpp_drafts",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("products.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("dpp_version", sa.String(8), nullable=False),
        sa.Column("cast_number", sa.String(64), nullable=False),
        sa.Column("item_serial", sa.String(64), nullable=True),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column(
            "state",
            sa.String(24),
            nullable=False,
            server_default="entry",
        ),  # entry | disclosure | published | archived
        sa.Column("created_by", sa.String(256), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "published_dpp_id",
            sa.BigInteger,
            sa.ForeignKey("dpp_records.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "tenant_id",
            "product_id",
            "dpp_version",
            "cast_number",
            name="uq_dpp_drafts_tenant_product_version_cast",
        ),
        sa.CheckConstraint(
            "state IN ('entry','disclosure','published','archived')",
            name="ck_dpp_drafts_state",
        ),
    )
    op.create_index("ix_dpp_drafts_tenant_state", "dpp_drafts", ["tenant_id", "state"])

    # ── dpp_attribute_values ──────────────────────────────────────────────
    op.create_table(
        "dpp_attribute_values",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "draft_id",
            sa.BigInteger,
            sa.ForeignKey("dpp_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "manifest_attr_id",
            sa.Integer,
            sa.ForeignKey("dpp_manifest_attrs.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "process_step_id",
            sa.Integer,
            sa.ForeignKey("process_steps.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("attribute_path", sa.String(256), nullable=False),
        sa.Column(
            "value",
            JSONB,
            nullable=False,
            server_default=sa.text("'null'::jsonb"),
        ),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("source_ref", sa.String(256), nullable=True),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="empty",
        ),  # empty | pending | complete
        sa.Column("entered_by", sa.String(256), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "draft_id",
            "manifest_attr_id",
            name="uq_attribute_values_draft_attr",
        ),
        sa.CheckConstraint(
            "source IN ('manual','iot','library','external')",
            name="ck_attribute_values_source",
        ),
        sa.CheckConstraint(
            "status IN ('empty','pending','complete')",
            name="ck_attribute_values_status",
        ),
    )
    op.create_index(
        "ix_attribute_values_draft_step",
        "dpp_attribute_values",
        ["draft_id", "process_step_id"],
    )

    # ── dpp_attribute_assignments ─────────────────────────────────────────
    op.create_table(
        "dpp_attribute_assignments",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "draft_id",
            sa.BigInteger,
            sa.ForeignKey("dpp_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "manifest_attr_id",
            sa.Integer,
            sa.ForeignKey("dpp_manifest_attrs.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("assignee_email", sa.String(256), nullable=False),
        sa.Column("assignee_name", sa.String(256), nullable=True),
        sa.Column("assignee_org", sa.String(256), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("access_token", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="pending",
        ),  # pending | accepted | submitted | revoked
        sa.Column("assigned_by", sa.String(256), nullable=False),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "draft_id",
            "manifest_attr_id",
            name="uq_assignments_draft_attr",
        ),
        sa.CheckConstraint(
            "status IN ('pending','accepted','submitted','revoked')",
            name="ck_assignments_status",
        ),
    )
    op.create_index(
        "ix_assignments_assignee_email",
        "dpp_attribute_assignments",
        ["assignee_email", "status"],
    )

    # ── iot_connections ───────────────────────────────────────────────────
    op.create_table(
        "iot_connections",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "process_step_id",
            sa.Integer,
            sa.ForeignKey("process_steps.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        # kind: mes | scada | aws_iot | mqtt | http_pull
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("endpoint", sa.String(512), nullable=True),
        sa.Column(
            "config",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "attribute_map",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),  # { attribute_path: { tag, unit, transform } }
        sa.Column(
            "status",
            sa.String(16),
            nullable=False,
            server_default="connected",
        ),  # connected | disconnected | error
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("tenant_id", "name", name="uq_iot_connections_tenant_name"),
        sa.CheckConstraint(
            "status IN ('connected','disconnected','error')",
            name="ck_iot_connections_status",
        ),
    )
    op.create_index(
        "ix_iot_connections_product_step",
        "iot_connections",
        ["product_id", "process_step_id"],
    )

    # ── dpp_publish_disclosures ───────────────────────────────────────────
    op.create_table(
        "dpp_publish_disclosures",
        sa.Column("id", sa.BigInteger, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "draft_id",
            sa.BigInteger,
            sa.ForeignKey("dpp_drafts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attribute_path", sa.String(256), nullable=False),
        # audience: public | customer | verifier | authority
        sa.Column("audience", sa.String(24), nullable=False),
        sa.Column(
            "visible",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "draft_id",
            "attribute_path",
            "audience",
            name="uq_disclosures_draft_attr_audience",
        ),
        sa.CheckConstraint(
            "audience IN ('public','customer','verifier','authority')",
            name="ck_disclosures_audience",
        ),
    )
    op.create_index(
        "ix_disclosures_draft_audience",
        "dpp_publish_disclosures",
        ["draft_id", "audience"],
    )

    # ── RLS for tenant-scoped tables ──────────────────────────────────────
    for table in (
        "dpp_drafts",
        "dpp_attribute_values",
        "dpp_attribute_assignments",
        "iot_connections",
        "dpp_publish_disclosures",
    ):
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


def downgrade() -> None:
    for table in (
        "dpp_publish_disclosures",
        "iot_connections",
        "dpp_attribute_assignments",
        "dpp_attribute_values",
        "dpp_drafts",
    ):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.drop_table(table)
