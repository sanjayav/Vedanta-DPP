"""Seed canonical process chain + DPP version attribute manifests + HZL portfolio.

Idempotent: each seed function uses ON CONFLICT DO NOTHING so re-running on
boot is safe. Called from a `pnpm api:seed` console script and from the
`/api/v1/products/seed` tenant-admin endpoint.

The data here mirrors the Hindustan Zinc product portfolio (EcoZen SHG,
CGG Jumbo, Refined Lead 99.99) and the SDD §11 process taxonomy aligned to
the Roast-Leach-Electrowinning (RLE) hydrometallurgical zinc route plus the
pyrometallurgical Pb-Zn route at Chanderiya. Three concerns:

  1. Process steps  — the canonical stages every product flows through.
  2. DPP manifests  — for each (step, dpp_version), the attribute roster.
  3. Product seeds  — HZL's brand portfolio mapped to forms + chains.
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
        "name": "Underground Pb-Zn mining",
        "ordinal": 1,
        "tier": "upstream",
        "description": (
            "Extraction of zinc-lead (and silver-bearing) ore from HZL's underground "
            "mines — Rampura Agucha, Sindesar Khurd, Rajpura Dariba, Zawar, Kayad."
        ),
    },
    {
        "slug": "concentration",
        "name": "Beneficiation / concentration",
        "ordinal": 2,
        "tier": "upstream",
        "description": (
            "Crushing, grinding and differential flotation at the mine concentrators — "
            "produces Zn and Pb concentrates feeding Chanderiya / Dariba / Debari."
        ),
    },
    {
        "slug": "roasting",
        "name": "Roasting (Zn concentrate → calcine)",
        "ordinal": 3,
        "tier": "upstream",
        "description": (
            "Fluidised-bed roasting of zinc concentrate to zinc oxide calcine; "
            "off-gas SO2 captured and converted to sulphuric acid."
        ),
    },
    {
        "slug": "power_generation",
        "name": "Power generation",
        "ordinal": 4,
        "tier": "upstream",
        "description": (
            "Captive coal-fired CPPs + 530 MW Serentica round-the-clock RE PDA "
            "+ 273.5 MW captive wind. Track Scope-2 emission factors per shift."
        ),
    },
    {
        "slug": "smelting",
        "name": "Smelting (RLE / ISP)",
        "ordinal": 5,
        "tier": "production",
        "description": (
            "Roast-Leach-Electrowinning (RLE) hydrometallurgical zinc route — "
            "leaching, purification, electrowinning of cathode zinc. Pyro Pb-Zn at CLZS."
        ),
    },
    {
        "slug": "alloying",
        "name": "Molten metal alloying",
        "ordinal": 6,
        "tier": "production",
        "description": (
            "Holding furnace alloying — adding Al, Pb, Cd, Sb to meet IS 209 / "
            "EN 1179 / ASTM B6 / ASTM B852 (CGG) target chemistry."
        ),
    },
    {
        "slug": "casting",
        "name": "Casthouse casting",
        "ordinal": 7,
        "tier": "production",
        "description": (
            "Continuous casting of 25 kg ingots and 1 t jumbo blocks for galvanising "
            "and refined-lead customers; LME-marked ingots for trade."
        ),
    },
    {
        "slug": "lab_qc",
        "name": "Quality lab (chemistry + physical)",
        "ordinal": 8,
        "tier": "production",
        "description": (
            "NABL-accredited HZL lab — ICP-OES chemistry, XRF, mass-balance, "
            "physical tolerance checks per IS 209 / IS 27 / ASTM B852."
        ),
    },
    {
        "slug": "packaging",
        "name": "Packaging & dispatch",
        "ordinal": 9,
        "tier": "downstream",
        "description": (
            "PET-strapped 1 t bundles or jumbo blocks on wooden runners; dispatched "
            "to depots (Hyderabad, Pune, Chennai, Kolkata, Jamshedpur, Faridabad, "
            "Bengaluru, Raipur) and direct customers."
        ),
    },
    {
        "slug": "verification",
        "name": "Third-party verification",
        "ordinal": 10,
        "tier": "verification",
        "description": (
            "Independent assurance over PCF, EPD, ICMM, IZA Zinc Mark, ILA "
            "stewardship, ISO 14001/45001/50001."
        ),
    },
    {
        "slug": "customer",
        "name": "Customer delivery",
        "ordinal": 11,
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
        "origin.oreSource",
        "Ore source mine (Rampura Agucha / SK / RD / Zawar / Kayad)",
        "mandatory",
        "ESPR Annex III §3.a",
    ),
    ("mining", "1.0", "origin.mineBpns", "Mine BPNS (CX-0010)", "mandatory", "Chem-X §11"),
    (
        "mining",
        "1.5",
        "mining.oreGradePctZn",
        "Ore grade (% Zn)",
        "mandatory",
        "JRC zinc reference report",
    ),
    (
        "mining",
        "1.5",
        "mining.tailingsGenerationKgPerTonne",
        "Tailings generation (kg/t ore)",
        "mandatory",
        "ESPR Art 5(1)(j)",
    ),
    (
        "mining",
        "2",
        "mining.biodiversityImpactScore",
        "Biodiversity impact score",
        "mandatory",
        "ICMM Mining Principles",
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
        "mining.efBiodiversity",
        "EF 3.1 biodiversity / land use",
        "mandatory",
        "EF 3.1 + EU DPP Registry",
    ),
    # ── CONCENTRATION ───────────────────────────────────────────────────
    (
        "concentration",
        "1.0",
        "origin.concentratorBpns",
        "Concentrator BPNS",
        "mandatory",
        "ESPR Annex III §3",
    ),
    (
        "concentration",
        "1.0",
        "carbon.decomposition.concentrationKgCo2e",
        "PCF — concentration (kg CO2e/kg)",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "concentration",
        "1.5",
        "concentration.energyMixGwhMix",
        "Energy mix (GWh by fuel)",
        "mandatory",
        "GHG Protocol",
    ),
    (
        "concentration",
        "1.5",
        "concentration.concentrateGradePctZn",
        "Concentrate grade (% Zn)",
        "mandatory",
        "JRC zinc reference report",
    ),
    (
        "concentration",
        "2",
        "concentration.flotationReagentsKgPerTonne",
        "Flotation reagent consumption (kg/t)",
        "mandatory",
        "EF 3.1",
    ),
    # ── ROASTING ────────────────────────────────────────────────────────
    (
        "roasting",
        "1.0",
        "carbon.decomposition.roastingKgCo2e",
        "PCF — roasting (kg CO2e/kg)",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "roasting",
        "1.5",
        "roasting.so2CaptureEfficiencyPct",
        "SO2 capture efficiency (%)",
        "mandatory",
        "BAT-AEL non-ferrous metals",
    ),
    (
        "roasting",
        "2",
        "roasting.acidPlantOutputTpa",
        "Sulphuric acid output (t/yr)",
        "voluntary",
        "Internal · acid plant log",
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
        "power.pdaReference",
        "PDA / PPA reference (e.g. Serentica RE PDA)",
        "mandatory",
        "ESPR Annex III §4",
    ),
    (
        "power_generation",
        "1.0",
        "story.energyMixRenewablePercent",
        "Renewable electricity share (%)",
        "mandatory",
        "ESPR Annex III §4",
    ),
    (
        "power_generation",
        "1.5",
        "power.gridEmissionFactorGCo2PerKwh",
        "Grid emission factor (g CO2e/kWh)",
        "mandatory",
        "CEA / IEA",
    ),
    (
        "power_generation",
        "1.5",
        "power.specificEnergyKwhPerKgMetal",
        "Specific energy (kWh/kg metal)",
        "mandatory",
        "JRC zinc reference",
    ),
    (
        "power_generation",
        "2",
        "power.guaranteesOfOriginRef",
        "Renewable Energy Certificates / I-REC reference",
        "mandatory",
        "I-REC India / GoO",
    ),
    # ── SMELTING ────────────────────────────────────────────────────────
    ("smelting", "1.0", "origin.smelterBpns", "Smelter BPNS", "mandatory", "Chem-X §11"),
    (
        "smelting",
        "1.0",
        "carbon.decomposition.smeltingKgCo2e",
        "PCF — smelting / electrowinning (kg CO2e/kg)",
        "mandatory",
        "ISO 14067:2018",
    ),
    (
        "smelting",
        "1.0",
        "carbon.decomposition.electricityKgCo2e",
        "PCF — electricity (Scope 2)",
        "mandatory",
        "GHG Protocol",
    ),
    (
        "smelting",
        "1.0",
        "smelting.processRoute",
        "Process route (RLE / ISP)",
        "mandatory",
        "HZL Technology Booklet",
    ),
    (
        "smelting",
        "1.5",
        "smelting.cellCurrentDensityAPerM2",
        "Cell current density (A/m2)",
        "mandatory",
        "JRC zinc reference",
    ),
    (
        "smelting",
        "1.5",
        "smelting.currentEfficiencyPct",
        "Current efficiency (%)",
        "mandatory",
        "JRC zinc reference",
    ),
    (
        "smelting",
        "1.5",
        "smelting.netSpecificEnergyKwhPerKg",
        "Net specific energy (kWh/kg metal)",
        "mandatory",
        "JRC zinc reference",
    ),
    (
        "smelting",
        "2",
        "smelting.siteSpecificPcf",
        "Site-specific PCF (vs IZA / ILA default)",
        "mandatory",
        "Chem-X Sustainability §6",
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
        "smelting.spentElectrolyteRecyclingPct",
        "Spent electrolyte / residue recycling (%)",
        "voluntary",
        "ESPR Art 5(1)(l)",
    ),
    (
        "smelting",
        "4",
        "smelting.efAcidification",
        "EF 3.1 acidification potential",
        "mandatory",
        "EF 3.1",
    ),
    # ── ALLOYING ───────────────────────────────────────────────────────
    (
        "alloying",
        "1.0",
        "chemistry.gradeCode",
        "Target grade code",
        "mandatory",
        "IS 209 / IS 27 / ASTM B852",
    ),
    (
        "alloying",
        "1.0",
        "chemistry.metal",
        "Primary metal (zinc / lead)",
        "mandatory",
        "Chem-X Material ID",
    ),
    (
        "alloying",
        "1.5",
        "chemistry.alloyingElementsKg",
        "Alloying elements added (kg by element)",
        "mandatory",
        "ASTM B852-13 §A",
    ),
    (
        "alloying",
        "1.5",
        "alloying.holdingFurnaceTempC",
        "Holding furnace temperature (°C)",
        "voluntary",
        "HZL Lab SOP",
    ),
    (
        "alloying",
        "2",
        "alloying.grainRefinerKgPerTonne",
        "Grain refiner consumption (kg/t)",
        "voluntary",
        "ASTM B852",
    ),
    # ── CASTING ────────────────────────────────────────────────────────
    ("casting", "1.0", "identification.castNumber", "Cast number", "mandatory", "ESPR Art 5(1)(b)"),
    (
        "casting",
        "1.0",
        "identification.casthouseBpns",
        "Casthouse BPNS",
        "mandatory",
        "Chem-X §11",
    ),
    (
        "casting",
        "1.0",
        "identification.gradeCode",
        "Grade code (IS / EN / ASTM)",
        "mandatory",
        "IS 209 / IS 27 / ASTM B852",
    ),
    (
        "casting",
        "1.0",
        "identification.metal",
        "Metal (zinc / lead)",
        "mandatory",
        "Chem-X Material ID",
    ),
    ("casting", "1.0", "physical.weightKg", "Net weight (kg)", "mandatory", "ESPR Annex III §5"),
    (
        "casting",
        "1.0",
        "physical.form",
        "Form (ingot_25kg / jumbo_1t)",
        "mandatory",
        "ESPR Annex III §1",
    ),
    (
        "casting",
        "1.0",
        "carbon.decomposition.castingKgCo2e",
        "PCF — casting",
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
        "Full elemental chemistry (impurities)",
        "mandatory",
        "IS 209 / IS 27",
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
        "Mechanical properties (where applicable)",
        "voluntary",
        "ASTM B852-13",
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
        "ISO 22095",
    ),
    (
        "casting",
        "4",
        "casting.efResourceUseFossils",
        "EF 3.1 resource use (fossils)",
        "mandatory",
        "EF 3.1",
    ),
    # ── LAB QC ─────────────────────────────────────────────────────────
    (
        "lab_qc",
        "1.0",
        "chemistry.pbMaxPct",
        "Lead content (Pb %) — zinc grades",
        "mandatory",
        "IS 209:1992",
    ),
    (
        "lab_qc",
        "1.0",
        "chemistry.cdMaxPct",
        "Cadmium content (Cd %) — zinc grades",
        "mandatory",
        "IS 209:1992",
    ),
    (
        "lab_qc",
        "1.0",
        "compliance.iso17025",
        "ISO/IEC 17025 lab accreditation (NABL)",
        "mandatory",
        "ISO/IEC 17025:2017",
    ),
    (
        "lab_qc",
        "1.5",
        "lab.spectrometerSerial",
        "Spectrometer instrument serial",
        "voluntary",
        "HZL Lab SOP",
    ),
    (
        "lab_qc",
        "1.5",
        "lab.testCertificateRef",
        "Test certificate reference",
        "mandatory",
        "ISO/IEC 17025 §7.8",
    ),
    (
        "lab_qc",
        "1.0",
        "physical.tolerances.massPerIngot",
        "Per-ingot mass tolerance band",
        "mandatory",
        "IS 209 / IS 27",
    ),
    (
        "lab_qc",
        "1.0",
        "physical.tolerances.bundleMass",
        "Bundle mass tolerance",
        "mandatory",
        "IS 209 / IS 27",
    ),
    (
        "lab_qc",
        "1.0",
        "chemistry.purityGrade",
        "Purity grade (Zn 99.995 / Zn 99.95 / Pb 99.99)",
        "mandatory",
        "IS 209 / IS 27",
    ),
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
        "Strapping material (PET / steel)",
        "mandatory",
        "ESPR Annex III §5",
    ),
    (
        "packaging",
        "1.5",
        "packaging.runnerMaterial",
        "Runner material",
        "voluntary",
        "HZL Product Booklet",
    ),
    (
        "packaging",
        "1.5",
        "logistics.dispatchSiteBpns",
        "Dispatch site BPNS",
        "mandatory",
        "Chem-X §11",
    ),
    (
        "packaging",
        "2",
        "logistics.shipmentMode",
        "Shipment mode (truck / sea / rail)",
        "mandatory",
        "GHG Protocol Scope 3",
    ),
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
    # ── VERIFICATION ───────────────────────────────────────────────────
    (
        "verification",
        "1.0",
        "carbon.verifierName",
        "PCF verifier name",
        "mandatory",
        "ISO 14067 §6",
    ),
    ("verification", "1.0", "carbon.verifierDid", "PCF verifier DID", "mandatory", "W3C VC 2.0"),
    (
        "verification",
        "1.0",
        "carbon.verificationStatementRef",
        "PCF statement reference",
        "mandatory",
        "ISO 14067 §6",
    ),
    (
        "verification",
        "1.0",
        "compliance.izaZincMark",
        "IZA Zinc Mark certification (zinc)",
        "mandatory",
        "International Zinc Association",
    ),
    (
        "verification",
        "1.0",
        "compliance.ilaStewardship",
        "ILA Lead Stewardship (lead)",
        "mandatory",
        "International Lead Association",
    ),
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
    (
        "verification",
        "1.0",
        "carbon.declaredUnit",
        "PCF declared unit (1 kg metal)",
        "mandatory",
        "ISO 14067 §6.4",
    ),
    (
        "verification",
        "1.0",
        "carbon.systemBoundary",
        "PCF system boundary (cradle-to-gate)",
        "mandatory",
        "ISO 14067 §5",
    ),
    (
        "verification",
        "1.0",
        "carbon.methodology",
        "PCF methodology (ISO 14067 + IPCC AR6)",
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
        "carbon.industryAverageKgCo2ePerKg",
        "Industry average PCF (peer reference, kg CO2e/kg)",
        "recommended",
        "IZA / ILA",
    ),
    (
        "verification",
        "1.0",
        "recycledContent.chainOfCustodyModel",
        "Recycled-content CoC model",
        "mandatory",
        "ISO 22095",
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
        "Standard designation number (IS / ASTM)",
        "mandatory",
        "IS 209 / IS 27 / ASTM B852",
    ),
    (
        "casting",
        "1.0",
        "identification.productionRoute",
        "Production route (RLE / ISP / pyro)",
        "mandatory",
        "HZL Product Booklet",
    ),
    ("casting", "1.0", "identification.brand", "Product brand", "mandatory", "HZL Marketing"),
    ("casting", "1.0", "product.name", "Product display name", "mandatory", "ESPR Art 5(1)(a)"),
    (
        "casting",
        "1.0",
        "product.purposeStatement",
        "Purpose / intended use statement",
        "recommended",
        "ESPR Art 5(1)(a)",
    ),
]


# ── 3. HZL product portfolio ────────────────────────────────────────────
#
# These three slugs MUST match the wizard's product picker AND the canonical
# Chem-X preset IDs in `packages/schema/presets/`. The wizard pulls from
# the products table; the preset library pulls from the JSON files. Both
# converge on the same product identity here.

PRODUCTS: list[dict[str, Any]] = [
    {
        "slug": "zinc-ecozen",
        "name": "EcoZen — Special High Grade Zinc 99.995%",
        "brand": "EcoZen",
        "alloy_family": "IS 209:1992 Zn99.995",
        "form": "ingot_25kg",
        "description": (
            "Asia's first low-carbon zinc — cradle-to-gate carbon footprint "
            "approximately 0.95 kg CO2e/kg, about 75% below the IZA global "
            "SHG average. Produced at Chanderiya Lead-Zinc Smelter, India's "
            "first IZA Zinc Mark certified site (April 2026). LME-registered "
            "as 'Vedanta SHG 99.995'. EPD-IES-0006472:001."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Galvanising · automotive · infrastructure",
            "flagshipBrand": True,
            "renewableElectricityPct": 70,
            "site": "Chanderiya",
            "siteBpns": "BPNSHZSCHA00012N",
            "tradeName": "EcoZen",
            "metal": "zinc",
            "purityPercent": 99.995,
            "gradeCode": "EcoZen-SHG",
            "lmeRegisteredBrand": "Vedanta SHG 99.995",
            "epdReference": "EPD-IES-0006472:001",
            "pcfKgCo2ePerKg": 0.95,
            "industryAverageKgCo2ePerKg": 3.7,
            "presetId": "zinc-ecozen-shg-99-995",
        },
        # Full HZL chain — RLE hydrometallurgical zinc with verification.
        "chain": [
            "mining",
            "concentration",
            "roasting",
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
        "slug": "zinc-cgg",
        "name": "CGG Zinc Jumbo — Continuous Galvanising Grade",
        "brand": "CGG",
        "alloy_family": "ASTM B852-13 CGG",
        "form": "jumbo_1t",
        "description": (
            "Continuous Galvanising Grade zinc per ASTM B852-13, supplied as "
            "1 t jumbo blocks for high-throughput galvanising lines. Trade "
            "name 'CGG Jumbo'. Cradle-to-gate PCF approximately 3.4 kg CO2e/kg. "
            "Tata Steel and similar OEM partnerships."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Continuous galvanising lines",
            "site": "Chanderiya",
            "siteBpns": "BPNSHZSCHA00012N",
            "tradeName": "CGG Jumbo",
            "metal": "zinc",
            "purityPercent": 99.95,
            "gradeCode": "CGG-Jumbo",
            "pcfKgCo2ePerKg": 3.4,
            "presetId": "zinc-cgg-jumbo",
        },
        "chain": [
            "mining",
            "concentration",
            "roasting",
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
        "slug": "lead",
        "name": "Refined Lead 99.99% — Vedanta brand",
        "brand": "Vedanta 99.99",
        "alloy_family": "IS 27:2023 Pb 99.99",
        "form": "ingot_25kg",
        "description": (
            "LME-registered refined lead 99.99% under the brand 'Vedanta 99.99'. "
            "Conforms to IS 27:2023 (Pig Lead) and BS EN 12659. Produced via "
            "the pyrometallurgical Pb-Zn route at Chanderiya and the hydro RLE "
            "route at Dariba Smelting Complex. PCF approximately 1.6 kg CO2e/kg."
        ),
        "details": {
            "featured": True,
            "primaryIndustry": "Energy storage · cable sheathing · radiation shielding",
            "site": "Chanderiya / Dariba",
            "siteBpns": "BPNSHZSCHA00012N",
            "tradeName": "Vedanta 99.99",
            "metal": "lead",
            "purityPercent": 99.99,
            "gradeCode": "Pb-99.99",
            "lmeRegisteredBrand": "Vedanta 99.99",
            "pcfKgCo2ePerKg": 1.6,
            "presetId": "lead-pure-99-99",
        },
        "chain": [
            "mining",
            "concentration",
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
