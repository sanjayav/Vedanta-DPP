"""FastAPI application entrypoint.

Run via:
    pnpm api:dev                    # turborepo wrapper
    uv run uvicorn dpp_api.main:app --reload

Production deploys use a process manager (systemd unit / k8s deployment) that
runs `uvicorn dpp_api.main:app` with multiple workers behind a load balancer.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from . import __version__
from .logging import configure_logging, get_logger
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.security_headers import SecurityHeadersMiddleware
from .observability import init_observability, instrument_app
from .routers import (
    admin,
    audit,
    cast_events,
    customer,
    did,
    dpps,
    drafts,
    health,
    monitoring,
    pipeline,
    plant_monitor,
    presets,
    products,
    resolver,
    verifier,
    verifier_registry,
)
from .settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Boot + shutdown hooks."""
    configure_logging()
    log = get_logger("dpp_api.lifespan")
    settings = get_settings()
    init_observability(settings)
    log.info("dpp_api.boot", version=__version__, env=settings.dpp_env)

    if not settings.is_production:
        # Idempotent dev seed — ensures the console isn't empty on first boot
        # against a fresh database (the test suite truncates everything).
        from .db.session import sessionmaker
        from .services.bootstrap import run_dev_bootstrap

        try:
            async with sessionmaker()() as session:
                await run_dev_bootstrap(session, settings)
        except Exception as exc:
            log.warning("dpp_api.bootstrap.skipped", error=str(exc))

    yield
    log.info("dpp_api.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Vedanta · Hindustan Zinc Passport Platform — API",
        version=__version__,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # Order matters — outermost middleware is added LAST. We want:
    #   request → CORS → SecurityHeaders → RateLimit → routes → response
    # so the rate-limit response also gets security headers. Starlette adds
    # outer-to-inner, so push the *first-touched* layers last.
    app.add_middleware(RateLimitMiddleware, redis_url=settings.redis_url)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*", "Authorization"],
        expose_headers=["X-Request-ID", "X-RateLimit-Remaining", "X-RateLimit-Bucket"],
    )

    # Routers — mounted under /api/v1 per SDD §7.3
    app.include_router(health.router)
    app.include_router(did.router)  # /.well-known/did.json — did:web resolution
    app.include_router(cast_events.router, prefix="/api/v1")
    app.include_router(dpps.router, prefix="/api/v1")
    app.include_router(presets.router, prefix="/api/v1")
    app.include_router(customer.router, prefix="/api/v1")
    app.include_router(verifier.router, prefix="/api/v1")
    app.include_router(verifier_registry.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.include_router(admin.router, prefix="/api/v1")
    app.include_router(pipeline.router, prefix="/api/v1")
    app.include_router(products.router, prefix="/api/v1")
    app.include_router(drafts.router, prefix="/api/v1")
    app.include_router(monitoring.router, prefix="/api/v1")
    app.include_router(plant_monitor.router, prefix="/api/v1")
    app.include_router(resolver.router)  # No /api prefix — public Digital Link resolver

    instrument_app(app, settings)
    return app


app = create_app()


def run() -> None:
    """Entrypoint for `dpp-api` console script."""
    import uvicorn

    uvicorn.run("dpp_api.main:app", host="0.0.0.0", port=8000, reload=False)
