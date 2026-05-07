import type { Route } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Factory,
  Info,
  Leaf,
  Recycle,
  ShieldCheck,
  Zap,
} from 'lucide-react'

import {
  fetchPlantStatus,
  type GroupRollup,
  type Signal,
  type SignalGroup,
  type SignalStatus,
} from '@/lib/plant-monitor-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_LABEL: Record<SignalStatus, string> = {
  ok: 'In band',
  warn: 'Warn',
  breach: 'Breach',
  no_data: 'No data',
}

const GROUP_LABEL: Record<SignalGroup, string> = {
  electrolysis: 'Electrolysis cell line',
  power: 'Power & energy mix',
  casthouse: 'Casthouse & QC',
  carbon: 'Carbon footprint',
  circularity: 'Circularity',
  verification: 'Verification & compliance',
}

const GROUP_ICON: Record<SignalGroup, React.ComponentType<{ className?: string }>> = {
  electrolysis: Cpu,
  power: Zap,
  casthouse: Factory,
  carbon: Leaf,
  circularity: Recycle,
  verification: ShieldCheck,
}

export default async function PlantMonitorPage() {
  const snap = await fetchPlantStatus()

  if (snap.accessDenied) {
    return (
      <div className="px-8 py-12">
        <div className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--color-amber,#d97706)]" />
          <h1 className="mt-3 text-[20px] font-semibold text-[var(--fg-default)]">Access denied</h1>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Plant monitor is restricted to tenant auditors and admins.
          </p>
        </div>
      </div>
    )
  }

  // ── Honest split: live (DB-backed) vs reference targets (pre-instrumentation)
  const live = snap.signals.filter((s) => !s.isSynthetic)
  const targets = snap.signals.filter((s) => s.isSynthetic)
  const liveAlerts = live.filter((s) => s.status === 'breach' || s.status === 'warn')
  const overall: SignalStatus =
    live.some((s) => s.status === 'breach')
      ? 'breach'
      : live.some((s) => s.status === 'warn')
        ? 'warn'
        : live.length > 0
          ? 'ok'
          : 'no_data'

  return (
    <div className="px-8 py-8">
      <Hero status={overall} snap={snap} liveCount={live.length} totalCount={snap.signals.length} />

      <DataTierBanner live={live.length} total={snap.signals.length} />

      {/* Live signals — the only numbers an operator can act on today. */}
      <section className="mt-6">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
            Live signals
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
              {live.length}
            </span>
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
            sourced from issued DPP bodies — every value here is auditable
          </p>
        </header>
        {live.length === 0 ? (
          <EmptyState
            title="No live signals yet"
            body="Issue a few cast events and these tiles will populate as the platform aggregates them."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {live.map((s) => (
              <SignalTile key={s.key} signal={s} variant="live" />
            ))}
          </div>
        )}
      </section>

      {/* Active alerts — only from live data, otherwise it's noise */}
      {liveAlerts.length > 0 && (
        <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
          <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className="h-4 w-4"
                style={{
                  color:
                    liveAlerts.some((s) => s.status === 'breach')
                      ? 'var(--color-red, #dc2626)'
                      : 'var(--color-amber, #d97706)',
                }}
              />
              <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
                Active alerts ({liveAlerts.length})
              </h2>
            </div>
          </header>
          <ul>
            {liveAlerts.map((s) => (
              <li key={s.key}>
                <Link
                  href={`/console/plant-monitor/${encodeURIComponent(s.key)}` as Route}
                  className="alert-row"
                >
                  <span className={`pm-dot pm-dot--${s.status}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--fg-default)]">{s.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                      {GROUP_LABEL[s.group]}
                      {s.regulatoryAnchor ? ` · ${s.regulatoryAnchor}` : ''}
                    </p>
                  </div>
                  <p className="alert-row-value">
                    <span className="tabular font-mono text-[14px] font-semibold text-[var(--fg-default)]">
                      {formatNumber(s.value)}
                    </span>{' '}
                    <span className="text-[11px] text-[var(--fg-muted)]">{s.unit}</span>
                  </p>
                  <span className={`pm-pill pm-pill--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reference targets — collapsed by default · the BMS roadmap */}
      <details className="mt-8 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
        <summary className="pm-summary">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
              Reference targets · pre-instrumentation
            </p>
            <p className="mt-1 text-[14px] font-semibold text-[var(--fg-default)]">
              {targets.length} signals waiting for sensor commissioning
            </p>
            <p className="mt-1 max-w-3xl text-[12px] text-[var(--fg-muted)]">
              These are the operating bands HZL will monitor once the SCADA, MES, and ledger
              feeds are wired in. Each tile shows the target band and the planned data
              lineage. Open one to see the spec.
            </p>
          </div>
          <span className="pm-summary-chev" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="border-t border-[var(--surface-border)] p-5">
          <GroupedTargets signals={targets} groups={snap.groups} />
        </div>
      </details>

      {/* Always-visible explainer of how data flows in */}
      <CollectionLanes />

      <style>{PM_CSS}</style>
    </div>
  )
}

// ── Components ──────────────────────────────────────────────────────────

function Hero({
  status,
  snap,
  liveCount,
  totalCount,
}: {
  status: SignalStatus
  snap: { plantName: string; lineCount: number; generatedAt: string }
  liveCount: number
  totalCount: number
}) {
  const verdictHeadline =
    status === 'breach'
      ? 'A live signal has breached its target band'
      : status === 'warn'
        ? 'A live signal is drifting — review before next shift'
        : status === 'no_data'
          ? 'No live signals available yet'
          : 'All live signals nominal'
  const VerdictIcon = status === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <header className={`pm-hero pm-hero--${status}`}>
      <div className="pm-hero-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Operations · plant monitor
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-[var(--fg-default)]">
          {snap.plantName}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-[var(--fg-muted)]">
          The smelter / refinery analogue of a battery management system. {liveCount} of{' '}
          {totalCount} process signals are wired to live DPP-derived data today; the rest are
          reference targets the platform will read once the field instrumentation lands.
        </p>
      </div>
      <div className="pm-hero-right">
        <div className="pm-verdict">
          <span className={`pm-verdict-icon pm-verdict-icon--${status}`}>
            <VerdictIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
              Live verdict · {STATUS_LABEL[status]}
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-tight text-[var(--fg-default)]">
              {verdictHeadline}
            </p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
          generated {relTime(snap.generatedAt)} · {snap.lineCount} lines
        </p>
      </div>
    </header>
  )
}

function DataTierBanner({ live, total }: { live: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((live / total) * 100)
  return (
    <aside className="pm-banner">
      <Info className="h-4 w-4 text-[var(--color-accent)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-[var(--fg-default)]">
          <span className="font-semibold">{live}/{total} signals are live-wired</span> ({pct}%
          of the catalogue). Only the live tiles below trigger alerts. The reference targets
          panel further down lists the bands the rest will monitor once their SCADA/MES feed
          lands — clearly labelled to avoid confusing aspirational data with operating data.
        </p>
      </div>
    </aside>
  )
}

function GroupedTargets({
  signals,
  groups,
}: {
  signals: Signal[]
  groups: GroupRollup[]
}) {
  // Group by category, but only render groups that actually have target signals.
  const order: SignalGroup[] = [
    'electrolysis',
    'power',
    'casthouse',
    'carbon',
    'circularity',
    'verification',
  ]
  return (
    <div className="space-y-6">
      {order.map((g) => {
        const items = signals.filter((s) => s.group === g)
        if (items.length === 0) return null
        const Icon = GROUP_ICON[g]
        const rollup = groups.find((x) => x.key === g)
        return (
          <section key={g}>
            <header className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[13px] font-semibold text-[var(--fg-default)]">
                {GROUP_LABEL[g]}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                {items.length} target{items.length === 1 ? '' : 's'}
                {rollup && rollup.total > 0
                  ? ` · ${Math.round((items.length / rollup.total) * 100)}% of group`
                  : ''}
              </span>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <SignalTile key={s.key} signal={s} variant="target" />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function SignalTile({ signal, variant }: { signal: Signal; variant: 'live' | 'target' }) {
  const href = `/console/plant-monitor/${encodeURIComponent(signal.key)}` as Route
  return (
    <Link href={href} className={`pm-tile pm-tile--${signal.status} pm-tile--${variant}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-medium leading-snug text-[var(--fg-default)]">
            {signal.label}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
            {signal.regulatoryAnchor ?? GROUP_LABEL[signal.group]}
          </p>
        </div>
        {variant === 'live' ? (
          <span className="pm-chip pm-chip--live">live</span>
        ) : (
          <span className="pm-chip pm-chip--target">target</span>
        )}
      </div>
      {variant === 'live' ? (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tabular font-mono text-[28px] font-semibold leading-none text-[var(--fg-default)]">
              {formatNumber(signal.value)}
            </span>
            <span className="text-[12px] text-[var(--fg-muted)]">{signal.unit}</span>
            <span className={`pm-pill pm-pill--${signal.status} ml-auto`}>
              {STATUS_LABEL[signal.status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-[var(--fg-subtle)]">
            target {formatBand(signal.targetMin, signal.targetMax, signal.unit)}
          </p>
          <Sparkline trend={signal.trend} status={signal.status} />
          <p className="mt-2 text-[11px] leading-snug text-[var(--fg-muted)]">
            {signal.description}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
            target band
          </p>
          <p className="tabular mt-1 font-mono text-[16px] font-semibold text-[var(--fg-default)]">
            {formatBand(signal.targetMin, signal.targetMax, signal.unit)}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-[var(--fg-muted)]">
            {signal.description}
          </p>
          <p className="mt-3 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
            View spec & lineage <ArrowRight className="h-3 w-3" />
          </p>
        </>
      )}
    </Link>
  )
}

function Sparkline({ trend, status }: { trend: number[]; status: SignalStatus }) {
  if (trend.length < 2) return <div className="mt-3 h-10" />
  const min = Math.min(...trend)
  const max = Math.max(...trend)
  const span = max - min || 1
  const w = 200
  const h = 40
  const step = w / (trend.length - 1)
  const pts = trend
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ')
  const stroke =
    status === 'breach'
      ? 'var(--color-red, #dc2626)'
      : status === 'warn'
        ? 'var(--color-amber, #d97706)'
        : status === 'no_data'
          ? 'var(--fg-subtle)'
          : 'var(--color-green, #16a34a)'
  const fill =
    status === 'breach'
      ? 'rgba(220,38,38,0.10)'
      : status === 'warn'
        ? 'rgba(217,119,6,0.10)'
        : 'rgba(22,163,74,0.10)'
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-3 h-10 w-full"
      role="img"
      aria-label="trend"
    >
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={fill} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.6" />
    </svg>
  )
}

function CollectionLanes() {
  const lanes = [
    {
      title: 'Sensor → MES',
      text:
        'Pot SCADA · mould thermocouples · energy meters → 5-min rollups in Honeywell Experion → DPP API.',
    },
    {
      title: 'Weighbridge → ASI ledger',
      text:
        'Each scrap truck weighed and classified · mass-balance allocator updates the ASI Chain-of-Custody ledger.',
    },
    {
      title: 'DPP rollups (live today)',
      text:
        'CFP, recycled %, and DoD coverage are SQL aggregates over the signed dpp_records.body envelope.',
    },
    {
      title: 'Verifier feeds',
      text:
        'DNV CFP statements + ASI certificates uploaded via the verifier portal; validity scanned daily.',
    },
  ]
  return (
    <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-5">
      <header className="mb-3">
        <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
          How monitoring data flows in
        </h2>
        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
          Four intake lanes cover every signal. Lane 3 is fully wired today; the other three
          are spec'd and waiting on the corresponding plant-floor commissioning.
        </p>
      </header>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {lanes.map((l, i) => (
          <li
            key={l.title}
            className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-4"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
              Lane {i + 1}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--fg-default)]">{l.title}</p>
            <p className="mt-1 text-[11px] leading-snug text-[var(--fg-muted)]">{l.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] px-5 py-8 text-center">
      <p className="text-[13px] font-medium text-[var(--fg-default)]">{title}</p>
      <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{body}</p>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────

function formatNumber(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2).replace(/\.?0+$/, '')
}

function formatBand(min: number | null, max: number | null, unit: string): string {
  if (min === null && max === null) return 'context'
  if (min !== null && max !== null) return `${formatNumber(min)} – ${formatNumber(max)} ${unit}`
  if (min !== null) return `≥ ${formatNumber(min)} ${unit}`
  return `≤ ${formatNumber(max!)} ${unit}`
}

function relTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const ms = Date.now() - t
  if (ms < 0) return 'just now'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.round(min / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

const PM_CSS = `
.pm-hero {
  display: grid;
  gap: 18px;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
}
@media (min-width: 1080px) {
  .pm-hero { grid-template-columns: 1.4fr 1fr; align-items: center; }
}
.pm-hero--breach { border-color: var(--color-red, #dc2626); background: color-mix(in srgb, var(--color-red, #dc2626) 4%, var(--surface-page)); }
.pm-hero--warn   { border-color: var(--color-amber, #d97706); background: color-mix(in srgb, var(--color-amber, #d97706) 4%, var(--surface-page)); }
.pm-hero--ok     { border-color: color-mix(in srgb, var(--color-green, #16a34a) 40%, var(--surface-border)); }
.pm-verdict {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
}
.pm-verdict-icon {
  display: grid; place-items: center;
  width: 40px; height: 40px;
  border-radius: 9999px;
  background: var(--surface-recessed);
  flex-shrink: 0;
}
.pm-verdict-icon--ok     { background: color-mix(in srgb, var(--color-green, #16a34a) 14%, transparent); color: var(--color-green, #16a34a); }
.pm-verdict-icon--warn   { background: color-mix(in srgb, var(--color-amber, #d97706) 14%, transparent); color: var(--color-amber, #d97706); }
.pm-verdict-icon--breach { background: color-mix(in srgb, var(--color-red, #dc2626) 14%, transparent); color: var(--color-red, #dc2626); }

.pm-banner {
  margin-top: 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, var(--surface-border));
  background: color-mix(in srgb, var(--color-accent) 4%, var(--surface-page));
}

.pm-dot {
  display: inline-block;
  width: 9px; height: 9px;
  border-radius: 9999px;
  background: var(--surface-border);
}
.pm-dot--ok     { background: var(--color-green, #16a34a); }
.pm-dot--warn   { background: var(--color-amber, #d97706); }
.pm-dot--breach { background: var(--color-red, #dc2626); }
.pm-dot--no_data{ background: var(--fg-subtle); }

.pm-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  border: 1px solid var(--surface-border);
}
.pm-pill--ok     { border-color: var(--color-green, #16a34a); color: var(--color-green, #16a34a); background: color-mix(in srgb, var(--color-green, #16a34a) 8%, transparent); }
.pm-pill--warn   { border-color: var(--color-amber, #d97706); color: var(--color-amber, #d97706); background: color-mix(in srgb, var(--color-amber, #d97706) 8%, transparent); }
.pm-pill--breach { border-color: var(--color-red, #dc2626); color: var(--color-red, #dc2626); background: color-mix(in srgb, var(--color-red, #dc2626) 8%, transparent); }
.pm-pill--no_data{ color: var(--fg-subtle); }

.pm-chip {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--surface-border);
}
.pm-chip--live   { color: var(--color-green, #16a34a); background: color-mix(in srgb, var(--color-green, #16a34a) 10%, transparent); border-color: color-mix(in srgb, var(--color-green, #16a34a) 30%, var(--surface-border)); }
.pm-chip--target { color: var(--fg-subtle); background: var(--surface-recessed); }

.alert-row {
  display: grid;
  grid-template-columns: 12px minmax(0, 2fr) auto auto auto;
  gap: 14px;
  align-items: center;
  padding: 10px 18px;
  border-bottom: 1px solid var(--surface-border);
  text-decoration: none; color: inherit;
}
.alert-row:last-child { border-bottom: 0; }
.alert-row:hover { background: var(--surface-hover); }
.alert-row-value { text-align: right; }
@media (max-width: 760px) {
  .alert-row { grid-template-columns: 12px 1fr auto; }
  .alert-row-value { display: none; }
}

.pm-tile {
  position: relative;
  display: flex; flex-direction: column;
  padding: 14px 14px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  text-decoration: none;
  color: inherit;
  transition: border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.pm-tile::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: var(--surface-border);
}
.pm-tile--live::before    { background: var(--color-accent); }
.pm-tile--target::before  { background: var(--fg-subtle); opacity: 0.5; }
.pm-tile--ok::before      { background: var(--color-green, #16a34a); }
.pm-tile--warn::before    { background: var(--color-amber, #d97706); }
.pm-tile--breach::before  { background: var(--color-red, #dc2626); }
.pm-tile:hover { border-color: var(--color-accent); transform: translateY(-1px); box-shadow: 0 6px 16px -10px rgba(15, 76, 129, 0.30); }
.pm-tile--target { background: var(--surface-recessed); }

.pm-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 22px;
  cursor: pointer;
  list-style: none;
}
.pm-summary::-webkit-details-marker { display: none; }
.pm-summary-chev {
  font-size: 14px;
  color: var(--fg-subtle);
  transition: transform 200ms ease;
}
details[open] > .pm-summary .pm-summary-chev { transform: rotate(180deg); }

@media (prefers-reduced-motion: reduce) {
  .pm-tile, .pm-summary-chev { transition: none; }
  .pm-tile:hover { transform: none; }
}
`
