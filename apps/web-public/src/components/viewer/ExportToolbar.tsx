import type { ViewerDpp } from '@/lib/dpp-client'

/** Export toolbar · JSON / VC / QR / PDF actions.
 * Pure server-rendered links; clicks land on the demo asset endpoints. */
export function ExportToolbar({ dpp, upiPath }: { dpp: ViewerDpp; upiPath: string }) {
  const meta = dpp.dpp.meta as { complianceScore?: number } | undefined
  const score = meta?.complianceScore ?? 98
  return (
    <section className="border-b border-[var(--surface-divider)] bg-[var(--color-paper)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing score={score} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
              EU Compliance · DPP 1.0
            </p>
            <p className="mt-0.5 text-[14px] font-semibold text-[var(--fg-default)]">
              {score}% · ESPR + CBAM aligned
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <ExportLink
            href={`/api/dpp-pdf/${upiPath}`}
            label="Download PDF"
            kind="primary"
          />
          <ExportLink
            href={`/api/demo-export/${encodeURIComponent(upiPath)}/dpp.json`}
            label="JSON"
          />
          <ExportLink
            href={`/api/demo-export/${encodeURIComponent(upiPath)}/credential.vc.json`}
            label="W3C VC"
          />
          <ExportLink href={`/api/demo-export/${encodeURIComponent(upiPath)}/qr.svg`} label="QR" />
        </nav>
      </div>
    </section>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  return (
    <div className="relative grid h-12 w-12 place-items-center">
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--surface-divider)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-green, #5a7a3a)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute font-mono text-[11px] font-semibold tabular-nums text-[var(--fg-default)]">
        {score}
      </span>
    </div>
  )
}

function ExportLink({ href, label, kind }: { href: string; label: string; kind?: 'primary' }) {
  const isPrimary = kind === 'primary'
  return (
    <a
      href={href}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border px-3 text-[12px] font-medium transition',
        isPrimary
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90'
          : 'hover:border-[var(--color-ink)]/40 border-[var(--surface-divider)] bg-[var(--color-paper)] text-[var(--fg-default)]',
      ].join(' ')}
    >
      {label}
    </a>
  )
}
