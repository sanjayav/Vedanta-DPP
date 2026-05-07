"""DPP generator (Layer 2 → Layer 3) — Vedanta / Hindustan Zinc edition.

Maps a canonical CastEvent to a fully-populated zinc/lead/silver passport by
merging:

  - the inbound cast payload (operator / smelter / refinery MES data)
  - the simulator preset (when source.kind=simulator), which carries the
    headline sustainability values, certifications and chemistry table from
    the research dossier
  - the BPDM identity scaffolding (HZL_BPNL plus per-site BPNS/BPNA)

The resulting record validates against `dpp/v1.0.0` with all six Chem-X
LCIA categories (PCF, resource use fossil, water scarcity, acidification,
ozone depletion, photochemical ozone) populated with DQR/PDS provenance.

References
----------
* Chem-X Sustainability Guideline v1.0 §3-§9
* Chem-X Business Identity Guideline v1.0 §11-§22
* Chem-X Material ID Guideline v1.0 §5-§6 (did:web)
* TfS PCF Guideline v3.0 (cut-off, allocation, DQR, PDS)
* ISO 14067:2018 (PCF), ISO 14025 EPD, ISO/IEC 6523 (BPN)
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from . import bpn
from ..settings import get_settings
from .presets import get_preset
from .reference_data import CfpReference
from .schema_validator import validate_against


# ── Producing-site lookup ─────────────────────────────────────────────────
# Maps the 3-char site tag (preset.producingSiteTag, also used by the BPN
# minting helpers) to the BPNS and a human-readable name. Mirrors the seed
# data in alembic/versions/0008_hzl_seed.py.
_SITE_BY_TAG: dict[str, tuple[str, str, str]] = {
    "CHA": (bpn.CHANDERIYA_BPNS, "Chanderiya Lead-Zinc Smelter (CLZS)", "smelter_hydro"),
    "DAR": (bpn.DARIBA_SMELTER_BPNS, "Dariba Smelting Complex (DSC)", "smelter_hydro"),
    "DEB": (bpn.DEBARI_BPNS, "Zinc Smelter Debari (ZSD)", "smelter_hydro"),
    "PAN": (bpn.PANTNAGAR_BPNS, "Pantnagar Metal Plant (PMP)", "refinery"),
}


def _resolve_site(preset: dict[str, Any] | None, cast: dict[str, Any]) -> tuple[str, str, str]:
    """Return (BPNS, name, function) for the producing site.

    The cast may carry an explicit `siteBpns`; otherwise we fall back to
    the preset's `producingSiteTag`.
    """
    explicit = cast.get("siteBpns")
    if explicit:
        for bpns_const, name, fn in _SITE_BY_TAG.values():
            if bpns_const == explicit:
                return bpns_const, name, fn
        # Unknown BPNS — accept it (validator already constrained syntax)
        # but mark site name empty so the data captures clearly.
        return explicit, "Hindustan Zinc Site", "smelter_hydro"
    if preset and preset.get("producingSiteTag") in _SITE_BY_TAG:
        return _SITE_BY_TAG[preset["producingSiteTag"]]
    # Default: Chanderiya — the largest, most-cited HZL smelter.
    return _SITE_BY_TAG["CHA"]


def _build_material_id(
    *,
    bpnl: str,
    issuer_did_host: str,
    passport_class: str,
) -> dict[str, Any]:
    """Mint a Chem-X Material ID per the Material ID Guideline §5.4.

    The DID Document is the legal entity's; the per-material UUID rides as
    a query parameter so a single DID resolver can serve the entire portfolio.
    """
    material_uuid = str(uuid4())
    did = f"did:web:{issuer_did_host}:{bpnl}?{passport_class}={material_uuid}"
    settings = get_settings()
    resolver_url = f"{settings.dpp_resolver_base_url.rstrip('/')}/{passport_class}/{bpnl}/{material_uuid}"
    return {
        "did": did,
        "uuid": material_uuid,
        "resolverUrl": resolver_url,
        "passportClass": passport_class,
    }


def _producer_block(metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Hard-coded HZL producer block. In v2 this comes from the BPDM service."""
    return {
        "bpnl": bpn.HZL_BPNL,
        "legalName": "Hindustan Zinc Limited",
        "legalForm": "Public Limited Company",
        "shortName": "HZL",
        "tradeName": "Vedanta Hindustan Zinc",
        "registeredAddressBpna": bpn.HZL_REGISTERED_BPNA,
        "country": "IN",
        "identifiers": [
            {"category": "NBR", "type": "CIN", "value": "L27204RJ1966PLC001208", "issuingCountry": "IN", "issuingBody": "MCA"},
            {"category": "IBR", "type": "LEI", "value": "335800LB39TLJ8YTWM98", "issuingBody": "GLEIF"},
            {"category": "TIN", "type": "PAN", "value": "AAACH7354K", "issuingCountry": "IN", "issuingBody": "Income Tax Department"},
            {"category": "VAT", "type": "GSTIN", "value": "08AAACH7354K1ZB", "issuingCountry": "IN", "issuingBody": "GSTN — Rajasthan"},
            {"category": "OTH", "type": "ISIN", "value": "INE267A01025", "issuingCountry": "IN", "issuingBody": "NSDL"},
            {"category": "OTH", "type": "NSE_TICKER", "value": "HINDZINC", "issuingCountry": "IN", "issuingBody": "NSE"},
            {"category": "OTH", "type": "BSE_CODE", "value": "500188", "issuingCountry": "IN", "issuingBody": "BSE"},
        ],
        "regulatoryContact": {
            "team": "HZL Regulatory Affairs",
            "email": "infohzl@vedanta.co.in",
            "phone": "+91 294 6604000",
        },
    }


def _empty_lcia(category: str) -> dict[str, Any]:
    """Conservative fallback when a preset omits a category. Real production
    code would surface this as a validation warning — for the PoC we emit a
    placeholder marked DQR=5 (worst) so the field exists and is honest."""
    units = {
        "pcf": ("kg CO2e/kg", 0.0),
        "resourceUseFossil": ("MJ/kg", 0.0),
        "waterScarcity": ("m3 world eq/kg", 0.0),
        "acidification": ("mol H+ eq/kg", 0.0),
        "ozoneDepletion": ("kg CFC-11 eq/kg", 0.0),
        "photochemicalOzone": ("kg NMVOC eq/kg", 0.0),
    }
    unit, value = units[category]
    return {
        "value": value,
        "unit": unit,
        "declaredUnit": "1 kg of unpackaged product at factory gate",
        "systemBoundary": "cradle_to_gate",
        "method": {"framework": "EF_3.1", "version": "3.1"},
        "referenceYear": datetime.now(UTC).year,
        "primaryDataSharePercent": 0,
        "dataQualityRating": {"overall": 5, "technological": 5, "geographical": 5, "temporal": 5},
    }


def build_dpp_from_cast_event(
    cast_event: dict[str, Any],
    *,
    cfp_override: CfpReference | None = None,
    compliance_override: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Construct a canonical zinc/lead/silver passport from a validated cast event."""
    settings = get_settings()
    cast = cast_event["cast"]
    source = cast_event["source"]
    preset = get_preset(source["presetId"]) if source.get("presetId") else None

    now = datetime.now(UTC)
    expires_at = now + timedelta(days=365 * 10)            # ESPR Art 10(3)
    lcia_valid_until = now + timedelta(days=365 * 3)       # Chem-X §3.4

    # ── identifiers ──────────────────────────────────────────────────────
    issuer_did_host = settings.dpp_resolver_base_url.replace("https://", "").replace("http://", "").split("/")[0]
    issuer_did = f"did:web:{issuer_did_host}:{bpn.HZL_BPNL}"

    passport_class = "dpp"  # Could become "dmp" for B2B-only intermediates
    material_id = _build_material_id(
        bpnl=bpn.HZL_BPNL,
        issuer_did_host=issuer_did_host,
        passport_class=passport_class,
    )

    # Speaking codes survive on materialId for compatibility with current
    # processes (Chem-X §1.1 — patchwork of CAS / EC / REACH / LME).
    if preset and "speakingCodes" in preset:
        material_id["speakingCodes"] = preset["speakingCodes"]

    # ── site ─────────────────────────────────────────────────────────────
    site_bpns, site_name, site_fn = _resolve_site(preset, cast)

    # ── physical ─────────────────────────────────────────────────────────
    if preset and "physical" in preset:
        physical = dict(preset["physical"])
        # Cast may override unit/bundle masses for variant runs
        if "unitMassKg" in cast and cast["unitMassKg"] != physical.get("unitMassKg"):
            physical["unitMassKg"] = cast["unitMassKg"]
        if "bundleMassKg" in cast:
            physical["bundleMassKg"] = cast["bundleMassKg"]
    else:
        physical = {
            "unitMassKg": cast["unitMassKg"],
            "bundleMassKg": cast.get("bundleMassKg", 1000),
            "unitsPerBundle": int((cast.get("bundleMassKg", 1000) // cast["unitMassKg"])) or 1,
        }

    # ── chemistry ────────────────────────────────────────────────────────
    chemistry = (
        preset["chemistry"]
        if preset and "chemistry" in preset
        else {
            "composition": [
                {
                    "element": {"zinc": "Zn", "lead": "Pb", "silver": "Ag"}[cast["metal"]],
                    "casNumber": {"zinc": "7440-66-6", "lead": "7439-92-1", "silver": "7440-22-4"}[cast["metal"]],
                    "role": "primary",
                    "guaranteedMinPercent": 99.0,
                },
                {"element": "Fe", "casNumber": "7439-89-6", "role": "impurity", "guaranteedMaxPercent": 0.05},
            ]
        }
    )

    # ── sustainability ───────────────────────────────────────────────────
    if cfp_override is not None:
        # Reference store override: replace PCF only, keep rest from preset.
        sustainability = (preset.get("sustainability") if preset else {}) or {}
        sustainability = dict(sustainability)
        sustainability.setdefault("pcf", _empty_lcia("pcf")).update(
            {
                "value": cfp_override.value_kg_co2e_per_tonne / 1000.0,
                "unit": "kg CO2e/kg",
                "verifier": {
                    "did": cfp_override.verifier_did,
                    "name": cfp_override.verifier_name,
                },
                "verificationStatementRef": cfp_override.statement_ref,
                "assuranceLevel": cfp_override.assurance_level,
                "reportingPeriod": {"from": cfp_override.period_from, "to": cfp_override.period_to},
            }
        )
    elif preset and "sustainability" in preset:
        sustainability = dict(preset["sustainability"])
    else:
        sustainability = {cat: _empty_lcia(cat) for cat in (
            "pcf",
            "resourceUseFossil",
            "waterScarcity",
            "acidification",
            "ozoneDepletion",
            "photochemicalOzone",
        )}

    # Ensure all six required categories are present even if the preset omitted any.
    for cat in ("pcf", "resourceUseFossil", "waterScarcity", "acidification", "ozoneDepletion", "photochemicalOzone"):
        sustainability.setdefault(cat, _empty_lcia(cat))

    # ── compliance ───────────────────────────────────────────────────────
    if compliance_override is not None:
        compliance = compliance_override
    elif preset and "compliance" in preset:
        compliance = preset["compliance"]
    else:
        compliance = {
            "regulations": [
                {"name": "REACH", "reference": "EC 1907/2006", "status": "compliant"},
                {"name": "BIS", "reference": "Indian Standards", "status": "compliant"},
                {"name": "CBAM declaration ready", "reference": "(EU) 2023/956", "status": "pending"},
            ],
            "certifications": [
                {"name": "ISO 9001:2015", "status": "compliant"},
                {"name": "ISO 14001:2015", "status": "compliant"},
                {"name": "ISO 45001:2018", "status": "compliant"},
            ],
        }

    # ── assemble ─────────────────────────────────────────────────────────
    dpp: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "passportType": "DPP",
        "materialId": material_id,
        "identification": _strip_none({
            "metal": cast["metal"],
            "gradeCode": preset["gradeCode"] if preset else cast["gradeCode"],
            "purityPercent": preset["purityPercent"] if preset else 99.0,
            "designation": preset.get("label") if preset else cast["gradeCode"],
            "form": cast["form"],
            "tradeName": preset.get("tradeName") if preset else None,
            "applicableStandards": (preset or {}).get(
                "applicableStandards", ["IS 209:1992"] if cast["metal"] == "zinc" else ["IS 27:2023"]
            ),
        }),
        "producer": _producer_block(),
        "origin": {
            "country": "IN",
            "subdivision": "IN-RJ" if site_bpns != bpn.PANTNAGAR_BPNS else "IN-UT",
            "manufacturingDate": now.date().isoformat(),
            "manufacturingBatch": cast["castNumber"],
            "sites": [
                {
                    "bpns": site_bpns,
                    "name": site_name,
                    "function": site_fn,
                    "country": "IN",
                }
            ],
        },
        "product": {
            "name": preset["label"] if preset else f"HZL {cast['metal'].title()} {cast['gradeCode']}",
            "purposeStatement": preset["summary"] if preset else "HZL refined non-ferrous metal product.",
            "intendedMarkets": (preset or {}).get("intendedMarkets", []),
            "intendedRegions": (preset or {}).get("intendedRegions", []),
        },
        "physical": _strip_none(physical),
        "chemistry": chemistry,
        "sustainability": sustainability,
        "recycledContent": (preset or {}).get(
            "recycledContent",
            {"totalPercent": 0, "chainOfCustodyModel": "mass_balance"},
        ),
        "compliance": compliance,
        "circularity": (preset or {}).get(
            "circularity",
            {
                "recyclabilityIndicator": f"{cast['metal'].title()} is fully recyclable.",
                "materialRecoveryPotential": "Recovered via authorised non-ferrous metal recyclers.",
                "reuseInformation": "Process scrap re-melted internally.",
                "recyclingInformation": "Refer to IZA / ILA / LBMA recycling guidance.",
                "disposalInformation": "Never landfill — return for recycling.",
            },
        ),
        "espr": (preset or {}).get(
            "espr",
            {
                "durability": "Stable refined metal product.",
                "reliability": "Conforms to applicable BIS / ISO standards.",
                "reusability": "Infinitely recyclable.",
                "energyEfficiency": "Smelter operates under ISO 50001 energy management.",
                "resourceEfficiency": "High in-process scrap recovery.",
            },
        ),
        "soc": (preset or {}).get("soc", {"summaryStatement": "no_svhc_above_threshold"}),
        "useAndLife": (preset or {}).get(
            "useAndLife",
            {"safetyInformation": "Refer to SDS for safe handling and storage."},
        ),
        "documentation": {"documents": _bundled_documents(preset)},
        "meta": {
            "createdAt": now.isoformat(),
            "lastUpdated": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "lciaValidUntil": lcia_valid_until.date().isoformat(),
            "lifecycleState": "draft",
            "languages": ["en", "hi"],
            "issuerDid": issuer_did,
            "accessRights": {
                "model": "three_tier_vc_gated",
                "publicFields": [
                    "materialId",
                    "identification",
                    "producer",
                    "origin",
                    "product",
                    "physical",
                    "sustainability",
                    "recycledContent",
                    "compliance",
                    "circularity",
                    "espr",
                    "meta",
                ],
            },
            "tenantId": int(cast_event["tenantId"]),
        },
    }

    validate_against("dpp/v1.0.0", dpp)
    return dpp


def _strip_none(d: dict[str, Any]) -> dict[str, Any]:
    """Recursively drop dict entries whose value is None — schema is
    `additionalProperties: false` and many fields are optional."""
    if not isinstance(d, dict):
        return d
    out = {}
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, dict):
            cleaned = _strip_none(v)
            if cleaned:
                out[k] = cleaned
        else:
            out[k] = v
    return out


def _bundled_documents(preset: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Per-issuance bundled documents. The EPD reference always rides along
    when the preset declares one."""
    docs: list[dict[str, Any]] = []
    if preset and "sustainability" in preset and "epd" in preset["sustainability"]:
        epd = preset["sustainability"]["epd"]
        docs.append(
            {
                "id": "doc-epd",
                "title": f"{epd['programOperator']} — {epd['registrationNumber']}",
                "url": epd.get("url", "https://www.environdec.com/library/epd6472"),
                "type": "epd",
                "issuer": epd.get("programOperator", "International EPD System"),
            }
        )
    docs.extend(
        [
            {
                "id": "doc-iso-9001",
                "title": "ISO 9001:2015 Quality Management",
                "url": "/dpp-assets/docs/certs/doc-iso-9001.pdf",
                "type": "certificate",
                "issuer": "TÜV / RINA",
            },
            {
                "id": "doc-iso-14001",
                "title": "ISO 14001:2015 Environmental Management",
                "url": "/dpp-assets/docs/certs/doc-iso-14001.pdf",
                "type": "certificate",
                "issuer": "TÜV / RINA",
            },
            {
                "id": "doc-iso-45001",
                "title": "ISO 45001:2018 OH&S",
                "url": "/dpp-assets/docs/certs/doc-iso-45001.pdf",
                "type": "certificate",
                "issuer": "TÜV / RINA",
            },
            {
                "id": "doc-icmm",
                "title": "ICMM Mining Principles — Member since 2025-08-13",
                "url": "https://www.icmm.com/en-gb/our-members",
                "type": "certificate",
                "issuer": "ICMM",
            },
        ]
    )
    return docs


def new_tracking_id() -> str:
    return uuid4().hex
