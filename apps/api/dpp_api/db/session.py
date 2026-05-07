"""Async SQLAlchemy session factory + FastAPI dependency.

Multi-tenancy: every request must run inside a transaction with
`SET LOCAL app.current_tenant_id = :tid` so row-level security on
tenant-scoped tables enforces isolation.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, MappedAsDataclass

from ..settings import get_settings


class Base(MappedAsDataclass, DeclarativeBase, kw_only=True):
    """Base for all ORM models — dataclass-style for ergonomic instantiation.

    `kw_only=True` is required because some columns mix defaults with
    non-defaults; without it MappedAsDataclass refuses to construct the
    dataclass at class-creation time.
    """


_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=settings.db_pool_pre_ping,
            echo=settings.db_echo,
            future=True,
        )
    return _engine


def sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=_get_engine(),
            expire_on_commit=False,
            autoflush=False,
            class_=AsyncSession,
        )
    return _sessionmaker


@asynccontextmanager
async def get_session(tenant_id: int | None = None) -> AsyncIterator[AsyncSession]:
    """Open a session, optionally bound to a tenant via RLS.

    Use this in background workers / scripts. For HTTP requests prefer
    `get_session_dependency` so tenant resolution happens via middleware.
    """
    sm = sessionmaker()
    async with sm() as session:
        if tenant_id is not None:
            # Bind value as text — the GUC accepts strings, and asyncpg's
            # parameter parser dislikes `::text` casts inside text() params.
            await session.execute(
                _set_tenant_sql(),
                {"tenant_id": str(tenant_id)},
            )
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session_dependency() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Yields an unscoped session.

    Routers should NOT use this directly — use `get_tenant_session` to bind
    the principal's tenant via RLS. Public endpoints (resolver, did) and
    health checks use this unscoped variant.
    """
    sm = sessionmaker()
    async with sm() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _make_tenant_session_dep() -> Any:
    """Build the tenant-scoped session dependency.

    Built lazily so importing `db.session` doesn't pull in auth (which would
    create a cycle: auth → db → auth). The first caller materialises the
    real dependency.
    """
    from fastapi import Depends

    from ..auth.dependencies import require_principal
    from ..auth.principal import Principal

    async def _dep(
        principal: Principal = Depends(require_principal),
    ) -> AsyncIterator[AsyncSession]:
        sm = sessionmaker()
        async with sm() as session:
            if principal.tenant_id and principal.tenant_id > 0:
                await session.execute(_set_tenant_sql(), {"tenant_id": str(principal.tenant_id)})
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    _dep.__name__ = "get_tenant_session"
    return _dep


# Module-level handle that routers can `Depends(...)` on.
get_tenant_session = _make_tenant_session_dep()


def _set_tenant_sql() -> Any:
    from sqlalchemy import text

    return text("SELECT set_config('app.current_tenant_id', :tenant_id, true)")
