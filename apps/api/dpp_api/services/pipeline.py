"""End-to-end DPP issuance pipeline (SDD §6.1).

cast_event_id  ──▶ generator ──▶ signer ──▶ persist + audit ──▶ result

Runs inline for v1.0. v2 lifts each step into a Temporal activity so we can
retry, parallelise, and observe each layer independently.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import CastEvent, DppRecord
from .audit import append_audit
from .generator import build_dpp_from_cast_event
from .plausibility import PlausibilityRejection, check_cast_event, check_dpp_body
from .reference_data import lookup_cfp, lookup_compliance
from .signer import body_sha256, sign_dpp_envelope


@dataclass(frozen=True)
class PipelineResult:
    dpp_id: int
    upi: str
    digital_link_url: str
    state: str


async def run_dpp_pipeline(session: AsyncSession, cast_event_id: int) -> PipelineResult:
    cast_event = await session.get(CastEvent, cast_event_id)
    if cast_event is None:
        raise ValueError(f"cast event {cast_event_id} not found")

    # 0. Plausibility — reject obviously-wrong cast events before generation.
    cast_check = check_cast_event(cast_event.payload)
    if not cast_check.ok:
        cast_event.status = "failed"
        cast_event.error = "; ".join(cast_check.issues)
        raise PlausibilityRejection(cast_check)

    # 1. Generate canonical DPP body, looking up live reference data first.
    cast_for_lookup = cast_event.payload["cast"]
    cfp_ref = await lookup_cfp(
        session,
        tenant_id=cast_event.tenant_id,
        brand=cast_for_lookup.get("gradeCode") or cast_for_lookup.get("tradeName") or "UNKNOWN",
    )
    compliance_ref = await lookup_compliance(session, tenant_id=cast_event.tenant_id)
    has_compliance = bool(compliance_ref["regulations"]) or bool(compliance_ref["certifications"])
    dpp_body = build_dpp_from_cast_event(
        cast_event.payload,
        cfp_override=cfp_ref,
        compliance_override=compliance_ref if has_compliance else None,
    )

    body_check = check_dpp_body(dpp_body)
    if not body_check.ok:
        cast_event.status = "failed"
        cast_event.error = "; ".join(body_check.issues)
        raise PlausibilityRejection(body_check)

    # 2. Sign — wrap in W3C VC 2.0 envelope, Ed25519.
    envelope = sign_dpp_envelope(dpp_body)
    sha = body_sha256(dpp_body)

    # v1.0 HZL UPI · the canonical Chem-X material URL form is BPNL/UUID.
    # `gtin` and `cast_number` are kept as transitional columns on the
    # `dpp_records` table; we synthesize a per-metal HSN-aligned GTIN if
    # the body doesn't carry one (zinc 7901, lead 7801).
    material_id = dpp_body.get("materialId") or {}
    producer = dpp_body.get("producer") or {}
    bpnl = producer.get("bpnl") or "BPNLHZL0000001QX"
    uuid_str = material_id.get("uuid") or str(uuid.uuid4())
    cast_payload = cast_event.payload.get("cast") or {}
    cast_number = cast_payload.get("castNumber") or dpp_body.get("origin", {}).get(
        "manufacturingBatch", "C-UNKNOWN"
    )
    item_serial = cast_payload.get("itemSerial")
    metal = (dpp_body.get("identification") or {}).get("metal", "zinc")
    gtin = (
        ((dpp_body.get("upi") or {}).get("gtin"))
        or ("08901003079011" if metal == "zinc" else "08901003078011")
    )
    upi = f"{bpnl}/{uuid_str}"

    # 3. Persist DPP record.
    existing = await session.scalar(
        select(DppRecord).where(DppRecord.tenant_id == cast_event.tenant_id, DppRecord.upi == upi)
    )
    if existing is not None:
        existing.body = dpp_body
        existing.envelope = envelope
        existing.body_sha256 = sha
        existing.signature = envelope["proof"]["proofValue"]
        existing.state = "published"
        existing.issued_at = datetime.now(UTC)
        record = existing
    else:
        record = DppRecord(
            tenant_id=cast_event.tenant_id,
            upi=upi,
            gtin=gtin,
            cast_number=cast_number,
            item_serial=item_serial,
            brand=(
                dpp_body["identification"].get("tradeName")
                or dpp_body["identification"]["gradeCode"]
            ),
            alloy=dpp_body["identification"]["gradeCode"],
            form=dpp_body["identification"]["form"],
            weight_kg=dpp_body["physical"].get("unitMassKg") or dpp_body["physical"].get("netWeightKg") or 0.0,
            # PCF in v1.0 is kg CO₂e/kg; the legacy column is kg CO₂e/tonne.
            cfp_kg_co2e_per_tonne=float(
                dpp_body.get("sustainability", {}).get("pcf", {}).get("value", 0.0)
            )
            * 1000,
            recycled_content_pct=dpp_body.get("recycledContent", {}).get("totalPercent", 0),
            state="published",
            body=dpp_body,
            envelope=envelope,
            body_sha256=sha,
            signature=envelope["proof"]["proofValue"],
            cast_event_id=cast_event.id,
            issued_at=datetime.now(UTC),
        )
        session.add(record)

    cast_event.status = "published"
    await session.flush()

    # 4. Audit.
    await append_audit(
        session,
        tenant_id=cast_event.tenant_id,
        actor_kind="system",
        actor_id="pipeline",
        action="dpp.issued",
        target_kind="dpp",
        target_id=upi,
        details={
            "cast_event_id": cast_event.id,
            "tracking_id": cast_event.tracking_id,
            "brand": dpp_body["identification"].get("tradeName")
            or dpp_body["identification"].get("gradeCode"),
            "pcf_kg_co2e_per_kg": dpp_body.get("sustainability", {})
            .get("pcf", {})
            .get("value"),
            "body_sha256": sha,
        },
    )

    return PipelineResult(
        dpp_id=record.id,
        upi=upi,
        digital_link_url=material_id.get("resolverUrl") or f"https://passport.hzlindia.com/dpp/{upi}",
        state="published",
    )
