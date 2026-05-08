"""Passport draft authoring API.

Mounted at /api/v1/draft-passports. The console's Create Passport wizard
(plus the external assignee surface) is the primary consumer.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import Principal
from ..auth.dependencies import (
    require_dpp_operator,
    require_dpp_reviewer,
    require_principal,
)
from ..db import get_session, get_tenant_session
from ..services import drafts as svc

router = APIRouter(prefix="/draft-passports", tags=["draft-passports"])


# ── Schemas ─────────────────────────────────────────────────────────────


class CreateDraftRequest(BaseModel):
    product_id: int = Field(..., alias="productId")
    dpp_version: str = Field(..., alias="dppVersion")
    cast_number: str = Field(..., alias="castNumber", min_length=1, max_length=64)
    item_serial: str | None = Field(None, alias="itemSerial", max_length=64)
    title: str | None = Field(None, max_length=256)

    model_config = {"populate_by_name": True}


class SetValueRequest(BaseModel):
    manifest_attr_id: int = Field(..., alias="manifestAttrId")
    value: Any
    source: str = "manual"
    source_ref: str | None = Field(None, alias="sourceRef")

    model_config = {"populate_by_name": True}


class BulkSetValueItem(BaseModel):
    manifest_attr_id: int = Field(..., alias="manifestAttrId")
    value: Any
    source: str = "manual"
    source_ref: str | None = Field(None, alias="sourceRef")

    model_config = {"populate_by_name": True}


class BulkSetValueRequest(BaseModel):
    items: list[BulkSetValueItem]


class LibraryPullRequest(BaseModel):
    process_step_id: int = Field(..., alias="processStepId")
    preset_id: str = Field(..., alias="presetId")

    model_config = {"populate_by_name": True}


class IotPullRequest(BaseModel):
    process_step_id: int = Field(..., alias="processStepId")
    iot_connection_id: int = Field(..., alias="iotConnectionId")

    model_config = {"populate_by_name": True}


class IotUpsertRequest(BaseModel):
    name: str = Field(..., max_length=128)
    kind: str
    endpoint: str | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    attribute_map: dict[str, Any] = Field(default_factory=dict, alias="attributeMap")
    product_id: int | None = Field(None, alias="productId")
    process_step_id: int | None = Field(None, alias="processStepId")

    model_config = {"populate_by_name": True}


class AssignRequest(BaseModel):
    manifest_attr_id: int = Field(..., alias="manifestAttrId")
    assignee_email: EmailStr = Field(..., alias="assigneeEmail")
    assignee_name: str | None = Field(None, alias="assigneeName")
    assignee_org: str | None = Field(None, alias="assigneeOrg")
    note: str | None = None

    model_config = {"populate_by_name": True}


class DisclosureUpdateRequest(BaseModel):
    attribute_path: str = Field(..., alias="attributePath")
    audience: str
    visible: bool

    model_config = {"populate_by_name": True}


class AssignmentSubmitRequest(BaseModel):
    value: Any


# ── Draft CRUD ──────────────────────────────────────────────────────────


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    payload: CreateDraftRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.create_draft(
            session,
            tenant_id=principal.tenant_id,
            product_id=payload.product_id,
            dpp_version=payload.dpp_version,
            cast_number=payload.cast_number,
            item_serial=payload.item_serial,
            title=payload.title,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("")
async def list_endpoint(
    state: str | None = Query(None),
    principal: Principal = Depends(require_dpp_reviewer),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    return {"drafts": await svc.list_drafts(session, tenant_id=principal.tenant_id, state=state)}


@router.get("/{draft_id}")
async def get_endpoint(
    draft_id: int,
    principal: Principal = Depends(require_dpp_reviewer),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.get_draft(session, tenant_id=principal.tenant_id, draft_id=draft_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ── Attribute entry ────────────────────────────────────────────────────


@router.post("/{draft_id}/values")
async def set_value_endpoint(
    draft_id: int,
    payload: SetValueRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.set_value(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            manifest_attr_id=payload.manifest_attr_id,
            value=payload.value,
            source=payload.source,
            source_ref=payload.source_ref,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{draft_id}/values/bulk")
async def set_values_bulk_endpoint(
    draft_id: int,
    payload: BulkSetValueRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.set_values_bulk(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            items=[
                (it.manifest_attr_id, it.value, it.source, it.source_ref)
                for it in payload.items
            ],
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{draft_id}/library-presets")
async def library_presets_endpoint(
    draft_id: int,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        d = await svc.get_draft(session, tenant_id=principal.tenant_id, draft_id=draft_id)
        product_id = d["draft"]["productId"]
        presets = await svc.list_library_presets(
            session, tenant_id=principal.tenant_id, product_id=product_id
        )
        return {"presets": presets}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{draft_id}/library-pull")
async def library_pull_endpoint(
    draft_id: int,
    payload: LibraryPullRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.pull_from_library(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            process_step_id=payload.process_step_id,
            preset_id=payload.preset_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{draft_id}/iot-connections")
async def iot_connections_endpoint(
    draft_id: int,
    process_step_id: int | None = Query(None, alias="processStepId"),
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        d = await svc.get_draft(session, tenant_id=principal.tenant_id, draft_id=draft_id)
        product_id = d["draft"]["productId"]
        rows = await svc.list_iot_connections(
            session,
            tenant_id=principal.tenant_id,
            product_id=product_id,
            process_step_id=process_step_id,
        )
        return {"connections": rows}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/iot-connections")
async def iot_upsert_endpoint(
    payload: IotUpsertRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.upsert_iot_connection(
            session,
            tenant_id=principal.tenant_id,
            name=payload.name,
            kind=payload.kind,
            endpoint=payload.endpoint,
            config=payload.config,
            attribute_map=payload.attribute_map,
            product_id=payload.product_id,
            process_step_id=payload.process_step_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{draft_id}/iot-pull")
async def iot_pull_endpoint(
    draft_id: int,
    payload: IotPullRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.pull_from_iot(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            process_step_id=payload.process_step_id,
            iot_connection_id=payload.iot_connection_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Assignments ────────────────────────────────────────────────────────


@router.post("/{draft_id}/assignments")
async def assign_endpoint(
    draft_id: int,
    payload: AssignRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.assign_attribute(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            manifest_attr_id=payload.manifest_attr_id,
            assignee_email=str(payload.assignee_email),
            assignee_name=payload.assignee_name,
            assignee_org=payload.assignee_org,
            note=payload.note,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/assignments/{assignment_id}")
async def revoke_endpoint(
    assignment_id: int,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.revoke_assignment(
            session,
            tenant_id=principal.tenant_id,
            assignment_id=assignment_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/assignments/inbox")
async def inbox_endpoint(
    email: str = Query(..., min_length=3),
    principal: Principal = Depends(require_principal),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """An assignee's inbox of delegated attributes.

    Returns the access token alongside each assignment when the caller's
    principal email matches the queried address — so the my-assignments
    surface can submit directly without needing the magic link.
    """
    rows = await svc.list_assignments_for_email(session, assignee_email=email)
    if principal.email and principal.email.lower() == email.lower():
        rows = await svc.list_assignments_for_email_with_tokens(session, assignee_email=email)
    return {"assignments": rows}


@router.get("/assignments/by-token/{access_token}")
async def fetch_by_token_endpoint(
    access_token: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Token-authenticated assignment prefetch — backs the public magic-link page."""
    result = await svc.fetch_assignment_by_token(session, access_token=access_token)
    if result is None:
        raise HTTPException(status_code=404, detail="invalid access token")
    return result


@router.post("/assignments/{access_token}/submit")
async def submit_assignment_endpoint(
    access_token: str,
    payload: AssignmentSubmitRequest,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Token-authenticated submission. No principal required."""
    try:
        return await svc.submit_assignment_value(
            session, access_token=access_token, value=payload.value
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Disclosure + publish ───────────────────────────────────────────────


@router.post("/{draft_id}/disclosure/begin")
async def begin_disclosure_endpoint(
    draft_id: int,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.begin_disclosure(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{draft_id}/disclosure")
async def get_disclosure_endpoint(
    draft_id: int,
    principal: Principal = Depends(require_dpp_reviewer),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.get_disclosure(session, tenant_id=principal.tenant_id, draft_id=draft_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{draft_id}/disclosure")
async def update_disclosure_endpoint(
    draft_id: int,
    payload: DisclosureUpdateRequest,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.update_disclosure(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            attribute_path=payload.attribute_path,
            audience=payload.audience,
            visible=payload.visible,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{draft_id}/publish")
async def publish_endpoint(
    draft_id: int,
    principal: Principal = Depends(require_dpp_operator),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, Any]:
    try:
        return await svc.publish_draft(
            session,
            tenant_id=principal.tenant_id,
            draft_id=draft_id,
            actor_id=principal.email or principal.subject,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        # Almost always a (tenant_id, upi) collision: a draft built from
        # autofilled placeholder identifiers tried to publish over an existing
        # record. Surface as 409 so the wizard banner can prompt the operator
        # to set a unique cast_number / itemSerial.
        raise HTTPException(
            status_code=409,
            detail=(
                "a passport with this UPI is already published — change the "
                "cast number or item serial and try again"
            ),
        ) from exc
    except (KeyError, TypeError) as exc:
        # Most often: an autofill string that broke a numeric coercion or a
        # required body section missing. Surface a usable detail instead of a
        # bare 500 so the wizard banner can show something actionable.
        raise HTTPException(
            status_code=422,
            detail=f"draft body could not be assembled: {exc}",
        ) from exc
