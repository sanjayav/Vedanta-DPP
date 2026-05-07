import { ArrowRightLeft, CheckCircle2, Clock, Recycle, ShieldAlert, Truck } from 'lucide-react'

import { matchDemoPassport } from '@dpp/ui'

import { currentUser } from '@/lib/auth'
import { listDpps } from '@/lib/api'
import { hasPermission, TENANT_ROLES, type TenantRole } from '@/lib/rbac'

import { InitiateTransferDialog } from './InitiateTransferDialog'
import { RowActions } from './RowActions'
import { listTransfers, type Transfer, type TransferKind, type TransferState } from './store'

export const revalidate = 30

interface PageProps {
  searchParams: Promise<{ state?: string; kind?: string; q?: string }>
}

const STATE_DEFINITIONS: { key: TransferState; label: string; tone: StateTone }[] = [
  { key: 'pending_countersign', label: 'Pending countersign', tone: 'amber' },
  { key: 'settled', label: 'Settled', tone: 'ok' },
  { key: 'rejected', label: 'Rejected', tone: 'muted' },
  { key: 'disputed', label: 'Disputed', tone: 'danger' },
  { key: 'draft', label: 'Draft', tone: 'muted' },
]

type StateTone = 'ok' | 'amber' | 'muted' | 'danger'

const KIND_LABEL: Record<TransferKind, string> = {
  ownership: 'Ownership',
  custody: 'Custody',
  end_of_life: 'End-of-Life',
}

const KIND_GLYPH: Record<TransferKind, React.ReactNode> = {
  ownership: <ArrowRightLeft className="h-3.5 w-3.5" />,
  custody: <Truck className="h-3.5 w-3.5" />,
  end_of_life: <Recycle className="h-3.5 w-3.5" />,
}

export default async function OwnershipTransfersPage({ searchParams }: PageProps) {
  // Fan out the four IO-bound calls in parallel · cookie read, search params,
  // DPP list, transfer list. Sequencing them was the largest chunk of latency
  // on this page.
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

  const transfers = listTransfers()
  const filtered = transfers.filter((t) => {
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
    pending: transfers.filter((t) => t.state === 'pending_countersign').length,
    settled: transfers.filter((t) => t.state === 'settled').length,
    disputed: transfers.filter((t) => t.state === 'disputed').length,
    rejected: transfers.filter((t) => t.state === 'rejected').length,
  }

  const byKind: Record<TransferKind, number> = {
    ownership: transfers.filter((t) => t.kind === 'ownership').length,
    custody: transfers.filter((t) => t.kind === 'custody').length,
    end_of_life: transfers.filter((t) => t.kind === 'end_of_life').length,
  }

  // Live passport options for the "Initiate" dialog dropdown · already
  // fetched in parallel above with the user + searchParams.
  const passportOptions = dpps.items.map((d) => ({
    upi: d.upi,
    label: `${d.brand} · ${d.alloy} (${humanise(d.form)})`,
  }))

  return (
    <div className="ot-page min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <style>{OT_PAGE_CSS}</style>

      <div className="mx-auto max-w-[1320px] px-7 py-7">
        <header className="ot-page__header">
          <div className="ot-page__header-block">
            <div className="ot-page__avatar" aria-hidden>
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="ot-page__title">Ownership Transfers</h1>
              <p className="ot-page__subtitle">
                Per-batch chain-of-custody. Each transfer signs a Verifiable Credential to the
                recipient&apos;s DID and writes to the audit log.
              </p>
            </div>
          </div>
          <div className="ot-page__header-actions">
            {canInitiate ? (
              <InitiateTransferDialog passports={passportOptions} myEmail={me.email} />
            ) : (
              <span
                className="ot-page__btn ot-page__btn--disabled"
                title="Requires a role with publish_passport"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Initiate Transfer
              </span>
            )}
          </div>
        </header>

        <section className="ot-page__kpi-grid">
          <KpiCard
            label="Pending countersign"
            value={counts.pending}
            sub="Awaiting recipient signature"
            icon={<Clock className="h-4 w-4" />}
            tone={counts.pending > 0 ? 'amber' : undefined}
          />
          <KpiCard
            label="Settled this period"
            value={counts.settled}
            sub="Verifiable credentials issued"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="ok"
          />
          <KpiCard
            label="Disputed"
            value={counts.disputed}
            sub="Open with verifier"
            icon={<ShieldAlert className="h-4 w-4" />}
            tone={counts.disputed > 0 ? 'danger' : undefined}
          />
          <KpiCard
            label="Rejected / cancelled"
            value={counts.rejected}
            sub="Closed without settlement"
            icon={<Clock className="h-4 w-4" />}
          />
        </section>

        <section className="ot-page__mix">
          <div className="ot-page__mix-card">
            <p className="ot-page__mix-label">Transfer mix · last 30 days</p>
            <Donut byKind={byKind} />
          </div>

          <form className="ot-page__filters" action="/console/ownership-transfers" method="get">
            <div className="ot-page__search">
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search by recipient, passport UPI, PO, or product…"
                className="ot-page__search-input"
              />
            </div>
            <div className="ot-page__chips">
              <FilterPill
                label="All states"
                active={!stateFilter}
                href={hrefFor('state', '', { kindFilter, query })}
                tone="muted"
              />
              {STATE_DEFINITIONS.map((s) => (
                <FilterPill
                  key={s.key}
                  label={s.label}
                  active={stateFilter === s.key}
                  href={hrefFor('state', s.key, { kindFilter, query })}
                  tone={s.tone}
                />
              ))}
            </div>
            <div className="ot-page__chips">
              <FilterPill
                label="All kinds"
                active={!kindFilter}
                href={hrefFor('kind', '', { stateFilter, query })}
                tone="muted"
              />
              {(['ownership', 'custody', 'end_of_life'] as TransferKind[]).map((k) => (
                <FilterPill
                  key={k}
                  label={KIND_LABEL[k]}
                  active={kindFilter === k}
                  href={hrefFor('kind', k, { stateFilter, query })}
                  tone={k === 'ownership' ? 'accent' : k === 'custody' ? 'amber' : 'ok'}
                  glyph={KIND_GLYPH[k]}
                />
              ))}
            </div>
          </form>
        </section>

        <section className="ot-page__tablecard">
          <div className="overflow-x-auto">
            <table className="ot-page__table">
              <thead>
                <tr>
                  <Th>State</Th>
                  <Th>Kind</Th>
                  <Th>Passport</Th>
                  <Th>From</Th>
                  <Th>Recipient</Th>
                  <Th>Reference</Th>
                  <Th>Initiated</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-[13px] text-[var(--fg-subtle)]"
                    >
                      No transfers match these filters.
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <TransferRow key={t.id} t={t} canAct={canInitiate} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function TransferRow({ t, canAct }: { t: Transfer; canAct: boolean }) {
  const stateInfo = STATE_DEFINITIONS.find((s) => s.key === t.state) ?? {
    label: humanise(t.state),
    tone: 'muted' as StateTone,
  }
  const demo = matchDemoPassport(t.passportUpi)
  // Demo bodies carry the public-viewer path `/dpp-assets/products/...`;
  // rewrite to the console's `/products/...` mount.
  const rawImage = (demo?.body.media as Record<string, unknown> | undefined)?.productImage as
    | string
    | undefined
  const productImage = rawImage?.replace(/^\/dpp-assets\/products\//, '/products/')

  return (
    <tr className="ot-row">
      <Td>
        <span className={`ot-row__state ot-row__state--${stateInfo.tone}`}>
          <span className="ot-row__state-dot" />
          {stateInfo.label}
        </span>
      </Td>
      <Td>
        <span className={`ot-row__kind ot-row__kind--${t.kind}`}>
          {KIND_GLYPH[t.kind]}
          {KIND_LABEL[t.kind]}
        </span>
      </Td>
      <Td>
        <div className="ot-row__passport">
          {productImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImage} alt="" className="ot-row__passport-img" loading="lazy" />
          )}
          <div className="min-w-0">
            <p className="ot-row__passport-label">{t.productLabel}</p>
            <p className="ot-row__passport-upi" title={t.passportUpi}>
              {shortenUpi(t.passportUpi)}
            </p>
          </div>
        </div>
      </Td>
      <Td>
        <p className="ot-row__org">{t.fromOrg}</p>
        <p className="ot-row__did" title={t.fromDid}>
          {t.fromDid}
        </p>
      </Td>
      <Td>
        <p className="ot-row__org">{t.toOrg}</p>
        <p className="ot-row__did" title={t.toDid}>
          {t.toDid}
        </p>
      </Td>
      <Td>
        <p className="ot-row__ref">{t.reference ?? '—'}</p>
        {t.credentialId && (
          <p className="ot-row__vc" title={`Body SHA-256 ${t.bodySha256}`}>
            {t.credentialId}
          </p>
        )}
      </Td>
      <Td>
        <p className="ot-row__time">{formatRelative(t.initiatedAt)}</p>
        {t.settledAt && (
          <p className="ot-row__time-secondary">settled {formatRelative(t.settledAt)}</p>
        )}
      </Td>
      <Td align="right">
        {canAct ? (
          <RowActions id={t.id} state={t.state} />
        ) : (
          <span className="ot-row__time-secondary">—</span>
        )}
      </Td>
    </tr>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string
  value: number
  sub: string
  icon: React.ReactNode
  tone?: 'ok' | 'amber' | 'danger'
}) {
  return (
    <article className={`ot-page__kpi${tone ? ` ot-page__kpi--${tone}` : ''}`}>
      <div className="ot-page__kpi-head">
        <p className="ot-page__kpi-label">{label}</p>
        <span className={`ot-page__kpi-icon${tone ? ` ot-page__kpi-icon--${tone}` : ''}`}>
          {icon}
        </span>
      </div>
      <p className="ot-page__kpi-value">{value}</p>
      <p className="ot-page__kpi-sub">{sub}</p>
    </article>
  )
}

function Donut({ byKind }: { byKind: Record<TransferKind, number> }) {
  const total = byKind.ownership + byKind.custody + byKind.end_of_life || 1
  const r = 28
  const c = 2 * Math.PI * r
  const ownLen = (byKind.ownership / total) * c
  const cusLen = (byKind.custody / total) * c
  const eolLen = (byKind.end_of_life / total) * c
  return (
    <div className="ot-donut">
      <svg viewBox="0 0 80 80" className="ot-donut__svg" aria-hidden>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-hover)" strokeWidth="10" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="10"
          strokeDasharray={`${ownLen} ${c}`}
          transform="rotate(-90 40 40)"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="10"
          strokeDasharray={`${cusLen} ${c}`}
          strokeDashoffset={-ownLen}
          transform="rotate(-90 40 40)"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#16a34a"
          strokeWidth="10"
          strokeDasharray={`${eolLen} ${c}`}
          strokeDashoffset={-(ownLen + cusLen)}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <ul className="ot-donut__legend">
        <li>
          <span className="ot-donut__swatch" style={{ background: 'var(--color-accent)' }} />{' '}
          Ownership <strong>{byKind.ownership}</strong>
        </li>
        <li>
          <span className="ot-donut__swatch" style={{ background: '#f59e0b' }} /> Custody{' '}
          <strong>{byKind.custody}</strong>
        </li>
        <li>
          <span className="ot-donut__swatch" style={{ background: '#16a34a' }} /> End-of-Life{' '}
          <strong>{byKind.end_of_life}</strong>
        </li>
      </ul>
    </div>
  )
}

function FilterPill({
  href,
  label,
  active,
  tone,
  glyph,
}: {
  href: { pathname: string; query: Record<string, string> }
  label: string
  active: boolean
  tone: StateTone | 'accent'
  glyph?: React.ReactNode
}) {
  const search = new URLSearchParams(href.query).toString()
  const url = search ? `${href.pathname}?${search}` : href.pathname
  return (
    <a
      href={url}
      className={[
        'ot-page__chip',
        active ? `ot-page__chip--active ot-page__chip--${tone}` : '',
      ].join(' ')}
    >
      {glyph}
      <span>{label}</span>
    </a>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`ot-page__th ${align === 'right' ? 'text-right' : 'text-left'}`}
      scope="col"
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`ot-page__td ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </td>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

function shortenUpi(upi: string): string {
  const segs = upi.split('/').filter(Boolean)
  if (segs.length <= 2) return upi
  return `${segs[0]}/…/${segs[segs.length - 1]}`
}

function humanise(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const day = Math.floor(h / 24)
  if (day < 14) return `${day}d ago`
  return iso.slice(0, 10)
}

function hrefFor(
  flipping: 'state' | 'kind',
  value: string,
  rest: { stateFilter?: string; kindFilter?: string; query?: string },
): { pathname: string; query: Record<string, string> } {
  const q: Record<string, string> = {}
  if (flipping === 'state') {
    if (value) q.state = value
    if (rest.kindFilter) q.kind = rest.kindFilter
  } else {
    if (value) q.kind = value
    if (rest.stateFilter) q.state = rest.stateFilter
  }
  if (rest.query) q.q = rest.query
  return { pathname: '/console/ownership-transfers', query: q }
}

// ── styles ───────────────────────────────────────────────────────────────

const OT_PAGE_CSS = `
.ot-page__header {
  position: relative;
  display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
  justify-content: space-between;
  padding: 28px 28px 30px;
  margin: 0 -28px 26px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.08), transparent 50%),
    radial-gradient(circle at 100% 0%, rgba(245,158,11,0.06), transparent 50%);
  border-bottom: 1px solid var(--surface-divider);
}
.ot-page__header-block { display: flex; align-items: center; gap: 16px; min-width: 0; }
.ot-page__avatar {
  display: grid; place-items: center;
  width: 52px; height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-accent), #4f8fc7);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 8px 24px -8px rgba(15,76,129,0.5);
}
.ot-page__title {
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 30px);
  font-weight: 600; letter-spacing: -0.012em;
  color: var(--fg-default); line-height: 1.1;
}
.ot-page__subtitle { margin-top: 3px; font-size: 13px; color: var(--fg-muted); max-width: 640px; }
.ot-page__header-actions { display: flex; gap: 8px; }
.ot-page__btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: 8px;
  font-size: 12px; font-weight: 600;
}
.ot-page__btn--disabled {
  color: var(--fg-subtle);
  border: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  cursor: not-allowed;
}

.ot-page__kpi-grid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin-bottom: 22px;
}
.ot-page__kpi {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 18px 20px;
}
.ot-page__kpi-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.ot-page__kpi-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-subtle); }
.ot-page__kpi-icon {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 9px;
  background: var(--surface-hover);
  color: var(--fg-muted);
}
.ot-page__kpi-icon--ok { background: rgba(22,163,74,0.10); color: #16a34a; }
.ot-page__kpi-icon--amber { background: rgba(245,158,11,0.14); color: #b45309; }
.ot-page__kpi-icon--danger { background: rgba(239,68,68,0.10); color: #b91c1c; }
.ot-page__kpi-value {
  margin-top: 14px;
  font-family: var(--font-display);
  font-size: 36px; font-weight: 600;
  letter-spacing: -0.015em; line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.ot-page__kpi--ok .ot-page__kpi-value { color: #16a34a; }
.ot-page__kpi--amber .ot-page__kpi-value { color: #b45309; }
.ot-page__kpi--danger .ot-page__kpi-value { color: #b91c1c; }
.ot-page__kpi-sub { margin-top: 8px; font-size: 11.5px; color: var(--fg-muted); }

.ot-page__mix {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 18px;
}
@media (min-width: 1100px) { .ot-page__mix { grid-template-columns: 320px minmax(0, 1fr); } }
.ot-page__mix-card {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 18px 20px;
}
.ot-page__mix-label {
  font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--fg-subtle);
  margin-bottom: 14px;
}
.ot-donut { display: flex; align-items: center; gap: 18px; }
.ot-donut__svg { width: 80px; height: 80px; flex-shrink: 0; }
.ot-donut__legend { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--fg-default); }
.ot-donut__legend li { display: flex; align-items: center; gap: 8px; }
.ot-donut__legend strong { margin-left: auto; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ot-donut__swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; }

.ot-page__filters {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ot-page__search-input {
  width: 100%;
  height: 38px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 13px; color: var(--fg-default);
  outline: none;
  transition: border-color 150ms;
}
.ot-page__search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(15,76,129,0.10); }
.ot-page__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ot-page__chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 11.5px; font-weight: 500;
  color: var(--fg-muted);
  transition: background 150ms, border-color 150ms, color 150ms;
}
.ot-page__chip:hover { background: var(--surface-hover); color: var(--fg-default); }
.ot-page__chip--active { background: var(--surface-hover); color: var(--fg-default); font-weight: 600; }
.ot-page__chip--ok.ot-page__chip--active { color: #166534; border-color: rgba(22,163,74,0.4); background: rgba(22,163,74,0.08); }
.ot-page__chip--amber.ot-page__chip--active { color: #92400e; border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.10); }
.ot-page__chip--danger.ot-page__chip--active { color: #991B1B; border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.08); }
.ot-page__chip--accent.ot-page__chip--active { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-accent-soft); }

.ot-page__tablecard {
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  border-radius: 14px;
  overflow: hidden;
}
.ot-page__table { width: 100%; border-collapse: collapse; min-width: 1200px; font-size: 12.5px; }
.ot-page__th {
  padding: 12px 16px;
  font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--fg-subtle);
  background: var(--surface-canvas);
  border-bottom: 1px solid var(--surface-border);
  white-space: nowrap; font-weight: 600;
}
.ot-page__td { padding: 14px 16px; vertical-align: middle; border-top: 1px solid var(--surface-divider); }
.ot-row { transition: background 120ms; }
.ot-row:hover { background: var(--surface-canvas); }

.ot-row__state {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px; font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.ot-row__state-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
.ot-row__state--ok { color: #166534; background: rgba(22,163,74,0.10); }
.ot-row__state--amber { color: #92400e; background: rgba(245,158,11,0.12); }
.ot-row__state--danger { color: #991b1b; background: rgba(239,68,68,0.10); }
.ot-row__state--muted { color: var(--fg-muted); background: var(--surface-hover); }

.ot-row__kind {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px; font-weight: 600;
}
.ot-row__kind--ownership { background: rgba(15,76,129,0.08); color: var(--color-accent); }
.ot-row__kind--custody { background: rgba(245,158,11,0.12); color: #b45309; }
.ot-row__kind--end_of_life { background: rgba(22,163,74,0.10); color: #166534; }

.ot-row__passport { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ot-row__passport-img {
  width: 40px; height: 40px;
  border-radius: 8px;
  object-fit: cover;
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.ot-row__passport-label { font-size: 12.5px; font-weight: 600; color: var(--fg-default); }
.ot-row__passport-upi { margin-top: 2px; font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-muted); }

.ot-row__org { font-size: 12.5px; font-weight: 500; color: var(--fg-default); }
.ot-row__did { margin-top: 2px; font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }

.ot-row__ref { font-family: var(--font-mono); font-size: 11.5px; color: var(--fg-default); }
.ot-row__vc { margin-top: 2px; font-family: var(--font-mono); font-size: 10px; color: var(--color-accent); }

.ot-row__time { font-family: var(--font-mono); font-size: 11.5px; color: var(--fg-default); white-space: nowrap; }
.ot-row__time-secondary { margin-top: 2px; font-family: var(--font-mono); font-size: 10px; color: var(--fg-subtle); }

.ot-row__actions { display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end; }
.ot-row__btn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px; padding: 0 10px;
  border-radius: 8px;
  font-size: 11.5px; font-weight: 600;
  transition: background 150ms, opacity 150ms;
}
.ot-row__btn--primary { background: var(--color-accent); color: #fff; }
.ot-row__btn--primary:hover { opacity: 0.92; }
.ot-row__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ot-row__btn--ghost {
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  color: var(--fg-muted);
}
.ot-row__btn--ghost:hover { background: var(--surface-hover); color: var(--fg-default); }

.ot-row__menu { position: relative; flex-shrink: 0; }
.ot-row__menu--alone { display: inline-block; }
.ot-row__menu-trigger {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  color: var(--fg-subtle);
  cursor: pointer;
  list-style: none;
  border: 1px solid transparent;
  background: transparent;
  transition: background 120ms, color 120ms;
}
.ot-row__menu-trigger::-webkit-details-marker { display: none; }
.ot-row__menu-trigger:hover { background: var(--surface-hover); color: var(--fg-default); border-color: var(--surface-border); }
.ot-row__menu[open] .ot-row__menu-trigger { background: var(--surface-hover); color: var(--fg-default); border-color: var(--surface-border); }
.ot-row__menu-list {
  position: absolute;
  right: 0; top: calc(100% + 6px);
  min-width: 180px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  box-shadow: 0 12px 32px -8px rgba(15,23,42,0.16), 0 4px 8px -4px rgba(15,23,42,0.08);
  padding: 4px;
  z-index: 30;
  list-style: none;
  margin: 0;
}
.ot-row__menu-item {
  display: flex; align-items: center;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  text-align: left;
  color: var(--fg-default);
  background: transparent;
  transition: background 120ms;
}
.ot-row__menu-item:hover { background: var(--surface-hover); }
.ot-row__menu-item--danger { color: #b91c1c; }
.ot-row__menu-item--danger:hover { background: #FEF2F2; }
`
