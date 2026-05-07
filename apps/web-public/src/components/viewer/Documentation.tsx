import type { ViewerDpp } from '@/lib/dpp-client'

interface Doc {
  id?: string
  /** v1.0 schema field. */
  title?: string
  /** Demo passport legacy field. */
  label?: string
  issuer?: string
  type?: string
  url: string
  sizeKb?: number
  sha256?: string
  tag?: string
  kind?: 'pdf' | 'csv' | 'json'
}

const TYPE_TAG: Record<string, { tag: string; bg: string; fg: string }> = {
  epd: { tag: 'EPD', bg: 'rgba(91, 134, 90, 0.12)', fg: '#3f6c3e' },
  certificate: { tag: 'Cert', bg: 'rgba(40, 88, 138, 0.12)', fg: '#1f4974' },
  test_report: { tag: 'Test', bg: 'rgba(40, 88, 138, 0.12)', fg: '#1f4974' },
  declaration: { tag: 'Decl', bg: 'rgba(120, 84, 184, 0.14)', fg: '#5b3b8c' },
  policy: { tag: 'Policy', bg: 'rgba(10, 10, 10, 0.06)', fg: 'var(--fg-muted)' },
  msds: { tag: 'MSDS', bg: 'rgba(195, 99, 33, 0.14)', fg: '#7c4516' },
  sds: { tag: 'SDS', bg: 'rgba(195, 99, 33, 0.14)', fg: '#7c4516' },
  other: { tag: 'Doc', bg: 'rgba(10, 10, 10, 0.06)', fg: 'var(--fg-muted)' },
}

function tagFor(d: Doc): { tag: string; bg: string; fg: string } {
  if (d.tag) {
    return { tag: d.tag, bg: 'rgba(40, 88, 138, 0.12)', fg: '#1f4974' }
  }
  if (d.type && TYPE_TAG[d.type]) return TYPE_TAG[d.type]!
  return TYPE_TAG.other!
}

function inferKind(d: Doc): string {
  if (d.kind) return d.kind.toUpperCase()
  const url = (d.url ?? '').toLowerCase()
  if (url.endsWith('.pdf')) return 'PDF'
  if (url.endsWith('.csv')) return 'CSV'
  if (url.endsWith('.json')) return 'JSON'
  return 'LINK'
}

export function Documentation({ dpp }: { dpp: ViewerDpp }) {
  const fromDocumentation =
    ((dpp.dpp.documentation as { documents?: unknown } | undefined)?.documents as Doc[] | undefined) ??
    []
  const fromTopLevel = (dpp.dpp.documents as Doc[] | undefined) ?? []
  const docs = [...fromDocumentation, ...fromTopLevel]
  if (docs.length === 0) return null

  return (
    <section className="bg-[var(--surface-recessed)] px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Documentation
        </p>
        <h2 className="font-display mt-2 max-w-3xl text-[clamp(34px,5vw,56px)] font-light leading-[1.05] tracking-[-0.015em] text-[var(--fg-default)]">
          Every document a regulator could ask for, in one place.
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-[1.7] text-[var(--fg-muted)]">
          Each artefact is hash-pinned and signed. Click to download a PDF/CSV; verifiers can pull
          the bundled W3C VC envelope from the export menu above.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
          {docs.map((d, i) => {
            const tag = tagFor(d)
            const title = d.title ?? d.label ?? '(untitled)'
            const sizeMb = d.sizeKb !== undefined ? (d.sizeKb / 1024).toFixed(2) + ' MB' : null
            return (
              <a
                key={d.id ?? `${title}-${i}`}
                href={d.url}
                className="hover:border-[var(--color-ink)]/40 group flex items-start gap-4 rounded-[var(--radius-md)] border border-[var(--surface-divider)] bg-[var(--color-paper)] p-5 transition"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] text-[var(--color-paper)]">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.05em]">
                    {inferKind(d)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-[var(--fg-default)]">{title}</p>
                    <span
                      className="rounded-[var(--radius-pill)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                      style={{ background: tag.bg, color: tag.fg }}
                    >
                      {tag.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    {d.issuer ? `Issued by ${d.issuer}` : 'Issued document'}
                    {sizeMb ? ` · ${sizeMb}` : ''}
                  </p>
                  {d.sha256 ? (
                    <p className="mt-1 break-all font-mono text-[10px] text-[var(--fg-subtle)]">
                      SHA-256 {d.sha256}
                    </p>
                  ) : null}
                </div>
                <span className="mt-1 shrink-0 text-[11px] font-medium text-[var(--fg-muted)] transition group-hover:text-[var(--fg-default)]">
                  Open ↗
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
