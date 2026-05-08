'use client'

import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { toast } from '@dpp/ui'

type Kind = 'pending' | 'member' | 'suspended'

interface Item {
  label: string
  danger?: boolean
  onClick?: () => void
}

const ITEMS: Record<Kind, Item[]> = {
  pending: [
    { label: 'Resend invitation', onClick: () => toast({ tone: 'info', title: 'Invitation resent' }) },
    { label: 'Copy invite link', onClick: () => toast({ tone: 'success', title: 'Invite link copied' }) },
    { label: 'Change role', onClick: () => toast({ tone: 'info', title: 'Role change · open dialog' }) },
    { label: 'Revoke invite', danger: true, onClick: () => toast({ tone: 'warning', title: 'Invite revoked' }) },
  ],
  member: [
    { label: 'Edit profile' },
    { label: 'Change role' },
    { label: 'Reset MFA', onClick: () => toast({ tone: 'info', title: 'MFA reset · the user will be prompted at next sign-in' }) },
    { label: 'View activity' },
    { label: 'Suspend access', danger: true, onClick: () => toast({ tone: 'warning', title: 'Member suspended · session keys rotated' }) },
  ],
  suspended: [
    { label: 'Reinstate', onClick: () => toast({ tone: 'success', title: 'Access reinstated' }) },
    { label: 'View activity' },
    { label: 'Delete record', danger: true, onClick: () => toast({ tone: 'error', title: 'Record deleted' }) },
  ],
}

export function TeamRowMenu({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="team__menu">
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open member actions"
        className="team__menu-trigger"
      >
        <MoreHorizontal className="h-4 w-4" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.ul
            key="menu"
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className="team__menu-list"
          >
            {ITEMS[kind].map((item, i) => (
              <li key={`${kind}-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    item.onClick?.()
                    setOpen(false)
                  }}
                  className={`team__menu-item${item.danger ? ' team__menu-item--danger' : ''}`}
                  role="menuitem"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <style>{MENU_CSS}</style>
    </div>
  )
}

const MENU_CSS = `
.team__menu {
  position: relative;
  flex-shrink: 0;
}
.team__menu-trigger {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  color: var(--fg-subtle);
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  transition: background 120ms, color 120ms, border-color 120ms;
}
.team__menu-trigger:hover {
  background: var(--surface-hover);
  color: var(--fg-default);
  border-color: var(--surface-border);
}
.team__menu-list {
  position: absolute;
  right: 0; top: calc(100% + 6px);
  min-width: 184px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  border-radius: 10px;
  box-shadow:
    0 18px 36px -12px rgba(15,23,42,0.24),
    0 4px 8px -4px rgba(15,23,42,0.10);
  padding: 4px;
  z-index: 50;
  list-style: none;
  margin: 0;
}
.team__menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12.5px;
  text-align: left;
  color: var(--fg-default);
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: background 120ms;
}
.team__menu-item:hover { background: var(--surface-hover); }
.team__menu-item--danger { color: #B91C1C; }
.team__menu-item--danger:hover { background: rgba(220,38,38,0.06); }
`
