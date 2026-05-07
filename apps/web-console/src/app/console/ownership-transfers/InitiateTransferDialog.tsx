'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ArrowRightLeft, Recycle, Send, ShieldCheck, Truck, X } from 'lucide-react'

import { initiateTransferAction } from './actions'
import type { TransferKind } from './store'

interface PassportOption {
  upi: string
  label: string
}

interface Props {
  passports: PassportOption[]
  myEmail: string
}

const KIND_OPTIONS: {
  id: TransferKind
  label: string
  glyph: React.ReactNode
  description: string
}[] = [
  {
    id: 'ownership',
    label: 'Ownership Transfer',
    glyph: <ArrowRightLeft className="h-4 w-4" />,
    description: 'Sale or change of legal owner. Issues a Verifiable Credential to the buyer.',
  },
  {
    id: 'custody',
    label: 'Custody Transfer',
    glyph: <Truck className="h-4 w-4" />,
    description: 'Logistics handover. Tracks chain of custody without changing ownership.',
  },
  {
    id: 'end_of_life',
    label: 'End-of-Life Transfer',
    glyph: <Recycle className="h-4 w-4" />,
    description: 'Hand-off to an accredited recycler. Closes the passport circularity loop.',
  },
]

export function InitiateTransferDialog({ passports, myEmail }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [kind, setKind] = useState<TransferKind>('ownership')
  const [selectedUpi, setSelectedUpi] = useState<string>(passports[0]?.upi ?? '')

  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

  const open = () => {
    setError(null)
    setSuccess(null)
    dialogRef.current?.showModal()
  }
  const close = () => dialogRef.current?.close()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const selected = passports.find((p) => p.upi === fd.get('passportUpi'))
    if (selected) fd.set('productLabel', selected.label)
    startTransition(async () => {
      const result = await initiateTransferAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(`Transfer ${result.id} initiated · pending countersign.`)
      ;(e.target as HTMLFormElement).reset()
      setKind('ownership')
      setSelectedUpi(passports[0]?.upi ?? '')
      close()
    })
  }

  return (
    <>
      <button type="button" onClick={open} className="ot-dlg__trigger">
        <ArrowRightLeft className="h-3.5 w-3.5" /> Initiate Transfer
      </button>

      {success && (
        <div className="ot-dlg__toast" role="status" aria-live="polite">
          <ShieldCheck className="h-4 w-4 text-[var(--color-green,#16a34a)]" />
          <span>{success}</span>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="ot-dlg"
        onClick={(e) => {
          if (e.target === dialogRef.current) close()
        }}
      >
        <div className="ot-dlg__panel">
          <header className="ot-dlg__head">
            <div className="ot-dlg__head-icon">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="ot-dlg__title">Initiate transfer</h2>
              <p className="ot-dlg__sub">
                Issues a signed transfer envelope to the recipient. They countersign with their DID
                key to settle.
              </p>
            </div>
            <button type="button" onClick={close} className="ot-dlg__close" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </header>

          <form className="ot-dlg__form" onSubmit={onSubmit}>
            <fieldset className="ot-dlg__kinds">
              <legend className="ot-dlg__label">Transfer kind</legend>
              <div className="ot-dlg__kind-grid">
                {KIND_OPTIONS.map((k) => {
                  const checked = kind === k.id
                  return (
                    <label
                      key={k.id}
                      className={`ot-dlg__kind${checked ? ' ot-dlg__kind--checked' : ''}`}
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={k.id}
                        checked={checked}
                        onChange={() => setKind(k.id)}
                      />
                      <span className={`ot-dlg__kind-glyph ot-dlg__kind-glyph--${k.id}`}>
                        {k.glyph}
                      </span>
                      <span className="ot-dlg__kind-text">
                        <span className="ot-dlg__kind-name">{k.label}</span>
                        <span className="ot-dlg__kind-summary">{k.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="ot-dlg__field">
              <span className="ot-dlg__label">Passport (cast UPI)</span>
              <select
                name="passportUpi"
                required
                value={selectedUpi}
                onChange={(e) => setSelectedUpi(e.target.value)}
                className="ot-dlg__input ot-dlg__select"
              >
                {passports.length === 0 && <option value="">No passports available</option>}
                {passports.map((p) => (
                  <option key={p.upi} value={p.upi}>
                    {p.label} · {p.upi.split('/').filter(Boolean).slice(-2).join('/')}
                  </option>
                ))}
              </select>
            </label>

            <div className="ot-dlg__row">
              <label className="ot-dlg__field">
                <span className="ot-dlg__label">Recipient organisation</span>
                <input
                  type="text"
                  name="toOrg"
                  required
                  placeholder="Tata Steel · Jamshedpur Galvanising"
                  className="ot-dlg__input"
                />
              </label>
              <label className="ot-dlg__field">
                <span className="ot-dlg__label">Recipient DID</span>
                <input
                  type="text"
                  name="toDid"
                  required
                  placeholder="did:web:tatasteel.com:procurement"
                  className="ot-dlg__input"
                />
              </label>
            </div>

            <div className="ot-dlg__row">
              <label className="ot-dlg__field">
                <span className="ot-dlg__label">Reference (PO / BoL / Manifest)</span>
                <input
                  type="text"
                  name="reference"
                  placeholder="PO-TATA-2026-0418"
                  className="ot-dlg__input"
                />
              </label>
              <label className="ot-dlg__field">
                <span className="ot-dlg__label">Issuer organisation</span>
                <input
                  type="text"
                  name="fromOrg"
                  defaultValue="HZL Commercial Operations"
                  className="ot-dlg__input"
                />
              </label>
            </div>

            <label className="ot-dlg__field">
              <span className="ot-dlg__label">Note (optional)</span>
              <textarea
                name="note"
                rows={2}
                placeholder="Q2 contract delivery #4 · 24t to Jamshedpur."
                className="ot-dlg__input ot-dlg__textarea"
              />
            </label>

            {error && (
              <div className="ot-dlg__error" role="alert">
                {error}
              </div>
            )}

            <footer className="ot-dlg__foot">
              <span className="ot-dlg__hint">
                <ShieldCheck className="inline h-3 w-3 align-text-top" /> Signed by {myEmail} ·
                Ed25519
              </span>
              <div className="ot-dlg__foot-actions">
                <button type="button" onClick={close} className="ot-dlg__btn ot-dlg__btn--ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="ot-dlg__btn ot-dlg__btn--primary"
                >
                  <Send className="h-3.5 w-3.5" />
                  {pending ? 'Issuing…' : 'Sign & send'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </dialog>

      <style>{OT_DIALOG_CSS}</style>
    </>
  )
}

const OT_DIALOG_CSS = `
.ot-dlg__trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px; font-weight: 600;
  box-shadow: 0 6px 16px -4px rgba(15,76,129,0.45);
  transition: opacity 150ms;
}
.ot-dlg__trigger:hover { opacity: 0.92; }

.ot-dlg__toast {
  position: fixed;
  top: 76px; right: 28px;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  box-shadow: 0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08);
  font-size: 13px; font-weight: 500;
  color: var(--fg-default);
  z-index: 60;
  animation: ot-toast-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes ot-toast-in {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ot-dlg {
  border: 0; padding: 0; background: transparent;
  max-width: min(640px, 92vw);
  width: 100%;
  border-radius: 18px;
}
.ot-dlg::backdrop {
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.ot-dlg[open] { animation: ot-dlg-in 220ms cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes ot-dlg-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.ot-dlg__panel {
  background: var(--surface-page);
  border-radius: 18px;
  border: 1px solid var(--surface-border);
  box-shadow: 0 32px 80px -16px rgba(15,23,42,0.30), 0 8px 24px -8px rgba(15,23,42,0.12);
  overflow: hidden;
}
.ot-dlg__head {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--surface-divider);
  background: linear-gradient(180deg, rgba(15,76,129,0.05), transparent 70%);
}
.ot-dlg__head-icon {
  display: grid; place-items: center;
  width: 38px; height: 38px;
  border-radius: 11px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}
.ot-dlg__title {
  font-family: var(--font-display);
  font-size: 18px; font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.ot-dlg__sub { margin-top: 4px; font-size: 12.5px; color: var(--fg-muted); line-height: 1.5; }
.ot-dlg__close {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  color: var(--fg-subtle);
}
.ot-dlg__close:hover { background: var(--surface-hover); color: var(--fg-default); }

.ot-dlg__form {
  padding: 18px 24px 22px;
  display: flex; flex-direction: column; gap: 14px;
}
.ot-dlg__field { display: flex; flex-direction: column; gap: 6px; }
.ot-dlg__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .ot-dlg__row { grid-template-columns: 1fr; } }
.ot-dlg__label {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--fg-subtle); font-weight: 600;
}
.ot-dlg__input {
  height: 40px; padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 13.5px; color: var(--fg-default);
  outline: none;
  transition: border-color 150ms, box-shadow 150ms;
  width: 100%;
}
.ot-dlg__input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(15,76,129,0.12);
}
.ot-dlg__textarea { height: auto; padding: 10px 14px; font-family: var(--font-body); resize: vertical; min-height: 60px; }
.ot-dlg__select { appearance: none; -webkit-appearance: none; padding-right: 28px; cursor: pointer; }

.ot-dlg__kinds { border: 0; padding: 0; margin: 0; }
.ot-dlg__kind-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 6px;
}
@media (min-width: 600px) { .ot-dlg__kind-grid { grid-template-columns: 1fr 1fr 1fr; } }
.ot-dlg__kind {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px;
  border: 1.5px solid var(--surface-border);
  border-radius: 12px;
  background: var(--surface-page);
  cursor: pointer;
  transition: border-color 150ms, background 150ms;
}
.ot-dlg__kind:hover { background: var(--surface-canvas); }
.ot-dlg__kind input { position: absolute; opacity: 0; pointer-events: none; }
.ot-dlg__kind--checked {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: 0 0 0 1px var(--color-accent);
}
.ot-dlg__kind-glyph {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}
.ot-dlg__kind-glyph--ownership { background: rgba(15,76,129,0.10); color: var(--color-accent); }
.ot-dlg__kind-glyph--custody { background: rgba(245,158,11,0.14); color: #b45309; }
.ot-dlg__kind-glyph--end_of_life { background: rgba(22,163,74,0.12); color: #166534; }
.ot-dlg__kind-text { display: flex; flex-direction: column; min-width: 0; }
.ot-dlg__kind-name { font-size: 12.5px; font-weight: 600; color: var(--fg-default); }
.ot-dlg__kind-summary { font-size: 11px; color: var(--fg-muted); margin-top: 2px; line-height: 1.45; }

.ot-dlg__error {
  padding: 10px 14px;
  border-radius: 10px;
  background: #FEF2F2;
  border: 1px solid #FCA5A5;
  color: #991B1B;
  font-size: 12.5px;
}

.ot-dlg__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  margin: 4px -8px -10px;
  border-top: 1px solid var(--surface-divider);
}
.ot-dlg__hint { font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-muted); }
.ot-dlg__foot-actions { display: flex; gap: 8px; }
.ot-dlg__btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 38px; padding: 0 16px;
  border-radius: 10px;
  font-size: 12.5px; font-weight: 600;
  transition: opacity 150ms, background 150ms;
}
.ot-dlg__btn--primary {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 6px 16px -4px rgba(15,76,129,0.45);
}
.ot-dlg__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ot-dlg__btn--primary:hover { opacity: 0.92; }
.ot-dlg__btn--ghost { border: 1px solid var(--surface-border); background: var(--surface-page); color: var(--fg-default); }
.ot-dlg__btn--ghost:hover { background: var(--surface-hover); }
`
