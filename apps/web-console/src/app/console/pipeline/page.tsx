import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSignature,
  Gauge,
  Layers,
  TrendingUp,
  Zap,
} from 'lucide-react'

import { Badge, type BadgeTone } from '@dpp/ui'

import { Sparkline } from '@/components/console/Sparkline'
import { fetchMetrics, fetchRecentEvents, type RecentEvent } from '@/lib/pipeline-api'
import { listPresets } from '@/lib/api'
import { FirePresetButton } from '@/components/console/FirePresetButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_TONE: Record<RecentEvent['status'], BadgeTone> = {
  received: 'info',
  validated: 'info',
  generated: 'info',
  signed: 'info',
  published: 'success',
  failed: 'critical',
}

export default async function PipelinePage() {
  const [metrics, events, presets] = await Promise.all([
    fetchMetrics(),
    fetchRecentEvents(50),
    listPresets(),
  ])

  return (
    <div className="grid h-screen grid-rows-[auto_auto_1fr] overflow-hidden">
      <KpiStrip metrics={metrics} />
      <PresetRail presets={presets} />
      <div className="grid min-h-0 grid-cols-[1fr_360px] divide-x divide-[var(--surface-border)]">
        <ActivityFeed events={events} />
        <SidePanel metrics={metrics} events={events} />
      </div>
    </div>
  )
}

// ── Top KPI strip ──────────────────────────────────────────────────────────

function KpiStrip({ metrics }: { metrics: Awaited<ReturnType<typeof fetchMetrics>> }) {
  const m = metrics
  return (
    <header className="border-b border-[var(--surface-border)] bg-[var(--surface-page)] px-8 py-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight text-[var(--fg-default)]">
            Pipeline
          </h1>
          <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
            Live event throughput. Refresh every 10 s · auto-refresh disabled in dev.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
          {m ? `as of ${new Date().toISOString().slice(11, 19)} UTC` : 'API unreachable'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={Layers}
          label="Issued today"
          value={m?.issuedToday ?? 0}
          accent="ink"
          context={`${m?.issued24h ?? 0} in last 24h`}
        />
        <KpiCard
          icon={Zap}
          label="Throughput"
          value={`${m?.issuedPerMinute ?? 0}/min`}
          accent="ink"
          spark={m?.sparkline15min}
          context="last 15 min"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Success rate"
          value={`${(m?.successRatePct ?? 100).toFixed(1)}%`}
          accent={
            (m?.successRatePct ?? 100) >= 99
              ? 'success'
              : (m?.successRatePct ?? 100) >= 95
                ? 'warn'
                : 'critical'
          }
          context={`${m?.errorCount24h ?? 0} failures (24h)`}
        />
        <KpiCard
          icon={Clock}
          label="Latency p95"
          value={
            m?.p95LatencySeconds == null
              ? '—'
              : `${m.p95LatencySeconds < 1 ? (m.p95LatencySeconds * 1000).toFixed(0) + ' ms' : m.p95LatencySeconds.toFixed(2) + ' s'}`
          }
          context={
            m?.p50LatencySeconds == null
              ? 'no data'
              : `p50 ${m.p50LatencySeconds < 1 ? (m.p50LatencySeconds * 1000).toFixed(0) + ' ms' : m.p50LatencySeconds.toFixed(2) + ' s'}`
          }
          accent="ink"
        />
        <KpiCard
          icon={Gauge}
          label="Queue depth"
          value={m?.queueDepth ?? 0}
          context="cast events in flight"
          accent={(m?.queueDepth ?? 0) > 50 ? 'warn' : 'ink'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Avg CFP (24h)"
          value={m?.avgCfp24h == null ? '—' : Math.round(m.avgCfp24h).toLocaleString()}
          context="kg CO₂e/t"
          accent="ink"
        />
      </div>
    </header>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  context,
  spark,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  context?: string
  spark?: number[]
  accent: 'ink' | 'success' | 'warn' | 'critical'
}) {
  const accentColor =
    accent === 'success'
      ? 'var(--color-green, #16a34a)'
      : accent === 'warn'
        ? 'var(--color-amber, #d97706)'
        : accent === 'critical'
          ? 'var(--color-red, #dc2626)'
          : 'var(--fg-default)'
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        {spark && <Sparkline values={spark} width={64} height={20} />}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span
          className="tabular font-mono text-[22px] font-semibold leading-none"
          style={{ color: accentColor }}
        >
          {value}
        </span>
      </div>
      {context && <p className="mt-1 font-mono text-[10px] text-[var(--fg-subtle)]">{context}</p>}
    </div>
  )
}

// ── Preset firing rail ─────────────────────────────────────────────────────

function PresetRail({ presets }: { presets: Awaited<ReturnType<typeof listPresets>> }) {
  return (
    <div className="overflow-x-auto border-b border-[var(--surface-border)] bg-[var(--surface-recessed)] px-8 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Fire preset
        </span>
        {presets.length === 0 && (
          <span className="text-[12px] text-[var(--fg-muted)]">No presets loaded.</span>
        )}
        {presets.map((p) => (
          <PresetChip key={p.id} preset={p} />
        ))}
      </div>
    </div>
  )
}

function PresetChip({ preset }: { preset: Awaited<ReturnType<typeof listPresets>>[number] }) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-1.5">
      <span className="font-mono text-[11px] text-[var(--fg-default)]">{preset.label}</span>
      <span className="tabular font-mono text-[10px] text-[var(--fg-muted)]">
        {Math.round(preset.carbon.valueKgCo2ePerTonne).toLocaleString()} CO₂e/t
      </span>
      <FirePresetButton presetId={preset.id} />
    </div>
  )
}

// ── Activity feed ──────────────────────────────────────────────────────────

function ActivityFeed({ events }: { events: RecentEvent[] }) {
  return (
    <div className="overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--surface-page)] px-8 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Activity stream
        </p>
        <span className="font-mono text-[10px] text-[var(--fg-subtle)]">
          {events.length} of last 50
        </span>
      </div>
      {events.length === 0 ? (
        <div className="px-8 py-16 text-center">
          <Activity className="mx-auto h-8 w-8 text-[var(--fg-subtle)]" />
          <p className="mt-3 text-[14px] text-[var(--fg-default)]">No cast events yet.</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            Click a preset above to fire a synthetic event.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--surface-divider)]">
          {events.map((e) => (
            <EventRow key={`${e.castEventId}:${e.upi ?? 'pending'}`} event={e} />
          ))}
        </ul>
      )}
    </div>
  )
}

function EventRow({ event: e }: { event: RecentEvent }) {
  const time = e.receivedAt.slice(11, 19)
  const isError = e.status === 'failed'
  const isInFlight = !['published', 'failed'].includes(e.status)
  return (
    <li className="grid grid-cols-[80px_1fr_auto] items-start gap-4 px-8 py-3 text-[13px] hover:bg-[var(--surface-hover)]">
      <div className="flex flex-col gap-1">
        <span className="tabular font-mono text-[11px] text-[var(--fg-muted)]">{time}</span>
        <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[var(--fg-default)]">
            {e.brand ?? '—'} · {e.alloy ?? '—'}
          </span>
          {e.castNumber && (
            <span className="font-mono text-[11px] text-[var(--fg-subtle)]">{e.castNumber}</span>
          )}
          {isInFlight && <Badge tone="info">in flight</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--fg-muted)]">
          {e.weightKg != null && <span className="tabular">{e.weightKg.toLocaleString()} kg</span>}
          {e.cfpKgCo2ePerTonne != null && (
            <span className="tabular">
              {Math.round(e.cfpKgCo2ePerTonne).toLocaleString()} kg CO₂e/t
            </span>
          )}
          {e.pipelineSeconds != null && (
            <span className="tabular flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {e.pipelineSeconds < 1
                ? `${(e.pipelineSeconds * 1000).toFixed(0)} ms`
                : `${e.pipelineSeconds.toFixed(2)} s`}
            </span>
          )}
          {e.upi && <span className="truncate">{e.upi}</span>}
        </div>
        {isError && e.error && (
          <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#7f1d1d]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words font-mono leading-snug">{e.error}</span>
          </div>
        )}
      </div>
      <PipelineSteps event={e} />
    </li>
  )
}

// ── Per-event pipeline visualisation ───────────────────────────────────────

const PIPELINE_STEPS = [
  { id: 'received', label: 'Ingest' },
  { id: 'validated', label: 'Validate' },
  { id: 'generated', label: 'Generate' },
  { id: 'signed', label: 'Sign' },
  { id: 'published', label: 'Publish' },
] as const

function statusOrder(status: RecentEvent['status']): number {
  const map: Record<RecentEvent['status'], number> = {
    received: 1,
    validated: 2,
    generated: 3,
    signed: 4,
    published: 5,
    failed: 0,
  }
  return map[status]
}

function PipelineSteps({ event }: { event: RecentEvent }) {
  const reached = statusOrder(event.status)
  const failed = event.status === 'failed'
  return (
    <div className="hidden lg:block">
      <div className="flex items-center gap-1.5">
        {PIPELINE_STEPS.map((s, i) => {
          const num = i + 1
          const done = reached >= num
          const isCurrent = reached === num && !failed
          const isFailed = failed && i === Math.max(0, reached - 1)
          const dotColor = isFailed
            ? 'bg-[#dc2626]'
            : done
              ? 'bg-[var(--color-green,#16a34a)]'
              : isCurrent
                ? 'bg-[var(--color-amber,#d97706)] animate-pulse'
                : 'bg-[var(--surface-border)]'
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full ${dotColor}`}
                title={`${s.label}: ${done ? 'done' : isCurrent ? 'in flight' : 'pending'}`}
              />
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`h-px w-4 ${done && reached > num ? 'bg-[var(--color-green,#16a34a)]' : 'bg-[var(--surface-border)]'}`}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5 text-center font-mono text-[8px] uppercase tracking-wider text-[var(--fg-subtle)]">
        {PIPELINE_STEPS.map((s) => (
          <span key={s.id}>{s.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── Right-rail side panel ──────────────────────────────────────────────────

function SidePanel({
  metrics,
  events,
}: {
  metrics: Awaited<ReturnType<typeof fetchMetrics>>
  events: RecentEvent[]
}) {
  const failures = events.filter((e) => e.status === 'failed').slice(0, 5)
  const inFlight = events.filter((e) => !['published', 'failed'].includes(e.status)).slice(0, 5)
  return (
    <aside className="overflow-y-auto bg-[var(--surface-recessed)] px-5 py-5">
      <Section title="Status mix · 24h">
        {!metrics || metrics.byStatus24h.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-subtle)]">No events in window.</p>
        ) : (
          <ul className="space-y-1.5">
            {metrics.byStatus24h.map((s) => (
              <li
                key={s.status}
                className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-page)] px-3 py-1.5 text-[12px]"
              >
                <span className="capitalize text-[var(--fg-default)]">{s.status}</span>
                <span className="tabular font-mono text-[var(--fg-muted)]">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Top brands · 24h">
        {!metrics || metrics.byBrand24h.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-subtle)]">No issuance yet today.</p>
        ) : (
          <ul className="space-y-1.5">
            {metrics.byBrand24h.slice(0, 5).map((b) => (
              <li
                key={b.brand}
                className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--surface-page)] px-3 py-1.5 text-[12px]"
              >
                <span className="text-[var(--fg-default)]">{b.brand}</span>
                <span className="tabular font-mono text-[var(--fg-muted)]">{b.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="In flight">
        {inFlight.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-subtle)]">Pipeline idle.</p>
        ) : (
          <ul className="space-y-2">
            {inFlight.map((e) => (
              <li
                key={`${e.castEventId}:${e.upi ?? 'pending'}`}
                className="rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--fg-default)]">
                    {e.castNumber ?? e.trackingId}
                  </span>
                  <Badge tone="info">{e.status}</Badge>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-[var(--fg-muted)]">
                  {e.brand} · {e.alloy}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Failures">
        {failures.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-subtle)]">No failures in the last 50 events.</p>
        ) : (
          <ul className="space-y-2">
            {failures.map((e) => (
              <li
                key={`${e.castEventId}:${e.upi ?? 'pending'}`}
                className="rounded-[var(--radius-sm)] border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#7f1d1d]">{e.castNumber ?? e.trackingId}</span>
                  <FileSignature className="h-3.5 w-3.5 text-[#dc2626]" />
                </div>
                {e.error && (
                  <p className="mt-1 break-words font-mono text-[10px] text-[#7f1d1d]">{e.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {title}
      </p>
      {children}
    </section>
  )
}
