"""Observability bootstrap — Sentry + OpenTelemetry.

Both are optional and disabled by default; production deploys flip them on
via env. Failures here are non-fatal: a missing OTel collector should not
crash the API.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .settings import Settings

if TYPE_CHECKING:
    from fastapi import FastAPI

log = logging.getLogger(__name__)


def init_observability(settings: Settings) -> None:
    """Initialise Sentry + OTel exporters early in the boot path.

    Idempotent — calling twice is fine; both libs guard against repeat init.
    """
    _init_sentry(settings)
    _init_otel(settings)


def instrument_app(app: FastAPI, settings: Settings) -> None:
    """Attach FastAPI instrumentation. Called after middleware is registered."""
    if settings.dpp_otel_exporter_otlp_endpoint is None:
        return
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument()
    except Exception as exc:
        log.warning("observability.instrumentation_failed", extra={"error": str(exc)})


def _init_sentry(settings: Settings) -> None:
    if settings.dpp_sentry_dsn is None:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.dpp_sentry_dsn.get_secret_value(),
            environment=settings.dpp_sentry_environment or settings.dpp_env,
            traces_sample_rate=settings.dpp_sentry_traces_sample_rate,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            send_default_pii=False,
        )
    except Exception as exc:
        log.warning("observability.sentry_init_failed", extra={"error": str(exc)})


def _init_otel(settings: Settings) -> None:
    if settings.dpp_otel_exporter_otlp_endpoint is None:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create(
            {
                "service.name": settings.dpp_otel_service_name,
                "service.version": "1.0.0",
                "deployment.environment": settings.dpp_env,
            }
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.dpp_otel_exporter_otlp_endpoint))
        )
        trace.set_tracer_provider(provider)
    except Exception as exc:
        log.warning("observability.otel_init_failed", extra={"error": str(exc)})
