import type { Route } from 'next'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

import { Badge } from '@dpp/ui'

import { LineChart } from '@/components/console/LineChart'
import { Sparkline } from '@/components/console/Sparkline'
import { fetchCarbonAggregate, fetchRecycledAggregate, listCustomerDpps } from '@/lib/customer-api'

export const revalidate = 30

const INDUSTRY_AVG_CFP = 3500 // kg CO₂e/t · IZA global zinc average (RLE)

// Customer-side targets · wired in v1.5 from procurement preferences. Today
// these are sensible defaults so the scorecard can render meaningful red/
// amber/green even on a freshly-installed tenant.
const TARGETS = {
  cfpKgCo2ePerTonne: 1200, // EcoZen-aligned (low-carbon zinc, kg CO₂e/t)
  recycledContentPct: 25,
  complianceCoveragePct: 95,
}

export default async function SupplierScorecardPage() {
  const [list, carbon, recycled] = await Promise.all([
    listCustomerDpps({ limit: 500 }),
    fetchCarbonAggregate(),
    fetchRecycledAggregate(),
  ])

  // Aggregate across received DPPs.
  const totalDpps = list.items.length
  const totalWeight = list.items.reduce((s, i) => s + i.weightKg, 0)
  const weightedCfp = totalWeight
    ? list.items.reduce((s, i) => s + i.cfpKgCo2ePerTonne * i.weightKg, 0) / totalWeight
    : 0
  const weightedRecycled = totalWeight
    ? list.items.reduce((s, i) => s + i.recycledContentPct * i.weightKg, 0) / totalWeight
    : 0
  const co2eAvoided =
    list.items.reduce(
      (s, i) => s + (i.weightKg / 1000) * (INDUSTRY_AVG_CFP - i.cfpKgCo2ePerTonne),
      0,
    ) / 1000

  // Per-brand performance breakdown (already an aggregate from the API).
  const byBrand = carbon.items
    .map((b) => {
      const r = recycled.items.find((rr) => rr.brand === b.brand)
      return {
        brand: b.brand,
        avgCfp: b.avgCfpKgCo2ePerTonne,
        minCfp: b.minCfpKgCo2ePerTonne,
        maxCfp: b.maxCfpKgCo2ePerTonne,
        recycledPct: r?.recycledPct ?? 0,
        embodiedTonnes: b.embodiedTonnesCo2e,
        count: b.count,
      }
    })
    .sort((a, b) => b.embodiedTonnes - a.embodiedTonnes)

  // 12-month synthetic trend · for v1.0 we approximate from issuedAt; v1.5
  // sources from the platform's customer-portal time series endpoint.
  const monthlyTrend = synthesiseMonthlyTrend(list.items, 12)
  const monthLabels = monthlyTrend.map((p) => p.label)
  const monthCfps = monthlyTrend.map((p) => p.avgCfp)
  const monthRecycled = monthlyTrend.map((p) => p.avgRecycled)

  // Risk scoring against targets.
  const cfpStatus = scoreAgainstTarget(weightedCfp, TARGETS.cfpKgCo2ePerTonne, 'lower')
  const recycledStatus = scoreAgainstTarget(weightedRecycled, TARGETS.recycledContentPct, 'higher')

  return (
    <div className="px-10 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Supplier scorecard
        </p>
        <h1 className="font-display mt-2 text-[36px] font-semibold leading-tight text-[var(--fg-default)]">
          {totalDpps} passport{totalDpps === 1 ? '' : 's'} received from HZL.
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-[var(--fg-muted)]">
          Performance against your procurement targets. Numbers are weighted by mass, so a
          high-volume brand dominates the headline. Set new targets in{' '}
          <Link href="/portal" className="text-[var(--color-accent)] hover:underline">
            portal preferences
          </Link>{' '}
          (v1.5).
        </p>
      </header>

      {/* Headline scorecard */}
      <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ScoreCard
          label="Weighted CFP"
          value={Math.round(weightedCfp).toLocaleString()}
          unit="kg CO₂e/t"
          target={`Target: ≤${TARGETS.cfpKgCo2ePerTonne.toLocaleString()}`}
          status={cfpStatus.tier}
          delta={`${cfpStatus.deltaPct >= 0 ? '+' : ''}${cfpStatus.deltaPct.toFixed(1)}% vs target`}
          context={`${(((INDUSTRY_AVG_CFP - weightedCfp) / INDUSTRY_AVG_CFP) * 100).toFixed(0)}% under industry baseline`}
          spark={monthCfps.map((v) => v ?? 0)}
        />
        <ScoreCard
          label="Recycled content"
          value={`${weightedRecycled.toFixed(1)}%`}
          target={`Target: ≥${TARGETS.recycledContentPct}%`}
          status={recycledStatus.tier}
          delta={`${recycledStatus.deltaPct >= 0 ? '+' : ''}${recycledStatus.deltaPct.toFixed(1)}% vs target`}
          context={`${Math.round((totalWeight / 1000) * (weightedRecycled / 100)).toLocaleString()} tonnes secondary zinc/lead`}
          spark={monthRecycled.map((v) => v ?? 0)}
        />
        <ScoreCard
          label="CO₂e avoided"
          value={`${Math.round(co2eAvoided).toLocaleString()}`}
          unit="tonnes"
          target={`vs IZA ${INDUSTRY_AVG_CFP.toLocaleString()} kg/t baseline`}
          status="success"
          context="Reportable in your scope-3 disclosure"
        />
      </section>

      {/* Trends */}
      <section className="mb-10 grid gap-6 lg:grid-cols-2">
        <ChartCard title="CFP trend · last 12 months" subtitle="Mass-weighted average per month">
          <LineChart
            labels={monthLabels}
            series={[
              {
                label: 'Weighted CFP',
                values: monthCfps,
                color: 'var(--color-accent, #0F4C81)',
              },
              {
                label: `Target ${TARGETS.cfpKgCo2ePerTonne}`,
                values: monthCfps.map(() => TARGETS.cfpKgCo2ePerTonne),
                color: 'var(--color-amber, #d97706)',
              },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Recycled content trend · last 12 months"
          subtitle="Mass-weighted % per month"
        >
          <LineChart
            labels={monthLabels}
            series={[
              {
                label: 'Recycled %',
                values: monthRecycled,
                color: '#16a34a',
              },
              {
                label: `Target ${TARGETS.recycledContentPct}%`,
                values: monthRecycled.map(() => TARGETS.recycledContentPct),
                color: 'var(--color-amber, #d97706)',
              },
            ]}
          />
        </ChartCard>
      </section>

      {/* Brand breakdown */}
      <section className="mb-10">
        <h2 className="font-display mb-3 text-[20px] font-semibold text-[var(--fg-default)]">
          Brand-level breakdown
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface-recessed)] text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Brand</th>
                <th className="px-5 py-3 text-right font-medium">DPPs</th>
                <th className="px-5 py-3 text-right font-medium">Avg CFP</th>
                <th className="px-5 py-3 text-right font-medium">CFP range</th>
                <th className="px-5 py-3 text-right font-medium">Recycled %</th>
                <th className="px-5 py-3 text-right font-medium">Embodied (t CO₂e)</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-divider)]">
              {byBrand.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-[14px] text-[var(--fg-subtle)]"
                  >
                    No DPPs received yet.
                  </td>
                </tr>
              )}
              {byBrand.map((b) => {
                const status = scoreAgainstTarget(b.avgCfp, TARGETS.cfpKgCo2ePerTonne, 'lower')
                return (
                  <tr key={b.brand} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-5 py-3 text-[var(--fg-default)]">{b.brand}</td>
                    <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                      {b.count}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                      {Math.round(b.avgCfp).toLocaleString()}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-mono text-[11px] text-[var(--fg-muted)]">
                      {Math.round(b.minCfp).toLocaleString()} –{' '}
                      {Math.round(b.maxCfp).toLocaleString()}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                      {b.recycledPct.toFixed(1)}%
                    </td>
                    <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                      {Math.round(b.embodiedTonnes).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge tier={status.tier} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 md:grid-cols-3">
        <ActionLink
          href="/portal/cbam"
          title="Generate CBAM declaration"
          subtitle="Embedded emissions per CN code, ready for the EU Registry"
        />
        <ActionLink
          href="/portal/exports"
          title="Export signed bundle"
          subtitle="Audit-ready ZIP with signed bodies + receipt"
        />
        <ActionLink
          href="/portal/webhooks"
          title="Subscribe to events"
          subtitle="Get pushed every new DPP, withdrawal, rollover"
        />
      </section>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

interface MonthlyPoint {
  label: string
  avgCfp: number | null
  avgRecycled: number | null
}

function synthesiseMonthlyTrend(
  items: {
    issuedAt: string | null
    cfpKgCo2ePerTonne: number
    recycledContentPct: number
    weightKg: number
  }[],
  months: number,
): MonthlyPoint[] {
  const now = new Date()
  const buckets: Map<string, { weightedCfp: number; weightedRecycled: number; weight: number }> =
    new Map()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, { weightedCfp: 0, weightedRecycled: 0, weight: 0 })
  }
  for (const item of items) {
    if (!item.issuedAt) continue
    const d = new Date(item.issuedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(key)
    if (b) {
      b.weightedCfp += item.cfpKgCo2ePerTonne * item.weightKg
      b.weightedRecycled += item.recycledContentPct * item.weightKg
      b.weight += item.weightKg
    }
  }
  return Array.from(buckets, ([k, v]) => ({
    label: k.slice(5), // MM
    avgCfp: v.weight ? v.weightedCfp / v.weight : null,
    avgRecycled: v.weight ? v.weightedRecycled / v.weight : null,
  }))
}

function scoreAgainstTarget(
  actual: number,
  target: number,
  better: 'lower' | 'higher',
): { tier: 'success' | 'warn' | 'critical'; deltaPct: number } {
  const deltaPct = ((actual - target) / target) * 100
  const onTrack = better === 'lower' ? actual <= target : actual >= target
  const close = better === 'lower' ? actual <= target * 1.1 : actual >= target * 0.9
  if (onTrack) return { tier: 'success', deltaPct }
  if (close) return { tier: 'warn', deltaPct }
  return { tier: 'critical', deltaPct }
}

function StatusBadge({ tier }: { tier: 'success' | 'warn' | 'critical' }) {
  if (tier === 'success')
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-green,#16a34a)]">
        <CheckCircle2 className="h-3 w-3" />
        On target
      </span>
    )
  if (tier === 'warn')
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-amber,#d97706)]">
        <AlertTriangle className="h-3 w-3" />
        Watch
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-[var(--color-red,#dc2626)]">
      <AlertTriangle className="h-3 w-3" />
      Off target
    </span>
  )
}

function ScoreCard({
  label,
  value,
  unit,
  target,
  status,
  delta,
  context,
  spark,
}: {
  label: string
  value: string | number
  unit?: string
  target?: string
  status: 'success' | 'warn' | 'critical'
  delta?: string
  context?: string
  spark?: number[]
}) {
  const accent =
    status === 'success'
      ? 'var(--color-green, #16a34a)'
      : status === 'warn'
        ? 'var(--color-amber, #d97706)'
        : 'var(--color-red, #dc2626)'
  const deltaIcon = delta?.startsWith('+') ? (
    <ArrowUpRight className="h-3 w-3" />
  ) : delta?.startsWith('-') ? (
    <ArrowDownRight className="h-3 w-3" />
  ) : null
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {label}
        </p>
        {spark && <Sparkline values={spark} width={64} height={20} stroke={accent} />}
      </div>
      <p
        className="tabular font-display mt-2 text-[36px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {value}
        {unit && (
          <span className="ml-1 text-[14px] font-normal text-[var(--fg-muted)]">{unit}</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {target && <span className="font-mono text-[10px] text-[var(--fg-subtle)]">{target}</span>}
        {delta && (
          <span
            className="inline-flex items-center gap-0.5 font-mono text-[10px]"
            style={{ color: accent }}
          >
            {deltaIcon}
            {delta}
          </span>
        )}
      </div>
      {context && <p className="mt-3 text-[12px] text-[var(--fg-muted)]">{context}</p>}
    </article>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
      <header className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {title}
        </p>
        {subtitle && <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{subtitle}</p>}
      </header>
      {children}
    </article>
  )
}

function ActionLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link
      href={href as Route}
      className="group flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5 transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="min-w-0">
        <p className="font-medium text-[var(--fg-default)]">{title}</p>
        <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{subtitle}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-1" />
    </Link>
  )
}
