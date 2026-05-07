/**
 * @dpp/sim — programmatic API to fire canonical cast events.
 *
 * Used by the operator console's Sources tab and by the CLI under bin/dpp-sim.
 * In v2 the live MES connector replaces this for production casts; the
 * simulator stays for workshop mode and disaster-recovery drills.
 */

import {
  presets,
  type CastEvent,
  type SimulatorPreset,
  type CastEventSourceKind,
} from '@dpp/schema'

export interface FireOptions {
  presetId: keyof typeof presets
  apiBaseUrl?: string
  tenantId?: number
  actor?: string
  sourceKind?: CastEventSourceKind
  /** Override any cast field — used by workshop mode's configurator. */
  overrides?: Partial<CastEvent['cast']>
}

export interface FireResult {
  trackingId: string
  status: string
  upi?: string
  digitalLinkUrl?: string
}

export function buildCastEvent(opts: FireOptions): CastEvent {
  const preset = presets[opts.presetId] as SimulatorPreset | undefined
  if (!preset) {
    throw new Error(`unknown preset: ${String(opts.presetId)}`)
  }

  const trackingId = crypto.randomUUID()
  const castNumber = `C-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    Math.random() * 90000 + 10000,
  )}`

  // Pre-minted Chanderiya BPNS — see apps/api/dpp_api/services/bpn.py.
  // Producer-tag → BPNS lookup is canonical there; the sim uses the most-cited
  // smelter as the default and lets opts.overrides set siteBpns explicitly.
  const SITE_BY_TAG: Record<string, string> = {
    CHA: 'BPNSHZSCHA00012N',
    DAR: 'BPNSHZSDAR0001OU',
    DEB: 'BPNSHZSDEB00014X',
    PAN: 'BPNSHZSPAN0001TJ',
  }
  const siteBpns = SITE_BY_TAG[preset.producingSiteTag ?? 'CHA'] ?? SITE_BY_TAG.CHA

  const dims = preset.physical.dimensions ?? {}

  return {
    schemaVersion: '1.0.0',
    trackingId,
    source: {
      kind: opts.sourceKind ?? 'simulator',
      actor: opts.actor ?? 'sim-cli',
      presetId: preset.id,
    },
    occurredAt: new Date().toISOString(),
    tenantId: opts.tenantId ?? 1,
    cast: {
      castNumber,
      metal: preset.metal,
      gradeCode: preset.gradeCode,
      form: preset.form,
      unitMassKg: preset.physical.unitMassKg,
      bundleMassKg: preset.physical.bundleMassKg,
      siteBpns,
      ...(dims.lengthMm !== undefined && { lengthMm: dims.lengthMm }),
      ...(dims.widthMm !== undefined && { widthMm: dims.widthMm }),
      ...(dims.heightMm !== undefined && { heightMm: dims.heightMm }),
      ...opts.overrides,
    },
  }
}

export async function fire(opts: FireOptions): Promise<FireResult> {
  const apiBase = opts.apiBaseUrl ?? process.env.DPP_API_BASE_URL ?? 'http://localhost:8000'
  const event = buildCastEvent(opts)

  const res = await fetch(`${apiBase}/api/v1/cast-events/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(event),
  })
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      `API rejected cast event (${res.status}): ${JSON.stringify(body.detail ?? body)}`,
    )
  }
  return {
    trackingId: String(body.tracking_id),
    status: String(body.status),
    upi: body.upi ? String(body.upi) : undefined,
    digitalLinkUrl: body.digital_link_url ? String(body.digital_link_url) : undefined,
  }
}

export function listPresets(): { id: string; label: string; summary: string }[] {
  return Object.values(presets).map((p) => ({
    id: (p as SimulatorPreset).id,
    label: (p as SimulatorPreset).label,
    summary: (p as SimulatorPreset).summary,
  }))
}
