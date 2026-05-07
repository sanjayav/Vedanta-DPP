import { notFound } from 'next/navigation'

import { fetchAssignment } from './client'
import { AssignmentForm } from './AssignmentForm'

export const dynamic = 'force-dynamic'

export default async function AssignmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const data = await fetchAssignment(token)
  if (!data) notFound()

  const { assignment, manifestAttr, draft, currentValue } = data
  const submitted = assignment.status === 'submitted'
  const revoked = assignment.status === 'revoked'

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-6 py-12">
      <div className="mx-auto w-full max-w-[640px]">
        <header className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8A6F3D]">
            Digital Product Passport · Data Request
          </p>
          <h1
            className="mt-3 text-[32px] font-semibold leading-tight text-[#1B1B1B]"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            {draft.productBrand ?? 'HZL'} needs one piece of data from you.
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-[#4A4A4A]">
            For their digital product passport on cast <strong>{draft.castNumber}</strong> (
            {draft.productName}), they've asked you to provide{' '}
            <strong className="text-[#1B1B1B]">{manifestAttr.label}</strong>.
          </p>
        </header>

        <section className="mb-8 rounded-2xl border border-[#E5DCC4] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8A6F3D]">
            Attribute
          </p>
          <h2
            className="mt-1 text-[18px] font-semibold text-[#1B1B1B]"
            style={{ fontFamily: 'Fraunces, serif' }}
          >
            {manifestAttr.label}
          </h2>
          <p className="mt-1 break-all font-mono text-[11px] text-[#8A8A8A]">
            {manifestAttr.attributePath}
          </p>

          {manifestAttr.description && (
            <p className="mt-4 text-[14px] leading-6 text-[#4A4A4A]">{manifestAttr.description}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {manifestAttr.necessity === 'mandatory' && (
              <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#92400E]">
                Required
              </span>
            )}
            {manifestAttr.regulatoryAnchor && (
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-medium text-[#3730A3]">
                {manifestAttr.regulatoryAnchor}
              </span>
            )}
            <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-medium text-[#475569]">
              DPP {manifestAttr.version}
            </span>
          </div>

          {assignment.note && (
            <div className="mt-5 rounded-xl bg-[#FAF6E9] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#8A6F3D]">
                Note from {assignment.assignedBy}
              </p>
              <p className="mt-1 text-[13px] leading-6 text-[#4A4A4A]">{assignment.note}</p>
            </div>
          )}
        </section>

        {revoked ? (
          <Banner tone="muted">This request has been withdrawn. No action is needed.</Banner>
        ) : submitted ? (
          <Banner tone="success">
            You've already submitted this · thank you. The requester has the value{' '}
            {currentValue !== null ? (
              <code className="font-mono text-[12px]">{stringify(currentValue)}</code>
            ) : null}
            .
          </Banner>
        ) : (
          <AssignmentForm
            token={token}
            initial={currentValue}
            assigneeName={assignment.assigneeName ?? assignment.assigneeEmail}
          />
        )}

        <footer className="mt-16 border-t border-[#E5DCC4] pt-6 text-[11px] text-[#8A8A8A]">
          <p>
            This single-use access link only authorises submission of one attribute. Your submitted
            value will appear in the producer's audit log alongside your email · please keep this
            link confidential.
          </p>
        </footer>
      </div>
    </main>
  )
}

function Banner({ tone, children }: { tone: 'success' | 'muted'; children: React.ReactNode }) {
  const cls =
    tone === 'success'
      ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#166534]'
      : 'border-[#E5DCC4] bg-[#FAF6E9] text-[#8A6F3D]'
  return <div className={`rounded-xl border ${cls} p-5 text-[14px] leading-6`}>{children}</div>
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}
