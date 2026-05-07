"""Business Partner Number (BPN) minting and validation.

Implements Catena-X CX-0010 v2.1.0 — the 16-character identifier scheme
registered as an ISO/IEC 6523-1:2023 organisation identification scheme:

    BPN[L|S|A] + 10 entity chars + 2 ISO/IEC 7064 MOD 1271-36 check chars

Where:
    - L = legal entity, S = site, A = address
    - alphabet is 0-9 and uppercase A-Z (base 36)
    - the two trailing check characters detect transposition and single-char
      errors (Chem-X Business Identity Guideline §20)

For the HZL PoC the platform acts as its own trusted issuer (Chem-X §25).
A future federation with Cofinity-X / a Catena-X operating company would
swap this minting layer for an external BPN issuance call without touching
downstream services.

References
----------
* Chem-X Business Identity Guideline v1.0, sections 18–20
* ISO/IEC 7064:2003 — Check character systems, MOD 1271-36
* ISO/IEC 6523-1:2023 — Organisation identification scheme registration
"""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Final

ALPHABET: Final[str] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_ALPHA_INDEX: Final[dict[str, int]] = {c: i for i, c in enumerate(ALPHABET)}
RADIX: Final[int] = 36
MODULUS: Final[int] = 1271
ENTITY_CHARS_LEN: Final[int] = 10
PAYLOAD_LEN_NO_CHECK: Final[int] = 14  # "BPN" + type + 10 entity chars

_BPN_REGEX: Final[re.Pattern[str]] = re.compile(r"^BPN([LSA])([A-Z0-9]{10})([A-Z0-9]{2})$")


class BpnType(StrEnum):
    """Type character of the BPN — selects the Chem-X resource class."""

    LEGAL_ENTITY = "L"
    SITE = "S"
    ADDRESS = "A"


def _to_base36(s: str) -> int:
    """Treat *s* as a base-36 integer (0-9 + A-Z, big-endian)."""
    n = 0
    for ch in s:
        try:
            n = n * RADIX + _ALPHA_INDEX[ch]
        except KeyError as exc:
            raise ValueError(f"non-base36 character: {ch!r}") from exc
    return n


def _from_base36(n: int, width: int) -> str:
    """Render *n* as a fixed-width base-36 string."""
    if n < 0:
        raise ValueError("negative input")
    out: list[str] = []
    for _ in range(width):
        n, r = divmod(n, RADIX)
        out.append(ALPHABET[r])
    if n != 0:
        raise ValueError("value does not fit in requested width")
    return "".join(reversed(out))


def compute_check_chars(payload14: str) -> str:
    """Return the two ISO/IEC 7064 MOD 1271-36 check characters for *payload14*.

    *payload14* is the 14-character prefix of a BPN without the check chars
    (i.e. ``BPN`` + type char + 10 entity chars). The result is the minimum
    two-character base-36 string that, when appended, makes the full 16-char
    identifier divisible by 1271 modulo MOD 1271-36.

    >>> compute_check_chars("BPNLHZL0000001")  # doctest: +SKIP
    '...'
    """
    if len(payload14) != PAYLOAD_LEN_NO_CHECK:
        raise ValueError(f"expected 14-char payload, got {len(payload14)}")
    payload_int = _to_base36(payload14)
    # 16-char BPN value = payload_int * 36^2 + check_int
    # We want (16-char value) mod 1271 == 0 → check_int = (-payload * 1296) mod 1271
    check_int = (-payload_int * (RADIX**2)) % MODULUS
    if check_int >= RADIX**2:
        # MOD 1271 < 36^2 = 1296, so this should never trip — defensive only.
        raise RuntimeError("check value overflow")
    return _from_base36(check_int, 2)


def is_valid(bpn: str) -> bool:
    """True iff *bpn* matches the CX-0010 syntax and check characters verify."""
    m = _BPN_REGEX.fullmatch(bpn)
    if not m:
        return False
    payload14 = bpn[:14]
    expected = compute_check_chars(payload14)
    return expected == bpn[14:]


def mint(bpn_type: BpnType, entity_chars: str) -> str:
    """Mint a CX-0010 compliant BPN.

    *entity_chars* must be exactly 10 characters from the base-36 alphabet
    (0-9, A-Z, uppercase). The function appends the type prefix and the two
    ISO 7064 check characters.

    For HZL seed data we encode a short company tag + numeric counter, e.g.
    ``mint(BpnType.LEGAL_ENTITY, 'HZL0000001')`` → ``BPNLHZL0000001XX``.
    """
    entity = entity_chars.upper()
    if len(entity) != ENTITY_CHARS_LEN or not all(c in _ALPHA_INDEX for c in entity):
        raise ValueError(f"entity_chars must be 10 characters from [0-9A-Z]; got {entity_chars!r}")
    payload14 = f"BPN{bpn_type.value}{entity}"
    return payload14 + compute_check_chars(payload14)


def parse(bpn: str) -> tuple[BpnType, str, str]:
    """Decompose a BPN into (type, entity_chars, check_chars). Validates."""
    m = _BPN_REGEX.fullmatch(bpn)
    if not m:
        raise ValueError(f"invalid BPN syntax: {bpn!r}")
    if not is_valid(bpn):
        raise ValueError(f"invalid BPN check characters: {bpn!r}")
    type_char, entity, check = m.group(1), m.group(2), m.group(3)
    return BpnType(type_char), entity, check


# ── Pre-minted BPNs for HZL seed data ──────────────────────────────────────
# These are deterministic and computed once at module load; tests verify they
# still validate after any future change to the algorithm. All values are
# documented inline so a reviewer can hand-trace them.
#
# Convention for the 10 entity chars:
#   - HZL legal entity: "HZL0000001" (room for 9,999,999 future LEs at HZL)
#   - sites:            "HZS<3-letter site tag><4 digit counter>"
#   - addresses:        "HZA<3-letter site tag><4 digit counter>"
def _mint_const(t: BpnType, entity: str) -> str:
    return mint(t, entity)


def _site(tag3: str, counter: int) -> str:
    entity = f"HZS{tag3.upper()[:3]:<3}{counter:04d}"
    if len(entity) != ENTITY_CHARS_LEN:
        raise ValueError(f"site entity_chars not {ENTITY_CHARS_LEN}: {entity!r}")
    return mint(BpnType.SITE, entity)


def _addr(tag3: str, counter: int) -> str:
    entity = f"HZA{tag3.upper()[:3]:<3}{counter:04d}"
    if len(entity) != ENTITY_CHARS_LEN:
        raise ValueError(f"address entity_chars not {ENTITY_CHARS_LEN}: {entity!r}")
    return mint(BpnType.ADDRESS, entity)


# Legal entity
HZL_BPNL: Final[str] = _mint_const(BpnType.LEGAL_ENTITY, "HZL0000001")

# Sites — mines
# Per HZL Sustainability Report FY 2024-25 p5: 6 active mining assets in
# Rajasthan (Rampura Agucha, Sindesar Khurd, Rajpura Dariba, Bamnia Kalan,
# Kayad, Zawar) plus Maton — Maton is in the biodiversity reporting
# boundary only and is not a producing mine, so it's omitted here.
RAMPURA_AGUCHA_BPNS: Final[str] = _site("RAM", 1)
SINDESAR_KHURD_BPNS: Final[str] = _site("SKM", 1)
RAJPURA_DARIBA_BPNS: Final[str] = _site("RDM", 1)
BAMNIA_KALAN_BPNS: Final[str] = _site("BKM", 1)
ZAWAR_BPNS: Final[str] = _site("ZAW", 1)
KAYAD_BPNS: Final[str] = _site("KAY", 1)

# Smelters / refineries
CHANDERIYA_BPNS: Final[str] = _site("CHA", 1)
DARIBA_SMELTER_BPNS: Final[str] = _site("DAR", 1)
DEBARI_BPNS: Final[str] = _site("DEB", 1)
PANTNAGAR_BPNS: Final[str] = _site("PAN", 1)

# Depots
DEPOT_HYD_BPNS: Final[str] = _site("DHY", 1)
DEPOT_PUN_BPNS: Final[str] = _site("DPU", 1)
DEPOT_CHE_BPNS: Final[str] = _site("DCH", 1)
DEPOT_KOL_BPNS: Final[str] = _site("DKO", 1)
DEPOT_JAM_BPNS: Final[str] = _site("DJA", 1)
DEPOT_FAR_BPNS: Final[str] = _site("DFA", 1)
DEPOT_BEN_BPNS: Final[str] = _site("DBE", 1)
DEPOT_RAI_BPNS: Final[str] = _site("DRA", 1)

# Addresses (one per producing site + registered office + depots).
# The registered office is keyed under "REG".
HZL_REGISTERED_BPNA: Final[str] = _addr("REG", 1)

RAMPURA_AGUCHA_BPNA: Final[str] = _addr("RAM", 1)
SINDESAR_KHURD_BPNA: Final[str] = _addr("SKM", 1)
RAJPURA_DARIBA_BPNA: Final[str] = _addr("RDM", 1)
BAMNIA_KALAN_BPNA: Final[str] = _addr("BKM", 1)
ZAWAR_BPNA: Final[str] = _addr("ZAW", 1)
KAYAD_BPNA: Final[str] = _addr("KAY", 1)
CHANDERIYA_BPNA: Final[str] = _addr("CHA", 1)
DARIBA_SMELTER_BPNA: Final[str] = _addr("DAR", 1)
DEBARI_BPNA: Final[str] = _addr("DEB", 1)
PANTNAGAR_BPNA: Final[str] = _addr("PAN", 1)
DEPOT_HYD_BPNA: Final[str] = _addr("DHY", 1)
DEPOT_PUN_BPNA: Final[str] = _addr("DPU", 1)
DEPOT_CHE_BPNA: Final[str] = _addr("DCH", 1)
DEPOT_KOL_BPNA: Final[str] = _addr("DKO", 1)
DEPOT_JAM_BPNA: Final[str] = _addr("DJA", 1)
DEPOT_FAR_BPNA: Final[str] = _addr("DFA", 1)
DEPOT_BEN_BPNA: Final[str] = _addr("DBE", 1)
DEPOT_RAI_BPNA: Final[str] = _addr("DRA", 1)


__all__ = [
    "ALPHABET",
    "BAMNIA_KALAN_BPNA",
    "BAMNIA_KALAN_BPNS",
    "CHANDERIYA_BPNA",
    "CHANDERIYA_BPNS",
    "DARIBA_SMELTER_BPNA",
    "DARIBA_SMELTER_BPNS",
    "DEBARI_BPNA",
    "DEBARI_BPNS",
    "DEPOT_BEN_BPNA",
    "DEPOT_BEN_BPNS",
    "DEPOT_CHE_BPNA",
    "DEPOT_CHE_BPNS",
    "DEPOT_FAR_BPNA",
    "DEPOT_FAR_BPNS",
    "DEPOT_HYD_BPNA",
    "DEPOT_HYD_BPNS",
    "DEPOT_JAM_BPNA",
    "DEPOT_JAM_BPNS",
    "DEPOT_KOL_BPNA",
    "DEPOT_KOL_BPNS",
    "DEPOT_PUN_BPNA",
    "DEPOT_PUN_BPNS",
    "DEPOT_RAI_BPNA",
    "DEPOT_RAI_BPNS",
    # HZL seed constants
    "HZL_BPNL",
    "HZL_REGISTERED_BPNA",
    "KAYAD_BPNA",
    "KAYAD_BPNS",
    "PANTNAGAR_BPNA",
    "PANTNAGAR_BPNS",
    "RAJPURA_DARIBA_BPNA",
    "RAJPURA_DARIBA_BPNS",
    "RAMPURA_AGUCHA_BPNA",
    "RAMPURA_AGUCHA_BPNS",
    "SINDESAR_KHURD_BPNA",
    "SINDESAR_KHURD_BPNS",
    "ZAWAR_BPNA",
    "ZAWAR_BPNS",
    "BpnType",
    "compute_check_chars",
    "is_valid",
    "mint",
    "parse",
]
