/**
 * In-memory store for ownership transfers · backs the Ownership Transfers
 * page until the FastAPI `passport_transfers` router lands.
 *
 * A transfer is one per-batch chain-of-custody event. Each carries:
 *  - The passport UPI (always cast-level · see CLAUDE.md "append-only first")
 *  - Issuer DID (the seller / current custodian)
 *  - Recipient DID (the buyer / next custodian)
 *  - Kind: ownership | custody | end_of_life
 *  - State machine: draft → pending_countersign → settled (or rejected /
 *    disputed). Settled transfers receive a Verifiable Credential ref.
 */

export type TransferKind = 'ownership' | 'custody' | 'end_of_life'

export type TransferState = 'draft' | 'pending_countersign' | 'settled' | 'rejected' | 'disputed'

export interface Transfer {
  id: string
  passportUpi: string
  /** Friendly product label cached at issue time so the list renders without
   *  hitting the DPP record table. */
  productLabel: string
  fromOrg: string
  fromDid: string
  toOrg: string
  toDid: string
  kind: TransferKind
  state: TransferState
  initiatedAt: string
  countersignedAt: string | null
  settledAt: string | null
  credentialId: string | null
  bodySha256: string | null
  /** Optional commercial reference (PO, BoL, recycling manifest, etc). */
  reference: string | null
  /** Operator note for audit trail. */
  note: string | null
  initiatedBy: string
  countersignedBy: string | null
}

const SEED: Transfer[] = [
  {
    id: 't-2026-001',
    passportUpi: '08901003079011/C-20260415-77264/EZN-001',
    productLabel: 'EcoZen SHG 99.995 Sow · IS 209:1992',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'Tata Steel · Jamshedpur Galvanising',
    toDid: 'did:web:tatasteel.com:procurement',
    kind: 'ownership',
    state: 'pending_countersign',
    initiatedAt: '2026-04-30T09:15:00Z',
    countersignedAt: null,
    settledAt: null,
    credentialId: null,
    bodySha256: null,
    reference: 'PO-TATA-2026-0418',
    note: 'Q2 contract delivery #4 · 24t to Jamshedpur galvanising line.',
    initiatedBy: 'sustainability.lead@vedanta.co.in',
    countersignedBy: null,
  },
  {
    id: 't-2026-002',
    passportUpi: '08901003079011/C-20260420-31402/CGG-007',
    productLabel: 'CGG Jumbo Zinc Block · ASTM B852-13',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'JSW Steel · Vasind CGL',
    toDid: 'did:web:jsw.in:procurement',
    kind: 'ownership',
    state: 'settled',
    initiatedAt: '2026-04-22T11:00:00Z',
    countersignedAt: '2026-04-23T08:14:00Z',
    settledAt: '2026-04-23T08:14:00Z',
    credentialId: 'VC-OWN-2026-002',
    bodySha256: '7a91…e44d',
    reference: 'PO-JSW-2026-0099',
    note: '20t CGG Jumbo blocks, IZA Zinc Mark verified.',
    initiatedBy: 'sustainability.lead@vedanta.co.in',
    countersignedBy: 'procurement@jsw.in',
  },
  {
    id: 't-2026-003',
    passportUpi: '08901003078011/C-20260418-92013/PB99-024',
    productLabel: 'Refined Lead 99.99 Ingot · IS 27:2023 · 680 kg',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'Gravita Lead Recycling',
    toDid: 'did:web:gravitaindia.com:recycling',
    kind: 'end_of_life',
    state: 'settled',
    initiatedAt: '2026-04-18T14:22:00Z',
    countersignedAt: '2026-04-18T15:30:00Z',
    settledAt: '2026-04-18T15:30:00Z',
    credentialId: 'VC-EOL-2026-003',
    bodySha256: '8f3a…c41e',
    reference: 'EOL-MANIFEST-2026-0418',
    note: 'Closed-loop battery remelt declaration, ILA accredited handler.',
    initiatedBy: 'compliance.lead@vedanta.co.in',
    countersignedBy: 'eol@gravitaindia.com',
  },
  {
    id: 't-2026-004',
    passportUpi: '08901003079011/C-20260425-48721/EZN-018',
    productLabel: 'EcoZen SHG 99.995 Sow · IS 209:1992',
    fromOrg: 'HZL Casthouse Logistics',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'Mundra Port Terminal',
    toDid: 'did:web:adaniports.com:mundra',
    kind: 'custody',
    state: 'pending_countersign',
    initiatedAt: '2026-05-04T07:30:00Z',
    countersignedAt: null,
    settledAt: null,
    credentialId: null,
    bodySha256: null,
    reference: 'BOL-2026-MUN-77419',
    note: 'Bill of lading 77419 · 12 bundles to Hamburg via Mundra.',
    initiatedBy: 'logistics@vedanta.co.in',
    countersignedBy: null,
  },
  {
    id: 't-2026-005',
    passportUpi: '08901003079011/C-20260411-22390/CGG-002',
    productLabel: 'CGG Jumbo Zinc Block · ASTM B852-13',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'ArcelorMittal Nippon Steel · Hazira',
    toDid: 'did:web:amns.in:hazira',
    kind: 'ownership',
    state: 'rejected',
    initiatedAt: '2026-04-11T10:30:00Z',
    countersignedAt: '2026-04-11T16:45:00Z',
    settledAt: null,
    credentialId: null,
    bodySha256: null,
    reference: 'PO-AMNS-2026-0411',
    note: 'Counterparty rejected · grade spec mismatch (CGG vs PWG expected).',
    initiatedBy: 'sustainability.lead@vedanta.co.in',
    countersignedBy: 'qa@amns.in',
  },
  {
    id: 't-2026-006',
    passportUpi: '08901003079011/C-20260408-55102/EZN-014',
    productLabel: 'EcoZen SHG 99.995 Sow · IS 209:1992',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'Maruti Suzuki India · Manesar',
    toDid: 'did:web:marutisuzuki.com:procurement',
    kind: 'ownership',
    state: 'settled',
    initiatedAt: '2026-04-08T13:00:00Z',
    countersignedAt: '2026-04-09T10:22:00Z',
    settledAt: '2026-04-09T10:22:00Z',
    credentialId: 'VC-OWN-2026-006',
    bodySha256: 'aa11…02bd',
    reference: 'PO-MSI-2026-0124',
    note: 'Automotive die-cast feedstock for galvanised body panels.',
    initiatedBy: 'sustainability.lead@vedanta.co.in',
    countersignedBy: 'procurement@marutisuzuki.com',
  },
  {
    id: 't-2026-007',
    passportUpi: '08901003078011/C-20260402-13045/PB99-009',
    productLabel: 'Refined Lead 99.99 Ingot · IS 27:2023 · 680 kg',
    fromOrg: 'HZL Commercial Operations',
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg: 'Amara Raja Batteries',
    toDid: 'did:web:amararaja.com:tirupati',
    kind: 'ownership',
    state: 'disputed',
    initiatedAt: '2026-04-02T08:45:00Z',
    countersignedAt: '2026-04-04T14:30:00Z',
    settledAt: null,
    credentialId: null,
    bodySha256: null,
    reference: 'PO-ARBL-2026-0142',
    note: 'CFP discrepancy raised · under DNV review.',
    initiatedBy: 'sustainability.lead@vedanta.co.in',
    countersignedBy: 'qa@amararaja.com',
  },
]

const STORE: Transfer[] = [...SEED]

export function listTransfers(): Transfer[] {
  return [...STORE].sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt))
}

export function getTransfer(id: string): Transfer | null {
  return STORE.find((t) => t.id === id) ?? null
}

export function addTransfer(
  input: Omit<
    Transfer,
    | 'id'
    | 'initiatedAt'
    | 'countersignedAt'
    | 'settledAt'
    | 'credentialId'
    | 'bodySha256'
    | 'countersignedBy'
  >,
): Transfer {
  const t: Transfer = {
    ...input,
    id: `t-${new Date().getFullYear()}-${String(STORE.length + 1).padStart(3, '0')}`,
    initiatedAt: new Date().toISOString(),
    countersignedAt: null,
    settledAt: null,
    credentialId: null,
    bodySha256: null,
    countersignedBy: null,
  }
  STORE.unshift(t)
  return t
}

export function settleTransfer(id: string, by: string): Transfer | null {
  const t = STORE.find((x) => x.id === id)
  if (!t) return null
  const now = new Date().toISOString()
  t.state = 'settled'
  t.countersignedAt = now
  t.settledAt = now
  t.countersignedBy = by
  // Synthesize a deterministic VC id + body hash for the demo.
  t.credentialId = `VC-${t.kind.replace('_', '').toUpperCase()}-${t.id.slice(2)}`
  t.bodySha256 = randomHashShort()
  return t
}

export function rejectTransfer(id: string, by: string): Transfer | null {
  const t = STORE.find((x) => x.id === id)
  if (!t) return null
  t.state = 'rejected'
  t.countersignedAt = new Date().toISOString()
  t.countersignedBy = by
  return t
}

export function cancelTransfer(id: string): Transfer | null {
  const t = STORE.find((x) => x.id === id)
  if (!t) return null
  if (t.state !== 'pending_countersign' && t.state !== 'draft') return t
  t.state = 'rejected'
  t.note = `${t.note ?? ''}\nCancelled by issuer.`.trim()
  return t
}

function randomHashShort(): string {
  const hex = '0123456789abcdef'
  let a = ''
  let b = ''
  for (let i = 0; i < 4; i++) a += hex[Math.floor(Math.random() * 16)]
  for (let i = 0; i < 4; i++) b += hex[Math.floor(Math.random() * 16)]
  return `${a}…${b}`
}
