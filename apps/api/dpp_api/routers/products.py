"""Six-level product configuration API.

Mounted at /api/v1/products. Tenant-admin gated for write operations;
tenant-auditor + above can read.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import Principal
from ..auth.dependencies import (
    require_portfolio_read,
    require_tenant_admin,
)
from ..db import get_tenant_session
from ..services.product_seed import seed_canonical_data
from ..services.products import (
    ingest_readiness,
    list_portfolio,
    lock_dpp_config,
    manifest_for_product,
    product_detail,
    transition_permission,
    upsert_data_source,
    upsert_dpp_config,
)

router = APIRouter(prefix="/products", tags=["products"])


# ── Schemas ─────────────────────────────────────────────────────────────


class UpsertConfigRequest(BaseModel):
    selections: dict[str, list[int]] = Field(
        default_factory=dict,
        description="{ stepId: [manifestAttrId, ...] } selections per step.",
    )


class UpsertSourceRequest(BaseModel):
    process_step_id: int
    origin: str  # internal | third_party
    supplier_name: str | None = None
    supplier_did: str | None = None
    connector_kind: str | None = None
    connector_config: dict[str, Any] | None = None


class PermissionTransitionRequest(BaseModel):
    state: str  # requested | granted | denied


# ── Endpoints ───────────────────────────────────────────────────────────


@router.post("/seed", status_code=status.HTTP_200_OK)
async def seed_endpoint(
    principal: Principal = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    """Idempotent seed of canonical chain + manifests + HZL portfolio."""
    counts = await seed_canonical_data(session, tenant_id=principal.tenant_id)
    return {"seeded": counts}


@router.get("")
async def list_endpoint(
    principal: Principal = Depends(require_portfolio_read),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    return await list_portfolio(session, tenant_id=principal.tenant_id)


@router.get("/{product_id}")
async def detail_endpoint(
    product_id: int,
    principal: Principal = Depends(require_portfolio_read),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    detail = await product_detail(session, tenant_id=principal.tenant_id, product_id=product_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="product not found")
    return detail


@router.get("/{product_id}/manifest/{dpp_version}")
async def manifest_endpoint(
    product_id: int,
    dpp_version: str,
    principal: Principal = Depends(require_portfolio_read),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    manifest = await manifest_for_product(
        session,
        tenant_id=principal.tenant_id,
        product_id=product_id,
        dpp_version=dpp_version,
    )
    if manifest is None:
        raise HTTPException(status_code=404, detail="product not found")
    return manifest


@router.post("/{product_id}/configs/{dpp_version}")
async def upsert_config_endpoint(
    product_id: int,
    dpp_version: str,
    payload: UpsertConfigRequest,
    principal: Principal = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    try:
        return await upsert_dpp_config(
            session,
            tenant_id=principal.tenant_id,
            product_id=product_id,
            dpp_version=dpp_version,
            selections=payload.selections,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{product_id}/configs/{dpp_version}/lock")
async def lock_config_endpoint(
    product_id: int,
    dpp_version: str,
    principal: Principal = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    try:
        return await lock_dpp_config(
            session,
            tenant_id=principal.tenant_id,
            product_id=product_id,
            dpp_version=dpp_version,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{product_id}/data-sources")
async def upsert_source_endpoint(
    product_id: int,
    payload: UpsertSourceRequest,
    principal: Principal = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    try:
        return await upsert_data_source(
            session,
            tenant_id=principal.tenant_id,
            product_id=product_id,
            process_step_id=payload.process_step_id,
            origin=payload.origin,
            supplier_name=payload.supplier_name,
            supplier_did=payload.supplier_did,
            connector_kind=payload.connector_kind,
            connector_config=payload.connector_config,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/data-sources/{source_id}/permission")
async def transition_permission_endpoint(
    source_id: int,
    payload: PermissionTransitionRequest,
    principal: Principal = Depends(require_tenant_admin),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    try:
        return await transition_permission(
            session,
            tenant_id=principal.tenant_id,
            source_id=source_id,
            new_state=payload.state,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{product_id}/readiness/{dpp_version}")
async def readiness_endpoint(
    product_id: int,
    dpp_version: str,
    principal: Principal = Depends(require_portfolio_read),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    try:
        return await ingest_readiness(
            session,
            tenant_id=principal.tenant_id,
            product_id=product_id,
            dpp_version=dpp_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
