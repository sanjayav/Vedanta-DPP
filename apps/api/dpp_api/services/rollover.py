"""Atomic DPP rollover after a new verifier credential is issued (SDD §6.4).

The rollover is triggered explicitly by the verifier (not on issuance) so the
operations team controls the timing. For each affected DPP the platform:

  1. Snapshots the current body + envelope into `revision_history`.
  2. Regenerates the body from the original cast event using the new credential
     as the CFP override (the cast event payload is preserved in cast_events).
  3. Re-signs the new body with the platform DID (issuer DID is unchanged so
     external verifiers still trust the same key).
  4. Increments revision_count, writes a hash-chained audit-log entry per DPP,
     and updates updated_at.

Failure is per-DPP: if regeneration fails for any reason, that DPP is left
untouched, the failure is recorded in the audit log, and the rollover continues.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CastEvent, DppRecord, ReferenceCfp
from .audit import append_audit
from .generator import build_dpp_from_cast_event
from .reference_data import CfpReference
from .signer import body_sha256, sign_dpp_envelope


@dataclass(frozen=True)
class RolloverFailure:
    upi: str
    error: str


@dataclass(frozen=True)
class RolloverResult:
    credential_id: int
    succeeded: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    failed: list[RolloverFailure] = field(default_factory=list)


async def rollover_dpps_to_credential(
    session: AsyncSession,
    *,
    tenant_id: int,
    credential_id: int,
    actor_did: str,
    dry_run: bool = False,
) -> RolloverResult:
    """Roll every active DPP of the credential's brand forward onto it."""
    credential = await session.get(ReferenceCfp, credential_id)
    if credential is None or credential.tenant_id != tenant_id:
        raise ValueError("credential not found")
    if credential.state != "active":
        raise ValueError(f"credential {credential_id} is not active (state={credential.state})")

    cfp_override = CfpReference(
        value_kg_co2e_per_tonne=credential.value_kg_co2e_per_tonne,
        industry_average=credential.industry_average,
        methodology=credential.methodology,
        period_from=credential.period_from.date().isoformat(),
        period_to=credential.period_to.date().isoformat(),
        verifier_did=credential.verifier_did,
        verifier_name=credential.verifier_name,
        statement_ref=credential.statement_ref,
        assurance_level=credential.assurance_level,
        decomposition={k: float(v) for k, v in (credential.decomposition or {}).items()},
    )

    candidates = (
        await session.scalars(
            select(DppRecord).where(
                DppRecord.tenant_id == tenant_id,
                DppRecord.brand == credential.brand,
                DppRecord.state == "published",
            )
        )
    ).all()

    succeeded: list[str] = []
    skipped: list[str] = []
    failed: list[RolloverFailure] = []
    now = datetime.now(UTC)

    for record in candidates:
        current_ref = record.body.get("carbon", {}).get("verificationStatementRef")
        if current_ref == credential.statement_ref:
            skipped.append(record.upi)
            continue

        if dry_run:
            succeeded.append(record.upi)
            continue

        try:
            await _rollover_one(
                session,
                record=record,
                cfp_override=cfp_override,
                actor_did=actor_did,
                credential_id=credential_id,
                now=now,
            )
            succeeded.append(record.upi)
        except Exception as exc:
            failed.append(RolloverFailure(upi=record.upi, error=str(exc)))
            await append_audit(
                session,
                tenant_id=tenant_id,
                actor_kind="external_verifier",
                actor_id=actor_did,
                action="dpp.rollover_failed",
                target_kind="dpp",
                target_id=record.upi,
                severity="error",
                details={"credentialId": credential_id, "error": str(exc)},
            )

    return RolloverResult(
        credential_id=credential_id, succeeded=succeeded, skipped=skipped, failed=failed
    )


async def _rollover_one(
    session: AsyncSession,
    *,
    record: DppRecord,
    cfp_override: CfpReference,
    actor_did: str,
    credential_id: int,
    now: datetime,
) -> None:
    """Re-generate, re-sign, and stamp revision history for a single record."""
    if record.cast_event_id is None:
        raise ValueError("source cast_event missing — cannot regenerate body")

    cast_event = await session.get(CastEvent, record.cast_event_id)
    if cast_event is None:
        raise ValueError("source cast_event no longer accessible")

    new_body = build_dpp_from_cast_event(cast_event.payload, cfp_override=cfp_override)
    new_envelope = sign_dpp_envelope(new_body)
    new_sha = body_sha256(new_body)

    history_entry: dict[str, Any] = {
        "revisedAt": now.isoformat(),
        "revisedBy": actor_did,
        "credentialId": credential_id,
        "priorBodySha256": record.body_sha256,
        "priorEnvelope": record.envelope,
        "priorCfp": record.cfp_kg_co2e_per_tonne,
        "newCfp": new_body["carbon"]["valueKgCo2ePerTonne"],
    }
    history = list(record.revision_history or [])
    history.append(history_entry)

    record.body = new_body
    record.envelope = new_envelope
    record.body_sha256 = new_sha
    record.signature = new_envelope["proof"]["proofValue"]
    record.cfp_kg_co2e_per_tonne = new_body["carbon"]["valueKgCo2ePerTonne"]
    record.revision_history = history
    record.revision_count = (record.revision_count or 0) + 1
    record.updated_at = now

    await append_audit(
        session,
        tenant_id=record.tenant_id,
        actor_kind="external_verifier",
        actor_id=actor_did,
        action="dpp.rolled_over",
        target_kind="dpp",
        target_id=record.upi,
        severity="notice",
        details={
            "credentialId": credential_id,
            "priorCfp": history_entry["priorCfp"],
            "newCfp": history_entry["newCfp"],
            "priorBodySha256": history_entry["priorBodySha256"],
            "newBodySha256": new_sha,
            "revisionCount": record.revision_count,
        },
    )
