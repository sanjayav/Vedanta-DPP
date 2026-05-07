"""did:web Document publication and per-material resolution.

Implements the identifier scheme from Chem-X Material Identifier Guideline §5–§6:

  - The legal entity owns ONE DID Document at
        https://passport.hzlindia.com/.well-known/did.json
    keyed by the company's BPNL (Catena-X CX-0010 / ISO/IEC 6523).

  - Per-material passports are referenced via DID-URL query parameters,
    e.g. did:web:passport.hzlindia.com:BPNLHZL0000001QX?dpp=<uuid>

  - The DID Document carries verification methods (the platform Ed25519
    issuer key) plus service endpoints describing how to resolve the
    underlying DPP / DMP. This mirrors the Catena-X pattern in CX-0149.

The DID Document is intentionally legal-entity-scoped (not per-material)
so the entire HZL portfolio shares a single trust anchor. Per-material
trust is layered on top via the W3C VC the API signs at publish time.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Response

from ..services import bpn
from ..services.signer import public_key_multibase
from ..settings import get_settings

router = APIRouter(tags=["meta", "did"])


def _legal_entity_did(host: str, bpnl: str) -> str:
    return f"did:web:{host}:{bpnl}"


def _build_did_document(host: str, bpnl: str) -> dict[str, object]:
    """Construct the W3C DID Document for the HZL legal entity.

    The `service` array advertises the resolver endpoints a verifier needs
    to fetch a passport credential by its query-parameter material UUID.
    """
    if not bpn.is_valid(bpnl):
        raise HTTPException(status_code=400, detail=f"invalid BPNL: {bpnl!r}")

    did = _legal_entity_did(host, bpnl)
    settings = get_settings()
    resolver = settings.dpp_resolver_base_url.rstrip("/")

    return {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/ed25519-2020/v1",
            "https://w3id.org/security/suites/jws-2020/v1",
        ],
        "id": did,
        "alsoKnownAs": [
            # Catena-X CX-0010 BPNL is the alternative-identifier per Chem-X §A.3
            f"urn:bpnl:{bpnl}",
            # Indian regulatory anchors
            "urn:in:cin:L27204RJ1966PLC001208",
            "urn:lei:335800LB39TLJ8YTWM98",
        ],
        "verificationMethod": [
            {
                "id": f"{did}#key-1",
                "type": "Ed25519VerificationKey2020",
                "controller": did,
                "publicKeyMultibase": public_key_multibase(),
            }
        ],
        "assertionMethod": [f"{did}#key-1"],
        "authentication": [f"{did}#key-1"],
        # Service endpoints — Chem-X Material ID Guideline §A.9
        "service": [
            {
                "id": f"{did}#dpp-resolver",
                "type": "DigitalProductPassportResolver",
                "serviceEndpoint": f"{resolver}/dpp/{bpnl}",
                "description": "GET /dpp/{bpnl}/{uuid} returns the public DPP body.",
            },
            {
                "id": f"{did}#dmp-resolver",
                "type": "DigitalMaterialPassportResolver",
                "serviceEndpoint": f"{resolver}/dmp/{bpnl}",
                "description": (
                    "GET /dmp/{bpnl}/{uuid} returns the value-chain "
                    "(one-up/one-down) DMP body. Requires VC presentation "
                    "per Chem-X §25."
                ),
            },
            {
                "id": f"{did}#bpdm-pool",
                "type": "BPDMPool",
                "serviceEndpoint": f"{resolver}/bpdm",
                "description": (
                    "Catena-X CX-0012 compatible BPDM pool serving HZL's "
                    "legal entity, sites and addresses."
                ),
            },
        ],
    }


@router.get("/.well-known/did.json")
async def did_document_root() -> dict[str, object]:
    """Root did:web document for the platform's primary issuer (HZL)."""
    settings = get_settings()
    host = (
        settings.dpp_resolver_base_url.replace("https://", "").replace("http://", "").split("/")[0]
    )
    return _build_did_document(host, bpn.HZL_BPNL)


@router.get("/{bpnl}/did.json")
async def did_document_by_bpnl(
    bpnl: str = Path(..., description="Catena-X CX-0010 BPNL"),
) -> dict[str, object]:
    """did:web for a specific BPNL.

    Resolves at https://<host>/<bpnl>/did.json — the trailing /did.json is
    omitted in did:web URLs; clients fetch this path automatically.
    """
    settings = get_settings()
    host = (
        settings.dpp_resolver_base_url.replace("https://", "").replace("http://", "").split("/")[0]
    )
    if bpnl != bpn.HZL_BPNL:
        # Multi-tenant future: look up legal_entities and 404 if absent.
        raise HTTPException(status_code=404, detail=f"unknown BPNL: {bpnl}")
    return _build_did_document(host, bpnl)


@router.get("/resolve/{bpnl}", include_in_schema=False)
async def resolve_passport_via_query(
    bpnl: str,
    dpp: str | None = None,
    dmp: str | None = None,
) -> Response:
    """Convenience resolver mirroring the did:web query-parameter pattern.

    A scanned QR code resolves to:
        https://passport.hzlindia.com/resolve/{bpnl}?dpp={uuid}
    which 302-redirects to the public viewer or DMP gateway. This keeps
    the DID-URL form (did:web:host:bpnl?dpp=uuid) one-to-one with the
    HTTP form a phone camera or browser can resolve.
    """
    if dpp is None and dmp is None:
        raise HTTPException(status_code=400, detail="provide ?dpp=<uuid> or ?dmp=<uuid>")

    settings = get_settings()
    resolver = settings.dpp_resolver_base_url.rstrip("/")
    if dpp is not None:
        target = f"{resolver}/dpp/{bpnl}/{dpp}"
    else:
        target = f"{resolver}/dmp/{bpnl}/{dmp}"
    return Response(status_code=302, headers={"Location": target})
