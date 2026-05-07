/**
 * Demo passport bank · three HZL passports rendered statically so the public
 * viewer paints rich content even when the API is offline. Bodies follow the
 * v1.0.0 DPP schema and mirror the shape that
 * `apps/web-public/src/lib/dpp-client.ts::synthesizeFromPreset` and
 * `apps/api/dpp_api/services/generator.py` emit, with extra storytelling and
 * media fields that a real-world EPD-published passport carries.
 *
 * The three:
 *   1. ecozen   · EcoZen SHG 99.995 · Asia's first low-carbon zinc · marquee
 *   2. zinc-cgg · Continuous Galvanising Grade · Tata Steel anchor product
 *   3. lead     · Vedanta Refined Lead 99.99 · LME-registered brand
 *
 * `matchDemoPassport(upi)` resolves an arbitrary UPI to one of the three by
 * keyword / GTIN / BPNL pattern; misses return null.
 */

export type DemoAudience = 'public' | 'customer' | 'verifier' | 'authority'
export type DemoSlug = 'ecozen' | 'zinc-cgg' | 'lead'

export interface DemoPassport {
  slug: DemoSlug
  upiCanonical: string
  qrPayload: string
  signature: { algorithm: string; value: string; bodySha256: string }
  body: Record<string, unknown>
}

const ISSUED_AT = new Date('2026-04-22T08:30:00Z').toISOString()
const EXPIRES_AT = new Date('2036-04-22T08:30:00Z').toISOString()
const LCIA_VALID_UNTIL = '2029-04-22'

const HZL_BPNL = 'BPNLHZL0000001QX'
const ISSUER_DID = `did:web:passport.hzlindia.com:${HZL_BPNL}`
const RESOLVER_HOST = 'https://passport.hzlindia.com'

const HZL_PRODUCER = {
  bpnl: HZL_BPNL,
  legalName: 'Hindustan Zinc Limited',
  legalForm: 'Public Limited Company',
  shortName: 'HZL',
  tradeName: 'Vedanta · Hindustan Zinc',
  registeredAddressBpna: 'BPNAHZAREG0001IG',
  country: 'IN',
  identifiers: [
    { category: 'NBR', type: 'CIN', value: 'L27204RJ1966PLC001208', issuingCountry: 'IN', issuingBody: 'MCA' },
    { category: 'IBR', type: 'LEI', value: '335800LB39TLJ8YTWM98', issuingBody: 'GLEIF' },
    { category: 'TIN', type: 'PAN', value: 'AAACH7354K', issuingCountry: 'IN' },
    { category: 'VAT', type: 'GSTIN', value: '08AAACH7354K1ZB', issuingCountry: 'IN' },
    { category: 'OTH', type: 'ISIN', value: 'INE267A01025', issuingCountry: 'IN' },
    { category: 'OTH', type: 'NSE_TICKER', value: 'HINDZINC', issuingCountry: 'IN' },
    { category: 'OTH', type: 'BSE_CODE', value: '500188', issuingCountry: 'IN' },
  ],
  regulatoryContact: {
    team: 'HZL Regulatory Affairs',
    email: 'infohzl@vedanta.co.in',
  },
} as const

const SITES = {
  chanderiya: {
    bpns: 'BPNSHZSCHA00012N',
    name: 'Chanderiya Lead-Zinc Smelter (CLZS)',
    function: 'smelter_hydro',
    country: 'IN',
  },
  dariba: {
    bpns: 'BPNSHZSDAR00027L',
    name: 'Dariba Smelting Complex',
    function: 'smelter_hydro',
    country: 'IN',
  },
  pantnagar: {
    bpns: 'BPNSHZSPNT00041J',
    name: 'Pantnagar Refinery',
    function: 'refinery_silver',
    country: 'IN',
  },
  rampuraAgucha: {
    bpns: 'BPNSHZMRAG00056H',
    name: 'Rampura Agucha Mine',
    function: 'mine',
    country: 'IN',
  },
  sindesarKhurd: {
    bpns: 'BPNSHZMSKM00068F',
    name: 'Sindesar Khurd Mine',
    function: 'mine',
    country: 'IN',
  },
} as const

function uuidFor(slug: DemoSlug): string {
  // Deterministic v4-shaped UUID for demo records.
  const seed = `hzl-${slug}-2026-04-22`
  const hex = Array.from(seed)
    .reduce((acc, c) => acc + c.charCodeAt(0).toString(16).padStart(2, '0'), '')
    .padEnd(32, '0')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function buildMeta(slug: DemoSlug) {
  return {
    createdAt: ISSUED_AT,
    lastUpdated: ISSUED_AT,
    expiresAt: EXPIRES_AT,
    lciaValidUntil: LCIA_VALID_UNTIL,
    lifecycleState: 'published',
    languages: ['en', 'hi'],
    issuerDid: ISSUER_DID,
    accessRights: {
      model: 'three_tier_vc_gated',
      publicFields: [
        'materialId',
        'identification',
        'producer',
        'origin',
        'product',
        'physical',
        'sustainability',
        'recycledContent',
        'compliance',
        'circularity',
        'espr',
        'documentation',
        'meta',
      ],
    },
    tenantId: 1,
    complianceScore: slug === 'ecozen' ? 99 : slug === 'zinc-cgg' ? 96 : 97,
  }
}

function buildMaterialId(slug: DemoSlug, uuid: string) {
  return {
    did: `${ISSUER_DID}?dpp=${uuid}`,
    uuid,
    resolverUrl: `${RESOLVER_HOST}/dpp/${HZL_BPNL}/${uuid}`,
    passportClass: 'dpp' as const,
  }
}

// ── Body builders ──────────────────────────────────────────────────────────

function ecozenBody(): Record<string, unknown> {
  const uuid = uuidFor('ecozen')
  return {
    schemaVersion: '1.0.0',
    passportType: 'DPP',
    materialId: {
      ...buildMaterialId('ecozen', uuid),
      speakingCodes: {
        casNumber: '7440-66-6',
        ecNumber: '231-175-3',
        hsnCode: '79011200',
        lmeBrandName: 'Vedanta SHG 99.995',
        bisStandard: 'IS 209:1992 — Zn99.995',
      },
    },
    identification: {
      metal: 'zinc',
      gradeCode: 'EcoZen-SHG',
      tradeName: 'EcoZen',
      purityPercent: 99.995,
      designation: 'EcoZen — Special High Grade Zinc 99.995%',
      form: 'ingot_25kg',
      applicableStandards: ['IS 209:1992', 'BS EN 1179:2003', 'ASTM B6-18'],
    },
    producer: HZL_PRODUCER,
    origin: {
      country: 'IN',
      subdivision: 'IN-RJ',
      manufacturingDate: '2026-04-15',
      manufacturingBatch: 'CHA-ECOZEN-2026-04-15',
      sites: [SITES.chanderiya, SITES.rampuraAgucha],
    },
    product: {
      name: 'EcoZen — Special High Grade Zinc 99.995%',
      purposeStatement:
        "Asia's first low-carbon zinc — cradle-to-gate carbon footprint <1 t CO2e/t Zn, ~75% below the IZA global SHG average. Produced at Chanderiya, India's first IZA Zinc Mark certified site (April 2026).",
      intendedMarkets: [
        'galvanising',
        'automotive',
        'infrastructure',
        'renewable_energy_structures',
        'electronics',
        'energy_storage',
      ],
      intendedRegions: ['IN', 'AE', 'DE', 'JP', 'KR', 'TW', 'US'],
    },
    physical: {
      unitMassKg: 25,
      unitMassToleranceKg: 2,
      bundleMassKg: 1000,
      bundleMassToleranceKg: 50,
      unitsPerBundle: 40,
      dimensions: { lengthMm: 435, widthMm: 110, heightMm: 80, tolerance: '±5' },
      bundleDimensions: { lengthMm: 960, widthMm: 470, heightMm: 475, tolerance: '±10' },
      packaging: {
        strapMaterial: 'PET strapping',
        palletised: true,
        markings: 'vedanta SHG 99.995 / EcoZen logo',
      },
    },
    chemistry: {
      composition: [
        { element: 'Zn', casNumber: '7440-66-6', role: 'primary', guaranteedMinPercent: 99.995, typicalAssayPercent: 99.996, method: 'ICP-OES (NABL HZL lab)' },
        { element: 'Pb', casNumber: '7439-92-1', role: 'impurity', guaranteedMaxPercent: 0.003, typicalAssayPercent: 0.002, method: 'ICP-OES' },
        { element: 'Cd', casNumber: '7440-43-9', role: 'impurity', guaranteedMaxPercent: 0.003, typicalAssayPercent: 0.0002, method: 'ICP-OES' },
        { element: 'Fe', casNumber: '7439-89-6', role: 'impurity', guaranteedMaxPercent: 0.002, typicalAssayPercent: 0.001, method: 'ICP-OES' },
        { element: 'Cu', casNumber: '7440-50-8', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Sn', casNumber: '7440-31-5', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Al', casNumber: '7429-90-5', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
      ],
    },
    sustainability: {
      pcf: {
        value: 0.95,
        unit: 'kg CO2e/kg',
        declaredUnit: '1 kg of unpackaged EcoZen SHG zinc ingot at factory gate, Chanderiya, India',
        systemBoundary: 'cradle_to_gate',
        method: { framework: 'IPCC_AR6', version: 'GWP100y', characterizationModel: 'ISO 14067:2018 + IPCC AR6 GWP100y' },
        referenceYear: 2024,
        primaryDataSharePercent: 78,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
        cutOffPercent: 3,
        allocationMethod: 'physical_allocation',
        lciDatabase: { name: 'ecoinvent', version: '3.10' },
        assuranceLevel: 'limited',
        industryAverage: { value: 3.7, unit: 'kg CO2e/kg', source: 'IZA global SHG average', year: 2023 },
      },
      pcfBreakdown: {
        miningKgCo2e: 0.18,
        concentrationKgCo2e: 0.12,
        smeltingKgCo2e: 0.32,
        refiningKgCo2e: 0.11,
        castingKgCo2e: 0.07,
        electricityKgCo2e: 0.06,
        thermalEnergyKgCo2e: 0.05,
        transportInboundKgCo2e: 0.04,
      },
      resourceUseFossil: {
        value: 14.2, unit: 'MJ/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Van Oers et al. 2002 — LHV-based' },
        referenceYear: 2024, primaryDataSharePercent: 78,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      waterScarcity: {
        value: 4.8, unit: 'm3 world eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'AWARE (Boulay 2018), country=IN' },
        referenceYear: 2024, primaryDataSharePercent: 65,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      acidification: {
        value: 0.041, unit: 'mol H+ eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Accumulated Exceedance' },
        referenceYear: 2024, primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 2, temporal: 2 },
      },
      ozoneDepletion: {
        value: 1.2e-9, unit: 'kg CFC-11 eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'WMO 2014 ODP factors' },
        referenceYear: 2024, primaryDataSharePercent: 50,
        dataQualityRating: { overall: 3, technological: 3, geographical: 2, temporal: 3 },
      },
      photochemicalOzone: {
        value: 0.0089, unit: 'kg NMVOC eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'LOTOS-EUROS (Van Zelm 2008)' },
        referenceYear: 2024, primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 2, temporal: 2 },
      },
      renewableElectricityPercent: 70,
      epd: {
        registrationNumber: 'EPD-IES-0006472:001',
        programOperator: 'International EPD System (environdec.com)',
        publicationDate: '2023-01-16',
        validUntil: '2028-01-15',
        url: 'https://www.environdec.com/library/epd6472',
        pcr: 'PCR 2019:14 Construction products (EN 15804+A2), v1.3.4',
      },
    },
    recycledContent: {
      totalPercent: 0,
      preConsumerPercent: 0,
      postConsumerPercent: 0,
      chainOfCustodyModel: 'mass_balance',
    },
    compliance: {
      regulations: [
        { name: 'REACH', reference: 'EC 1907/2006 — Zinc (CAS 7440-66-6)', status: 'compliant', issuer: 'ECHA', validFrom: '2010-12-01' },
        { name: 'RoHS / ELV', reference: 'Cd <0.01%, Pb <0.1% per RoHS Annex II', status: 'compliant', issuer: 'EU' },
        { name: 'BIS — Refined Zinc', reference: 'IS 209:1992 — Zn99.995', status: 'compliant', issuer: 'Bureau of Indian Standards' },
        { name: 'CBAM declaration ready', reference: 'Regulation (EU) 2023/956', status: 'compliant', issuer: 'EU Commission' },
      ],
      certifications: [
        { name: 'ISO 9001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 14001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 45001:2018', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'EPD International', reference: 'EPD-IES-0006472:001', status: 'compliant', issuer: 'International EPD System', validFrom: '2023-01-16', validUntil: '2028-01-15' },
        { name: 'ICMM Mining Principles', status: 'compliant', issuer: 'ICMM', validFrom: '2025-08-13' },
        { name: 'IZA Zinc Mark — Chanderiya', status: 'compliant', issuer: 'International Zinc Association', validFrom: '2026-04-01' },
      ],
      lmeRegisteredBrand: {
        brandName: 'Vedanta SHG 99.995',
        url: 'https://www.lme.com/en/sustainability-and-physical-markets/brands/approved-brands',
      },
    },
    circularity: {
      recyclabilityIndicator: '100% — zinc is infinitely recyclable without loss of properties (IZA)',
      materialRecoveryPotential: '≥95% recovery in modern EAF dust recycling and Waelz kiln operations',
      reuseInformation: 'Process scrap remelted internally; spent galvanising bath returned for refining.',
      recyclingInformation: 'Refer to IZA Recycling Guide; secondary zinc recovered from steel-mill EAF dust globally.',
      disposalInformation: 'Never landfill — zinc is fully recyclable. Forward to certified non-ferrous metal recycler.',
    },
    espr: {
      durability: 'Inert metal at ambient conditions; protective galvanic action extends host steel life by decades.',
      reliability: 'Conforms to IS 209 / EN 1179 / ASTM B6 across the certified production batch.',
      reusability: 'Zinc can be re-melted and re-cast indefinitely.',
      energyEfficiency: 'Hydrometallurgical RLE route at Chanderiya, ISO 50001 certified.',
      resourceEfficiency: '≥95% in-process scrap recovery; tailings re-processed for residual metal.',
    },
    soc: { summaryStatement: 'no_svhc_above_threshold' },
    useAndLife: {
      storageInstructions: 'Store indoors, dry, well-ventilated. Keep packaging strapped until use.',
      handlingInstructions: 'Use approved lifting equipment for 1 t bundles. PPE: safety shoes, gloves, hi-vis.',
      safetyInformation: 'Solid metal — non-flammable. Molten zinc: see SDS for thermal-burn and zinc-fume-fever precautions.',
      sdsUrl: 'https://www.hzlindia.com/wp-content/uploads/SDS-Zinc.pdf',
    },
    documentation: {
      documents: [
        { id: 'doc-epd', title: 'EPD-IES-0006472:001 — EcoZen environmental declaration', url: 'https://www.environdec.com/library/epd6472', type: 'epd', issuer: 'International EPD System' },
        { id: 'doc-iso-9001', title: 'ISO 9001:2015 Quality Management', url: '/dpp-assets/docs/certs/doc-iso-9001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-iso-14001', title: 'ISO 14001:2015 Environmental Management', url: '/dpp-assets/docs/certs/doc-iso-14001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-icmm', title: 'ICMM Mining Principles · Member since 2025-08-13', url: 'https://www.icmm.com/en-gb/our-members', type: 'certificate', issuer: 'ICMM' },
        { id: 'doc-iza-mark', title: 'IZA Zinc Mark — Chanderiya site assessment', url: '/dpp-assets/docs/certs/doc-iza-zinc-mark.pdf', type: 'certificate', issuer: 'International Zinc Association' },
        { id: 'doc-sds', title: 'Safety Data Sheet · Refined Zinc', url: 'https://www.hzlindia.com/wp-content/uploads/SDS-Zinc.pdf', type: 'sds', issuer: 'HZL Regulatory Affairs' },
      ],
    },
    media: {
      productImage: '/dpp-assets/products/ecozen.jpg',
      productImageAlt: 'EcoZen 25 kg zinc ingots stacked into a 1 tonne bundle, marked with Vedanta SHG 99.995',
    },
    story: {
      headline: "Asia's first low-carbon zinc.",
      subhead: 'Less than 1 tonne CO₂e per tonne of metal — about 75% below the global SHG average.',
      bullets: [
        'Produced at Chanderiya, India\'s first IZA Zinc Mark certified smelter (April 2026).',
        "Backed by HZL's 530 MW renewable PDA with Serentica (round-the-clock RE).",
        'Tata Steel partnership: ~400 kg CO₂e saved per tonne of galvanised steel.',
      ],
    },
    meta: buildMeta('ecozen'),
  }
}

function cggBody(): Record<string, unknown> {
  const uuid = uuidFor('zinc-cgg')
  return {
    schemaVersion: '1.0.0',
    passportType: 'DPP',
    materialId: buildMaterialId('zinc-cgg', uuid),
    identification: {
      metal: 'zinc',
      gradeCode: 'CGG',
      tradeName: 'CGG Jumbo',
      purityPercent: 99.0,
      designation: 'CGG Zinc Jumbo — Continuous Galvanising Grade',
      form: 'jumbo_1t',
      applicableStandards: ['ASTM B852-13', 'BS EN 1179:2003', 'BIS'],
    },
    producer: HZL_PRODUCER,
    origin: {
      country: 'IN',
      subdivision: 'IN-RJ',
      manufacturingDate: '2026-04-18',
      manufacturingBatch: 'CHA-CGG-2026-04-18',
      sites: [SITES.chanderiya, SITES.dariba, SITES.sindesarKhurd],
    },
    product: {
      name: 'CGG Zinc Jumbo — Continuous Galvanising Grade',
      purposeStatement:
        'Aluminium-alloyed zinc jumbo for continuous hot-dip galvanising lines. ASTM B852-grade Al control (0.25–0.80%) gives the strip its ductile coating. The high-volume workhorse of HZL\'s zinc portfolio, supplied to Tata Steel and other galvanised-flat-steel producers.',
      intendedMarkets: ['galvanising', 'automotive', 'construction'],
      intendedRegions: ['IN', 'JP', 'KR'],
    },
    physical: {
      unitMassKg: 950,
      unitMassToleranceKg: 50,
      bundleMassKg: 1000,
      bundleMassToleranceKg: 50,
      unitsPerBundle: 1,
      dimensions: { lengthMm: 1020, widthMm: 398, heightMm: 420, tolerance: '±5' },
      bundleDimensions: { lengthMm: 1255, widthMm: 510, heightMm: 300, tolerance: '±10' },
      packaging: {
        strapMaterial: 'PET strapping',
        palletised: true,
        markings: 'vedanta CGG / suspension hook for crane lift',
      },
    },
    chemistry: {
      composition: [
        { element: 'Zn', casNumber: '7440-66-6', role: 'primary', guaranteedMinPercent: 99.0, method: 'ICP-OES' },
        { element: 'Al', casNumber: '7429-90-5', role: 'alloying', guaranteedMaxPercent: 0.8, guaranteedMinPercent: 0.25, method: 'ICP-OES — characteristic CGG bath-alloy' },
        { element: 'Fe', casNumber: '7439-89-6', role: 'impurity', guaranteedMaxPercent: 0.0075, method: 'ICP-OES' },
        { element: 'Pb', casNumber: '7439-92-1', role: 'impurity', guaranteedMaxPercent: 0.007, method: 'ICP-OES' },
        { element: 'Sn', casNumber: '7440-31-5', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Cd', casNumber: '7440-43-9', role: 'impurity', guaranteedMaxPercent: 0.0005, method: 'ICP-OES' },
        { element: 'Cu', casNumber: '7440-50-8', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
      ],
    },
    sustainability: {
      pcf: {
        value: 3.4,
        unit: 'kg CO2e/kg',
        declaredUnit: '1 kg of unpackaged CGG zinc jumbo at factory gate, Chanderiya, India',
        systemBoundary: 'cradle_to_gate',
        method: { framework: 'IPCC_AR6', version: 'GWP100y', characterizationModel: 'ISO 14067:2018 + IPCC AR6 GWP100y' },
        referenceYear: 2024,
        primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
        cutOffPercent: 3,
        allocationMethod: 'physical_allocation',
        lciDatabase: { name: 'ecoinvent', version: '3.10' },
        assuranceLevel: 'self_declared',
        industryAverage: { value: 3.7, unit: 'kg CO2e/kg', source: 'IZA global SHG average', year: 2023 },
      },
      pcfBreakdown: {
        miningKgCo2e: 0.55,
        concentrationKgCo2e: 0.42,
        smeltingKgCo2e: 1.45,
        refiningKgCo2e: 0.36,
        castingKgCo2e: 0.22,
        electricityKgCo2e: 0.18,
        thermalEnergyKgCo2e: 0.14,
        transportInboundKgCo2e: 0.08,
      },
      resourceUseFossil: {
        value: 38.4, unit: 'MJ/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Van Oers et al. 2002 — LHV-based' },
        referenceYear: 2024, primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      waterScarcity: {
        value: 7.6, unit: 'm3 world eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'AWARE (Boulay 2018), country=IN' },
        referenceYear: 2024, primaryDataSharePercent: 60,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      acidification: {
        value: 0.078, unit: 'mol H+ eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Accumulated Exceedance' },
        referenceYear: 2024, primaryDataSharePercent: 65,
        dataQualityRating: { overall: 3, technological: 2, geographical: 2, temporal: 2 },
      },
      ozoneDepletion: {
        value: 2.4e-9, unit: 'kg CFC-11 eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'WMO 2014 ODP factors' },
        referenceYear: 2024, primaryDataSharePercent: 45,
        dataQualityRating: { overall: 3, technological: 3, geographical: 2, temporal: 3 },
      },
      photochemicalOzone: {
        value: 0.014, unit: 'kg NMVOC eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'LOTOS-EUROS (Van Zelm 2008)' },
        referenceYear: 2024, primaryDataSharePercent: 65,
        dataQualityRating: { overall: 3, technological: 2, geographical: 2, temporal: 2 },
      },
      renewableElectricityPercent: 35,
    },
    recycledContent: {
      totalPercent: 0,
      preConsumerPercent: 0,
      postConsumerPercent: 0,
      chainOfCustodyModel: 'mass_balance',
    },
    compliance: {
      regulations: [
        { name: 'REACH', reference: 'EC 1907/2006 — Zinc (CAS 7440-66-6)', status: 'compliant', issuer: 'ECHA' },
        { name: 'RoHS / ELV', reference: 'Cd <0.01%, Pb <0.1% per RoHS Annex II', status: 'compliant', issuer: 'EU' },
        { name: 'ASTM B852-13', reference: 'CGG continuous galvanising grade', status: 'compliant', issuer: 'ASTM International' },
        { name: 'CBAM declaration ready', reference: 'Regulation (EU) 2023/956', status: 'compliant', issuer: 'EU Commission' },
      ],
      certifications: [
        { name: 'ISO 9001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 14001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 45001:2018', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ICMM Mining Principles', status: 'compliant', issuer: 'ICMM', validFrom: '2025-08-13' },
      ],
    },
    circularity: {
      recyclabilityIndicator: '100% — galvanised steel is recovered with the zinc layer in EAF dust',
      materialRecoveryPotential: 'Recovered globally via Waelz kiln route from EAF dust (~3 Mt/y zinc).',
      reuseInformation: 'Spent galvanising bath dross returned to refining circuit.',
      recyclingInformation: 'Standard non-ferrous remelt; check IZA recycling guidance.',
      disposalInformation: 'Never landfill — forward dross to certified non-ferrous recycler.',
    },
    espr: {
      durability: 'Galvanic protection extends host-steel life 25–50 years in atmospheric service.',
      reliability: 'Conforms to ASTM B852 across certified batch.',
      reusability: 'Zinc-rich dross fully recyclable.',
      energyEfficiency: 'ISO 50001 certified smelter.',
      resourceEfficiency: '≥95% in-process scrap recovery.',
    },
    soc: { summaryStatement: 'no_svhc_above_threshold' },
    useAndLife: {
      storageInstructions: 'Store indoors. Suspension hooks must engage centred lift.',
      handlingInstructions: 'Use overhead crane with rated chain. Min lift capacity 1.5 t.',
      safetyInformation: 'Solid metal — non-flammable. Molten zinc: see SDS.',
      sdsUrl: 'https://www.hzlindia.com/wp-content/uploads/SDS-Zinc.pdf',
    },
    documentation: {
      documents: [
        { id: 'doc-iso-9001', title: 'ISO 9001:2015 Quality Management', url: '/dpp-assets/docs/certs/doc-iso-9001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-iso-14001', title: 'ISO 14001:2015 Environmental Management', url: '/dpp-assets/docs/certs/doc-iso-14001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-astm-b852', title: 'ASTM B852-13 Conformance Statement', url: '/dpp-assets/docs/certs/doc-astm-b852.pdf', type: 'declaration', issuer: 'HZL Quality Assurance' },
        { id: 'doc-sds', title: 'Safety Data Sheet · Refined Zinc', url: 'https://www.hzlindia.com/wp-content/uploads/SDS-Zinc.pdf', type: 'sds', issuer: 'HZL Regulatory Affairs' },
      ],
    },
    media: {
      productImage: '/dpp-assets/products/zinc-cgg.jpg',
      productImageAlt: '1-tonne CGG zinc jumbo with crane suspension hook, stamped vedanta CGG',
    },
    story: {
      headline: 'The high-volume galvanising workhorse.',
      subhead: 'ASTM B852 Al control gives continuous hot-dip galvanising lines a ductile coating that hits Tata Steel\'s spec without re-blending.',
      bullets: [
        'Continuous Galvanising Grade · 99.0% Zn with 0.25–0.80% Al alloying',
        'Tata Steel anchor product · qualified for the Kalinganagar mill spec',
        'Jumbo format · 950 kg unit mass for direct kettle charging',
      ],
    },
    meta: buildMeta('zinc-cgg'),
  }
}

function leadBody(): Record<string, unknown> {
  const uuid = uuidFor('lead')
  return {
    schemaVersion: '1.0.0',
    passportType: 'DPP',
    materialId: {
      ...buildMaterialId('lead', uuid),
      speakingCodes: {
        casNumber: '7439-92-1',
        ecNumber: '231-100-4',
        hsnCode: '78011000',
        lmeBrandName: 'Vedanta 99.99',
        bisStandard: 'IS 27:2023',
      },
    },
    identification: {
      metal: 'lead',
      gradeCode: 'PB-9999',
      tradeName: 'Vedanta 99.99',
      purityPercent: 99.99,
      designation: 'Refined Lead 99.99% — Vedanta brand',
      form: 'ingot_25kg',
      applicableStandards: ['IS 27:2023', 'BS EN 12659:1999', 'ASTM B29-22'],
    },
    producer: HZL_PRODUCER,
    origin: {
      country: 'IN',
      subdivision: 'IN-RJ',
      manufacturingDate: '2026-04-12',
      manufacturingBatch: 'CHA-PB-2026-04-12',
      sites: [SITES.chanderiya, SITES.rampuraAgucha, SITES.sindesarKhurd],
    },
    product: {
      name: 'Refined Lead 99.99% — Vedanta brand',
      purposeStatement:
        'LME-registered "Vedanta 99.99" refined lead from the Chanderiya lead-zinc complex. The benchmark for lead-acid battery, radiation shielding, and ammunition customers across South Asia.',
      intendedMarkets: ['lead_acid_batteries', 'radiation_shielding', 'ammunition', 'cable_sheathing'],
      intendedRegions: ['IN', 'AE', 'SG', 'JP', 'KR'],
    },
    physical: {
      unitMassKg: 25,
      unitMassToleranceKg: 2,
      bundleMassKg: 1000,
      bundleMassToleranceKg: 50,
      unitsPerBundle: 40,
      dimensions: { lengthMm: 470, widthMm: 110, heightMm: 65, tolerance: '±5' },
      bundleDimensions: { lengthMm: 990, widthMm: 470, heightMm: 380, tolerance: '±10' },
      packaging: {
        strapMaterial: 'PET strapping',
        palletised: true,
        markings: 'vedanta Pb 99.99 / LME approved',
      },
    },
    chemistry: {
      composition: [
        { element: 'Pb', casNumber: '7439-92-1', role: 'primary', guaranteedMinPercent: 99.99, typicalAssayPercent: 99.992, method: 'ICP-OES (NABL HZL lab)' },
        { element: 'Ag', casNumber: '7440-22-4', role: 'impurity', guaranteedMaxPercent: 0.0015, typicalAssayPercent: 0.0008, method: 'ICP-OES' },
        { element: 'Cu', casNumber: '7440-50-8', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Bi', casNumber: '7440-69-9', role: 'impurity', guaranteedMaxPercent: 0.005, method: 'ICP-OES' },
        { element: 'Zn', casNumber: '7440-66-6', role: 'impurity', guaranteedMaxPercent: 0.0005, method: 'ICP-OES' },
        { element: 'Fe', casNumber: '7439-89-6', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Sb', casNumber: '7440-36-0', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
        { element: 'Sn', casNumber: '7440-31-5', role: 'impurity', guaranteedMaxPercent: 0.001, method: 'ICP-OES' },
      ],
    },
    sustainability: {
      pcf: {
        value: 1.6,
        unit: 'kg CO2e/kg',
        declaredUnit: '1 kg of unpackaged Vedanta 99.99 lead ingot at factory gate, Chanderiya, India',
        systemBoundary: 'cradle_to_gate',
        method: { framework: 'IPCC_AR6', version: 'GWP100y', characterizationModel: 'ISO 14067:2018 + IPCC AR6 GWP100y' },
        referenceYear: 2024,
        primaryDataSharePercent: 75,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
        cutOffPercent: 3,
        allocationMethod: 'physical_allocation',
        lciDatabase: { name: 'ecoinvent', version: '3.10' },
        assuranceLevel: 'self_declared',
        industryAverage: { value: 1.9, unit: 'kg CO2e/kg', source: 'ILA global average primary lead', year: 2023 },
      },
      pcfBreakdown: {
        miningKgCo2e: 0.42,
        concentrationKgCo2e: 0.21,
        smeltingKgCo2e: 0.46,
        refiningKgCo2e: 0.28,
        castingKgCo2e: 0.11,
        electricityKgCo2e: 0.06,
        thermalEnergyKgCo2e: 0.04,
        transportInboundKgCo2e: 0.02,
      },
      resourceUseFossil: {
        value: 21.5, unit: 'MJ/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Van Oers et al. 2002 — LHV-based' },
        referenceYear: 2024, primaryDataSharePercent: 75,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      waterScarcity: {
        value: 5.4, unit: 'm3 world eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'AWARE (Boulay 2018), country=IN' },
        referenceYear: 2024, primaryDataSharePercent: 60,
        dataQualityRating: { overall: 2, technological: 2, geographical: 1, temporal: 2 },
      },
      acidification: {
        value: 0.052, unit: 'mol H+ eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'Accumulated Exceedance' },
        referenceYear: 2024, primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 2, temporal: 2 },
      },
      ozoneDepletion: {
        value: 1.5e-9, unit: 'kg CFC-11 eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'WMO 2014 ODP factors' },
        referenceYear: 2024, primaryDataSharePercent: 50,
        dataQualityRating: { overall: 3, technological: 3, geographical: 2, temporal: 3 },
      },
      photochemicalOzone: {
        value: 0.0095, unit: 'kg NMVOC eq/kg', systemBoundary: 'cradle_to_gate',
        method: { framework: 'EF_3.1', version: '3.1', characterizationModel: 'LOTOS-EUROS (Van Zelm 2008)' },
        referenceYear: 2024, primaryDataSharePercent: 70,
        dataQualityRating: { overall: 2, technological: 2, geographical: 2, temporal: 2 },
      },
      renewableElectricityPercent: 55,
    },
    recycledContent: {
      totalPercent: 0,
      preConsumerPercent: 0,
      postConsumerPercent: 0,
      chainOfCustodyModel: 'mass_balance',
    },
    compliance: {
      regulations: [
        { name: 'REACH', reference: 'EC 1907/2006 — Lead (CAS 7439-92-1, SVHC)', status: 'declared', issuer: 'ECHA' },
        { name: 'BIS — Refined Lead', reference: 'IS 27:2023 — Pb 99.99', status: 'compliant', issuer: 'Bureau of Indian Standards' },
        { name: 'CBAM declaration ready', reference: 'Regulation (EU) 2023/956', status: 'compliant', issuer: 'EU Commission' },
      ],
      certifications: [
        { name: 'ISO 9001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 14001:2015', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ISO 45001:2018', status: 'compliant', issuer: 'RINA / TÜV' },
        { name: 'ICMM Mining Principles', status: 'compliant', issuer: 'ICMM', validFrom: '2025-08-13' },
      ],
      lmeRegisteredBrand: {
        brandName: 'Vedanta 99.99',
        url: 'https://www.lme.com/en/sustainability-and-physical-markets/brands/approved-brands',
      },
    },
    circularity: {
      recyclabilityIndicator: '100% — lead is one of the world\'s most-recycled metals (>99% recovery from lead-acid batteries)',
      materialRecoveryPotential: '≥99% recovery via authorised secondary smelters.',
      reuseInformation: 'Spent battery scrap returned via formal channels.',
      recyclingInformation: 'Refer to ILA recycling guidance and BIS lead recycling code.',
      disposalInformation: 'Lead is hazardous waste — never landfill. Forward to certified hazardous waste recycler.',
    },
    espr: {
      durability: 'Highly stable elemental metal; long service life in radiation shielding and battery service.',
      reliability: 'Conforms to IS 27:2023 / BS EN 12659 across certified batch.',
      reusability: 'Indefinitely re-refinable.',
      energyEfficiency: 'ISO 50001 certified smelter.',
      resourceEfficiency: '≥95% in-process scrap recovery; silver and bismuth recovered as by-products.',
    },
    soc: {
      summaryStatement: 'svhc_present',
      entries: [
        { iupacName: 'Lead', casNumber: '7439-92-1', ecNumber: '231-100-4', locationInProduct: 'homogeneous', value: 99.99, unit: 'wt%', concentrationDescriptor: 'Primary constituent — REACH Annex XIV / SVHC. Article-level SCIP notification not required (article = lead).' },
      ],
    },
    useAndLife: {
      storageInstructions: 'Store indoors, dry, away from food. Wash hands after handling.',
      handlingInstructions: 'Use approved lifting equipment. PPE: gloves, eye protection, dust mask if cutting/melting.',
      safetyInformation: 'Lead and lead compounds are toxic. Avoid inhalation of fumes/dust. See SDS.',
      sdsUrl: 'https://www.hzlindia.com/wp-content/uploads/SDS-Lead.pdf',
    },
    documentation: {
      documents: [
        { id: 'doc-iso-9001', title: 'ISO 9001:2015 Quality Management', url: '/dpp-assets/docs/certs/doc-iso-9001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-iso-14001', title: 'ISO 14001:2015 Environmental Management', url: '/dpp-assets/docs/certs/doc-iso-14001.pdf', type: 'certificate', issuer: 'TÜV / RINA' },
        { id: 'doc-bis-is-27', title: 'BIS IS 27:2023 Conformance Certificate', url: '/dpp-assets/docs/certs/doc-bis-is-27.pdf', type: 'certificate', issuer: 'Bureau of Indian Standards' },
        { id: 'doc-lme-approval', title: 'LME Approved Brand · Vedanta 99.99', url: 'https://www.lme.com/en/sustainability-and-physical-markets/brands/approved-brands', type: 'declaration', issuer: 'London Metal Exchange' },
        { id: 'doc-sds-lead', title: 'Safety Data Sheet · Refined Lead', url: 'https://www.hzlindia.com/wp-content/uploads/SDS-Lead.pdf', type: 'sds', issuer: 'HZL Regulatory Affairs' },
      ],
    },
    media: {
      productImage: '/dpp-assets/products/lead.jpg',
      productImageAlt: 'Refined lead 25 kg ingots stacked in a 1-tonne bundle, marked vedanta Pb 99.99',
    },
    story: {
      headline: 'LME "Vedanta 99.99" — the South Asia benchmark for refined lead.',
      subhead: 'India\'s only LME-registered lead brand. Powering battery, shielding, and cable customers across the region.',
      bullets: [
        'LME-approved brand · Vedanta 99.99',
        'BIS IS 27:2023 — first batch certified to the new spec',
        'By-products: silver refined at Pantnagar (one of the world\'s largest silver streams).',
      ],
    },
    meta: buildMeta('lead'),
  }
}

// ── Bank ────────────────────────────────────────────────────────────────────

function buildPassport(slug: DemoSlug, body: Record<string, unknown>): DemoPassport {
  const uuid = (body.materialId as { uuid: string }).uuid
  return {
    slug,
    upiCanonical: `${HZL_BPNL}/${uuid}`,
    qrPayload: (body.materialId as { resolverUrl: string }).resolverUrl,
    signature: {
      algorithm: 'Ed25519Signature2020',
      value: 'z' + slug.toUpperCase().padEnd(8, 'X').repeat(8),
      bodySha256: 'demo'.repeat(16).slice(0, 64),
    },
    body,
  }
}

const PASSPORTS: Record<DemoSlug, DemoPassport> = {
  ecozen: buildPassport('ecozen', ecozenBody()),
  'zinc-cgg': buildPassport('zinc-cgg', cggBody()),
  lead: buildPassport('lead', leadBody()),
}

/**
 * Match an arbitrary UPI to one of the demo passports.
 *
 * Recognises:
 *   sample/<slug>             — preset slug routes
 *   demo/<slug>               — branded demo path
 *   ecozen / shg-99-995       — EcoZen synonyms
 *   cgg / zinc-cgg            — CGG Jumbo synonyms
 *   lead / pb-99-99 / 99-99   — Refined Lead synonyms
 *   {HZL_BPNL}/<uuid>         — canonical Chem-X material URL
 */
export function matchDemoPassport(upi: string): DemoPassport | null {
  if (!upi) return null
  const lc = upi.toLowerCase()

  if (lc.includes('ecozen') || lc.includes('shg-99-995') || lc.includes('zn99.995'))
    return PASSPORTS.ecozen!
  if (lc.includes('zinc-cgg') || lc.includes('/cgg') || lc === 'cgg' || lc.endsWith('cgg'))
    return PASSPORTS['zinc-cgg']!
  if (lc.includes('lead') || lc.includes('pb-99-99') || lc.includes('99-99') || lc.includes('vedanta-99-99'))
    return PASSPORTS.lead!

  // Canonical Chem-X URL: BPNL / UUID
  if (lc.includes(HZL_BPNL.toLowerCase())) {
    for (const p of Object.values(PASSPORTS)) {
      if (lc.includes(p.upiCanonical.toLowerCase())) return p
    }
  }

  // GS1 Digital Link via HSN-coded paths (zinc 79011200, lead 78011000)
  if (lc.includes('79011200')) return PASSPORTS.ecozen!
  if (lc.includes('78011000')) return PASSPORTS.lead!

  return null
}

export function listDemoPassports(): DemoPassport[] {
  return Object.values(PASSPORTS)
}

export function getDemoPassport(slug: DemoSlug): DemoPassport {
  return PASSPORTS[slug]
}

export const DEMO_ISSUED_AT = ISSUED_AT
export const DEMO_EXPIRES_AT = EXPIRES_AT
