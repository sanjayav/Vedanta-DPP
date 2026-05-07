"""W3C VC 2.0 + Ed25519 signing.

Key access is delegated to a `KeyProvider` (see services/keystore.py).
Production deploys swap to KMS or env-mounted secrets without touching the
signing pipeline below.

Canonicalisation: deterministic JCS-equivalent ordering (sort keys, no extra
whitespace) so the SHA-256 of the body is reproducible. Full JSON-LD
canonicalisation is deferred to v1.5 when the EU DPP Registry publishes its
context.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

from ..settings import get_settings
from .keystore import get_key_provider


def canonicalise(body: dict[str, Any]) -> bytes:
    """Deterministic JSON encoding suitable for hashing + signing."""
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )


def body_sha256(body: dict[str, Any]) -> str:
    return hashlib.sha256(canonicalise(body)).hexdigest()


def _multibase_encode(raw: bytes) -> str:
    """Base58-btc multibase encoding (prefix 'z'). Used by Ed25519Signature2020."""
    alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    n = int.from_bytes(raw, "big")
    out = ""
    while n > 0:
        n, rem = divmod(n, 58)
        out = alphabet[rem] + out
    leading = len(raw) - len(raw.lstrip(b"\x00"))
    return "z" + alphabet[0] * leading + out


def sign_dpp_envelope(dpp_body: dict[str, Any]) -> dict[str, Any]:
    """Wrap a DPP body in a W3C VC 2.0 envelope and Ed25519-sign it."""
    settings = get_settings()
    provider = get_key_provider()

    now = datetime.now(UTC)
    issuer_did = settings.dpp_issuer_did
    verification_method = f"{issuer_did}#key-1"

    # In v1.0 the canonical material URL lives at materialId.resolverUrl;
    # legacy bodies put it at upi.digitalLinkUrl. Read both for resilience.
    material_id = dpp_body.get("materialId") or {}
    legacy_upi = dpp_body.get("upi") or {}
    subject_url = (
        material_id.get("resolverUrl")
        or material_id.get("did")
        or legacy_upi.get("digitalLinkUrl")
        or "urn:dpp:unknown"
    )
    producer = dpp_body.get("producer") or {}
    issuer_name = producer.get("legalName") or producer.get("name") or "Hindustan Zinc Limited"

    envelope_unsigned: dict[str, Any] = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://schemas.passport.hzlindia.com/contexts/dpp/v1.jsonld",
        ],
        "id": subject_url,
        "type": ["VerifiableCredential", "DigitalProductPassport"],
        "issuer": {"id": issuer_did, "name": issuer_name},
        "validFrom": now.isoformat(),
        "validUntil": dpp_body.get("meta", {}).get("expiresAt"),
        "credentialSubject": {
            "id": subject_url,
            "dpp": dpp_body,
        },
    }

    signing_input = canonicalise(envelope_unsigned)
    signature = provider.sign(signing_input)
    proof_value = _multibase_encode(signature)

    envelope_unsigned["proof"] = {
        "type": "Ed25519Signature2020",
        "created": now.isoformat(),
        "verificationMethod": verification_method,
        "proofPurpose": "assertionMethod",
        "proofValue": proof_value,
    }
    return envelope_unsigned


def public_key_multibase() -> str:
    return _multibase_encode(get_key_provider().public_key_bytes())


def public_key_bytes() -> bytes:
    return get_key_provider().public_key_bytes()


_BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_BASE58_INDEX = {c: i for i, c in enumerate(_BASE58_ALPHABET)}


def _multibase_decode(value: str) -> bytes:
    if not value or value[0] != "z":
        raise ValueError(f"unsupported multibase prefix: {value[:1]!r} (expected 'z')")
    body = value[1:]
    leading = 0
    while leading < len(body) and body[leading] == _BASE58_ALPHABET[0]:
        leading += 1
    n = 0
    for ch in body[leading:]:
        idx = _BASE58_INDEX.get(ch)
        if idx is None:
            raise ValueError(f"invalid base58 character: {ch!r}")
        n = n * 58 + idx
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big") if n > 0 else b""
    return b"\x00" * leading + raw


@dataclass(frozen=True)
class VerificationResult:
    valid: bool
    body_sha256: str | None = None
    issuer: str | None = None
    error: str | None = None


def verify_envelope(envelope: dict[str, Any]) -> VerificationResult:
    """Cryptographically verify a signed envelope against the platform issuer key.

    Returns a VerificationResult; never raises on a failed signature so callers
    can surface a structured failure to the UI. Schema/structural problems do
    raise (those represent code bugs, not signature problems).
    """
    proof = envelope.get("proof")
    if not isinstance(proof, dict):
        raise ValueError("envelope is missing 'proof'")

    proof_type = proof.get("type")
    if proof_type != "Ed25519Signature2020":
        return VerificationResult(valid=False, error=f"unsupported proof type: {proof_type!r}")
    proof_value = proof.get("proofValue")
    if not isinstance(proof_value, str):
        raise ValueError("proof.proofValue must be a string")

    try:
        signature = _multibase_decode(proof_value)
    except ValueError as exc:
        return VerificationResult(valid=False, error=str(exc))

    # Reconstruct the canonical signing input — strip the proof, canonicalise.
    unsigned = {k: v for k, v in envelope.items() if k != "proof"}
    signing_input = canonicalise(unsigned)

    vk = VerifyKey(get_key_provider().public_key_bytes())
    try:
        vk.verify(signing_input, signature)
    except BadSignatureError as exc:
        return VerificationResult(valid=False, error=f"bad signature: {exc}")

    issuer = envelope.get("issuer")
    issuer_id = (
        issuer["id"] if isinstance(issuer, dict) else issuer if isinstance(issuer, str) else None
    )

    body = envelope.get("credentialSubject", {}).get("dpp")
    body_hash = body_sha256(body) if isinstance(body, dict) else None

    return VerificationResult(valid=True, issuer=issuer_id, body_sha256=body_hash)
