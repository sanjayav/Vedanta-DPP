/**
 * Audience filtering for the public viewer.
 *
 * The DPP body carries data for every viewer tier · public, customer,
 * verifier, authority. This module returns a deep-cloned, redacted view of
 * the body for a given audience, mirroring SDD §12 access-rights model.
 *
 * Defaults:
 *   public    · story, headline carbon, recycled %, certifications, doc highlights
 *   customer  · public + chemistry, dimensions, mill test, supply chain map
 *   verifier  · customer + LCA breakdown, CBAM dossier, audit log, SoC details
 *   authority · verifier + cell telemetry, full document vault, regulatory contact
 *
 * Filtering happens server-side so the public route can SSR a fully filtered
 * payload · no client-only redaction (CLAUDE.md §7).
 */

import type { DemoAudience } from '@dpp/ui'

// Public sees the spec-sheet view a buyer would see on a phone scan: chemistry
// per IS 209 / IS 27 / ASTM B852, CFP headline, certificates, EoL guidance.
// Truly internal items (audit chain, raw telemetry, exhaustive PEF) stay
// tier-gated.
const PUBLIC_HIDDEN_PATHS = new Set<string>([
  'chemistry.fullElementalBreakdown',
  'audit.events',
  'producer.regulatoryContact.phone',
])

const CUSTOMER_HIDDEN_PATHS = new Set<string>(['audit.events'])

const VERIFIER_HIDDEN_PATHS = new Set<string>([])

const AUTHORITY_HIDDEN_PATHS = new Set<string>([])

const DOC_AUDIENCE_TAG = 'requiresAudience'

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function deletePath(target: Record<string, unknown>, path: string): void {
  const segments = path.split('.')
  let cursor: Record<string, unknown> = target
  for (let i = 0; i < segments.length - 1; i++) {
    const next = cursor[segments[i]!]
    if (!next || typeof next !== 'object') return
    cursor = next as Record<string, unknown>
  }
  delete cursor[segments[segments.length - 1]!]
}

export function filterBodyByAudience(
  body: Record<string, unknown>,
  audience: DemoAudience,
): Record<string, unknown> {
  const cloned = deepClone(body)

  const hiddenSet =
    audience === 'public'
      ? PUBLIC_HIDDEN_PATHS
      : audience === 'customer'
        ? CUSTOMER_HIDDEN_PATHS
        : audience === 'verifier'
          ? VERIFIER_HIDDEN_PATHS
          : AUTHORITY_HIDDEN_PATHS

  for (const path of hiddenSet) deletePath(cloned, path)

  // Filter the document vault by per-document audience tag.
  if (Array.isArray(cloned.documents)) {
    cloned.documents = (cloned.documents as Array<Record<string, unknown>>).filter((doc) => {
      const required = doc[DOC_AUDIENCE_TAG] as string[] | undefined
      if (!Array.isArray(required)) return true
      return required.includes(audience)
    })
  }

  return cloned
}

export function audienceLabel(a: DemoAudience): string {
  return a === 'public'
    ? 'Public viewer'
    : a === 'customer'
      ? 'Customer (Tata Steel-tier)'
      : a === 'verifier'
        ? 'Verifier (DNV-tier)'
        : 'Authority (EU regulator)'
}

export function audienceTagline(a: DemoAudience): string {
  return a === 'public'
    ? 'Story-tier · what the buyer of an HZL product sees on a phone scan.'
    : a === 'customer'
      ? 'Commercial tier · adds chemistry, mill test, supply chain map.'
      : a === 'verifier'
        ? 'Verifier tier · full LCA, CBAM dossier, audit log, signed VC.'
        : 'Authority tier · every datum + cell telemetry, regulatory contact, archive.'
}

export const AUDIENCES: DemoAudience[] = ['public', 'customer', 'verifier', 'authority']
