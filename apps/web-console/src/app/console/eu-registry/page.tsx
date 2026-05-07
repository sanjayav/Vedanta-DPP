import Link from 'next/link'

import { Badge, type BadgeTone } from '@dpp/ui'

import { listDpps } from '@/lib/api'

export const revalidate = 30

const STATUS_TONE: Record<string, BadgeTone> = {
  active: 'success',
  pending: 'warning',
  revoked: 'critical',
}

export default async function EuRegistryPage() {
  const list = await listDpps({ limit: 500 })

  // Simulate registry entries from DPPs
  const registryEntries = list.items
    .filter((dpp) => dpp.state === 'published')
    .map((dpp, idx) => ({
      registryId: `REG-${(idx + 1).toString().padStart(4, '0')}`,
      upi: dpp.upi,
      reoId: 'EORI-IN-HZL-001',
      liveUrl: `/dpp/${dpp.upi}`,
      registeredAt: dpp.issuedAt?.slice(0, 10) ?? '—',
      status: 'active' as const,
    }))

  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            EU Registry
          </h1>
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            {registryEntries.length} registered passports
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] px-3 text-[12px] text-[var(--fg-subtle)]">
            Search registry…
          </div>
          <button className="h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-[12px] font-medium text-white hover:opacity-90">
            + Register Passport
          </button>
          <button className="h-8 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 text-[12px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]">
            Refresh
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface-recessed)] text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Registry ID</th>
                <th className="px-4 py-3 text-left font-medium">UPI</th>
                <th className="px-4 py-3 text-left font-medium">REO ID</th>
                <th className="px-4 py-3 text-left font-medium">Live URL</th>
                <th className="px-4 py-3 text-left font-medium">Registered At</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-divider)]">
              {registryEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-[14px] text-[var(--fg-subtle)]"
                  >
                    No passports registered in the EU registry yet.{' '}
                    <Link
                      href="/console/dpps"
                      className="text-[var(--color-accent)] hover:underline"
                    >
                      Issue passports first
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {registryEntries.map((entry) => (
                <tr key={entry.registryId} className="hover:bg-[var(--surface-hover)]">
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--fg-default)]">
                    {entry.registryId}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/console/dpps/${encodeURIComponent(entry.upi)}`}
                      className="inline-block max-w-[280px] truncate font-mono text-[12px] text-[var(--color-accent)] hover:underline"
                      title={entry.upi}
                    >
                      {entry.upi}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--fg-muted)]">
                    {entry.reoId}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={entry.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] text-[var(--fg-muted)] hover:text-[var(--fg-default)]"
                    >
                      ↗ View
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--fg-muted)]">
                    {entry.registeredAt}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[entry.status] ?? 'neutral'}>
                      {entry.status.toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
