import { IssueCredentialForm } from '@/components/verifier/IssueCredentialForm'

export default function IssuePage() {
  const today = new Date()
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1))
  const yearEnd = new Date(Date.UTC(today.getUTCFullYear(), 11, 31))

  return (
    <div className="px-10 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Issue a Verifiable Credential
        </p>
        <h1 className="font-display mt-2 text-[36px] font-semibold leading-tight text-[var(--fg-default)]">
          New annual CFP statement.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-[var(--fg-muted)]">
          The values here are signed into the platform reference store. The prior active credential
          for this brand is automatically marked superseded. After issuance you can roll forward all
          referencing DPPs in one explicit step.
        </p>
      </header>

      <IssueCredentialForm
        defaults={{
          brand: 'EcoZen SHG 99.995',
          periodFrom: yearStart.toISOString().slice(0, 10),
          periodTo: yearEnd.toISOString().slice(0, 10),
          valueKgCo2ePerTonne: 950,
          statementRef: `DNV-${today.getUTCFullYear()}-ASR-EcoZen`,
          verifierName: 'DNV Business Assurance India',
        }}
      />
    </div>
  )
}
