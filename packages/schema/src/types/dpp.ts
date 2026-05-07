/**
 * Hand-authored TypeScript mirror of dpp/v1.0.0.json (Vedanta · HZL edition).
 *
 * The JSON Schema in packages/schema/schemas/dpp/v1.0.0.json is authoritative.
 * These types must mirror it exactly; CI runs ajv validation against schema +
 * fixtures to keep them honest. CLAUDE.md hard rule #1 — no TS/Pydantic change
 * without a schema change first.
 *
 * Aligns with: Chem-X Sustainability Guideline v1.0, Chem-X Business Identity
 * (BPDM) v1.0, Chem-X Material ID v1.0, ISO 14067, ISO 14025 EPD, ISO/IEC 6523,
 * W3C Decentralized Identifiers v1.0, ESPR Annex III, India BIS IS 209/IS 27.
 */

export type Iso8601DateTime = string
export type Iso8601Date = string
export type Iso639Lang = string
export type Iso3166Country = string
export type Iso3166Subdivision = string
export type Url = string
export type Percent = number
export type MassKg = number
export type LengthMm = number

/** W3C DID URL (any method). For HZL passports it is a did:web. */
export type Did = string
/** did:web subset — see Chem-X Material ID Guideline §5.4. */
export type DidWeb = string
/** Catena-X CX-0010 BPN — 16 chars, last 2 = ISO 7064 MOD 1271-36 check. */
export type Bpn = string
export type Bpnl = string
export type Bpns = string
export type Bpna = string
/** ISO 17442 Legal Entity Identifier (GLEIF). */
export type Lei = string
export type CasNumber = string
export type EcNumber = string
export type ReachRegistration = string

export type AccessTier = 'public' | 'legitimate' | 'authority'
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'n_a' | 'pending'
export type LifecycleState = 'draft' | 'published' | 'revised' | 'withdrawn' | 'expired'
export type AssuranceLevel = 'limited' | 'reasonable' | 'self_declared'
export type SystemBoundary = 'cradle_to_gate' | 'cradle_to_grave' | 'gate_to_gate'
export type ChainOfCustodyModel =
  | 'mass_balance'
  | 'controlled_blending'
  | 'physical_segregation'
  | 'book_and_claim'
  | 'not_applicable'
export type AllocationMethod =
  | 'subdivision'
  | 'system_expansion'
  | 'physical_allocation'
  | 'economic_allocation'
  | 'not_applicable'

export type Metal = 'zinc' | 'lead' | 'silver'

export type ProductForm =
  | 'ingot_25kg'
  | 'ingot_9kg'
  | 'jumbo_1t'
  | 'bar_30kg'
  | 'bar_1kg'
  | 'powder'
  | 'dust'
  | 'oxide'

export type SiteFunction =
  | 'mine'
  | 'concentrator'
  | 'smelter_hydro'
  | 'smelter_pyro'
  | 'refinery'
  | 'casthouse'
  | 'rolling_mill'
  | 'powder_atomiser'
  | 'warehouse'
  | 'depot'

export type LciaFramework =
  | 'EF_3.1'
  | 'EF_3.0'
  | 'ReCiPe_2016'
  | 'CML_IA'
  | 'TRACI_2.1'
  | 'ImpactWorld+'
  | 'IPCC_AR6'

/** Chem-X §3.10 representativeness scale: 1 = best, 5 = worst. */
export type DqrLevel = 1 | 2 | 3 | 4 | 5

export type IdentifierCategory = 'VAT' | 'TIN' | 'NBR' | 'IBR' | 'OTH'

export type PassportType = 'DPP' | 'DMP'
export type PassportClass = 'dpp' | 'dmp'

export interface VerifierReference {
  did: Did
  name: string
  credentialId?: string
  validFrom?: Iso8601Date
  validUntil?: Iso8601Date
}

export interface MaterialIdSpeakingCodes {
  casNumber?: CasNumber
  ecNumber?: EcNumber
  reachRegistration?: ReachRegistration
  hsnCode?: string
  lmeBrandName?: string
  lbmaBrandName?: string
  bisStandard?: string
}

export interface MaterialId {
  did: DidWeb
  uuid: string
  resolverUrl: Url
  passportClass: PassportClass
  speakingCodes?: MaterialIdSpeakingCodes
}

export interface Identification {
  metal: Metal
  gradeCode: string
  purityPercent: number
  designation?: string
  form: ProductForm
  tradeName?: string
  applicableStandards: string[]
}

export interface LegalEntityIdentifier {
  category: IdentifierCategory
  type: string
  value: string
  issuingCountry?: Iso3166Country
  issuingBody?: string
}

export interface AuthorisedRepresentativeEU {
  name?: string
  address?: string
  bpnl?: Bpnl
}

export interface Producer {
  bpnl: Bpnl
  legalName: string
  legalForm: string
  shortName?: string
  tradeName?: string
  registeredAddressBpna: Bpna
  country: Iso3166Country
  identifiers: LegalEntityIdentifier[]
  regulatoryContact?: { team?: string; email?: string; phone?: string }
  authorisedRepresentativeEU?: AuthorisedRepresentativeEU
}

export interface SiteReference {
  bpns: Bpns
  name: string
  function: SiteFunction
  country?: Iso3166Country
  addressBpna?: Bpna
}

export interface Origin {
  country: Iso3166Country
  subdivision?: Iso3166Subdivision
  manufacturingDate: Iso8601Date
  manufacturingBatch?: string
  sites: SiteReference[]
}

export interface Product {
  name: string
  purposeStatement: string
  intendedMarkets?: string[]
  intendedRegions?: Iso3166Country[]
}

export interface Dimensions {
  lengthMm?: LengthMm
  widthMm?: LengthMm
  heightMm?: LengthMm
  diameterMm?: LengthMm
  tolerance?: string
}

export interface Packaging {
  strapMaterial?: string
  palletised?: boolean
  markings?: string
}

export interface Physical {
  unitMassKg: MassKg
  unitMassToleranceKg?: number
  bundleMassKg: MassKg
  bundleMassToleranceKg?: number
  unitsPerBundle?: number
  dimensions?: Dimensions
  bundleDimensions?: Dimensions
  packaging?: Packaging
}

export interface ChemistryComponent {
  element: string
  casNumber: CasNumber
  role?: 'primary' | 'alloying' | 'impurity'
  guaranteedMaxPercent?: number
  guaranteedMinPercent?: number
  typicalAssayPercent?: number
  method?: string
}

export interface Chemistry {
  composition: ChemistryComponent[]
  labCertificateRef?: string
  labBpns?: Bpns
}

export interface LciaMethodReference {
  framework: LciaFramework
  version: string
  characterizationModel?: string
}

export interface DataQualityRating {
  overall: DqrLevel
  technological: DqrLevel
  geographical: DqrLevel
  temporal: DqrLevel
}

export interface ReportingPeriod {
  from: Iso8601Date
  to: Iso8601Date
}

export interface IndustryAverage {
  value: number
  unit: string
  source?: string
  year?: number
}

export interface LciaCategory {
  value: number
  unit: string
  declaredUnit: string
  systemBoundary: SystemBoundary
  method: LciaMethodReference
  reportingPeriod?: ReportingPeriod
  referenceYear: number
  primaryDataSharePercent: Percent
  dataQualityRating: DataQualityRating
  cutOffPercent?: number
  allocationMethod?: AllocationMethod
  lciDatabase?: { name?: string; version?: string }
  verifier?: VerifierReference
  verificationStatementRef?: string
  assuranceLevel?: AssuranceLevel
  industryAverage?: IndustryAverage
}

export interface PcfBreakdown {
  miningKgCo2e?: number
  concentrationKgCo2e?: number
  smeltingKgCo2e?: number
  refiningKgCo2e?: number
  castingKgCo2e?: number
  electricityKgCo2e?: number
  thermalEnergyKgCo2e?: number
  transportInboundKgCo2e?: number
  biogenicRemovalKgCo2e?: number
  biogenicEmissionKgCo2e?: number
}

export interface EpdReference {
  registrationNumber?: string
  programOperator?: string
  publicationDate?: Iso8601Date
  validUntil?: Iso8601Date
  url?: Url
  pcr?: string
}

export interface Sustainability {
  pcf: LciaCategory
  pcfBreakdown?: PcfBreakdown
  resourceUseFossil: LciaCategory
  waterScarcity: LciaCategory
  acidification: LciaCategory
  ozoneDepletion: LciaCategory
  photochemicalOzone: LciaCategory
  renewableElectricityPercent?: Percent
  epd?: EpdReference
  extras?: Record<string, LciaCategory>
}

export interface RecycledContent {
  totalPercent: Percent
  preConsumerPercent?: Percent
  postConsumerPercent?: Percent
  chainOfCustodyModel: ChainOfCustodyModel
  certificationScheme?: string
  verifier?: VerifierReference
  certificateRef?: string
}

export interface ComplianceEntry {
  name: string
  reference?: string
  status: ComplianceStatus
  issuer?: string
  certificateRef?: string
  validFrom?: Iso8601Date
  validUntil?: Iso8601Date
  documentId?: string
  evidenceRef?: string
}

export interface LmeRegisteredBrand {
  brandName?: string
  registrationDate?: Iso8601Date
  url?: Url
}

export interface Compliance {
  regulations: ComplianceEntry[]
  certifications: ComplianceEntry[]
  lmeRegisteredBrand?: LmeRegisteredBrand
  complianceDocumentationUrl?: Url
}

export interface Circularity {
  recyclabilityIndicator: string
  materialRecoveryPotential: string
  endOfLifeUrl?: Url
  reuseInformation: string
  recyclingInformation: string
  disposalInformation: string
  treatmentFacilityInfo?: string
  disassemblyInformation?: string
}

export interface EsprAspects {
  durability: string
  reliability: string
  reusability: string
  upgradability?: string
  repairability?: string
  maintenance?: string
  energyEfficiency: string
  resourceEfficiency: string
}

export interface SocEntry {
  iupacName: string
  otherNames?: string[]
  ecNumber?: EcNumber
  casNumber?: CasNumber
  locationInProduct?: 'homogeneous' | 'coating' | 'core' | 'interface'
  concentrationDescriptor?: string
  value?: number
  unit?: string
  safeUseInstructions?: string
  endOfLifeInstructions?: string
  scipNotificationId?: string
}

export interface SubstancesOfConcern {
  summaryStatement: 'no_svhc_above_threshold' | 'svhc_above_threshold' | 'not_applicable'
  entries?: SocEntry[]
}

export interface UseAndLife {
  installationInformation?: string
  useInstructions?: string
  storageInstructions?: string
  handlingInstructions?: string
  maintenanceInformation?: string
  repairInformation?: string
  warnings?: string
  safetyInformation?: string
  sdsUrl?: Url
}

export interface DocumentRef {
  id?: string
  title: string
  url: Url
  type?:
    | 'mtc'
    | 'lca_report'
    | 'epd'
    | 'verification_statement'
    | 'certificate'
    | 'user_manual'
    | 'sds'
    | 'spec_sheet'
    | 'lab_certificate'
    | 'other'
  issuer?: string
  sizeKb?: number
  sha256?: string
}

export interface Documentation {
  documents?: DocumentRef[]
}

export interface AccessRights {
  model: 'three_tier_vc_gated' | 'public_only'
  publicFields?: string[]
}

export interface Meta {
  createdAt: Iso8601DateTime
  lastUpdated: Iso8601DateTime
  expiresAt: Iso8601DateTime
  lciaValidUntil?: Iso8601Date
  lifecycleState: LifecycleState
  languages: Iso639Lang[]
  issuerDid: DidWeb
  accessRights: AccessRights
  tenantId?: number
  revisionOf?: string
  revisionReason?: string
}

/** Canonical zinc/lead/silver passport — schema 1.0.0. */
export interface Dpp {
  schemaVersion: '1.0.0'
  passportType: PassportType
  materialId: MaterialId
  identification: Identification
  producer: Producer
  origin: Origin
  product: Product
  physical: Physical
  chemistry: Chemistry
  sustainability: Sustainability
  recycledContent: RecycledContent
  compliance: Compliance
  circularity: Circularity
  espr: EsprAspects
  soc: SubstancesOfConcern
  useAndLife: UseAndLife
  documentation: Documentation
  meta: Meta
}
