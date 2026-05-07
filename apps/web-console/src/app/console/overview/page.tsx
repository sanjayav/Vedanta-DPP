import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, Leaf, Recycle, ShieldCheck, TrendingDown } from 'lucide-react'

import { Stat } from '@dpp/ui'

import { AnimatedKpi } from '@/components/console/AnimatedKpi'
import { LineChart } from '@/components/console/LineChart'
import { Sparkline } from '@/components/console/Sparkline'
import { listDpps, listVerifierRegistry } from '@/lib/api'
import { fetchMetrics, fetchTimeseries } from '@/lib/pipeline-api'

export const dynamic = 'force-dynamic'

const INDUSTRY_AVG_CFP = 3500 // kg CO₂e/tonne · IZA global average for primary zinc (RLE)

export default async function OverviewPage() {
  const [list, metrics, ts30, registry] = await Promise.all([
    listDpps({ limit: 500 }),
    fetchMetrics(),
    fetchTimeseries(30),
    listVerifierRegistry(),
  ])

  const total = list.total
  const issuedThisMonth = list.items.filter(
    (i) => i.issuedAt && _withinThisMonth(i.issuedAt),
  ).length
  const avgCfp = list.items.length
    ? list.items.reduce((s, i) => s + i.cfpKgCo2ePerTonne, 0) / list.items.length
    : 0
  const recycledTonnes = list.items.reduce(
    (s, i) => s + i.weightKg * (i.recycledContentPct / 100),
    0,
  )
  const totalWeight = list.items.reduce((s, i) => s + i.weightKg, 0)
  const recycledPct = totalWeight ? (recycledTonnes / totalWeight) * 100 : 0
  const co2eSaved =
    list.items.reduce(
      (s, i) => s + (i.weightKg / 1000) * (INDUSTRY_AVG_CFP - i.cfpKgCo2ePerTonne),
      0,
    ) / 1000 // tonnes saved

  // Brand mix
  const byBrand = new Map<string, { count: number; weight: number }>()
  for (const d of list.items) {
    const cur = byBrand.get(d.brand) ?? { count: 0, weight: 0 }
    cur.count += 1
    cur.weight += d.weightKg
    byBrand.set(d.brand, cur)
  }
  const brandMix = Array.from(byBrand, ([brand, v]) => ({ brand, ...v })).sort(
    (a, b) => b.weight - a.weight,
  )

  const dailyLabels = ts30.map((p) => p.date.slice(5)) // MM-DD
  const cfpSeries = ts30.map((p) => p.avgCfp)
  const recycledSeries = ts30.map((p) => p.avgRecycled)
  const issuanceSeries = ts30.map((p) => p.count)

  // Verifier coverage
  const activeVerifiers = registry.filter((v) => v.stateCounts.active > 0)
  const dependentDpps = registry.reduce((s, v) => s + v.dependentDppCount, 0)

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            Overview
          </h1>
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            Live programme posture for Hindustan Zinc Limited.
          </p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          DPP v1.0 · 106 attributes
        </span>
      </header>

      {/* ── Vedanta · HZL anchor metrics (FY 2024-25 from Sustainability Report) */}
      <section className="mb-10 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white px-6 py-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
            Vedanta · Hindustan Zinc · FY 2024-25
          </p>
          <a
            href="https://www.hzlindia.com/sustainability/sustainability-report/"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)] hover:underline"
          >
            Sustainability Report ↗
          </a>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4 xl:grid-cols-7">
          <AnimatedKpi label="Zinc production" value="827" unit="kt" delay={0.00} />
          <AnimatedKpi label="Lead production" value="225" unit="kt" delay={0.05} />
          <AnimatedKpi label="Silver production" value="687" unit="MT" delay={0.10} />
          <AnimatedKpi label="Refined capacity" value="1.123" unit="Mnt" delay={0.15} />
          <AnimatedKpi label="Captive power" value="625.16" unit="MW" delay={0.20} />
          <AnimatedKpi label="Renewable share" value="13" unit="%" hint="→ 70% by FY28" delay={0.25} />
          <AnimatedKpi label="Workforce" value="25,531" hint="incl. contractors" delay={0.30} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--surface-border)] pt-4 md:grid-cols-4 xl:grid-cols-7">
          <AnimatedKpi label="GHG saved" value="0.67" unit="Mn tCO₂e" delay={0.35} />
          <AnimatedKpi label="Carbon intensity ↓" value="15" unit="%" hint="vs FY 2019-20" delay={0.40} />
          <AnimatedKpi label="Water positive" value="3.32" unit="x" delay={0.45} />
          <AnimatedKpi label="ZLD coverage" value="100" unit="%" delay={0.50} />
          <AnimatedKpi label="TRIFR" value="1.20" hint="↓ 55% vs FY20" delay={0.55} />
          <AnimatedKpi label="CSR spend" value="273.45" unit="₹ cr" delay={0.60} />
          <AnimatedKpi label="S&P CSA" value="#1" hint="Metals & Mining 2024" delay={0.65} />
        </div>
      </section>

      {/* ── Hero KPIs ────────────────────────────────────────────────────── */}
      <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="DPPs issued (lifetime)" value={total.toLocaleString()} />
        <Stat label="Issued this month" value={issuedThisMonth.toLocaleString()} />
        <Stat
          label="Avg CFP"
          value={Math.round(avgCfp).toLocaleString()}
          unit="kg/t"
          context={`${(((INDUSTRY_AVG_CFP - avgCfp) / INDUSTRY_AVG_CFP) * 100).toFixed(0)}% under industry`}
        />
        <Stat
          label="Recycled tonnes"
          value={Math.round(recycledTonnes).toLocaleString()}
          unit="t"
          context={`${recycledPct.toFixed(1)}% of throughput`}
        />
        <Stat
          label="CO₂e avoided"
          value={Math.round(co2eSaved).toLocaleString()}
          unit="t"
          context={`vs IZA ${INDUSTRY_AVG_CFP.toLocaleString()} kg/t`}
        />
        <Stat
          label="Active verifiers"
          value={activeVerifiers.length}
          context={`${dependentDpps} DPPs depend on them`}
        />
      </section>

      {/* ── Charts ──────────────────────────────────────────────────────── */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Average CFP · last 30 days"
          subtitle="Daily mean of issued passports vs. industry baseline"
          legend={[
            { color: 'var(--color-accent, #0F4C81)', label: 'HZL average' },
            {
              color: 'var(--fg-subtle)',
              label: `Industry (${INDUSTRY_AVG_CFP.toLocaleString()})`,
              dashed: true,
            },
          ]}
        >
          <LineChart
            labels={dailyLabels}
            series={[
              {
                label: 'HZL',
                values: cfpSeries,
                color: 'var(--color-accent, #0F4C81)',
                unit: 'kg CO₂e/t',
              },
              {
                label: 'Industry',
                values: cfpSeries.map(() => INDUSTRY_AVG_CFP),
                color: 'var(--fg-subtle)',
              },
            ]}
            ariaLabel="Daily average CFP, last 30 days"
          />
        </ChartCard>

        <ChartCard
          title="Recycled-content % · last 30 days"
          subtitle="Daily mean across issued passports"
          legend={[{ color: '#16a34a', label: 'Recycled %' }]}
        >
          <LineChart
            labels={dailyLabels}
            series={[
              {
                label: 'Recycled %',
                values: recycledSeries,
                color: '#16a34a',
                unit: '%',
              },
            ]}
            ariaLabel="Daily average recycled-content percent, last 30 days"
          />
        </ChartCard>
      </section>

      {/* ── Issuance band + brand mix ───────────────────────────────────── */}
      <section className="mb-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ChartCard
          title="Daily issuance volume"
          subtitle={`30-day cadence · ${ts30.reduce((s, p) => s + p.count, 0).toLocaleString()} passports total`}
          legend={[{ color: 'var(--color-gold, #b58c2a)', label: 'DPPs issued' }]}
        >
          <div className="flex h-48 items-end gap-1 px-2">
            {issuanceSeries.map((v, i) => {
              const max = Math.max(1, ...issuanceSeries)
              const h = (v / max) * 100
              return (
                <div
                  key={i}
                  className="group relative flex-1 rounded-t-[2px] bg-[var(--color-gold,#b58c2a)] transition-opacity hover:opacity-80"
                  style={{ height: `${h}%`, minHeight: v > 0 ? '2px' : '0' }}
                  title={`${ts30[i]?.date ?? ''}: ${v}`}
                />
              )
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--fg-subtle)]">
            <span>{ts30[0]?.date.slice(5)}</span>
            <span>{ts30[Math.floor(ts30.length / 2)]?.date.slice(5)}</span>
            <span>{ts30[ts30.length - 1]?.date.slice(5)}</span>
          </div>
        </ChartCard>

        <ChartCard title="Brand mix" subtitle={`${brandMix.length} brands · weighted by tonnage`}>
          {brandMix.length === 0 ? (
            <p className="text-[12px] text-[var(--fg-subtle)]">No issuance yet.</p>
          ) : (
            <ul className="space-y-3">
              {brandMix.slice(0, 5).map((b, i) => {
                const pct = (b.weight / totalWeight) * 100
                const palette = ['#0F4C81', '#b58c2a', '#16a34a', '#7c3aed', '#dc2626']
                const color = palette[i % palette.length]
                return (
                  <li key={b.brand}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px] text-[var(--fg-default)]">{b.brand}</span>
                      <span className="tabular font-mono text-[11px] text-[var(--fg-muted)]">
                        {pct.toFixed(1)}% · {b.count} DPP{b.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ChartCard>
      </section>

      {/* ── Operational signal ──────────────────────────────────────────── */}
      <section className="mb-10 grid gap-6 md:grid-cols-3">
        <SignalCard
          icon={Leaf}
          tone="success"
          headline={`${(((INDUSTRY_AVG_CFP - avgCfp) / INDUSTRY_AVG_CFP) * 100).toFixed(0)}% below industry`}
          subhead="On the strength of the Serentica 530 MW renewable PDA and EPD-published EcoZen process."
        />
        <SignalCard
          icon={Recycle}
          tone="info"
          headline={`${recycledPct.toFixed(1)}% recycled content`}
          subhead={`${Math.round(recycledTonnes).toLocaleString()} tonnes of secondary zinc/lead across the portfolio.`}
        />
        <SignalCard
          icon={ShieldCheck}
          tone="info"
          headline={`${activeVerifiers.length} verifier${activeVerifiers.length === 1 ? '' : 's'} active`}
          subhead={`${dependentDpps} passports currently cite an active credential. Trust list visible in /admin.`}
        />
      </section>

      {/* ── Live system signal ──────────────────────────────────────────── */}
      <section className="mb-10 grid gap-6 lg:grid-cols-3">
        <PipelineSignal
          label="Throughput · last 15 min"
          value={metrics?.issuedPerMinute ?? 0}
          suffix="/min"
          spark={metrics?.sparkline15min ?? []}
        />
        <PipelineSignal
          label="Pipeline success rate · 24h"
          value={(metrics?.successRatePct ?? 100).toFixed(1)}
          suffix="%"
          tone={(metrics?.successRatePct ?? 100) >= 99 ? 'success' : 'warn'}
        />
        <PipelineSignal
          label="Latency p95"
          value={
            metrics?.p95LatencySeconds == null
              ? '—'
              : metrics.p95LatencySeconds < 1
                ? (metrics.p95LatencySeconds * 1000).toFixed(0)
                : metrics.p95LatencySeconds.toFixed(2)
          }
          suffix={
            metrics?.p95LatencySeconds == null ? '' : metrics.p95LatencySeconds < 1 ? ' ms' : ' s'
          }
        />
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <ActionCard
          icon={TrendingDown}
          title="DPPs expiring in 90 days"
          count={0}
          href="/console/dpps?expiring=90"
        />
        <ActionCard
          icon={ShieldCheck}
          title="Verifier credentials expiring"
          count={
            registry.filter(
              (v) =>
                v.latestPeriodTo &&
                new Date(v.latestPeriodTo).getTime() < Date.now() + 90 * 24 * 3600 * 1000,
            ).length
          }
          href="/console/verifiers"
        />
        <ActionCard icon={Recycle} title="Open audit findings" count={0} href="/console/audit" />
      </section>
    </div>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string
  subtitle?: string
  legend?: { color: string; label: string; dashed?: boolean }[]
  children: React.ReactNode
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            {title}
          </p>
          {subtitle && <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{subtitle}</p>}
        </div>
        {legend && (
          <ul className="flex flex-wrap gap-3">
            {legend.map((l) => (
              <li
                key={l.label}
                className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]"
              >
                <span
                  className={`inline-block h-0.5 w-3 ${l.dashed ? 'border-t border-dashed' : ''}`}
                  style={{ background: l.dashed ? 'transparent' : l.color, borderColor: l.color }}
                />
                {l.label}
              </li>
            ))}
          </ul>
        )}
      </header>
      {children}
    </article>
  )
}

function SignalCard({
  icon: Icon,
  tone,
  headline,
  subhead,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  tone: 'success' | 'info'
  headline: string
  subhead: string
}) {
  const toneColor =
    tone === 'success' ? 'var(--color-green, #16a34a)' : 'var(--color-accent, #0F4C81)'
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
      <Icon className="h-5 w-5" style={{ color: toneColor }} />
      <p className="font-display mt-3 text-[24px] font-semibold leading-tight text-[var(--fg-default)]">
        {headline}
      </p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--fg-muted)]">{subhead}</p>
    </article>
  )
}

function PipelineSignal({
  label,
  value,
  suffix = '',
  spark,
  tone,
}: {
  label: string
  value: number | string
  suffix?: string
  spark?: number[]
  tone?: 'success' | 'warn'
}) {
  const accent =
    tone === 'success'
      ? 'var(--color-green, #16a34a)'
      : tone === 'warn'
        ? 'var(--color-amber, #d97706)'
        : 'var(--fg-default)'
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {label}
        </p>
        {spark && spark.length > 0 && <Sparkline values={spark} width={64} height={20} />}
      </div>
      <p
        className="tabular mt-2 font-mono text-[28px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {value}
        <span className="ml-1 text-[14px] font-normal text-[var(--fg-muted)]">{suffix}</span>
      </p>
    </article>
  )
}

function ActionCard({
  icon: Icon,
  title,
  count,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: number
  href: string
}) {
  const tone = count === 0 ? 'success' : count < 5 ? 'warn' : 'critical'
  const color =
    tone === 'success'
      ? 'var(--color-green, #16a34a)'
      : tone === 'warn'
        ? 'var(--color-amber, #d97706)'
        : 'var(--color-red, #dc2626)'
  return (
    <Link
      href={href as Route}
      className="group flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5 transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="min-w-0">
        <Icon className="h-4 w-4 text-[var(--fg-subtle)]" />
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {title}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className="tabular font-mono text-[28px] font-semibold leading-none"
            style={{ color }}
          >
            {count}
          </span>
          <span className="text-[12px] text-[var(--fg-muted)]">
            {count === 0 ? 'all clear' : count === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

function _withinThisMonth(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}
