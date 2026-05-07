'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@dpp/ui'

interface FormDefaults {
  brand: string
  periodFrom: string
  periodTo: string
  valueKgCo2ePerTonne: number
  statementRef: string
  verifierName: string
}

interface IssueResult {
  credentialId: number
  supersededIds: number[]
  affectedDppCount: number
}

const BRANDS = [
  'EcoZen SHG 99.995',
  'CGG Jumbo',
  'Refined Lead 99.99',
  'High-Purity Zinc',
  'Zinc Die-Cast Alloy',
]

export function IssueCredentialForm({ defaults }: { defaults: FormDefaults }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IssueResult | null>(null)

  const [brand, setBrand] = useState(defaults.brand)
  const [periodFrom, setPeriodFrom] = useState(defaults.periodFrom)
  const [periodTo, setPeriodTo] = useState(defaults.periodTo)
  const [value, setValue] = useState(String(defaults.valueKgCo2ePerTonne))
  const [statementRef, setStatementRef] = useState(defaults.statementRef)
  const [verifierName, setVerifierName] = useState(defaults.verifierName)
  const [assurance, setAssurance] = useState<'limited' | 'reasonable'>('limited')

  function submit() {
    setError(null)
    setResult(null)
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('CFP value must be a positive number')
      return
    }
    start(async () => {
      const res = await fetch('/api/verifier/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brand,
          period_from: periodFrom,
          period_to: periodTo,
          value_kg_co2e_per_tonne: numeric,
          statement_ref: statementRef,
          verifier_name: verifierName,
          assurance_level: assurance,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        credentialId?: number
        supersededIds?: number[]
        affectedDppCount?: number
        detail?: string
      }
      if (!res.ok || !body.credentialId) {
        setError(body.detail ?? `HTTP ${res.status}`)
        return
      }
      setResult({
        credentialId: body.credentialId,
        supersededIds: body.supersededIds ?? [],
        affectedDppCount: body.affectedDppCount ?? 0,
      })
      router.refresh()
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-page)] p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Brand">
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[14px] outline-none focus:border-[var(--color-accent)]"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assurance level">
            <select
              value={assurance}
              onChange={(e) => setAssurance(e.target.value as 'limited' | 'reasonable')}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[14px] outline-none focus:border-[var(--color-accent)]"
            >
              <option value="limited">Limited</option>
              <option value="reasonable">Reasonable</option>
            </select>
          </Field>
          <Field label="Reporting period · from">
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[14px]"
            />
          </Field>
          <Field label="Reporting period · to">
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[14px]"
            />
          </Field>
          <Field label="CFP value (kg CO₂e/t)">
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              step="any"
              className="tabular w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 font-mono text-[14px]"
            />
          </Field>
          <Field label="Statement reference">
            <input
              value={statementRef}
              onChange={(e) => setStatementRef(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 font-mono text-[13px]"
            />
          </Field>
          <Field label="Verifier name (display)" full>
            <input
              value={verifierName}
              onChange={(e) => setVerifierName(e.target.value)}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-[14px]"
            />
          </Field>
        </div>
        {error && (
          <p className="mt-4 rounded-[var(--radius-sm)] bg-red-50 p-3 text-[13px] text-red-900">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center gap-4">
          <Button onClick={submit} disabled={pending} loading={pending}>
            {pending ? 'Issuing…' : 'Issue credential'}
          </Button>
          <p className="text-[12px] text-[var(--fg-subtle)]">
            Issuing supersedes the prior active credential for <strong>{brand}</strong>. Rollover is
            a separate explicit action.
          </p>
        </div>
      </section>

      <aside>
        <div className="rounded-[var(--radius-md)] border border-[var(--surface-border)] bg-[var(--surface-recessed)] p-5 text-[13px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
            Methodology
          </p>
          <p className="mt-2 text-[var(--fg-muted)]">
            ISO 14067:2018 + IAI Carbon Footprint Methodology v2.0 + PCR 2022:08 v1.0. The platform
            records the full methodology string on the credential.
          </p>
        </div>
        {result && (
          <div className="border-[var(--color-green)]/40 mt-5 rounded-[var(--radius-md)] border bg-[#DCFCE7] p-5 text-[13px] text-[#166534]">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em]">Credential issued</p>
            <p className="mt-2">
              ID #{result.credentialId} · {result.supersededIds.length} prior credential
              {result.supersededIds.length === 1 ? '' : 's'} marked superseded.
            </p>
            <p className="mt-2">
              {result.affectedDppCount} active DPP
              {result.affectedDppCount === 1 ? '' : 's'} can be rolled forward.
            </p>
            <a
              href={`/verifier/credentials/${result.credentialId}`}
              className="mt-3 inline-block underline underline-offset-4"
            >
              Review affected DPPs →
            </a>
          </div>
        )}
      </aside>
    </div>
  )
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  )
}
