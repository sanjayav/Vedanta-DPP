"""Seed canonical process chain + DPP version attribute manifests + EGA portfolio.

Idempotent: each seed function uses ON CONFLICT DO NOTHING so re-running on
boot is safe. Called from a `pnpm api:seed` console script and from the
`/api/v1/products/seed` tenant-admin endpoint.

The data here mirrors `EGA_DPP_Version_Manifests.xlsx` and the SDD §11
process taxonomy. Three concerns:

  1. Process steps  — the SIX canonical stages every product flows through.
  2. DPP manifests  — for each (step, dpp_version), the attribute roster.
  3. Product seeds  — EGA's brand portfolio mapped to forms + chains.
"""

from __future__ import annotations

from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DppManifestAttr,
    ProcessStep,
    Product,
    ProductProcessChain,
)

# ── 1. Canonical process steps ───────────────────────────────────────────

PROCESS_STEPS: list[dict[str, Any]] = [
    {
        "slug": "mining",
        "name": "Bauxite mining",
        "ordinal": 1,
        "tier": "upstream",
        "description": "Extraction of bauxite ore from supplier mine sites (typically Guinea, Brazil, Australia).",
    },
    {
        "slug": "refining",
        "name": "Alumina refining",
        "ordinal": 2,
        "tier": "upstream",
        "description": "Bayer process at EGA Al Taweelah — bauxite → alumina (Al₂O₃).",
    },
    {
        "slug": "anode_production",
        "name": "Anode production",
        "ordinal": 3,
        "tier": "upstream",
        "description": "Pre-baked carbon anodes manufactured at EGA's carbon plants for the reduction cells.",
    },
    {
        "slug": "power_generation",
        "name": "Power generation",
        "ordinal": 4,
        "tier": "upstream",
        "description": "Combined-cycle gas turbine plants at Jebel Ali + DEWA Mohammed bin Rashid Al Maktoum Solar Park PPA (CelestiAL).",
    },
    {
        "slug": "smelting",
        "name": "Smelting (electrolysis)",
        "ordinal": 5,
        "tier": "production",
        "description": "Hall-Heroult electrolysis using EGA DX+ Ultra reduction cells (465 kA, 12.8 kWh/kg Al).",
    },
    {
        "slug": "alloying",
        "name": "Molten metal alloying",
        "ordinal": 6,
        "tier": "production",
        "description": "Holding furnace alloying — adding Si, Mg, Cu, Mn, Fe, Sr to meet EN/AA target chemistry.",
    },
    {
        "slug": "casting",
        "name": "Casthouse casting",
        "ordinal": 7,
        "tier": "production",
        "description": "DC casting (Airslip for billets, Low Head Composite for sheet ingots) — liquid → ingot/billet/slab/sow.",
    },
    {
        "slug": "homogenisation",
        "name": "Homogenisation & ultrasound",
        "ordinal": 8,
        "tier": "production",
        "description": "Continuous + batch homogenisation, ultrasound non-destructive inspection (billets only).",
    },
    {
        "slug": "lab_qc",
        "name": "Quality lab (chemistry + mechanical)",
        "ordinal": 9,
        "tier": "production",
        "description": "ISO/IEC 17025 + IATF 16949 lab — spectrometric chemistry, mechanical properties, surface QA.",
    },
    {
        "slug": "semis",
        "name": "Semi-fabrication",
        "ordinal": 10,
        "tier": "downstream",
        "description": "Extrusion / rolling / forging at customer or partner (downstream).",
    },
    {
        "slug": "packaging",
        "name": "Packaging & dispatch",
        "ordinal": 11,
        "tier": "downstream",
        "description": "Steel-strapped or plastic-strapped bundles on wooden runners; 90,000 truck movements/yr from EGA sites.",
    },
    {
        "slug": "verification",
        "name": "Third-party verification",
        "ordinal": 12,
        "tier": "verification",
        "description": "DNV / BV / ASI assurance over CFP, recycled content, ASI Performance, ASI CoC.",
    },
    {
        "slug": "customer",
        "name": "Customer delivery",
        "ordinal": 13,
        "tier": "downstream",
        "description": "Shipment to the final customer with the DPP attached. Resolved via GS1 Digital Link.",
    },
]


# ── 2. DPP version attribute manifests per process step ─────────────────
# Columns: (step_slug, dpp_version, attribute_path, label, necessity, anchor)

MANIFEST: list[tuple[str, str, str, str, str, str | None]] = [
    # ── MINING ──────────────────────────────────────────────────────────
    (
        "mining",
        "1.0",
        "origin.bauxiteSource",
        "Bauxite source country/site",
        "mandatory",
        "ESPR Annex III §3.a",
    ),
    ("mining", "1.0", "origin.mineUfi", "Mine UFI", "mandatory", "EU Tracker — UFI registry"),
    ("mining", "1.5", "mining.oreGradePctAl2O3", "Ore grade (% Al₂O₃)", "mandatory", "JRC §7.2"),
    (
        "mining",
        "1.5",
        "mining.redMudGenerationKgPerTonne",
        "Red-mud generation (kg/t bauxite)",
        "mandatory",
        "ESPR Art 5(1)(j)",
    ),
    (
        "mining",
        "2",
        "mining.biodiversityImpactScore",
        "Biodiversity impact score",
        "mandatory",
        "Aluminium Delegated Act",
    ),
    (
        "mining",
        "2",
        "mining.waterStressRegion",
        "Water-stress region (WRI Aqueduct)",
        "mandatory",
        "ESPR Annex III §6",
    ),
    (
        "mining",
        "3",
        "mining.communityImpactStatement",
        "Community / human-rights statement",
        "voluntary",
        "OECD Due Diligence Guidance",
    ),
    (
        "mining",
        "4",
        "mining.pefBiodiversity",
        "PEF biodiversity (16 categories)",
        "mandatory",
        "PEF v3.1 + EU DPP Registry",
    ),
    # ── REFINING ────────────────────────────────────────────────────────
    (
        "refining",
        "1.0",
        "origin.aluminaRefinery",
        "Refinery name + UFI",
        "mandatory",
        "ESPR Annex III §3",
    ),
    (
        "refining",
        "1.0",
        "carbon.decomposition.aluminaProduction",
        "CFP — alumina production (kg CO₂e/t)",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "refining",
        "1.5",
        "refining.energyMixGwhMix",
        "Energy mix (GWh by fuel)",
        "mandatory",
        "GHG Protocol",
    ),
    (
        "refining",
        "1.5",
        "refining.bauxiteToAluminaRatio",
        "Bauxite-to-alumina ratio",
        "mandatory",
        "JRC §7.2",
    ),
    (
        "refining",
        "2",
        "refining.causticSodaConsumptionKgPerTonne",
        "Caustic soda consumption (kg/t)",
        "mandatory",
        "PEF v3.1",
    ),
    (
        "refining",
        "2",
        "refining.steamSourceMix",
        "Steam source mix",
        "mandatory",
        "Aluminium Delegated Act",
    ),
    (
        "refining",
        "3",
        "refining.bauxiteResidueLandUsageHa",
        "Bauxite residue land usage (ha)",
        "voluntary",
        "ESPR Art 5(1)(k)",
    ),
    (
        "refining",
        "4",
        "refining.pefImpactCategories",
        "All 16 PEF categories",
        "mandatory",
        "PEF v3.1",
    ),
    # ── ANODE PRODUCTION ────────────────────────────────────────────────
    (
        "anode_production",
        "1.0",
        "carbon.decomposition.anodeProduction",
        "CFP — anode production",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "anode_production",
        "1.5",
        "anode.netCarbonConsumptionKgPerTonne",
        "Net carbon consumption (kg/t Al)",
        "mandatory",
        "JRC §7.3",
    ),
    (
        "anode_production",
        "2",
        "anode.cokeSource",
        "Petroleum coke source declaration",
        "mandatory",
        "EU Aluminium Delegated Act",
    ),
    (
        "anode_production",
        "3",
        "anode.bakeFurnaceFuelMix",
        "Bake furnace fuel mix",
        "voluntary",
        "GHG Protocol",
    ),
    # ── POWER GENERATION ───────────────────────────────────────────────
    (
        "power_generation",
        "1.0",
        "power.sourceMix",
        "Power source mix (% by source)",
        "mandatory",
        "GHG Protocol Scope 2",
    ),
    (
        "power_generation",
        "1.0",
        "power.ppaReference",
        "PPA reference (e.g. DEWA MBR Solar Park)",
        "mandatory",
        "ESPR Annex III §4",
    ),
    (
        "power_generation",
        "1.0",
        "story.energyMixSolarPercent",
        "Renewable electricity share (%)",
        "mandatory",
        "ESPR Annex III §4",
    ),
    (
        "power_generation",
        "1.5",
        "power.gridEmissionFactorGCo2PerKwh",
        "Grid emission factor (g CO₂e/kWh)",
        "mandatory",
        "IEA / DEFRA",
    ),
    (
        "power_generation",
        "1.5",
        "power.specificEnergyKwhPerKgAl",
        "Specific energy (kWh/kg Al)",
        "mandatory",
        "IAI v2.0",
    ),
    (
        "power_generation",
        "2",
        "power.guaranteesOfOriginRef",
        "Renewable Energy Certificates / GoO reference",
        "mandatory",
        "Aluminium Delegated Act",
    ),
    # ── SMELTING ────────────────────────────────────────────────────────
    ("smelting", "1.0", "origin.smelterUfi", "Smelter UFI", "mandatory", "EU UFI registry"),
    (
        "smelting",
        "1.0",
        "carbon.decomposition.electrolysis",
        "CFP — electrolysis",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "smelting",
        "1.0",
        "carbon.decomposition.electricity",
        "CFP — electricity (Scope 2)",
        "mandatory",
        "GHG Protocol",
    ),
    (
        "smelting",
        "1.0",
        "smelting.cellTechnology",
        "Cell technology (DX+, DX+ Ultra, D18+, D20+)",
        "mandatory",
        "EGA Technology Booklet",
    ),
    ("smelting", "1.5", "smelting.amperageKa", "Cell amperage (kA)", "mandatory", "JRC §7.4"),
    (
        "smelting",
        "1.5",
        "smelting.currentEfficiencyPct",
        "Current efficiency (%)",
        "mandatory",
        "JRC §7.4",
    ),
    (
        "smelting",
        "1.5",
        "smelting.netSpecificEnergyKwhPerKgAl",
        "Net specific energy (kWh/kg Al)",
        "mandatory",
        "IAI v2.0",
    ),
    (
        "smelting",
        "1.5",
        "smelting.aeFrequencyPerPotDay",
        "Anode-effect frequency (AE/pot-day)",
        "mandatory",
        "IAI v2.0",
    ),
    (
        "smelting",
        "1.5",
        "smelting.pfcEmissionsKgCo2ePerTonne",
        "PFC emissions (kg CO₂e/t)",
        "mandatory",
        "IAI v2.0",
    ),
    (
        "smelting",
        "2",
        "smelting.siteSpecificCfp",
        "Site-specific CFP (vs IAI default)",
        "mandatory",
        "Aluminium Delegated Act",
    ),
    (
        "smelting",
        "2",
        "smelting.cbamFreeAllocationT",
        "CBAM free allocation (tonnes)",
        "mandatory",
        "Reg (EU) 2023/956",
    ),
    (
        "smelting",
        "3",
        "smelting.spentPotliningRecyclingPct",
        "Spent pot-lining recycling (%)",
        "voluntary",
        "ESPR Art 5(1)(l)",
    ),
    (
        "smelting",
        "4",
        "smelting.pefAcidification",
        "PEF acidification potential",
        "mandatory",
        "PEF v3.1",
    ),
    # ── ALLOYING ───────────────────────────────────────────────────────
    (
        "alloying",
        "1.0",
        "chemistry.targetAlloyEn",
        "Target alloy designation (EN)",
        "mandatory",
        "EN 573-3",
    ),
    (
        "alloying",
        "1.0",
        "chemistry.targetAlloyAa",
        "Target alloy designation (AA)",
        "mandatory",
        "Aluminum Association",
    ),
    (
        "alloying",
        "1.5",
        "chemistry.alloyingElementsKg",
        "Alloying elements added (kg by element)",
        "mandatory",
        "EN 573-3 §A",
    ),
    (
        "alloying",
        "1.5",
        "alloying.holdingFurnaceTempC",
        "Holding furnace temperature (°C)",
        "voluntary",
        "EGA Lab SOP",
    ),
    (
        "alloying",
        "2",
        "alloying.grainRefinerKgPerTonne",
        "Grain refiner consumption (kg/t)",
        "voluntary",
        "EN 573-3",
    ),
    # ── CASTING ────────────────────────────────────────────────────────
    ("casting", "1.0", "identification.castNumber", "Cast number", "mandatory", "ESPR Art 5(1)(b)"),
    ("casting", "1.0", "identification.casthouseUfi", "Casthouse UFI", "mandatory", "EU UFI"),
    ("casting", "1.0", "identification.alloyEn", "Alloy designation (EN)", "mandatory", "EN 573-3"),
    (
        "casting",
        "1.0",
        "identification.alloyAa",
        "Alloy designation (AA)",
        "mandatory",
        "Aluminum Association",
    ),
    ("casting", "1.0", "physical.weightKg", "Net weight (kg)", "mandatory", "ESPR Annex III §5"),
    (
        "casting",
        "1.0",
        "physical.form",
        "Form (billet / slab / ingot)",
        "mandatory",
        "ESPR Annex III §1",
    ),
    (
        "casting",
        "1.0",
        "carbon.decomposition.casting",
        "CFP — casting",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "casting",
        "1.0",
        "recycledContent.totalPercent",
        "Recycled content (%)",
        "mandatory",
        "ESPR Art 5(1)(l)",
    ),
    (
        "casting",
        "1.5",
        "chemistry.fullElementalBreakdown",
        "Full elemental chemistry (47 elements)",
        "mandatory",
        "EN 573-3 §A",
    ),
    (
        "casting",
        "1.5",
        "physical.dimensions",
        "Physical dimensions",
        "mandatory",
        "ESPR Annex III §1",
    ),
    (
        "casting",
        "1.5",
        "casting.mechanicalProperties",
        "Mechanical properties (yield, UTS, elongation)",
        "mandatory",
        "EN 754 / EN 755",
    ),
    (
        "casting",
        "2",
        "casting.solidificationRateMmPerMin",
        "Solidification rate (mm/min)",
        "voluntary",
        "JRC §7.5",
    ),
    (
        "casting",
        "3",
        "casting.scrapInputMassBalance",
        "Scrap input mass-balance",
        "mandatory",
        "GRS / RCS",
    ),
    (
        "casting",
        "4",
        "casting.pefResourceUseFossils",
        "PEF resource use (fossils)",
        "mandatory",
        "PEF v3.1",
    ),
    # ── HOMOGENISATION ─────────────────────────────────────────────────
    (
        "homogenisation",
        "1.0",
        "homogenisation.process",
        "Homogenisation process (continuous / batch)",
        "mandatory",
        "EGA Product Booklet",
    ),
    (
        "homogenisation",
        "1.0",
        "homogenisation.ultrasoundPassed",
        "Ultrasound NDT pass/fail",
        "mandatory",
        "EN 12517",
    ),
    (
        "homogenisation",
        "1.5",
        "homogenisation.holdingTemperatureC",
        "Holding temperature (°C)",
        "mandatory",
        "EGA Process SOP",
    ),
    (
        "homogenisation",
        "1.5",
        "homogenisation.durationMinutes",
        "Soak duration (minutes)",
        "voluntary",
        "EGA Process SOP",
    ),
    (
        "homogenisation",
        "2",
        "homogenisation.coolingRateCPerMin",
        "Cooling rate (°C/min)",
        "voluntary",
        "JRC §7.5",
    ),
    # ── LAB QC ─────────────────────────────────────────────────────────
    ("lab_qc", "1.0", "chemistry.feMaxPct", "Iron content (Fe %)", "mandatory", "EN 573-3"),
    ("lab_qc", "1.0", "chemistry.siMaxPct", "Silicon content (Si %)", "mandatory", "EN 573-3"),
    (
        "lab_qc",
        "1.0",
        "compliance.iso17025",
        "ISO/IEC 17025 lab accreditation",
        "mandatory",
        "ISO/IEC 17025:2017",
    ),
    (
        "lab_qc",
        "1.5",
        "lab.spectrometerSerial",
        "Spectrometer instrument serial",
        "voluntary",
        "EGA Lab SOP",
    ),
    (
        "lab_qc",
        "1.5",
        "lab.testCertificateRef",
        "Test certificate reference",
        "mandatory",
        "ISO/IEC 17025 §7.8",
    ),
    ("lab_qc", "2", "lab.surfaceQualityClass", "Surface quality class", "voluntary", "EN 573-3"),
    # ── PACKAGING ──────────────────────────────────────────────────────
    (
        "packaging",
        "1.0",
        "packaging.bundleMass",
        "Bundle mass (kg)",
        "mandatory",
        "ESPR Annex III §5",
    ),
    (
        "packaging",
        "1.0",
        "packaging.strappingMaterial",
        "Strapping material (steel / plastic)",
        "mandatory",
        "ESPR Annex III §5",
    ),
    (
        "packaging",
        "1.5",
        "packaging.runnerMaterial",
        "Runner material",
        "voluntary",
        "EGA Product Booklet",
    ),
    ("packaging", "1.5", "logistics.dispatchSiteUfi", "Dispatch site UFI", "mandatory", "EU UFI"),
    (
        "packaging",
        "2",
        "logistics.shipmentMode",
        "Shipment mode (truck / sea / rail)",
        "mandatory",
        "GHG Protocol Scope 3",
    ),
    # ── SEMIS ──────────────────────────────────────────────────────────
    (
        "semis",
        "1.5",
        "semis.fabricationProcess",
        "Fabrication process (extrusion / rolling / forging)",
        "mandatory",
        "EN 754 / EN 755",
    ),
    ("semis", "1.5", "semis.temperDesignation", "Temper (T6, H14, …)", "mandatory", "EN 515"),
    (
        "semis",
        "2",
        "semis.downstreamCfpKgCo2ePerTonne",
        "Downstream CFP (incremental)",
        "mandatory",
        "Aluminium Delegated Act",
    ),
    # ── VERIFICATION ───────────────────────────────────────────────────
    (
        "verification",
        "1.0",
        "carbon.verifierName",
        "CFP verifier name",
        "mandatory",
        "ISO 14067 §6",
    ),
    ("verification", "1.0", "carbon.verifierDid", "CFP verifier DID", "mandatory", "W3C VC 2.0"),
    (
        "verification",
        "1.0",
        "carbon.verificationStatementRef",
        "CFP statement reference",
        "mandatory",
        "ISO 14067 §6",
    ),
    (
        "verification",
        "1.0",
        "compliance.asiPerformance",
        "ASI Performance accreditation",
        "mandatory",
        "ASI Performance V3.1",
    ),
    ("verification", "1.0", "compliance.asiCoc", "ASI CoC reference", "mandatory", "ASI CoC v2"),
    (
        "verification",
        "1.0",
        "compliance.iso14001",
        "ISO 14001 status",
        "mandatory",
        "ISO 14001:2015",
    ),
    (
        "verification",
        "1.5",
        "verification.scope3VerifierAttestation",
        "Scope 3 verification attestation",
        "mandatory",
        "ISO 14064-3",
    ),
    (
        "verification",
        "2",
        "verification.cbamSubmissionRef",
        "CBAM Registry submission reference",
        "mandatory",
        "Reg (EU) 2023/956",
    ),
    # ── CUSTOMER ───────────────────────────────────────────────────────
    ("customer", "1.0", "upi.gtin", "GTIN", "mandatory", "GS1 §3"),
    ("customer", "1.0", "upi.itemSerial", "Item serial", "mandatory", "GS1 §3"),
    (
        "customer",
        "1.0",
        "upi.digitalLinkUrl",
        "Digital Link URL",
        "mandatory",
        "GS1 Digital Link 1.3",
    ),
    ("customer", "1.0", "upi.lotNumber", "Lot / batch number", "mandatory", "GS1 §3"),
    (
        "customer",
        "1.0",
        "upi.taricCode",
        "TARIC code (EU customs)",
        "mandatory",
        "Council Reg 2658/87",
    ),
    ("customer", "1.0", "upi.hsCode", "HS code (WCO)", "mandatory", "WCO Harmonized System"),
    (
        "customer",
        "1.0",
        "upi.esprProductCategory",
        "ESPR product category",
        "mandatory",
        "ESPR Annex II",
    ),
    (
        "customer",
        "1.0",
        "useAndLife.installationInformation",
        "Installation information",
        "recommended",
        "ESPR Art 5(1)(c)",
    ),
    (
        "customer",
        "1.0",
        "useAndLife.useInstructions",
        "Use instructions",
        "recommended",
        "ESPR Art 5(1)(c)",
    ),
    (
        "customer",
        "1.0",
        "useAndLife.maintenanceInformation",
        "Maintenance information",
        "recommended",
        "ESPR Art 5(1)(c)",
    ),
    ("customer", "1.0", "useAndLife.warnings", "Safety warnings", "mandatory", "ESPR Art 5(1)(c)"),
    (
        "customer",
        "1.0",
        "useAndLife.safetyInformation",
        "Safety information",
        "mandatory",
        "ESPR Art 5(1)(c)",
    ),
    (
        "customer",
        "1.0",
        "circularity.recyclabilityIndicator",
        "Recyclability indicator",
        "mandatory",
        "ESPR Art 5(1)(b)",
    ),
    (
        "customer",
        "1.0",
        "circularity.disposalInformation",
        "Disposal information",
        "mandatory",
        "ESPR Art 5(1)(b)",
    ),
    (
        "customer",
        "1.0",
        "circularity.recyclingInformation",
        "Recycling information",
        "mandatory",
        "ESPR Art 5(1)(b)",
    ),
    (
        "customer",
        "1.0",
        "circularity.materialRecoveryPotential",
        "Material recovery potential",
        "recommended",
        "ESPR Art 5(1)(b)",
    ),
    ("customer", "1.0", "espr.durability", "Durability statement", "mandatory", "ESPR Art 5(1)(a)"),
    (
        "customer",
        "1.0",
        "espr.reliability",
        "Reliability statement",
        "recommended",
        "ESPR Art 5(1)(a)",
    ),
    (
        "customer",
        "1.0",
        "espr.energyEfficiency",
        "Energy efficiency statement",
        "recommended",
        "ESPR Art 5(1)(d)",
    ),
    (
        "customer",
        "1.0",
        "espr.resourceEfficiency",
        "Resource efficiency statement",
        "recommended",
        "ESPR Art 5(1)(d)",
    ),
    (
        "customer",
        "1.5",
        "useAndLife.expectedLifeYears",
        "Expected life (years)",
        "voluntary",
        "ESPR Art 5(1)(c)",
    ),
    (
        "customer",
        "1.5",
        "espr.repairability",
        "Repairability statement",
        "recommended",
        "ESPR Art 5(1)(a)",
    ),
    (
        "customer",
        "1.5",
        "espr.upgradability",
        "Upgradability statement",
        "voluntary",
        "ESPR Art 5(1)(a)",
    ),
    (
        "customer",
        "1.5",
        "espr.reusability",
        "Reusability statement",
        "voluntary",
        "ESPR Art 5(1)(a)",
    ),
    (
        "customer",
        "1.5",
        "espr.maintenance",
        "Maintenance protocol",
        "voluntary",
        "ESPR Art 5(1)(a)",
    ),
    (
        "customer",
        "2",
        "useAndLife.repairabilityScore",
        "Repairability score",
        "voluntary",
        "ESPR Art 5(1)(d)",
    ),
    (
        "customer",
        "3",
        "useAndLife.endOfLifeRoute",
        "End-of-life recycling route",
        "mandatory",
        "ESPR Art 5(1)(m)",
    ),
    (
        "customer",
        "3",
        "circularity.disassemblyInformation",
        "Disassembly information",
        "mandatory",
        "ESPR Art 5(1)(b)",
    ),
    # ── CASTING (extended for v1.0 — identification + product fields) ──
    (
        "casting",
        "1.0",
        "identification.designationNumber",
        "AA / EN designation number",
        "mandatory",
        "EN 573-3",
    ),
    ("casting", "1.0", "identification.temper", "Temper (T6, H14, F, …)", "mandatory", "EN 515"),
    (
        "casting",
        "1.0",
        "identification.productionRoute",
        "Production route (primary / re-melt)",
        "mandatory",
        "EGA Product Booklet",
    ),
    ("casting", "1.0", "identification.brand", "Product brand", "mandatory", "EGA Marketing"),
    ("casting", "1.0", "product.name", "Product display name", "mandatory", "ESPR Art 5(1)(a)"),
    (
        "casting",
        "1.0",
        "product.purposeStatement",
        "Purpose / intended use statement",
        "recommended",
        "ESPR Art 5(1)(a)",
    ),
    # ── PACKAGING (producer + SoC summary) ────────────────────────────
    ("packaging", "1.0", "producer.name", "Producer legal name", "mandatory", "ESPR Art 5(1)(e)"),
    (
        "packaging",
        "1.0",
        "producer.trademark",
        "Producer trademark",
        "recommended",
        "ESPR Art 5(1)(e)",
    ),
    (
        "packaging",
        "1.0",
        "producer.registeredAddress",
        "Producer registered address",
        "mandatory",
        "ESPR Art 5(1)(e)",
    ),
    (
        "packaging",
        "1.0",
        "producer.regulatoryContact.email",
        "Regulatory contact email",
        "mandatory",
        "ESPR Art 5(1)(e)",
    ),
    (
        "packaging",
        "1.0",
        "producer.regulatoryContact.team",
        "Regulatory contact team",
        "recommended",
        "ESPR Art 5(1)(e)",
    ),
    (
        "packaging",
        "1.0",
        "soc.summaryStatement",
        "Substances of Concern summary",
        "mandatory",
        "ESPR Art 5(1)(j) · ECHA SCIP",
    ),
    # ── LAB QC (physical tolerances + chemistry purity) ─────────────────
    (
        "lab_qc",
        "1.0",
        "physical.tolerances.diameter",
        "Diameter tolerance band",
        "mandatory",
        "EN 573-3",
    ),
    (
        "lab_qc",
        "1.0",
        "physical.tolerances.lengthBow",
        "Length / bow tolerance",
        "mandatory",
        "EN 573-3",
    ),
    (
        "lab_qc",
        "1.0",
        "physical.tolerances.squareness",
        "Squareness tolerance",
        "recommended",
        "EN 573-3",
    ),
    (
        "lab_qc",
        "1.0",
        "chemistry.purityGrade",
        "Purity grade (P0202A, P0303A, P1020, …)",
        "mandatory",
        "Aluminum Association",
    ),
    # ── VERIFICATION (carbon methodology + assurance) ─────────────────
    (
        "verification",
        "1.0",
        "carbon.declaredUnit",
        "CFP declared unit (1 t Al)",
        "mandatory",
        "ISO 14067 §6.4",
    ),
    (
        "verification",
        "1.0",
        "carbon.systemBoundary",
        "CFP system boundary (cradle-to-gate)",
        "mandatory",
        "ISO 14067 §5",
    ),
    (
        "verification",
        "1.0",
        "carbon.methodology",
        "CFP methodology (ISO 14067 + IAI v2.0)",
        "mandatory",
        "ISO 14067 §6",
    ),
    (
        "verification",
        "1.0",
        "carbon.assuranceLevel",
        "Assurance level (limited / reasonable)",
        "mandatory",
        "ISAE 3410 / ISO 14064-3",
    ),
    (
        "verification",
        "1.0",
        "carbon.industryAverageKgCo2ePerTonne",
        "Industry average CFP (peer reference)",
        "recommended",
        "IAI v2.0",
    ),
    (
        "verification",
        "1.0",
        "recycledContent.chainOfCustodyModel",
        "Recycled-content CoC model",
        "mandatory",
        "ASI CoC v2",
    ),
]


# ── 3. EGA product portfolio ────────────────────────────────────────────

PRODUCTS: list[dict[str, Any]] = [
    {
        "slug": "celestial",
        "name": "CelestiAL Extrusion Billet",
        "brand": "CelestiAL",
        "alloy_family": "EN AW-6063",
        "form": "extrusion_billet",
        "description": (
            "World's first solar-powered aluminium. CFP 4,273 kg CO₂e/t, "
            "verified by DNV under ISO 14067:2018. Powered 100% by DEWA "
            "Mohammed bin Rashid Al Maktoum Solar Park PPA. Airslip-cast, "
            "ultrasound-inspected, homogenised billets Ø152–406 mm."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Construction & transportation",
            "flagshipBrand": True,
            "renewableElectricityPct": 100,
            "site": "Jebel Ali",
            "diametersMm": [152, 178, 203, 228, 254, 305, 355, 406],
            "lengthRangeMm": {"min": 420, "max": 7500},
        },
        # Full EGA chain — billets include alloying + homogenisation.
        "chain": [
            "mining",
            "refining",
            "anode_production",
            "power_generation",
            "smelting",
            "alloying",
            "casting",
            "homogenisation",
            "lab_qc",
            "packaging",
            "verification",
            "customer",
        ],
    },
    {
        "slug": "celestial_r",
        "name": "CelestiAL-R Sheet Ingot",
        "brand": "CelestiAL-R",
        "alloy_family": "EN AW-5754",
        "form": "sheet_ingot",
        "description": (
            "Solar-powered primary blended with verified post-consumer "
            "scrap under ASI Chain-of-Custody V2.1 (mass-balance). "
            "Low Head Composite cast, up to 10 m × 2.2 m × 600 mm sheet "
            "ingot for packaging, can-stock and automotive sheet."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Packaging & automotive sheet",
            "recycledContentPct": 80,
            "chainOfCustody": "mass_balance",
            "asiCertificateRef": "ASI CoC #428",
            "site": "Jebel Ali",
            "thicknessMmMax": 600,
            "widthRangeMm": {"min": 1150, "max": 2200},
            "lengthMmMax": 10000,
        },
        # Sheet ingots: alloying applies; no homogenisation step (homogenised at customer).
        "chain": [
            "mining",
            "refining",
            "anode_production",
            "power_generation",
            "smelting",
            "alloying",
            "casting",
            "lab_qc",
            "packaging",
            "verification",
            "customer",
        ],
    },
    {
        "slug": "standard",
        "name": "Standard Sow Ingot",
        "brand": "Standard",
        "alloy_family": "P1020A",
        "form": "sow_ingot",
        "description": (
            "Production-grade primary aluminium sow ingot from EGA's "
            "combined-cycle gas route. AA registered P1020A purity. "
            "Standard form factor for re-melt foundry customers."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Re-melt foundry & general re-melt",
            "benchmark": True,
            "purityGrade": "P1020A",
            "site": "Al Taweelah",
            "lowProfileSowKg": 680,
            "highProfileSowKg": 500,
        },
        # Re-melt sow ingot: simpler chain — no alloying, no homogenisation.
        "chain": [
            "mining",
            "refining",
            "anode_production",
            "power_generation",
            "smelting",
            "casting",
            "lab_qc",
            "packaging",
            "customer",
        ],
    },
    {
        "slug": "high_purity",
        "name": "High-Purity Ingot",
        "brand": "EGA HP",
        "alloy_family": "P0202A / 4N",
        "form": "primary_ingot",
        "description": (
            "99.96%+ purity from selected Jebel Ali pots, used in "
            "specialist aviation, electronics, capacitors, and cathodic "
            "protection. AA registered P1020, P0507A, P0303A, P0404A, "
            "P0304A, P0202A."
        ),
        "details": {
            "featured": False,
            "primaryIndustry": "Electronics & aerospace",
            "purityPct": 99.96,
            "site": "Jebel Ali",
        },
        "chain": [
            "mining",
            "refining",
            "anode_production",
            "power_generation",
            "smelting",
            "casting",
            "lab_qc",
            "packaging",
            "verification",
            "customer",
        ],
    },
    {
        "slug": "foundry_alloy",
        "name": "Foundry Alloys",
        "brand": "EGA Foundry",
        "alloy_family": "A356.2 / AlSiXXMg",
        "form": "foundry_alloy",
        "description": (
            "Casting alloys for automotive die-cast (wheel rims, sub-"
            "frames, suspension parts, engine blocks, cylinder heads). "
            "Chemistry pre-tuned to customer specification — Sr-modified "
            "or unmodified."
        ),
        "details": {
            "featured": False,
            "primaryIndustry": "Automotive die-cast",
            "endUse": "automotive die-cast",
            "alloyOptions": [
                "A356.2",
                "AlSi3Sr",
                "AlSi3Mg",
                "AlSi7Mg",
                "AlSi9Mg",
                "AlSi9MgMn",
                "AlSi10Mg",
                "AlSi10MgMn",
                "AlSi11Mg",
                "AlSiMgCu",
            ],
        },
        "chain": [
            "mining",
            "refining",
            "anode_production",
            "power_generation",
            "smelting",
            "alloying",
            "casting",
            "lab_qc",
            "packaging",
            "customer",
        ],
    },
]


# ── Seed runner ─────────────────────────────────────────────────────────


async def seed_canonical_data(session: AsyncSession, tenant_id: int) -> dict[str, int]:
    """Idempotent seed. Returns counts of rows inserted vs skipped."""
    counts = {
        "process_steps": 0,
        "manifest_attrs": 0,
        "products": 0,
        "chain_links": 0,
    }

    # 1. process_steps
    for s in PROCESS_STEPS:
        stmt = (
            pg_insert(cast(Any, ProcessStep.__table__))
            .values(**s)
            .on_conflict_do_nothing(index_elements=["slug"])
        )
        result = await session.execute(stmt)
        counts["process_steps"] += _inserted_count(result)

    # 2. manifest attrs — need step ids first
    step_id_by_slug: dict[str, int] = {}
    for row in (await session.execute(select(ProcessStep.slug, ProcessStep.id))).all():
        step_id_by_slug[row.slug] = row.id

    for step_slug, version, attr, label, nec, anchor in MANIFEST:
        sid = step_id_by_slug.get(step_slug)
        if sid is None:
            continue
        stmt = (
            pg_insert(cast(Any, DppManifestAttr.__table__))
            .values(
                process_step_id=sid,
                dpp_version=version,
                attribute_path=attr,
                label=label,
                necessity=nec,
                regulatory_anchor=anchor,
            )
            .on_conflict_do_nothing(
                index_elements=["process_step_id", "dpp_version", "attribute_path"]
            )
        )
        result = await session.execute(stmt)
        counts["manifest_attrs"] += _inserted_count(result)

    # 3. products + chains
    for p in PRODUCTS:
        chain = p["chain"]
        product_values = {k: v for k, v in p.items() if k != "chain"}
        product_stmt = (
            pg_insert(cast(Any, Product.__table__))
            .values(tenant_id=tenant_id, **product_values)
            .on_conflict_do_nothing(index_elements=["tenant_id", "slug"])
            .returning(Product.id)
        )
        result = await session.execute(product_stmt)
        new_id = result.scalar()
        if new_id is None:
            existing = await session.scalar(
                select(Product.id).where(
                    Product.tenant_id == tenant_id,
                    Product.slug == product_values["slug"],
                )
            )
            new_id = existing
        else:
            counts["products"] += 1
        if new_id is None:
            continue

        for ordinal, step_slug in enumerate(chain, start=1):
            sid = step_id_by_slug.get(step_slug)
            if sid is None:
                continue
            link_stmt = (
                pg_insert(cast(Any, ProductProcessChain.__table__))
                .values(product_id=new_id, process_step_id=sid, ordinal=ordinal)
                .on_conflict_do_nothing(index_elements=["product_id", "process_step_id"])
            )
            link_result = await session.execute(link_stmt)
            counts["chain_links"] += _inserted_count(link_result)

    await session.flush()
    return counts


def _inserted_count(result: Any) -> int:
    return int(getattr(result, "rowcount", 0) or 0)
