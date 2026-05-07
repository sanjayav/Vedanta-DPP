"""Redis-backed token-bucket rate limiter.

Two buckets per request:
  - Authenticated:  keyed on `principal.tenant_id` (high ceiling).
  - Anonymous:      keyed on the client IP (low ceiling — protects the public
                    viewer & QR scanners from abuse).

A single Lua script does atomic capacity-check + decrement on Redis so two
concurrent requests can't both observe sufficient capacity. Standard token-
bucket: `capacity` tokens, `rate_per_minute` refill.

When Redis is unreachable we fail OPEN (log + allow) — denying legitimate
traffic on infra failure is worse than briefly-elevated request volume.
A future hardening pass swaps this to fail-closed once Redis HA + sentinel
is in place.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

import redis.asyncio as aioredis
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from redis.exceptions import NoScriptError
from starlette.middleware.base import BaseHTTPMiddleware

from ..auth.jwt_verify import AuthError, verify_token
from ..settings import get_settings

log = logging.getLogger(__name__)

# Lua script: atomic token bucket. KEYS[1] = bucket key, ARGV = (capacity,
# refill_per_sec, now_ms). Returns (remaining, retry_after_ms).
_TOKEN_BUCKET_LUA = """
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])  -- tokens per second
local now_ms = tonumber(ARGV[3])
local raw = redis.call('HMGET', KEYS[1], 'tokens', 'last_ms')
local tokens = tonumber(raw[1])
local last_ms = tonumber(raw[2])
if tokens == nil then
  tokens = capacity
  last_ms = now_ms
end
local elapsed = math.max(0, now_ms - last_ms) / 1000.0
tokens = math.min(capacity, tokens + elapsed * refill_rate)
local allowed = 0
local retry_after_ms = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry_after_ms = math.ceil((1 - tokens) / refill_rate * 1000)
end
redis.call('HMSET', KEYS[1], 'tokens', tostring(tokens), 'last_ms', tostring(now_ms))
-- Auto-expire idle buckets (10x window) so the keyspace stays bounded.
redis.call('PEXPIRE', KEYS[1], math.floor(capacity / refill_rate * 10000) + 60000)
return {allowed, math.floor(tokens), retry_after_ms}
"""


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket per-tenant / per-IP."""

    def __init__(self, app, redis_url: str) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self._redis_url = redis_url
        self._redis: aioredis.Redis | None = None
        self._script_sha: str | None = None

    async def _get_redis(self) -> aioredis.Redis | None:
        if self._redis is not None:
            return self._redis
        try:
            client = aioredis.from_url(self._redis_url, decode_responses=True)
            await client.ping()  # type: ignore[misc]
            self._redis = client
            self._script_sha = await client.script_load(_TOKEN_BUCKET_LUA)
            return client
        except Exception as exc:
            log.warning("rate_limit.redis_unavailable", extra={"error": str(exc)})
            return None

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        settings = get_settings()
        if not settings.dpp_rate_limit_enabled:
            return await call_next(request)
        # Cheap allowlist for unauthenticated public surfaces that have their
        # own caching (QR endpoints + public DPP path), and infra probes.
        if request.url.path.startswith("/healthz") or request.url.path.startswith("/.well-known/"):
            return await call_next(request)

        bucket_key, capacity, rate_per_minute = self._resolve_bucket(request, settings)
        redis = await self._get_redis()
        if redis is None or self._script_sha is None:
            # Fail open — see module docstring.
            return await call_next(request)

        try:
            result = await redis.evalsha(  # type: ignore[misc]
                self._script_sha,
                1,
                bucket_key,
                str(capacity),
                str(rate_per_minute / 60.0),
                str(int(time.time() * 1000)),
            )
        except NoScriptError:
            self._script_sha = await redis.script_load(_TOKEN_BUCKET_LUA)
            result = await redis.evalsha(  # type: ignore[misc]
                self._script_sha,
                1,
                bucket_key,
                str(capacity),
                str(rate_per_minute / 60.0),
                str(int(time.time() * 1000)),
            )
        except Exception as exc:
            log.warning("rate_limit.redis_error", extra={"error": str(exc)})
            return await call_next(request)

        allowed, remaining, retry_after_ms = int(result[0]), int(result[1]), int(result[2])
        if not allowed:
            retry_after_s = max(1, (retry_after_ms + 999) // 1000)
            return JSONResponse(
                status_code=429,
                content={
                    "code": "rate_limited",
                    "message": "rate limit exceeded",
                    "retryAfterSeconds": retry_after_s,
                },
                headers={
                    "Retry-After": str(retry_after_s),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Bucket": bucket_key,
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Bucket"] = bucket_key
        return response

    def _resolve_bucket(self, request: Request, settings) -> tuple[str, int, int]:  # type: ignore[no-untyped-def]
        """Try to identify the principal (without raising) and pick the bucket.

        We optimistically peek at the Authorization header; if it parses
        cleanly we use the per-tenant bucket, otherwise the anon (IP) bucket.
        """
        authz = request.headers.get("authorization")
        if authz and authz.lower().startswith("bearer "):
            token = authz.split(" ", 1)[1]
            try:
                principal = verify_token(token)
                return (
                    f"rl:tenant:{principal.tenant_id}:{principal.subject}",
                    settings.dpp_rate_limit_burst,
                    settings.dpp_rate_limit_per_minute,
                )
            except AuthError:
                pass  # fall through to anon
        client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        return (
            f"rl:anon:{client_ip}",
            settings.dpp_rate_limit_anon_burst,
            settings.dpp_rate_limit_anon_per_minute,
        )
