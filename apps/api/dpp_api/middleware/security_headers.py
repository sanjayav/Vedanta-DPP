"""Security-headers middleware.

Sets HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a
strict CSP that disallows inline script/style. The public viewer (web-public)
serves its own pages, but the API also surfaces /docs (in non-prod) and the
DID document; those pages still benefit from the headers.

CSP for /docs and /redoc relaxes script/style to allow Swagger UI's inline.
That branch is gated on `settings.is_production` — production bins /docs
entirely (see main.py docs_url).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..settings import get_settings

_BASE_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
_DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)
        settings = get_settings()
        # HSTS only on TLS — the proxy terminates TLS upstream and forwards
        # X-Forwarded-Proto. We trust that header behind our own ingress.
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        if proto == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains; preload",
            )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), camera=(), microphone=()"
        )
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/redoc"):
            response.headers.setdefault("Content-Security-Policy", _DOCS_CSP)
        else:
            response.headers.setdefault("Content-Security-Policy", _BASE_CSP)
        # Production hardening — also prevent FLoC and similar.
        if settings.is_production:
            response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        return response
