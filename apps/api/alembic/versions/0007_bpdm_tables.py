"""BPDM tables — legal entities, sites, addresses, identifiers.

Revision ID: 0007_bpdm_tables
Revises: 0006_passport_drafts
Create Date: 2026-05-07

Implements the data model from Chem-X Business Identity / BPDM Guideline v1.0:

  legal_entities             — Producer legal persons (BPNL keyed)
  sites                      — Producing / warehouse / depot locations (BPNS keyed)
  addresses                  — Physical postal addresses (BPNA keyed)
  legal_entity_identifiers   — VAT/TIN/NBR/IBR/OTH identifiers per CX-0010 §13/§14

All four tables are tenant-scoped with FORCE ROW LEVEL SECURITY (CLAUDE.md
hard rule #3). The CX-0010 BPN values themselves are globally unique across
the data space; in this PoC the platform is its own trusted issuer.

References
----------
* Chem-X Business Identity / BPDM Guideline v1.0, sections 11–22
* Catena-X CX-0010 v2.1.0 (Business Partner Number)
* Catena-X CX-0012 v4.1.0 (BPDM Data Pool API)
* ISO/IEC 6523-1:2023, ISO/IEC 7064:2003, ISO 20275:2017 (legal forms),
  ISO 17442 (LEI)
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_bpdm_tables"
down_revision = "0006_passport_drafts"
branch_labels = None
depends_on = None


# ── BPN syntax constraint reused on all three BP* tables ──────────────────
_BPN_CHECK = "{col} ~ '^BPN[LSA][A-Z0-9]{{10}}[A-Z0-9]{{2}}$'"


def upgrade() -> None:
    # ── legal_entities ─────────────────────────────────────────────────────
    op.create_table(
        "legal_entities",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bpnl", sa.String(16), nullable=False),
        sa.Column("legal_name", sa.String(512), nullable=False),
        sa.Column("legal_form", sa.String(128), nullable=True),
        sa.Column("short_name", sa.String(128), nullable=True),
        sa.Column("trade_name", sa.String(256), nullable=True),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("subdivision", sa.String(8), nullable=True),
        sa.Column(
            "registered_address_bpna",
            sa.String(16),
            nullable=True,
            comment="FK to addresses.bpna, nullable for bootstrap insert order",
        ),
        sa.Column(
            "did",
            sa.String(512),
            nullable=True,
            comment="did:web of this legal entity (Chem-X Material ID Guideline §5.4)",
        ),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default="active",
            comment="active | inactive per Chem-X §15 (legal_entity_state)",
        ),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_until", sa.Date(), nullable=True),
        sa.Column(
            "incorporated_on",
            sa.Date(),
            nullable=True,
            comment="Date of original legal incorporation",
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
            comment="Free-form fields (e.g. promoter stake, ICMM membership)",
        ),
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
        sa.UniqueConstraint("bpnl", name="uq_legal_entities_bpnl"),
        sa.UniqueConstraint("tenant_id", "legal_name", name="uq_legal_entities_tenant_name"),
        sa.CheckConstraint(_BPN_CHECK.format(col="bpnl"), name="ck_legal_entities_bpnl_syntax"),
        sa.CheckConstraint("country ~ '^[A-Z]{2}$'", name="ck_legal_entities_country_iso"),
        sa.CheckConstraint("state IN ('active','inactive')", name="ck_legal_entities_state"),
    )
    op.create_index("ix_legal_entities_tenant", "legal_entities", ["tenant_id"])

    # ── addresses ──────────────────────────────────────────────────────────
    op.create_table(
        "addresses",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bpna", sa.String(16), nullable=False),
        sa.Column(
            "owner_bpnl",
            sa.String(16),
            nullable=False,
            comment="Owning legal entity (CX-0010: every address has one owner)",
        ),
        sa.Column("name", sa.String(256), nullable=True),
        sa.Column(
            "address_type",
            sa.String(32),
            nullable=False,
            comment="legal_address | site_main_address | legal_and_site_main_address | additional_address",  # noqa: E501
        ),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("subdivision", sa.String(8), nullable=True, comment="ISO 3166-2"),
        sa.Column("admin_area_level_2", sa.String(128), nullable=True, comment="District / county"),
        sa.Column("city", sa.String(128), nullable=False),
        sa.Column("postal_code", sa.String(32), nullable=True),
        sa.Column("street", sa.String(256), nullable=True),
        sa.Column("house_number", sa.String(32), nullable=True),
        sa.Column("address_line2", sa.String(256), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default="active",
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
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
        sa.UniqueConstraint("bpna", name="uq_addresses_bpna"),
        sa.CheckConstraint(_BPN_CHECK.format(col="bpna"), name="ck_addresses_bpna_syntax"),
        sa.CheckConstraint(
            _BPN_CHECK.format(col="owner_bpnl"), name="ck_addresses_owner_bpnl_syntax"
        ),
        sa.CheckConstraint("country ~ '^[A-Z]{2}$'", name="ck_addresses_country_iso"),
        sa.CheckConstraint(
            "address_type IN ("
            "'legal_address','site_main_address',"
            "'legal_and_site_main_address','additional_address')",
            name="ck_addresses_type",
        ),
        sa.CheckConstraint("state IN ('active','inactive')", name="ck_addresses_state"),
    )
    op.create_index("ix_addresses_tenant", "addresses", ["tenant_id"])
    op.create_index("ix_addresses_owner_bpnl", "addresses", ["owner_bpnl"])

    # Now add the FK from legal_entities.registered_address_bpna → addresses.bpna
    op.create_foreign_key(
        "fk_legal_entities_registered_address",
        "legal_entities",
        "addresses",
        ["registered_address_bpna"],
        ["bpna"],
        ondelete="RESTRICT",
    )

    # ── sites ──────────────────────────────────────────────────────────────
    op.create_table(
        "sites",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bpns", sa.String(16), nullable=False),
        sa.Column(
            "owner_bpnl",
            sa.String(16),
            nullable=False,
            comment="Owning legal entity. Per CX-0010 each site has exactly one owner.",
        ),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column(
            "function",
            sa.String(32),
            nullable=False,
            comment="mine|concentrator|smelter_*|refinery|casthouse|rolling_mill|powder_atomiser|warehouse|depot",
        ),
        sa.Column(
            "main_address_bpna",
            sa.String(16),
            sa.ForeignKey("addresses.bpna", ondelete="RESTRICT"),
            nullable=False,
            comment="Main (postal) address of the site.",
        ),
        sa.Column(
            "production_capacity",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
            comment="e.g. {'metal':'zinc','tpa':585000} or {'metal':'silver','tpa':800}",
        ),
        sa.Column(
            "state",
            sa.String(16),
            nullable=False,
            server_default="active",
        ),
        sa.Column("commissioned_on", sa.Date(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
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
        sa.UniqueConstraint("bpns", name="uq_sites_bpns"),
        sa.CheckConstraint(_BPN_CHECK.format(col="bpns"), name="ck_sites_bpns_syntax"),
        sa.CheckConstraint(_BPN_CHECK.format(col="owner_bpnl"), name="ck_sites_owner_bpnl_syntax"),
        sa.CheckConstraint(
            "function IN ("
            "'mine','concentrator','smelter_hydro','smelter_pyro',"
            "'refinery','casthouse','rolling_mill','powder_atomiser',"
            "'warehouse','depot')",
            name="ck_sites_function",
        ),
        sa.CheckConstraint("state IN ('active','inactive')", name="ck_sites_state"),
    )
    op.create_index("ix_sites_tenant", "sites", ["tenant_id"])
    op.create_index("ix_sites_owner_bpnl", "sites", ["owner_bpnl"])

    # ── legal_entity_identifiers ──────────────────────────────────────────
    op.create_table(
        "legal_entity_identifiers",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "bpnl",
            sa.String(16),
            sa.ForeignKey("legal_entities.bpnl", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(8),
            nullable=False,
            comment="VAT | TIN | NBR | IBR | OTH per Chem-X §14",
        ),
        sa.Column(
            "type",
            sa.String(64),
            nullable=False,
            comment="Specific type, e.g. GSTIN, PAN, CIN, LEI, EORI, DUNS, GS1_GLN",
        ),
        sa.Column("value", sa.String(128), nullable=False),
        sa.Column("issuing_country", sa.String(2), nullable=True),
        sa.Column("issuing_body", sa.String(128), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("bpnl", "type", "value", name="uq_legal_entity_identifiers_unique"),
        sa.CheckConstraint(
            "category IN ('VAT','TIN','NBR','IBR','OTH')",
            name="ck_legal_entity_identifiers_category",
        ),
    )
    op.create_index("ix_legal_entity_identifiers_tenant", "legal_entity_identifiers", ["tenant_id"])
    op.create_index("ix_legal_entity_identifiers_bpnl", "legal_entity_identifiers", ["bpnl"])

    # ── Row-level security ────────────────────────────────────────────────
    for table in ("legal_entities", "addresses", "sites", "legal_entity_identifiers"):
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
    for table in ("legal_entity_identifiers", "sites", "addresses", "legal_entities"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")

    op.drop_index("ix_legal_entity_identifiers_bpnl", table_name="legal_entity_identifiers")
    op.drop_index("ix_legal_entity_identifiers_tenant", table_name="legal_entity_identifiers")
    op.drop_table("legal_entity_identifiers")

    op.drop_index("ix_sites_owner_bpnl", table_name="sites")
    op.drop_index("ix_sites_tenant", table_name="sites")
    op.drop_table("sites")

    op.drop_constraint("fk_legal_entities_registered_address", "legal_entities", type_="foreignkey")
    op.drop_index("ix_addresses_owner_bpnl", table_name="addresses")
    op.drop_index("ix_addresses_tenant", table_name="addresses")
    op.drop_table("addresses")

    op.drop_index("ix_legal_entities_tenant", table_name="legal_entities")
    op.drop_table("legal_entities")
