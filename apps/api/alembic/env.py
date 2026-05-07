"""Alembic env — uses the synchronous psycopg URL since Alembic itself is sync.

DDL is run as the schema owner (`dpp` locally), not the runtime application
role (`dpp_app`). The owner connection is read from DATABASE_URL_SYNC_ADMIN
when present, falling back to DATABASE_URL_SYNC for environments where the
runtime user already owns the schema.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from dpp_api.db.models import Base  # noqa: F401  (registers metadata)
from dpp_api.db.session import Base as ModelsBase
from dpp_api.settings import get_settings
from sqlalchemy import engine_from_config, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
admin_url = os.environ.get("DATABASE_URL_SYNC_ADMIN", settings.database_url_sync)
config.set_main_option("sqlalchemy.url", admin_url)

target_metadata = ModelsBase.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=admin_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
