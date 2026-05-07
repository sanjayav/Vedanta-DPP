"""Webhook subscriptions.

Revision ID: 0003_webhooks
Revises: 0002_reference_data
Create Date: 2026-05-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_webhooks"
down_revision: str | None = "0002_reference_data"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "webhook_subscriptions",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("customer_org", sa.String(128), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("events", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("hmac_secret_hash", sa.String(128), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, server_default="active"),
        sa.Column("last_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("state IN ('active','paused','deleted')", name="ck_webhooks_state"),
    )
    op.create_index(
        "ix_webhooks_tenant_customer", "webhook_subscriptions", ["tenant_id", "customer_org"]
    )

    op.execute("ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE webhook_subscriptions FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY webhook_subscriptions_tenant_isolation ON webhook_subscriptions
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
    op.execute(
        "DROP POLICY IF EXISTS webhook_subscriptions_tenant_isolation ON webhook_subscriptions;"
    )
    op.execute("ALTER TABLE webhook_subscriptions DISABLE ROW LEVEL SECURITY;")
    op.drop_index("ix_webhooks_tenant_customer", table_name="webhook_subscriptions")
    op.drop_table("webhook_subscriptions")
