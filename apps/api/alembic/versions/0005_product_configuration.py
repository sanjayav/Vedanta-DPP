"""Product configuration tables — portfolio, process chains, manifests, sources.

Revision ID: 0005_product_configuration
Revises: 0004_revision_history
Create Date: 2026-05-04

This is the configuration plane that lives BEFORE data ingestion. The
six-level setup workflow described in SDD §11 lands on these tables:

  1. `products`              — tenant's product portfolio (EcoZen, CGG Jumbo, Refined Lead …)
  2. `process_steps`         — canonical reference list of process steps
                               (Mining → Concentration → Roasting → Smelting (RLE) →
                               Alloying → Casting → Lab QC → Packaging → Verification → Customer)
  3. `product_process_chains`— per-product ordered list of steps that apply
  4. `dpp_manifest_attrs`    — for each (process_step, dpp_version), the
                               attribute roster expected at that combination
  5. `product_dpp_configs`   — per-(product × dpp_version) lock state +
                               per-step attribute selections
  6. `data_sources`          — per-(product × process_step) data origin:
                               internal vs third-party, with connector config
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005_product_configuration"
down_revision = "0004_revision_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── products ──────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer,
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("brand", sa.String(64), nullable=False),
        sa.Column("alloy_family", sa.String(32), nullable=False),
        sa.Column("form", sa.String(32), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "details",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_products_tenant_slug"),
    )
    op.create_index("ix_products_tenant", "products", ["tenant_id"])

    # ── process_steps (canonical reference, not tenant-scoped) ────────────
    op.create_table(
        "process_steps",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("ordinal", sa.Integer, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "tier",
            sa.String(32),
            nullable=False,
            server_default="upstream",
        ),
    )

    # ── product_process_chains ────────────────────────────────────────────
    op.create_table(
        "product_process_chains",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "product_id",
            sa.Integer,
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "process_step_id",
            sa.Integer,
            sa.ForeignKey("process_steps.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("ordinal", sa.Integer, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.UniqueConstraint("product_id", "process_step_id", name="uq_chain_product_step"),
    )
    op.create_index("ix_chain_product", "product_process_chains", ["product_id", "ordinal"])

    # ── dpp_manifest_attrs (canonical reference) ──────────────────────────
    op.create_table(
        "dpp_manifest_attrs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "process_step_id",
            sa.Integer,
            sa.ForeignKey("process_steps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dpp_version", sa.String(8), nullable=False),
        sa.Column("attribute_path", sa.String(256), nullable=False),
        sa.Column("label", sa.String(256), nullable=False),
        sa.Column(
            "necessity",
            sa.String(16),
            nullable=False,
            server_default="mandatory",
        ),
        sa.Column("regulatory_anchor", sa.String(256), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.UniqueConstraint(
            "process_step_id",
            "dpp_version",
            "attribute_path",
            name="uq_manifest_step_version_attr",
        ),
    )
    op.create_index(
        "ix_manifest_step_version",
        "dpp_manifest_attrs",
        ["process_step_id", "dpp_version"],
    )

    # ── product_dpp_configs ───────────────────────────────────────────────
    op.create_table(
        "product_dpp_configs",
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
            nullable=False,
        ),
        sa.Column("dpp_version", sa.String(8), nullable=False),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default="draft",
        ),  # draft | locked | retired
        sa.Column(
            "selections",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "locked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("locked_by", sa.String(256), nullable=True),
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
        sa.UniqueConstraint("product_id", "dpp_version", name="uq_pdpcfg_product_version"),
    )
    op.create_index("ix_pdpcfg_tenant", "product_dpp_configs", ["tenant_id"])

    # ── data_sources ──────────────────────────────────────────────────────
    op.create_table(
        "data_sources",
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
            nullable=False,
        ),
        sa.Column(
            "process_step_id",
            sa.Integer,
            sa.ForeignKey("process_steps.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("origin", sa.String(16), nullable=False),  # internal | third_party
        sa.Column("supplier_name", sa.String(256), nullable=True),
        sa.Column("supplier_did", sa.String(256), nullable=True),
        sa.Column(
            "connector_kind", sa.String(32), nullable=True
        ),  # http_pull | api_push | sftp | manual_csv
        sa.Column(
            "connector_config",
            JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "permission_state",
            sa.String(16),
            nullable=False,
            server_default="not_requested",
        ),  # not_requested | requested | granted | denied
        sa.Column(
            "last_sync_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_sync_status",
            sa.String(16),
            nullable=True,
        ),  # success | error | pending
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("product_id", "process_step_id", name="uq_data_source_product_step"),
    )
    op.create_index("ix_data_sources_tenant", "data_sources", ["tenant_id"])

    # ── RLS for tenant-scoped tables ──────────────────────────────────────
    for table in ("products", "product_dpp_configs", "data_sources"):
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
    for table in ("data_sources", "product_dpp_configs", "products"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
    op.drop_table("data_sources")
    op.drop_table("product_dpp_configs")
    op.drop_table("dpp_manifest_attrs")
    op.drop_table("product_process_chains")
    op.drop_table("process_steps")
    op.drop_table("products")
