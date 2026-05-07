"""Shared pytest fixtures.

The integration tests run against a real Postgres — see ADR 0003 (RLS makes
mocked SQLAlchemy unsafe; the integration story is the test). Tests open a
transaction at the start of each test and roll it back at the end so they
don't pollute each other.

Environment requirements:
    DATABASE_URL=postgresql+asyncpg://dpp_app:dpp_local_dev_only@localhost:5432/dpp_test

Run `pytest --skip-db` to skip integration tests if a Postgres isn't available.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


@pytest_asyncio.fixture(autouse=True)
async def _reset_runtime_engine() -> AsyncIterator[None]:
    """Drop the module-cached API engine between tests.

    The engine in `dpp_api.db.session` is a module global; once a test calls
    `create_app()` and issues a request, the engine binds to that test's event
    loop. The next test gets a fresh loop and the cached connections error
    with `Event loop is closed` on cleanup. Disposing per-test prevents this.
    """
    yield
    from dpp_api.db import session as _session

    if _session._engine is not None:
        try:
            await _session._engine.dispose()
        finally:
            _session._engine = None
            _session._sessionmaker = None


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--skip-db", action="store_true", default=False, help="skip tests that need Postgres"
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if not config.getoption("--skip-db"):
        return
    skip_marker = pytest.mark.skip(reason="--skip-db passed")
    for item in items:
        if "db_session" in getattr(item, "fixturenames", ()):
            item.add_marker(skip_marker)


_TEST_JWT_SECRET = "test-jwt-secret-not-for-production-use"
_TEST_JWT_ISSUER = "https://idp.dpp.test"
_TEST_JWT_AUDIENCE = "dpp-api"


@pytest.fixture(scope="session", autouse=True)
def _isolate_dev_keys() -> AsyncIterator[None]:
    """Redirect signer key paths to a temp dir so tests never touch dev keys.

    Also pins JWT verification to an HS256 dev secret so HTTP tests can mint
    tokens locally. The settings layer rejects this combination in production
    via a model validator.
    """
    tmp = tempfile.TemporaryDirectory()
    sk = Path(tmp.name) / "issuer-ed25519.pem"
    pk = Path(tmp.name) / "issuer-ed25519.pub.pem"
    os.environ["DPP_ISSUER_KEY_PATH"] = str(sk)
    os.environ["DPP_ISSUER_PUBLIC_KEY_PATH"] = str(pk)
    # Pin a deterministic test issuer DID and resolver base.
    os.environ["DPP_ISSUER_DID"] = "did:web:dpp.test"
    os.environ["DPP_RESOLVER_BASE_URL"] = "http://localhost:3000"
    # JWT auth (HS256 dev mode).
    os.environ["DPP_ENV"] = "development"
    os.environ["DPP_JWT_DEV_SECRET"] = _TEST_JWT_SECRET
    os.environ["DPP_JWT_ISSUER"] = _TEST_JWT_ISSUER
    os.environ["DPP_JWT_AUDIENCE"] = _TEST_JWT_AUDIENCE
    # Reset cached settings + keystore (signer) provider.
    from dpp_api.services.keystore import reset_key_provider_cache
    from dpp_api.settings import get_settings

    get_settings.cache_clear()
    reset_key_provider_cache()
    try:
        yield
    finally:
        tmp.cleanup()
        get_settings.cache_clear()
        reset_key_provider_cache()


@pytest.fixture
def mint_token() -> MintTokenFn:
    """Return a callable that issues a fresh JWT with the requested claims."""
    import time

    import jwt

    def _mint(
        *,
        role: str = "dpp_operator",
        tenant_id: int = 1,
        subject: str = "u-test",
        did: str | None = None,
        organization: str | None = None,
        email: str | None = None,
        ttl_seconds: int = 600,
    ) -> str:
        now = int(time.time())
        claims: dict[str, object] = {
            "iss": _TEST_JWT_ISSUER,
            "aud": _TEST_JWT_AUDIENCE,
            "sub": subject,
            "iat": now,
            "exp": now + ttl_seconds,
            "role": role,
            "tnt": tenant_id,
        }
        if did is not None:
            claims["did"] = did
        if organization is not None:
            claims["org"] = organization
        if email is not None:
            claims["email"] = email
        return jwt.encode(claims, _TEST_JWT_SECRET, algorithm="HS256")

    return _mint


# Type alias used to keep the fixture signature readable.
from typing import Protocol  # noqa: E402


class MintTokenFn(Protocol):
    def __call__(
        self,
        *,
        role: str = ...,
        tenant_id: int = ...,
        subject: str = ...,
        did: str | None = ...,
        organization: str | None = ...,
        email: str | None = ...,
        ttl_seconds: int = ...,
    ) -> str: ...


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    """Yield an AsyncSession bound to a freshly-truncated, migration-applied schema.

    We DO NOT use `Base.metadata.create_all` because RLS policies live in
    Alembic migrations and would be silently absent if we recreated tables
    via the ORM (CLAUDE.md hard rule #3 — tests must verify isolation).

    Strategy:
      1. Apply migrations once per process (idempotent — the marker table
         records the head revision).
      2. Truncate every tenant-scoped table between tests + reseed tenants
         with `session_replication_role = 'replica'` so RLS / triggers don't
         block the truncate.
      3. Yield a tenant-bound session.
    """
    url = os.environ.get(
        "DATABASE_URL_TEST",
        "postgresql+asyncpg://dpp_app:dpp_local_dev_only@localhost:5432/dpp",
    )
    # The truncate-and-reseed phase needs SUPERUSER (it toggles
    # session_replication_role to bypass RLS / triggers); the test session must
    # connect as the non-superuser app role so RLS actually fires. Two engines.
    admin_url = os.environ.get(
        "DATABASE_URL_TEST_ADMIN",
        url.replace("dpp_app:", "dpp:", 1),
    )
    engine = create_async_engine(url, future=True, pool_pre_ping=True)
    admin_engine = create_async_engine(admin_url, future=True, pool_pre_ping=True)
    sessionmaker = async_sessionmaker(bind=engine, expire_on_commit=False)

    await _ensure_migrations_applied()

    async with admin_engine.begin() as conn:
        # Wipe data without dropping the schema. session_replication_role=replica
        # bypasses RLS for the truncate itself.
        await conn.execute(text("SET session_replication_role = 'replica'"))
        await conn.execute(
            text(
                "TRUNCATE TABLE "
                "audit_log, dpp_records, cast_events, "
                "reference_cfp, webhook_subscriptions, tenants "
                "RESTART IDENTITY CASCADE"
            )
        )
        await conn.execute(text("SET session_replication_role = 'origin'"))
        # Seed the EGA tenant.
        await conn.execute(
            text(
                """
                INSERT INTO tenants (id, slug, legal_name, status, tier, branding, created_at)
                VALUES (1, 'ega', 'Emirates Global Aluminium PJSC', 'active', 'production', '{}', now())
                """
            )
        )
        await conn.execute(
            text(
                "SELECT setval(pg_get_serial_sequence('tenants','id'), GREATEST(1, "
                "(SELECT max(id) FROM tenants)))"
            )
        )
    await admin_engine.dispose()

    async with sessionmaker() as session:
        # Bind tenant_id=1 by default — tests that need cross-tenant access
        # call session.execute(set_config(...)) explicitly.
        await session.execute(text("SELECT set_config('app.current_tenant_id', '1', true)"))
        try:
            yield session
        finally:
            await session.rollback()
    await engine.dispose()


async def _ensure_migrations_applied() -> None:
    """Run `alembic upgrade head` once per process; cheap if already at head."""
    if getattr(_ensure_migrations_applied, "_done", False):
        return
    import asyncio

    proc = await asyncio.create_subprocess_exec(
        "alembic",
        "upgrade",
        "head",
        cwd=str(Path(__file__).resolve().parents[1]),  # apps/api  # noqa: ASYNC240
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"alembic upgrade head failed: rc={proc.returncode}\n"
            f"stdout={out.decode()}\nstderr={err.decode()}"
        )
    _ensure_migrations_applied._done = True  # type: ignore[attr-defined]
