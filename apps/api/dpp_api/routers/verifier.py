"""Verifier-tier API surface — DNV / Bureau Veritas / IZA / ILA / notified bodies.

The caller authenticates with a bearer JWT minted by their IdP. Required
claims:
  - role  = "verifier"
  - did   = the verifier's DID (the credential issuer DID we record)
  - tnt   = the *target tenant* this token is acting on (so a single DNV
            wallet can issue against HZL, sister Vedanta entities, and other
            non-ferrous producers, and we resolve which tenant's brand-period
            the credential lands on)

In v1.5 we accept a W3C VC Presentation in lieu of a JWT — a thin verifier
that validates the presentation against the trust list, then synthesises an
in-process Principal of the same shape.
"""

from __future__ import annotations

from datetime import UTC, datetime

from dateutil.parser import isoparse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import Principal, require_verifier
from ..db import get_tenant_session
from ..services.audit import append_audit
from ..services.audit_query import AuditQuery, query_audit_log
from ..services.rollover import rollover_dpps_to_credential
from ..services.verifier_credentials import (
    affected_dpps_for_credential,
    issue_cfp_credential,
    list_credentials,
    revoke_credential,
)

router = APIRouter(prefix="/verifier", tags=["verifier"])


# ── Schemas ─────────────────────────────────────────────────────────────────


class IssueCfpRequest(BaseModel):
    brand: str = Field(min_length=1, max_length=32)
    period_from: str = Field(description="ISO 8601 date or datetime")
    period_to: str = Field(description="ISO 8601 date or datetime")
    value_kg_co2e_per_tonne: float = Field(gt=0)
    statement_ref: str = Field(min_length=1, max_length=256)
    verifier_name: str = Field(min_length=1, max_length=256)
    assurance_level: str = "limited"
    industry_average: float | None = 3700  # IZA global SHG zinc average (kg CO2e/t)
    methodology: str = "ISO 14067:2018 + IAI v2.0 + PCR 2022:08 v1.0"
    decomposition: dict[str, float] | None = None
    facility_ufi: str | None = None


class RolloverRequest(BaseModel):
    dry_run: bool = False


# ── Helpers ─────────────────────────────────────────────────────────────────


def _did_or_403(principal: Principal) -> str:
    """Verifier endpoints require a `did` claim — anonymous verifier tokens
    cannot bind issuance to a real DID."""
    if not principal.did:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "forbidden", "message": "verifier token missing 'did' claim"},
        )
    return principal.did


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/credentials")
async def list_credentials_endpoint(
    state: str | None = Query(default=None),
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    did = _did_or_403(principal)
    items = await list_credentials(
        session, tenant_id=principal.tenant_id, verifier_did=did, state=state
    )
    return {"items": items, "verifier": did}


@router.post("/credentials", status_code=status.HTTP_201_CREATED)
async def issue_credential_endpoint(
    payload: IssueCfpRequest,
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    did = _did_or_403(principal)
    try:
        result = await issue_cfp_credential(
            session,
            tenant_id=principal.tenant_id,
            brand=payload.brand,
            period_from=_parse_dt(payload.period_from),
            period_to=_parse_dt(payload.period_to),
            value_kg_co2e_per_tonne=payload.value_kg_co2e_per_tonne,
            verifier_did=did,
            verifier_name=payload.verifier_name,
            statement_ref=payload.statement_ref,
            assurance_level=payload.assurance_level,
            industry_average=payload.industry_average,
            methodology=payload.methodology,
            decomposition=payload.decomposition,
            facility_ufi=payload.facility_ufi,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await append_audit(
        session,
        tenant_id=principal.tenant_id,
        actor_kind="external_verifier",
        actor_id=did,
        action="credential.issued",
        target_kind="reference_cfp",
        target_id=str(result.credential_id),
        severity="notice",
        details={
            "brand": payload.brand,
            "value": payload.value_kg_co2e_per_tonne,
            "statementRef": payload.statement_ref,
            "supersededIds": result.superseded_ids,
            "affectedDppCount": result.affected_dpp_count,
        },
    )

    return {
        "credentialId": result.credential_id,
        "supersededIds": result.superseded_ids,
        "affectedDppCount": result.affected_dpp_count,
    }


@router.post("/credentials/{credential_id}/revoke")
async def revoke_credential_endpoint(
    credential_id: int,
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    did = _did_or_403(principal)
    try:
        result = await revoke_credential(
            session,
            tenant_id=principal.tenant_id,
            credential_id=credential_id,
            verifier_did=did,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    await append_audit(
        session,
        tenant_id=principal.tenant_id,
        actor_kind="external_verifier",
        actor_id=did,
        action="credential.revoked",
        target_kind="reference_cfp",
        target_id=str(credential_id),
        severity="warn",
        details={"affectedDppUpis": result.affected_dpp_upis},
    )
    return {
        "credentialId": result.credential_id,
        "affectedDppUpis": result.affected_dpp_upis,
        "affectedDppCount": len(result.affected_dpp_upis),
    }


@router.get("/credentials/{credential_id}/affected-dpps")
async def affected_dpps_endpoint(
    credential_id: int,
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    _did_or_403(principal)
    try:
        return await affected_dpps_for_credential(
            session, tenant_id=principal.tenant_id, credential_id=credential_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/credentials/{credential_id}/rollover")
async def rollover_endpoint(
    credential_id: int,
    payload: RolloverRequest,
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    did = _did_or_403(principal)
    try:
        result = await rollover_dpps_to_credential(
            session,
            tenant_id=principal.tenant_id,
            credential_id=credential_id,
            actor_did=did,
            dry_run=payload.dry_run,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not payload.dry_run:
        await append_audit(
            session,
            tenant_id=principal.tenant_id,
            actor_kind="external_verifier",
            actor_id=did,
            action="credential.rolled_over",
            target_kind="reference_cfp",
            target_id=str(credential_id),
            severity="notice",
            details={
                "succeeded": len(result.succeeded),
                "skipped": len(result.skipped),
                "failed": len(result.failed),
            },
        )

    return {
        "credentialId": result.credential_id,
        "dryRun": payload.dry_run,
        "succeeded": result.succeeded,
        "skipped": result.skipped,
        "failed": [{"upi": f.upi, "error": f.error} for f in result.failed],
    }


@router.get("/audit")
async def list_my_audit_entries(
    action: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_verifier),
    session: AsyncSession = Depends(get_tenant_session),
) -> dict[str, object]:
    """Verifier-scoped audit timeline.

    Server-side forces `actor_id = principal.did` so a verifier can never
    read another verifier's entries even if the underlying audit_log query
    service is otherwise role-blind.
    """
    did = _did_or_403(principal)
    items, total = await query_audit_log(
        session,
        AuditQuery(
            tenant_id=principal.tenant_id,
            actor_kind="external_verifier",
            actor_id=did,
            action=action,
            limit=limit,
            offset=offset,
        ),
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def _parse_dt(value: str) -> datetime:
    parsed = isoparse(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed
