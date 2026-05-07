import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, BarChart3, Beaker, FileDown, Leaf, ShieldCheck } from 'lucide-react'

import { Stat } from '@dpp/ui'

import { currentUser } from '@/lib/auth'
import {
  fetchCarbonAggregate,
  fetchComplianceSummary,
  fetchRecycledAggregate,
  listCustomerDpps,
} from '@/lib/customer-api'

interface ZoneCardProps {
  href: string
  title: string
  primary: string
  secondary: string
  icon: React.ComponentType<{ className?: string }>
}

/**
 * Customer Portal landing · five-zone command centre per SDD §5.3.2.
 * Each zone deep-links into its dedicated surface; the landing exists so
 * procurement officers can answer "what changed since last week" in one glance.
 */
export default async function PortalLanding() {
  const user = await currentUser()

  const [list, compliance, carbon, recycled] = await Promise.all([
    listCustomerDpps({ limit: 1 }),
    fetchComplianceSummary(),
    fetchCarbonAggregate(),
    fetchRecycledAggregate(),
  ])

  const totalCfp = carbon.items.reduce((s, i) => s + i.embodiedTonnesCo2e, 0) || 0
  const fullyCompliantPct = compliance.items.length
    ? Math.round(compliance.items.reduce((s, i) => s + i.coveragePct, 0) / compliance.items.length)
    : 0
  const lowestCfp = carbon.items.length
    ? Math.min(...carbon.items.map((i) => i.minCfpKgCo2ePerTonne))
    : null

  const zones: ZoneCardProps[] = [
    {
      href: '/portal/compliance',
      title: 'Compliance Dashboard',
      primary: `${fullyCompliantPct}%`,
      secondary: `coverage across ${compliance.items.length} regulations + certs`,
      icon: ShieldCheck,
    },
    {
      href: '/portal/carbon',
      title: 'Carbon Footprint Tracker',
      primary: lowestCfp ? `${(lowestCfp / 1000).toFixed(2)}` : '—',
      secondary: `kg CO₂e/kg · best-in-class verified by DNV`,
      icon: BarChart3,
    },
    {
      href: '/portal/recycled',
      title: 'Recycled Content Monitor',
      primary: `${recycled.weightedAvgRecycledPct.toFixed(1)}%`,
      secondary: `weighted-average across ${recycled.items.length} brands`,
      icon: Leaf,
    },
    {
      href: '/portal/exports',
      title: 'Audit-Ready Exports',
      primary: `${list.total.toLocaleString()}`,
      secondary: 'DPPs available for signed bundle export',
      icon: FileDown,
    },
    {
      href: '/portal/chemistry',
      title: 'Chemistry & MTC',
      primary: 'IS 209',
      secondary: 'IMDS-ready · per-batch zinc/lead chemistry',
      icon: Beaker,
    },
  ]

  return (
    <div className="px-10 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
            Procurement command centre
          </p>
          <h1 className="font-display mt-2 text-[36px] font-semibold leading-tight text-[var(--fg-default)]">
            Welcome back, {user.displayName.split(' ')[0]}.
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-[var(--fg-muted)]">
            Every zinc & lead passport you receive · verified, signed, exportable. Five zones, one
            source of truth for ESG reporting and Tier 1 audit.
          </p>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="DPPs received" value={list.total.toLocaleString()} />
        <Stat
          label="Embodied CO₂e"
          value={Math.round(totalCfp).toLocaleString()}
          unit="tonnes"
          context="across all received DPPs"
        />
        <Stat
          label="Avg recycled content"
          value={`${recycled.weightedAvgRecycledPct.toFixed(1)}%`}
          context="weighted by mass"
        />
        <Stat
          label="Compliance coverage"
          value={`${fullyCompliantPct}%`}
          context={`${compliance.items.length} programmes tracked`}
        />
      </section>

      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {zones.map((z) => (
          <ZoneCard key={z.href} {...z} />
        ))}
      </section>
    </div>
  )
}

function ZoneCard({ href, title, primary, secondary, icon: Icon }: ZoneCardProps) {
  return (
    <Link
      href={href as Route}
      className="group flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-6 transition-colors hover:border-[var(--color-accent)]"
    >
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-[var(--color-accent)]" />
        <ArrowRight className="h-4 w-4 text-[var(--fg-subtle)] transition-transform group-hover:translate-x-1" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {title}
      </p>
      <p className="tabular font-display text-[40px] font-semibold leading-none text-[var(--fg-default)]">
        {primary}
      </p>
      <p className="text-[13px] text-[var(--fg-muted)]">{secondary}</p>
    </Link>
  )
}
