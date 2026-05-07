import {
  Activity,
  Barcode,
  CheckCircle2,
  Cloud,
  Database,
  Factory,
  Globe2,
  Leaf,
  Plug,
  Recycle,
  Search,
  ShieldAlert,
  Sparkles,
  Webhook,
  Zap,
} from 'lucide-react'

import { ConnectDialog } from './ConnectDialog'
import {
  CATEGORY_LABEL,
  INTEGRATIONS,
  type Integration,
  type IntegrationCategory,
  type IntegrationStatus,
} from './data'

export const revalidate = 30

interface PageProps {
  searchParams: Promise<{ category?: string; status?: string; q?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const cat = (params.category ?? '') as IntegrationCategory | ''
  const stat = (params.status ?? '') as IntegrationStatus | ''
  const q = (params.q ?? '').trim().toLowerCase()

  const all = INTEGRATIONS
  const filtered = all.filter((i) => {
    if (cat && i.category !== cat) return false
    if (stat && i.status !== stat) return false
    if (q) {
      const blob = `${i.name} ${i.vendor} ${i.description} ${i.standards.join(' ')}`.toLowerCase()
      if (!blob.includes(q)) return false
    }
    return true
  })

  const counts = {
    total: all.length,
    connected: all.filter((i) => i.status === 'connected').length,
    configuring: all.filter((i) => i.status === 'configuring').length,
    disconnected: all.filter((i) => i.status === 'disconnected').length,
  }

  // Distribution per category for the sidebar count badges.
  const byCat: Record<IntegrationCategory, number> = {
    erp: 0,
    compliance: 0,
    telemetry: 0,
    supply_chain: 0,
    sustainability: 0,
    custom: 0,
  }
  for (const i of all) byCat[i.category]++

  return (
    <div className="int-page min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <style>{INT_PAGE_CSS}</style>

      <div className="mx-auto max-w-[1320px] px-7 py-7">
        {/* Header */}
        <header className="int-page__header">
          <div className="int-page__header-block">
            <div className="int-page__avatar" aria-hidden>
              <Plug className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="int-page__title">Integrations</h1>
              <p className="int-page__subtitle">
                Connect external systems to your zinc & lead passport workflow · ERP, telemetry,
                regulatory registries, supply-chain dataspaces, and sustainability schemes.
              </p>
            </div>
          </div>
          <div className="int-page__header-actions">
            <a
              href="https://help.passport.hzlindia.com/connectors"
              target="_blank"
              rel="noreferrer"
              className="int-page__btn int-page__btn--ghost"
            >
              Connector docs ↗
            </a>
            <a href="#all" className="int-page__btn int-page__btn--primary">
              <Sparkles className="h-3.5 w-3.5" /> Browse marketplace
            </a>
          </div>
        </header>

        {/* Tenant profile note */}
        <div className="int-page__note">
          <span className="int-page__note-icon">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <p>
            <strong>Connector provisioning follows your tenant profile.</strong> Deployment model:
            shared C6 Trail cloud · Integration mode: standard. Defaults are derived from this
            profile and can be overridden per connector.
          </p>
        </div>

        {/* KPI strip */}
        <section className="int-page__kpi-grid">
          <KpiCard
            label="Total"
            value={counts.total}
            sub="Available connectors"
            icon={<Plug className="h-4 w-4" />}
          />
          <KpiCard
            label="Connected"
            value={counts.connected}
            sub="Live + syncing"
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="ok"
          />
          <KpiCard
            label="Configuring"
            value={counts.configuring}
            sub="Awaiting credentials"
            icon={<Zap className="h-4 w-4" />}
            tone={counts.configuring > 0 ? 'amber' : undefined}
          />
          <KpiCard
            label="Disconnected"
            value={counts.disconnected}
            sub="Available to enable"
            icon={<Activity className="h-4 w-4" />}
          />
        </section>

        {/* Search + filters */}
        <form className="int-page__filters" action="/console/integrations" method="get">
          <div className="int-page__search">
            <Search className="int-page__search-icon h-3.5 w-3.5" />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search connectors by name, vendor, or standard…"
              className="int-page__search-input"
            />
          </div>
          <div className="int-page__chips">
            <FilterPill label="All" active={!cat} href="/console/integrations" />
            {(Object.keys(CATEGORY_LABEL) as IntegrationCategory[]).map((c) => (
              <FilterPill
                key={c}
                label={CATEGORY_LABEL[c]}
                count={byCat[c]}
                active={cat === c}
                href={`/console/integrations?category=${c}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              />
            ))}
          </div>
        </form>

        {/* Cards grid */}
        <section className="int-page__grid" id="all">
          {filtered.length === 0 && (
            <div className="int-page__empty">No connectors match these filters.</div>
          )}
          {filtered.map((i) => (
            <IntegrationCard key={i.id} integration={i} />
          ))}
        </section>

        {/* Data flow diagram */}
        <section className="int-page__flow">
          <p className="int-page__eyebrow">Data flow architecture</p>
          <h2 className="int-page__h2">How C6 Trail wires it all together</h2>
          <p className="int-page__lede">
            Every connector either feeds the passport pipeline or consumes from it. This is the full
            ingest → publish → distribute path.
          </p>

          <div className="int-page__flowboard">
            <FlowColumn
              title="Ingest"
              tone="accent"
              lanes={[
                {
                  label: 'ERP · SAP / Oracle',
                  sub: 'BOM · Batch · Serial',
                  icon: <Database className="h-3.5 w-3.5" />,
                },
                {
                  label: 'Telemetry · MES / IoT',
                  sub: 'Roaster temp · EW current · Cathode cycle',
                  icon: <Factory className="h-3.5 w-3.5" />,
                },
                {
                  label: 'Sustainability · IZA Zinc Mark',
                  sub: 'EPD · CFP statement',
                  icon: <Recycle className="h-3.5 w-3.5" />,
                },
              ]}
            />
            <FlowConnector />
            <FlowColumn
              title="Pipeline"
              tone="accent-strong"
              lanes={[
                {
                  label: 'C6 Trail authoring',
                  sub: 'Drafts · attribute fill · disclosure',
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                },
                {
                  label: 'Sign & anchor',
                  sub: 'Ed25519 + Body SHA-256',
                  icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                },
                {
                  label: 'Audit log',
                  sub: 'Hash-chained · append-only',
                  icon: <Activity className="h-3.5 w-3.5" />,
                },
              ]}
            />
            <FlowConnector />
            <FlowColumn
              title="Distribute"
              tone="ok"
              lanes={[
                {
                  label: 'EU CBAM Registry',
                  sub: 'Quarterly declarations',
                  icon: <Globe2 className="h-3.5 w-3.5" />,
                },
                {
                  label: 'Catena-X / EDC',
                  sub: 'OEM dataspace push',
                  icon: <Webhook className="h-3.5 w-3.5" />,
                },
                {
                  label: 'GS1 Resolver',
                  sub: 'Public passport URL',
                  icon: <Barcode className="h-3.5 w-3.5" />,
                },
              ]}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

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
  tone?: 'ok' | 'amber'
}) {
  return (
    <article className={`int-page__kpi${tone ? ` int-page__kpi--${tone}` : ''}`}>
      <div className="int-page__kpi-head">
        <p className="int-page__kpi-label">{label}</p>
        <span className={`int-page__kpi-icon${tone ? ` int-page__kpi-icon--${tone}` : ''}`}>
          {icon}
        </span>
      </div>
      <p className="int-page__kpi-value">{value}</p>
      <p className="int-page__kpi-sub">{sub}</p>
    </article>
  )
}

function FilterPill({
  label,
  count,
  active,
  href,
}: {
  label: string
  count?: number
  active: boolean
  href: string
}) {
  return (
    <a href={href} className={`int-page__chip${active ? ' int-page__chip--active' : ''}`}>
      <span>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="int-page__chip-count">{count}</span>
      )}
    </a>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const stateInfo = STATUS_INFO[integration.status]
  return (
    <article
      className={`int-card int-card--${integration.brandTone} int-card--${integration.status}`}
    >
      <header className="int-card__head">
        <span className={`int-card__logo int-card__logo--${integration.brandTone}`}>
          <BrandIcon kind={integration.iconKind} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="int-card__category">{CATEGORY_LABEL[integration.category]}</p>
          <h3 className="int-card__title">{integration.name}</h3>
          <p className="int-card__vendor">{integration.vendor}</p>
        </div>
        <span className={`int-card__state int-card__state--${stateInfo.tone}`}>
          <span className="int-card__state-dot" />
          {stateInfo.label}
        </span>
      </header>

      <p className="int-card__desc">{integration.description}</p>

      <ul className="int-card__chips">
        {integration.standards.slice(0, 4).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <footer className="int-card__foot">
        <div className="int-card__meta">
          {integration.status === 'connected' ? (
            <>
              <span className="int-card__meta-strong">
                {(integration.recordsSynced ?? 0).toLocaleString()} records
              </span>
              <span>· last sync {formatRelative(integration.lastSyncAt)}</span>
            </>
          ) : integration.status === 'configuring' ? (
            <>
              <span className="int-card__meta-strong">Awaiting credentials</span>
              <span>· {integration.fields.length} fields required</span>
            </>
          ) : (
            <span>{integration.capabilities.length} capabilities · ready to enable</span>
          )}
        </div>
        <ConnectDialog
          integration={integration}
          triggerLabel={
            integration.status === 'connected'
              ? 'Configure'
              : integration.status === 'configuring'
                ? 'Resume setup'
                : 'Connect'
          }
        />
      </footer>
    </article>
  )
}

const STATUS_INFO: Record<IntegrationStatus, { label: string; tone: 'ok' | 'amber' | 'muted' }> = {
  connected: { label: 'Connected', tone: 'ok' },
  configuring: { label: 'Configuring', tone: 'amber' },
  disconnected: { label: 'Disconnected', tone: 'muted' },
}

function BrandIcon({ kind }: { kind: Integration['iconKind'] }) {
  switch (kind) {
    case 'erp':
      return <Database className="h-4 w-4" />
    case 'eu':
      return <Globe2 className="h-4 w-4" />
    case 'auto':
      return <Webhook className="h-4 w-4" />
    case 'factory':
      return <Factory className="h-4 w-4" />
    case 'recycle':
      return <Recycle className="h-4 w-4" />
    case 'database':
      return <Database className="h-4 w-4" />
    case 'cloud':
      return <Cloud className="h-4 w-4" />
    case 'barcode':
      return <Barcode className="h-4 w-4" />
    case 'leaf':
      return <Leaf className="h-4 w-4" />
    case 'webhook':
      return <Webhook className="h-4 w-4" />
  }
}

function FlowColumn({
  title,
  tone,
  lanes,
}: {
  title: string
  tone: 'accent' | 'accent-strong' | 'ok'
  lanes: { label: string; sub: string; icon: React.ReactNode }[]
}) {
  return (
    <div className={`int-flow__col int-flow__col--${tone}`}>
      <p className="int-flow__col-title">{title}</p>
      <ul className="int-flow__lanes">
        {lanes.map((l) => (
          <li key={l.label} className="int-flow__lane">
            <span className="int-flow__lane-icon">{l.icon}</span>
            <span className="int-flow__lane-text">
              <span className="int-flow__lane-label">{l.label}</span>
              <span className="int-flow__lane-sub">{l.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlowConnector() {
  return (
    <span className="int-flow__connector" aria-hidden>
      <span className="int-flow__connector-dot" />
    </span>
  )
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
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

const INT_PAGE_CSS = `
.int-page__header {
  position: relative;
  display: flex; flex-wrap: wrap; align-items: center; gap: 16px;
  justify-content: space-between;
  padding: 28px 28px 30px;
  margin: 0 -28px 22px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.08), transparent 50%),
    radial-gradient(circle at 100% 0%, rgba(74,158,255,0.06), transparent 50%);
  border-bottom: 1px solid var(--surface-divider);
}
.int-page__header-block { display: flex; align-items: center; gap: 16px; min-width: 0; }
.int-page__avatar {
  display: grid; place-items: center;
  width: 52px; height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-accent), #4f8fc7);
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 8px 24px -8px rgba(15,76,129,0.5);
}
.int-page__title {
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 30px);
  font-weight: 600; letter-spacing: -0.012em;
  color: var(--fg-default); line-height: 1.1;
}
.int-page__subtitle { margin-top: 3px; font-size: 13px; color: var(--fg-muted); max-width: 720px; }
.int-page__header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.int-page__btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: 8px;
  font-size: 12px; font-weight: 600;
  transition: background 150ms, opacity 150ms;
}
.int-page__btn--primary {
  background: var(--color-accent); color: #fff;
  box-shadow: 0 6px 16px -4px rgba(15,76,129,0.45);
}
.int-page__btn--primary:hover { opacity: 0.92; }
.int-page__btn--ghost { border: 1px solid var(--surface-border); background: var(--surface-page); color: var(--fg-default); }
.int-page__btn--ghost:hover { background: var(--surface-hover); }

/* Tenant note */
.int-page__note {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid rgba(15,76,129,0.18);
  background: linear-gradient(180deg, rgba(15,76,129,0.06), transparent 60%);
  margin-bottom: 20px;
}
.int-page__note-icon {
  display: grid; place-items: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(15,76,129,0.10);
  color: var(--color-accent);
  flex-shrink: 0;
}
.int-page__note p {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fg-default);
}
.int-page__note strong { font-weight: 600; }

/* KPI grid */
.int-page__kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}
.int-page__kpi {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 18px 20px;
}
.int-page__kpi-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.int-page__kpi-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--fg-subtle); }
.int-page__kpi-icon {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 9px;
  background: var(--surface-hover);
  color: var(--fg-muted);
}
.int-page__kpi-icon--ok { background: rgba(22,163,74,0.10); color: #16a34a; }
.int-page__kpi-icon--amber { background: rgba(245,158,11,0.14); color: #b45309; }
.int-page__kpi-value {
  margin-top: 14px;
  font-family: var(--font-display);
  font-size: 36px; font-weight: 600;
  letter-spacing: -0.015em; line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.int-page__kpi--ok .int-page__kpi-value { color: #16a34a; }
.int-page__kpi--amber .int-page__kpi-value { color: #b45309; }
.int-page__kpi-sub { margin-top: 8px; font-size: 11.5px; color: var(--fg-muted); }

/* Filters */
.int-page__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.int-page__search {
  position: relative;
  flex: 1 1 320px;
  min-width: 280px;
}
.int-page__search-icon {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  color: var(--fg-subtle);
}
.int-page__search-input {
  width: 100%;
  height: 38px;
  padding: 0 14px 0 36px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 13px;
  color: var(--fg-default);
  outline: none;
  transition: border-color 150ms;
}
.int-page__search-input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px rgba(15,76,129,0.10); }
.int-page__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.int-page__chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 11.5px; font-weight: 500;
  color: var(--fg-muted);
  transition: background 150ms, border-color 150ms, color 150ms;
}
.int-page__chip:hover { background: var(--surface-hover); color: var(--fg-default); }
.int-page__chip--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 600;
}
.int-page__chip-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: 9999px;
  background: var(--surface-hover);
  font-family: var(--font-mono);
  font-size: 9.5px; font-weight: 700;
}
.int-page__chip--active .int-page__chip-count { background: var(--color-accent); color: #fff; }

/* Card grid */
.int-page__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 800px) { .int-page__grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1200px) { .int-page__grid { grid-template-columns: 1fr 1fr 1fr; } }
.int-page__empty {
  grid-column: 1 / -1;
  padding: 40px 20px;
  text-align: center;
  color: var(--fg-subtle);
  border: 1px dashed var(--surface-border);
  border-radius: 14px;
  background: var(--surface-page);
}

/* Card */
.int-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border-radius: 16px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  transition: border-color 200ms, box-shadow 200ms, transform 200ms;
  overflow: hidden;
}
.int-card:hover {
  border-color: rgba(15,76,129,0.24);
  box-shadow: 0 18px 40px -16px rgba(15,76,129,0.18), 0 4px 12px -4px rgba(15,23,42,0.06);
  transform: translateY(-2px);
}
.int-card--connected {
  background: linear-gradient(180deg, rgba(22,163,74,0.04), transparent 50%), var(--surface-page);
}
.int-card--configuring {
  background: linear-gradient(180deg, rgba(245,158,11,0.06), transparent 50%), var(--surface-page);
}

.int-card__head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }

.int-card__logo {
  display: grid; place-items: center;
  width: 42px; height: 42px;
  border-radius: 11px;
  flex-shrink: 0;
  color: #fff;
}
.int-card__logo--sap { background: linear-gradient(135deg, #0a3d70, #0f4c81); }
.int-card__logo--eu { background: linear-gradient(135deg, #003399, #1e6abf); }
.int-card__logo--catena { background: linear-gradient(135deg, #d4a574, #b8893a); }
.int-card__logo--mes { background: linear-gradient(135deg, #1f4974, #2c5d8c); }
.int-card__logo--asi { background: linear-gradient(135deg, #2e7a4a, #1f5d36); }
.int-card__logo--oracle { background: linear-gradient(135deg, #c74634, #8b2e22); }
.int-card__logo--msft { background: linear-gradient(135deg, #5e5e5e, #2e2e2e); }
.int-card__logo--aws { background: linear-gradient(135deg, #232f3e, #ff9900); }
.int-card__logo--gs1 { background: linear-gradient(135deg, #f47b20, #c5611b); }
.int-card__logo--cdp { background: linear-gradient(135deg, #5a7a3a, #3f5526); }
.int-card__logo--custom { background: linear-gradient(135deg, var(--fg-subtle), var(--fg-muted)); }

.int-card__category {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--fg-subtle); font-weight: 700;
}
.int-card__title {
  margin-top: 1px;
  font-family: var(--font-display);
  font-size: 15px; font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.int-card__vendor { margin-top: 1px; font-size: 11px; color: var(--fg-muted); }

.int-card__state {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  white-space: nowrap;
}
.int-card__state-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
.int-card__state--ok { color: #166534; background: rgba(22,163,74,0.10); }
.int-card__state--amber { color: #92400e; background: rgba(245,158,11,0.14); }
.int-card__state--muted { color: var(--fg-muted); background: var(--surface-hover); }

.int-card__desc {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fg-default);
  margin-bottom: 12px;
  flex: 1;
}

.int-card__chips {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.int-card__chips li {
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.04em;
  color: var(--fg-muted);
  font-weight: 600;
}

.int-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--surface-divider);
}
.int-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  font-size: 11px;
  color: var(--fg-muted);
  min-width: 0;
}
.int-card__meta-strong { color: var(--fg-default); font-weight: 600; }

/* Flow board */
.int-page__flow { margin-top: 36px; }
.int-page__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--color-accent); font-weight: 700;
  margin-bottom: 6px;
}
.int-page__h2 {
  font-family: var(--font-display);
  font-size: 22px; font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg-default);
}
.int-page__lede { margin-top: 4px; font-size: 13px; color: var(--fg-muted); max-width: 720px; }

.int-page__flowboard {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: stretch;
}
@media (min-width: 880px) {
  .int-page__flowboard {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  }
}

.int-flow__col {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 16px 16px 14px;
  position: relative;
}
.int-flow__col--accent::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(90deg, var(--color-accent), #4f8fc7);
}
.int-flow__col--accent-strong::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(90deg, #0a3d70, var(--color-accent), #4f8fc7);
}
.int-flow__col--ok::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
  background: linear-gradient(90deg, #16a34a, #4ade80);
}
.int-flow__col-title {
  font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--fg-subtle); font-weight: 700;
  margin-bottom: 10px;
}
.int-flow__lanes { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.int-flow__lane {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 9px;
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
  transition: border-color 150ms;
}
.int-flow__lane:hover { border-color: rgba(15,76,129,0.32); }
.int-flow__lane-icon {
  display: grid; place-items: center;
  width: 26px; height: 26px;
  border-radius: 7px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  flex-shrink: 0;
}
.int-flow__lane-text { display: flex; flex-direction: column; min-width: 0; }
.int-flow__lane-label { font-size: 12px; font-weight: 600; color: var(--fg-default); }
.int-flow__lane-sub { font-family: var(--font-mono); font-size: 9.5px; color: var(--fg-muted); margin-top: 2px; }

.int-flow__connector {
  display: grid; place-items: center;
  position: relative;
  min-width: 60px;
  align-self: stretch;
}
.int-flow__connector::before {
  content: '';
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent) 25%, var(--color-accent) 75%, transparent);
  transform: translateY(-50%);
}
.int-flow__connector-dot {
  position: relative;
  width: 12px; height: 12px;
  border-radius: 9999px;
  background: var(--color-accent);
  box-shadow: 0 0 14px rgba(15,76,129,0.55);
  animation: int-flow-pulse 2s infinite;
}
@keyframes int-flow-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(15,76,129,0.45); }
  50%      { box-shadow: 0 0 22px rgba(15,76,129,0.85); }
}
@media (max-width: 880px) {
  .int-flow__connector { min-height: 28px; min-width: 0; }
  .int-flow__connector::before {
    left: 50%; right: auto; top: 0; bottom: 0;
    width: 2px; height: auto;
    background: linear-gradient(180deg, transparent, var(--color-accent) 25%, var(--color-accent) 75%, transparent);
    transform: translateX(-50%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .int-flow__connector-dot { animation: none; }
}
`
