/**
 * Server-side API client for the FastAPI backend.
 *
 * Stays narrow on purpose · every read goes through one of these typed
 * functions so we can centralise auth header injection, retry policy, and
 * tenant-id propagation. All calls forward the verified bearer token via
 * `authHeaders()`; tenant resolution happens server-side from the JWT
 * claims, never from caller-supplied headers.
 */

import { ApiAuthError, authHeaders } from './api-auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

async function authedFetch(url: string, init: RequestInit = {}): Promise<Response | null> {
  let auth: HeadersInit
  try {
    auth = await authHeaders()
  } catch (err) {
    if (err instanceof ApiAuthError) return null
    throw err
  }
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), ...auth },
    cache: 'no-store',
  }).catch(() => null)
}

/**
 * A row in the DPP listing API. v1.0 / Chem-X shape — HZL zinc/lead/silver.
 *
 * Legacy aluminium fields (`brand`, `alloy`, `cfpKgCo2ePerTonne`,
 * `weightKg`) are kept as transitional aliases so the migration of
 * deeper console pages can land in tranches without breaking the build.
 * Each tranche replaces a page's reads with the canonical names below;
 * once the last consumer is migrated, the legacy fields will be dropped.
 */
export interface DppRow {
  upi: string
  /** zinc | lead | silver */
  metal: string
  /** HZL grade code · EcoZen-SHG / CGG / PB-9999 / SHG / HG / PW / HZDA3 / Silver-9999 / … */
  gradeCode: string
  /** Optional commercial/trade name · "EcoZen", "Vedanta 99.99", null for generic grades. */
  tradeName: string | null
  /** Form · ingot_25kg / jumbo_1t / bar_30kg / etc. */
  form: string
  /** Unit mass (kg) of an ingot / bar / jumbo. */
  unitMassKg: number
  /** Cradle-to-gate Product Carbon Footprint, kg CO2e/kg. */
  pcfKgCo2ePerKg: number
  /** Recycled content, weighted percent (0 for primary metal). */
  recycledContentPct: number
  state: string
  issuedAt: string | null
  /** GS1 Digital Link URL · resolves to /dpp/<bpnl>/<uuid>. */
  digitalLinkUrl: string | null
  /** Producing site BPNS (Chanderiya / Dariba / Debari / Pantnagar). */
  siteBpns: string | null
  // ── Legacy aluminium fields · transitional aliases (drop after sweep) ──
  /** @deprecated use `tradeName` */
  brand: string
  /** @deprecated use `gradeCode` */
  alloy: string
  /** @deprecated use `unitMassKg` */
  weightKg: number
  /** @deprecated use `pcfKgCo2ePerKg * 1000` */
  cfpKgCo2ePerTonne: number
}

export interface DppListResult {
  items: DppRow[]
  total: number
  limit: number
  offset: number
}

/** Compact preset row returned by GET /api/v1/presets/. */
export interface PresetSummary {
  id: string
  label: string
  summary: string
  metal: string
  gradeCode: string
  tradeName: string | null
  form: string
  /** Cradle-to-gate PCF in kg CO2e/kg. */
  pcfKgCo2ePerKg: number
  /** IZA / ILA / IPA industry average for the same metal+form. */
  industryAverageKgCo2ePerKg: number
  /** Optional EPD registration number. */
  epdRegistrationNumber: string | null
  // ── Legacy aluminium fields ────────────────────────────────────────────
  /** @deprecated use `tradeName` */
  brand: string
  /** @deprecated use `gradeCode` */
  alloyEn: string
  /** @deprecated use `{ pcfKgCo2ePerKg, industryAverageKgCo2ePerKg }` */
  carbon: { valueKgCo2ePerTonne: number; industryAverageKgCo2ePerTonne: number }
  /** @deprecated zinc/lead presets are 0% recycled; field retained for legacy renderers */
  recycledContent: { totalPercent: number }
}

/** Detailed preset shape used by the wizard (subset of the JSON preset). */
export interface PresetDetail {
  id: string
  label: string
  summary: string
  metal: 'zinc' | 'lead' | 'silver'
  gradeCode: string
  tradeName?: string
  purityPercent: number
  form:
    | 'ingot_25kg'
    | 'ingot_9kg'
    | 'jumbo_1t'
    | 'bar_30kg'
    | 'bar_1kg'
    | 'powder'
    | 'dust'
    | 'oxide'
  applicableStandards: string[]
  physical: {
    unitMassKg: number
    bundleMassKg?: number
    unitsPerBundle?: number
    dimensions?: { lengthMm: number; widthMm: number; heightMm: number; tolerance?: string }
  }
  sustainability: {
    pcf: { value: number; unit: string; industryAverage?: { value: number; unit: string; source?: string } }
    renewableElectricityPercent?: number
    epd?: { registrationNumber: string; programOperator?: string; validUntil?: string; url?: string }
  }
  producingSiteTag?: string
}

export interface AuditEntry {
  id: number
  occurredAt: string
  actorKind: 'user' | 'system' | 'external_verifier' | 'platform' | 'api_key'
  actorId: string | null
  action: string
  targetKind: string
  targetId: string | null
  severity: 'debug' | 'info' | 'notice' | 'warn' | 'error' | 'critical'
  details: Record<string, unknown>
  prevHash: string | null
  currentHash: string
}

export interface AuditListResult {
  items: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditFilters {
  action?: string
  actorKind?: string
  severity?: string
  targetKind?: string
  since?: string
  until?: string
  limit?: number
  offset?: number
}

async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  return (await res.json()) as T
}

/**
 * A line in the verifier registry — one row per attested PCF statement.
 *
 * Legacy aluminium fields (`brand`, `facilityUfi`, `valueKgCo2ePerTonne`)
 * are retained as transitional aliases until the verifier surfaces are
 * migrated.
 */
export interface VerifierBrandLine {
  id: number
  /** HZL grade code or trade name the statement covers. */
  gradeCode: string
  /** BPNS of the producing site the statement applies to. */
  siteBpns: string | null
  periodFrom: string
  periodTo: string
  pcfKgCo2ePerKg: number
  statementRef: string
  assuranceLevel: string
  state: 'active' | 'superseded' | 'revoked'
  createdAt: string
  // ── Legacy aluminium fields ────────────────────────────────────────────
  /** @deprecated use `gradeCode` */
  brand: string
  /** @deprecated use `siteBpns` */
  facilityUfi: string | null
  /** @deprecated use `pcfKgCo2ePerKg * 1000` */
  valueKgCo2ePerTonne: number
}

export interface VerifierRegistryEntry {
  verifierDid: string
  verifierName: string
  lines: VerifierBrandLine[]
  /** @deprecated transitional alias for `lines` */
  brands: VerifierBrandLine[]
  stateCounts: { active: number; superseded: number; revoked: number }
  latestStatementRef: string | null
  latestPeriodTo: string | null
  dependentDppCount: number
}

export async function listVerifierRegistry(): Promise<VerifierRegistryEntry[]> {
  const res = await authedFetch(`${API_BASE}/api/v1/verifier-registry`)
  if (!res) return []
  const body = await safeJson<{ items: VerifierRegistryEntry[] }>(res)
  return body?.items ?? []
}

export async function listAuditEntries(filters: AuditFilters = {}): Promise<AuditListResult> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.actorKind) params.set('actor_kind', filters.actorKind)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.targetKind) params.set('target_kind', filters.targetKind)
  if (filters.since) params.set('since', filters.since)
  if (filters.until) params.set('until', filters.until)
  params.set('limit', String(filters.limit ?? 100))
  params.set('offset', String(filters.offset ?? 0))
  const res = await authedFetch(`${API_BASE}/api/v1/audit?${params}`)
  const fallback = {
    items: [],
    total: 0,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  }
  if (!res) return fallback
  return (await safeJson<AuditListResult>(res)) ?? fallback
}

export async function listDpps(
  opts: { limit?: number; metal?: string; gradeCode?: string; state?: string; offset?: number } = {},
): Promise<DppListResult> {
  const params = new URLSearchParams()
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.metal) params.set('metal', opts.metal)
  if (opts.gradeCode) params.set('grade_code', opts.gradeCode)
  if (opts.state) params.set('state', opts.state)
  if (opts.offset) params.set('offset', String(opts.offset))
  const res = await authedFetch(`${API_BASE}/api/v1/dpps/?${params}`)
  if (!res) return { items: [], total: 0, limit: opts.limit ?? 50, offset: 0 }
  return (
    (await safeJson<DppListResult>(res)) ?? {
      items: [],
      total: 0,
      limit: opts.limit ?? 50,
      offset: 0,
    }
  )
}

export interface FullDppView {
  upi: string
  state: string
  dpp: Record<string, unknown>
  envelope: Record<string, unknown> | null
  signatureRef: {
    algorithm: string
    value: string | null
    bodySha256: string | null
  } | null
  issuedAt: string | null
  expiresAt: string | null
}

export async function fetchDppFull(upi: string): Promise<FullDppView | null> {
  const res = await authedFetch(`${API_BASE}/api/v1/dpps/${upi}?tier=internal`)
  if (!res) return null
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) return null
  return body as FullDppView
}

export async function listPresets(): Promise<PresetSummary[]> {
  const res = await authedFetch(`${API_BASE}/api/v1/presets/`)
  if (!res) return []
  const body = await safeJson<{ items: PresetSummary[] }>(res)
  return body?.items ?? []
}

export async function fetchPreset(id: string): Promise<PresetDetail | null> {
  const res = await authedFetch(`${API_BASE}/api/v1/presets/${encodeURIComponent(id)}`)
  if (!res || !res.ok) return null
  return (await res.json().catch(() => null)) as PresetDetail | null
}

export async function firePreset(
  presetId: string,
): Promise<{ ok: boolean; upi?: string; detail?: string }> {
  const trackingId = crypto.randomUUID()
  const event = {
    schemaVersion: '1.0.0',
    trackingId,
    source: { kind: 'simulator', actor: 'web-console', presetId },
    occurredAt: new Date().toISOString(),
    tenantId: 1,
    cast: await _castFromPreset(presetId),
  }
  const res = await authedFetch(`${API_BASE}/api/v1/cast-events/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res) return { ok: false, detail: 'API unreachable or sign in required' }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string }
    return { ok: false, detail: body.detail ?? `HTTP ${res.status}` }
  }
  const body = (await res.json()) as { upi?: string }
  return { ok: true, upi: body.upi }
}

async function _castFromPreset(presetId: string) {
  const res = await authedFetch(`${API_BASE}/api/v1/presets/${presetId}`)
  if (!res || !res.ok) throw new Error(`preset ${presetId} not found`)
  const p = (await res.json()) as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const castNumber = `C-${today}-${Math.floor(Math.random() * 90000 + 10000)}`
  const physical = (p.physical ?? {}) as Record<string, unknown>
  const dimensions = (physical.dimensions ?? {}) as Record<string, number>
  const siteBpns = pickSiteBpns(p.producingSiteTag as string | undefined)
  const cast: Record<string, unknown> = {
    castNumber,
    metal: p.metal,
    gradeCode: p.gradeCode,
    form: p.form,
    unitMassKg: physical.unitMassKg ?? 25,
    siteBpns,
  }
  if (typeof physical.bundleMassKg === 'number') cast.bundleMassKg = physical.bundleMassKg
  if (typeof dimensions.lengthMm === 'number') cast.lengthMm = dimensions.lengthMm
  if (typeof dimensions.widthMm === 'number') cast.widthMm = dimensions.widthMm
  if (typeof dimensions.heightMm === 'number') cast.heightMm = dimensions.heightMm
  return cast
}

/** Producing site → BPNS lookup for the simulator. Per the HZL site map. */
function pickSiteBpns(tag: string | undefined): string {
  switch (tag) {
    case 'CHA':
      return 'BPNSHZSCHA00012N'
    case 'DAR':
      return 'BPNSHZSDAR00027L'
    case 'DEB':
      return 'BPNSHZSDEB00033K'
    case 'PNT':
      return 'BPNSHZSPNT00041J'
    default:
      return 'BPNSHZSCHA00012N'
  }
}
