import Link from 'next/link'
import { ArrowRight, FileText, Layers, Plus, Sparkles } from 'lucide-react'

import { Badge } from '@dpp/ui'
import { listDrafts } from '@/lib/draft-api'
import { listProductPortfolio } from '@/lib/product-api'
import type { ProductSummary } from '@/lib/product-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isFeatured(p: ProductSummary): boolean {
  const featured = (p.details as Record<string, unknown>)?.featured
  return featured === true
}

export default async function CreatePassportLandingPage() {
  const [drafts, portfolio] = await Promise.all([listDrafts(), listProductPortfolio()])
  const featured = (portfolio?.products ?? []).filter(isFeatured)
  const lockedCount = featured.filter((p) => p.dppConfigs.some((c) => c.state === 'locked')).length

  return (
    <div className="mx-auto w-full max-w-[1200px] px-7 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-accent)]">
            Authoring
          </p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight text-[var(--fg-default)]">
            Create Passport
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-[var(--fg-muted)]">
            Author a digital product passport for one cast of a Hindustan Zinc product. Each
            passport flows through five steps: pick the product, confirm the production chain,
            choose the DPP version, review the parameter roster, and identify the cast.
          </p>
        </div>
        <Link
          href="/console/create-passport/new"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] transition hover:opacity-90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Start new passport
        </Link>
      </header>

      <section className="mb-10 rounded-[var(--radius-lg)] border border-[var(--surface-border)] bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--color-accent)]" />
            <h2 className="text-[15px] font-semibold text-[var(--fg-default)]">HZL portfolio</h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--fg-subtle)]">
            {lockedCount}/{featured.length} ready
          </span>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--color-fog)] p-5 text-[13px] text-[var(--fg-muted)]">
            No featured products yet. Visit{' '}
            <Link
              href="/console/onboarding"
              className="font-medium text-[var(--color-accent)] underline"
            >
              Onboarding
            </Link>{' '}
            to lock a (product, version) pair.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {featured.map((p) => {
              const locked = p.dppConfigs.filter((c) => c.state === 'locked')
              return (
                <li
                  key={p.id}
                  className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-canvas)] p-4"
                >
                  <span
                    className={[
                      'inline-flex h-6 items-center rounded-[var(--radius-pill)] px-2 text-[9px] font-semibold uppercase tracking-wider',
                      p.brand === 'EcoZen'
                        ? 'bg-[#DCFCE7] text-[#166534]'
                        : p.brand === 'CGG' || p.brand === 'CGG Jumbo'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : p.brand === 'Vedanta 99.99'
                            ? 'bg-[#E0E7FF] text-[#3730A3]'
                            : 'bg-white text-[var(--fg-default)]',
                    ].join(' ')}
                  >
                    {p.brand}
                  </span>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--fg-default)]">
                    {p.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--fg-subtle)]">
                    {p.alloyFamily}
                  </p>
                  <p className="mt-3 flex flex-wrap gap-1 text-[10px]">
                    {locked.length === 0 ? (
                      <span className="text-[var(--fg-subtle)]">No locked version</span>
                    ) : (
                      locked.map((c) => (
                        <span
                          key={c.version}
                          className="rounded-[var(--radius-pill)] bg-[#DCFCE7] px-1.5 py-0.5 font-mono font-semibold text-[#166534]"
                        >
                          DPP v{c.version}
                        </span>
                      ))
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--fg-subtle)]" />
          <h2 className="text-[15px] font-semibold text-[var(--fg-default)]">In-progress drafts</h2>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--color-fog)] p-6 text-center text-[13px] text-[var(--fg-muted)]">
            No drafts yet.{' '}
            <Link
              href="/console/create-passport/new"
              className="inline-flex items-center gap-1 font-medium text-[var(--color-accent)] hover:underline"
            >
              <Plus className="h-3 w-3" />
              Start a new passport
            </Link>{' '}
            to begin.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/console/create-passport/${d.id}`}
                  className="group flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-white p-4 transition hover:border-[var(--color-accent)] hover:bg-[var(--color-fog)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--fg-default)]">
                        {d.productName ?? '—'} <span className="text-[var(--fg-subtle)]">·</span>{' '}
                        Cast {d.castNumber}
                      </p>
                      <p className="text-[11px] text-[var(--fg-subtle)]">
                        DPP {d.dppVersion} · created by {d.createdBy} · {fmt(d.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DraftStateBadge state={d.state} />
                    <ArrowRight className="h-4 w-4 text-[var(--fg-subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DraftStateBadge({ state }: { state: string }) {
  const map: Record<string, { tone: 'neutral' | 'info' | 'success' | 'warning'; label: string }> = {
    entry: { tone: 'info', label: 'Entry' },
    disclosure: { tone: 'warning', label: 'Disclosure' },
    published: { tone: 'success', label: 'Published' },
    archived: { tone: 'neutral', label: 'Archived' },
  }
  const { tone, label } = map[state] ?? { tone: 'neutral', label: state }
  return <Badge tone={tone}>{label}</Badge>
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
