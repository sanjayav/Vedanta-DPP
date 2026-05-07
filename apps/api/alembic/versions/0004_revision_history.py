"""Add revision tracking to dpp_records.

Revision ID: 0004_revision_history
Revises: 0003_webhooks
Create Date: 2026-05-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_revision_history"
down_revision: str | None = "0003_webhooks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dpp_records",
        sa.Column("revision_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "dpp_records",
        sa.Column(
            "revision_history",
            postgresql.JSONB(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("dpp_records", "revision_history")
    op.drop_column("dpp_records", "revision_count")
