"""DPP read endpoints — fetch by UPI, list/search, withdraw, QR, verify.

Auth posture per endpoint (load-bearing — read carefully before changing):

  - QR (PNG/SVG/ZPL):     unauthenticated. The QR is printed on physical
                          labels and scanned by anonymous customers.
  - GET /{upi:path}?tier=public:
                          unauthenticated. Public viewer.
  - GET /{upi:path}?tier=legitimate:
                          customer role.
  - GET /{upi:path}?tier=authority:
                          authority role only.
  - GET /{upi:path}?tier=internal:
                          tenant_auditor / tenant_admin / platform.
  - POST /verify:         unauthenticated. The "verify signature" button on
                          the public viewer is a trust feature; it must work
                          for anyone with the URL.
  - GET /:                tenant_auditor / dpp_reviewer / above.
  - POST /withdraw:       dpp_operator / tenant_admin.

Path matching: FastAPI tries routes in registration order. Specific
sub-resources (`/qr.png`, `/verify`, `/withdraw`) MUST be registered before
the catch-all `GET /{upi:path}` so the path parser doesn't swallow them.
"""

from __future__ import annotations

from datetime import UTC
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import Principal
from ..auth.dependencies import (
    require_dpp_operator,
    require_dpp_reviewer,
)
from ..db import get_session_dependency, get_tenant_session
from ..db.models import DppRecord
from ..services.dpps import AccessTier, fetch_dpp_view, list_dpps, withdraw_dpp
from ..services.qr import png_bytes, svg_bytes, zpl
from ..services.signer import verify_envelope

router = APIRouter(prefix="/dpps", tags=["dpps"])


# ── Collection endpoints ────────────────────────────────────────────────────


@router.get("/")
async def list_endpoint(
    brand: str | None = Query(default=None),
    state: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_dpp_reviewer),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    items, total = await list_dpps(session, brand=brand, state=state, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ── Per-DPP sub-resources ───────────────────────────────────────────────────
# These are registered before /{upi:path} so they win the path match.


async def _load_record(session: AsyncSession, upi: str) -> DppRecord:
    record = await session.scalar(select(DppRecord).where(DppRecord.upi == upi))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPP not found")
    return record


@router.get("/{gtin}/{cast}/{serial}/qr.png")
async def qr_png(
    gtin: str,
    cast: str,
    serial: str,
    session: AsyncSession = Depends(get_session_dependency),
) -> Response:
    record = await _load_record(session, f"{gtin}/{cast}/{serial}")
    payload = record.body["upi"]["digitalLinkUrl"]
    return Response(
        content=png_bytes(payload, box_size=10, border=2),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


@router.get("/{gtin}/{cast}/{serial}/qr.svg")
async def qr_svg(
    gtin: str,
    cast: str,
    serial: str,
    session: AsyncSession = Depends(get_session_dependency),
) -> Response:
    record = await _load_record(session, f"{gtin}/{cast}/{serial}")
    payload = record.body["upi"]["digitalLinkUrl"]
    return Response(
        content=svg_bytes(payload),
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


@router.get("/{gtin}/{cast}/{serial}/qr.zpl")
async def qr_zpl(
    gtin: str,
    cast: str,
    serial: str,
    session: AsyncSession = Depends(get_session_dependency),
) -> PlainTextResponse:
    record = await _load_record(session, f"{gtin}/{cast}/{serial}")
    payload = record.body["upi"]["digitalLinkUrl"]
    return PlainTextResponse(zpl(payload), media_type="text/x-zpl")


@router.post("/{gtin}/{cast}/{serial}/verify")
async def verify_endpoint(
    gtin: str,
    cast: str,
    serial: str,
    session: AsyncSession = Depends(get_session_dependency),
) -> dict[str, object]:
    """Cryptographically verify the DPP envelope.

    Used by the public viewer's "Verify cryptographic signature" button.
    Returns a structured result rather than raising — the UI surfaces the
    failure mode directly to the end user. Public on purpose.
    """
    record = await _load_record(session, f"{gtin}/{cast}/{serial}")
    if record.envelope is None:
        return {
            "valid": False,
            "error": "DPP has not been signed yet",
            "issuer": None,
            "bodySha256": None,
        }
    result = verify_envelope(record.envelope)
    return {
        "valid": result.valid,
        "issuer": result.issuer,
        "bodySha256": result.body_sha256,
        "error": result.error,
        "verifiedAt": _utcnow_iso(),
    }


@router.post("/{gtin}/{cast}/{serial}/withdraw")
async def withdraw_endpoint(
    gtin: str,
    cast: str,
    serial: str,
    payload: dict[str, Any],
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    upi = f"{gtin}/{cast}/{serial}"
    reason = (payload or {}).get("reason")
    if not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reason is required")
    actor = principal.email or principal.subject
    result = await withdraw_dpp(session, upi=upi, reason=reason, actor=actor)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPP not found")
    return result


# ── Catch-all GET — must be registered LAST ─────────────────────────────────


@router.get("/{upi:path}")
async def get_dpp(
    upi: str,
    tier: AccessTier = Query(default="public"),
    authorization: str | None = Header(default=None, alias="Authorization"),
    session: AsyncSession = Depends(get_session_dependency),
) -> dict[str, object]:
    """Return a DPP filtered for the requested access tier.

    Public tier is anonymous; higher tiers require a verified principal of
    the appropriate role. The optional Authorization header is read manually
    rather than via Depends so the public path stays zero-overhead.
    """
    if tier != "public":
        await _require_role_for_tier(tier, authorization)
    dpp = await fetch_dpp_view(session, upi=upi, tier=tier)
    if dpp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="DPP not found")
    return dpp


async def _require_role_for_tier(tier: AccessTier, authorization: str | None) -> Principal:
    """Verify the bearer token and check the role required by the tier.

    Mirrors `require_principal` + the role-gating dependency, but driven by
    a query param rather than a fixed Depends — needed because the public
    path on this same endpoint MUST NOT require a token.
    """
    from ..auth.jwt_verify import AuthError, verify_token

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": "missing Authorization header"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": "expected 'Bearer <token>'"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        principal = verify_token(token)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "unauthorized", "message": str(exc)},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    role_required: dict[AccessTier, frozenset[str]] = {
        "legitimate": frozenset({"customer_user", "customer_admin"}),
        "authority": frozenset({"authority"}),
        "internal": frozenset(
            {
                "dpp_operator",
                "dpp_reviewer",
                "tenant_auditor",
                "tenant_admin",
                "it_administrator",
                "platform_admin",
                "platform_support",
            }
        ),
    }
    allowed = role_required.get(tier)
    if allowed is None:  # pragma: no cover — exhausted by AccessTier
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"unknown tier: {tier!r}",
        )
    if principal.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "forbidden",
                "message": f"role '{principal.role}' cannot access tier '{tier}'",
            },
        )
    return principal


def _utcnow_iso() -> str:
    from datetime import datetime

    return datetime.now(UTC).isoformat()
