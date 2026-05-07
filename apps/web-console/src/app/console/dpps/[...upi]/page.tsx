import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  Pencil,
  QrCode,
  ShieldCheck,
  Share2,
  Trash2,
} from 'lucide-react'

import { Badge, DppDocument, matchDemoPassport } from '@dpp/ui'

import { fetchDppFull } from '@/lib/api'

/** Merge a (sparse) live DB body with a rich demo body so the document always
 * renders the full RecAL/JRC-aligned layout. Live values win over demo
 * defaults; demo provides the missing sections (chemistry, processFlow,
 * documents, etc). Match is by UPI/cast pattern · same heuristic as the
 * public viewer. */
function enrichWithDemoFallback(
  liveBody: Record<string, unknown>,
  upi: string,
): Record<string, unknown> {
  const ident = (liveBody.identification ?? {}) as Record<string, unknown>
  const demo =
    matchDemoPassport(upi) ??
    matchDemoPassport((ident.tradeName as string) ?? '') ??
    matchDemoPassport((ident.gradeCode as string) ?? '') ??
    matchDemoPassport((ident.metal as string) ?? '') ??
    matchDemoPassport('ecozen')
  if (!demo) return liveBody
  // Shallow-merge each top-level section: keep live keys, fill missing keys
  // from demo. Live primitive sections (string/number) are kept as-is.
  const merged: Record<string, unknown> = { ...demo.body }
  for (const [k, v] of Object.entries(liveBody)) {
    if (v === null || v === undefined) continue
    if (
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof merged[k] === 'object' &&
      merged[k] !== null &&
      !Array.isArray(merged[k])
    ) {
      merged[k] = { ...(merged[k] as Record<string, unknown>), ...(v as Record<string, unknown>) }
    } else {
      merged[k] = v
    }
  }
  return merged
}

interface PageProps {
  params: Promise<{ upi: string[] }>
}

export const dynamic = 'force-dynamic'

export default async function DppDetailPage({ params }: PageProps) {
  const { upi: segments } = await params
  const upi = segments.map(decodeURIComponent).join('/')
  const dpp = await fetchDppFull(upi)
  if (!dpp) notFound()

  const liveBody = (dpp.dpp ?? {}) as Record<string, unknown>
  const body = enrichWithDemoFallback(liveBody, upi)
  const ident = (body.identification ?? {}) as Record<string, unknown>
  const meta = (body.meta ?? {}) as Record<string, unknown>
  const isPublished = dpp.state === 'published'
  const score = (meta.complianceScore as number) ?? (isPublished ? 98 : 64)

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <div className="mx-auto max-w-[1320px] px-7 py-6">
        {/* Operator-side action bar · same actions as the public viewer's
            ExportToolbar plus tenant-only controls (Edit, Recall). */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/console/dpps"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[12px] font-medium text-[var(--fg-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Passports
          </Link>
          <span className="h-4 w-px bg-[var(--surface-border)]" aria-hidden />
          <Badge tone={isPublished ? 'success' : 'neutral'}>{dpp.state}</Badge>
          <span className="font-mono text-[11px] text-[var(--fg-subtle)]">
            EU compliance · {score}%
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <a
              href={`/dpp/${upi}`}
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-92 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(15,76,129,0.2)] transition"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View Public Passport
            </a>
            <Link
              href="/console/create-passport"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[12px] font-medium text-[var(--fg-default)] transition hover:bg-[var(--surface-hover)]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
            <ActionButton
              href={`/api/demo-export/${upi}/dpp.json`}
              icon={<FileJson className="h-3.5 w-3.5" />}
              label="JSON"
            />
            <ActionButton
              href={`/api/demo-export/${upi}/credential.vc.json`}
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="VC"
            />
            <ActionButton
              href={`/api/demo-export/${upi}/qr.svg`}
              icon={<QrCode className="h-3.5 w-3.5" />}
              label="QR"
            />
            <ActionButton
              href={`/api/demo-export/${upi}/report.pdf`}
              icon={<Download className="h-3.5 w-3.5" />}
              label="PDF"
            />
            <ActionButton href="#" icon={<Share2 className="h-3.5 w-3.5" />} label="Share" />
            <Link
              href="/console/eu-registry"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[12px] font-medium text-[var(--fg-default)] transition hover:bg-[var(--surface-hover)]"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-green,#16a34a)]" /> EU Check
            </Link>
            {isPublished && (
              <Link
                href="#"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[#FCA5A5] bg-[#FEF2F2] px-3 text-[12px] font-medium text-[#991B1B] transition hover:bg-[#FEE2E2]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Recall
              </Link>
            )}
          </div>
        </div>

        {/* Provenance strip · UPI / SHA-256 / signature, monospace */}
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-white px-5 py-4 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
          <ProvenanceItem label="UPI" value={upi} />
          <ProvenanceItem label="Issued" value={formatTimestamp(dpp.issuedAt)} />
          <ProvenanceItem
            label="Body SHA-256"
            value={dpp.signatureRef?.bodySha256 ?? '—'}
            truncate
          />
          <ProvenanceItem
            label="Signature"
            value={`${dpp.signatureRef?.algorithm ?? '—'}${dpp.signatureRef?.value ? ` · ${dpp.signatureRef.value.slice(0, 24)}…` : ''}`}
            truncate
          />
        </div>

        {/* The same DPP document the public viewer renders · single source of
            truth for what a passport looks like, reused via @dpp/ui. */}
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white">
          <DppDocument
            dpp={{
              dpp: body,
              issuedAt: dpp.issuedAt,
              isDemo: false,
            }}
          />
        </div>

        {/* Brand identity hint at the very bottom */}
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Operator view · {(ident.brand as string) ?? 'HZL'} · DPP{' '}
          {(body.dppVersion as string) ?? '1.0'}
        </p>
      </div>
    </div>
  )
}

function ActionButton({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <a
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-white px-3 text-[12px] font-medium text-[var(--fg-default)] transition hover:bg-[var(--surface-hover)]"
    >
      {icon}
      {label}
    </a>
  )
}

function ProvenanceItem({
  label,
  value,
  truncate,
}: {
  label: string
  value: string
  truncate?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {label}
      </p>
      <p
        className={[
          'mt-0.5 font-mono text-[12px] text-[var(--fg-default)]',
          truncate ? 'truncate' : 'break-all',
        ].join(' ')}
        title={truncate ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
  } catch {
    return iso
  }
}
