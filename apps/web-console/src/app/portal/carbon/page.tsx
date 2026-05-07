import { Stat } from '@dpp/ui'

import { currentUser } from '@/lib/auth'
import { fetchCarbonAggregate } from '@/lib/customer-api'

export default async function CarbonPage() {
  const user = await currentUser()
  const data = await fetchCarbonAggregate()

  const total = data.items.reduce((s, i) => s + i.embodiedTonnesCo2e, 0)
  const totalCount = data.items.reduce((s, i) => s + i.count, 0)
  const overallAvg =
    data.items.length === 0
      ? 0
      : data.items.reduce((s, i) => s + i.avgCfpKgCo2ePerTonne * i.count, 0) /
        Math.max(totalCount, 1)
  const reductionVsIndustry = data.industryAverageKgCo2ePerTonne
    ? Math.round((1 - overallAvg / data.industryAverageKgCo2ePerTonne) * 100)
    : 0

  // Bars are scaled to the industry average so the visual is anchored to a
  // meaningful baseline, not to whichever brand happens to be highest.
  const max = data.industryAverageKgCo2ePerTonne

  return (
    <div className="px-10 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Zone 02 · Carbon Footprint Tracker
        </p>
        <h1 className="font-display mt-2 text-[36px] font-semibold leading-tight text-[var(--fg-default)]">
          Cradle-to-gate, brand by brand.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-[var(--fg-muted)]">
          Every value is verified by DNV under ISO 14067:2018. Use the embodied tonnes column to
          populate your downstream Scope 3 reporting.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat
          label="Industry average"
          value={data.industryAverageKgCo2ePerTonne.toLocaleString()}
          unit="kg/t"
        />
        <Stat
          label="Your weighted avg"
          value={Math.round(overallAvg).toLocaleString()}
          unit="kg/t"
          trend={
            reductionVsIndustry > 0
              ? { direction: 'down', label: `-${reductionVsIndustry}%` }
              : undefined
          }
        />
        <Stat
          label="Embodied CO₂e"
          value={Math.round(total).toLocaleString()}
          unit="tonnes"
          context="across all received DPPs"
        />
        <Stat label="DPPs analysed" value={totalCount.toLocaleString()} />
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Per-brand breakdown
        </p>
        <div className="mt-6 space-y-6">
          <BaselineBar
            label="Industry average"
            value={data.industryAverageKgCo2ePerTonne}
            max={max}
            tone="muted"
          />
          {data.items.map((item) => (
            <BrandBar key={item.brand} item={item} max={max} />
          ))}
        </div>

        <p className="mt-8 font-mono text-[11px] text-[var(--fg-subtle)]">
          kg CO₂e per tonne · cradle-to-gate · verified by DNV under ISO 14067
        </p>
      </section>

      <section className="mt-10 overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--surface-recessed)] text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Brand</th>
              <th className="px-5 py-3 text-right font-medium">Avg CFP (kg/t)</th>
              <th className="px-5 py-3 text-right font-medium">Range</th>
              <th className="px-5 py-3 text-right font-medium">DPPs</th>
              <th className="px-5 py-3 text-right font-medium">Mass (t)</th>
              <th className="px-5 py-3 text-right font-medium">Embodied CO₂e (t)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-divider)]">
            {data.items.map((it) => (
              <tr key={it.brand} className="hover:bg-[var(--surface-hover)]">
                <td className="px-5 py-3 text-[var(--fg-default)]">{it.brand}</td>
                <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                  {Math.round(it.avgCfpKgCo2ePerTonne).toLocaleString()}
                </td>
                <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-muted)]">
                  {Math.round(it.minCfpKgCo2ePerTonne).toLocaleString()}–
                  {Math.round(it.maxCfpKgCo2ePerTonne).toLocaleString()}
                </td>
                <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                  {it.count.toLocaleString()}
                </td>
                <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                  {Math.round(it.totalWeightKg / 1000).toLocaleString()}
                </td>
                <td className="tabular px-5 py-3 text-right font-mono text-[12px] text-[var(--fg-default)]">
                  {Math.round(it.embodiedTonnesCo2e).toLocaleString()}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-12 text-center text-[14px] text-[var(--fg-subtle)]"
                >
                  No DPPs received yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function BaselineBar({
  label,
  value,
  max,
  tone,
}: {
  label: string
  value: number
  max: number
  tone: 'muted' | 'default'
}) {
  const widthPct = (value / max) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="text-[var(--fg-muted)]">{label}</span>
        <span className="tabular font-mono text-[var(--fg-muted)]">
          {Math.round(value).toLocaleString()} kg/t
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full"
          style={{
            width: `${widthPct}%`,
            background: tone === 'muted' ? 'var(--color-graphite)' : 'var(--color-accent)',
          }}
        />
      </div>
    </div>
  )
}

function BrandBar({
  item,
  max,
}: {
  item: { brand: string; avgCfpKgCo2ePerTonne: number; count: number }
  max: number
}) {
  const widthPct = (item.avgCfpKgCo2ePerTonne / max) * 100
  // Tone selection · EcoZen gets the gold accent, CGG Jumbo gets green,
  // Refined Lead / others stay neutral. This is deliberately not data-driven
  // so the brand identity reads consistently with the public viewer.
  const colour =
    item.brand === 'EcoZen' || item.brand === 'EcoZen SHG 99.995'
      ? '#D4A574'
      : item.brand === 'CGG Jumbo'
        ? 'var(--color-green)'
        : 'var(--color-accent)'
  return (
    <div>
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="font-medium text-[var(--fg-default)]">
          HZL {item.brand}{' '}
          <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
            · {item.count} {item.count === 1 ? 'DPP' : 'DPPs'}
          </span>
        </span>
        <span className="tabular font-mono text-[var(--fg-default)]">
          {Math.round(item.avgCfpKgCo2ePerTonne).toLocaleString()} kg/t
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div className="h-full" style={{ width: `${widthPct}%`, background: colour }} />
      </div>
    </div>
  )
}
