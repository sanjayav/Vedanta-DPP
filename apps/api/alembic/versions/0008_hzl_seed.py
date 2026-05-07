"""Seed Hindustan Zinc Limited (HZL) BPDM master data.

Revision ID: 0008_hzl_seed
Revises: 0007_bpdm_tables
Create Date: 2026-05-07

Seeds the canonical Hindustan Zinc Limited records:

  - Tenant id=1 retitled from EGA to HZL (the Vedanta production rebrand).
  - One legal entity (HZL) with full Indian regulatory identifier set:
      CIN, LEI, PAN, GSTIN-RJ (Rajasthan registered office state),
      ISIN, NSE/BSE tickers, ICMM membership flag.
  - 17 sites: 5 underground Pb-Zn mines, 4 smelter/refinery sites, 8 depots.
  - Site main addresses for the 9 producing sites + 1 registered office
    address. Depot street addresses are intentionally NULL pending an HZL
    data drop (the cities/states are public, the streets are not).

All BPN values are minted via dpp_api.services.bpn (CX-0010 16-char with
ISO/IEC 7064 MOD 1271-36 check chars). Re-running the seed is idempotent:
every INSERT is guarded with ON CONFLICT (bpnl|bpns|bpna) DO UPDATE so the
record converges to the values listed here.

References
----------
* HZL Integrated Annual Report FY 2024-25 (sites, capacities)
* MCA / ZaubaCorp (CIN), GLEIF (LEI), KnowYourGST (GSTIN)
* environdec.com EPD-IES-0006472:001 (zinc EPD)
* Chem-X Business Identity Guideline §11–§22
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op
from dpp_api.services import bpn

revision = "0008_hzl_seed"
down_revision = "0007_bpdm_tables"
branch_labels = None
depends_on = None


# ── Static identifier values (pre-research, citable) ──────────────────────
HZL_CIN = "L27204RJ1966PLC001208"
HZL_LEI = "335800LB39TLJ8YTWM98"
HZL_PAN = "AAACH7354K"
HZL_GSTIN_RJ = "08AAACH7354K1ZB"
HZL_ISIN = "INE267A01025"
HZL_NSE_TICKER = "HINDZINC"
HZL_BSE_CODE = "500188"
HZL_INCORPORATION_DATE = "1966-01-10"
HZL_ICMM_JOIN_DATE = "2025-08-13"

HZL_DID = f"did:web:passport.hzlindia.com:{bpn.HZL_BPNL}"


# Each site row used in the loop below.
SITES: tuple[dict[str, object], ...] = (
    # ── Mines (5) ─────────────────────────────────────────────────────────
    {
        "bpns": bpn.RAMPURA_AGUCHA_BPNS,
        "name": "Rampura Agucha Mine",
        "function": "mine",
        "address_bpna": bpn.RAMPURA_AGUCHA_BPNA,
        "city": "Agucha",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Bhilwara",
        "postal_code": "311029",
        "street": None,
        "production_capacity": {"metal": "zinc_lead_ore", "tpa": 6_150_000, "unit": "ore"},
        "metadata": {
            "profile": "World's largest underground zinc mine; transitioned from open-pit to UG."
        },
    },
    {
        "bpns": bpn.SINDESAR_KHURD_BPNS,
        "name": "Sindesar Khurd Mine",
        "function": "mine",
        "address_bpna": bpn.SINDESAR_KHURD_BPNA,
        "city": "Dariba",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Rajsamand",
        "postal_code": "313211",
        "street": "Tehsil Railmagra",
        "production_capacity": {"metal": "zinc_lead_silver_ore", "tpa": 5_600_000, "unit": "ore"},
        "metadata": {"profile": "Most mechanised UG mine in India; high silver yield."},
    },
    {
        "bpns": bpn.RAJPURA_DARIBA_BPNS,
        "name": "Rajpura Dariba Mine",
        "function": "mine",
        "address_bpna": bpn.RAJPURA_DARIBA_BPNA,
        "city": "Dariba",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Rajsamand",
        "postal_code": "313211",
        "street": None,
        "production_capacity": {
            "metal": "zinc_lead_ore",
            "tpa": 1_500_000,
            "unit": "ore",
            "expansion_target_tpa": 4_000_000,
        },
        "metadata": {"profile": "Co-located with Dariba Smelting Complex."},
    },
    {
        "bpns": bpn.ZAWAR_BPNS,
        "name": "Zawar Group of Mines",
        "function": "mine",
        "address_bpna": bpn.ZAWAR_BPNA,
        "city": "Zawar",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Udaipur",
        "postal_code": "313901",
        "street": None,
        "production_capacity": {
            "metal": "zinc_lead_ore",
            "tpa": 4_750_000,
            "unit": "ore",
            "sub_mines": ["Mochia", "Balaria", "Zawar Mala", "Baroi"],
        },
        "metadata": {"profile": "World's oldest known zinc mining site; 80 MW captive power."},
    },
    {
        "bpns": bpn.KAYAD_BPNS,
        "name": "Kayad Mine",
        "function": "mine",
        "address_bpna": bpn.KAYAD_BPNA,
        "city": "Kayad",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Ajmer",
        "postal_code": None,  # not verified in public sources
        "street": None,
        "production_capacity": {"metal": "zinc_lead_ore", "tpa": 1_200_000, "unit": "ore"},
        "metadata": {"profile": "Underground operations started 2013."},
    },
    # ── Smelters & refinery (4) ──────────────────────────────────────────
    {
        "bpns": bpn.CHANDERIYA_BPNS,
        "name": "Chanderiya Lead-Zinc Smelter (CLZS)",
        "function": "smelter_hydro",
        "address_bpna": bpn.CHANDERIYA_BPNA,
        "city": "Chittorgarh",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Chittorgarh",
        "postal_code": "312021",
        "street": "Putholi village, Gangrar Tehsil",
        "production_capacity": {
            "zinc_tpa": 585_000,
            "lead_tpa": 90_000,
            "routes": ["RLE_hydro_480000_tpa", "ISP_pyro_105000_tpa"],
        },
        "metadata": {
            "profile": (
                "Largest integrated Pb-Zn smelter in HZL group; "
                "produces SHG, EcoZen, CGG, PW, HZDA, refined lead."
            ),
            "zinc_mark_certified": True,
            "zinc_mark_date": "2026-04-01",
        },
    },
    {
        "bpns": bpn.DARIBA_SMELTER_BPNS,
        "name": "Dariba Smelting Complex (DSC)",
        "function": "smelter_hydro",
        "address_bpna": bpn.DARIBA_SMELTER_BPNA,
        "city": "Dariba",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Rajsamand",
        "postal_code": "313211",
        "street": None,
        "production_capacity": {
            "zinc_tpa": 240_000,
            "lead_tpa": 120_000,
            "sulphuric_acid_tpa": None,
        },
        "metadata": {
            "profile": (
                "Hydrometallurgical RLE; co-located with Rajpura Dariba and Sindesar Khurd mines."
            ),
        },
    },
    {
        "bpns": bpn.DEBARI_BPNS,
        "name": "Zinc Smelter Debari (ZSD)",
        "function": "smelter_hydro",
        "address_bpna": bpn.DEBARI_BPNA,
        "city": "Debari",
        "subdivision": "IN-RJ",
        "admin_area_level_2": "Udaipur",
        "postal_code": "313024",
        "street": "Girwa",
        "production_capacity": {"zinc_tpa": 88_000},
        "metadata": {"profile": "India's oldest zinc smelter; co-located solar PV park."},
    },
    {
        "bpns": bpn.PANTNAGAR_BPNS,
        "name": "Pantnagar Metal Plant (PMP)",
        "function": "refinery",
        "address_bpna": bpn.PANTNAGAR_BPNA,
        "city": "Pantnagar",
        "subdivision": "IN-UT",
        "admin_area_level_2": "Udham Singh Nagar",
        "postal_code": "263153",
        "street": "SIDCUL Integrated Industrial Estate",
        "production_capacity": {"silver_tpa": 800, "zinc_alloy_value_add": True},
        "metadata": {
            "profile": (
                "LBMA Good Delivery silver refinery; renewable-power "
                "claim flagged for verification."
            ),
            "lbma_good_delivery_silver": True,
            "renewable_power_claim_verified": False,
        },
    },
    # ── Depots (8) — cities only, addresses NULL ─────────────────────────
    {
        "bpns": bpn.DEPOT_HYD_BPNS,
        "name": "HZL Depot — Hyderabad",
        "function": "depot",
        "address_bpna": bpn.DEPOT_HYD_BPNA,
        "city": "Hyderabad",
        "subdivision": "IN-TG",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_PUN_BPNS,
        "name": "HZL Depot — Pune",
        "function": "depot",
        "address_bpna": bpn.DEPOT_PUN_BPNA,
        "city": "Pune",
        "subdivision": "IN-MH",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_CHE_BPNS,
        "name": "HZL Depot — Chennai",
        "function": "depot",
        "address_bpna": bpn.DEPOT_CHE_BPNA,
        "city": "Chennai",
        "subdivision": "IN-TN",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_KOL_BPNS,
        "name": "HZL Depot — Kolkata",
        "function": "depot",
        "address_bpna": bpn.DEPOT_KOL_BPNA,
        "city": "Kolkata",
        "subdivision": "IN-WB",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_JAM_BPNS,
        "name": "HZL Depot — Jamshedpur",
        "function": "depot",
        "address_bpna": bpn.DEPOT_JAM_BPNA,
        "city": "Jamshedpur",
        "subdivision": "IN-JH",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_FAR_BPNS,
        "name": "HZL Depot — Faridabad",
        "function": "depot",
        "address_bpna": bpn.DEPOT_FAR_BPNA,
        "city": "Faridabad",
        "subdivision": "IN-HR",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_BEN_BPNS,
        "name": "HZL Depot — Bengaluru",
        "function": "depot",
        "address_bpna": bpn.DEPOT_BEN_BPNA,
        "city": "Bengaluru",
        "subdivision": "IN-KA",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
    {
        "bpns": bpn.DEPOT_RAI_BPNS,
        "name": "HZL Depot — Raipur",
        "function": "depot",
        "address_bpna": bpn.DEPOT_RAI_BPNA,
        "city": "Raipur",
        "subdivision": "IN-CT",
        "admin_area_level_2": None,
        "postal_code": None,
        "street": None,
        "production_capacity": {},
        "metadata": {},
    },
)


# Identifiers attached to the legal entity (Chem-X §13/§14 categories).
LE_IDENTIFIERS = (
    {
        "category": "NBR",
        "type": "CIN",
        "value": HZL_CIN,
        "issuing_country": "IN",
        "issuing_body": "Ministry of Corporate Affairs (MCA)",
    },
    {
        "category": "IBR",
        "type": "LEI",
        "value": HZL_LEI,
        "issuing_country": None,
        "issuing_body": "GLEIF",
    },
    {
        "category": "TIN",
        "type": "PAN",
        "value": HZL_PAN,
        "issuing_country": "IN",
        "issuing_body": "Income Tax Department",
    },
    {
        "category": "VAT",
        "type": "GSTIN",
        "value": HZL_GSTIN_RJ,
        "issuing_country": "IN",
        "issuing_body": "GSTN — Rajasthan",
    },
    {
        "category": "OTH",
        "type": "ISIN",
        "value": HZL_ISIN,
        "issuing_country": "IN",
        "issuing_body": "NSDL",
    },
    {
        "category": "OTH",
        "type": "NSE_TICKER",
        "value": HZL_NSE_TICKER,
        "issuing_country": "IN",
        "issuing_body": "NSE",
    },
    {
        "category": "OTH",
        "type": "BSE_CODE",
        "value": HZL_BSE_CODE,
        "issuing_country": "IN",
        "issuing_body": "BSE",
    },
)


def _jsonb(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def _exec(bind, sql: str, params: dict | None = None) -> None:
    """Run a parameterised SQL statement.

    `bind.exec_driver_sql` uses the driver's native paramstyle (psycopg's
    `%(name)s`); SQLAlchemy `text` accepts `:name` and translates per dialect.
    Wrapping in `text()` keeps the raw `:name` placeholders working.
    """
    bind.execute(sa.text(sql), params or {})


def upgrade() -> None:
    bind = op.get_bind()

    # ── Tenant 1: rebrand EGA → HZL ──────────────────────────────────────
    _exec(
        bind,
        """
        UPDATE tenants
           SET slug = 'hzl',
               legal_name = 'Hindustan Zinc Limited',
               issuer_did = :did,
               branding = CAST(:branding AS jsonb),
               status = 'active',
               tier = 'production'
         WHERE id = 1;
        """,
        {
            "did": HZL_DID,
            "branding": _jsonb(
                {
                    "primaryColor": "#0E7C5A",
                    "secondaryColor": "#1A4480",
                    "accentColor": "#A8D5BA",
                    "logo": "/branding/hzl-logo.svg",
                    "wordmark": "Vedanta · Hindustan Zinc",
                    "publicHost": "passport.hzlindia.com",
                }
            ),
        },
    )

    # If tenant 1 doesn't exist (greenfield install), insert it.
    _exec(
        bind,
        """
        INSERT INTO tenants (id, slug, legal_name, issuer_did, status, tier, branding)
        VALUES (1, 'hzl', 'Hindustan Zinc Limited', :did,
                'active', 'production', CAST(:branding AS jsonb))
        ON CONFLICT (id) DO NOTHING;
        """,
        {
            "did": HZL_DID,
            "branding": _jsonb(
                {
                    "primaryColor": "#0E7C5A",
                    "secondaryColor": "#1A4480",
                    "accentColor": "#A8D5BA",
                    "logo": "/branding/hzl-logo.svg",
                    "wordmark": "Vedanta · Hindustan Zinc",
                    "publicHost": "passport.hzlindia.com",
                }
            ),
        },
    )
    _exec(
        bind,
        "SELECT setval(pg_get_serial_sequence('tenants','id'), "
        "GREATEST(1, (SELECT max(id) FROM tenants)));",
    )

    # ── Registered-office address (must exist before legal_entities FK) ──
    _exec(
        bind,
        """
        INSERT INTO addresses
            (tenant_id, bpna, owner_bpnl, name, address_type,
             country, subdivision, admin_area_level_2, city, postal_code,
             street, house_number, address_line2, state, metadata)
        VALUES
            (1, :bpna, :owner, :name, 'legal_address',
             'IN', 'IN-RJ', 'Udaipur', 'Udaipur', '313004',
             'Yashad Bhawan, Yashadgarh', NULL, NULL, 'active', CAST(:meta AS jsonb))
        ON CONFLICT (bpna) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            owner_bpnl = EXCLUDED.owner_bpnl,
            name = EXCLUDED.name,
            address_type = EXCLUDED.address_type,
            country = EXCLUDED.country,
            subdivision = EXCLUDED.subdivision,
            admin_area_level_2 = EXCLUDED.admin_area_level_2,
            city = EXCLUDED.city,
            postal_code = EXCLUDED.postal_code,
            street = EXCLUDED.street,
            metadata = EXCLUDED.metadata,
            updated_at = now();
        """,
        {
            "bpna": bpn.HZL_REGISTERED_BPNA,
            "owner": bpn.HZL_BPNL,
            "name": "Hindustan Zinc Limited — Registered Office",
            "meta": _jsonb({"role": "registered_office"}),
        },
    )

    # ── Legal entity ─────────────────────────────────────────────────────
    _exec(
        bind,
        """
        INSERT INTO legal_entities
            (tenant_id, bpnl, legal_name, legal_form, short_name, trade_name,
             country, subdivision, registered_address_bpna, did,
             state, incorporated_on, metadata)
        VALUES
            (1, :bpnl, 'Hindustan Zinc Limited', 'Public Limited Company', 'HZL',
             'Vedanta Hindustan Zinc',
             'IN', 'IN-RJ', :reg_bpna, :did,
             'active', :inc_date, CAST(:meta AS jsonb))
        ON CONFLICT (bpnl) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            legal_name = EXCLUDED.legal_name,
            legal_form = EXCLUDED.legal_form,
            short_name = EXCLUDED.short_name,
            trade_name = EXCLUDED.trade_name,
            country = EXCLUDED.country,
            subdivision = EXCLUDED.subdivision,
            registered_address_bpna = EXCLUDED.registered_address_bpna,
            did = EXCLUDED.did,
            state = EXCLUDED.state,
            incorporated_on = EXCLUDED.incorporated_on,
            metadata = EXCLUDED.metadata,
            updated_at = now();
        """,
        {
            "bpnl": bpn.HZL_BPNL,
            "reg_bpna": bpn.HZL_REGISTERED_BPNA,
            "did": HZL_DID,
            "inc_date": HZL_INCORPORATION_DATE,
            "meta": _jsonb(
                {
                    "parent": "Vedanta Limited",
                    "promoter_stake_pct_2026_03": 60.71,
                    "goi_stake_pct": 27.92,
                    "icmm_member": True,
                    "icmm_join_date": HZL_ICMM_JOIN_DATE,
                    "first_indian_icmm_member": True,
                    "stock_exchanges": ["NSE", "BSE"],
                    "renewable_energy_target_2027": ">70% RE share",
                    "serentica_re_mw": 530,
                    "captive_wind_mw": 273.5,
                }
            ),
        },
    )

    # ── Identifiers ──────────────────────────────────────────────────────
    for ident in LE_IDENTIFIERS:
        _exec(
            bind,
            """
            INSERT INTO legal_entity_identifiers
                (tenant_id, bpnl, category, type, value, issuing_country, issuing_body, metadata)
            VALUES
                (1, :bpnl, :category, :type, :value, :country, :body, '{}'::jsonb)
            ON CONFLICT (bpnl, type, value) DO UPDATE SET
                category = EXCLUDED.category,
                issuing_country = EXCLUDED.issuing_country,
                issuing_body = EXCLUDED.issuing_body;
            """,
            {
                "bpnl": bpn.HZL_BPNL,
                "category": ident["category"],
                "type": ident["type"],
                "value": ident["value"],
                "country": ident["issuing_country"],
                "body": ident["issuing_body"],
            },
        )

    # ── Site addresses + sites ───────────────────────────────────────────
    for site in SITES:
        # Address (each producing site has a dedicated BPNA, depot addresses
        # are sparse but still BPN-keyed).
        _exec(
            bind,
            """
            INSERT INTO addresses
                (tenant_id, bpna, owner_bpnl, name, address_type,
                 country, subdivision, admin_area_level_2, city, postal_code,
                 street, house_number, address_line2, state, metadata)
            VALUES
                (1, :bpna, :owner, :name, 'site_main_address',
                 'IN', :sub, :adm2, :city, :pin,
                 :street, NULL, NULL, 'active', '{}'::jsonb)
            ON CONFLICT (bpna) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                owner_bpnl = EXCLUDED.owner_bpnl,
                name = EXCLUDED.name,
                address_type = EXCLUDED.address_type,
                country = EXCLUDED.country,
                subdivision = EXCLUDED.subdivision,
                admin_area_level_2 = EXCLUDED.admin_area_level_2,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                street = EXCLUDED.street,
                updated_at = now();
            """,
            {
                "bpna": site["address_bpna"],
                "owner": bpn.HZL_BPNL,
                "name": site["name"],
                "sub": site["subdivision"],
                "adm2": site["admin_area_level_2"],
                "city": site["city"],
                "pin": site["postal_code"],
                "street": site["street"],
            },
        )

        # Site
        _exec(
            bind,
            """
            INSERT INTO sites
                (tenant_id, bpns, owner_bpnl, name, function,
                 main_address_bpna, production_capacity, state, metadata)
            VALUES
                (1, :bpns, :owner, :name, :function,
                 :addr, CAST(:capacity AS jsonb), 'active', CAST(:meta AS jsonb))
            ON CONFLICT (bpns) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                owner_bpnl = EXCLUDED.owner_bpnl,
                name = EXCLUDED.name,
                function = EXCLUDED.function,
                main_address_bpna = EXCLUDED.main_address_bpna,
                production_capacity = EXCLUDED.production_capacity,
                metadata = EXCLUDED.metadata,
                updated_at = now();
            """,
            {
                "bpns": site["bpns"],
                "owner": bpn.HZL_BPNL,
                "name": site["name"],
                "function": site["function"],
                "addr": site["address_bpna"],
                "capacity": _jsonb(site["production_capacity"]),
                "meta": _jsonb(site["metadata"]),
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    _exec(
        bind,
        "DELETE FROM legal_entity_identifiers WHERE bpnl = :bpnl",
        {"bpnl": bpn.HZL_BPNL},
    )
    _exec(bind, "DELETE FROM sites WHERE owner_bpnl = :bpnl", {"bpnl": bpn.HZL_BPNL})
    _exec(bind, "DELETE FROM legal_entities WHERE bpnl = :bpnl", {"bpnl": bpn.HZL_BPNL})
    _exec(bind, "DELETE FROM addresses WHERE owner_bpnl = :bpnl", {"bpnl": bpn.HZL_BPNL})
    # Revert tenant 1 — best-effort, leaves slug/legal_name in HZL state if user
    # has no record of original EGA values; that's fine for a destructive downgrade.
