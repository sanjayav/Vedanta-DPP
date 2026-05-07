'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleDashed,
  CircleDot,
  CircleHelp,
  Database,
  FileCheck,
  FlaskConical,
  Layers,
  Library,
  Loader2,
  Lock,
  Package,
  Plug,
  Sparkles,
  Truck,
  UserPlus,
  Workflow,
} from 'lucide-react'

import type {
  DataSource,
  ManifestStep,
  ProcessStep,
  ProductChainStep,
  ProductDetail,
  ProductManifest,
  ProductSummary,
} from '@/lib/product-api'

import { createDraftAction } from '../actions'

export interface ProductBundle {
  product: ProductSummary
  detail: ProductDetail | null
  manifest: ProductManifest | null
  fullManifest?: ProductManifest | null
  availableVersions: string[]
}

interface Props {
  bundles: ProductBundle[]
  canonicalChain: ProcessStep[]
}

const ALL_DPP_VERSIONS: {
  id: string
  label: string
  tagline: string
  status: 'available' | 'planned'
}[] = [
  {
    id: '1.0',
    label: 'DPP 1.0',
    tagline: 'Trust-building manifest · 106 attributes',
    status: 'available',
  },
  { id: '1.5', label: 'DPP 1.5', tagline: 'MES telemetry + supplier sourcing', status: 'planned' },
  {
    id: '2',
    label: 'DPP 2.0',
    tagline: 'CBAM Registry + EU Battery Regulation hooks',
    status: 'planned',
  },
  {
    id: '3',
    label: 'DPP 3.0',
    tagline: 'Recycled-content mass-balance + end-of-life routing',
    status: 'planned',
  },
  {
    id: '4',
    label: 'DPP 4.0',
    tagline: 'Full PEF (16 categories) + biodiversity + tailings',
    status: 'planned',
  },
]

type StepId = 'product' | 'process' | 'version' | 'parameters' | 'cast'

const STEPS: { id: StepId; label: string; subtitle: string; icon: typeof Sparkles }[] = [
  { id: 'product', label: 'Product', subtitle: 'Pick the HZL product', icon: Sparkles },
  { id: 'process', label: 'Process', subtitle: 'Confirm the production chain', icon: Workflow },
  { id: 'version', label: 'DPP version', subtitle: 'Choose schema version', icon: Layers },
  {
    id: 'parameters',
    label: 'Parameters',
    subtitle: 'Review locked attribute roster',
    icon: FileCheck,
  },
  { id: 'cast', label: 'Cast', subtitle: 'Identify this passport', icon: Package },
]

export function NewPassportWizard({ bundles, canonicalChain }: Props) {
  const router = useRouter()
  const [stepId, setStepId] = useState<StepId>('product')
  const [productId, setProductId] = useState<number | null>(null)
  const [version, setVersion] = useState<string>('1.0')
  const [castNumber, setCastNumber] = useState<string>('')
  const [itemSerial, setItemSerial] = useState<string>('')
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const bundle = useMemo(
    () => bundles.find((b) => b.product.id === productId) ?? null,
    [bundles, productId],
  )

  const stepIndex = STEPS.findIndex((s) => s.id === stepId)

  const canAdvance = useMemo(() => {
    if (stepId === 'product') return productId !== null
    if (stepId === 'process') return bundle !== null
    if (stepId === 'version') return version !== ''
    if (stepId === 'parameters') return bundle?.manifest !== null
    if (stepId === 'cast') return castNumber.trim().length > 0
    return false
  }, [stepId, productId, bundle, version, castNumber])

  function go(direction: 'next' | 'prev') {
    const idx = stepIndex + (direction === 'next' ? 1 : -1)
    if (idx < 0 || idx >= STEPS.length) return
    setStepId(STEPS[idx]!.id)
  }

  function submit() {
    if (!productId || !castNumber.trim()) return
    setSubmitErr(null)
    startTransition(async () => {
      const res = await createDraftAction({
        productId,
        dppVersion: version,
        castNumber: castNumber.trim(),
        itemSerial: itemSerial.trim() || undefined,
      })
      if (!res.ok) {
        setSubmitErr(res.error)
        return
      }
      router.push(`/console/create-passport/${res.draftId}`)
    })
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-7 pb-16">
      <Header stepIndex={stepIndex} />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[260px_1fr]">
        <Sidebar
          stepId={stepId}
          setStepId={setStepId}
          furthestReached={furthestStep(stepIndex, productId, bundle)}
        />

        <div className="min-w-0">
          <div className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {stepId === 'product' && (
              <ProductStep
                bundles={bundles}
                productId={productId}
                onPick={(id) => {
                  setProductId(id)
                  // Default to first locked version of that product if any
                  const b = bundles.find((x) => x.product.id === id)
                  if (b && b.availableVersions.length > 0) setVersion(b.availableVersions[0]!)
                }}
              />
            )}
            {stepId === 'process' && bundle && (
              <ProcessStepView bundle={bundle} canonicalChain={canonicalChain} />
            )}
            {stepId === 'version' && bundle && (
              <VersionStep bundle={bundle} version={version} setVersion={setVersion} />
            )}
            {stepId === 'parameters' && bundle && (
              <ParametersStep bundle={bundle} version={version} />
            )}
            {stepId === 'cast' && bundle && (
              <CastStep
                bundle={bundle}
                version={version}
                castNumber={castNumber}
                setCastNumber={setCastNumber}
                itemSerial={itemSerial}
                setItemSerial={setItemSerial}
              />
            )}
          </div>

          {submitErr && (
            <div className="mt-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12px] text-[#991B1B]">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{submitErr}</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go('prev')}
              disabled={stepIndex === 0 || pending}
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-4 text-[13px] font-medium text-[var(--fg-default)] transition hover:bg-[var(--color-fog)] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>

            {stepIndex < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => go('next')}
                disabled={!canAdvance || pending}
                className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canAdvance || pending}
                className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Create draft
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ stepIndex }: { stepIndex: number }) {
  const pct = ((stepIndex + 1) / STEPS.length) * 100
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]">
        New passport · step {stepIndex + 1} of {STEPS.length}
      </p>
      <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
        {STEPS[stepIndex]?.label}{' '}
        <span className="text-[var(--fg-muted)]">— {STEPS[stepIndex]?.subtitle}</span>
      </h1>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Sidebar stepper ─────────────────────────────────────────────────────────

function Sidebar({
  stepId,
  setStepId,
  furthestReached,
}: {
  stepId: StepId
  setStepId: (s: StepId) => void
  furthestReached: number
}) {
  return (
    <nav aria-label="Wizard steps" className="hidden lg:block">
      <ol className="space-y-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isCurrent = stepId === s.id
          const isPast = i < furthestReached
          const reachable = i <= furthestReached
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStepId(s.id)}
                className={[
                  'group flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition',
                  isCurrent
                    ? 'border-[var(--color-accent)] bg-[var(--color-fog)]'
                    : reachable
                      ? 'border-transparent hover:bg-[var(--color-fog)]'
                      : 'cursor-not-allowed border-transparent opacity-40',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    isPast
                      ? 'bg-[#16a34a] text-white'
                      : isCurrent
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--surface-hover)] text-[var(--fg-subtle)]',
                  ].join(' ')}
                >
                  {isPast ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-[var(--fg-default)]">
                    {s.label}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                    {s.subtitle}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function furthestStep(
  currentIdx: number,
  productId: number | null,
  bundle: ProductBundle | null,
): number {
  // The user can navigate back-and-forth through visited steps but not skip ahead
  // beyond the gates. The simplest definition: furthestReached = currentIdx if
  // upstream gates pass, else the gate index.
  if (productId === null) return 0 // can only see step 0
  if (!bundle) return 1
  return Math.max(currentIdx, 1)
}

// ── Step 1: Product ─────────────────────────────────────────────────────────

function ProductStep({
  bundles,
  productId,
  onPick,
}: {
  bundles: ProductBundle[]
  productId: number | null
  onPick: (id: number) => void
}) {
  return (
    <section>
      <h2 className="text-[18px] font-semibold text-[var(--fg-default)]">
        Which Hindustan Zinc product is this passport for?
      </h2>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        Each product has its own production chain, grade specification, and locked Chem-X attribute
        roster across the six EF&nbsp;3.1 sustainability categories.
      </p>

      <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {bundles.map((b) => {
          const p = b.product
          const isSelected = productId === p.id
          const details = (p.details ?? {}) as Record<string, unknown>
          const industry =
            typeof details.primaryIndustry === 'string' ? details.primaryIndustry : null
          const site = typeof details.site === 'string' ? details.site : null

          const imageSrc =
            p.slug === 'zinc-ecozen' || p.slug === 'ecozen'
              ? '/products/ecozen.jpg'
              : p.slug === 'zinc-cgg' || p.slug === 'cgg-jumbo'
                ? '/products/zinc-cgg.jpg'
                : p.slug === 'lead' || p.slug === 'lead-pure-99-99'
                  ? '/products/lead.jpg'
                  : null

          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p.id)}
                className={[
                  'flex h-full w-full flex-col items-stretch overflow-hidden rounded-[var(--radius-md)] border-2 bg-white text-left transition',
                  isSelected
                    ? 'border-[var(--color-accent)] shadow-[0_0_0_4px_var(--color-fog)]'
                    : 'hover:border-[var(--color-accent)]/50 border-[var(--surface-border)]',
                ].join(' ')}
              >
                {imageSrc && (
                  <div className="relative h-32 w-full overflow-hidden bg-[var(--surface-hover)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageSrc} alt={p.name} className="h-full w-full object-cover" />
                    <span className="absolute left-3 top-3 inline-flex h-6 items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/90 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg-default)] backdrop-blur">
                      {p.brand}
                    </span>
                  </div>
                )}
                <div className="flex h-full flex-col items-start p-5">
                  {!imageSrc && (
                    <span
                      className={[
                        'mb-3 inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 text-[10px] font-semibold uppercase tracking-wider',
                        p.brand === 'EcoZen'
                          ? 'bg-[#DCFCE7] text-[#166534]'
                          : p.brand === 'CGG' || p.brand === 'CGG Jumbo'
                            ? 'bg-[#FEF3C7] text-[#92400E]'
                            : p.brand === 'Vedanta 99.99'
                              ? 'bg-[#E0E7FF] text-[#3730A3]'
                              : 'bg-[var(--surface-hover)] text-[var(--fg-default)]',
                      ].join(' ')}
                    >
                      {p.brand}
                    </span>
                  )}
                  <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">{p.name}</h3>
                  <p className="mt-1 font-mono text-[10px] text-[var(--fg-subtle)]">
                    {p.alloyFamily}
                  </p>
                  {p.description && (
                    <p className="mt-3 line-clamp-3 text-[12px] leading-5 text-[var(--fg-muted)]">
                      {p.description}
                    </p>
                  )}
                  <dl className="mt-auto grid w-full grid-cols-2 gap-x-2 gap-y-1 pt-4 text-[11px]">
                    {site && (
                      <>
                        <dt className="text-[var(--fg-subtle)]">Site</dt>
                        <dd className="text-right font-medium text-[var(--fg-default)]">{site}</dd>
                      </>
                    )}
                    <dt className="text-[var(--fg-subtle)]">Form</dt>
                    <dd className="text-right font-medium text-[var(--fg-default)]">
                      {p.form.replace(/_/g, ' ')}
                    </dd>
                    {industry && (
                      <>
                        <dt className="text-[var(--fg-subtle)]">Industry</dt>
                        <dd className="text-right font-medium text-[var(--fg-default)]">
                          {industry}
                        </dd>
                      </>
                    )}
                    <dt className="text-[var(--fg-subtle)]">Chain</dt>
                    <dd className="text-right font-medium text-[var(--fg-default)]">
                      {b.detail?.chain.length ?? p.chainStepIds.length} stages
                    </dd>
                    <dt className="text-[var(--fg-subtle)]">Versions</dt>
                    <dd className="flex justify-end gap-1">
                      {b.availableVersions.length === 0 ? (
                        <span className="text-[var(--fg-subtle)]">—</span>
                      ) : (
                        b.availableVersions.map((v) => (
                          <span
                            key={v}
                            className="rounded-[var(--radius-pill)] bg-[var(--color-fog)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--fg-default)]"
                          >
                            v{v}
                          </span>
                        ))
                      )}
                    </dd>
                  </dl>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Step 2: Process ─────────────────────────────────────────────────────────

const TIER_PALETTE: Record<string, { bg: string; ring: string; label: string }> = {
  upstream: { bg: 'bg-[#F5E9D9]', ring: 'ring-[#D4A574]', label: 'Upstream' },
  production: { bg: 'bg-[#DBEAFE]', ring: 'ring-[#3B82F6]', label: 'Production' },
  downstream: { bg: 'bg-[#DCFCE7]', ring: 'ring-[#16a34a]', label: 'Downstream' },
  verification: { bg: 'bg-[#EDE9FE]', ring: 'ring-[#7C3AED]', label: 'Verification' },
}

function tierStyle(tier: string) {
  return (
    TIER_PALETTE[tier] ?? {
      bg: 'bg-[var(--surface-hover)]',
      ring: 'ring-[var(--surface-border)]',
      label: tier,
    }
  )
}

function stepIcon(slug: string) {
  if (slug === 'mining') return Database
  if (slug === 'refining') return FlaskConical
  if (slug === 'anode_production') return FlaskConical
  if (slug === 'power_generation') return Plug
  if (slug === 'smelting') return Sparkles
  if (slug === 'alloying') return FlaskConical
  if (slug === 'casting') return Workflow
  if (slug === 'homogenisation') return Workflow
  if (slug === 'lab_qc') return FileCheck
  if (slug === 'semis') return Workflow
  if (slug === 'packaging') return Package
  if (slug === 'verification') return Lock
  if (slug === 'customer') return Truck
  return Circle
}

function ProcessStepView({
  bundle,
  canonicalChain,
}: {
  bundle: ProductBundle
  canonicalChain: ProcessStep[]
}) {
  const fallbackChain: ProductChainStep[] = bundle.product.chainStepIds.flatMap(
    (id, i): ProductChainStep[] => {
      const step = canonicalChain.find((s) => s.id === id)
      if (!step) return []
      return [
        {
          stepId: id,
          slug: step.slug,
          name: step.name,
          tier: step.tier,
          ordinal: i + 1,
          description: step.description,
          notes: null as string | null,
        },
      ]
    },
  )
  const chain: ProductChainStep[] = bundle.detail?.chain ?? fallbackChain

  const slug = bundle.product.slug
  const heroSrc =
    slug === 'zinc-ecozen' || slug === 'ecozen'
      ? '/products/ecozen.jpg'
      : slug === 'zinc-cgg' || slug === 'cgg-jumbo'
        ? '/products/zinc-cgg.jpg'
        : slug === 'lead' || slug === 'lead-pure-99-99'
          ? '/products/lead.jpg'
          : null

  // Default-focus the first production-tier stage so the canvas opens with a
  // visually anchored focal point rather than the head of the chain (mining).
  const defaultFocus =
    chain.find((c) => c.tier === 'production')?.stepId ?? chain[0]?.stepId ?? null
  const [focusedId, setFocusedId] = useState<number | null>(defaultFocus)
  const focused = chain.find((c) => c.stepId === focusedId) ?? chain[0]

  // Per-step monitoring + attribute roll-up. Attributes come from the locked
  // manifest (when one exists); data sources come from the product detail.
  const dataSourcesByStep = new Map<number, DataSource[]>()
  for (const ds of bundle.detail?.dataSources ?? []) {
    const arr = dataSourcesByStep.get(ds.stepId) ?? []
    arr.push(ds)
    dataSourcesByStep.set(ds.stepId, arr)
  }
  const attrCountByStep = new Map<number, number>()
  for (const s of bundle.fullManifest?.stepsWithAttrs ?? bundle.manifest?.stepsWithAttrs ?? []) {
    attrCountByStep.set(s.stepId, s.attributes.length)
  }

  return (
    <section>
      <style>{PROCESS_3D_CSS}</style>

      {heroSrc && (
        <div className="relative mb-5 h-40 overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-hover)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroSrc} alt={bundle.product.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5 text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/80">
              {bundle.product.brand} · {bundle.product.alloyFamily}
            </p>
            <p className="mt-1 text-[18px] font-semibold leading-tight">{bundle.product.name}</p>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[18px] font-semibold text-[var(--fg-default)]">
          {bundle.product.name} · production chain
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
          {chain.length} stages
        </p>
      </div>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        Every ingot has a lineage. Click any stage to focus its branch — mining and power
        converge into smelting, casting feeds packaging through QC, and verification sits as a
        side-branch validating the dispatch. Each node feeds attributes into the passport you
        author in step 5.
      </p>

      <ProcessGenealogyTree
        chain={chain}
        focusedId={focused?.stepId ?? null}
        onFocus={setFocusedId}
        attrCountByStep={attrCountByStep}
        dataSourcesByStep={dataSourcesByStep}
      />

      {/* Focused stage detail panel */}
      {focused && (
        <ProcessFocusedDetail
          step={focused}
          totalSteps={chain.length}
          sources={dataSourcesByStep.get(focused.stepId) ?? []}
          attrCount={attrCountByStep.get(focused.stepId) ?? 0}
        />
      )}
    </section>
  )
}

/**
 * Genealogy-tree topology for the canonical 11-stage HZL production
 * chain. Slugs map to (col, row, parentSlugs); columns are 0..2 in a
 * 3-column grid, rows grow downward. The tree shows branching inputs
 * (mining concentrate + power both feed smelting), the main trunk
 * through smelting → alloying → casting → packaging, and side
 * branches (lab QC validating casting, third-party verification
 * validating packaging).
 */
const TREE_TOPOLOGY: Record<
  string,
  { col: number; row: number; parentSlugs: string[] }
> = {
  mining:           { col: 0, row: 0, parentSlugs: [] },
  power_generation: { col: 2, row: 0, parentSlugs: [] },
  concentration:    { col: 0, row: 1, parentSlugs: ['mining'] },
  beneficiation:    { col: 0, row: 1, parentSlugs: ['mining'] },
  roasting:         { col: 0, row: 2, parentSlugs: ['concentration', 'beneficiation'] },
  refining:         { col: 0, row: 2, parentSlugs: ['concentration', 'beneficiation'] },
  smelting:         { col: 1, row: 3, parentSlugs: ['roasting', 'refining', 'power_generation'] },
  alloying:         { col: 1, row: 4, parentSlugs: ['smelting'] },
  casting:          { col: 1, row: 5, parentSlugs: ['alloying', 'smelting'] },
  homogenisation:   { col: 1, row: 5, parentSlugs: ['alloying', 'smelting'] },
  lab_qc:           { col: 2, row: 5, parentSlugs: ['casting', 'homogenisation'] },
  semis:            { col: 1, row: 6, parentSlugs: ['casting', 'homogenisation'] },
  packaging:        { col: 1, row: 6, parentSlugs: ['casting', 'homogenisation', 'lab_qc'] },
  verification:     { col: 2, row: 6, parentSlugs: ['packaging'] },
  customer:         { col: 1, row: 7, parentSlugs: ['packaging', 'verification'] },
}

interface PositionedNode {
  step: ProductChainStep
  col: number
  row: number
  cx: number
  cy: number
  parents: number[]
}

const TREE_COL_W = 240
const TREE_ROW_H = 152
const TREE_NODE_W = 196
const TREE_NODE_H = 122
const TREE_PAD_X = 24
const TREE_PAD_Y = 16

function buildTree(chain: ProductChainStep[]): {
  nodes: PositionedNode[]
  edges: { fromId: number; toId: number }[]
  width: number
  height: number
} {
  const slugById = new Map(chain.map((c) => [c.stepId, c.slug]))
  const idBySlug = new Map(chain.map((c) => [c.slug, c.stepId]))

  // Resolve each chain step to a tree position. If the slug isn't in the
  // topology, fall back to a flat row at the bottom (safety net).
  const positioned: PositionedNode[] = chain.map((step, i) => {
    const t = TREE_TOPOLOGY[step.slug]
    const fallbackRow = 8
    const fallbackCol = i % 3
    const col = t?.col ?? fallbackCol
    const row = t?.row ?? fallbackRow
    return {
      step,
      col,
      row,
      cx: TREE_PAD_X + col * TREE_COL_W + TREE_NODE_W / 2,
      cy: TREE_PAD_Y + row * TREE_ROW_H + TREE_NODE_H / 2,
      parents: (t?.parentSlugs ?? [])
        .map((s) => idBySlug.get(s))
        .filter((id): id is number => typeof id === 'number'),
    }
  })

  const edges: { fromId: number; toId: number }[] = []
  for (const node of positioned) {
    for (const parentId of node.parents) {
      if (slugById.has(parentId)) {
        edges.push({ fromId: parentId, toId: node.step.stepId })
      }
    }
  }

  const maxCol = Math.max(...positioned.map((p) => p.col))
  const maxRow = Math.max(...positioned.map((p) => p.row))
  const width = TREE_PAD_X * 2 + (maxCol + 1) * TREE_COL_W
  const height = TREE_PAD_Y * 2 + (maxRow + 1) * TREE_ROW_H
  return { nodes: positioned, edges, width, height }
}

function tierAccent(tier: string): string {
  return tier === 'upstream'
    ? '#D4A574'
    : tier === 'production'
      ? '#3B82F6'
      : tier === 'downstream'
        ? '#16a34a'
        : tier === 'verification'
          ? '#7C3AED'
          : '#94a3b8'
}

/**
 * Genealogy-style tree visualisation. Mining + power converge into
 * smelting; the production trunk runs vertically; QC and third-party
 * verification branch off as validation gates. Each node is a card,
 * connected by curved bezier paths with an animated dashed flow.
 */
function ProcessGenealogyTree({
  chain,
  focusedId,
  onFocus,
  attrCountByStep,
  dataSourcesByStep,
}: {
  chain: ProductChainStep[]
  focusedId: number | null
  onFocus: (id: number) => void
  attrCountByStep: Map<number, number>
  dataSourcesByStep: Map<number, DataSource[]>
}) {
  const tree = useMemo(() => buildTree(chain), [chain])
  const nodeById = useMemo(
    () => new Map(tree.nodes.map((n) => [n.step.stepId, n])),
    [tree.nodes],
  )

  // Highlight the genealogy of the focused stage: every ancestor edge AND
  // every descendant edge that branches from the focused node.
  const highlightedEdges = useMemo(() => {
    if (focusedId == null) return new Set<string>()
    const hi = new Set<string>()
    const visitParents = (id: number) => {
      const node = nodeById.get(id)
      if (!node) return
      for (const p of node.parents) {
        const key = `${p}-${id}`
        if (hi.has(key)) continue
        hi.add(key)
        visitParents(p)
      }
    }
    const visitChildren = (id: number) => {
      tree.edges
        .filter((e) => e.fromId === id)
        .forEach((e) => {
          const key = `${e.fromId}-${e.toId}`
          if (hi.has(key)) return
          hi.add(key)
          visitChildren(e.toId)
        })
    }
    visitParents(focusedId)
    visitChildren(focusedId)
    return hi
  }, [focusedId, nodeById, tree.edges])

  // Smooth vertical bezier between two centers · we route the curve so it
  // hugs the source's bottom edge and the target's top edge.
  const edgePath = (fromId: number, toId: number): string => {
    const a = nodeById.get(fromId)
    const b = nodeById.get(toId)
    if (!a || !b) return ''
    const sx = a.cx
    const sy = a.cy + TREE_NODE_H / 2
    const ex = b.cx
    const ey = b.cy - TREE_NODE_H / 2
    // Control points: vertical first, then ease into the target column.
    const dy = Math.max(40, (ey - sy) / 2)
    return `M ${sx} ${sy} C ${sx} ${sy + dy}, ${ex} ${ey - dy}, ${ex} ${ey}`
  }

  return (
    <div className="tree-wrap" role="region" aria-label="Production genealogy tree">
      <div
        className="tree-canvas"
        style={{
          width: tree.width,
          height: tree.height,
        }}
      >
        {/* Vertical tier lanes painted as background gradients */}
        <div className="tree-lanes" aria-hidden>
          <span className="tree-lane tier-upstream" style={{ top: 0, height: TREE_ROW_H * 3 }}>
            <em>Upstream</em>
          </span>
          <span
            className="tree-lane tier-production"
            style={{ top: TREE_ROW_H * 3, height: TREE_ROW_H * 2.5 }}
          >
            <em>Production</em>
          </span>
          <span
            className="tree-lane tier-downstream"
            style={{ top: TREE_ROW_H * 5.5, height: TREE_ROW_H * 1.5 }}
          >
            <em>Downstream</em>
          </span>
          <span
            className="tree-lane tier-verification"
            style={{ top: TREE_ROW_H * 7, height: TREE_ROW_H }}
          >
            <em>Customer</em>
          </span>
        </div>

        {/* SVG layer · curved bezier connectors with animated dashes */}
        <svg
          className="tree-svg"
          width={tree.width}
          height={tree.height}
          viewBox={`0 0 ${tree.width} ${tree.height}`}
          aria-hidden
        >
          <defs>
            <linearGradient id="tree-edge-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="tree-edge-active" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#D4A574" />
              <stop offset="40%" stopColor="#3B82F6" />
              <stop offset="80%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          {tree.edges.map(({ fromId, toId }) => {
            const key = `${fromId}-${toId}`
            const isHi = highlightedEdges.has(key)
            return (
              <g key={key}>
                <path
                  d={edgePath(fromId, toId)}
                  className="tree-edge-bg"
                  fill="none"
                />
                <path
                  d={edgePath(fromId, toId)}
                  className={`tree-edge-flow ${isHi ? 'is-active' : ''}`}
                  fill="none"
                />
              </g>
            )
          })}
        </svg>

        {/* Node cards · positioned absolutely on the canvas */}
        {tree.nodes.map((n, i) => {
          const Icon = stepIcon(n.step.slug)
          const attrCount = attrCountByStep.get(n.step.stepId) ?? 0
          const sources = dataSourcesByStep.get(n.step.stepId) ?? []
          const isFocused = n.step.stepId === focusedId
          const accent = tierAccent(n.step.tier)
          return (
            <button
              key={n.step.stepId}
              type="button"
              onClick={() => onFocus(n.step.stepId)}
              aria-pressed={isFocused}
              aria-label={`Stage ${n.step.ordinal}: ${n.step.name}`}
              className={`tree-node tier-${n.step.tier} ${isFocused ? 'is-focused' : ''}`}
              style={{
                left: n.cx - TREE_NODE_W / 2,
                top: n.cy - TREE_NODE_H / 2,
                width: TREE_NODE_W,
                height: TREE_NODE_H,
                ['--accent' as string]: accent,
                ['--i' as string]: i,
              }}
            >
              <span className="tree-node-head">
                <span className="tree-node-num">{String(n.step.ordinal).padStart(2, '0')}</span>
                <span className="tree-node-tier">{tierStyle(n.step.tier).label}</span>
              </span>
              <span className="tree-node-icon-row">
                <span className="tree-node-icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="tree-node-name">{n.step.name}</span>
              </span>
              <span className="tree-node-meta">
                <span className="tree-node-attrs">
                  {attrCount > 0 ? `${attrCount} attr` : '— attr'}
                </span>
                <span className="tree-node-dots">
                  {sources.length === 0 ? (
                    <span className="tree-node-dot is-empty" title="No data source" />
                  ) : (
                    sources.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className={`tree-node-dot is-${monitorTone(s)}`}
                        title={`${connectorLabel(s)} · ${s.lastSyncStatus ?? 'never synced'}`}
                      />
                    ))
                  )}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Tier legend pill below the canvas */}
      <div className="tree-legend" aria-hidden>
        <span className="tree-legend-item tier-upstream"><i /> Upstream</span>
        <span className="tree-legend-item tier-production"><i /> Production</span>
        <span className="tree-legend-item tier-downstream"><i /> Downstream</span>
        <span className="tree-legend-item tier-verification"><i /> Verification</span>
      </div>
    </div>
  )
}

function ProcessFocusedDetail({
  step,
  totalSteps,
  sources,
  attrCount,
}: {
  step: ProductChainStep
  totalSteps: number
  sources: DataSource[]
  attrCount: number
}) {
  const t = tierStyle(step.tier)
  const Icon = stepIcon(step.slug)
  const granted = sources.filter((s) => s.permissionState === 'granted').length
  const healthy = sources.filter((s) => s.lastSyncStatus === 'success').length
  return (
    <article className="proc3d-detail">
      <div className="proc3d-detail-head">
        <span className={['proc3d-detail-icon', t.bg, t.ring].join(' ')}>
          <Icon className="h-5 w-5 text-[var(--fg-default)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Stage {step.ordinal} of {totalSteps} · {t.label}
          </p>
          <h3 className="mt-1 text-[20px] font-semibold leading-tight text-[var(--fg-default)]">
            {step.name}
          </h3>
        </div>
        <span
          className={[
            'rounded-[var(--radius-pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
            t.bg,
          ].join(' ')}
        >
          {t.label}
        </span>
      </div>
      {step.description && (
        <p className="mt-3 text-[13px] leading-6 text-[var(--fg-default)]">{step.description}</p>
      )}
      {step.notes && <p className="mt-2 text-[12px] italic text-[var(--fg-muted)]">{step.notes}</p>}

      {/* Dynamic attributes + monitoring summary */}
      <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--surface-border)] rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-canvas)]">
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
            Attributes
          </dt>
          <dd className="tabular mt-1 font-mono text-[18px] font-semibold text-[var(--fg-default)]">
            {attrCount}
          </dd>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
            locked at this DPP version
          </p>
        </div>
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
            Data sources
          </dt>
          <dd className="tabular mt-1 font-mono text-[18px] font-semibold text-[var(--fg-default)]">
            {sources.length}
          </dd>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
            {granted} granted · {sources.length - granted} pending / denied
          </p>
        </div>
        <div className="px-4 py-3">
          <dt className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
            Sync health
          </dt>
          <dd className="tabular mt-1 font-mono text-[18px] font-semibold text-[var(--fg-default)]">
            {sources.length === 0 ? '—' : `${healthy}/${sources.length}`}
          </dd>
          <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">last sync succeeded</p>
        </div>
      </dl>

      {/* Per-source monitoring rows */}
      {sources.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[12px]"
            >
              <span
                className={`proc-tile-dot is-${monitorTone(s)} h-2.5 w-2.5 shrink-0`}
                aria-hidden
              />
              <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-subtle)]">
                {connectorLabel(s)}
              </span>
              <span className="text-[var(--fg-default)]">
                {s.supplierName ?? (s.origin === 'internal' ? 'Internal capture' : 'Third-party')}
              </span>
              {s.supplierDid && (
                <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                  {s.supplierDid}
                </span>
              )}
              <span className="ml-auto flex items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                <span className="rounded-[var(--radius-pill)] bg-[var(--surface-recessed)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider">
                  {s.permissionState.replace(/_/g, ' ')}
                </span>
                <span title={s.lastSyncAt ?? 'never'}>
                  {s.lastSyncAt ? `synced ${relTime(s.lastSyncAt)}` : 'never synced'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--surface-border)] bg-[var(--color-fog)] px-3 py-2 text-[12px] text-[var(--fg-muted)]">
          No data source wired to this stage yet. Connect one in <em>Integrations → Data Sources</em>{' '}
          to start monitoring this step's attributes automatically.
        </p>
      )}
    </article>
  )
}

function monitorTone(s: DataSource): 'ok' | 'warn' | 'error' | 'idle' {
  if (s.permissionState !== 'granted') return 'warn'
  if (s.lastSyncStatus === 'success') return 'ok'
  if (s.lastSyncStatus === 'error') return 'error'
  return 'idle'
}

function connectorLabel(s: DataSource): string {
  return (s.connectorKind ?? 'manual').replace(/_/g, ' ')
}

function relTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const ms = Date.now() - t
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.round(min / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

const PROCESS_3D_CSS = `
/* Stage grid — uses --cols (set inline) for the column count.
 * 12 stages settle into 6×2; smaller chains take fewer columns. */
.proc-grid {
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr));
  gap: 10px;
  list-style: none;
  padding: 0;
}
@media (max-width: 880px) {
  .proc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .proc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.proc-tile {
  animation: proc-rise 420ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: calc(var(--i, 0) * 28ms);
}
@keyframes proc-rise {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; }
}

.proc-tile-btn {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-height: 142px;
  padding: 12px 12px 12px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: linear-gradient(160deg, #ffffff 0%, #f7f8fb 100%);
  box-shadow:
    0 4px 12px -8px rgba(15,23,42,0.12),
    0 1px 2px rgba(15,23,42,0.04);
  text-align: left;
  cursor: pointer;
  transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}
.proc-tile-btn:hover {
  transform: translateY(-2px);
  border-color: var(--surface-border-strong, var(--surface-border));
  box-shadow: 0 8px 18px -10px rgba(15,23,42,0.20);
}
.proc-tile.is-focused .proc-tile-btn {
  border-color: var(--color-accent);
  box-shadow:
    0 12px 28px -12px rgba(15,76,129,0.36),
    0 0 0 1px var(--color-accent) inset;
  transform: translateY(-2px);
}
.proc-tile.tier-upstream .proc-tile-btn {
  background: linear-gradient(160deg, #ffffff, #fff7e7);
}
.proc-tile.tier-production .proc-tile-btn {
  background: linear-gradient(160deg, #ffffff, var(--color-accent-soft));
}
.proc-tile.tier-downstream .proc-tile-btn {
  background: linear-gradient(160deg, #ffffff, #ecfdf5);
}
.proc-tile.tier-verification .proc-tile-btn {
  background: linear-gradient(160deg, #ffffff, #f3e8ff);
}

.proc-tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.proc-tile-icon {
  display: grid; place-items: center;
  width: 28px; height: 28px;
  border-radius: 9999px;
  border-width: 2px;
  border-style: solid;
  border-color: var(--ring-color, var(--surface-border));
  flex-shrink: 0;
}
.proc-tile-num {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--fg-subtle);
}
.proc-tile-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-default);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.proc-tile-tier {
  align-self: flex-start;
  margin-top: auto;
  padding: 2px 8px;
  border-radius: 9999px;
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

/* Tile monitoring strip — attribute count + per-source health dots. */
.proc-tile-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-subtle);
}
.proc-tile-attrs {
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.proc-tile-dots {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.proc-tile-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: var(--surface-border);
}
.proc-tile-dot.is-ok    { background: var(--color-green, #16a34a); }
.proc-tile-dot.is-warn  { background: var(--color-amber, #d97706); }
.proc-tile-dot.is-error { background: var(--color-red, #dc2626); }
.proc-tile-dot.is-idle  { background: var(--fg-subtle); }
.proc-tile-dot.is-empty {
  background: transparent;
  border: 1px dashed var(--fg-subtle);
}
.proc-tile-dot-overflow {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--fg-muted);
  margin-left: 2px;
}

/* Focused detail panel */
.proc3d-detail {
  margin-top: 18px;
  padding: 18px 20px 20px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  animation: proc3d-detail-fade 280ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes proc3d-detail-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.proc3d-detail-head { display: flex; align-items: flex-start; gap: 14px; }
.proc3d-detail-icon {
  display: grid; place-items: center;
  width: 44px; height: 44px;
  border-radius: 9999px;
  border-width: 2px;
  border-style: solid;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .proc-tile { animation: none; }
  .proc-tile-btn { transition: none; }
  .proc-tile-btn:hover, .proc-tile.is-focused .proc-tile-btn { transform: none; }
  .proc3d-detail { animation: none; }
}

/* ── Genealogy tree visualisation ──────────────────────────────────────
 * Two-dimensional tree where mining + power converge into smelting,
 * the production trunk runs vertically, and lab QC + third-party
 * verification branch off as side-validators. Curved bezier connectors
 * carry an animated dashed flow; the focused node lights up its full
 * ancestor + descendant lineage. */

.tree-wrap {
  margin-top: 24px;
  padding: 6px 0 4px;
}
.tree-canvas {
  position: relative;
  margin: 0 auto;
  border-radius: 18px;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(212,165,116,0.10) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 0%, rgba(59,130,246,0.10) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.10) 0%, transparent 60%),
    linear-gradient(180deg, #fbfcfe 0%, #f4f6fa 100%);
  border: 1px solid var(--surface-border);
  overflow: hidden;
}

/* Vertical tier lanes painted as soft horizontal bands */
.tree-lanes {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.tree-lane {
  position: absolute;
  left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 18px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  border-top: 1px dashed transparent;
}
.tree-lane em {
  font-style: normal;
  padding: 4px 12px;
  border-radius: 9999px;
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--surface-border);
}
.tree-lane.tier-upstream     { background: linear-gradient(90deg, rgba(245,233,217,0.55), rgba(245,233,217,0.10) 80%); color: #8B5A1A; }
.tree-lane.tier-production   { background: linear-gradient(90deg, rgba(219,234,254,0.55), rgba(219,234,254,0.10) 80%); color: #1E40AF; border-top-color: rgba(59,130,246,0.30); }
.tree-lane.tier-downstream   { background: linear-gradient(90deg, rgba(220,252,231,0.55), rgba(220,252,231,0.10) 80%); color: #14532D; border-top-color: rgba(22,163,74,0.30); }
.tree-lane.tier-verification { background: linear-gradient(90deg, rgba(237,233,254,0.55), rgba(237,233,254,0.10) 80%); color: #5B21B6; border-top-color: rgba(124,58,237,0.30); }

/* SVG layer for the curved bezier connectors */
.tree-svg {
  position: absolute;
  top: 0; left: 0;
  z-index: 1;
  pointer-events: none;
  overflow: visible;
}
.tree-edge-bg {
  stroke: rgba(148,163,184,0.45);
  stroke-width: 1.5;
  fill: none;
  stroke-linecap: round;
}
.tree-edge-flow {
  stroke: rgba(148,163,184,0.85);
  stroke-width: 1.5;
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 4 7;
  animation: tree-edge-march 5s linear infinite;
  transition: stroke 220ms ease, stroke-width 220ms ease, opacity 220ms ease;
  opacity: 0.7;
}
.tree-edge-flow.is-active {
  stroke: url(#tree-edge-active);
  stroke-width: 2.6;
  stroke-dasharray: 5 5;
  animation: tree-edge-march 1.6s linear infinite;
  opacity: 1;
  filter: drop-shadow(0 0 6px rgba(59,130,246,0.45));
}
@keyframes tree-edge-march {
  to { stroke-dashoffset: -120; }
}

/* Node cards */
.tree-node {
  position: absolute;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px 10px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: linear-gradient(180deg, #ffffff 0%, #f8f9fc 100%);
  text-align: left;
  cursor: pointer;
  --accent: #94a3b8;
  box-shadow:
    0 4px 12px -10px rgba(15,23,42,0.20),
    0 1px 2px rgba(15,23,42,0.04);
  transition: transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease,
    background 220ms ease;
  animation: tree-node-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  animation-delay: calc(var(--i, 0) * 36ms);
}
@keyframes tree-node-rise {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; }
}
.tree-node::before {
  /* Tier-coloured leading bar on the left edge */
  content: "";
  position: absolute;
  top: 14px; bottom: 14px; left: 0;
  width: 3px;
  background: var(--accent);
  border-radius: 0 4px 4px 0;
  opacity: 0.9;
}
.tree-node:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 12px 26px -14px rgba(15,23,42,0.28);
}
.tree-node.is-focused {
  transform: translateY(-3px) scale(1.02);
  border-color: var(--accent);
  background: linear-gradient(180deg, #ffffff 0%,
    color-mix(in srgb, var(--accent) 9%, #ffffff) 100%);
  box-shadow:
    0 18px 32px -16px color-mix(in srgb, var(--accent) 60%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent) 50%, transparent) inset;
}
.tree-node.is-focused::before { width: 4px; }
.tree-node.is-focused::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  pointer-events: none;
  animation: tree-node-pulse 2.2s ease-out infinite;
}
@keyframes tree-node-pulse {
  0%   { transform: scale(0.98); opacity: 0.85; }
  70%  { transform: scale(1.06); opacity: 0; }
  100% { transform: scale(1.06); opacity: 0; }
}

.tree-node-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.tree-node-num {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: var(--fg-subtle);
}
.tree-node-tier {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 9999px;
  color: color-mix(in srgb, var(--accent) 75%, #1e293b);
  background: color-mix(in srgb, var(--accent) 14%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
}

.tree-node-icon-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}
.tree-node-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 32px; height: 32px;
  border-radius: 9999px;
  background: #ffffff;
  border: 2px solid var(--accent);
  color: var(--fg-default);
  box-shadow: 0 2px 6px rgba(15,23,42,0.06);
  transition: background 220ms ease, color 220ms ease, transform 220ms ease;
}
.tree-node.is-focused .tree-node-icon {
  background: var(--accent);
  color: #ffffff;
  transform: scale(1.06);
}
.tree-node-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-default);
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tree-node-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--fg-subtle);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-top: 1px dashed var(--surface-border);
}
.tree-node-attrs { font-weight: 700; }
.tree-node-dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}
.tree-node-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 9999px;
  background: var(--fg-subtle);
}
.tree-node-dot.is-ok    { background: var(--color-green, #16a34a); }
.tree-node-dot.is-warn  { background: var(--color-amber, #d97706); }
.tree-node-dot.is-error { background: var(--color-red, #dc2626); }
.tree-node-dot.is-idle  { background: var(--fg-subtle); }
.tree-node-dot.is-empty { background: transparent; border: 1px dashed var(--fg-subtle); }

/* Legend pill below the canvas */
.tree-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  align-items: center;
  justify-content: center;
  margin: 14px auto 0;
  padding: 8px 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: #fff;
  width: fit-content;
}
.tree-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-muted);
}
.tree-legend-item i {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 9999px;
  border: 2px solid var(--fg-subtle);
  background: #fff;
}
.tree-legend-item.tier-upstream     i { border-color: #D4A574; }
.tree-legend-item.tier-production   i { border-color: #3B82F6; }
.tree-legend-item.tier-downstream   i { border-color: #16a34a; }
.tree-legend-item.tier-verification i { border-color: #7C3AED; }

/* Horizontal scroll on narrow viewports — keeps the tree intact. */
@media (max-width: 880px) {
  .tree-wrap {
    overflow-x: auto;
    padding-bottom: 12px;
    scrollbar-width: thin;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tree-node { animation: none; }
  .tree-node, .tree-node-icon { transition: none; }
  .tree-node:hover, .tree-node.is-focused, .tree-node.is-focused .tree-node-icon { transform: none; }
  .tree-edge-flow, .tree-edge-flow.is-active { animation: none; }
  .tree-node.is-focused::after { animation: none; }
}
`

// ── Step 3: Version ─────────────────────────────────────────────────────────

const VERSION_DELTAS: Record<string, { headline: string; bullets: string[] }> = {
  '1.0': {
    headline: 'Trust-building manifest',
    bullets: [
      'UPI · GS1 Digital Link',
      'Alloy chemistry (EN 573-3)',
      'CFP · ISO 14067 cradle-to-gate',
      'Recycled content (ASI CoC v2.1)',
      'Ed25519-signed W3C VC envelope',
    ],
  },
  '1.5': {
    headline: 'Cell telemetry + sourcing',
    bullets: [
      'Cell amperage & current efficiency',
      'AE frequency, anode quality',
      'Supplier sourcing detail',
      'ISO 17025 lab traceability',
    ],
  },
  '2': {
    headline: 'EU regulatory tier',
    bullets: [
      'CBAM Registry references',
      'Aluminium Delegated Act site CFP',
      'Guarantees of Origin (GoO)',
      'CBAM free-allocation logic',
    ],
  },
  '3': {
    headline: 'Circularity + end-of-life',
    bullets: [
      'GRS / RCS scrap mass-balance',
      'Spent pot-lining recycling',
      'End-of-life routing manifest',
      'Disassembly & repair guidance',
    ],
  },
  '4': {
    headline: 'Full PEF + biodiversity',
    bullets: [
      'Product Environmental Footprint (16 categories)',
      'Biodiversity impact score',
      'Water-stress weighted footprint',
      'Land-use change accounting',
    ],
  },
}

function VersionStep({
  bundle,
  version,
  setVersion,
}: {
  bundle: ProductBundle
  version: string
  setVersion: (v: string) => void
}) {
  const available = new Set(bundle.availableVersions)
  const [hovered, setHovered] = useState<string | null>(null)
  const fullSteps = bundle.fullManifest?.stepsWithAttrs ?? []
  const allAttrs = fullSteps.flatMap((s) => s.attributes)

  const totalsByVersion: Record<string, { total: number; mandatory: number; addedHere: number }> =
    {}
  for (const v of ALL_DPP_VERSIONS) {
    const upTo = ALL_DPP_VERSIONS.slice(
      0,
      ALL_DPP_VERSIONS.findIndex((x) => x.id === v.id) + 1,
    ).map((x) => x.id)
    const upToSet = new Set(upTo)
    const inScope = allAttrs.filter((a) => upToSet.has(a.version))
    const mandatory = inScope.filter((a) => a.necessity === 'mandatory').length
    const addedHere = allAttrs.filter((a) => a.version === v.id).length
    totalsByVersion[v.id] = { total: inScope.length, mandatory, addedHere }
  }

  const focusId = hovered ?? version
  const focusVersion = ALL_DPP_VERSIONS.find((v) => v.id === focusId) ?? ALL_DPP_VERSIONS[0]!
  const focusCounts = totalsByVersion[focusId] ?? { total: 0, mandatory: 0, addedHere: 0 }
  const focusDelta = VERSION_DELTAS[focusId] ?? { headline: '', bullets: [] }
  const focusIndex = ALL_DPP_VERSIONS.findIndex((v) => v.id === focusId)

  return (
    <section>
      <style>{VERSION_ATLAS_CSS}</style>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Version atlas
          </p>
          <h2 className="mt-1 text-[20px] font-semibold leading-tight text-[var(--fg-default)]">
            Choose your DPP schema
          </h2>
          <p className="mt-1 max-w-[640px] text-[13px] text-[var(--fg-muted)]">
            Every version is cumulative · each step on the path layers new attributes onto the
            prior. Hover any tile to peek; click to lock it in for{' '}
            <span className="font-medium text-[var(--fg-default)]">{bundle.product.name}</span>.
          </p>
        </div>
        <div className="hidden shrink-0 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-canvas)] px-3 py-2 text-right md:block">
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            Currently locked
          </p>
          <p className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--fg-default)]">
            DPP {version}
          </p>
        </div>
      </div>

      {/* 3D animated timeline */}
      <div
        className="version-atlas-stage mt-7 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-gradient-to-b from-[var(--color-fog)] to-white px-5 py-10"
        onMouseLeave={() => setHovered(null)}
      >
        <div className="version-atlas-track">
          <span className="version-atlas-rail" aria-hidden />
          <span
            className="version-atlas-progress"
            aria-hidden
            style={{ width: `${(focusIndex / (ALL_DPP_VERSIONS.length - 1)) * 100}%` }}
          />
          {ALL_DPP_VERSIONS.map((v, i) => {
            const enabled = available.has(v.id)
            const isSelected = version === v.id
            const isHovered = hovered === v.id
            const isLocked = focusIndex >= i
            const counts = totalsByVersion[v.id] ?? { total: 0, mandatory: 0, addedHere: 0 }
            return (
              <button
                key={v.id}
                type="button"
                disabled={!enabled}
                onClick={() => enabled && setVersion(v.id)}
                onMouseEnter={() => setHovered(v.id)}
                onFocus={() => setHovered(v.id)}
                onBlur={() => setHovered(null)}
                aria-pressed={isSelected}
                aria-label={`${v.label} · ${v.tagline}`}
                className={[
                  'version-atlas-tile',
                  isSelected ? 'is-selected' : '',
                  isHovered ? 'is-hovered' : '',
                  enabled ? '' : 'is-disabled',
                  isLocked ? 'is-locked' : '',
                ].join(' ')}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="version-atlas-tile-orbit" aria-hidden />
                <span className="version-atlas-tile-face">
                  <span className="version-atlas-tile-id">
                    v{v.id === '2' || v.id === '3' || v.id === '4' ? `${v.id}.0` : v.id}
                  </span>
                  <span className="version-atlas-tile-label">{v.label}</span>
                  <span className="version-atlas-tile-meta">
                    {counts.total > 0 ? `${counts.total} attrs` : '—'}
                  </span>
                  {counts.addedHere > 0 && i > 0 && (
                    <span className="version-atlas-tile-delta">+{counts.addedHere} new</span>
                  )}
                  <span className="version-atlas-tile-status">
                    {isSelected ? (
                      <span className="version-atlas-pill version-atlas-pill--accent">
                        <Check className="h-2.5 w-2.5" />
                        Selected
                      </span>
                    ) : enabled && v.status === 'available' ? (
                      <span className="version-atlas-pill version-atlas-pill--ready">Ready</span>
                    ) : (
                      <span className="version-atlas-pill version-atlas-pill--soon">
                        <Lock className="h-2.5 w-2.5" />
                        Soon
                      </span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
          {hovered ? 'previewing' : 'flow · cumulative attributes'}
        </p>
      </div>

      {/* Comparison panel */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <article className="rounded-[var(--radius-lg)] border-2 border-[var(--color-accent)] bg-white p-5 shadow-[0_2px_8px_rgba(15,76,129,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              {hovered && hovered !== version ? 'Previewing' : 'Selected'}
            </p>
            <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
              {focusVersion.status === 'available' ? 'Locked & ready' : 'Coming soon'}
            </span>
          </div>
          <h3 className="mt-1 flex items-baseline gap-2 text-[24px] font-semibold leading-tight text-[var(--fg-default)]">
            {focusVersion.label}
            <span className="text-[13px] font-normal text-[var(--fg-muted)]">
              {focusDelta.headline}
            </span>
          </h3>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-[var(--surface-border)] rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-canvas)]">
            <div className="px-3 py-2.5">
              <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                Attributes
              </dt>
              <dd className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-[var(--fg-default)]">
                {focusCounts.total || '—'}
              </dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                Mandatory
              </dt>
              <dd className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-[var(--fg-default)]">
                {focusCounts.mandatory || '—'}
              </dd>
            </div>
            <div className="px-3 py-2.5">
              <dt className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
                New here
              </dt>
              <dd className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-[var(--color-accent)]">
                {focusCounts.addedHere ? `+${focusCounts.addedHere}` : '—'}
              </dd>
            </div>
          </dl>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fg-subtle)]">
            What this version unlocks
          </p>
          <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--fg-default)]">
            {focusDelta.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {focusVersion.id !== version && available.has(focusVersion.id) && (
            <button
              type="button"
              onClick={() => setVersion(focusVersion.id)}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              Lock {focusVersion.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </article>

        <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-canvas)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
            What other versions add on top
          </p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            Cumulative roadmap · locking a lower version doesn&rsquo;t close these doors.
          </p>
          <ul className="mt-4 space-y-2.5">
            {ALL_DPP_VERSIONS.map((v, i) => {
              const counts = totalsByVersion[v.id] ?? { total: 0, mandatory: 0, addedHere: 0 }
              const delta = VERSION_DELTAS[v.id] ?? { headline: '', bullets: [] }
              const isFocus = v.id === focusId
              const isCurrent = v.id === version
              return (
                <li
                  key={v.id}
                  className={[
                    'rounded-[var(--radius-md)] border bg-white p-3 transition',
                    isFocus
                      ? 'border-[var(--color-accent)] shadow-[0_1px_4px_rgba(15,76,129,0.1)]'
                      : 'border-[var(--surface-border)]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          'font-mono text-[10px] font-bold tabular-nums',
                          isFocus ? 'text-[var(--color-accent)]' : 'text-[var(--fg-subtle)]',
                        ].join(' ')}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[12px] font-semibold text-[var(--fg-default)]">
                        {v.label}
                      </span>
                      {isCurrent && (
                        <span className="rounded-[var(--radius-pill)] bg-[var(--color-accent)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                          Locked
                        </span>
                      )}
                    </div>
                    {counts.addedHere > 0 && i > 0 && (
                      <span className="font-mono text-[10px] tabular-nums text-[var(--color-accent)]">
                        +{counts.addedHere}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{delta.headline}</p>
                </li>
              )
            })}
          </ul>
        </article>
      </div>
    </section>
  )
}

const VERSION_ATLAS_CSS = `
.version-atlas-stage {
  perspective: 1400px;
  perspective-origin: 50% 30%;
}
.version-atlas-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  transform-style: preserve-3d;
}
.version-atlas-rail {
  position: absolute;
  left: 6%;
  right: 6%;
  top: 64px;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--surface-border) 12%, var(--surface-border) 88%, transparent 100%);
  pointer-events: none;
  transform: translateZ(-30px);
}
.version-atlas-progress {
  position: absolute;
  left: 6%;
  top: 63px;
  height: 4px;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--color-accent), #4f8fc7);
  box-shadow: 0 0 16px rgba(15, 76, 129, 0.35);
  pointer-events: none;
  transition: width 480ms cubic-bezier(0.16, 1, 0.3, 1);
  max-width: calc(100% - 12%);
}
.version-atlas-tile {
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  transform-style: preserve-3d;
  transform: perspective(900px) rotateX(8deg) rotateY(-4deg) translateZ(0);
  transition: transform 360ms cubic-bezier(0.16, 1, 0.3, 1), filter 240ms ease;
  animation: version-atlas-rise 540ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
  outline: none;
}
.version-atlas-tile:nth-child(odd of .version-atlas-tile) { transform: perspective(900px) rotateX(8deg) rotateY(4deg); }
.version-atlas-tile:hover:not(.is-disabled),
.version-atlas-tile.is-hovered:not(.is-disabled) {
  transform: perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(28px) scale(1.04);
}
.version-atlas-tile.is-selected {
  transform: perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(36px) scale(1.06);
}
.version-atlas-tile.is-disabled {
  cursor: not-allowed;
  filter: grayscale(0.4) opacity(0.7);
}
.version-atlas-tile-orbit {
  position: absolute;
  inset: -8px;
  border-radius: 18px;
  background: radial-gradient(circle at 50% 0%, rgba(15, 76, 129, 0.22), transparent 70%);
  opacity: 0;
  transition: opacity 240ms ease;
  pointer-events: none;
}
.version-atlas-tile.is-selected .version-atlas-tile-orbit,
.version-atlas-tile.is-hovered .version-atlas-tile-orbit { opacity: 1; }

.version-atlas-tile-face {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 168px;
  padding: 14px 14px 12px;
  border-radius: 12px;
  background: linear-gradient(160deg, #ffffff 0%, #f7f8fb 100%);
  border: 1.5px solid var(--surface-border);
  box-shadow: 0 4px 14px -6px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 240ms ease, box-shadow 240ms ease;
  text-align: left;
}
.version-atlas-tile.is-locked .version-atlas-tile-face {
  background: linear-gradient(160deg, #ffffff 0%, var(--color-accent-soft) 100%);
  border-color: rgba(15, 76, 129, 0.32);
}
.version-atlas-tile.is-selected .version-atlas-tile-face {
  border-color: var(--color-accent);
  box-shadow: 0 12px 30px -10px rgba(15, 76, 129, 0.35), 0 2px 6px rgba(15, 76, 129, 0.12);
}
.version-atlas-tile-id {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--fg-subtle);
  text-transform: uppercase;
}
.version-atlas-tile-label {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg-default);
}
.version-atlas-tile-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted);
  tabular-nums: true;
}
.version-atlas-tile-delta {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--color-accent);
}
.version-atlas-tile-status { margin-top: auto; }

.version-atlas-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.version-atlas-pill--accent { background: var(--color-accent); color: #fff; }
.version-atlas-pill--ready { background: #DCFCE7; color: #166534; }
.version-atlas-pill--soon { background: var(--color-fog); color: var(--fg-subtle); }

@keyframes version-atlas-rise {
  from { opacity: 0; transform: perspective(900px) rotateX(20deg) translateY(18px); }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .version-atlas-tile,
  .version-atlas-tile.is-selected,
  .version-atlas-tile:hover:not(.is-disabled),
  .version-atlas-tile.is-hovered:not(.is-disabled) {
    transform: none;
    animation: none;
    transition: none;
  }
  .version-atlas-progress { transition: none; }
}
`

// ── Step 4: Parameters ─────────────────────────────────────────────────────

function ParametersStep({ bundle, version }: { bundle: ProductBundle; version: string }) {
  const manifest = bundle.manifest
  const steps = manifest?.stepsWithAttrs ?? []
  const totalAttrs = steps.reduce((acc, s) => acc + s.attributes.length, 0)
  const mandatoryCount = steps.reduce(
    (acc, s) => acc + s.attributes.filter((a) => a.necessity === 'mandatory').length,
    0,
  )

  if (!manifest) {
    return (
      <section>
        <p className="text-[13px] text-[var(--fg-muted)]">
          No locked manifest found for {bundle.product.name} at v{version}.
        </p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-[var(--fg-default)]">
        Parameter roster ({totalAttrs} attributes locked at DPP {manifest.version})
      </h2>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        These are the data points this passport will collect. The roster was locked for{' '}
        {bundle.product.name} during onboarding · {mandatoryCount} mandatory,{' '}
        {totalAttrs - mandatoryCount} recommended/voluntary.
      </p>

      <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-canvas)]">
        <ul className="divide-y divide-[var(--surface-border)]">
          {steps.map((s) => (
            <ParameterStepRow key={s.stepId} step={s} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ParameterStepRow({ step }: { step: ManifestStep }) {
  const [expanded, setExpanded] = useState(false)
  const t = tierStyle(step.tier)
  const Icon = stepIcon(step.slug)
  const mandatory = step.attributes.filter((a) => a.necessity === 'mandatory').length
  const optional = step.attributes.length - mandatory
  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--color-fog)]"
      >
        <span className={['flex h-8 w-8 items-center justify-center rounded-full', t.bg].join(' ')}>
          <Icon className="h-4 w-4 text-[var(--fg-default)]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--fg-default)]">
            {step.name}
          </span>
          <span className="block text-[11px] text-[var(--fg-muted)]">
            {mandatory} mandatory · {optional} recommended/voluntary
          </span>
        </span>
        <ChevronRight
          className={[
            'h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform',
            expanded ? 'rotate-90' : '',
          ].join(' ')}
        />
      </button>

      {expanded && step.attributes.length > 0 && (
        <ul className="border-t border-[var(--surface-border)] bg-white px-4 py-3 text-[12px]">
          {step.attributes.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-1.5">
              <span
                className={[
                  'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  a.necessity === 'mandatory'
                    ? 'bg-[#FEE2E2] text-[#991B1B]'
                    : 'bg-[var(--surface-hover)] text-[var(--fg-subtle)]',
                ].join(' ')}
              >
                {a.necessity === 'mandatory' ? '!' : '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[var(--fg-default)]">{a.label}</span>
                <span className="block break-all font-mono text-[10px] text-[var(--fg-subtle)]">
                  {a.attributePath}
                </span>
                {a.regulatoryAnchor && (
                  <span className="mt-0.5 inline-block rounded-[var(--radius-pill)] bg-[var(--surface-hover)] px-1.5 py-0.5 text-[9px] text-[var(--fg-muted)]">
                    {a.regulatoryAnchor}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Step 5: Cast info ─────────────────────────────────────────────────────

function CastStep({
  bundle,
  version,
  castNumber,
  setCastNumber,
  itemSerial,
  setItemSerial,
}: {
  bundle: ProductBundle
  version: string
  castNumber: string
  setCastNumber: (v: string) => void
  itemSerial: string
  setItemSerial: (v: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return (
    <section>
      <h2 className="text-[18px] font-semibold text-[var(--fg-default)]">Identify this passport</h2>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        A passport is one cast of {bundle.product.name} (DPP {version}). The cast number anchors all
        data you enter from here on.
      </p>

      <dl className="mt-6 grid grid-cols-1 gap-1.5 rounded-[var(--radius-md)] bg-[var(--surface-canvas)] p-4 text-[12px] sm:grid-cols-3">
        <Summary label="Product" value={bundle.product.name} />
        <Summary label="Brand" value={bundle.product.brand} />
        <Summary label="Form" value={bundle.product.form.replace(/_/g, ' ')} />
        <Summary label="Grade family" value={bundle.product.alloyFamily} />
        <Summary label="DPP version" value={`v${version}`} />
        <Summary label="Stages" value={`${bundle.detail?.chain.length ?? 0}`} />
      </dl>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cast number" required>
          <input
            type="text"
            value={castNumber}
            onChange={(e) => setCastNumber(e.target.value)}
            placeholder={`e.g. C-${today}-12345`}
            className="focus:ring-[var(--color-accent)]/20 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[13px] outline-none transition focus:border-[var(--color-accent)] focus:ring-2"
          />
        </Field>
        <Field label="Item serial (optional)">
          <input
            type="text"
            value={itemSerial}
            onChange={(e) => setItemSerial(e.target.value)}
            placeholder="e.g. EB-001"
            className="focus:ring-[var(--color-accent)]/20 h-10 w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[13px] outline-none transition focus:border-[var(--color-accent)] focus:ring-2"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--color-fog)] p-3 text-[12px] text-[var(--fg-muted)]">
        <CircleHelp className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
        <span>
          After clicking <strong>Create draft</strong>, you&rsquo;ll move to the data-entry step
          where each parameter can be filled by manual entry, IoT pull, library preset, or external
          assignment to a colleague or supplier.
        </span>
      </div>
    </section>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
      </dt>
      <dd className="text-[13px] font-medium text-[var(--fg-default)]">{value}</dd>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
        {label}
        {required && <span className="text-[var(--color-accent)]">*</span>}
      </span>
      {children}
    </label>
  )
}

// suppress unused-import lint warnings on icons referenced by stepIcon helper.
const _retain = { CircleDashed, CircleDot, Library, UserPlus }
void _retain
