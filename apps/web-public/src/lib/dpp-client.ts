/**
 * Server-side fetcher for HZL passport records · used by the public viewer.
 *
 * Two paths:
 *   1. /dpp/<bpnl>/<uuid>          — canonical Chem-X Material ID URL form.
 *      Hits the FastAPI resolver; falls back to a synthetic zinc-ecozen demo
 *      if the API is unreachable so cold installs still render something.
 *   2. /dpp/sample/<preset-id>     — workshop / docs route. Synthesises a
 *      zinc/lead passport directly from the preset JSON.
 *
 * Always returns the public-tier filtered view; never the authority/legitimate
 * tiers — those gates live behind VC presentation in a later layer.
 */

import { presets, type SimulatorPreset } from '@dpp/schema'
import {
  DEMO_EXPIRES_AT,
  DEMO_ISSUED_AT,
  matchDemoPassport,
  type DemoAudience,
  type DemoPassport,
} from '@dpp/ui'

import { filterBodyByAudience } from './audience'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'
const RESOLVER_BASE = process.env.NEXT_PUBLIC_RESOLVER_BASE_URL ?? 'http://localhost:3000'

export type ViewerDpp = {
  /** Canonical resolver URL of the form `/dpp/<bpnl>/<uuid>` (no leading slash). */
  upi: string
  state: string
  tier: 'public' | 'legitimate' | 'authority'
  audience: DemoAudience
  isDemo: boolean
  issuedAt: string | null
  expiresAt: string | null
  signatureRef: { algorithm: string; value: string; bodySha256: string } | null
  dpp: Record<string, unknown>
}

const PRESET_BY_SLUG: Record<string, keyof typeof presets> = {
  ecozen: 'zinc-ecozen-shg-99-995',
  'zinc-ecozen': 'zinc-ecozen-shg-99-995',
  cgg: 'zinc-cgg-jumbo',
  'zinc-cgg': 'zinc-cgg-jumbo',
  lead: 'lead-pure-99-99',
  'lead-99-99': 'lead-pure-99-99',
  'lead-pure-99-99': 'lead-pure-99-99',
}

const HZL_BPNL_FALLBACK = 'BPNLHZL0000001QX'

function fakeUuid(seed: string): string {
  // Deterministic v4-shaped UUID for demo records — not cryptographically
  // unique. Real records get a server-issued v4 UUID via materialId.uuid.
  const hex = (s: string) =>
    Array.from(s)
      .reduce((acc, c) => acc + c.charCodeAt(0).toString(16).padStart(2, '0'), '')
      .padEnd(32, '0')
      .slice(0, 32)
  const h = hex(seed)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export async function fetchDpp(
  upi: string,
  audience: DemoAudience = 'public',
): Promise<ViewerDpp | null> {
  // 1. Demo passport bank — pattern matched on the upi path. Always renders
  // the same rich, regulator-aligned passport regardless of which cast
  // number / BPNL/UUID the user lands on.
  const demo = matchDemoPassport(upi)
  if (demo) return materialiseDemo(demo, upi, audience)

  // 2. Workshop / docs preset routes
  if (upi.startsWith('sample/')) {
    const slug = upi.slice('sample/'.length)
    const presetId = PRESET_BY_SLUG[slug]
    if (!presetId) return null
    const preset = presets[presetId] as SimulatorPreset
    return synthesizeFromPreset(preset, upi, audience)
  }

  // 3. Canonical Chem-X material URL: /<bpnl>/<uuid>
  // Hit FastAPI resolver. On any error, fall back to the EcoZen demo so the
  // viewer still has something coherent to render.
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/dpps/${encodeURIComponent(upi)}?tier=public`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return fallbackToEcozen(upi, audience)
    const live = (await res.json()) as Omit<ViewerDpp, 'audience' | 'isDemo'>
    return {
      ...live,
      audience,
      isDemo: false,
      dpp: filterBodyByAudience(live.dpp, audience),
    }
  } catch {
    return fallbackToEcozen(upi, audience)
  }
}

function fallbackToEcozen(upi: string, audience: DemoAudience): ViewerDpp | null {
  const fallback = matchDemoPassport('ecozen') ?? matchDemoPassport('zinc-ecozen')
  if (fallback) return materialiseDemo(fallback, upi, audience)
  const preset = presets['zinc-ecozen-shg-99-995'] as SimulatorPreset
  return synthesizeFromPreset(preset, upi || 'sample/ecozen', audience)
}

function materialiseDemo(demo: DemoPassport, upi: string, audience: DemoAudience): ViewerDpp {
  return {
    upi: upi || demo.upiCanonical,
    state: 'published',
    tier: 'public',
    audience,
    isDemo: true,
    issuedAt: DEMO_ISSUED_AT,
    expiresAt: DEMO_EXPIRES_AT,
    signatureRef: demo.signature,
    dpp: filterBodyByAudience(demo.body, audience),
  }
}

/**
 * Materialise a zinc/lead passport from a preset JSON.
 *
 * Mirrors apps/api/dpp_api/services/generator.py — keep the field shapes in
 * lockstep so the public viewer can't tell whether the body came from the API
 * or a static preset.
 */
function synthesizeFromPreset(
  preset: SimulatorPreset,
  upiPath: string,
  audience: DemoAudience,
): ViewerDpp {
  const now = new Date()
  const expires = new Date(now)
  expires.setFullYear(expires.getFullYear() + 10)
  const lciaValid = new Date(now)
  lciaValid.setFullYear(lciaValid.getFullYear() + 3)

  const bpnl = HZL_BPNL_FALLBACK
  const uuid = fakeUuid(preset.id)
  const did = `did:web:${RESOLVER_BASE.replace(/^https?:\/\//, '').split('/')[0]}:${bpnl}?dpp=${uuid}`
  const resolverUrl = `${RESOLVER_BASE.replace(/\/$/, '')}/dpp/${bpnl}/${uuid}`

  // Deterministic HZL site BPNS for demo. Chanderiya for all three presets
  // per research dossier.
  const siteBpns = 'BPNSHZSCHA00012N'

  const body: Record<string, unknown> = {
    schemaVersion: '1.0.0',
    passportType: 'DPP',
    materialId: {
      did,
      uuid,
      resolverUrl,
      passportClass: 'dpp',
      ...(preset.speakingCodes ? { speakingCodes: preset.speakingCodes } : {}),
    },
    identification: {
      metal: preset.metal,
      gradeCode: preset.gradeCode,
      purityPercent: preset.purityPercent,
      designation: preset.label,
      form: preset.form,
      ...(preset.tradeName ? { tradeName: preset.tradeName } : {}),
      applicableStandards: preset.applicableStandards,
    },
    producer: {
      bpnl,
      legalName: 'Hindustan Zinc Limited',
      legalForm: 'Public Limited Company',
      shortName: 'HZL',
      tradeName: 'Vedanta Hindustan Zinc',
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
    },
    origin: {
      country: 'IN',
      subdivision: 'IN-RJ',
      manufacturingDate: now.toISOString().slice(0, 10),
      manufacturingBatch: `CHA-${preset.id.toUpperCase()}-${now.toISOString().slice(0, 10)}`,
      sites: [
        {
          bpns: siteBpns,
          name: 'Chanderiya Lead-Zinc Smelter (CLZS)',
          function: 'smelter_hydro',
          country: 'IN',
        },
      ],
    },
    product: {
      name: preset.label,
      purposeStatement: preset.summary,
      intendedMarkets: preset.intendedMarkets ?? [],
      intendedRegions: preset.intendedRegions ?? [],
    },
    physical: preset.physical,
    chemistry: preset.chemistry,
    sustainability: preset.sustainability,
    recycledContent: preset.recycledContent,
    compliance: preset.compliance,
    circularity: preset.circularity ?? {
      recyclabilityIndicator: `${capitalize(preset.metal)} is fully recyclable.`,
      materialRecoveryPotential: 'Recovered via authorised non-ferrous metal recyclers.',
      reuseInformation: 'Process scrap remelted internally.',
      recyclingInformation: 'Refer to IZA / ILA recycling guidance.',
      disposalInformation: 'Never landfill — return for recycling.',
    },
    espr: preset.espr ?? {
      durability: 'Stable refined metal.',
      reliability: 'Conforms to applicable BIS / ISO standards.',
      reusability: 'Infinitely recyclable.',
      energyEfficiency: 'Smelter operates under ISO 50001 energy management.',
      resourceEfficiency: 'High in-process scrap recovery.',
    },
    soc: preset.soc ?? { summaryStatement: 'no_svhc_above_threshold' },
    useAndLife: preset.useAndLife ?? {
      safetyInformation: 'Refer to SDS for safe handling and storage.',
    },
    documentation: {
      documents: [
        ...(preset.sustainability.epd
          ? [
              {
                id: 'doc-epd',
                title: `${preset.sustainability.epd.programOperator ?? 'EPD International'} — ${preset.sustainability.epd.registrationNumber ?? ''}`.trim(),
                url: preset.sustainability.epd.url ?? 'https://www.environdec.com/library/epd6472',
                type: 'epd' as const,
                issuer: preset.sustainability.epd.programOperator ?? 'International EPD System',
              },
            ]
          : []),
        {
          id: 'doc-iso-9001',
          title: 'ISO 9001:2015 Quality Management',
          url: '/dpp-assets/docs/certs/doc-iso-9001.pdf',
          type: 'certificate' as const,
          issuer: 'TÜV / RINA',
        },
        {
          id: 'doc-iso-14001',
          title: 'ISO 14001:2015 Environmental Management',
          url: '/dpp-assets/docs/certs/doc-iso-14001.pdf',
          type: 'certificate' as const,
          issuer: 'TÜV / RINA',
        },
        {
          id: 'doc-icmm',
          title: 'ICMM Mining Principles — Member since 2025-08-13',
          url: 'https://www.icmm.com/en-gb/our-members',
          type: 'certificate' as const,
          issuer: 'ICMM',
        },
      ],
    },
    meta: {
      createdAt: now.toISOString(),
      lastUpdated: now.toISOString(),
      expiresAt: expires.toISOString(),
      lciaValidUntil: lciaValid.toISOString().slice(0, 10),
      lifecycleState: 'published',
      languages: ['en', 'hi'],
      issuerDid: `did:web:passport.hzlindia.com:${bpnl}`,
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
          'meta',
        ],
      },
      tenantId: 1,
    },
  }

  return {
    upi: upiPath,
    state: 'published',
    tier: 'public',
    audience,
    isDemo: true,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    signatureRef: {
      algorithm: 'Ed25519Signature2020',
      value: 'z' + 'sample'.repeat(8),
      bodySha256: 'sample'.repeat(10).slice(0, 64),
    },
    dpp: filterBodyByAudience(body, audience),
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
