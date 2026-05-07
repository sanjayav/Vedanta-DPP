"""FastAPI dependencies — derive a `Principal` from the request, gate by role.

Routers express their auth requirements declaratively:

    @router.get("/things")
    async def list_things(p: Principal = Depends(require_tenant_auditor)):
        ...

Every dependency below ultimately calls `require_principal`, which:
  1. Pulls the bearer token from the `Authorization: Bearer …` header.
  2. Verifies via the configured path (JWKS in prod, HS256 dev).
  3. Returns a typed `Principal`.

Role/scope checks fail closed with HTTP 403 and a stable error code so the
console can map them to a "Permission denied" UI without parsing prose.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from fastapi import Header, HTTPException, status
from fastapi.security.utils import get_authorization_scheme_param

from .jwt_verify import AuthError, verify_token
from .principal import Principal, Role, Scope

_BEARER = "bearer"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthorized", "message": detail},
        headers={"WWW-Authenticate": "Bearer"},
    )


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "forbidden", "message": detail},
    )


async def require_principal(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> Principal:
    """Return the verified `Principal`, or raise 401."""
    if not authorization:
        raise _unauthorized("missing Authorization header")
    scheme, token = get_authorization_scheme_param(authorization)
    if not scheme or scheme.lower() != _BEARER or not token:
        raise _unauthorized("expected 'Authorization: Bearer <token>'")
    try:
        return verify_token(token)
    except AuthError as exc:
        raise _unauthorized(str(exc)) from exc


def require_role(*roles: Role) -> Callable[..., Any]:
    allowed = frozenset(roles)

    async def _dep(principal: Principal = None) -> Principal:  # type: ignore[assignment]
        # The default value is replaced by FastAPI via Depends; this is a guard
        # against accidental direct calls.
        if principal is None:  # pragma: no cover — defensive
            raise _unauthorized("auth not resolved")
        if principal.role not in allowed:
            raise _forbidden(f"role '{principal.role}' not in {sorted(allowed)}")
        return principal

    # Wire the inner Principal through Depends(require_principal). We do this
    # by attaching __dpp_role_check__ — see `_role_dep_factory` below.
    return _role_dep_factory(allowed)


def _role_dep_factory(allowed: frozenset[Role]) -> Callable[..., Any]:
    """Build a FastAPI-compatible dependency that requires one of `allowed`."""
    from fastapi import Depends

    async def _dep(principal: Principal = Depends(require_principal)) -> Principal:
        if principal.role not in allowed:
            raise _forbidden(f"role '{principal.role}' not in {sorted(allowed)}")
        return principal

    _dep.__name__ = f"require_role_{'_'.join(sorted(allowed))}"
    return _dep


def require_scope(*scopes: Scope) -> Callable[..., Any]:
    needed = frozenset(scopes)
    from fastapi import Depends

    async def _dep(principal: Principal = Depends(require_principal)) -> Principal:
        missing = needed - principal.scopes
        if missing:
            raise _forbidden(f"missing scopes: {sorted(missing)}")
        return principal

    _dep.__name__ = f"require_scope_{'_'.join(sorted(needed))}"
    return _dep


def require_in(roles: Iterable[Role]) -> Callable[..., Any]:
    return _role_dep_factory(frozenset(roles))


# Pre-baked, common dependencies. Use these in routers instead of redefining.
require_tenant_admin = _role_dep_factory(frozenset({"tenant_admin", "platform_admin"}))
require_tenant_auditor = _role_dep_factory(
    frozenset({"tenant_auditor", "tenant_admin", "platform_admin", "platform_support"})
)
# Read-side gate for the product portfolio + manifests. Operators and reviewers
# need this to author passports, so it's broader than `require_tenant_auditor`.
require_portfolio_read = _role_dep_factory(
    frozenset(
        {
            "tenant_auditor",
            "tenant_admin",
            "platform_admin",
            "platform_support",
            "dpp_operator",
            "dpp_reviewer",
        }
    )
)
require_dpp_operator = _role_dep_factory(
    frozenset({"dpp_operator", "tenant_admin", "platform_admin"})
)
require_dpp_reviewer = _role_dep_factory(
    frozenset(
        {
            "dpp_reviewer",
            "dpp_operator",
            "tenant_admin",
            "tenant_auditor",
            "platform_admin",
            "platform_support",
        }
    )
)
require_verifier = _role_dep_factory(frozenset({"verifier"}))
require_authority = _role_dep_factory(frozenset({"authority"}))
require_customer = _role_dep_factory(frozenset({"customer_user", "customer_admin"}))
require_platform_admin = _role_dep_factory(frozenset({"platform_admin"}))
