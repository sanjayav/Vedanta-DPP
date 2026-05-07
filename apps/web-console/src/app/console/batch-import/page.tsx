export const revalidate = 30

export default async function BatchImportPage() {
  return (
    <div className="px-8 py-8">
      <header className="mb-6 flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--fg-default)]">
            Batch Import
          </h1>
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            Bulk-import passport data from CSV, Excel, or SAP exports.
          </p>
        </div>
      </header>

      {/* ── Upload zone ────────────────────────────────────────────────── */}
      <section className="mb-8">
        <div className="rounded-[var(--radius-md)] border-2 border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] px-8 py-16 text-center transition-colors hover:border-[var(--color-accent)]">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[var(--surface-page)] text-[32px]">
            📄
          </div>
          <p className="text-[16px] font-semibold text-[var(--fg-default)]">
            Drop files here or click to browse
          </p>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Supported formats: .csv, .xlsx, .json · Maximum 10,000 rows per file
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-5 text-[13px] font-medium text-white hover:opacity-90">
              Upload File
            </button>
            <button className="h-10 rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-5 text-[13px] font-medium text-[var(--fg-default)] hover:bg-[var(--surface-hover)]">
              Download Template
            </button>
          </div>
        </div>
      </section>

      {/* ── Field mapping guide ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Required Fields
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)]">
          <table className="w-full text-[13px]">
            <thead className="bg-[var(--surface-recessed)] text-[11px] uppercase tracking-[0.1em] text-[var(--fg-subtle)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Column</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Example</th>
                <th className="px-4 py-3 text-left font-medium">Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-divider)]">
              {FIELDS.map((f) => (
                <tr key={f.column} className="hover:bg-[var(--surface-hover)]">
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--fg-default)]">
                    {f.column}
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-muted)]">{f.type}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--fg-subtle)]">
                    {f.example}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium ${
                        f.required
                          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                          : 'bg-[var(--surface-hover)] text-[var(--fg-subtle)]'
                      }`}
                    >
                      {f.required ? 'Required' : 'Optional'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Recent imports ──────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Recent Imports
        </h2>
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-recessed)] px-8 py-12 text-center">
          <p className="text-[14px] text-[var(--fg-default)]">No imports yet</p>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            Upload a file above to begin batch-importing zinc & lead passport data.
          </p>
        </div>
      </section>
    </div>
  )
}

const FIELDS = [
  {
    column: 'product_identifier',
    type: 'string',
    example: 'ECOZEN-SHG-99995-001',
    required: true,
  },
  { column: 'brand', type: 'string', example: 'EcoZen SHG 99.995', required: true },
  { column: 'alloy', type: 'IS / ASTM grade', example: 'IS 209:1992 — Zn99.995', required: true },
  { column: 'form', type: 'enum', example: 'sow_ingot', required: true },
  { column: 'weight_kg', type: 'number', example: '850', required: true },
  { column: 'cfp_kg_co2e_per_tonne', type: 'number', example: '950', required: true },
  { column: 'recycled_content_pct', type: 'number (0-100)', example: '5.0', required: true },
  {
    column: 'manufacturer_name',
    type: 'string',
    example: 'Hindustan Zinc Limited',
    required: true,
  },
  { column: 'manufacturing_date', type: 'ISO date', example: '2026-05-01', required: true },
  {
    column: 'manufacturing_facility',
    type: 'string',
    example: 'Chanderiya Lead-Zinc Smelter',
    required: false,
  },
  { column: 'energy_source', type: 'string', example: 'Serentica RE PDA (530 MW)', required: false },
  { column: 'certification', type: 'string', example: 'IZA Zinc Mark', required: false },
]
