'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Send, ShieldCheck, UserPlus, X } from 'lucide-react'

import { ROLE_PROFILES, type TenantRole } from '@/lib/rbac'

import { inviteMemberAction } from './actions'

interface Props {
  /** Roles the current user is allowed to grant (filtered by `canManage`). */
  grantableRoles: TenantRole[]
  /** Used as the form's hint copy. */
  myEmail: string
}

/** Native <dialog>-driven invite modal. Renders the trigger button itself
 *  so the parent server component just drops it into the action bar. */
export function InviteMemberDialog({ grantableRoles, myEmail }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<TenantRole>(grantableRoles[0] ?? 'dpp_operator')

  useEffect(() => {
    // Auto-dismiss the success toast after a moment.
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
    startTransition(async () => {
      const result = await inviteMemberAction(fd)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSuccess(`Invitation sent to ${result.email}`)
      ;(e.target as HTMLFormElement).reset()
      setSelectedRole(grantableRoles[0] ?? 'dpp_operator')
      close()
    })
  }

  const roleProfile = ROLE_PROFILES[selectedRole]

  return (
    <>
      <button type="button" onClick={open} className="invite-dlg__trigger">
        <UserPlus className="h-3.5 w-3.5" /> Invite Member
      </button>

      {success && (
        <div className="invite-dlg__toast" role="status" aria-live="polite">
          <ShieldCheck className="h-4 w-4 text-[var(--color-green,#16a34a)]" />
          <span>{success}</span>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="invite-dlg"
        onClick={(e) => {
          // Click on the backdrop closes; click inside the panel doesn't.
          if (e.target === dialogRef.current) close()
        }}
        onClose={() => {
          setError(null)
        }}
      >
        <div className="invite-dlg__panel">
          <header className="invite-dlg__head">
            <div className="invite-dlg__head-icon">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="invite-dlg__title">Invite a team member</h2>
              <p className="invite-dlg__sub">
                They&apos;ll get a single-use sign-in link via email. MFA is enforced on first
                login.
              </p>
            </div>
            <button type="button" onClick={close} className="invite-dlg__close" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </header>

          <form className="invite-dlg__form" onSubmit={onSubmit}>
            <label className="invite-dlg__field">
              <span className="invite-dlg__label">Email</span>
              <input
                type="email"
                name="email"
                required
                autoFocus
                placeholder="colleague@vedanta.co.in"
                className="invite-dlg__input"
              />
            </label>

            <label className="invite-dlg__field">
              <span className="invite-dlg__label">Display name (optional)</span>
              <input
                type="text"
                name="name"
                placeholder="Full name"
                className="invite-dlg__input"
              />
            </label>

            <fieldset className="invite-dlg__roles">
              <legend className="invite-dlg__label">Role</legend>
              <div className="invite-dlg__role-grid">
                {grantableRoles.map((r) => {
                  const p = ROLE_PROFILES[r]
                  const checked = selectedRole === r
                  return (
                    <label
                      key={r}
                      className={`invite-dlg__role${checked ? ' invite-dlg__role--checked' : ''}`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={checked}
                        onChange={() => setSelectedRole(r)}
                      />
                      <span className={`invite-dlg__role-glyph invite-dlg__role-glyph--${p.tone}`}>
                        {p.glyph}
                      </span>
                      <span className="invite-dlg__role-text">
                        <span className="invite-dlg__role-name">{p.label}</span>
                        <span className="invite-dlg__role-summary">{p.shortLabel}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="invite-dlg__permpreview">
              <p className="invite-dlg__permpreview-label">Will be granted</p>
              <p className="invite-dlg__permpreview-detail">{roleProfile.summary}</p>
            </div>

            {error && (
              <div className="invite-dlg__error" role="alert">
                {error}
              </div>
            )}

            <footer className="invite-dlg__foot">
              <span className="invite-dlg__hint">
                <ShieldCheck className="inline h-3 w-3 align-text-top" /> Sent from {myEmail}
              </span>
              <div className="invite-dlg__foot-actions">
                <button
                  type="button"
                  onClick={close}
                  className="invite-dlg__btn invite-dlg__btn--ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="invite-dlg__btn invite-dlg__btn--primary"
                >
                  <Send className="h-3.5 w-3.5" />
                  {pending ? 'Sending…' : 'Send invitation'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </dialog>

      <style>{DIALOG_CSS}</style>
    </>
  )
}

const DIALOG_CSS = `
.invite-dlg__trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: 8px;
  background: var(--color-accent);
  color: #fff;
  font-size: 12px; font-weight: 600;
  box-shadow: 0 6px 16px -4px rgba(15,76,129,0.45);
  transition: opacity 150ms;
}
.invite-dlg__trigger:hover { opacity: 0.92; }

.invite-dlg__toast {
  position: fixed;
  top: 76px;
  right: 28px;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  box-shadow: 0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 8px -4px rgba(15,23,42,0.08);
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-default);
  z-index: 60;
  animation: invite-toast-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes invite-toast-in {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.invite-dlg {
  border: 0;
  padding: 0;
  background: transparent;
  max-width: min(560px, 92vw);
  width: 100%;
  border-radius: 18px;
}
.invite-dlg::backdrop {
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.invite-dlg[open] {
  animation: invite-dlg-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes invite-dlg-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.invite-dlg__panel {
  background: var(--surface-page);
  border-radius: 18px;
  border: 1px solid var(--surface-border);
  box-shadow: 0 32px 80px -16px rgba(15,23,42,0.30), 0 8px 24px -8px rgba(15,23,42,0.12);
  overflow: hidden;
}

.invite-dlg__head {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--surface-divider);
  background: linear-gradient(180deg, rgba(15,76,129,0.04), transparent 70%);
}
.invite-dlg__head-icon {
  display: grid; place-items: center;
  width: 38px; height: 38px;
  border-radius: 11px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  flex-shrink: 0;
}
.invite-dlg__title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.invite-dlg__sub {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--fg-muted);
  line-height: 1.5;
}
.invite-dlg__close {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  color: var(--fg-subtle);
  transition: background 150ms, color 150ms;
}
.invite-dlg__close:hover {
  background: var(--surface-hover);
  color: var(--fg-default);
}

.invite-dlg__form {
  padding: 20px 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.invite-dlg__field {
  display: flex; flex-direction: column; gap: 6px;
}
.invite-dlg__label {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 600;
}
.invite-dlg__input {
  height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-size: 13.5px;
  color: var(--fg-default);
  outline: none;
  transition: border-color 150ms, box-shadow 150ms;
}
.invite-dlg__input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(15,76,129,0.12);
}

.invite-dlg__roles { border: 0; padding: 0; margin: 0; }
.invite-dlg__role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  margin-top: 6px;
}
.invite-dlg__role {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border: 1.5px solid var(--surface-border);
  border-radius: 10px;
  background: var(--surface-page);
  cursor: pointer;
  transition: border-color 150ms, background 150ms, transform 100ms;
}
.invite-dlg__role:hover { background: var(--surface-canvas); }
.invite-dlg__role:active { transform: scale(0.99); }
.invite-dlg__role input { position: absolute; opacity: 0; pointer-events: none; }
.invite-dlg__role--checked {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  box-shadow: 0 0 0 1px var(--color-accent);
}
.invite-dlg__role-glyph {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 14px; font-weight: 700;
  flex-shrink: 0;
}
.invite-dlg__role-glyph--accent { background: var(--color-accent-soft); color: var(--color-accent); }
.invite-dlg__role-glyph--success { background: rgba(22,163,74,0.12); color: #166534; }
.invite-dlg__role-glyph--warning { background: rgba(245,158,11,0.14); color: #92400e; }
.invite-dlg__role-glyph--info { background: rgba(15,76,129,0.10); color: var(--color-accent); }
.invite-dlg__role-glyph--neutral { background: var(--surface-hover); color: var(--fg-muted); }
.invite-dlg__role-text { display: flex; flex-direction: column; min-width: 0; }
.invite-dlg__role-name {
  font-size: 12.5px; font-weight: 600;
  color: var(--fg-default);
}
.invite-dlg__role-summary {
  font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: 0.1em;
  color: var(--fg-muted);
  text-transform: uppercase;
}

.invite-dlg__permpreview {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--surface-canvas);
  border: 1px dashed var(--surface-border);
}
.invite-dlg__permpreview-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.invite-dlg__permpreview-detail {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--fg-default);
  line-height: 1.55;
}

.invite-dlg__error {
  padding: 10px 14px;
  border-radius: 10px;
  background: #FEF2F2;
  border: 1px solid #FCA5A5;
  color: #991B1B;
  font-size: 12.5px;
}

.invite-dlg__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  margin: 4px -8px -10px;
  border-top: 1px solid var(--surface-divider);
}
.invite-dlg__hint {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-muted);
}
.invite-dlg__foot-actions { display: flex; gap: 8px; }
.invite-dlg__btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 600;
  transition: opacity 150ms, background 150ms;
}
.invite-dlg__btn--primary {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 6px 16px -4px rgba(15,76,129,0.45);
}
.invite-dlg__btn--primary:hover { opacity: 0.92; }
.invite-dlg__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
.invite-dlg__btn--ghost {
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  color: var(--fg-default);
}
.invite-dlg__btn--ghost:hover { background: var(--surface-hover); }
`
