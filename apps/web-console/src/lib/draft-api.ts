import { ApiAuthError, authHeaders } from './api-auth'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000'

export type EntrySource = 'manual' | 'iot' | 'library' | 'external'
export type DraftState = 'entry' | 'disclosure' | 'published' | 'archived'
export type AssignmentStatus = 'pending' | 'accepted' | 'submitted' | 'revoked'
export type Audience = 'public' | 'customer' | 'verifier' | 'authority'

export const AUDIENCES: Audience[] = ['public', 'customer', 'verifier', 'authority']

export interface DraftSummary {
  id: number
  productId: number
  productName: string | null
  productSlug: string | null
  dppVersion: string
  castNumber: string
  itemSerial: string | null
  title: string | null
  state: DraftState
  createdBy: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  publishedDppId: number | null
}

export interface DraftAssignment {
  id: number
  draftId: number
  manifestAttrId: number
  assigneeEmail: string
  assigneeName: string | null
  assigneeOrg: string | null
  note: string | null
  status: AssignmentStatus
  assignedBy: string
  assignedAt: string | null
  submittedAt: string | null
  accessToken?: string
}

export interface DraftAttribute {
  manifestAttrId: number
  attributePath: string
  label: string
  necessity: 'mandatory' | 'recommended' | 'voluntary'
  regulatoryAnchor: string | null
  version: string
  value: unknown
  source: EntrySource
  sourceRef: string | null
  status: 'empty' | 'pending' | 'complete'
  enteredBy: string | null
  enteredAt: string | null
  assignment: DraftAssignment | null
}

export interface DraftStage {
  stepId: number
  slug: string
  name: string
  tier: string
  ordinal: number
  attributes: DraftAttribute[]
  completion: { complete: number; total: number; pct: number; isComplete: boolean }
  dataSource: {
    id: number
    origin: string
    supplierName: string | null
    permissionState: string
  } | null
}

export interface DraftView {
  draft: DraftSummary
  stages: DraftStage[]
  completion: {
    complete: number
    total: number
    pct: number
    stagesComplete: number
    stagesTotal: number
    readyForDisclosure: boolean
  }
}

export interface IotConnection {
  id: number
  name: string
  kind: 'mes' | 'scada' | 'aws_iot' | 'mqtt' | 'http_pull'
  endpoint: string | null
  config: Record<string, unknown>
  attributeMap: Record<string, unknown>
  status: 'connected' | 'disconnected' | 'error'
  productId: number | null
  processStepId: number | null
  lastSyncAt: string | null
}

export interface LibraryPreset {
  id: string
  label: string
  summary: string | null
  brand: string | null
  form: string | null
}

export interface DisclosureRow {
  stepId: number
  stepName: string
  attributePath: string
  label: string
  necessity: 'mandatory' | 'recommended' | 'voluntary'
  value: unknown
  visibility: Record<Audience, boolean>
}

export interface DisclosureView {
  draft: DraftSummary
  audiences: Audience[]
  matrix: DisclosureRow[]
}

export interface InboxAssignment extends DraftAssignment {
  manifestAttr: {
    id: number
    attributePath: string
    label: string
    necessity: 'mandatory' | 'recommended' | 'voluntary'
    regulatoryAnchor: string | null
    version: string
  }
  draft: {
    id: number
    castNumber: string
    title: string | null
    state: DraftState
    productId: number
    productName: string
    productBrand: string
  }
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  let auth: HeadersInit
  try {
    auth = await authHeaders()
  } catch (err) {
    if (err instanceof ApiAuthError) return null
    throw err
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...auth },
    cache: 'no-store',
  }).catch(() => null)
}

async function safeJson<T>(res: Response | null): Promise<T | null> {
  if (!res?.ok) return null
  return (await res.json()) as T
}

interface ApiError {
  detail?: string
}

export class DraftApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await authedFetch(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res) throw new DraftApiError(0, 'network unavailable')
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiError
    throw new DraftApiError(res.status, err.detail ?? `request failed (${res.status})`)
  }
  return (await res.json()) as T
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res?.ok) throw new DraftApiError(res?.status ?? 0, 'patch failed')
  return (await res.json()) as T
}

async function del<T>(path: string): Promise<T> {
  const res = await authedFetch(path, { method: 'DELETE' })
  if (!res?.ok) throw new DraftApiError(res?.status ?? 0, 'delete failed')
  return (await res.json()) as T
}

// ── Draft CRUD ──────────────────────────────────────────────────────────

export async function listDrafts(state?: DraftState): Promise<DraftSummary[]> {
  const q = state ? `?state=${encodeURIComponent(state)}` : ''
  const res = await safeJson<{ drafts: DraftSummary[] }>(
    await authedFetch(`/api/v1/draft-passports${q}`),
  )
  return res?.drafts ?? []
}

export async function fetchDraft(id: number): Promise<DraftView | null> {
  return safeJson<DraftView>(await authedFetch(`/api/v1/draft-passports/${id}`))
}

export async function createDraft(input: {
  productId: number
  dppVersion: string
  castNumber: string
  itemSerial?: string
  title?: string
}): Promise<DraftView> {
  return post('/api/v1/draft-passports', input)
}

// ── Attribute entry ─────────────────────────────────────────────────────

export async function setValue(
  draftId: number,
  input: { manifestAttrId: number; value: unknown; source: EntrySource; sourceRef?: string },
): Promise<DraftView> {
  return post(`/api/v1/draft-passports/${draftId}/values`, input)
}

export async function setValuesBulk(
  draftId: number,
  items: { manifestAttrId: number; value: unknown; source: EntrySource; sourceRef?: string }[],
): Promise<DraftView> {
  return post(`/api/v1/draft-passports/${draftId}/values/bulk`, { items })
}

export async function listLibraryPresets(draftId: number): Promise<LibraryPreset[]> {
  const res = await safeJson<{ presets: LibraryPreset[] }>(
    await authedFetch(`/api/v1/draft-passports/${draftId}/library-presets`),
  )
  return res?.presets ?? []
}

export async function pullFromLibrary(
  draftId: number,
  input: { processStepId: number; presetId: string },
): Promise<DraftView> {
  return post(`/api/v1/draft-passports/${draftId}/library-pull`, input)
}

export async function listIotConnections(
  draftId: number,
  processStepId?: number,
): Promise<IotConnection[]> {
  const q = processStepId ? `?processStepId=${processStepId}` : ''
  const res = await safeJson<{ connections: IotConnection[] }>(
    await authedFetch(`/api/v1/draft-passports/${draftId}/iot-connections${q}`),
  )
  return res?.connections ?? []
}

export async function upsertIotConnection(input: {
  name: string
  kind: IotConnection['kind']
  endpoint?: string
  config?: Record<string, unknown>
  attributeMap?: Record<string, unknown>
  productId?: number
  processStepId?: number
}): Promise<IotConnection> {
  return post('/api/v1/draft-passports/iot-connections', input)
}

export async function pullFromIot(
  draftId: number,
  input: { processStepId: number; iotConnectionId: number },
): Promise<DraftView> {
  return post(`/api/v1/draft-passports/${draftId}/iot-pull`, input)
}

// ── Assignments ────────────────────────────────────────────────────────

export async function assignAttribute(
  draftId: number,
  input: {
    manifestAttrId: number
    assigneeEmail: string
    assigneeName?: string
    assigneeOrg?: string
    note?: string
  },
): Promise<DraftAssignment> {
  return post(`/api/v1/draft-passports/${draftId}/assignments`, input)
}

export async function revokeAssignment(assignmentId: number): Promise<DraftAssignment> {
  return del(`/api/v1/draft-passports/assignments/${assignmentId}`)
}

export async function fetchAssignmentInbox(email: string): Promise<InboxAssignment[]> {
  const res = await safeJson<{ assignments: InboxAssignment[] }>(
    await authedFetch(
      `/api/v1/draft-passports/assignments/inbox?email=${encodeURIComponent(email)}`,
    ),
  )
  return res?.assignments ?? []
}

export async function submitAssignment(
  accessToken: string,
  value: unknown,
): Promise<DraftAssignment> {
  return post(`/api/v1/draft-passports/assignments/${accessToken}/submit`, { value })
}

// ── Disclosure + publish ───────────────────────────────────────────────

export async function beginDisclosure(draftId: number): Promise<DisclosureView> {
  return post(`/api/v1/draft-passports/${draftId}/disclosure/begin`)
}

export async function fetchDisclosure(draftId: number): Promise<DisclosureView | null> {
  return safeJson<DisclosureView>(
    await authedFetch(`/api/v1/draft-passports/${draftId}/disclosure`),
  )
}

export async function updateDisclosure(
  draftId: number,
  input: { attributePath: string; audience: Audience; visible: boolean },
): Promise<{ attributePath: string; audience: Audience; visible: boolean }> {
  return patch(`/api/v1/draft-passports/${draftId}/disclosure`, input)
}

export async function publishDraft(draftId: number): Promise<{
  draftId: number
  dppRecordId: number
  upi: string
  bodySha256: string
  issuedAt: string | null
}> {
  return post(`/api/v1/draft-passports/${draftId}/publish`)
}
