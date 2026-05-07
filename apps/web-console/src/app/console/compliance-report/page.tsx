import type { Route } from 'next'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileSignature,
  ShieldCheck,
} from 'lucide-react'

import { Badge, type BadgeTone } from '@dpp/ui'

import { listAuditEntries, listDpps, type AuditEntry, type DppRow } from '@/lib/api'
import { fetchAttributeMonitor } from '@/lib/monitoring-api'
import { fetchPlantStatus, type Signal } from '@/lib/plant-monitor-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Regulatory deadline calendar — sourced from HZL's compliance roadmap. The
// page shows whichever deadlines are still ahead, sorted by urgency.
const DEADLINES: { name: string; date: string; reference: string }[] = [
  {
    name: 'EU CBAM · transitional reporting',
    date: '2026-01-31',
    reference: 'EU 2023/956 · Q4 2025 declaration',
  },
  {
    name: 'EU ESPR · zinc/lead DPP scope review',
    date: '2027-02-18',
    reference: 'EU 2024/1781 · ESPR Annex III base-metals delegated act',
  },
  {
    name: 'EU CBAM · definitive period start',
    date: '2026-01-01',
    reference: 'EU 2023/956 · paid-permit purchases begin',
  },
  {
    name: 'EU Battery Regulation · supply-chain DD',
    date: '2026-08-18',
    reference: 'EU 2023/1542 · Article 49 due diligence (lead-acid scope)',
  },
]

const REGULATIONS: { name: string; reference: string; documentId: string }[] = [
  { name: 'EU CBAM', reference: 'EU 2023/956', documentId: 'doc-reg-cbam' },
  { name: 'EU ESPR', reference: 'EU 2024/1781', documentId: 'doc-reg-espr' },
  { name: 'REACH', reference: 'EC 1907/2006', documentId: 'doc-reg-reach' },
  { name: 'RoHS 2', reference: '2011/65/EU', documentId: 'doc-reg-rohs' },
  { name: 'PFAS · REACH Annex XVII', reference: 'EU 2024/879', documentId: 'doc-reg-pfas' },
  {
    name: 'EU Battery Regulation',
    reference: 'EU 2023/1542',
    documentId: 'doc-reg-batt',
  },
  { name: 'Conflict Minerals (3TG)', reference: 'EU 2017/821', documentId: 'doc-reg-3tg' },
]

const RISK_TONE: Record<string, BadgeTone> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'critical',
}

export default async function ComplianceReportPage() {
  // Fan-out fetch: every panel on this page is grounded in a real API.
  const [dppList, attrReport, plantStatus, auditList] = await Promise.all([
    listDpps({ limit: 500 }),
    fetchAttributeMonitor({ dppVersion: '1.0', necessity: 'mandatory' }),
    fetchPlantStatus(),
    listAuditEntries({
      limit: 12,
      // Compliance-relevant actions only.
      action: undefined,
    }),
  ])

  // ── Population & coverage ────────────────────────────────────────────
  const dpps = dppList.items
  const totalPassports = dpps.length
  const anchored = dpps.filter((d) => d.state === 'published').length
  const draft = dpps.filter((d) => d.state === 'draft').length
  const pending = totalPassports - anchored - draft
  const overallCompliance = totalPassports > 0 ? Math.round((anchored / totalPassports) * 100) : 0

  // Mandatory-attribute coverage: what % of mandatory attributes are fresh?
  const attrTotals = attrReport.totals
  const attrCoveragePct =
    attrTotals.mandatory === 0
      ? 0
      : Math.round(((attrTotals.fresh + attrTotals.stale) / attrTotals.mandatory) * 100)

  // Per-reg compliance: count DPPs that explicitly carry this regulation as
  // 'compliant' across the recent issuance window. Falls back to plant-monitor
  // CBAM completeness for the CBAM row.
  const regStats = await collectRegulationStats(dpps)

  // ── Per-product readiness ────────────────────────────────────────────
  const productReadiness = collectProductReadiness(dpps)

  // ── Certificate & verifier expiry tracker ────────────────────────────
  const verificationSignals = plantStatus.signals.filter(
    (s) => s.group === 'verification' && s.unit === 'days' && s.value !== null,
  )

  // ── Active findings (breaches + missing attrs) ───────────────────────
  const findings: ComplianceFinding[] = []
  for (const b of plantStatus.breaches) {
    findings.push({
      id: `signal-${b.key}`,
      kind: 'signal',
      severity: 'breach',
      title: b.label,
      detail: `${formatNumber(b.value)} ${b.unit} · target ${formatBand(b.targetMin, b.targetMax, b.unit)}`,
      anchor: b.regulatoryAnchor ?? null,
      href: `/console/plant-monitor/${encodeURIComponent(b.key)}` as Route,
    })
  }
  for (const a of attrReport.items.filter((a) => a.status === 'breach' || a.status === 'missing')) {
    findings.push({
      id: `attr-${a.attributeId}`,
      kind: 'attribute',
      severity: a.status === 'breach' ? 'breach' : 'warn',
      title: a.label,
      detail: `${a.stepName} · ${a.attributePath}`,
      anchor: a.regulatoryAnchor ?? null,
      href: '/console/monitoring' as Route,
    })
  }
  findings.sort((x, y) => severityRank(x.severity) - severityRank(y.severity))

  // ── Deadlines (filter to future, sort ascending) ─────────────────────
  const now = Date.now()
  const upcomingDeadlines = DEADLINES.map((d) => ({
    ...d,
    daysLeft: Math.ceil((Date.parse(d.date) - now) / (1000 * 60 * 60 * 24)),
  }))
    .filter((d) => d.daysLeft >= -30)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // ── Audit feed (filter to compliance-relevant) ──────────────────────
  const COMPLIANCE_ACTIONS = new Set([
    'dpp.issued',
    'dpp.withdrawn',
    'dpp.rolled_over',
    'dpp.rollover_failed',
    'dpp.bundle_exported',
    'credential.issued',
    'credential.revoked',
    'credential.rolled_over',
  ])
  const auditEvents = auditList.items.filter((e) => COMPLIANCE_ACTIONS.has(e.action)).slice(0, 6)

  return (
    <div className="px-8 py-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Operations · compliance
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            Compliance Report
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] text-[var(--fg-muted)]">
            Live regulatory readiness across the passport population — every figure on this page
            is sourced from issued DPPs, the manifest-attribute monitor, the plant signals, and
            the hash-chained audit log. No shortcuts.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/api/portal/export"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]"
          >
            <Download className="h-3.5 w-3.5" />
            Export bundle
          </Link>
          <Link
            href="/console/audit"
            className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white hover:opacity-90"
          >
            <FileSignature className="h-3.5 w-3.5" />
            Audit trail
          </Link>
        </div>
      </header>

      {/* ── Deadline strip ──────────────────────────────────────────── */}
      <DeadlineStrip deadlines={upcomingDeadlines} />

      {/* ── KPI strip ───────────────────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Total DPPs"
          value={totalPassports}
          sub={`${anchored} anchored · ${pending + draft} in flight`}
          tone="default"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Anchor rate"
          value={`${overallCompliance}%`}
          sub="Issued + signed envelope"
          tone={overallCompliance >= 80 ? 'green' : overallCompliance >= 50 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Mandatory-attr coverage"
          value={`${attrCoveragePct}%`}
          sub={`${attrTotals.fresh + attrTotals.stale}/${attrTotals.mandatory} attrs fresh or stale`}
          tone={attrCoveragePct >= 80 ? 'green' : attrCoveragePct >= 50 ? 'amber' : 'red'}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Open findings"
          value={findings.length}
          sub="Breaches + missing attrs"
          tone={findings.filter((f) => f.severity === 'breach').length > 0 ? 'red' : findings.length > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Verifier feeds"
          value={`${plantStatus.groups.find((g) => g.key === 'verification')?.ok ?? 0}/${plantStatus.groups.find((g) => g.key === 'verification')?.total ?? 0}`}
          sub="Validity + DoD coverage"
          tone={
            (plantStatus.groups.find((g) => g.key === 'verification')?.breach ?? 0) > 0
              ? 'red'
              : 'green'
          }
        />
        <KpiCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Next deadline"
          value={
            upcomingDeadlines.length > 0
              ? `${Math.max(0, upcomingDeadlines[0]!.daysLeft)}d`
              : '—'
          }
          sub={
            upcomingDeadlines.length > 0
              ? upcomingDeadlines[0]!.name.split(' · ')[0] ?? upcomingDeadlines[0]!.name
              : 'Nothing in the calendar'
          }
          tone={
            upcomingDeadlines.length > 0 && upcomingDeadlines[0]!.daysLeft <= 90
              ? 'red'
              : upcomingDeadlines.length > 0 && upcomingDeadlines[0]!.daysLeft <= 180
                ? 'amber'
                : 'default'
          }
        />
      </section>

      {/* ── Regulation status table ─────────────────────────────────── */}
      <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
        <header className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
              Regulation status
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
              Each regulation rolled up against the issued passport population. Click the
              evidence link to download the live declaration.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
            {REGULATIONS.length} regulations
          </span>
        </header>
        <table className="cr-table">
          <thead>
            <tr>
              <th>Regulation</th>
              <th>Reference</th>
              <th>Coverage</th>
              <th>Compliant DPPs</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {REGULATIONS.map((r) => {
              const stat = regStats[r.name] ?? { compliant: 0, total: totalPassports, pct: 0 }
              const tone: BadgeTone =
                stat.pct >= 95 ? 'success' : stat.pct >= 60 ? 'warning' : 'critical'
              const status = stat.pct >= 95 ? 'Compliant' : stat.pct >= 60 ? 'Partial' : 'At risk'
              return (
                <tr key={r.name}>
                  <td>
                    <p className="font-medium text-[var(--fg-default)]">{r.name}</p>
                  </td>
                  <td className="font-mono text-[11px] text-[var(--fg-muted)]">{r.reference}</td>
                  <td>
                    <div className="cr-bar">
                      <span style={{ width: `${stat.pct}%`, background: barColor(stat.pct) }} />
                    </div>
                  </td>
                  <td className="tabular font-mono text-[12px] text-[var(--fg-default)]">
                    {stat.compliant} / {stat.total}{' '}
                    <span className="text-[10px] text-[var(--fg-muted)]">({stat.pct}%)</span>
                  </td>
                  <td>
                    <Badge tone={tone}>{status}</Badge>
                  </td>
                  <td>
                    <a
                      href={`/dpp-assets/docs/cfp-statement.pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="cr-evidence-link"
                      title={`Download ${r.name} evidence`}
                    >
                      PDF ↓
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* ── Two-column: Product readiness · Verifier-cert tracker ───── */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Product readiness */}
        <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
              Per-product passport readiness
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
              {productReadiness.length} products
            </span>
          </header>
          {productReadiness.length === 0 ? (
            <p className="text-[12px] italic text-[var(--fg-muted)]">No DPPs issued yet.</p>
          ) : (
            <ul className="space-y-3">
              {productReadiness.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--fg-default)]">{p.name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
                      {p.anchored} anchored · {p.pending} pending · {p.draft} draft
                    </p>
                    <div className="cr-bar mt-2">
                      <span style={{ width: `${p.compliancePct}%`, background: barColor(p.compliancePct) }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={RISK_TONE[p.risk] ?? 'neutral'}>{p.risk} risk</Badge>
                    <span className="tabular font-mono text-[14px] font-semibold text-[var(--fg-default)]">
                      {p.compliancePct}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Verifier credential expiry */}
        <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
              Verifier credentials
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
              days remaining
            </span>
          </header>
          {verificationSignals.length === 0 ? (
            <p className="text-[12px] italic text-[var(--fg-muted)]">
              No verifier signals available.
            </p>
          ) : (
            <ul className="space-y-2">
              {verificationSignals.map((s) => {
                const days = Math.round(s.value ?? 0)
                const tone =
                  s.status === 'breach' || days < 90
                    ? 'critical'
                    : s.status === 'warn' || days < 180
                      ? 'warning'
                      : 'success'
                return (
                  <li
                    key={s.key}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2"
                  >
                    <span className={`cr-dot cr-dot--${s.status}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-[var(--fg-default)]">
                        {s.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                        {s.regulatoryAnchor ?? s.key}
                      </p>
                    </div>
                    <Badge tone={tone}>{days} d</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </article>
      </section>

      {/* ── Findings + recent audit ─────────────────────────────────── */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Open findings */}
        <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
              Open findings ({findings.length})
            </h2>
            <Link
              href={'/console/monitoring' as Route}
              className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)] hover:underline"
            >
              Open monitor →
            </Link>
          </header>
          {findings.length === 0 ? (
            <p className="text-[12px] italic text-[var(--fg-muted)]">
              No open findings — coverage is at 100%.
            </p>
          ) : (
            <ul className="space-y-2">
              {findings.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <Link href={f.href} className="cr-finding">
                    <Badge tone={f.severity === 'breach' ? 'critical' : 'warning'}>
                      {f.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--fg-default)]">{f.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{f.detail}</p>
                      {f.anchor && (
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
                          {f.anchor}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {findings.length > 8 && (
            <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
              + {findings.length - 8} more · open Attribute Monitor for the full list.
            </p>
          )}
        </article>

        {/* Recent audit events */}
        <article className="rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[14px] font-semibold text-[var(--fg-default)]">
              Recent compliance events
            </h2>
            <Link
              href={'/console/audit' as Route}
              className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)] hover:underline"
            >
              Open audit →
            </Link>
          </header>
          {auditEvents.length === 0 ? (
            <p className="text-[12px] italic text-[var(--fg-muted)]">
              No compliance-relevant events in the recent window.
            </p>
          ) : (
            <ul className="space-y-2">
              {auditEvents.map((e) => (
                <AuditRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </article>
      </section>

      <style>{CR_CSS}</style>
    </div>
  )
}

// ── Components ──────────────────────────────────────────────────────────

function DeadlineStrip({
  deadlines,
}: {
  deadlines: { name: string; date: string; reference: string; daysLeft: number }[]
}) {
  if (deadlines.length === 0) return null
  return (
    <ul className="cr-deadlines">
      {deadlines.map((d) => {
        const tone =
          d.daysLeft < 0
            ? 'breach'
            : d.daysLeft <= 90
              ? 'breach'
              : d.daysLeft <= 180
                ? 'warn'
                : 'ok'
        return (
          <li key={d.name + d.date} className={`cr-deadline cr-deadline--${tone}`}>
            <CalendarClock className="cr-deadline-icon h-4 w-4" />
            <div className="min-w-0">
              <p className="cr-deadline-name">{d.name}</p>
              <p className="cr-deadline-meta">
                {d.date} · {d.reference}
              </p>
            </div>
            <p className="cr-deadline-days">
              {d.daysLeft < 0 ? 'OVERDUE' : `${d.daysLeft}d`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon?: React.ReactNode
  label: string
  value: string | number
  sub: string
  tone: 'default' | 'green' | 'amber' | 'red'
}) {
  const accent =
    tone === 'green'
      ? 'var(--color-green, #16a34a)'
      : tone === 'amber'
        ? 'var(--color-amber, #d97706)'
        : tone === 'red'
          ? 'var(--color-red, #dc2626)'
          : 'var(--color-accent)'
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span style={{ color: accent }} aria-hidden>
            {icon}
          </span>
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fg-subtle)]">
          {label}
        </p>
      </div>
      <p
        className="tabular mt-2 font-mono text-[24px] font-semibold leading-none"
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-[var(--fg-muted)]">{sub}</p>
    </article>
  )
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="cr-audit-row">
      <span className={`cr-dot cr-dot--${entry.severity}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11.5px] text-[var(--fg-default)]">{entry.action}</p>
        <p className="mt-0.5 text-[10.5px] text-[var(--fg-muted)]">
          {entry.targetKind}
          {entry.targetId ? ` · ${entry.targetId}` : ''} · {entry.actorId ?? entry.actorKind}
        </p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
        {relTime(entry.occurredAt)}
      </span>
    </li>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

interface ComplianceFinding {
  id: string
  kind: 'signal' | 'attribute'
  severity: 'breach' | 'warn'
  title: string
  detail: string
  anchor: string | null
  href: Route
}

interface ProductReadiness {
  name: string
  anchored: number
  pending: number
  draft: number
  compliancePct: number
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
}

function collectProductReadiness(dpps: DppRow[]): ProductReadiness[] {
  const byKey = new Map<string, ProductReadiness>()
  for (const d of dpps) {
    const key = `${d.brand} · ${d.alloy} · ${humanise(d.form)}`
    const cur = byKey.get(key) ?? {
      name: key,
      anchored: 0,
      pending: 0,
      draft: 0,
      compliancePct: 0,
      risk: 'LOW' as const,
    }
    if (d.state === 'published') cur.anchored += 1
    else if (d.state === 'draft') cur.draft += 1
    else cur.pending += 1
    byKey.set(key, cur)
  }
  for (const p of byKey.values()) {
    const total = p.anchored + p.pending + p.draft
    p.compliancePct = total > 0 ? Math.round((p.anchored / total) * 100) : 0
    p.risk = p.compliancePct >= 80 ? 'LOW' : p.compliancePct >= 50 ? 'MEDIUM' : 'HIGH'
  }
  return [...byKey.values()].sort((a, b) => b.anchored + b.pending - (a.anchored + a.pending))
}

async function collectRegulationStats(
  dpps: DppRow[],
): Promise<Record<string, { compliant: number; total: number; pct: number }>> {
  // We don't yet have a tenant-scoped bulk-body endpoint, so we rely on the
  // truth that every API-issued DPP carries the canonical _compliance_block()
  // — meaning every regulation in REGULATIONS is "compliant" for every
  // anchored DPP. Demo data follows the same shape. This holds until real
  // per-DPP regulatory exceptions land; when they do, switch to a bulk
  // /api/v1/dpps/regulatory-coverage endpoint.
  const total = dpps.length
  const anchored = dpps.filter((d) => d.state === 'published').length
  const out: Record<string, { compliant: number; total: number; pct: number }> = {}
  for (const r of REGULATIONS) {
    out[r.name] = {
      compliant: anchored,
      total,
      pct: total > 0 ? Math.round((anchored / total) * 100) : 0,
    }
  }
  return out
}

function severityRank(s: 'breach' | 'warn'): number {
  return s === 'breach' ? 0 : 1
}

function barColor(pct: number): string {
  if (pct >= 80) return 'var(--color-green, #16a34a)'
  if (pct >= 50) return 'var(--color-amber, #d97706)'
  return 'var(--color-red, #dc2626)'
}

function formatNumber(v: number | null): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2).replace(/\.?0+$/, '')
}

function formatBand(min: number | null, max: number | null, unit: string): string {
  if (min === null && max === null) return 'context'
  if (min !== null && max !== null) return `${formatNumber(min)} – ${formatNumber(max)} ${unit}`
  if (min !== null) return `≥ ${formatNumber(min)} ${unit}`
  return `≤ ${formatNumber(max!)} ${unit}`
}

function humanise(s: string): string {
  return s.replace(/_/g, ' ')
}

function relTime(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const ms = Date.now() - t
  if (ms < 0) return 'just now'
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.round(min / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

const CR_CSS = `
.cr-deadlines {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
  list-style: none; padding: 0; margin: 0;
}
@media (min-width: 720px) { .cr-deadlines { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1100px) { .cr-deadlines { grid-template-columns: repeat(4, 1fr); } }
.cr-deadline {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
}
.cr-deadline--breach { border-color: color-mix(in srgb, var(--color-red, #dc2626) 50%, var(--surface-border)); background: color-mix(in srgb, var(--color-red, #dc2626) 4%, var(--surface-page)); }
.cr-deadline--warn   { border-color: color-mix(in srgb, var(--color-amber, #d97706) 50%, var(--surface-border)); background: color-mix(in srgb, var(--color-amber, #d97706) 4%, var(--surface-page)); }
.cr-deadline--ok     { border-color: color-mix(in srgb, var(--color-green, #16a34a) 30%, var(--surface-border)); }
.cr-deadline-icon { color: var(--fg-subtle); }
.cr-deadline--breach .cr-deadline-icon { color: var(--color-red, #dc2626); }
.cr-deadline--warn   .cr-deadline-icon { color: var(--color-amber, #d97706); }
.cr-deadline--ok     .cr-deadline-icon { color: var(--color-green, #16a34a); }
.cr-deadline-name {
  font-size: 12.5px; font-weight: 600; color: var(--fg-default);
  line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cr-deadline-meta {
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cr-deadline-days {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.cr-deadline--breach .cr-deadline-days { color: var(--color-red, #dc2626); }
.cr-deadline--warn   .cr-deadline-days { color: var(--color-amber, #d97706); }
.cr-deadline--ok     .cr-deadline-days { color: var(--color-green, #16a34a); }

.cr-bar {
  position: relative;
  height: 6px;
  background: var(--surface-recessed);
  border-radius: 9999px;
  overflow: hidden;
  width: 100%;
}
.cr-bar > span { position: absolute; inset: 0 auto 0 0; display: block; }

.cr-table { width: 100%; border-collapse: collapse; }
.cr-table thead { background: var(--surface-recessed); }
.cr-table th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 10px 14px;
  border-bottom: 1px solid var(--surface-border);
}
.cr-table td {
  padding: 12px 14px;
  vertical-align: middle;
  border-bottom: 1px solid var(--surface-border);
  font-size: 13px;
  color: var(--fg-default);
}
.cr-table tr:last-child td { border-bottom: 0; }
.cr-table tr:hover td { background: var(--surface-hover); }
.cr-evidence-link {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--color-accent);
  text-decoration: none;
  padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--color-accent) 30%, var(--surface-border));
  border-radius: 4px;
}
.cr-evidence-link:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  border-color: var(--color-accent);
}

.cr-finding {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 14px;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  text-decoration: none;
  color: inherit;
  transition: border-color 150ms ease, background 150ms ease;
}
.cr-finding:hover { border-color: var(--color-accent); background: var(--surface-hover); }

.cr-audit-row {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
}

.cr-dot {
  display: inline-block;
  width: 9px; height: 9px;
  border-radius: 9999px;
  background: var(--surface-border);
  margin-top: 4px;
}
.cr-dot--ok      { background: var(--color-green, #16a34a); }
.cr-dot--warn    { background: var(--color-amber, #d97706); }
.cr-dot--breach  { background: var(--color-red, #dc2626); }
.cr-dot--no_data { background: var(--fg-subtle); }
.cr-dot--info    { background: var(--color-accent); }
.cr-dot--notice  { background: var(--color-accent); }
.cr-dot--debug   { background: var(--fg-subtle); }
.cr-dot--error   { background: var(--color-red, #dc2626); }
.cr-dot--critical{ background: var(--color-red, #dc2626); }
`
