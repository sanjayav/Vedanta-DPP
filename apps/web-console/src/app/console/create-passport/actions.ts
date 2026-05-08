'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  type Audience,
  type DraftAssignment,
  type DraftView,
  type EntrySource,
  type IotConnection,
  type LibraryPreset,
  assignAttribute,
  beginDisclosure,
  createDraft,
  fetchDisclosure,
  fetchDraft,
  listIotConnections,
  listLibraryPresets,
  publishDraft,
  pullFromIot,
  pullFromLibrary,
  revokeAssignment,
  setValue,
  setValuesBulk,
  updateDisclosure,
  upsertIotConnection,
} from '@/lib/draft-api'

export async function createDraftAction(input: {
  productId: number
  dppVersion: string
  castNumber: string
  itemSerial?: string
  title?: string
}): Promise<{ ok: true; draftId: number } | { ok: false; error: string }> {
  try {
    const view = await createDraft(input)
    revalidatePath('/console/create-passport')
    return { ok: true, draftId: view.draft.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function setValueAction(
  draftId: number,
  manifestAttrId: number,
  value: unknown,
  source: EntrySource = 'manual',
): Promise<DraftView | { error: string }> {
  try {
    const view = await setValue(draftId, { manifestAttrId, value, source })
    revalidatePath(`/console/create-passport/${draftId}`)
    return view
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function setValuesBulkAction(
  draftId: number,
  items: { manifestAttrId: number; value: unknown; source?: EntrySource; sourceRef?: string }[],
): Promise<DraftView | { error: string }> {
  try {
    const view = await setValuesBulk(
      draftId,
      items.map((i) => ({
        manifestAttrId: i.manifestAttrId,
        value: i.value,
        source: i.source ?? 'manual',
        sourceRef: i.sourceRef,
      })),
    )
    revalidatePath(`/console/create-passport/${draftId}`)
    return view
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function listLibraryPresetsAction(draftId: number): Promise<LibraryPreset[]> {
  return listLibraryPresets(draftId)
}

export async function pullLibraryAction(
  draftId: number,
  processStepId: number,
  presetId: string,
): Promise<DraftView | { error: string }> {
  try {
    const view = await pullFromLibrary(draftId, { processStepId, presetId })
    revalidatePath(`/console/create-passport/${draftId}`)
    return view
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function listIotAction(
  draftId: number,
  processStepId?: number,
): Promise<IotConnection[]> {
  return listIotConnections(draftId, processStepId)
}

export async function upsertIotAction(input: {
  name: string
  kind: IotConnection['kind']
  endpoint?: string
  config?: Record<string, unknown>
  attributeMap?: Record<string, unknown>
  productId?: number
  processStepId?: number
}): Promise<IotConnection | { error: string }> {
  try {
    return await upsertIotConnection(input)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function pullIotAction(
  draftId: number,
  processStepId: number,
  iotConnectionId: number,
): Promise<DraftView | { error: string }> {
  try {
    const view = await pullFromIot(draftId, { processStepId, iotConnectionId })
    revalidatePath(`/console/create-passport/${draftId}`)
    return view
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function assignAction(
  draftId: number,
  input: {
    manifestAttrId: number
    assigneeEmail: string
    assigneeName?: string
    assigneeOrg?: string
    note?: string
  },
): Promise<DraftAssignment | { error: string }> {
  try {
    const assignment = await assignAttribute(draftId, input)
    revalidatePath(`/console/create-passport/${draftId}`)
    return assignment
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function revokeAssignmentAction(
  draftId: number,
  assignmentId: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    await revokeAssignment(assignmentId)
    revalidatePath(`/console/create-passport/${draftId}`)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function refreshDraftAction(draftId: number): Promise<DraftView | null> {
  return fetchDraft(draftId)
}

export async function beginDisclosureAction(
  draftId: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    await beginDisclosure(draftId)
    revalidatePath(`/console/create-passport/${draftId}`)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function fetchDisclosureAction(draftId: number) {
  return fetchDisclosure(draftId)
}

export async function updateDisclosureAction(
  draftId: number,
  attributePath: string,
  audience: Audience,
  visible: boolean,
): Promise<{ ok: true } | { error: string }> {
  try {
    await updateDisclosure(draftId, { attributePath, audience, visible })
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function publishAction(
  draftId: number,
): Promise<{ ok: true; dppRecordId: number; upi: string } | { error: string }> {
  try {
    const res = await publishDraft(draftId)
    revalidatePath(`/console/create-passport/${draftId}`)
    revalidatePath('/console/dpps')
    return { ok: true, dppRecordId: res.dppRecordId, upi: res.upi }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'failed' }
  }
}

export async function gotoDraftAction(draftId: number): Promise<void> {
  redirect(`/console/create-passport/${draftId}`)
}
