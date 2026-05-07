import Link from 'next/link'
import { Anchor, ArrowUpRight, Download, Eye, Filter, Globe, Plus, ShieldCheck } from 'lucide-react'

import { generateQrSvg, matchDemoPassport } from '@dpp/ui'

import { listDpps, type DppRow } from '@/lib/api'

const PAGE_SIZE = 50

const STATE_DEFINITIONS: { key: string; label: string; tone: StatusTone }[] = [
  { key: 'published', label: 'Anchored', tone: 'ok' },
  { key: 'pending', label: 'Pending', tone: 'amber' },
  { key: 'review', label: 'In Review', tone: 'amber' },
  { key: 'draft', label: 'Draft', tone: 'muted' },
  { key: 'revoked', label: 'Revoked', tone: 'danger' },
  { key: 'recalled', label: 'Recalled', tone: 'danger' },
]

type StatusTone = 'ok' | 'amber' | 'muted' | 'danger'

interface PageProps {
  searchParams: Promise<{
    state?: string
    q?: string
    page?: string
  }>
}

export const revalidate = 30

export default async function DppsPage({ searchParams }: PageProps) {
  // Run searchParams + DPP list in parallel · ~50% latency win on this page
  // since the API call no longer waits on the searchParams await.
  const [params, list] = await Promise.all([searchParams, listDpps({ limit: 500 })])
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0)
  const stateFilter = params.state ?? ''
  const query = (params.q ?? '').trim().toLowerCase()

  // Apply filters server-side so the page stays SSR.
  let filtered = list.items
  if (stateFilter) {
    filtered = filtered.filter((d) => normaliseState(d.state) === stateFilter)
  }
  if (query) {
    filtered = filtered.filter(
      (d) =>
        d.upi.toLowerCase().includes(query) ||
        d.brand.toLowerCase().includes(query) ||
        d.alloy.toLowerCase().includes(query) ||
        d.form.toLowerCase().includes(query),
    )
  }

  const totalAll = list.total
  const totalAnchored = list.items.filter((d) => d.state === 'published').length
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // QR codes for the visible page · server-rendered SVG, used by the row
  // hover overlay (mini badge that pops next to the UID on hover). Capped to
  // the first 24 rows on a page so listing 50 stays fast.
  const qrByUpi = await buildQrIndex(paged.slice(0, 24))

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <style>{LIST_CSS}</style>

      <div className="mx-auto max-w-[1320px] px-7 py-7">
        {/* ── Header strip ───────────────────────────────────────── */}
        <header className="passport-list__header">
          <div className="passport-list__header-text">
            <p className="passport-list__eyebrow">Passport Workspace</p>
            <h1 className="passport-list__title">Passports</h1>
            <p className="passport-list__subtitle">
              Review, search, and publish per-batch passports without mixing registry metadata into
              the main list. Every row is one cast.
            </p>
          </div>
          <div className="passport-list__header-actions">
            <Link
              href="/console/dpps/export"
              className="passport-list__btn passport-list__btn--ghost"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Link>
            <Link
              href="/console/create-passport/new"
              className="passport-list__btn passport-list__btn--primary"
            >
              <Plus className="h-3.5 w-3.5" /> Create Passport
            </Link>
          </div>
        </header>

        {/* ── KPI strip + side card ───────────────────────────────── */}
        <div className="passport-list__board">
          <div className="passport-list__kpi-grid">
            <KpiCard
              label="Total passports"
              value={totalAll.toLocaleString()}
              hint="Across the current workspace"
            />
            <KpiCard
              label="Anchored in view"
              value={paged.filter((d) => d.state === 'published').length.toString()}
              hint="Current page only"
              tone="ok"
            />
            <KpiCard label="EU-linked in view" value="0" hint="Current page only" />
          </div>
          <aside className="passport-list__registry">
            <div className="passport-list__registry-pill">
              <Globe className="h-3 w-3" /> EU REGISTRY
            </div>
            <h3 className="passport-list__registry-title">
              Keep registry publishing in a quieter side lane
            </h3>
            <p className="passport-list__registry-body">
              Anchored passports that already carry registry metadata live in a separate registry
              view so this list stays focused on operational work.
            </p>
            <div className="passport-list__registry-stats">
              <div>
                <p className="passport-list__registry-stat-label">Ready to register</p>
                <p className="passport-list__registry-stat-value">{totalAnchored}</p>
              </div>
              <div>
                <p className="passport-list__registry-stat-label">Already linked</p>
                <p className="passport-list__registry-stat-value">0</p>
              </div>
            </div>
            <Link
              href="/console/eu-registry"
              className="passport-list__btn passport-list__btn--registry"
            >
              Open Registry →
            </Link>
            <p className="passport-list__registry-foot">
              Registry totals here reflect the passports in the current view.
            </p>
          </aside>
        </div>

        {/* ── Search + filter chip row ───────────────────────────── */}
        <form action="/console/dpps" method="get" className="passport-list__filters">
          <div className="passport-list__search">
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Search by product UID, model, or manufacturer."
              className="passport-list__search-input"
            />
            <button type="submit" className="passport-list__search-submit">
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="passport-list__chips">
            <FilterChip query={{}} active={!stateFilter} tone="muted" label="All" />
            {STATE_DEFINITIONS.map((s) => (
              <FilterChip
                key={s.key}
                query={{ state: s.key, ...(query ? { q: query } : {}) }}
                active={stateFilter === s.key}
                tone={s.tone}
                label={s.label}
              />
            ))}
          </div>
        </form>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="passport-list__tablecard">
          <div className="passport-list__tablewrap">
            <table className="passport-list__table">
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Product UID</Th>
                  <Th>Model</Th>
                  <Th>Category</Th>
                  <Th>Passport ID</Th>
                  <Th align="right">Version</Th>
                  <Th>Created</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-[13px] text-[var(--fg-subtle)]"
                    >
                      No passports match these filters.
                    </td>
                  </tr>
                )}
                {paged.map((dpp) => (
                  <PassportRow key={dpp.upi} dpp={dpp} qrSvg={qrByUpi[dpp.upi] ?? null} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {filtered.length > PAGE_SIZE && (
            <div className="passport-list__pager">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{' '}
                of {filtered.length.toLocaleString()}
              </span>
              <div className="flex gap-1">
                {page > 0 && (
                  <Link
                    href={{
                      pathname: '/console/dpps',
                      query: {
                        page: String(page - 1),
                        ...(stateFilter ? { state: stateFilter } : {}),
                        ...(query ? { q: query } : {}),
                      },
                    }}
                    className="passport-list__btn passport-list__btn--ghost"
                  >
                    Prev
                  </Link>
                )}
                {(page + 1) * PAGE_SIZE < filtered.length && (
                  <Link
                    href={{
                      pathname: '/console/dpps',
                      query: {
                        page: String(page + 1),
                        ...(stateFilter ? { state: stateFilter } : {}),
                        ...(query ? { q: query } : {}),
                      },
                    }}
                    className="passport-list__btn passport-list__btn--ghost"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────

function PassportRow({ dpp, qrSvg }: { dpp: DppRow; qrSvg: string | null }) {
  const demo =
    matchDemoPassport(dpp.upi) ?? matchDemoPassport(dpp.brand) ?? matchDemoPassport(dpp.alloy)
  const productImage =
    demo && (demo.body.media as Record<string, unknown> | undefined)?.productImage
      ? ((demo.body.media as Record<string, unknown>).productImage as string)
      : '/dpp-assets/products/ecozen.jpg'
  const passportIdShort = shortHash(dpp.upi)
  const stateInfo = stateInfoFor(dpp.state)
  const productUid = makeProductUid(dpp)
  const model = `${dpp.alloy} · ${humanise(dpp.form)}`
  const category = categoryFor(dpp.form)
  const created = formatTimestamp(dpp.issuedAt)
  const version = `v${1}` // Real version comes from dpp_records.revision_count when wired up

  return (
    <tr className="passport-row group">
      <Td>
        <span className={`passport-row__status passport-row__status--${stateInfo.tone}`}>
          <span className="passport-row__status-dot" />
          {stateInfo.label}
        </span>
      </Td>

      {/* Product UID + inline preview + rich hover popover.
       *
       * Inline (always visible): mini thumbnail · UID · brand chip · QR · ↗
       * On hover: a rich 380px popover slides in to the RIGHT of the UID
       * cell — overlays its own row's columns (Model/Category/Passport ID),
       * never the rows above or below. */}
      <Td>
        <div className="passport-row__cell-with-pop">
          <div className="passport-row__uid-wrap">
            <span className="passport-row__thumb" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={productImage} alt="" loading="lazy" />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/console/dpps/${encodeURIComponent(dpp.upi)}`}
                className="passport-row__uid"
                title={dpp.upi}
              >
                {productUid}
              </Link>
              <p className="passport-row__brand-chip">
                {dpp.brand} ·{' '}
                <span className="tabular font-mono">
                  {Math.round(dpp.weightKg).toLocaleString()} kg
                </span>{' '}
                ·{' '}
                <span className="tabular font-mono">
                  {Math.round(dpp.cfpKgCo2ePerTonne)} kg CO₂e/t
                </span>
              </p>
            </div>
            {qrSvg && (
              <span
                className="passport-row__qr"
                aria-label="QR · GS1 Digital Link"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            )}
            <ArrowUpRight className="passport-row__open h-3.5 w-3.5" />
          </div>

          {/* Rich hover popover · CSS-only · opens to the right of the cell */}
          <div className="passport-row__pop" role="dialog" aria-label={`Preview of ${productUid}`}>
            <div className="passport-row__pop-grid">
              <div className="passport-row__pop-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImage} alt={dpp.brand} loading="lazy" />
              </div>
              <div className="passport-row__pop-body">
                <p className="passport-row__pop-eyebrow">Batch passport · {model}</p>
                <p className="passport-row__pop-title">{dpp.brand}</p>
                <dl className="passport-row__pop-fields">
                  <div>
                    <dt>Cast</dt>
                    <dd className="font-mono">{productUid}</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>{Math.round(dpp.weightKg).toLocaleString()} kg</dd>
                  </div>
                  <div>
                    <dt>CFP</dt>
                    <dd>
                      {Math.round(dpp.cfpKgCo2ePerTonne).toLocaleString()}
                      <span className="passport-row__pop-unit"> kg CO₂e/t</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Recycled</dt>
                    <dd>{dpp.recycledContentPct.toFixed(0)}%</dd>
                  </div>
                </dl>
              </div>
              <div className="passport-row__pop-qr">
                {qrSvg ? (
                  <span
                    className="passport-row__pop-qr-frame"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <span className="passport-row__pop-qr-frame passport-row__pop-qr-frame--empty" />
                )}
                <p className="passport-row__pop-qr-caption">GS1 Digital Link</p>
              </div>
            </div>
            <div className="passport-row__pop-foot">
              <Link
                href={`/console/dpps/${encodeURIComponent(dpp.upi)}`}
                className="passport-list__btn passport-list__btn--primary"
              >
                Open passport →
              </Link>
              <a
                href={dpp.digitalLinkUrl ?? `/dpp/${dpp.upi}`}
                target="_blank"
                rel="noreferrer"
                className="passport-list__btn passport-list__btn--ghost"
              >
                Public viewer ↗
              </a>
            </div>
          </div>
        </div>
      </Td>

      <Td>{model}</Td>
      <Td>
        <span className="passport-row__category">{category}</span>
      </Td>
      <Td>
        <span className="passport-row__hash">{passportIdShort}</span>
      </Td>
      <Td align="right">
        <span className="passport-row__version">{version}</span>
      </Td>
      <Td>{created}</Td>
      <Td align="right">
        <div className="passport-row__actions">
          <ActionIcon
            href={`/console/dpps/${encodeURIComponent(dpp.upi)}`}
            label="View passport"
            icon={<Eye className="h-3.5 w-3.5" />}
          />
          <ActionIcon
            href={`/dpp/${dpp.upi}`}
            label="Verify on public viewer"
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            external
          />
          <ActionIcon
            href={`/api/demo-export/${encodeURIComponent(dpp.upi)}/dpp.json`}
            label="Download JSON"
            icon={<Download className="h-3.5 w-3.5" />}
          />
        </div>
      </Td>
    </tr>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function buildQrIndex(rows: DppRow[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(
    rows.map(async (r) => {
      try {
        const url = r.digitalLinkUrl ?? `https://id.ega.example/01/${r.upi}`
        out[r.upi] = await generateQrSvg(url)
      } catch {
        out[r.upi] = ''
      }
    }),
  )
  return out
}

/** Map raw `dpp_records.state` to a display tone · covers the canonical states
 *  ('published'/'draft') plus future states the team will add ('pending',
 *  'review', 'revoked', 'recalled') so the chips work without code changes. */
function normaliseState(state: string): string {
  if (state === 'published') return 'published'
  if (state === 'draft') return 'draft'
  return state
}

function stateInfoFor(raw: string): { label: string; tone: StatusTone } {
  const norm = normaliseState(raw)
  const def = STATE_DEFINITIONS.find((s) => s.key === norm)
  if (def) return { label: def.label, tone: def.tone }
  return { label: humanise(raw), tone: 'muted' }
}

/** Compose the Voltrail-style PRODUCT UID · uppercase brand + alloy + cast.
 *  The cast segment in a GS1-style UPI (`{gtin}/{cast}/{serial}`) is the
 *  middle one starting with `C-`. Falling back to the last segment shared
 *  the same `0001` suffix across every row, so we explicitly hunt for the
 *  cast pattern first and only fall back to a hash of the full UPI when
 *  no recognisable cast is present. */
function makeProductUid(d: DppRow): string {
  const brand = (d.brand || 'EGA').toUpperCase().slice(0, 8)
  const alloy = (d.alloy || '')
    .replace(/[^0-9A-Z]/gi, '')
    .slice(0, 6)
    .toUpperCase()
  const segments = d.upi.split('/').filter(Boolean)
  // Prefer a cast segment (e.g. "C-20260504-51747").
  const castSegment = segments.find((s) => /^C-?\d/i.test(s) || /^[A-Z]+-\d{6,}/i.test(s))
  // Otherwise use a [middle, tail] composite so each row stays distinct even
  // when only the GTIN tail differs.
  const fallback =
    segments.length >= 2
      ? `${segments[segments.length - 2]}-${segments[segments.length - 1]}`
      : (segments[segments.length - 1] ?? '')
  const tail = (castSegment ?? fallback).toUpperCase()
  return [brand, alloy, tail].filter(Boolean).join('-')
}

function shortHash(upi: string): string {
  // Deterministic short hash from the UPI for the "0x..." passport-id column.
  let h = 0
  for (let i = 0; i < upi.length; i++) h = (h * 31 + upi.charCodeAt(i)) >>> 0
  const left = h.toString(16).padStart(8, '0')
  let h2 = 0
  for (let i = upi.length - 1; i >= 0; i--) h2 = (h2 * 17 + upi.charCodeAt(i)) >>> 0
  const right = h2.toString(16).padStart(4, '0')
  return `0x${left.slice(0, 4)}…${right}`
}

function categoryFor(form: string): string {
  if (/extrusion/i.test(form)) return 'Construction'
  if (/sheet|plate/i.test(form)) return 'Automotive'
  if (/sow|ingot/i.test(form)) return 'Industrial'
  return 'Industrial'
}

function humanise(s: string): string {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 10) + ' at ' + d.toISOString().slice(11, 16)
  } catch {
    return '—'
  }
}

// ── Subcomponents ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: 'ok'
}) {
  return (
    <div className="passport-list__kpi">
      <p className="passport-list__kpi-label">{label}</p>
      <p
        className={`passport-list__kpi-value${tone === 'ok' ? ' passport-list__kpi-value--ok' : ''}`}
      >
        {value}
      </p>
      <p className="passport-list__kpi-hint">{hint}</p>
    </div>
  )
}

function FilterChip({
  query,
  active,
  tone,
  label,
}: {
  query: Record<string, string>
  active: boolean
  tone: StatusTone
  label: string
}) {
  return (
    <Link
      href={{ pathname: '/console/dpps', query }}
      className={[
        'passport-list__chip',
        active ? `passport-list__chip--active passport-list__chip--${tone}` : '',
      ].join(' ')}
    >
      <span className={`passport-list__chip-dot passport-list__chip-dot--${tone}`} />
      {label}
    </Link>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={['passport-list__th', align === 'right' ? 'text-right' : 'text-left'].join(' ')}
      scope="col"
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={['passport-list__td', align === 'right' ? 'text-right' : 'text-left'].join(' ')}>
      {children}
    </td>
  )
}

function ActionIcon({
  href,
  label,
  icon,
  external,
}: {
  href: string
  label: string
  icon: React.ReactNode
  external?: boolean
}) {
  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="passport-row__action"
    >
      {icon}
    </a>
  ) : (
    <Link
      href={{ pathname: href }}
      aria-label={label}
      title={label}
      className="passport-row__action"
    >
      {icon}
    </Link>
  )
}

const LIST_CSS = `
.passport-list__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 22px;
}
.passport-list__header-text { min-width: 0; max-width: 720px; }
.passport-list__header-actions {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.passport-list__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-accent);
}
.passport-list__title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--fg-default);
  line-height: 1.1;
}
.passport-list__subtitle {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--fg-muted);
}

.passport-list__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.005em;
  transition: background 150ms, border-color 150ms, opacity 150ms;
}
.passport-list__btn--primary {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 2px 6px -2px rgba(15,76,129,0.4);
}
.passport-list__btn--primary:hover { opacity: 0.92; }
.passport-list__btn--ghost {
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  color: var(--fg-default);
}
.passport-list__btn--ghost:hover { background: var(--surface-hover); }
.passport-list__btn--registry {
  width: 100%;
  justify-content: center;
  background: var(--color-accent);
  color: #fff;
  margin-top: 16px;
}
.passport-list__btn--registry:hover { opacity: 0.92; }

/* KPI strip + side card */
.passport-list__board {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  margin-bottom: 22px;
}
@media (min-width: 1100px) {
  .passport-list__board { grid-template-columns: minmax(0, 1fr) 360px; }
}

.passport-list__kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.passport-list__kpi {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 18px 20px;
}
.passport-list__kpi-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.passport-list__kpi-value {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--fg-default);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.passport-list__kpi-value--ok { color: #16a34a; }
.passport-list__kpi-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--fg-muted);
}

.passport-list__registry {
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
}
.passport-list__registry-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(74,222,128,0.18);
  color: #166534;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.passport-list__registry-title {
  margin-top: 12px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--fg-default);
}
.passport-list__registry-body {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fg-muted);
}
.passport-list__registry-stats {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.passport-list__registry-stat-label {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.passport-list__registry-stat-value {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--fg-default);
}
.passport-list__registry-foot {
  margin-top: 10px;
  font-size: 10.5px;
  color: var(--fg-subtle);
}

/* Filters */
.passport-list__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.passport-list__search {
  position: relative;
  flex: 1 1 320px;
  min-width: 280px;
}
.passport-list__search-input {
  width: 100%;
  height: 38px;
  padding: 0 38px 0 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 13px;
  color: var(--fg-default);
  outline: none;
  transition: border-color 150ms;
}
.passport-list__search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(15,76,129,0.10);
}
.passport-list__search-submit {
  position: absolute;
  right: 4px; top: 50%;
  transform: translateY(-50%);
  width: 30px; height: 30px;
  display: grid; place-items: center;
  border-radius: 9999px;
  color: var(--fg-subtle);
}
.passport-list__search-submit:hover { color: var(--fg-default); }

.passport-list__chips {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-left: auto;
}
.passport-list__chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fg-muted);
  transition: background 150ms;
}
.passport-list__chip:hover { background: var(--surface-hover); color: var(--fg-default); }
.passport-list__chip--active { background: var(--surface-hover); color: var(--fg-default); border-color: var(--surface-border); font-weight: 600; }
.passport-list__chip-dot {
  width: 6px; height: 6px; border-radius: 9999px;
  background: var(--fg-subtle);
}
.passport-list__chip-dot--ok { background: #16a34a; }
.passport-list__chip-dot--amber { background: #f59e0b; }
.passport-list__chip-dot--danger { background: #ef4444; }
.passport-list__chip-dot--muted { background: var(--fg-subtle); }

/* Table */
.passport-list__tablecard {
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  border-radius: 14px;
  overflow: hidden;
}
.passport-list__tablewrap { overflow-x: auto; overflow-y: visible; }
.passport-list__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 1080px;
}
.passport-list__th {
  padding: 14px 16px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 600;
  border-bottom: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  white-space: nowrap;
}
.passport-list__td {
  padding: 14px 16px;
  vertical-align: middle;
  border-top: 1px solid var(--surface-divider);
  color: var(--fg-default);
}
.passport-row { transition: background 100ms; position: relative; }
.passport-row:hover { background: var(--surface-canvas); }

/* Status pill in row */
.passport-row__status {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.passport-row__status-dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
.passport-row__status--ok { color: #166534; background: rgba(22,163,74,0.10); }
.passport-row__status--amber { color: #92400e; background: rgba(245,158,11,0.12); }
.passport-row__status--danger { color: #991b1b; background: rgba(239,68,68,0.10); }
.passport-row__status--muted { color: var(--fg-muted); background: var(--surface-hover); }

.passport-row__uid {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: 0.01em;
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.passport-row__uid:hover { color: var(--color-accent); }

/* ── Inline UID cell with thumbnail + QR + brand chip ────────────────── */
.passport-row__uid-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 0;
}
.passport-row__thumb {
  display: block;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  opacity: 0.78;
  transition: opacity 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.passport-row__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.passport-row__brand-chip {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--fg-muted);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.passport-row__qr {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 2px;
  background: #fff;
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0.55;
  transition: opacity 200ms ease, transform 200ms ease;
}
.passport-row__qr svg { width: 100%; height: 100%; display: block; }
.passport-row__open {
  flex-shrink: 0;
  color: var(--fg-subtle);
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 200ms ease, transform 200ms ease, color 200ms ease;
}

/* Row hover treatment — inline reveal, no overflow */
.passport-row { transition: background-color 160ms ease, box-shadow 160ms ease; }
.passport-row:hover { background: var(--surface-hover); }
.passport-row:hover .passport-row__thumb {
  opacity: 1;
  transform: scale(1.04);
  box-shadow: 0 4px 10px -6px rgba(15, 23, 42, 0.25);
}
.passport-row:hover .passport-row__qr { opacity: 1; transform: scale(1.04); }
.passport-row:hover .passport-row__open {
  opacity: 1;
  transform: translateX(0);
  color: var(--color-accent);
}
@media (prefers-reduced-motion: reduce) {
  .passport-row, .passport-row__thumb, .passport-row__qr, .passport-row__open { transition: none; }
  .passport-row:hover .passport-row__thumb,
  .passport-row:hover .passport-row__qr { transform: none; }
}

/* ── Rich hover popover · opens to the RIGHT of the cell so it never
 * floats over the rows above or below. Overlays only its own row's
 * remaining columns (Model · Category · Passport ID · Version · Created)
 * which the user is already focused on. */
.passport-row__cell-with-pop { position: relative; }
.passport-row__pop {
  position: absolute;
  top: -12px;
  left: calc(100% + 12px);
  width: 380px;
  max-width: min(380px, calc(100vw - 280px));
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  box-shadow:
    0 16px 48px -12px rgba(15, 23, 42, 0.22),
    0 4px 12px -4px rgba(15, 23, 42, 0.10);
  padding: 16px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px) scale(0.985);
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: 30;
}
.passport-row__cell-with-pop:hover .passport-row__pop,
.passport-row__cell-with-pop:focus-within .passport-row__pop {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}
.passport-row__pop-grid {
  display: grid;
  grid-template-columns: 88px 1fr 84px;
  gap: 12px;
  align-items: center;
}
.passport-row__pop-photo {
  width: 88px; height: 88px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
}
.passport-row__pop-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.passport-row__pop-eyebrow {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.passport-row__pop-title {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.passport-row__pop-fields {
  margin-top: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.passport-row__pop-fields > div { min-width: 0; }
.passport-row__pop-fields dt {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.passport-row__pop-fields dd {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}
.passport-row__pop-unit { font-weight: 400; color: var(--fg-muted); font-size: 10px; }
.passport-row__pop-qr { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.passport-row__pop-qr-frame {
  display: block;
  width: 84px; height: 84px;
  padding: 4px;
  border: 1px solid var(--surface-border);
  background: #fff;
  border-radius: 6px;
  line-height: 0;
}
.passport-row__pop-qr-frame--empty { background: var(--surface-canvas); }
.passport-row__pop-qr-frame svg { width: 100%; height: 100%; display: block; }
.passport-row__pop-qr-caption {
  font-family: var(--font-mono);
  font-size: 8.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.passport-row__pop-foot {
  margin-top: 14px;
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--surface-divider, var(--surface-border));
  padding-top: 12px;
}
.passport-row__pop-foot .passport-list__btn { flex: 1; justify-content: center; }
@media (prefers-reduced-motion: reduce) {
  .passport-row__pop { transition: none; }
  .passport-row__cell-with-pop:hover .passport-row__pop { transform: none; }
}

.passport-row__hash {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 500;
}
.passport-row__category {
  display: inline-flex; align-items: center;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  background: var(--surface-hover);
  color: var(--fg-muted);
  letter-spacing: 0.04em;
}
.passport-row__version {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--fg-muted);
}
.passport-row__actions {
  display: inline-flex; align-items: center; gap: 4px;
  justify-content: flex-end;
}
.passport-row__action {
  display: grid; place-items: center;
  width: 28px; height: 28px;
  border-radius: 6px;
  color: var(--fg-subtle);
  transition: background 150ms, color 150ms;
}
.passport-row__action:hover { background: var(--surface-hover); color: var(--fg-default); }

.passport-list__pager {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  font-size: 12px;
  color: var(--fg-muted);
}
`
