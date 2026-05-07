import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  CheckCircle2,
  CircleDashed,
  Database,
  GitBranch,
  Lock,
  Package,
  Plug,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

import { Badge, Stat, type BadgeTone } from '@dpp/ui'

import {
  DPP_VERSIONS,
  fetchProductDetail,
  fetchProductManifest,
  fetchProductReadiness,
  listProductPortfolio,
  lockProductDppConfig,
  saveProductDppConfig,
  seedProductConfiguration,
  setProductDataSourcePermission,
  upsertProductDataSource,
  type DataSource,
  type DataSourceInput,
  type ManifestStep,
  type ProductDetail,
  type ProductManifest,
  type ProductPortfolio,
  type ProductReadiness,
  type ProductSummary,
} from '@/lib/product-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Search = {
  product?: string | string[]
  version?: string | string[]
}

export default async function OnboardingPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const params = (await searchParams) ?? {}
  const portfolio = await listProductPortfolio()

  if (!portfolio) {
    return (
      <Shell>
        <UnavailablePanel />
      </Shell>
    )
  }

  const productId = selectedProductId(params.product, portfolio)
  const version = selectedVersion(params.version)
  const selected = portfolio.products.find((p) => p.id === productId) ?? portfolio.products[0]
  const [detail, manifest, readiness] = selected
    ? await Promise.all([
        fetchProductDetail(selected.id),
        fetchProductManifest(selected.id, version),
        fetchProductReadiness(selected.id, version),
      ])
    : [null, null, null]

  return (
    <Shell>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            Zinc & Lead Product Setup
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] leading-6 text-[var(--fg-muted)]">
            Curate HZL's zinc/lead portfolio, value-chain evidence, source ownership, permissions,
            and data collection readiness for DPP go-live.
          </p>
        </div>
        <form action={seedAction}>
          <ActionButton icon={RefreshCw}>Seed portfolio</ActionButton>
        </form>
      </header>

      {portfolio.products.length === 0 ? (
        <EmptyPortfolio />
      ) : (
        <div className="space-y-10">
          <ZincLeadReadinessStrip
            portfolio={portfolio}
            detail={detail}
            manifest={manifest}
            readiness={readiness}
          />
          <LevelOne
            portfolio={portfolio}
            selectedProductId={selected?.id}
            selectedVersion={version}
          />
          {selected && (
            <VersionStrip
              product={selected}
              version={version}
              detail={detail}
              readiness={readiness}
            />
          )}
          {selected && detail && manifest && readiness && (
            <>
              <LevelTwo product={selected} detail={detail} version={version} />
              <LevelThree product={selected} manifest={manifest} version={version} />
              <LevelFive detail={detail} readiness={readiness} version={version} />
              <LevelSix readiness={readiness} />
            </>
          )}
        </div>
      )}
    </Shell>
  )
}

async function seedAction() {
  'use server'
  await seedProductConfiguration()
  revalidatePath('/console/onboarding')
  redirect('/console/onboarding')
}

async function saveManifestAction(formData: FormData) {
  'use server'
  const productId = numberValue(formData.get('productId'))
  const version = stringValue(formData.get('version')) || '1.0'
  if (!productId) redirect('/console/onboarding')
  await saveProductDppConfig(productId, version, selectionsFromForm(formData))
  revalidatePath('/console/onboarding')
  redirect(`/console/onboarding?product=${productId}&version=${version}`)
}

async function saveAndLockManifestAction(formData: FormData) {
  'use server'
  const productId = numberValue(formData.get('productId'))
  const version = stringValue(formData.get('version')) || '1.0'
  if (!productId) redirect('/console/onboarding')
  await saveProductDppConfig(productId, version, selectionsFromForm(formData))
  await lockProductDppConfig(productId, version)
  revalidatePath('/console/onboarding')
  redirect(`/console/onboarding?product=${productId}&version=${version}`)
}

async function upsertSourceAction(formData: FormData) {
  'use server'
  const productId = numberValue(formData.get('productId'))
  const stepId = numberValue(formData.get('processStepId'))
  const version = stringValue(formData.get('version')) || '1.0'
  if (!productId || !stepId) redirect('/console/onboarding')

  const connectorConfig: Record<string, unknown> = {}
  for (const key of ['endpoint', 'dataset', 'notes']) {
    const value = blankToNull(formData.get(`connector_${key}`))
    if (value) connectorConfig[key] = value
  }

  await upsertProductDataSource(productId, {
    process_step_id: stepId,
    origin: sourceOrigin(formData.get('origin')),
    supplier_name: blankToNull(formData.get('supplierName')),
    supplier_did: blankToNull(formData.get('supplierDid')),
    connector_kind: blankToNull(formData.get('connectorKind')),
    connector_config: connectorConfig,
  })
  revalidatePath('/console/onboarding')
  redirect(`/console/onboarding?product=${productId}&version=${version}`)
}

async function applyDefaultSourcesAction(formData: FormData) {
  'use server'
  const productId = numberValue(formData.get('productId'))
  const version = stringValue(formData.get('version')) || '1.0'
  if (!productId) redirect('/console/onboarding')

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('step:')) continue
    const stepId = numberValue(key.slice('step:'.length))
    const stepSlug = stringValue(value)
    if (!stepId || !stepSlug) continue
    const source = await upsertProductDataSource(productId, {
      process_step_id: stepId,
      ...defaultSourceForStep(stepSlug),
    })
    if (source?.origin === 'third_party' && source.permissionState === 'not_requested') {
      await setProductDataSourcePermission(source.id, 'requested')
    }
  }

  revalidatePath('/console/onboarding')
  redirect(`/console/onboarding?product=${productId}&version=${version}`)
}

async function transitionPermissionAction(formData: FormData) {
  'use server'
  const productId = numberValue(formData.get('productId'))
  const sourceId = numberValue(formData.get('sourceId'))
  const version = stringValue(formData.get('version')) || '1.0'
  const state = permissionState(formData.get('state'))
  if (!productId || !sourceId) redirect('/console/onboarding')
  await setProductDataSourcePermission(sourceId, state)
  revalidatePath('/console/onboarding')
  redirect(`/console/onboarding?product=${productId}&version=${version}`)
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="px-8 py-8">{children}</div>
}

function ZincLeadReadinessStrip({
  portfolio,
  detail,
  manifest,
  readiness,
}: {
  portfolio: ProductPortfolio
  detail: ProductDetail | null
  manifest: ProductManifest | null
  readiness: ProductReadiness | null
}) {
  const totalAttrs =
    manifest?.stepsWithAttrs.reduce((sum, step) => sum + step.attributes.length, 0) ?? 0
  const mandatoryAttrs =
    manifest?.stepsWithAttrs.reduce(
      (sum, step) => sum + step.attributes.filter((attr) => attr.necessity === 'mandatory').length,
      0,
    ) ?? 0
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PortalMetric
        label="Zinc & lead products"
        value={portfolio.products.length}
        context="EcoZen SHG, CGG Jumbo, Refined Lead 99.99 and casting alloys"
      />
      <PortalMetric
        label="Value-chain steps"
        value={detail?.chain.length ?? 0}
        context="mining to customer delivery"
      />
      <PortalMetric
        label="DPP attributes"
        value={totalAttrs}
        context={`${mandatoryAttrs} mandatory in version scope`}
      />
      <PortalMetric
        label="Go-live gate"
        value={readiness?.ready ? 'Ready' : 'Open'}
        context="ESPR, CBAM, IZA Zinc Mark and CFP evidence"
        tone={readiness?.ready ? 'success' : 'warning'}
      />
    </section>
  )
}

function PortalMetric({
  label,
  value,
  context,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  context: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const color =
    tone === 'success'
      ? 'text-[var(--color-green)]'
      : tone === 'warning'
        ? 'text-[var(--color-amber)]'
        : 'text-[var(--fg-default)]'
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[rgba(16,17,23,0.82)] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {label}
      </p>
      <p className={`mt-3 font-mono text-[30px] font-semibold leading-none ${color}`}>{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-[var(--fg-muted)]">{context}</p>
    </article>
  )
}

function LevelOne({
  portfolio,
  selectedProductId,
  selectedVersion,
}: {
  portfolio: ProductPortfolio
  selectedProductId?: number
  selectedVersion: string
}) {
  return (
    <section>
      <LevelHeader
        level="Level 1"
        title="Zinc & lead portfolio map"
        icon={Package}
        aside={`${portfolio.products.length} products · ${portfolio.canonicalChain.length} process steps`}
      />
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portfolio.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              selected={product.id === selectedProductId}
              version={selectedVersion}
              canonicalChain={portfolio.canonicalChain}
            />
          ))}
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            Zinc & lead value chain
          </p>
          <ol className="mt-4 space-y-3">
            {portfolio.canonicalChain.map((step) => (
              <li key={step.id} className="grid grid-cols-[28px_1fr] gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-page)] font-mono text-[11px] text-[var(--fg-muted)]">
                  {step.ordinal}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--fg-default)]">{step.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--fg-subtle)]">{step.tier}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function VersionStrip({
  product,
  version,
  detail,
  readiness,
}: {
  product: ProductSummary
  version: string
  detail: ProductDetail | null
  readiness: ProductReadiness | null
}) {
  const configs = detail?.dppConfigs ?? product.dppConfigs
  const activeConfig = configs.find((cfg) => cfg.version === version)
  const sourceCount = detail?.dataSources.length ?? 0
  const chainCount = detail?.chain.length ?? product.chainStepIds.length
  return (
    <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[20px] font-semibold text-[var(--fg-default)]">{product.name}</h2>
          <Badge tone={activeConfig?.state === 'locked' ? 'success' : 'neutral'}>
            {activeConfig?.state ?? 'no config'}
          </Badge>
          {readiness?.ready && <Badge tone="success">ready</Badge>}
        </div>
        <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
          {product.brand} · {product.alloyFamily} · {product.form.replace(/_/g, ' ')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <VersionLinks productId={product.id} version={version} />
        <div className="hidden h-8 w-px bg-[var(--surface-divider)] md:block" />
        <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
          {sourceCount}/{chainCount} sources
        </span>
      </div>
    </section>
  )
}

function VersionLinks({ productId, version }: { productId: number; version: string }) {
  return (
    <nav className="flex rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-0.5">
      {DPP_VERSIONS.map((v) => (
        <Link
          key={v}
          href={`/console/onboarding?product=${productId}&version=${v}`}
          className={`px-3 py-1.5 font-mono text-[11px] ${
            v === version
              ? 'rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--fg-on-accent)]'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg-default)]'
          }`}
        >
          {v}
        </Link>
      ))}
    </nav>
  )
}

function LevelTwo({
  product,
  detail,
  version,
}: {
  product: ProductSummary
  detail: ProductDetail
  version: string
}) {
  return (
    <section>
      <LevelHeader
        level="Level 2"
        title="Product value-chain route"
        icon={GitBranch}
        aside={`${detail.chain.length} configured steps`}
      />
      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)]">
        <div className="grid grid-cols-[80px_1fr_160px] bg-[var(--surface-recessed)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          <span>Order</span>
          <span>Step</span>
          <span>Tier</span>
        </div>
        <ol className="divide-y divide-[var(--surface-divider)]">
          {detail.chain.map((step) => (
            <li
              key={step.stepId}
              className="grid grid-cols-[80px_1fr_160px] items-center px-5 py-3 text-[13px]"
            >
              <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
                {step.ordinal.toString().padStart(2, '0')}
              </span>
              <div>
                <p className="font-medium text-[var(--fg-default)]">{step.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">{step.description}</p>
              </div>
              <Badge tone={step.tier === 'verification' ? 'accent' : 'neutral'}>{step.tier}</Badge>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {product.slug} · DPP {version}
      </p>
    </section>
  )
}

function LevelThree({
  product,
  manifest,
  version,
}: {
  product: ProductSummary
  manifest: ProductManifest
  version: string
}) {
  const config = manifest.config
  const locked = config?.state === 'locked'
  const totalAttrs = manifest.stepsWithAttrs.reduce((sum, step) => sum + step.attributes.length, 0)
  const mandatoryAttrs = manifest.stepsWithAttrs.reduce(
    (sum, step) => sum + step.attributes.filter((attr) => attr.necessity === 'mandatory').length,
    0,
  )
  const selectedAttrs = config ? countSelections(config.selections) : totalAttrs

  return (
    <section>
      <LevelHeader
        level="Levels 3-4"
        title="DPP version manifest and lock"
        icon={Lock}
        aside={`${selectedAttrs}/${totalAttrs} attributes selected`}
      />
      <div className="mt-4 grid gap-5 xl:grid-cols-[280px_1fr]">
        <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-5">
          <div className="space-y-5">
            <Stat
              label="DPP version"
              value={version}
              context={manifest.versionsInScope.join(' + ')}
            />
            <Stat
              label="Mandatory"
              value={mandatoryAttrs}
              context="ESPR/CBAM/IZA evidence fields"
            />
            <Stat
              label="Manifest state"
              value={config?.state ?? 'draft'}
              context={config?.lockedBy ?? 'not locked'}
            />
          </div>
        </div>

        <form action={saveManifestAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="version" value={version} />
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--surface-border)] bg-[var(--surface-recessed)] px-5 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
                  Zinc & lead DPP attribute roster
                </p>
                <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                  {product.name} · DPP {version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!locked && (
                  <>
                    <ActionButton compact icon={CheckCircle2}>
                      Save
                    </ActionButton>
                    <ActionButton compact icon={Lock} formAction={saveAndLockManifestAction}>
                      Lock
                    </ActionButton>
                  </>
                )}
                {locked && <Badge tone="success">locked</Badge>}
              </div>
            </div>
            <div className="divide-y divide-[var(--surface-divider)]">
              {manifest.stepsWithAttrs.map((step) => (
                <ManifestStepRows
                  key={step.stepId}
                  step={step}
                  selections={config?.selections}
                  disabled={locked}
                />
              ))}
            </div>
          </div>
        </form>
      </div>
    </section>
  )
}

function ManifestStepRows({
  step,
  selections,
  disabled,
}: {
  step: ManifestStep
  selections?: Record<string, number[]>
  disabled: boolean
}) {
  const selected = new Set(
    selections?.[String(step.stepId)] ?? step.attributes.map((attr) => attr.id),
  )
  return (
    <details open className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 hover:bg-[var(--surface-hover)]">
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-recessed)] font-mono text-[11px] text-[var(--fg-muted)]">
            {step.ordinal}
          </span>
          <div>
            <p className="text-[13px] font-medium text-[var(--fg-default)]">{step.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
              {step.attributes.length} attributes
            </p>
          </div>
        </div>
        <Badge tone="neutral">{step.tier}</Badge>
      </summary>
      <div className="grid gap-0 border-t border-[var(--surface-divider)] bg-[var(--surface-page)]">
        {step.attributes.map((attr) => (
          <label
            key={attr.id}
            className="grid grid-cols-[28px_1fr_110px_120px] items-start gap-3 px-5 py-2.5 text-[12px] hover:bg-[var(--surface-hover)]"
          >
            <input
              type="checkbox"
              name={`attr:${step.stepId}`}
              value={attr.id}
              defaultChecked={selected.has(attr.id)}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
            />
            <span>
              <span className="block font-medium text-[var(--fg-default)]">{attr.label}</span>
              <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
                {attr.attributePath}
              </span>
            </span>
            <Badge tone={attr.necessity === 'mandatory' ? 'accent' : 'neutral'}>
              {attr.necessity}
            </Badge>
            <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
              {attr.version}
              {attr.newAtThisVersion ? ' · new' : ''}
            </span>
          </label>
        ))}
      </div>
    </details>
  )
}

function LevelFive({
  detail,
  readiness,
  version,
}: {
  detail: ProductDetail
  readiness: ProductReadiness
  version: string
}) {
  const sourcesByStep = new Map(detail.dataSources.map((source) => [source.stepId, source]))
  return (
    <section>
      <LevelHeader
        level="Level 5"
        title="Source connectors and permissions"
        icon={Database}
        aside={`${detail.dataSources.length}/${detail.chain.length} sources mapped`}
      />
      <form action={applyDefaultSourcesAction} className="mt-4">
        <input type="hidden" name="productId" value={detail.product.id} />
        <input type="hidden" name="version" value={version} />
        {detail.chain.map((step) => (
          <input key={step.stepId} type="hidden" name={`step:${step.stepId}`} value={step.slug} />
        ))}
        <ActionButton icon={Plug}>Apply zinc/lead source map</ActionButton>
      </form>
      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)]">
        <div className="grid grid-cols-[1fr_140px_190px_170px_170px_110px] bg-[var(--surface-recessed)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          <span>Step</span>
          <span>Origin</span>
          <span>Supplier</span>
          <span>Connector</span>
          <span>Permission</span>
          <span>Sync</span>
        </div>
        <div className="divide-y divide-[var(--surface-divider)]">
          {detail.chain.map((step) => {
            const source = sourcesByStep.get(step.stepId)
            const status = readiness.stepStatus.find((s) => s.stepId === step.stepId)
            return (
              <SourceRow
                key={step.stepId}
                productId={detail.product.id}
                version={version}
                step={step}
                source={source}
                permissionState={status?.permissionState ?? null}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function SourceRow({
  productId,
  version,
  step,
  source,
  permissionState,
}: {
  productId: number
  version: string
  step: ProductDetail['chain'][number]
  source?: DataSource
  permissionState: DataSource['permissionState'] | null
}) {
  return (
    <div className="grid grid-cols-[1fr_140px_190px_170px_170px_110px] items-start gap-3 px-5 py-4 text-[12px]">
      <div>
        <p className="font-medium text-[var(--fg-default)]">{step.name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {step.slug}
        </p>
      </div>
      <form action={upsertSourceAction} className="contents">
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="processStepId" value={step.stepId} />
        <input type="hidden" name="version" value={version} />
        <select
          name="origin"
          defaultValue={source?.origin ?? defaultSourceForStep(step.slug).origin}
          className={inputClass}
        >
          <option value="internal">internal</option>
          <option value="third_party">third party</option>
        </select>
        <div className="grid gap-2">
          <input
            name="supplierName"
            defaultValue={source?.supplierName ?? ''}
            placeholder="Supplier"
            className={inputClass}
          />
          <input
            name="supplierDid"
            defaultValue={source?.supplierDid ?? ''}
            placeholder="DID"
            className={inputClass}
          />
        </div>
        <div className="grid gap-2">
          <select
            name="connectorKind"
            defaultValue={source?.connectorKind ?? ''}
            className={inputClass}
          >
            <option value="">connector</option>
            <option value="http_pull">HTTP pull</option>
            <option value="api_push">API push</option>
            <option value="sftp">SFTP</option>
            <option value="manual_csv">Manual CSV</option>
            <option value="vc_registry">VC registry</option>
          </select>
          <input
            name="connector_dataset"
            defaultValue={String(source?.connectorConfig.dataset ?? '')}
            placeholder="Dataset"
            className={inputClass}
          />
          <ActionButton compact icon={CheckCircle2}>
            Save
          </ActionButton>
        </div>
      </form>
      <div className="space-y-2">
        <Badge tone={permissionTone(permissionState)}>{permissionState ?? 'missing'}</Badge>
        {source?.origin === 'third_party' && (
          <form action={transitionPermissionAction} className="flex flex-wrap gap-1.5">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="sourceId" value={source.id} />
            <input type="hidden" name="version" value={version} />
            <MiniButton name="state" value="requested">
              request
            </MiniButton>
            <MiniButton name="state" value="granted">
              grant
            </MiniButton>
            <MiniButton name="state" value="denied">
              deny
            </MiniButton>
          </form>
        )}
      </div>
      <div className="font-mono text-[11px] text-[var(--fg-muted)]">
        {source?.lastSyncStatus ?? 'not run'}
      </div>
    </div>
  )
}

function LevelSix({ readiness }: { readiness: ProductReadiness }) {
  const gates = [
    { label: 'DPP manifest locked', ok: readiness.configLocked },
    { label: 'Refinery / smelter / casthouse sources mapped', ok: readiness.everyStepHasSource },
    { label: 'Verifier and upstream permissions granted', ok: readiness.thirdPartyGranted },
  ]
  return (
    <section>
      <LevelHeader
        level="Level 6"
        title="Data collection status and go-live"
        icon={ShieldCheck}
        aside={readiness.ready ? 'ready for ingestion' : 'open gates remain'}
      />
      <div className="mt-4 grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-5">
          <div className="flex items-center gap-3">
            {readiness.ready ? (
              <CheckCircle2 className="h-7 w-7 text-[var(--color-green,#16a34a)]" />
            ) : (
              <CircleDashed className="h-7 w-7 text-[var(--fg-subtle)]" />
            )}
            <div>
              <p className="text-[15px] font-semibold text-[var(--fg-default)]">
                {readiness.ready ? 'Go-live ready' : 'Not ready'}
              </p>
              <p className="text-[12px] text-[var(--fg-muted)]">
                DPP {readiness.version} · {readiness.product.name}
              </p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {gates.map((gate) => (
              <li key={gate.label} className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-[var(--fg-default)]">{gate.label}</span>
                <Badge tone={gate.ok ? 'success' : 'warning'}>{gate.ok ? 'done' : 'open'}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)]">
          <div className="grid grid-cols-[1fr_120px_130px_130px] bg-[var(--surface-recessed)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            <span>Collection step</span>
            <span>Source</span>
            <span>Permission</span>
            <span>Last sync</span>
          </div>
          <div className="divide-y divide-[var(--surface-divider)]">
            {readiness.stepStatus.map((step) => (
              <div
                key={step.stepId}
                className="grid grid-cols-[1fr_120px_130px_130px] items-center px-5 py-3 text-[13px]"
              >
                <div>
                  <p className="font-medium text-[var(--fg-default)]">{step.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
                    {step.slug}
                  </p>
                </div>
                <Badge tone={step.hasSource ? 'success' : 'warning'}>
                  {step.origin ?? 'missing'}
                </Badge>
                <Badge tone={permissionTone(step.permissionState)}>
                  {step.permissionState ?? 'missing'}
                </Badge>
                <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                  {step.lastSyncStatus ?? 'not run'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ProductCard({
  product,
  selected,
  version,
  canonicalChain,
}: {
  product: ProductSummary
  selected: boolean
  version: string
  canonicalChain: ProductPortfolio['canonicalChain']
}) {
  const locked = product.dppConfigs
    .filter((cfg) => cfg.state === 'locked')
    .map((cfg) => cfg.version)
  const chain = canonicalChain.filter((step) => product.chainStepIds.includes(step.id))
  return (
    <Link
      href={`/console/onboarding?product=${product.id}&version=${version}`}
      className={`rounded-[var(--radius-md)] border p-5 transition-[border-color,background] ${
        selected
          ? 'border-[var(--color-accent)] bg-[var(--surface-page)]'
          : 'border-[var(--surface-border)] bg-[var(--surface-page)] hover:bg-[var(--surface-hover)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            {product.brand}
          </p>
          <h3 className="mt-1 text-[16px] font-semibold text-[var(--fg-default)]">
            {product.name}
          </h3>
        </div>
        <Badge tone={locked.length ? 'success' : 'neutral'}>
          {locked.length ? `${locked.length} locked` : 'draft'}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-3 min-h-[54px] text-[13px] leading-[1.4] text-[var(--fg-muted)]">
        {product.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {chain.map((step) => (
          <span
            key={step.id}
            className="rounded-[var(--radius-sm)] bg-[var(--surface-recessed)] px-2 py-1 font-mono text-[10px] text-[var(--fg-muted)]"
          >
            {step.slug}
          </span>
        ))}
      </div>
    </Link>
  )
}

function LevelHeader({
  level,
  title,
  icon: Icon,
  aside,
}: {
  level: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  aside?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] bg-[var(--surface-recessed)] text-[var(--color-accent)]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            {level}
          </p>
          <h2 className="text-[18px] font-semibold text-[var(--fg-default)]">{title}</h2>
        </div>
      </div>
      {aside && (
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {aside}
        </span>
      )}
    </div>
  )
}

function EmptyPortfolio() {
  return (
    <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] p-8 text-center">
      <Package className="mx-auto h-8 w-8 text-[var(--fg-subtle)]" />
      <h2 className="mt-3 text-[16px] font-semibold text-[var(--fg-default)]">
        No zinc/lead products seeded
      </h2>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        Seed the HZL portfolio before starting grade, manifest, and source setup.
      </p>
      <form action={seedAction} className="mt-5">
        <ActionButton icon={RefreshCw}>Seed portfolio</ActionButton>
      </form>
    </section>
  )
}

function UnavailablePanel() {
  return (
    <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] p-8 text-center">
      <Database className="mx-auto h-8 w-8 text-[var(--fg-subtle)]" />
      <h1 className="mt-3 text-[18px] font-semibold text-[var(--fg-default)]">
        Zinc & lead configuration API unavailable
      </h1>
      <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
        Start the API and use a tenant-admin session to access product setup.
      </p>
    </section>
  )
}

function ActionButton({
  children,
  icon: Icon,
  compact = false,
  formAction,
}: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  compact?: boolean
  formAction?: (formData: FormData) => void | Promise<void>
}) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] font-medium text-[var(--fg-on-accent)] transition-opacity hover:opacity-90 ${
        compact ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}

function MiniButton({
  children,
  name,
  value,
}: {
  children: React.ReactNode
  name: string
  value: string
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className="rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-2 py-1 text-[11px] text-[var(--fg-default)] hover:bg-[var(--surface-hover)]"
    >
      {children}
    </button>
  )
}

const inputClass =
  'h-8 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-2 text-[12px] text-[var(--fg-default)] outline-none focus:[box-shadow:var(--shadow-focus)]'

function selectedProductId(
  raw: Search['product'],
  portfolio: ProductPortfolio,
): number | undefined {
  const value = numberValue(Array.isArray(raw) ? raw[0] : raw)
  if (value && portfolio.products.some((product) => product.id === value)) return value
  return portfolio.products[0]?.id
}

function selectedVersion(raw: Search['version']): string {
  const value = stringValue(Array.isArray(raw) ? raw[0] : raw)
  return DPP_VERSIONS.includes(value as (typeof DPP_VERSIONS)[number]) ? value : '1.0'
}

function selectionsFromForm(formData: FormData): Record<string, number[]> {
  const selections: Record<string, number[]> = {}
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('attr:')) continue
    const stepId = key.slice('attr:'.length)
    const attrId = numberValue(value)
    if (!stepId || !attrId) continue
    selections[stepId] = [...(selections[stepId] ?? []), attrId]
  }
  return selections
}

function countSelections(selections: Record<string, number[]>): number {
  return Object.values(selections).reduce((sum, attrs) => sum + attrs.length, 0)
}

function defaultSourceForStep(slug: string): Omit<DataSourceInput, 'process_step_id'> {
  switch (slug) {
    case 'mining':
      return {
        origin: 'internal',
        supplier_name: 'Rampura Agucha Mine',
        supplier_did: 'did:web:passport.hzlindia.com:BPNSHZSRAM00019F',
        connector_kind: 'http_pull',
        connector_config: { dataset: 'concentrate-origin-and-mine-ufi' },
      }
    case 'beneficiation':
    case 'refining':
      return {
        origin: 'internal',
        supplier_name: 'HZL Beneficiation & Concentrator',
        supplier_did: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
        connector_kind: 'api_push',
        connector_config: { dataset: 'concentrator-energy-and-recovery' },
      }
    case 'roasting':
    case 'anode_production':
      return {
        origin: 'internal',
        supplier_name: 'HZL Roaster Plant',
        supplier_did: 'did:web:passport.hzlindia.com:BPNSHZSCHA00012N',
        connector_kind: 'api_push',
        connector_config: { dataset: 'roaster-so2-and-thermal-balance' },
      }
    case 'smelting':
      return {
        origin: 'internal',
        supplier_name: 'Chanderiya Lead-Zinc Smelter',
        supplier_did: 'did:web:passport.hzlindia.com:BPNSHZSCHA00012N',
        connector_kind: 'api_push',
        connector_config: { dataset: 'electrowinning-energy-and-cbam' },
      }
    case 'casting':
      return {
        origin: 'internal',
        supplier_name: 'HZL Casthouse',
        supplier_did: 'did:web:passport.hzlindia.com:BPNSHZSCHA00012N',
        connector_kind: 'api_push',
        connector_config: { dataset: 'cast-chemistry-weight-and-grade' },
      }
    case 'verification':
      return {
        origin: 'third_party',
        supplier_name: 'DNV Business Assurance',
        supplier_did: 'did:web:dnv.com:cfp',
        connector_kind: 'vc_registry',
        connector_config: { dataset: 'verified-claims' },
      }
    case 'semis':
      return {
        origin: 'third_party',
        supplier_name: 'Galvanising / die-casting partner',
        connector_kind: 'api_push',
        connector_config: { dataset: 'semis-fabrication' },
      }
    case 'customer':
      return {
        origin: 'internal',
        supplier_name: 'HZL Commercial Operations',
        supplier_did: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
        connector_kind: 'api_push',
        connector_config: { dataset: 'customer-delivery-and-gs1-digital-link' },
      }
    default:
      return {
        origin: 'internal',
        supplier_name: 'Hindustan Zinc Limited',
        supplier_did: 'did:web:passport.hzlindia.com:BPNLHZL0000001QX',
        connector_kind: 'api_push',
        connector_config: { dataset: slug },
      }
  }
}

function permissionTone(state: DataSource['permissionState'] | null): BadgeTone {
  if (state === 'granted') return 'success'
  if (state === 'denied') return 'critical'
  if (state === 'requested') return 'warning'
  return 'neutral'
}

function blankToNull(value: FormDataEntryValue | null): string | null {
  const str = stringValue(value).trim()
  return str ? str : null
}

function stringValue(value: FormDataEntryValue | string | string[] | null | undefined): string {
  if (Array.isArray(value)) return stringValue(value[0])
  return typeof value === 'string' ? value : ''
}

function numberValue(
  value: FormDataEntryValue | string | number | null | undefined,
): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(stringValue(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function sourceOrigin(value: FormDataEntryValue | null): DataSource['origin'] {
  return stringValue(value) === 'third_party' ? 'third_party' : 'internal'
}

function permissionState(value: FormDataEntryValue | null): 'requested' | 'granted' | 'denied' {
  const state = stringValue(value)
  return state === 'granted' || state === 'denied' ? state : 'requested'
}
