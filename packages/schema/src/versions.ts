/**
 * Version manifests — Vedanta · Hindustan Zinc DPP roadmap
 *
 * Each version is a fixed roster of attributes drawn from the Chem-X v1.0 +
 * ESPR-anchored matrix. Tenants choose a version during onboarding
 * (Section 11). The platform team owns the manifests; tenants cannot extend
 * them, only de-scope conditional/voluntary attributes within the chosen ceiling.
 */

export type DppVersion = '1.0' | '1.5' | '2' | '3' | '4'

export interface VersionManifest {
  version: DppVersion
  positioning: string
  cumulativeAttributes: number
  newAtThisVersion: number
  regulatoryAnchor: string
  typicalAdoption: string
  schemaUrl: string
}

export const VERSION_MANIFESTS: Record<DppVersion, VersionManifest> = {
  '1.0': {
    version: '1.0',
    positioning: 'Trust-building foundation',
    cumulativeAttributes: 106,
    newAtThisVersion: 106,
    regulatoryAnchor: 'ESPR Annex III + JRC §7 (mandatory subset)',
    typicalAdoption: 'Q3-Q4 2026',
    schemaUrl: 'https://schemas.passport.hzlindia.com/dpp/v1.0.0.json',
  },
  '1.5': {
    version: '1.5',
    positioning: 'Operational depth — full chemistry + mechanical properties',
    cumulativeAttributes: 153,
    newAtThisVersion: 47,
    regulatoryAnchor: 'Adds ESPR Art 5(1)(h)(i) coverage',
    typicalAdoption: 'Q1-Q2 2027',
    schemaUrl: 'https://schemas.passport.hzlindia.com/dpp/v1.5.0.json',
  },
  '2': {
    version: '2',
    positioning: 'ESPR Annex III alignment — site-specific CFP, CBAM cross-link',
    cumulativeAttributes: 219,
    newAtThisVersion: 66,
    regulatoryAnchor: 'Aligns with ESPR Annex III + CBAM definitive period (expected 2027)',
    typicalAdoption: 'Q3-Q4 2027',
    schemaUrl: 'https://schemas.passport.hzlindia.com/dpp/v2.0.0.json',
  },
  '3': {
    version: '3',
    positioning: 'Full input mix, detailed circularity',
    cumulativeAttributes: 229,
    newAtThisVersion: 10,
    regulatoryAnchor: 'Full ESPR Art 5(1)(k)(l)(m)(n) coverage',
    typicalAdoption: 'Q1-Q2 2028',
    schemaUrl: 'https://schemas.passport.hzlindia.com/dpp/v3.0.0.json',
  },
  '4': {
    version: '4',
    positioning: 'All 16 PEF impact categories + EU DPP Registry integration',
    cumulativeAttributes: 229,
    newAtThisVersion: 0,
    regulatoryAnchor: 'Complete ESPR Annex I + Annex III + JTC 24',
    typicalAdoption: 'Q3 2028 onward',
    schemaUrl: 'https://schemas.passport.hzlindia.com/dpp/v4.0.0.json',
  },
}

export const CURRENT_DPP_VERSION: DppVersion = '1.0'
export const CURRENT_SCHEMA_VERSION = '1.0.0'
