/**
 * Simulator preset shape — used by @dpp/sim and the operator console's
 * Sources tab. Presets seed cast events with HZL-verified values.
 *
 * The shape mirrors the JSON files in packages/schema/presets/*.json
 * (zinc-ecozen.json, zinc-cgg-jumbo.json, lead-pure-99-99.json).
 */

import type {
  Bpns,
  ChainOfCustodyModel,
  ChemistryComponent,
  ComplianceEntry,
  Did,
  EpdReference,
  IndustryAverage,
  LciaCategory,
  LmeRegisteredBrand,
  MaterialIdSpeakingCodes,
  Metal,
  Packaging,
  Percent,
  PcfBreakdown,
  ProductForm,
  SocEntry,
  SubstancesOfConcern,
  UseAndLife,
  Url,
  VerifierReference,
} from './dpp'

export interface PresetDimensions {
  lengthMm?: number
  widthMm?: number
  heightMm?: number
  diameterMm?: number
  tolerance?: string
}

export interface PresetPhysical {
  unitMassKg: number
  unitMassToleranceKg?: number
  bundleMassKg: number
  bundleMassToleranceKg?: number
  unitsPerBundle?: number
  dimensions?: PresetDimensions
  bundleDimensions?: PresetDimensions
  packaging?: Packaging
}

export interface PresetChemistry {
  composition: ChemistryComponent[]
  labCertificateRef?: string
  labBpns?: Bpns
}

export interface PresetSustainability {
  pcf: LciaCategory
  pcfBreakdown?: PcfBreakdown
  resourceUseFossil: LciaCategory
  waterScarcity: LciaCategory
  acidification: LciaCategory
  ozoneDepletion: LciaCategory
  photochemicalOzone: LciaCategory
  renewableElectricityPercent?: Percent
  epd?: EpdReference
}

export interface PresetRecycledContent {
  totalPercent: number
  preConsumerPercent?: number
  postConsumerPercent?: number
  chainOfCustodyModel: ChainOfCustodyModel
  certificationScheme?: string
  verifier?: VerifierReference
  certificateRef?: string
}

export interface PresetCompliance {
  regulations: ComplianceEntry[]
  certifications: ComplianceEntry[]
  lmeRegisteredBrand?: LmeRegisteredBrand
}

export interface PresetCircularity {
  recyclabilityIndicator: string
  materialRecoveryPotential: string
  endOfLifeUrl?: Url
  reuseInformation: string
  recyclingInformation: string
  disposalInformation: string
  treatmentFacilityInfo?: string
  disassemblyInformation?: string
}

export interface PresetEspr {
  durability: string
  reliability: string
  reusability: string
  upgradability?: string
  repairability?: string
  maintenance?: string
  energyEfficiency: string
  resourceEfficiency: string
}

export interface PresetStory {
  headline: string
  subhead?: string
  bullets?: string[]
}

/** Three-letter site tag matched in services/bpn.py and bpdm seed migration. */
export type ProducingSiteTag = 'CHA' | 'DAR' | 'DEB' | 'PAN'

export interface SimulatorPreset {
  id: string
  label: string
  summary: string
  metal: Metal
  gradeCode: string
  tradeName?: string
  purityPercent: number
  form: ProductForm
  applicableStandards: string[]
  physical: PresetPhysical
  chemistry: PresetChemistry
  speakingCodes?: MaterialIdSpeakingCodes
  producingSiteTag?: ProducingSiteTag
  sustainability: PresetSustainability
  recycledContent: PresetRecycledContent
  compliance: PresetCompliance
  circularity?: PresetCircularity
  espr?: PresetEspr
  soc?: SubstancesOfConcern
  useAndLife?: UseAndLife
  intendedMarkets?: string[]
  intendedRegions?: string[]
  story?: PresetStory
}

// Re-export so callers can write `import type { SocEntry } from '@dpp/schema'`.
export type { SocEntry }
