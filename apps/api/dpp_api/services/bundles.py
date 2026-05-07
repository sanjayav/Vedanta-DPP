"""Audit-Ready Document Export — signed ZIP bundles for B2B customers.

Per SDD §5.3.2 zone 4: a one-click PDF bundle per shipment containing all
relevant DPPs, certificates, MTCs; full provenance; signed export receipt.

In v1.0 we bundle JSON-LD instead of PDF (PDF rendering is a v1.5 add via
WeasyPrint or reportlab; both add 50+ MB to the API container). The receipt
itself is signed with the platform DID so the bundle is independently
verifiable from its manifest.
"""

from __future__ import annotations

import hashlib
import io
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import AuditLog, DppRecord
from ..settings import get_settings
from .dpps import filter_for_tier
from .signer import canonicalise, sign_dpp_envelope


@dataclass(frozen=True)
class BundleResult:
    archive: bytes
    receipt_id: str
    sha256: str
    item_count: int
    size_bytes: int


async def export_bundle(
    session: AsyncSession,
    *,
    upis: Iterable[str],
    requested_by: str,
    tier: str = "legitimate",
    label: str | None = None,
) -> BundleResult:
    """Build a signed ZIP archive of the requested DPPs."""
    settings = get_settings()
    upi_list = list(dict.fromkeys(upis))  # preserve order, drop duplicates
    if not upi_list:
        raise ValueError("at least one UPI is required")

    rows = (await session.scalars(select(DppRecord).where(DppRecord.upi.in_(upi_list)))).all()
    found = {r.upi: r for r in rows}
    missing = [u for u in upi_list if u not in found]
    if missing:
        raise ValueError(f"DPPs not found: {missing}")

    now = datetime.now(UTC)
    receipt_id = f"BUNDLE-{now.strftime('%Y%m%d')}-{hashlib.sha256(repr(upi_list).encode()).hexdigest()[:12]}"

    # Slice the audit log for the bundled DPPs — gives the customer / regulator
    # the provenance trail in one place.
    audit_rows = (
        await session.scalars(
            select(AuditLog).where(AuditLog.target_id.in_(upi_list)).order_by(AuditLog.id.asc())
        )
    ).all()
    audit_payload = [
        {
            "occurredAt": a.occurred_at.isoformat(),
            "actor": {"kind": a.actor_kind, "id": a.actor_id},
            "action": a.action,
            "target": {"kind": a.target_kind, "id": a.target_id},
            "severity": a.severity,
            "details": a.details,
            "prevHash": a.prev_hash,
            "currentHash": a.current_hash,
        }
        for a in audit_rows
    ]

    # Compose entries we'll write into the ZIP.
    files: list[tuple[str, bytes]] = []
    manifest_items: list[dict[str, object]] = []
    for r in (found[u] for u in upi_list):
        body = filter_for_tier(r.body, tier)  # type: ignore[arg-type]
        body_bytes = canonicalise(body)
        envelope_bytes = canonicalise(r.envelope) if r.envelope else b"{}"
        files.append((f"dpps/{r.upi}/dpp.json", body_bytes))
        if r.envelope:
            files.append((f"dpps/{r.upi}/envelope.json", envelope_bytes))
        manifest_items.append(
            {
                "upi": r.upi,
                "brand": r.brand,
                "alloy": r.alloy,
                "form": r.form,
                "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
                "bodySha256": hashlib.sha256(body_bytes).hexdigest(),
                "envelopeSha256": hashlib.sha256(envelope_bytes).hexdigest()
                if r.envelope
                else None,
            }
        )

    audit_bytes = canonicalise({"entries": audit_payload})
    files.append(("audit-log.json", audit_bytes))

    cover = {
        "@context": "https://schemas.dpp.ega.ae/contexts/bundle/v1.jsonld",
        "type": "DppExportBundle",
        "receiptId": receipt_id,
        "label": label or f"Export {now.date().isoformat()}",
        "issuedAt": now.isoformat(),
        "issuer": settings.dpp_issuer_did,
        "requestedBy": requested_by,
        "tier": tier,
        "items": manifest_items,
        "auditLogSha256": hashlib.sha256(audit_bytes).hexdigest(),
        "standards": [
            "ESPR (EU) 2024/1781",
            "ISO 14067:2018",
            "ASI Performance V3.1 / CoC V2.1",
            "W3C Verifiable Credentials 2.0",
        ],
    }
    cover_bytes = canonicalise(cover)
    files.append(("manifest.json", cover_bytes))

    # Sign the cover so the receipt is independently verifiable.
    receipt_envelope = sign_dpp_envelope(
        {
            "upi": {"digitalLinkUrl": f"{settings.dpp_resolver_base_url}/exports/{receipt_id}"},
            "producer": {"name": "EGA DPP Platform"},
            "meta": {"expiresAt": (now.replace(year=now.year + 10)).isoformat()},
            "_bundle": cover,  # signed-over so tampering invalidates the receipt
        }
    )
    receipt_bytes = canonicalise(receipt_envelope)
    files.append(("receipt.signed.json", receipt_bytes))

    # Stable README so a human opening the ZIP in Finder isn't confused.
    readme = (
        f"# DPP Export Bundle · {receipt_id}\n\n"
        f"Generated: {now.isoformat()}\n"
        f"Issuer: {settings.dpp_issuer_did}\n"
        f"Items: {len(manifest_items)}\n"
        f"Tier: {tier}\n\n"
        "Layout:\n"
        "  manifest.json          — JSON-LD bundle manifest (signed in receipt.signed.json)\n"
        "  receipt.signed.json    — W3C VC 2.0 envelope, Ed25519-signed by the platform issuer\n"
        "  audit-log.json         — hash-chained audit slice for the bundled DPPs\n"
        "  dpps/<upi>/dpp.json    — canonical DPP body (legitimate-tier projection)\n"
        "  dpps/<upi>/envelope.json — original signed VC envelope\n"
    )
    files.append(("README.md", readme.encode("utf-8")))

    # Build the ZIP.
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for path, blob in files:
            zf.writestr(path, blob)

    archive = buffer.getvalue()
    return BundleResult(
        archive=archive,
        receipt_id=receipt_id,
        sha256=hashlib.sha256(archive).hexdigest(),
        item_count=len(manifest_items),
        size_bytes=len(archive),
    )
