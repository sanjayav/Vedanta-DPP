import {
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Inbox,
  Recycle,
  ShieldAlert,
  Truck,
} from 'lucide-react'

import { EmptyState } from '@dpp/ui'

import { AnimatedKpi } from '@/components/console/AnimatedKpi'
import { currentUser } from '@/lib/auth'
import { listDpps } from '@/lib/api'
import { hasPermission, TENANT_ROLES, type TenantRole } from '@/lib/rbac'

import { InitiateTransferDialog } from './InitiateTransferDialog'
import { TransferActivityFeed, TransferBoard } from './TransferBoard'
import { listTransfers, type TransferKind, type TransferState } from './store'

export const revalidate = 30

interface PageProps {
  searchParams: Promise<{ state?: string; kind?: string; q?: string }>
}

const KIND_LABEL: Record<TransferKind, string> = {
  ownership: 'Ownership',
  custody: 'Custody',
  end_of_life: 'End-of-Life',
}

export default async function OwnershipTransfersPage({ searchParams }: PageProps) {
  const [me, params, dpps] = await Promise.all([
    currentUser(),
    searchParams,
    listDpps({ limit: 100 }),
  ])
  const myRole: TenantRole = (TENANT_ROLES as readonly string[]).includes(me.role)
    ? (me.role as TenantRole)
    : ('tenant_auditor' as TenantRole)
  const canInitiate = hasPermission(myRole, 'publish_passport')
  const stateFilter = (params.state ?? '') as TransferState | ''
  const kindFilter = (params.kind ?? '') as TransferKind | ''
  const query = (params.q ?? '').trim().toLowerCase()

  const allTransfers = listTransfers()
  const filtered = allTransfers.filter((t) => {
    if (stateFilter && t.state !== stateFilter) return false
    if (kindFilter && t.kind !== kindFilter) return false
    if (query) {
      const blob =
        `${t.passportUpi} ${t.productLabel} ${t.toOrg} ${t.fromOrg} ${t.reference ?? ''}`.toLowerCase()
      if (!blob.includes(query)) return false
    }
    return true
  })

  const counts = {
    pending: allTransfers.filter((t) => t.state === 'pending_countersign').length,
    settled: allTransfers.filter((t) => t.state === 'settled').length,
    disputed: allTransfers.filter((t) => t.state === 'disputed').length,
    rejected: allTransfers.filter((t) => t.state === 'rejected').length,
  }
  const settledRate =
    allTransfers.length > 0
      ? Math.round((counts.settled / allTransfers.length) * 100)
      : 0

  const passportOptions = dpps.items.map((d) => ({
    upi: d.upi,
    label: `${d.brand} · ${d.alloy} (${humanise(d.form)})`,
  }))

  return (
    <div className="ot-page min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <style>{OT_PAGE_CSS}</style>

      <div className="mx-auto max-w-[1400px] px-7 py-7">
        {/* ── Hero band ────────────────────────────────────────────── */}
        <header className="ot-hero">
          <div className="ot-hero__main">
            <div className="ot-hero__crest" aria-hidden>
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="ot-hero__eyebrow">Chain of custody</p>
              <h1 className="ot-hero__title">Ownership Transfers</h1>
              <p className="ot-hero__sub">
                Per-batch hand-offs between BPN-identified parties. Each transfer signs a
                Verifiable Credential to the recipient&apos;s DID and writes to the audit log.
              </p>
            </div>
          </div>
          <div className="ot-hero__cta">
            {counts.pending > 0 && (
              <span className="ot-hero__pending" aria-live="polite">
                <span className="ot-hero__pending-dot" aria-hidden />
                <span>
                  <strong>{counts.pending}</strong> awaiting countersign
                </span>
              </span>
            )}
            {canInitiate ? (
              <InitiateTransferDialog passports={passportOptions} myEmail={me.email} />
            ) : (
              <span
                className="ot-hero__btn-disabled"
                title="Requires a role with publish_passport"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Initiate Transfer
              </span>
            )}
          </div>
        </header>

        {/* ── KPI band · animated counters ──────────────────────────── */}
        <section className="ot-kpis">
          <KpiTile
            tone="amber"
            icon={<Clock className="h-4 w-4" />}
            label="Pending countersign"
            value={String(counts.pending)}
            hint="Recipient action needed"
            delay={0}
          />
          <KpiTile
            tone="green"
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Settled"
            value={String(counts.settled)}
            hint={`${settledRate}% of all transfers`}
            delay={0.05}
          />
          <KpiTile
            tone="red"
            icon={<ShieldAlert className="h-4 w-4" />}
            label="Disputed"
            value={String(counts.disputed)}
            hint="Open with verifier"
            delay={0.1}
          />
          <KpiTile
            tone="muted"
            icon={<Inbox className="h-4 w-4" />}
            label="Total transfers"
            value={String(allTransfers.length)}
            hint="Lifetime"
            delay={0.15}
          />
        </section>

        {/* ── Filter bar ──────────────────────────────────────────── */}
        <form className="ot-filters" action="/console/ownership-transfers" method="get">
          <div className="ot-filters__search">
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search by recipient, UPI, PO, or product…"
            />
          </div>
          <FilterChipRow
            paramKey="kind"
            current={kindFilter}
            otherParam="state"
            otherValue={stateFilter}
            query={query}
            options={[
              { value: '', label: 'All kinds' },
              { value: 'ownership', label: KIND_LABEL.ownership, glyph: <ArrowRightLeft className="h-3 w-3" /> },
              { value: 'custody', label: KIND_LABEL.custody, glyph: <Truck className="h-3 w-3" /> },
              { value: 'end_of_life', label: KIND_LABEL.end_of_life, glyph: <Recycle className="h-3 w-3" /> },
            ]}
          />
        </form>

        {/* ── Status board ─────────────────────────────────────────── */}
        <section className="mt-2">
          {filtered.length === 0 && allTransfers.length > 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No transfers match these filters"
              description={
                <>
                  Clear the search or pick a different state/kind chip above to see the full
                  ledger.
                </>
              }
              tone="info"
              className="my-6"
            />
          ) : allTransfers.length === 0 ? (
            <EmptyState
              icon={<ArrowRightLeft className="h-5 w-5" />}
              title="No transfers yet"
              description="Initiate the first ownership transfer · the recipient countersigns and a Verifiable Credential is issued to their DID."
              tone="info"
              className="my-6"
            />
          ) : (
            <TransferBoard transfers={filtered} canAct={canInitiate} />
          )}
        </section>

        {/* ── Activity timeline ────────────────────────────────────── */}
        {allTransfers.length > 0 && (
          <section className="ot-activity-section">
            <header className="ot-activity-section__head">
              <p className="ot-activity-section__eyebrow">Recent activity</p>
              <span className="ot-activity-section__hint">Last 10 events</span>
            </header>
            <TransferActivityFeed transfers={allTransfers} />
          </section>
        )}
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function KpiTile({
  tone,
  icon,
  label,
  value,
  hint,
  delay,
}: {
  tone: 'amber' | 'green' | 'red' | 'muted'
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  delay: number
}) {
  return (
    <div className={`ot-kpi ot-kpi--${tone}`}>
      <div className="ot-kpi__head">
        <span className={`ot-kpi__icon ot-kpi__icon--${tone}`}>{icon}</span>
        <p className="ot-kpi__label">{label}</p>
      </div>
      <div className="ot-kpi__value">
        <AnimatedKpi label="" value={value} hint={hint} delay={delay} />
      </div>
    </div>
  )
}

function FilterChipRow({
  paramKey,
  current,
  otherParam,
  otherValue,
  query,
  options,
}: {
  paramKey: 'state' | 'kind'
  current: string
  otherParam: 'state' | 'kind'
  otherValue: string
  query: string
  options: { value: string; label: string; glyph?: React.ReactNode }[]
}) {
  return (
    <div className="ot-filters__chips">
      {options.map((opt) => {
        const q = new URLSearchParams()
        if (opt.value) q.set(paramKey, opt.value)
        if (otherValue) q.set(otherParam, otherValue)
        if (query) q.set('q', query)
        const isActive = current === opt.value
        const url = q.toString()
          ? `/console/ownership-transfers?${q.toString()}`
          : '/console/ownership-transfers'
        return (
          <a
            key={opt.value || 'all'}
            href={url}
            className={`ot-chip${isActive ? ' is-active' : ''}`}
          >
            {opt.glyph}
            <span>{opt.label}</span>
          </a>
        )
      })}
    </div>
  )
}

function humanise(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── styles ───────────────────────────────────────────────────────────────

const OT_PAGE_CSS = `
.ot-hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 28px 28px 26px;
  margin: 0 -28px 24px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.08), transparent 55%),
    radial-gradient(circle at 100% 0%, rgba(217,119,6,0.06), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, var(--surface-canvas) 100%);
  border-bottom: 1px solid var(--surface-divider);
}
@media (min-width: 980px) {
  .ot-hero { grid-template-columns: 1fr auto; align-items: center; }
}

.ot-hero__main { display: flex; align-items: flex-start; gap: 16px; min-width: 0; }
.ot-hero__crest {
  display: grid; place-items: center;
  width: 52px; height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-accent, #0F4C81), #4F8FC7);
  color: #ffffff;
  flex-shrink: 0;
  box-shadow:
    0 12px 28px -10px rgba(15,76,129,0.45),
    0 0 0 1px rgba(15,76,129,0.15) inset;
}
.ot-hero__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.ot-hero__title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 600;
  letter-spacing: -0.014em;
  color: var(--fg-default);
  line-height: 1.1;
}
.ot-hero__sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 620px;
  line-height: 1.55;
}

.ot-hero__cta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.ot-hero__pending {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 9999px;
  border: 1px solid rgba(217,119,6,0.30);
  background: rgba(254,243,199,0.50);
  color: #92400E;
  font-size: 12px;
  font-weight: 500;
}
.ot-hero__pending strong {
  font-family: var(--font-mono);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-right: 2px;
}
.ot-hero__pending-dot {
  position: relative;
  width: 8px; height: 8px;
  border-radius: 9999px;
  background: #D97706;
}
.ot-hero__pending-dot::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 9999px;
  background: rgba(217,119,6,0.40);
  animation: ot-hero-pulse 1.6s ease-out infinite;
}
@keyframes ot-hero-pulse {
  0%   { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ot-hero__pending-dot::after { animation: none; }
}

.ot-hero__btn-disabled {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border: 1px solid var(--surface-border);
  border-radius: 9px;
  font-size: 12px;
  color: var(--fg-subtle);
  cursor: not-allowed;
  background: var(--surface-canvas);
}

/* KPI band */
.ot-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.ot-kpi {
  position: relative;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  transition: border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.ot-kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 24px -16px rgba(15,23,42,0.20);
  border-color: var(--surface-border-strong, var(--surface-border));
}
.ot-kpi::before {
  /* tier-tinted stripe at top */
  content: '';
  position: absolute;
  top: 0; left: 16px; right: 16px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--kpi-accent, #94A3B8);
  opacity: 0.85;
}
.ot-kpi--amber  { --kpi-accent: #D97706; }
.ot-kpi--green  { --kpi-accent: #16A34A; }
.ot-kpi--red    { --kpi-accent: #DC2626; }
.ot-kpi--muted  { --kpi-accent: #94A3B8; }

.ot-kpi__head {
  display: flex; align-items: center; gap: 10px;
}
.ot-kpi__icon {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--surface-hover);
  color: var(--fg-muted);
}
.ot-kpi__icon--amber { background: rgba(217,119,6,0.14); color: #B45309; }
.ot-kpi__icon--green { background: rgba(22,163,74,0.10); color: #16A34A; }
.ot-kpi__icon--red   { background: rgba(220,38,38,0.10); color: #B91C1C; }
.ot-kpi__icon--muted { background: var(--surface-hover); color: var(--fg-muted); }
.ot-kpi__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.ot-kpi__value {
  /* AnimatedKpi has its own label; we hide the label slot since it's empty */
}
.ot-kpi__value :global(.tabular-nums) {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.014em;
  line-height: 1;
}

/* Filters */
.ot-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
}
.ot-filters__search {
  flex: 1 1 280px;
  min-width: 240px;
}
.ot-filters__search input {
  width: 100%;
  height: 36px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  font-size: 13px;
  color: var(--fg-default);
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
}
.ot-filters__search input:focus {
  border-color: var(--color-accent, #0F4C81);
  background: var(--surface-page);
  box-shadow: 0 0 0 3px rgba(15,76,129,0.10);
}
.ot-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ot-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fg-muted);
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.ot-chip:hover { background: var(--surface-hover); color: var(--fg-default); }
.ot-chip.is-active {
  background: var(--color-accent, #0F4C81);
  color: #ffffff;
  border-color: var(--color-accent, #0F4C81);
}

/* Activity */
.ot-activity-section {
  margin-top: 18px;
  padding: 18px 20px 16px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
}
.ot-activity-section__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.ot-activity-section__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.ot-activity-section__hint {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-subtle);
  letter-spacing: 0.04em;
}
`
