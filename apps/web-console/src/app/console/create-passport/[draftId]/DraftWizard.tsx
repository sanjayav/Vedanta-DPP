'use client'

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  Database,
  Library,
  Loader2,
  Plug,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'

import type {
  Audience,
  DisclosureView,
  DraftAttribute,
  DraftStage,
  DraftView,
  EntrySource,
  IotConnection,
  LibraryPreset,
} from '@/lib/draft-api'

const AUDIENCES: Audience[] = ['public', 'customer', 'verifier', 'authority']

import {
  assignAction,
  beginDisclosureAction,
  fetchDisclosureAction,
  listIotAction,
  listLibraryPresetsAction,
  publishAction,
  pullIotAction,
  pullLibraryAction,
  refreshDraftAction,
  revokeAssignmentAction,
  setValueAction,
  updateDisclosureAction,
  upsertIotAction,
} from '../actions'

const SOURCE_LABEL: Record<EntrySource, string> = {
  manual: 'Manual',
  iot: 'IoT',
  library: 'Library',
  external: 'External',
}

const STAGE_TIER_PALETTE: Record<string, { bg: string; ring: string; label: string }> = {
  upstream: { bg: 'bg-[#F5E9D9]', ring: 'ring-[#D4A574]', label: 'Upstream' },
  production: { bg: 'bg-[#DBEAFE]', ring: 'ring-[#3B82F6]', label: 'Production' },
  downstream: { bg: 'bg-[#DCFCE7]', ring: 'ring-[#16a34a]', label: 'Downstream' },
  verification: { bg: 'bg-[#EDE9FE]', ring: 'ring-[#7C3AED]', label: 'Verification' },
}

function stageTierStyle(tier: string) {
  return (
    STAGE_TIER_PALETTE[tier] ?? {
      bg: 'bg-[var(--surface-hover)]',
      ring: 'ring-[var(--surface-border)]',
      label: tier,
    }
  )
}

const SOURCE_ICON = {
  manual: Database,
  iot: Plug,
  library: Library,
  external: UserPlus,
}

export function DraftWizard({
  initialView,
  initialDisclosure,
}: {
  initialView: DraftView
  initialDisclosure: DisclosureView | null
}) {
  const router = useRouter()
  const [view, setView] = useState<DraftView>(initialView)
  const [disclosure, setDisclosure] = useState<DisclosureView | null>(initialDisclosure)
  const [activeStepId, setActiveStepId] = useState<number | null>(null)
  const [drawerAttr, setDrawerAttr] = useState<DraftAttribute | null>(null)
  const [drawerMode, setDrawerMode] = useState<EntrySource | null>(null)
  const [pending, startTransition] = useTransition()
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [publishResult, setPublishResult] = useState<{ upi: string; dppRecordId: number } | null>(
    null,
  )

  const activeStage = view.stages.find((s) => s.stepId === activeStepId) ?? null

  const refresh = () => {
    startTransition(async () => {
      const v = await refreshDraftAction(view.draft.id)
      if (v) setView(v)
    })
  }

  const handleResult = <T,>(result: T | { error: string }): result is T => {
    if (result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)) {
      setBannerError((result as { error: string }).error)
      return false
    }
    setBannerError(null)
    return true
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-[var(--surface-page)]">
      <Header
        view={view}
        onContinueDisclosure={() => {
          startTransition(async () => {
            const r = await beginDisclosureAction(view.draft.id)
            if (handleResult(r)) {
              const v = await refreshDraftAction(view.draft.id)
              const d = await fetchDisclosureAction(view.draft.id)
              if (v) setView(v)
              setDisclosure(d)
            }
          })
        }}
        onPublish={() => {
          startTransition(async () => {
            const r = await publishAction(view.draft.id)
            if ('error' in r) setBannerError(r.error)
            else {
              setPublishResult({ upi: r.upi, dppRecordId: r.dppRecordId })
              const v = await refreshDraftAction(view.draft.id)
              if (v) setView(v)
            }
          })
        }}
        pending={pending}
      />

      {bannerError && (
        <div className="mx-7 mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]">
          <AlertCircle className="h-3.5 w-3.5" />
          {bannerError}
          <button onClick={() => setBannerError(null)} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {publishResult && (
        <div className="mx-7 mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[#86EFAC] bg-[#F0FDF4] px-3 py-2 text-[12px] text-[#166534]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Published · DPP record #{publishResult.dppRecordId}.{' '}
          <button onClick={() => router.push('/console/dpps')} className="font-medium underline">
            View in passports list →
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {view.draft.state === 'entry' && (
          <EntryView
            view={view}
            activeStage={activeStage}
            onPickStage={setActiveStepId}
            onPickAttribute={(attr) => {
              setDrawerAttr(attr)
              setDrawerMode(null)
            }}
            onRefresh={refresh}
            onError={setBannerError}
          />
        )}

        {(view.draft.state === 'disclosure' || view.draft.state === 'published') && disclosure && (
          <DisclosureView
            disclosure={disclosure}
            published={view.draft.state === 'published'}
            onToggle={(row, audience, visible) => {
              startTransition(async () => {
                const r = await updateDisclosureAction(
                  view.draft.id,
                  row.attributePath,
                  audience,
                  visible,
                )
                if (handleResult(r)) {
                  const d = await fetchDisclosureAction(view.draft.id)
                  setDisclosure(d)
                }
              })
            }}
          />
        )}
      </div>

      {drawerAttr && activeStage && (
        <AttributeDrawer
          draftId={view.draft.id}
          stage={activeStage}
          attribute={drawerAttr}
          mode={drawerMode}
          onPickMode={setDrawerMode}
          onClose={() => {
            setDrawerAttr(null)
            setDrawerMode(null)
            refresh()
          }}
          onAfterChange={refresh}
          onError={setBannerError}
        />
      )}
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────

function Header({
  view,
  onContinueDisclosure,
  onPublish,
  pending,
}: {
  view: DraftView
  onContinueDisclosure: () => void
  onPublish: () => void
  pending: boolean
}) {
  const stage = view.draft.state
  return (
    <header className="border-b border-[var(--surface-border)] bg-white px-7 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Draft #{view.draft.id} · DPP {view.draft.dppVersion}
          </p>
          <h1 className="mt-1 text-[20px] font-semibold leading-tight text-[var(--fg-default)]">
            {view.draft.productName ?? 'Passport'} · Cast {view.draft.castNumber}
          </h1>
          <p className="text-[12px] text-[var(--fg-subtle)]">
            {view.completion.complete}/{view.completion.total} attributes complete ·{' '}
            {view.completion.stagesComplete}/{view.completion.stagesTotal} stages green
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StageStateBadge state={stage} />
          {stage === 'entry' && (
            <button
              onClick={onContinueDisclosure}
              disabled={!view.completion.readyForDisclosure || pending}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-30"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Continue to Disclosure
            </button>
          )}
          {stage === 'disclosure' && (
            <button
              onClick={onPublish}
              disabled={pending}
              className="flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white transition disabled:opacity-30"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publish Passport
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500"
          style={{ width: `${view.completion.pct}%` }}
        />
      </div>
    </header>
  )
}

function StageStateBadge({ state }: { state: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    entry: {
      bg: 'bg-[var(--color-accent-soft)]',
      fg: 'text-[var(--color-accent)]',
      label: 'Entry',
    },
    disclosure: { bg: 'bg-[#FEF3C7]', fg: 'text-[#92400E]', label: 'Disclosure' },
    published: { bg: 'bg-[#DCFCE7]', fg: 'text-[#166534]', label: 'Published' },
    archived: { bg: 'bg-[var(--surface-hover)]', fg: 'text-[var(--fg-muted)]', label: 'Archived' },
  }
  const m = map[state] ?? map.entry!
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full ${m.bg} px-3 text-[11px] font-semibold ${m.fg}`}
    >
      {m.label}
    </span>
  )
}

// ── Entry view ─────────────────────────────────────────────────────────

function EntryView({
  view,
  activeStage,
  onPickStage,
  onPickAttribute,
  onRefresh,
  onError,
}: {
  view: DraftView
  activeStage: DraftStage | null
  onPickStage: (id: number) => void
  onPickAttribute: (attr: DraftAttribute) => void
  onRefresh: () => void
  onError: (msg: string | null) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_460px] overflow-hidden">
      <section className="overflow-y-auto p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            Process flow · click a stage to fill its attributes
          </p>
          <AiAutoFillButton
            draftId={view.draft.id}
            stages={view.stages}
            onRefresh={onRefresh}
            onError={onError}
          />
        </div>
        <ol className="relative space-y-2 pl-1">
          {view.stages.map((s, i) => {
            const isActive = activeStage?.stepId === s.stepId
            const done = s.completion.isComplete
            const t = stageTierStyle(s.tier)
            const isLast = i === view.stages.length - 1
            return (
              <li key={s.stepId} className="relative pl-12">
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[18px] top-9 h-full w-px bg-[var(--surface-border)]"
                  />
                )}
                <span
                  className={[
                    'absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full ring-2 transition',
                    done ? 'bg-[#16a34a] text-white ring-[#16a34a]' : `${t.bg} ${t.ring}`,
                  ].join(' ')}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-[11px] font-bold text-[var(--fg-default)]">
                      {s.ordinal}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onPickStage(s.stepId)}
                  className={[
                    'flex w-full items-center justify-between gap-4 rounded-[var(--radius-md)] border-2 p-4 text-left transition',
                    isActive
                      ? 'border-[var(--color-accent)] bg-white shadow-sm'
                      : done
                        ? 'border-[#86EFAC]/60 bg-[#F0FDF4] hover:border-[#16a34a]'
                        : 'hover:border-[var(--color-accent)]/50 border-[var(--surface-border)] bg-white',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--fg-default)]">
                        {s.ordinal}. {s.name}
                      </span>
                      <span
                        className={[
                          'rounded-[var(--radius-pill)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                          t.bg,
                        ].join(' ')}
                      >
                        {t.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                      {s.completion.complete}/{s.completion.total} attributes ·{' '}
                      {done ? 'complete' : `${s.completion.pct}% filled`}
                    </p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          done ? 'bg-[#16a34a]' : 'bg-[var(--color-accent)]'
                        }`}
                        style={{ width: `${s.completion.pct}%` }}
                      />
                    </div>
                  </div>
                  <ChevronRight
                    className={[
                      'h-4 w-4 shrink-0 transition',
                      isActive ? 'text-[var(--color-accent)]' : 'text-[var(--fg-subtle)]',
                    ].join(' ')}
                  />
                </button>
              </li>
            )
          })}
        </ol>

        {view.completion.readyForDisclosure && (
          <div className="mt-7 flex items-start gap-3 rounded-[var(--radius-md)] border border-[#86EFAC] bg-[#F0FDF4] p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#16a34a]" />
            <div>
              <p className="text-[13px] font-semibold text-[#166534]">Every stage is green.</p>
              <p className="text-[11px] text-[#166534]/80">
                Continue to the disclosure step from the top right to choose what each viewer sees.
              </p>
            </div>
          </div>
        )}
      </section>

      <aside className="overflow-y-auto border-l border-[var(--surface-border)] bg-white">
        {!activeStage ? (
          <div className="grid h-full place-items-center p-8 text-center text-[12px] text-[var(--fg-subtle)]">
            Pick a stage on the left to enter its attributes.
          </div>
        ) : (
          <div className="p-5">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
              Stage · {activeStage.tier}
            </p>
            <h2 className="mt-1 text-[16px] font-semibold text-[var(--fg-default)]">
              {activeStage.name}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
              {activeStage.completion.complete}/{activeStage.completion.total} complete
            </p>

            <ul className="mt-4 space-y-1.5">
              {activeStage.attributes.map((a) => (
                <li key={a.manifestAttrId}>
                  <button
                    onClick={() => onPickAttribute(a)}
                    className="group flex w-full items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusDot status={a.status} />
                        <span className="text-[13px] font-medium text-[var(--fg-default)]">
                          {a.label}
                        </span>
                        {a.necessity === 'mandatory' && (
                          <span className="rounded-[var(--radius-pill)] bg-[#FEF3C7] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#92400E]">
                            Req
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--fg-subtle)]">
                        {a.attributePath}
                      </p>
                      {a.value !== null && a.value !== undefined && (
                        <p className="mt-1 truncate text-[11px] text-[var(--fg-muted)]">
                          {a.source !== 'manual' && (
                            <span className="mr-1 font-mono text-[9px] uppercase text-[var(--fg-subtle)]">
                              [{SOURCE_LABEL[a.source]}]
                            </span>
                          )}
                          {formatValue(a.value)}
                        </p>
                      )}
                      {a.assignment && a.assignment.status !== 'revoked' && (
                        <p className="mt-1 text-[10px] text-[var(--color-accent)]">
                          Assigned to {a.assignment.assigneeEmail} ({a.assignment.status})
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition group-hover:text-[var(--color-accent)]" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Stage-level bulk actions: pull library / IoT for the whole step at once */}
            <StageBulkActions stage={activeStage} draftId={view.draft.id} />
          </div>
        )}
      </aside>
    </div>
  )
}

function StatusDot({ status }: { status: 'empty' | 'pending' | 'complete' }) {
  if (status === 'complete') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
  if (status === 'pending')
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-accent)]" />
  return <Circle className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

// ── Draft-level AI auto-fill ──────────────────────────────────────────

// Demo-grade synthesizer for attributes the library preset does not cover.
// Anchored to HZL EcoZen / CGG Jumbo / Refined Lead 99.99 reference values so
// the resulting passport passes schema validation and reads believably in the
// public viewer.
function synthesizeAttrValue(attr: DraftAttribute): unknown {
  const path = attr.attributePath.toLowerCase()
  const label = attr.label.toLowerCase()

  // Identifiers
  if (path.endsWith('.castnumber'))
    return `C-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-AUTO`
  if (path.endsWith('.itemserial')) return 'HZL-AUTO-001'
  if (path.endsWith('.gtin')) return '08901234500017'
  if (path.endsWith('.digitallinkurl'))
    return 'https://passport.hzlindia.com/01/08901234500017/21/HZL-AUTO-001'
  if (path.endsWith('.lotnumber')) return 'LOT-AUTO-2026-001'
  if (path.endsWith('.hscode')) return '7901.11'
  if (path.endsWith('.tariccode')) return '7901110000'
  if (path.endsWith('.esprproductcategory')) return 'non_ferrous_metal_ingots'
  if (path.includes('upi')) return 'HZL-AUTO-2026-0001'
  if (path === 'identification.gradecode' || path.endsWith('.gradecode')) return 'SHG 99.995'
  if (path === 'identification.metal' || path.endsWith('.metal')) return 'zinc'
  if (path.includes('brand')) return 'EcoZen'
  if (path.endsWith('.product') || path.endsWith('.productname')) return 'EcoZen SHG 99.995 ingot'
  if (path.endsWith('.form')) return 'ingot'

  // Chemistry · typical SHG 99.995 zinc spec midpoints (IS 209:1992 Zn1)
  if (path.startsWith('chemistry.')) {
    if (path.endsWith('.zn') || path.endsWith('.zinc')) return 99.995
    if (path.endsWith('.pb') || path.endsWith('.lead')) return 0.003
    if (path.endsWith('.cd')) return 0.003
    if (path.endsWith('.fe')) return 0.002
    if (path.endsWith('.sn')) return 0.001
    if (path.endsWith('.cu')) return 0.001
    if (path.endsWith('.al')) return 0.001
    return 0.001
  }

  // Carbon / footprint · HZL EcoZen SHG 99.995 (kg CO₂e/kg Zn)
  if (path.includes('cfp') || path.includes('carbonfootprint') || path.includes('co2')) {
    if (path.includes('mining') || path.includes('concentrate')) return 0.21
    if (path.includes('roast') || path.includes('roasting')) return 0.18
    if (path.includes('leach') || path.includes('leaching')) return 0.12
    if (path.includes('electrowinning') || path.includes('electrolysis')) return 0.32
    if (path.includes('electricity')) return 0.28
    if (path.includes('casthouse') || path.includes('casting') || path.includes('melting'))
      return 0.12
    return 0.95
  }

  // Energy · HZL Chanderiya RLE specific energy ~3.6 MWh/t Zn = 3.6 kWh/kg
  if (path.includes('kwhperkg') || path.includes('specificenergy')) return 3.6
  if (path.includes('kwh')) return 3600

  // Electrowinning (zinc)
  if (path.includes('amperage') || path.endsWith('.amperageka')) return 25
  if (path.includes('currentefficiency')) return 92.0
  if (path.includes('temperature')) return 38

  // Physical dimensions · HZL standard ingot 25 kg, jumbo 950 kg, bundle 1000 kg
  if (path.endsWith('.weightkg') || path.includes('weight')) return 25
  if (path.endsWith('.lengthmm') || path.includes('length')) return 700
  if (path.endsWith('.widthmm') || path.includes('width')) return 100
  if (path.endsWith('.heightmm') || path.includes('height')) return 60
  if (path.endsWith('.diametermm') || path.includes('diameter')) return 0
  if (path.includes('tolerance')) return 0.5

  // Recycled / circularity · HZL primary metal · 0% recycled, mass_balance custody
  if (path.includes('recycled') || path.includes('postconsumer') || path.includes('preconsumer')) {
    return 0
  }
  if (path.includes('chainofcustody') || path.includes('custodymodel')) return 'mass_balance'

  // Certifications / certs / refs
  if (path.includes('izazinc') || path.includes('zincmark')) return 'IZA-Zinc-Mark-CLZS-2026'
  if (path.includes('icmm')) return 'ICMM-2025-08-13'
  if (path.includes('iso14067')) return 'DNV-2026-ASR-EcoZen-001'
  if (path.includes('iso17025')) return 'HZL-LAB-17025-2024'
  if (path.includes('iso50001')) return 'HZL-ISO50001-2025'
  if (path.includes('epd') || path.includes('environmentalproductdeclaration'))
    return 'EPD-IES-0006472:001'
  if (path.includes('certificate') || path.includes('certificateref')) return 'AUTO-CERT-2026-001'

  // Dates / timestamps
  if (path.endsWith('at') || path.includes('date') || path.includes('timestamp')) {
    return new Date().toISOString().slice(0, 10)
  }

  // Booleans
  if (
    label.startsWith('is ') ||
    label.startsWith('has ') ||
    label.includes('verified') ||
    label.includes('certified')
  ) {
    return true
  }

  // Site / origin · HZL Chanderiya is the EcoZen smelter; concentrate sourced
  // from Rampura Agucha and Sindesar Khurd captive mines.
  if (path.includes('site') || path.includes('plant')) return 'Chanderiya Lead-Zinc Smelter'
  if (path.includes('country') || path.includes('origin')) return 'IN'
  if (path.includes('supplier')) return 'Rampura Agucha Mine (HZL captive)'

  // Generic numerics by label
  if (label.includes('percent') || label.includes('%')) return 0
  if (label.includes('number') || label.includes('quantity') || label.includes('count')) return 1
  if (label.includes('frequency')) return 0.3

  // Default · short string placeholder. Schema validators that require a
  // specific format will reject this; logged as a soft fail at publish time.
  return `Auto-fill (${attr.label})`
}

// Demo helper: pulls the first matching library preset across every stage of
// the draft so a tenant operator can show end-to-end "create → publish" without
// hand-filling every attribute. Falls back to a picker when multiple presets
// match the product.

function AiAutoFillButton({
  draftId,
  stages,
  onRefresh,
  onError,
}: {
  draftId: number
  stages: DraftStage[]
  onRefresh: () => void
  onError: (msg: string | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [phase, setPhase] = useState<'library' | 'synth' | null>(null)
  const [picker, setPicker] = useState<LibraryPreset[] | null>(null)

  const run = async (presetId: string) => {
    setBusy(true)
    onError(null)
    setPhase('library')
    let latest: DraftView | null = null
    try {
      // Phase 1 · pull library preset across every stage.
      const stageTotal = stages.length
      setProgress({ current: 0, total: stageTotal })
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i]!
        setProgress({ current: i + 1, total: stageTotal })
        const r = await pullLibraryAction(draftId, stage.stepId, presetId)
        if (r && typeof r === 'object' && !('error' in r)) {
          latest = r
        }
      }

      // Phase 2 · fill every still-empty attribute with a synthesized value
      // so the operator can demo end-to-end "create → publish" without
      // hand-filling. The manifest validator runs on publish, so this needs
      // to produce values that the schema accepts.
      const view = latest ?? (await refreshDraftAction(draftId))
      if (view) {
        const remaining: DraftAttribute[] = []
        for (const stage of view.stages) {
          for (const attr of stage.attributes) {
            if (attr.status !== 'complete' && !attr.assignment) remaining.push(attr)
          }
        }
        setPhase('synth')
        setProgress({ current: 0, total: remaining.length })
        for (let i = 0; i < remaining.length; i++) {
          const attr = remaining[i]!
          setProgress({ current: i + 1, total: remaining.length })
          const value = synthesizeAttrValue(attr)
          await setValueAction(draftId, attr.manifestAttrId, value, 'manual')
        }
      }
    } finally {
      setBusy(false)
      setProgress(null)
      setPhase(null)
      setPicker(null)
      onRefresh()
    }
  }

  const handleClick = async () => {
    if (busy) return
    onError(null)
    setBusy(true)
    let presets: LibraryPreset[] = []
    try {
      presets = await listLibraryPresetsAction(draftId)
    } catch {
      onError('Could not load library presets.')
      setBusy(false)
      return
    }
    if (presets.length === 0) {
      onError('No library presets available for this product. Add a preset first.')
      setBusy(false)
      return
    }
    if (presets.length === 1) {
      await run(presets[0]!.id)
      return
    }
    setBusy(false)
    setPicker(presets)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={[
          'group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-[var(--radius-sm)] px-3.5 text-[12px] font-semibold text-white transition',
          'bg-gradient-to-r from-[var(--color-accent)] via-[#2a6cb8] to-[#0f4c81]',
          'shadow-[0_2px_8px_rgba(15,76,129,0.25)] hover:shadow-[0_4px_12px_rgba(15,76,129,0.35)]',
          'disabled:cursor-not-allowed disabled:opacity-70',
        ].join(' ')}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        />
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span>
          {busy && progress && phase === 'library'
            ? `Pulling library · ${progress.current}/${progress.total}`
            : busy && progress && phase === 'synth'
              ? `Filling attributes · ${progress.current}/${progress.total}`
              : busy
                ? 'Loading presets…'
                : 'AI auto-fill'}
        </span>
      </button>

      {picker && (
        <Modal title="Pick a preset for AI auto-fill" onClose={() => setPicker(null)}>
          <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
            Multiple library presets match this product. Pick one · its values will fill every stage
            in the draft.
          </p>
          <ul className="space-y-1.5">
            {picker.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => run(p.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--fg-default)]">{p.label}</p>
                    {p.summary && (
                      <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">{p.summary}</p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}

// ── Stage-level bulk pull ─────────────────────────────────────────────

function StageBulkActions({ stage, draftId }: { stage: DraftStage; draftId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState<'library' | 'iot' | null>(null)
  const [presets, setPresets] = useState<LibraryPreset[]>([])
  const [iots, setIots] = useState<IotConnection[]>([])
  const [busy, setBusy] = useState(false)

  const openLibrary = async () => {
    setBusy(true)
    setPresets(await listLibraryPresetsAction(draftId))
    setBusy(false)
    setOpen('library')
  }
  const openIot = async () => {
    setBusy(true)
    setIots(await listIotAction(draftId, stage.stepId))
    setBusy(false)
    setOpen('iot')
  }

  return (
    <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        Bulk pull for stage
      </p>
      <div className="flex gap-2">
        <button
          onClick={openLibrary}
          disabled={busy}
          className="flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]"
        >
          <Library className="h-3.5 w-3.5" />
          Pull library preset
        </button>
        <button
          onClick={openIot}
          disabled={busy}
          className="flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]"
        >
          <Plug className="h-3.5 w-3.5" />
          Pull from IoT
        </button>
      </div>

      {open === 'library' && (
        <Modal title="Pull library preset" onClose={() => setOpen(null)}>
          {presets.length === 0 ? (
            <p className="text-[12px] text-[var(--fg-subtle)]">
              No matching presets for this product.
            </p>
          ) : (
            <ul className="space-y-2">
              {presets.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={async () => {
                      const r = await pullLibraryAction(draftId, stage.stepId, p.id)
                      if (!('error' in r)) {
                        setOpen(null)
                        router.refresh()
                      }
                    }}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
                  >
                    <p className="text-[13px] font-medium text-[var(--fg-default)]">{p.label}</p>
                    {p.summary && (
                      <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">{p.summary}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {open === 'iot' && (
        <Modal title="Pull from IoT connection" onClose={() => setOpen(null)}>
          <IotPicker
            connections={iots}
            stepId={stage.stepId}
            onPick={async (cid) => {
              const r = await pullIotAction(draftId, stage.stepId, cid)
              if (!('error' in r)) {
                setOpen(null)
                router.refresh()
              }
            }}
            onCreated={(c) => setIots((prev) => [...prev, c])}
          />
        </Modal>
      )}
    </div>
  )
}

function IotPicker({
  connections,
  stepId,
  onPick,
  onCreated,
}: {
  connections: IotConnection[]
  stepId: number
  onPick: (id: number) => void
  onCreated: (c: IotConnection) => void
}) {
  const [showNew, setShowNew] = useState(connections.length === 0)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<IotConnection['kind']>('mes')
  const [endpoint, setEndpoint] = useState('')
  const [mapText, setMapText] = useState('{\n  "carbon.decomposition.electrolysis": 1531\n}')
  const [busy, setBusy] = useState(false)

  return (
    <div>
      {connections.length > 0 && (
        <ul className="space-y-2">
          {connections.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onPick(c.id)}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
              >
                <p className="text-[13px] font-medium text-[var(--fg-default)]">{c.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
                  {c.kind} · {c.endpoint ?? 'no endpoint'} · {Object.keys(c.attributeMap).length}{' '}
                  attrs mapped
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowNew((v) => !v)}
        className="mt-3 text-[12px] font-medium text-[var(--color-accent)] underline"
      >
        {showNew ? 'Cancel new connection' : '+ Register new IoT connection'}
      </button>

      {showNew && (
        <div className="mt-3 space-y-3 border-t border-[var(--surface-border)] pt-3">
          <Input label="Name" value={name} onChange={setName} placeholder="HZL Smelter SCADA" />
          <Select
            label="Kind"
            value={kind}
            onChange={(v) => setKind(v as IotConnection['kind'])}
            options={[
              { v: 'mes', l: 'MES' },
              { v: 'scada', l: 'SCADA' },
              { v: 'aws_iot', l: 'AWS IoT' },
              { v: 'mqtt', l: 'MQTT' },
              { v: 'http_pull', l: 'HTTP pull' },
            ]}
          />
          <Input
            label="Endpoint (optional)"
            value={endpoint}
            onChange={setEndpoint}
            placeholder="https://historian.hzlindia.local/api/casts"
          />
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              Attribute map (JSON: path → value)
            </label>
            <textarea
              value={mapText}
              onChange={(e) => setMapText(e.target.value)}
              rows={6}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white p-2 font-mono text-[11px]"
            />
          </div>
          <button
            disabled={busy || !name}
            onClick={async () => {
              setBusy(true)
              let attributeMap: Record<string, unknown> = {}
              try {
                attributeMap = JSON.parse(mapText)
              } catch {
                setBusy(false)
                return
              }
              const r = await upsertIotAction({
                name,
                kind,
                endpoint: endpoint || undefined,
                attributeMap,
                processStepId: stepId,
              })
              setBusy(false)
              if (!('error' in r)) {
                onCreated(r)
                setShowNew(false)
                setName('')
                setEndpoint('')
              }
            }}
            className="h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-medium text-white disabled:opacity-30"
          >
            {busy ? 'Saving…' : 'Register connection'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Per-attribute drawer ───────────────────────────────────────────────

function AttributeDrawer({
  draftId,
  stage,
  attribute,
  mode,
  onPickMode,
  onClose,
  onAfterChange,
  onError,
}: {
  draftId: number
  stage: DraftStage
  attribute: DraftAttribute
  mode: EntrySource | null
  onPickMode: (m: EntrySource) => void
  onClose: () => void
  onAfterChange: () => void
  onError: (msg: string) => void
}) {
  const insight = attributeInsight(attribute, stage)
  const onSaved = () => {
    onAfterChange()
    onClose()
  }

  const compareSources: {
    key: EntrySource | 'history' | 'benchmark' | 'peer'
    label: string
    tag: string
    icon?: typeof Plug
    value: string
    hint: string
  }[] = [
    {
      key: 'manual',
      label: 'Manual entry',
      tag: 'MANUAL',
      value: attribute.source === 'manual' ? formatValue(attribute.value) : '—',
      hint: attribute.enteredBy ? `Entered by ${attribute.enteredBy}` : 'No manual value yet',
    },
    {
      key: 'iot',
      label: 'IoT pull',
      tag: 'IOT',
      icon: Plug,
      value: attribute.source === 'iot' ? formatValue(attribute.value) : '—',
      hint: insight.iotChannel ?? 'Connect the HZL Plant Historian / SCADA source on the smelter stage.',
    },
    {
      key: 'library',
      label: 'Library preset',
      tag: 'LIBRARY',
      icon: Library,
      value: attribute.source === 'library' ? formatValue(attribute.value) : '—',
      hint: insight.libraryHint ?? 'Pull a typical value from the HZL-anchored simulator presets.',
    },
    {
      key: 'history',
      label: 'Last filed',
      tag: 'HISTORY',
      value: insight.lastFiled ?? '—',
      hint: insight.lastFiledRef ?? 'No prior published passport for this attribute.',
    },
    {
      key: 'benchmark',
      label: 'HZL fleet average',
      tag: 'BENCHMARK',
      value: insight.hzlAverage ?? '—',
      hint: insight.hzlAverageRef ?? 'Aggregated HZL fleet average.',
    },
    {
      key: 'peer',
      label: 'Industry baseline',
      tag: 'PEER',
      value: insight.industryBaseline ?? '—',
      hint: insight.industryBaselineRef ?? 'IZA / worldsteel peer baseline.',
    },
  ]

  const isFilled = attribute.value !== null && attribute.value !== undefined && !!attribute.source
  const tier = stageTierStyle(stage.tier)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Backdrop wash · guaranteed opacity, premium dim */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white via-white to-[#F7F8FA]"
        aria-hidden
      />

      {/* Header · slim, premium, breathable */}
      <div className="relative z-10 shrink-0 border-b border-[var(--surface-border)] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1320px] items-center gap-3 px-8 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-[var(--fg-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            All attributes
          </button>
          <span className="h-4 w-px bg-[var(--surface-border)]" aria-hidden />
          <span
            className={[
              'inline-flex h-5 items-center gap-1.5 rounded-[var(--radius-pill)] px-2 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ring-inset',
              tier.bg,
              tier.ring,
              'text-[var(--fg-default)]',
            ].join(' ')}
          >
            {stage.name}
          </span>
          <span className="hidden truncate font-mono text-[10px] text-[var(--fg-subtle)] md:inline">
            {attribute.attributePath}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {isFilled && (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-medium text-[#166534]">
                <CheckCircle2 className="h-3 w-3" />
                Filed
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-subtle)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two-pane premium layout: context left (scrolls), submission right (sticky) */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto grid h-full max-w-[1320px] grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,520px)]">
          {/* LEFT · context (scrollable) */}
          <section className="min-w-0 overflow-y-auto px-8 py-8 lg:border-r lg:border-[var(--surface-border)]">
            {/* Hero */}
            <div className="max-w-[680px]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                Attribute · {attribute.necessity === 'mandatory' ? 'Mandatory' : 'Recommended'}
              </p>
              <h1 className="mt-2 text-[32px] font-semibold leading-[1.15] tracking-[-0.015em] text-[var(--fg-default)]">
                {attribute.label}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-[var(--surface-hover)] px-2 font-mono text-[10px] text-[var(--fg-muted)]">
                  Unit · {insight.unit ?? 'free-form'}
                </span>
                <span className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-[var(--surface-hover)] px-2 font-mono text-[10px] text-[var(--fg-muted)]">
                  Scope · {stage.tier}
                </span>
                {attribute.regulatoryAnchor && (
                  <span className="inline-flex h-6 items-center rounded-[var(--radius-pill)] bg-[#FEF3C7] px-2 text-[10px] font-medium text-[#92400E]">
                    {attribute.regulatoryAnchor}
                  </span>
                )}
              </div>
            </div>

            {/* Definition + calc method, side-by-side, no nested cards */}
            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-[var(--color-accent)]" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    Definition
                  </p>
                </div>
                <p className="mt-2 text-[14px] leading-[1.65] text-[var(--fg-default)]">
                  {insight.definition}
                </p>
              </div>
              {insight.calcMethod && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                    Calculation method
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.65] text-[var(--fg-muted)]">
                    {insight.calcMethod}
                  </p>
                </div>
              )}
            </div>

            {/* Insight · clean lozenge, no overlap */}
            <div className="mt-7 flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-fog)] p-4">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-accent)] shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
                <Sparkles className="h-3 w-3" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  Insight
                </p>
                <p className="mt-1 text-[13px] leading-[1.65] text-[var(--fg-default)]">
                  {insight.aiInsight}
                </p>
              </div>
            </div>

            {/* Compare sources · premium two-column data list (not a 6-up strip) */}
            <div className="mt-9">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                    Compare sources
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                    Cross-reference before filing.
                  </p>
                </div>
                {insight.history.length > 0 && (
                  <Sparkline points={insight.history.map((h) => h.value)} />
                )}
              </div>
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2">
                {compareSources.map((s, i) => (
                  <div
                    key={s.key}
                    className={[
                      'flex items-baseline gap-4 border-b border-[var(--surface-border)] py-3',
                      i % 2 === 0 ? 'sm:pr-6' : 'sm:border-l sm:pl-6',
                    ].join(' ')}
                  >
                    <div className="w-24 shrink-0">
                      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                        {s.icon && <s.icon className="h-2.5 w-2.5" />}
                        {s.tag}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--fg-muted)]">
                        {s.label}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          'break-words font-mono text-[16px] font-semibold tabular-nums leading-tight',
                          s.value === '—' ? 'text-[var(--fg-subtle)]' : 'text-[var(--fg-default)]',
                        ].join(' ')}
                      >
                        {s.value}
                      </p>
                      <p className="mt-1 text-[11px] leading-[1.5] text-[var(--fg-subtle)]">
                        {s.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            {/* History · only when data exists */}
            {insight.history.length > 0 && (
              <div className="mt-9">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                  Year-by-year (illustrative)
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {insight.history.map((h) => (
                    <li
                      key={h.year}
                      className="flex flex-col rounded-[var(--radius-md)] bg-[var(--color-fog)] px-3 py-2.5"
                    >
                      <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                        {h.year}
                      </span>
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-[var(--fg-default)]">
                        {h.value.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[var(--fg-muted)]">{h.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* RIGHT · submission form (sticky, primary) */}
          <aside className="bg-[var(--color-fog)]/30 min-w-0 overflow-y-auto px-8 py-8">
            <div className="sticky top-0">
              {/* Currently filed indicator */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                      Currently filed
                    </p>
                    <p className="mt-1 font-mono text-[24px] font-semibold tabular-nums leading-none text-[var(--fg-default)]">
                      {isFilled ? formatValue(attribute.value) : '—'}
                    </p>
                    <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                      {isFilled
                        ? `via ${SOURCE_LABEL[attribute.source!]}${attribute.enteredBy ? ` · ${attribute.enteredBy}` : ''}`
                        : 'No value submitted yet.'}
                    </p>
                  </div>
                  {isFilled && (
                    <span className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-pill)] bg-[#DCFCE7] px-2 text-[10px] font-medium text-[#166534]">
                      <CheckCircle2 className="h-3 w-3" />
                      Filed
                    </span>
                  )}
                </div>
              </div>

              {/* Submission form */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    {isFilled ? 'Replace value' : 'Submit value'}
                  </p>
                  <p className="text-[11px] text-[var(--fg-subtle)]">Pick a source</p>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-white p-1">
                  {(['manual', 'iot', 'library', 'external'] as EntrySource[]).map((m) => {
                    const Icon = SOURCE_ICON[m]
                    const active = mode === m
                    return (
                      <button
                        key={m}
                        onClick={() => onPickMode(m)}
                        className={[
                          'inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] text-[12px] font-medium transition',
                          active
                            ? 'bg-[var(--color-accent)] text-white shadow-[0_1px_2px_rgba(15,76,129,0.2)]'
                            : 'text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {SOURCE_LABEL[m]}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white p-5">
                  {mode === null && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-fog)] text-[var(--fg-subtle)]">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <p className="mt-3 text-[13px] font-medium text-[var(--fg-default)]">
                        Pick a source to begin
                      </p>
                      <p className="mt-1 max-w-[280px] text-[11px] leading-[1.5] text-[var(--fg-muted)]">
                        Use the tabs above to enter the value manually, pull from IoT, apply a
                        library preset, or assign to a colleague.
                      </p>
                    </div>
                  )}
                  {mode === 'manual' && (
                    <ManualEntry
                      draftId={draftId}
                      attribute={attribute}
                      onSaved={onSaved}
                      onError={onError}
                    />
                  )}
                  {mode === 'library' && (
                    <LibraryEntry
                      draftId={draftId}
                      stepId={stage.stepId}
                      attribute={attribute}
                      onSaved={onSaved}
                      onError={onError}
                    />
                  )}
                  {mode === 'iot' && (
                    <IotEntry
                      draftId={draftId}
                      stepId={stage.stepId}
                      onSaved={onSaved}
                      onError={onError}
                    />
                  )}
                  {mode === 'external' && (
                    <ExternalEntry
                      draftId={draftId}
                      attribute={attribute}
                      onSaved={onSaved}
                      onError={onError}
                    />
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// Tiny inline sparkline for the reference panel.
function Sparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const w = 280
  const h = 56
  const dx = w / Math.max(1, points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * dx
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full">
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      {points.map((p, i) => {
        const x = i * dx
        const y = h - ((p - min) / range) * h
        return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--color-accent)" />
      })}
    </svg>
  )
}

// Hardcoded insights anchored to the HZL Product Brochure 2025 + Chem-X
// guidelines so we can ship without an LLM dependency. Replace with
// /api/v1/insights once real provenance + history queries are wired.
interface AttributeInsight {
  unit: string | null
  definition: string
  calcMethod: string | null
  iotChannel: string | null
  libraryHint: string | null
  lastFiled: string | null
  lastFiledRef: string | null
  hzlAverage: string | null
  hzlAverageRef: string | null
  industryBaseline: string | null
  industryBaselineRef: string | null
  history: { year: string; label: string; value: number }[]
  aiInsight: string
}

function attributeInsight(attribute: DraftAttribute, _stage: DraftStage): AttributeInsight {
  const path = attribute.attributePath
  const empty: AttributeInsight = {
    unit: null,
    definition:
      attribute.label +
      '. Captured at this stage and persisted in the canonical DPP body for downstream verification.',
    calcMethod: null,
    iotChannel: null,
    libraryHint: null,
    lastFiled: null,
    lastFiledRef: null,
    hzlAverage: null,
    hzlAverageRef: null,
    industryBaseline: null,
    industryBaselineRef: null,
    history: [],
    aiInsight:
      'No automated insight available for this attribute yet. Refer to the regulatory anchor for the canonical specification.',
  }

  if (
    path === 'carbon.decomposition.electrowinning' ||
    path === 'carbon.decomposition.electrolysis' ||
    path === 'carbon.decomposition.electricity'
  ) {
    return {
      ...empty,
      unit: 'kg CO₂e/kg Zn',
      definition:
        'Carbon footprint contribution from the zinc electrowinning + roast/leach stages. Reported per ISO 14067:2018 with a cradle-to-gate boundary; verified by an accredited third party and anchored to the EPD-IES-0006472:001 EcoZen declaration.',
      calcMethod:
        'RLE Scope 1 (roaster + acid plant) + Scope 2 (grid emission factor × kWh/kg Zn). HZL Chanderiya RLE: ~3.6 MWh/t Zn × site EF (with 70% RE share via the Serentica round-the-clock PDA).',
      iotChannel: 'hzl.chanderiya.electrowinning.cellhouse.specific_energy_kwh_per_kg → Historian',
      libraryHint: 'EcoZen preset: 0.32 (electrowinning) + 0.28 (electricity) kg CO₂e/kg.',
      lastFiled: '0.95',
      lastFiledRef: 'EPD-IES-0006472:001 · ISO 14067:2018 · International EPD System',
      hzlAverage: '1.85',
      hzlAverageRef: 'HZL fleet average 2024 (Chem-X PCF)',
      industryBaseline: '3.7',
      industryBaselineRef: 'IZA global average',
      history: [
        { year: '2021', label: 'Pre-RE PDA', value: 2.4 },
        { year: '2022', label: 'Partial RE share', value: 1.8 },
        { year: '2023', label: 'EcoZen EPD verified', value: 1.05 },
        { year: '2024', label: 'EcoZen post-RE ramp', value: 0.95 },
      ],
      aiInsight:
        'EcoZen benefits from the Serentica round-the-clock RE PDA (530 MW · ~70% RE share at the Chanderiya gate), which drives the RLE CFP to ~26% of the IZA global baseline. If the cast falls outside the RE delivery window, use the grid-mix value from the Library card instead.',
    }
  }

  if (path === 'smelting.amperageKa' || path === 'electrowinning.amperageKa') {
    return {
      ...empty,
      unit: 'kA',
      definition:
        'Operating amperage of the zinc electrowinning cellhouse. Cellhouse current density and amperage drive deposition rate and cathode quality at Chanderiya.',
      calcMethod: 'Live read from the cellhouse rectifier SCADA; daily mean over the cast window.',
      iotChannel: 'hzl.chanderiya.electrowinning.rectifier.amperage_kA → Historian',
      libraryHint: 'Set by cellhouse circuit configuration · see Library presets.',
      lastFiled: '25',
      lastFiledRef: 'Chanderiya CLZS Cellhouse 2024',
      hzlAverage: '24.5',
      hzlAverageRef: 'HZL Chanderiya cellhouse, FY24',
      industryBaseline: '20',
      industryBaselineRef: 'Industry P50 (IZA)',
      history: [
        { year: '2021', label: 'Cellhouse upgrade', value: 22 },
        { year: '2023', label: 'Post-rectifier rebuild', value: 24 },
        { year: '2024', label: 'Steady-state', value: 25 },
      ],
      aiInsight:
        'HZL Chanderiya runs the cellhouse at ~25 kA. If your value is significantly below the HZL fleet average, check whether a partial cellhouse trip or rectifier de-rating event was active during the cast window.',
    }
  }

  if (
    path === 'smelting.currentEfficiencyPct' ||
    path === 'electrowinning.currentEfficiencyPct'
  ) {
    return {
      ...empty,
      unit: '%',
      definition:
        'Cathode current efficiency · fraction of electrolysis current depositing zinc on the cathode vs lost to side reactions (mainly hydrogen evolution and impurity co-deposition).',
      calcMethod:
        '(Mass of Zn deposited / Theoretical mass at applied charge) × 100. Theoretical = I × t / 1.22 g per A·h for Zn²⁺.',
      iotChannel: 'hzl.chanderiya.electrowinning.cellhouse.current_efficiency_pct → Historian',
      libraryHint: 'EcoZen preset: 92.0%; benchmark: 90%.',
      lastFiled: '92.0',
      lastFiledRef: 'Chanderiya CLZS Cellhouse 2024',
      hzlAverage: '91.5',
      hzlAverageRef: 'HZL fleet 2024',
      industryBaseline: '90.0',
      industryBaselineRef: 'IZA global',
      history: [
        { year: '2021', label: 'Cellhouse upgrade', value: 90.5 },
        { year: '2023', label: 'Electrolyte purity', value: 91.5 },
        { year: '2024', label: 'Steady-state', value: 92.0 },
      ],
      aiInsight:
        'Values < 90% suggest electrolyte impurity (Co, Ni, Sb, Ge) ingress or rising acid concentration. Above 93% is rarely sustained without electrolyte purification cycles holding very tight.',
    }
  }

  if (
    path.startsWith('chemistry.') ||
    path === 'identification.gradeCode' ||
    path === 'identification.metal'
  ) {
    return {
      ...empty,
      unit: path.includes('Pct') ? '%' : null,
      definition: `${attribute.label}. Analytical chemistry value from the HZL NABL-accredited lab; governs downstream grade designation per IS 209:1992 (zinc) / IS 27:2023 (lead) / ASTM B6-18 / ASTM B852-13.`,
      calcMethod:
        'Inductively Coupled Plasma Optical Emission Spectroscopy (ICP-OES) on the cast tap sample, per ISO/IEC 17025-accredited lab method (HZL-LAB-17025-2024).',
      iotChannel: 'hzl.chanderiya.lab.icpoes.{element}_pct → Historian',
      libraryHint: 'HZL standard chemistry windows by grade family.',
      industryBaseline: 'Per IS 209 / ASTM B6 specification window',
      industryBaselineRef: 'IS 209:1992 (Zn1) / ASTM B6-18',
      history: [],
      aiInsight:
        'ICP-OES values must fall inside the IS 209:1992 / ASTM B6-18 designation window for the grade. Outside-window samples auto-flag for re-test before tap-out.',
    }
  }

  if (path === 'recycledContent.totalPercent') {
    return {
      ...empty,
      unit: '%',
      definition:
        'Verified recycled content by mass-balance under the chosen chain-of-custody model. HZL EcoZen, CGG Jumbo and Refined Lead 99.99 are all primary metal from captive mine concentrate · physical recycled content is 0%.',
      calcMethod: 'Chem-X mass-balance accounting · chain-of-custody set to mass_balance.',
      iotChannel: 'hzl.chanderiya.feed.concentrate_input_kg → Historian',
      libraryHint: 'EcoZen / CGG Jumbo / Refined Lead 99.99: 0% recycled (primary metal).',
      lastFiled: '0',
      lastFiledRef: 'Chem-X mass_balance custody model',
      industryBaseline: '0–10',
      industryBaselineRef: 'IZA global zinc primary metal 2023',
      history: [
        { year: '2022', label: 'Primary metal', value: 0 },
        { year: '2023', label: 'Primary metal', value: 0 },
        { year: '2024', label: 'Primary metal', value: 0 },
      ],
      aiInsight:
        'HZL primary zinc and lead products carry 0% recycled content. The chain-of-custody field is set to mass_balance per Chem-X. Where downstream customers require recycled-content claims, route them via HZL DRI-grade fines processing rather than this passport.',
    }
  }

  if (path === 'identification.castNumber') {
    return {
      ...empty,
      definition:
        'Unique identifier for the cast · typically site-prefixed and date-coded. Anchors all attribute values, audit log entries, and the public viewer URL.',
      calcMethod: 'Issued at tap-out from the HZL Plant Historian.',
      iotChannel: 'hzl.chanderiya.casthouse.cast.cast_number → Historian',
      lastFiled: 'C-20260511-CHA-A',
      industryBaseline: null,
      history: [],
      aiInsight:
        'Cast number must match the HZL Plant Historian production reporting record exactly. If you fire a passport with a cast number that does not exist in the Historian, the verifier will reject the linkage at audit time.',
    }
  }

  if (path === 'physical.weightKg') {
    return {
      ...empty,
      unit: 'kg',
      definition: 'Net weight of the product unit (single ingot / jumbo / bundle).',
      calcMethod: 'Casthouse load cell at tap-out, calibrated weekly per ISO/IEC 17025.',
      iotChannel: 'hzl.chanderiya.casthouse.scale.weight_kg → Historian',
      libraryHint: 'EcoZen ingot: 25 kg; CGG jumbo: 950 kg; bundle: 1000 kg.',
      industryBaseline: null,
      history: [],
      aiInsight:
        'Weight outside the form-factor range (e.g. SHG ingot < 24 kg or > 26 kg, jumbo < 925 kg or > 975 kg) usually indicates a mould-fill variance · check the cast tap parameters and mould temperature attribute.',
    }
  }

  return empty
}

function ManualEntry({
  draftId,
  attribute,
  onSaved,
  onError,
}: {
  draftId: number
  attribute: DraftAttribute
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const initial =
    attribute.value === null || attribute.value === undefined ? '' : formatValue(attribute.value)
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-3">
      <Input label="Value" value={text} onChange={setText} placeholder="Type the value" />
      <p className="text-[10px] text-[var(--fg-subtle)]">
        Numeric and boolean strings are coerced. Use JSON for objects (e.g. {`{"foo": 1}`}).
      </p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const r = await setValueAction(draftId, attribute.manifestAttrId, coerce(text), 'manual')
          setBusy(false)
          if ('error' in r) onError(r.error)
          else onSaved()
        }}
        className="h-9 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-medium text-white disabled:opacity-30"
      >
        {busy ? 'Saving…' : 'Save value'}
      </button>
    </div>
  )
}

function LibraryEntry({
  draftId,
  stepId,
  attribute,
  onSaved,
  onError,
}: {
  draftId: number
  stepId: number
  attribute: DraftAttribute
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [presets, setPresets] = useState<LibraryPreset[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    listLibraryPresetsAction(draftId)
      .then((res) => {
        if (!cancelled) setPresets(res)
      })
      .catch(() => {
        if (!cancelled) setPresets([])
      })
    return () => {
      cancelled = true
    }
  }, [draftId])

  if (presets === null) {
    return <p className="text-[12px] text-[var(--fg-subtle)]">Loading presets…</p>
  }

  if (presets.length === 0) {
    return (
      <p className="text-[12px] text-[var(--fg-subtle)]">No matching presets for this product.</p>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[12px] text-[var(--fg-muted)]">
        Pulling a preset will fill every matching attribute on stage <strong>{stepId}</strong> ·
        including <code className="font-mono text-[10px]">{attribute.attributePath}</code>.
      </p>
      <ul className="space-y-2">
        {presets.map((p) => (
          <li key={p.id}>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const r = await pullLibraryAction(draftId, stepId, p.id)
                setBusy(false)
                if ('error' in r) onError(r.error)
                else onSaved()
              }}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
            >
              <p className="text-[13px] font-medium text-[var(--fg-default)]">{p.label}</p>
              {p.summary && (
                <p className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">{p.summary}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function IotEntry({
  draftId,
  stepId,
  onSaved,
  onError,
}: {
  draftId: number
  stepId: number
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const [iots, setIots] = useState<IotConnection[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listIotAction(draftId, stepId)
      .then((res) => {
        if (!cancelled) setIots(res)
      })
      .catch(() => {
        if (!cancelled) setIots([])
      })
    return () => {
      cancelled = true
    }
  }, [draftId, stepId])

  if (iots === null) {
    return <p className="text-[12px] text-[var(--fg-subtle)]">Loading IoT connections…</p>
  }

  return (
    <IotPicker
      connections={iots}
      stepId={stepId}
      onCreated={(c) => setIots((prev) => [...(prev ?? []), c])}
      onPick={async (cid) => {
        const r = await pullIotAction(draftId, stepId, cid)
        if ('error' in r) onError(r.error)
        else onSaved()
      }}
    />
  )
}

function ExternalEntry({
  draftId,
  attribute,
  onSaved,
  onError,
}: {
  draftId: number
  attribute: DraftAttribute
  onSaved: () => void
  onError: (msg: string) => void
}) {
  const existing = attribute.assignment
  const [email, setEmail] = useState(existing?.assigneeEmail ?? '')
  const [name, setName] = useState(existing?.assigneeName ?? '')
  const [org, setOrg] = useState(existing?.assigneeOrg ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const link = (t: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/assignments/${t}`

  if (existing && existing.status !== 'revoked' && !token) {
    return (
      <div className="space-y-3">
        <p className="rounded-[var(--radius-sm)] bg-[var(--color-fog)] p-3 text-[12px] text-[var(--fg-muted)]">
          Currently assigned to <strong>{existing.assigneeEmail}</strong> (
          {existing.assigneeOrg ?? 'no org'}) · status <strong>{existing.status}</strong>.
        </p>
        {existing.note && (
          <p className="text-[12px] text-[var(--fg-muted)]">Note: {existing.note}</p>
        )}
        <button
          disabled={busy || existing.status === 'submitted'}
          onClick={async () => {
            setBusy(true)
            const r = await revokeAssignmentAction(draftId, existing.id)
            setBusy(false)
            if ('error' in r) onError(r.error)
            else onSaved()
          }}
          className="h-9 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
        >
          Revoke assignment
        </button>
      </div>
    )
  }

  if (token) {
    return (
      <div className="space-y-3">
        <div className="rounded-[var(--radius-sm)] border border-[#86EFAC] bg-[#F0FDF4] p-3">
          <p className="text-[12px] font-semibold text-[#166534]">Assignment created.</p>
          <p className="mt-1 break-all font-mono text-[10px] text-[#166534]/80">{link(token)}</p>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(link(token))}
          className="flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]"
        >
          <Copy className="h-3.5 w-3.5" /> Copy access link
        </button>
        <button
          onClick={onSaved}
          className="h-9 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-medium text-white"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Input
        label="Assignee email"
        value={email}
        onChange={setEmail}
        placeholder="ops@hzlindia.com"
      />
      <Input
        label="Name (optional)"
        value={name}
        onChange={setName}
        placeholder="Production Manager"
      />
      <Input
        label="Org (optional)"
        value={org}
        onChange={setOrg}
        placeholder="Rampura Agucha Mine"
      />
      <Input
        label="Note (optional)"
        value={note}
        onChange={setNote}
        placeholder="Need this for Q4 reporting."
      />
      <button
        disabled={busy || !email}
        onClick={async () => {
          setBusy(true)
          const r = await assignAction(draftId, {
            manifestAttrId: attribute.manifestAttrId,
            assigneeEmail: email,
            assigneeName: name || undefined,
            assigneeOrg: org || undefined,
            note: note || undefined,
          })
          setBusy(false)
          if ('error' in r) onError(r.error)
          else if ('accessToken' in r && r.accessToken) setToken(r.accessToken)
        }}
        className="h-9 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-medium text-white disabled:opacity-30"
      >
        {busy ? 'Creating…' : 'Create assignment'}
      </button>
    </div>
  )
}

// ── Disclosure step ────────────────────────────────────────────────────

function DisclosureView({
  disclosure,
  published,
  onToggle,
}: {
  disclosure: DisclosureView
  published: boolean
  onToggle: (row: DisclosureView['matrix'][number], audience: Audience, visible: boolean) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<number, { name: string; rows: DisclosureView['matrix'] }>()
    for (const r of disclosure.matrix) {
      if (!map.has(r.stepId)) map.set(r.stepId, { name: r.stepName, rows: [] })
      map.get(r.stepId)!.rows.push(r)
    }
    return Array.from(map.entries()).map(([id, v]) => ({ stepId: id, ...v }))
  }, [disclosure])

  return (
    <div className="flex-1 overflow-y-auto p-7">
      <div className="mb-5 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-white p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--color-accent)]" />
        <div>
          <p className="text-[14px] font-semibold text-[var(--fg-default)]">
            Disclosure review {published && '— published'}
          </p>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--fg-muted)]">
            Choose which attributes each viewer sees on the published passport. Authority and
            verifier access defaults to everything; public + customer surfaces hide operational
            telemetry by default.{' '}
            {published
              ? 'This passport has been published · visibility is now read-only.'
              : 'Toggle anything before publishing.'}
          </p>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-white">
        <table className="w-full text-[12px]">
          <thead className="border-b border-[var(--surface-border)] bg-[var(--color-fog)] text-[10px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
            <tr>
              <th className="p-3 text-left font-mono">Attribute</th>
              <th className="p-3 text-left font-mono">Value</th>
              {AUDIENCES.map((a) => (
                <th key={a} className="p-3 text-center font-mono capitalize">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={`g-${g.stepId}`}>
                <tr className="bg-[var(--color-fog)]/40">
                  <td
                    colSpan={2 + AUDIENCES.length}
                    className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]"
                  >
                    {g.name}
                  </td>
                </tr>
                {g.rows.map((r) => (
                  <tr
                    key={`${g.stepId}-${r.attributePath}`}
                    className="border-t border-[var(--surface-border)]"
                  >
                    <td className="p-3 align-top">
                      <p className="font-medium text-[var(--fg-default)]">{r.label}</p>
                      <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--fg-subtle)]">
                        {r.attributePath}
                      </p>
                    </td>
                    <td className="max-w-[200px] truncate p-3 align-top text-[var(--fg-muted)]">
                      {formatValue(r.value)}
                    </td>
                    {AUDIENCES.map((a) => (
                      <td key={a} className="p-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={r.visibility[a]}
                          disabled={published}
                          onChange={(e) => onToggle(r, a, e.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tiny primitives ────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[420px] overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--fg-default)]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[var(--fg-subtle)] hover:text-[var(--fg-default)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[13px]"
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; l: string }[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[13px]"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  )
}

function coerce(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // fallthrough
    }
  }
  return trimmed
}
