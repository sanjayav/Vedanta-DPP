import { listPresets } from '@/lib/api'
import { FirePresetButton } from '@/components/console/FirePresetButton'

/**
 * Sources tab · Simulator sub-tab landing.
 * Card grid of HZL-anchored presets per SDD §5.1.5. Click "Fire event" to
 * issue a live DPP via the canonical pipeline.
 */
export default async function SourcesPage() {
  const presets = await listPresets()
  return (
    <div className="px-8 py-8">
      <header className="mb-2 flex items-baseline justify-between">
        <h1 className="text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
          Sources · Simulator
        </h1>
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          {presets.length} presets · auto-publish enabled
        </span>
      </header>
      <p className="text-[14px] text-[var(--fg-muted)]">
        Each preset is seeded with verified HZL values (DNV CFP, IZA Zinc Mark, Serentica 530 MW
        renewables PDA, EPD-IES-0006472). Firing a preset creates a real DPP visible under the DPPs
        tab and on the public viewer.
      </p>

      {presets.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] p-8 text-center text-[14px] text-[var(--fg-subtle)]">
          API unreachable. Run <code className="font-mono">pnpm infra:up</code> then{' '}
          <code className="font-mono">pnpm api:dev</code>.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((p) => (
            <article
              key={p.id}
              className="flex flex-col rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-6"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
                {p.brand} · {p.form.replace(/_/g, ' ')}
              </p>
              <h2 className="mt-2 text-[16px] font-semibold text-[var(--fg-default)]">{p.label}</h2>
              <p className="mt-2 text-[13px] leading-[1.5] text-[var(--fg-muted)]">{p.summary}</p>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-[var(--surface-divider)] pt-5 text-[12px]">
                <div>
                  <dt className="text-[var(--fg-subtle)]">CFP</dt>
                  <dd className="tabular mt-0.5 font-mono text-[14px] text-[var(--fg-default)]">
                    {p.carbon.valueKgCo2ePerTonne.toLocaleString()}
                  </dd>
                  <dd className="text-[10px] text-[var(--fg-subtle)]">kg CO₂e/t</dd>
                </div>
                <div>
                  <dt className="text-[var(--fg-subtle)]">vs industry</dt>
                  <dd className="tabular mt-0.5 font-mono text-[14px] text-[var(--color-green)]">
                    -
                    {Math.round(
                      (1 - p.carbon.valueKgCo2ePerTonne / p.carbon.industryAverageKgCo2ePerTonne) *
                        100,
                    )}
                    %
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--fg-subtle)]">Recycled</dt>
                  <dd className="tabular mt-0.5 font-mono text-[14px] text-[var(--fg-default)]">
                    {p.recycledContent.totalPercent}%
                  </dd>
                </div>
              </dl>
              <div className="mt-6">
                <FirePresetButton presetId={p.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
