'use server'

import { revalidatePath } from 'next/cache'

import { currentUser } from '@/lib/auth'
import { TENANT_ROLES, hasPermission, type TenantRole } from '@/lib/rbac'

import {
  addTransfer,
  cancelTransfer,
  rejectTransfer,
  settleTransfer,
  type TransferKind,
} from './store'

const KINDS: TransferKind[] = ['ownership', 'custody', 'end_of_life']

function actorRole(role: string): TenantRole {
  return (TENANT_ROLES as readonly string[]).includes(role)
    ? (role as TenantRole)
    : ('tenant_auditor' as TenantRole)
}

export async function initiateTransferAction(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await currentUser()
  // Reuse the publish_passport perm · issuing a transfer signs a new VC, same
  // capability bar.
  if (!hasPermission(actorRole(me.role), 'publish_passport')) {
    return { ok: false, error: 'You do not have permission to initiate a transfer.' }
  }

  const passportUpi = String(formData.get('passportUpi') ?? '').trim()
  const productLabel = String(formData.get('productLabel') ?? '').trim() || passportUpi
  const fromOrg = String(formData.get('fromOrg') ?? '').trim() || 'HZL Commercial Operations'
  const toOrg = String(formData.get('toOrg') ?? '').trim()
  const toDid = String(formData.get('toDid') ?? '').trim()
  const kindRaw = String(formData.get('kind') ?? 'ownership') as TransferKind
  const kind: TransferKind = KINDS.includes(kindRaw) ? kindRaw : 'ownership'
  const reference = String(formData.get('reference') ?? '').trim() || null
  const note = String(formData.get('note') ?? '').trim() || null

  if (!passportUpi) return { ok: false, error: 'Pick a passport UPI to transfer.' }
  if (!toOrg) return { ok: false, error: 'Recipient organisation is required.' }
  if (!toDid || !toDid.startsWith('did:'))
    return { ok: false, error: 'Recipient DID must be a valid did:* identifier.' }

  const t = addTransfer({
    passportUpi,
    productLabel,
    fromOrg,
    fromDid: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
    toOrg,
    toDid,
    kind,
    state: 'pending_countersign',
    reference,
    note,
    initiatedBy: me.email,
  })

  revalidatePath('/console/ownership-transfers')
  return { ok: true, id: t.id }
}

export async function settleTransferAction(id: string): Promise<{ ok: boolean }> {
  const me = await currentUser()
  if (!hasPermission(actorRole(me.role), 'publish_passport')) return { ok: false }
  const t = settleTransfer(id, `${me.email}`)
  if (t) revalidatePath('/console/ownership-transfers')
  return { ok: !!t }
}

export async function rejectTransferAction(id: string): Promise<{ ok: boolean }> {
  const me = await currentUser()
  if (!hasPermission(actorRole(me.role), 'publish_passport')) return { ok: false }
  const t = rejectTransfer(id, me.email)
  if (t) revalidatePath('/console/ownership-transfers')
  return { ok: !!t }
}

export async function cancelTransferAction(id: string): Promise<{ ok: boolean }> {
  const me = await currentUser()
  if (!hasPermission(actorRole(me.role), 'publish_passport')) return { ok: false }
  const t = cancelTransfer(id)
  if (t) revalidatePath('/console/ownership-transfers')
  return { ok: !!t }
}
