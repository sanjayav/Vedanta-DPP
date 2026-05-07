"""Reference data — CFP and compliance certificate registries.

Revision ID: 0002_reference_data
Revises: 0001_initial
Create Date: 2026-05-04
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_reference_data"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reference_cfp",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("brand", sa.String(32), nullable=False),
        sa.Column("facility_ufi", sa.String(13), nullable=True),
        sa.Column("period_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_to", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value_kg_co2e_per_tonne", sa.Float(), nullable=False),
        sa.Column("industry_average", sa.Float(), nullable=True),
        sa.Column(
            "methodology",
            sa.String(256),
            nullable=False,
            server_default="ISO 14067:2018 + IAI v2.0 + PCR 2022:08 v1.0",
        ),
        sa.Column("verifier_did", sa.String(512), nullable=False),
        sa.Column("verifier_name", sa.String(256), nullable=False),
        sa.Column("statement_ref", sa.String(256), nullable=False),
        sa.Column("assurance_level", sa.String(16), nullable=False, server_default="limited"),
        sa.Column("decomposition", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("state", sa.String(16), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "assurance_level IN ('limited','reasonable','self_declared')",
            name="ck_reference_cfp_assurance",
        ),
        sa.CheckConstraint(
            "state IN ('active','superseded','revoked')", name="ck_reference_cfp_state"
        ),
    )
    op.create_index(
        "ix_reference_cfp_lookup",
        "reference_cfp",
        ["tenant_id", "brand", "state", "period_to"],
    )

    op.create_table(
        "reference_compliance",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("reference", sa.String(256), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="compliant"),
        sa.Column("issuer", sa.String(256), nullable=True),
        sa.Column("certificate_ref", sa.String(256), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("category", sa.String(16), nullable=False, server_default="regulation"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "status IN ('compliant','non_compliant','n_a','pending')",
            name="ck_reference_compliance_status",
        ),
        sa.CheckConstraint(
            "category IN ('regulation','certification')",
            name="ck_reference_compliance_category",
        ),
    )
    op.create_index(
        "ix_reference_compliance_lookup",
        "reference_compliance",
        ["tenant_id", "category", "name"],
    )

    # RLS — tenant-scoped reference tables.
    for table in ("reference_cfp", "reference_compliance"):
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

    # Seed from the canonical presets.
    _seed_from_presets()


def downgrade() -> None:
    for table in ("reference_cfp", "reference_compliance"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    op.drop_index("ix_reference_compliance_lookup", table_name="reference_compliance")
    op.drop_table("reference_compliance")
    op.drop_index("ix_reference_cfp_lookup", table_name="reference_cfp")
    op.drop_table("reference_cfp")


# ── Seed helpers ─────────────────────────────────────────────────────────────


def _seed_from_presets() -> None:
    """Insert one CFP row per preset and the HZL-aligned minimum compliance set.

    The HZL (zinc/lead/silver) preset shape carries six EF 3.1 LCIA categories
    inside `sustainability.pcf` and a producing-site tag instead of the
    legacy v0 `brand` + `casthouseUfi` columns. We seed `reference_cfp` from
    `sustainability.pcf` so the existing CFP override path keeps working
    while the generator transitions to consuming the preset directly.
    """
    presets_dir = _find_presets_dir()
    if presets_dir is None:
        return  # CI / fresh-install scenarios where the schema package isn't on disk

    cfp_rows: list[dict[str, object]] = []
    seen: set[str] = set()
    for path in sorted(presets_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as fh:
            preset = json.load(fh)

        grade = preset.get("gradeCode")
        sustain = preset.get("sustainability") or {}
        pcf = sustain.get("pcf") or {}
        if grade is None or not pcf:
            continue
        if grade in seen:
            continue
        seen.add(grade)

        # Convert the per-kg PCF to per-tonne to match the reference_cfp
        # historical column. Industry average likewise.
        value_per_tonne = float(pcf.get("value", 0.0)) * 1000.0
        industry_avg = pcf.get("industryAverage") or {}
        industry_avg_per_tonne = float(industry_avg.get("value", 0.0)) * 1000.0

        period = pcf.get("reportingPeriod") or {
            "from": f"{pcf.get('referenceYear', 2024)}-01-01",
            "to": f"{pcf.get('referenceYear', 2024)}-12-31",
        }
        verifier = pcf.get("verifier") or {
            "did": "did:web:passport.hzlindia.com:internal-verifier",
            "name": "HZL Internal Verification",
        }

        cfp_rows.append(
            {
                "tenant_id": 1,
                "brand": grade,
                "facility_ufi": preset.get("producingSiteTag", "CHA"),
                "period_from": datetime.fromisoformat(period["from"]).replace(tzinfo=UTC),
                "period_to": datetime.fromisoformat(period["to"]).replace(tzinfo=UTC),
                "value_kg_co2e_per_tonne": value_per_tonne,
                "industry_average": industry_avg_per_tonne,
                "verifier_did": verifier["did"],
                "verifier_name": verifier["name"],
                "statement_ref": pcf.get(
                    "verificationStatementRef",
                    f"HZL-{grade.upper()}-{pcf.get('referenceYear', 2024)}",
                ),
                "assurance_level": pcf.get("assuranceLevel", "self_declared"),
                "decomposition": json.dumps(sustain.get("pcfBreakdown") or {}),
            }
        )

    if cfp_rows:
        bind = op.get_bind()
        bind.execute(
            sa.text(
                """
                INSERT INTO reference_cfp (
                    tenant_id, brand, facility_ufi,
                    period_from, period_to,
                    value_kg_co2e_per_tonne, industry_average,
                    verifier_did, verifier_name, statement_ref,
                    assurance_level, decomposition
                ) VALUES (
                    :tenant_id, :brand, :facility_ufi,
                    :period_from, :period_to,
                    :value_kg_co2e_per_tonne, :industry_average,
                    :verifier_did, :verifier_name, :statement_ref,
                    :assurance_level, CAST(:decomposition AS jsonb)
                )
                """
            ),
            cfp_rows,
        )

    # HZL-aligned minimum compliance set (IZA / ILA / BIS / ICMM / EPD).
    compliance_rows = [
        ("REACH", "EC 1907/2006", "regulation", "ECHA", None),
        ("RoHS 2 / ELV", "2011/65/EU", "regulation", "EU", None),
        ("CBAM declaration", "(EU) 2023/956", "regulation", "EU Commission", None),
        ("BIS — Refined Zinc", "IS 209:1992", "regulation", "Bureau of Indian Standards", None),
        ("BIS — Pig Lead", "IS 27:2023", "regulation", "Bureau of Indian Standards", None),
        ("ISO 9001", "ISO 9001:2015", "certification", "Notified body", None),
        ("ISO 14001", "ISO 14001:2015", "certification", "Notified body", None),
        ("ISO 45001", "ISO 45001:2018", "certification", "Notified body", None),
        ("ISO 50001", "ISO 50001:2018", "certification", "Notified body", None),
        (
            "EPD International — Zinc",
            "EPD-IES-0006472:001",
            "certification",
            "International EPD System",
            "EPD-IES-0006472:001",
        ),
        ("ICMM Mining Principles", "ICMM 2025", "certification", "ICMM", None),
    ]
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO reference_compliance
                (tenant_id, name, reference, category, issuer, certificate_ref)
            VALUES (1, :name, :reference, :category, :issuer, :certificate_ref)
            """
        ),
        [
            {
                "name": n,
                "reference": r,
                "category": c,
                "issuer": i,
                "certificate_ref": cr,
            }
            for (n, r, c, i, cr) in compliance_rows
        ],
    )


def _find_presets_dir() -> Path | None:
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "packages" / "schema" / "presets"
        if candidate.is_dir():
            return candidate
    return None
