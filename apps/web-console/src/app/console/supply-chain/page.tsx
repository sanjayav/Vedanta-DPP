import { Badge } from '@dpp/ui'

export const revalidate = 30

/* ── partner registry ───────────────────────────────────────────────────
 * Anchored to HZL Sustainability Report FY 2024-25 p5: 6 mining assets +
 * 4 smelter / refinery / power assets in Rajasthan and Uttarakhand. Plus
 * recyclers (zinc + lead secondary streams) and auditors / verifiers.
 */
const PARTNERS = [
  // ── Mines (6) ────────────────────────────────────────────────────────
  {
    id: 'p-mine-ram',
    name: 'Rampura Agucha Mine',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 100,
    passportsCovered: 24,
    tags: ["World's Largest Zinc Mine", 'Bhilwara, Rajasthan', '4,000 KLD Water Plant'],
    lastUpdated: '2026-04-28',
  },
  {
    id: 'p-mine-skm',
    name: 'Sindesar Khurd Mine',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 92,
    passportsCovered: 24,
    tags: ['Underground Mining', "India's first BEV fleet", 'Rajsamand'],
    lastUpdated: '2026-04-25',
  },
  {
    id: 'p-mine-rdm',
    name: 'Rajpura Dariba Mine',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 96,
    passportsCovered: 18,
    tags: ['Scope-1 Water Positive', 'NITI Aayog certified', 'Rajsamand'],
    lastUpdated: '2026-04-22',
  },
  {
    id: 'p-mine-bkm',
    name: 'Bamnia Kalan Mine',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'configuring' as const,
    coverage: 0,
    passportsCovered: 0,
    tags: ['Early stage', 'Rajsamand', 'Capacity ramp'],
    lastUpdated: '2026-03-30',
  },
  {
    id: 'p-mine-zaw',
    name: 'Zawar Mines',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 88,
    passportsCovered: 12,
    tags: ['Dry Tailings Plant', 'Udaipur', '13 Mm³ water recovery'],
    lastUpdated: '2026-04-20',
  },
  {
    id: 'p-mine-kay',
    name: 'Kayad Mine',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 90,
    passportsCovered: 9,
    tags: ['Ajmer', 'Miyawaki plantation site'],
    lastUpdated: '2026-04-18',
  },

  // ── Smelters / Refineries (4) ───────────────────────────────────────
  {
    id: 'p-smelter-cha',
    name: 'Chanderiya Lead-Zinc Smelter',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 100,
    passportsCovered: 18,
    tags: ["World's Largest Single-Location Zn-Pb Smelter", 'RLE + ISP', 'Chittorgarh'],
    lastUpdated: '2026-05-01',
  },
  {
    id: 'p-smelter-dar',
    name: 'Dariba Smelting Complex',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 95,
    passportsCovered: 14,
    tags: ['Hydrometallurgical RLE', 'Dry Tailings Plant', 'Rajsamand'],
    lastUpdated: '2026-04-30',
  },
  {
    id: 'p-smelter-deb',
    name: 'Debari Zinc Smelter',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 90,
    passportsCovered: 8,
    tags: ['Cellhouse rating 7.16 (FY25)', 'Debari, Rajasthan'],
    lastUpdated: '2026-04-26',
  },
  {
    id: 'p-refinery-pmp',
    name: 'Pantnagar Metal Plant',
    type: 'Supplier' as const,
    domain: 'hzlindia.com',
    status: 'active' as const,
    coverage: 100,
    passportsCovered: 4,
    tags: ['Silver refinery', '100% Green Power', 'Rudrapur, Uttarakhand'],
    lastUpdated: '2026-04-29',
  },

  // ── Recyclers ───────────────────────────────────────────────────────
  {
    id: 'p-recycler-binani',
    name: 'Binani Zinc Recycling',
    type: 'Recycler' as const,
    domain: 'binaniindustries.com',
    status: 'active' as const,
    coverage: 78,
    passportsCovered: 6,
    tags: ['Post-Consumer Scrap', 'EAF dust → Waelz kiln'],
    lastUpdated: '2026-04-20',
  },
  {
    id: 'p-recycler-gravita',
    name: 'Gravita Lead Recycling',
    type: 'Recycler' as const,
    domain: 'gravitaindia.com',
    status: 'pending' as const,
    coverage: 0,
    passportsCovered: 0,
    tags: ['Closed-Loop Pb-Acid', 'Battery scrap recovery'],
    lastUpdated: '2026-04-15',
  },
  {
    id: 'p-recycler-ecobounty',
    name: 'EcoBounty (Jarosite to Construction)',
    type: 'Recycler' as const,
    domain: 'ecobounty.com',
    status: 'configuring' as const,
    coverage: 0,
    passportsCovered: 0,
    tags: ['R&D MoU', 'Jarosite → cement additives'],
    lastUpdated: '2026-04-10',
  },
  {
    id: 'p-recycler-vexl',
    name: 'VEXL Environ Projects',
    type: 'Recycler' as const,
    domain: 'vexl.in',
    status: 'configuring' as const,
    coverage: 0,
    passportsCovered: 0,
    tags: ['Pilot plant MoU', 'Smelter waste recovery'],
    lastUpdated: '2026-04-05',
  },

  // ── Auditors / Verifiers ────────────────────────────────────────────
  {
    id: 'p-auditor-srb',
    name: 'S. R. Batliboi & Co. LLP',
    type: 'Auditor' as const,
    domain: 'ey.com',
    status: 'active' as const,
    coverage: 100,
    passportsCovered: 24,
    tags: ['ISAE 3000 (Revised)', 'Sustainability Report assurance'],
    lastUpdated: '2026-09-26',
  },
  {
    id: 'p-auditor-dnv',
    name: 'DNV Business Assurance',
    type: 'Auditor' as const,
    domain: 'dnv.com',
    status: 'active' as const,
    coverage: 100,
    passportsCovered: 24,
    tags: ['ISO 14067:2018', 'EPD-IES-0006472:001 (EcoZen)'],
    lastUpdated: '2026-05-02',
  },
  {
    id: 'p-auditor-bv',
    name: 'Bureau Veritas',
    type: 'Auditor' as const,
    domain: 'bureauveritas.com',
    status: 'configuring' as const,
    coverage: 0,
    passportsCovered: 0,
    tags: ['CBAM Verification', 'BIS IS 209 / IS 27'],
    lastUpdated: '2026-04-18',
  },
]

type PartnerType = 'All' | 'Supplier' | 'Recycler' | 'Auditor'

interface PageProps {
  searchParams: Promise<{ type?: string }>
}

export default async function SupplyChainPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filterType = (params.type ?? 'All') as PartnerType

  const activePartners = PARTNERS.filter((p) => p.status === 'active')
  const avgCoverage =
    activePartners.length > 0
      ? Math.round(activePartners.reduce((s, p) => s + p.coverage, 0) / activePartners.length)
      : 0
  const openGaps = PARTNERS.filter((p) => p.status === 'active' && p.coverage < 100).length
  const totalPassports = activePartners.reduce((s, p) => s + p.passportsCovered, 0)

  const filtered = filterType === 'All' ? PARTNERS : PARTNERS.filter((p) => p.type === filterType)

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-baseline justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Value chain traceability
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            Supply Chain
          </h1>
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            Upstream suppliers, end-of-life recyclers, and conformity auditors.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-8 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]">
            Refresh
          </button>
          <button className="h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white hover:opacity-90">
            + Invite Partner
          </button>
        </div>
      </header>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Active Partners"
          value={activePartners.length}
          sub={`of ${PARTNERS.length} total`}
          tone="accent"
        />
        <KpiCard
          label="Avg Data Coverage"
          value={`${avgCoverage}%`}
          sub="across active partners"
          tone="green"
        />
        <KpiCard
          label="Open Data Gaps"
          value={openGaps}
          sub="partners with missing EU data"
          tone={openGaps > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Passports Covered"
          value={totalPassports}
          sub="with partner data"
          tone="green"
        />
      </section>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {(['All', 'Supplier', 'Recycler', 'Auditor'] as PartnerType[]).map((t) => (
          <a
            key={t}
            href={t === 'All' ? '/console/supply-chain' : `/console/supply-chain?type=${t}`}
            className={`rounded-[var(--radius-pill)] px-4 py-1.5 text-[12px] font-medium transition-colors ${
              filterType === t
                ? 'bg-[var(--color-accent)] text-white'
                : 'border border-[var(--surface-border)] text-[var(--fg-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]'
            }`}
          >
            {t === 'All' ? 'All' : `${t}s`}
          </a>
        ))}
        <div className="ml-auto flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] px-3 text-[12px] text-[var(--fg-subtle)]">
          Search by name, domain, or category…
        </div>
      </div>

      {/* ── Partner list ───────────────────────────────────────────────── */}
      <ul className="space-y-3">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 py-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold text-[var(--fg-default)]">
                    {p.name}
                  </span>
                  <Badge tone="neutral">{p.type}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
                  <span>{p.domain}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[var(--radius-pill)] bg-[var(--surface-hover)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <Badge
                  tone={
                    p.status === 'active'
                      ? 'success'
                      : p.status === 'configuring'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {p.status}
                </Badge>
                <div className="min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p.coverage}%`,
                          background:
                            p.coverage === 100
                              ? 'var(--color-green, #16a34a)'
                              : p.coverage > 50
                                ? 'var(--color-amber, #d97706)'
                                : 'var(--color-red, #dc2626)',
                        }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-[var(--fg-muted)]">
                      {p.coverage}%
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--fg-subtle)]">
                    {p.passportsCovered} passports
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-2 font-mono text-[10px] text-[var(--fg-subtle)]">
              Last updated: {p.lastUpdated}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Building blocks ──────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub: string
  tone: 'accent' | 'green' | 'amber' | 'red'
}) {
  const color =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'green'
        ? 'var(--color-green, #16a34a)'
        : tone === 'amber'
          ? 'var(--color-amber, #d97706)'
          : 'var(--color-red, #dc2626)'
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-[28px] font-semibold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{sub}</p>
    </article>
  )
}
