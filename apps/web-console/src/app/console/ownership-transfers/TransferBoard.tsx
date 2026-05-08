'use client'

import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  Circle,
  CircleDashed,
  CircleSlash,
  Clock,
  ExternalLink,
  FileText,
  Recycle,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react'
import { useMemo, useState, useTransition, type ReactNode } from 'react'

import { toast } from '@dpp/ui'

import { cancelTransferAction, rejectTransferAction, settleTransferAction } from './actions'
import type { Transfer, TransferKind, TransferState } from './store'

const KIND_LABEL: Record<TransferKind, string> = {
  ownership: 'Ownership',
  custody: 'Custody',
  end_of_life: 'End-of-Life',
}

const KIND_ICON: Record<TransferKind, React.ComponentType<{ className?: string }>> = {
  ownership: ArrowRightLeft,
  custody: Truck,
  end_of_life: Recycle,
}

const KIND_TINT: Record<TransferKind, { bg: string; fg: string; ring: string }> = {
  ownership: { bg: 'rgba(15,76,129,0.10)', fg: '#0F4C81', ring: 'rgba(15,76,129,0.28)' },
  custody: { bg: 'rgba(217,119,6,0.12)', fg: '#B45309', ring: 'rgba(217,119,6,0.28)' },
  end_of_life: { bg: 'rgba(22,163,74,0.10)', fg: '#16A34A', ring: 'rgba(22,163,74,0.28)' },
}

interface ColumnDef {
  key: 'pending_countersign' | 'settled' | 'closed'
  label: string
  hint: string
  accent: string
  bg: string
  fg: string
  /** Which transfer states feed into this column. */
  match: (s: TransferState) => boolean
  icon: React.ComponentType<{ className?: string }>
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'pending_countersign',
    label: 'Pending countersign',
    hint: 'Waiting on recipient',
    accent: '#D97706',
    bg: 'linear-gradient(180deg, rgba(254, 243, 199, 0.65) 0%, rgba(254, 243, 199, 0.10) 100%)',
    fg: '#92400E',
    match: (s) => s === 'pending_countersign' || s === 'draft',
    icon: Clock,
  },
  {
    key: 'settled',
    label: 'Settled',
    hint: 'VC issued · audit-logged',
    accent: '#16A34A',
    bg: 'linear-gradient(180deg, rgba(220, 252, 231, 0.65) 0%, rgba(220, 252, 231, 0.10) 100%)',
    fg: '#14532D',
    match: (s) => s === 'settled',
    icon: Check,
  },
  {
    key: 'closed',
    label: 'Closed',
    hint: 'Rejected · disputed',
    accent: '#94A3B8',
    bg: 'linear-gradient(180deg, rgba(241, 245, 249, 0.65) 0%, rgba(241, 245, 249, 0.10) 100%)',
    fg: '#475569',
    match: (s) => s === 'rejected' || s === 'disputed',
    icon: CircleSlash,
  },
]

export function TransferBoard({
  transfers,
  canAct,
}: {
  transfers: Transfer[]
  canAct: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = transfers.find((t) => t.id === openId) ?? null

  const buckets = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      items: transfers.filter((t) => col.match(t.state)),
    }))
  }, [transfers])

  if (transfers.length === 0) {
    return (
      <div className="ot-board-empty">
        <p className="ot-board-empty__title">No transfers yet</p>
        <p className="ot-board-empty__sub">
          Initiate the first ownership transfer · the recipient countersigns and a Verifiable
          Credential is issued to their DID.
        </p>
      </div>
    )
  }

  return (
    <>
      <style>{BOARD_CSS}</style>
      <div className="ot-board">
        {buckets.map((col) => {
          const Icon = col.icon
          return (
            <section
              key={col.key}
              className="ot-col"
              style={{ ['--col-accent' as string]: col.accent }}
            >
              <header className="ot-col__head" style={{ background: col.bg }}>
                <div className="ot-col__head-left">
                  <span className="ot-col__icon" style={{ color: col.fg }}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="ot-col__label" style={{ color: col.fg }}>
                      {col.label}
                    </p>
                    <p className="ot-col__hint">{col.hint}</p>
                  </div>
                </div>
                <span
                  className="ot-col__count"
                  style={{
                    color: col.fg,
                    background: 'rgba(255,255,255,0.85)',
                    borderColor: col.accent,
                  }}
                >
                  {col.items.length}
                </span>
              </header>

              <ol className="ot-col__list">
                <AnimatePresence initial={false}>
                  {col.items.length === 0 ? (
                    <motion.li
                      key={`${col.key}-empty`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="ot-col__empty"
                    >
                      <CircleDashed className="h-3.5 w-3.5" />
                      <span>Nothing here yet</span>
                    </motion.li>
                  ) : (
                    col.items.map((t, i) => (
                      <TransferCard
                        key={t.id}
                        t={t}
                        index={i}
                        isOpen={openId === t.id}
                        onOpen={() => setOpenId(t.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </ol>
            </section>
          )
        })}
      </div>

      <TransferDetailDrawer
        transfer={open}
        canAct={canAct}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}

function TransferCard({
  t,
  index,
  isOpen,
  onOpen,
}: {
  t: Transfer
  index: number
  isOpen: boolean
  onOpen: () => void
}) {
  const Icon = KIND_ICON[t.kind]
  const tint = KIND_TINT[t.kind]
  const recipientInitial = t.toOrg.charAt(0).toUpperCase()
  const senderInitial = t.fromOrg.charAt(0).toUpperCase()

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{
        duration: 0.32,
        delay: index * 0.03,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.button
        type="button"
        onClick={onOpen}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        className={`ot-card ${isOpen ? 'is-open' : ''}`}
      >
        <div className="ot-card__head">
          <span
            className="ot-card__kind"
            style={{ background: tint.bg, color: tint.fg, borderColor: tint.ring }}
          >
            <Icon className="h-3 w-3" />
            {KIND_LABEL[t.kind]}
          </span>
          {t.state === 'disputed' && (
            <span className="ot-card__badge" title="Disputed · under verifier review">
              <ShieldAlert className="h-3 w-3" />
            </span>
          )}
          {t.state === 'pending_countersign' && (
            <span className="ot-card__pulse" aria-hidden>
              <span className="ot-card__pulse-dot" />
              <span className="ot-card__pulse-ring" />
            </span>
          )}
        </div>

        <p className="ot-card__product">{t.productLabel}</p>

        <div className="ot-card__chain">
          <span className="ot-card__avatar" title={t.fromOrg}>
            {senderInitial}
          </span>
          <span className="ot-card__chain-arrow" aria-hidden>
            <ChevronRight className="h-3 w-3" />
          </span>
          <span className="ot-card__avatar ot-card__avatar--recipient" title={t.toOrg}>
            {recipientInitial}
          </span>
          <p className="ot-card__recipient" title={t.toOrg}>
            {t.toOrg}
          </p>
        </div>

        <div className="ot-card__meta">
          <span className="ot-card__time" title={t.initiatedAt}>
            <Clock className="h-3 w-3" />
            {formatRelative(t.initiatedAt)}
          </span>
          {t.reference && (
            <span className="ot-card__ref" title={`Reference: ${t.reference}`}>
              <FileText className="h-3 w-3" />
              {t.reference}
            </span>
          )}
        </div>
      </motion.button>
    </motion.li>
  )
}

function TransferDetailDrawer({
  transfer,
  canAct,
  onClose,
}: {
  transfer: Transfer | null
  canAct: boolean
  onClose: () => void
}) {
  const [pending, startTransition] = useTransition()

  function settle() {
    if (!transfer) return
    startTransition(async () => {
      try {
        await settleTransferAction(transfer.id)
        toast({
          tone: 'success',
          title: 'Transfer settled',
          description: `VC issued · ${transfer.toOrg}`,
        })
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Settle failed',
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    })
  }
  function reject() {
    if (!transfer) return
    startTransition(async () => {
      try {
        await rejectTransferAction(transfer.id)
        toast({ tone: 'warning', title: 'Transfer rejected', description: transfer.toOrg })
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Reject failed',
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    })
  }
  function cancel() {
    if (!transfer) return
    startTransition(async () => {
      try {
        await cancelTransferAction(transfer.id)
        toast({ tone: 'info', title: 'Transfer cancelled', description: transfer.id })
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Cancel failed',
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <AnimatePresence>
      {transfer && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[800] bg-[rgba(15,23,42,0.32)] backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Transfer ${transfer.id}`}
            className="ot-drawer"
          >
            <DrawerContents
              transfer={transfer}
              canAct={canAct}
              pending={pending}
              onSettle={settle}
              onReject={reject}
              onCancel={cancel}
              onClose={onClose}
            />
            <style>{DRAWER_CSS}</style>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function DrawerContents({
  transfer,
  canAct,
  pending,
  onSettle,
  onReject,
  onCancel,
  onClose,
}: {
  transfer: Transfer
  canAct: boolean
  pending: boolean
  onSettle: () => void
  onReject: () => void
  onCancel: () => void
  onClose: () => void
}) {
  const Icon = KIND_ICON[transfer.kind]
  const tint = KIND_TINT[transfer.kind]
  return (
    <>
      <header className="ot-drawer__head">
        <div className="ot-drawer__head-block">
          <span
            className="ot-drawer__icon"
            style={{ background: tint.bg, color: tint.fg, borderColor: tint.ring }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="ot-drawer__eyebrow">{KIND_LABEL[transfer.kind]} transfer</p>
            <h2 className="ot-drawer__title">{transfer.productLabel}</h2>
          </div>
        </div>
        <button type="button" onClick={onClose} className="ot-drawer__close" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </header>

      <section className="ot-drawer__chain">
        <Party org={transfer.fromOrg} did={transfer.fromDid} role="From" />
        <div className="ot-drawer__chain-arrow" aria-hidden>
          <motion.span
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </motion.span>
        </div>
        <Party org={transfer.toOrg} did={transfer.toDid} role="To" highlight />
      </section>

      <dl className="ot-drawer__grid">
        <Cell label="State">
          <StateChip state={transfer.state} />
        </Cell>
        <Cell label="Reference">
          {transfer.reference ? (
            <code className="ot-drawer__mono">{transfer.reference}</code>
          ) : (
            '—'
          )}
        </Cell>
        <Cell label="Initiated">
          <span className="ot-drawer__time">{formatAbsolute(transfer.initiatedAt)}</span>
          <span className="ot-drawer__sub">{formatRelative(transfer.initiatedAt)}</span>
        </Cell>
        <Cell label={transfer.state === 'settled' ? 'Settled' : 'Counter-signed'}>
          {transfer.settledAt || transfer.countersignedAt ? (
            <>
              <span className="ot-drawer__time">
                {formatAbsolute(transfer.settledAt ?? transfer.countersignedAt!)}
              </span>
              <span className="ot-drawer__sub">
                by {transfer.countersignedBy ?? '—'}
              </span>
            </>
          ) : (
            <span className="ot-drawer__sub">Awaiting recipient</span>
          )}
        </Cell>
        <Cell label="Initiated by">{transfer.initiatedBy}</Cell>
        <Cell label="Passport UPI">
          <code className="ot-drawer__mono ot-drawer__mono--break">{transfer.passportUpi}</code>
        </Cell>
      </dl>

      {transfer.credentialId && (
        <section className="ot-drawer__vc">
          <p className="ot-drawer__section-label">Verifiable credential</p>
          <div className="ot-drawer__vc-row">
            <span className="ot-drawer__vc-key">VC id</span>
            <code className="ot-drawer__mono">{transfer.credentialId}</code>
          </div>
          {transfer.bodySha256 && (
            <div className="ot-drawer__vc-row">
              <span className="ot-drawer__vc-key">Body SHA-256</span>
              <code className="ot-drawer__mono">{transfer.bodySha256}</code>
            </div>
          )}
        </section>
      )}

      {transfer.note && (
        <section className="ot-drawer__note">
          <p className="ot-drawer__section-label">Operator note</p>
          <p className="ot-drawer__note-body">{transfer.note}</p>
        </section>
      )}

      {canAct && transfer.state === 'pending_countersign' && (
        <footer className="ot-drawer__actions">
          <motion.button
            type="button"
            onClick={onSettle}
            disabled={pending}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="ot-drawer__btn ot-drawer__btn--primary"
          >
            <Check className="h-3.5 w-3.5" />
            Counter-sign and settle
          </motion.button>
          <motion.button
            type="button"
            onClick={onReject}
            disabled={pending}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="ot-drawer__btn ot-drawer__btn--ghost"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </motion.button>
          <motion.button
            type="button"
            onClick={onCancel}
            disabled={pending}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="ot-drawer__btn ot-drawer__btn--danger"
          >
            Cancel
          </motion.button>
        </footer>
      )}

      {transfer.state === 'settled' && transfer.credentialId && (
        <footer className="ot-drawer__actions">
          <motion.a
            href="#"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="ot-drawer__btn ot-drawer__btn--primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View VC envelope
          </motion.a>
        </footer>
      )}
    </>
  )
}

function Party({
  org,
  did,
  role,
  highlight,
}: {
  org: string
  did: string
  role: string
  highlight?: boolean
}) {
  const initial = org.charAt(0).toUpperCase()
  return (
    <div className={`ot-party${highlight ? ' is-highlight' : ''}`}>
      <span className="ot-party__avatar">{initial}</span>
      <div className="min-w-0">
        <p className="ot-party__role">{role}</p>
        <p className="ot-party__org" title={org}>
          {org}
        </p>
        <p className="ot-party__did" title={did}>
          {did}
        </p>
      </div>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ot-drawer__cell">
      <dt className="ot-drawer__cell-label">{label}</dt>
      <dd className="ot-drawer__cell-value">{children}</dd>
    </div>
  )
}

const STATE_CHIP: Record<TransferState, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: 'rgba(148,163,184,0.18)', fg: '#475569' },
  pending_countersign: { label: 'Pending countersign', bg: 'rgba(245,158,11,0.14)', fg: '#92400e' },
  settled: { label: 'Settled', bg: 'rgba(22,163,74,0.14)', fg: '#14532d' },
  rejected: { label: 'Rejected', bg: 'rgba(148,163,184,0.18)', fg: '#475569' },
  disputed: { label: 'Disputed', bg: 'rgba(220,38,38,0.12)', fg: '#991b1b' },
}

function StateChip({ state }: { state: TransferState }) {
  const s = STATE_CHIP[state]
  return (
    <span
      className="ot-drawer__state"
      style={{ background: s.bg, color: s.fg, borderColor: 'transparent' }}
    >
      <Circle className="h-2 w-2 fill-current" />
      {s.label}
    </span>
  )
}

// ── Activity feed ─────────────────────────────────────────────────────────

export function TransferActivityFeed({ transfers }: { transfers: Transfer[] }) {
  const events = useMemo(() => buildActivity(transfers).slice(0, 10), [transfers])
  if (events.length === 0) return null
  return (
    <>
      <style>{ACTIVITY_CSS}</style>
      <ol className="ot-activity">
        <AnimatePresence initial={false}>
          {events.map((ev, i) => (
            <motion.li
              key={`${ev.transferId}-${ev.kind}-${ev.at}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="ot-activity__item"
            >
              <span
                className="ot-activity__pip"
                style={{ background: ev.color, boxShadow: `0 0 0 4px ${ev.color}26` }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="ot-activity__line">
                  <span className="ot-activity__actor">{ev.actor}</span>
                  <span className="ot-activity__verb"> {ev.verb} </span>
                  <span className="ot-activity__object">{ev.object}</span>
                </p>
                <p className="ot-activity__meta">
                  <span>{formatRelative(ev.at)}</span>
                  {ev.ref && (
                    <>
                      <span className="ot-activity__sep">·</span>
                      <code>{ev.ref}</code>
                    </>
                  )}
                </p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </>
  )
}

interface ActivityEvent {
  transferId: string
  kind: 'initiated' | 'countersigned' | 'rejected' | 'settled' | 'disputed'
  at: string
  actor: string
  verb: string
  object: string
  color: string
  ref?: string
}

function buildActivity(transfers: Transfer[]): ActivityEvent[] {
  const events: ActivityEvent[] = []
  for (const t of transfers) {
    events.push({
      transferId: t.id,
      kind: 'initiated',
      at: t.initiatedAt,
      actor: t.initiatedBy,
      verb: 'initiated',
      object: `${KIND_LABEL[t.kind]} transfer to ${t.toOrg}`,
      color: '#3B82F6',
      ref: t.reference ?? undefined,
    })
    if (t.countersignedAt) {
      const isSettled = t.state === 'settled'
      const isDispute = t.state === 'disputed'
      const isReject = t.state === 'rejected'
      events.push({
        transferId: t.id,
        kind: isSettled ? 'settled' : isDispute ? 'disputed' : isReject ? 'rejected' : 'countersigned',
        at: t.countersignedAt,
        actor: t.countersignedBy ?? 'recipient',
        verb: isSettled
          ? 'counter-signed and settled'
          : isDispute
            ? 'flagged as disputed'
            : isReject
              ? 'rejected'
              : 'counter-signed',
        object: t.productLabel,
        color: isSettled ? '#16A34A' : isDispute ? '#DC2626' : '#94A3B8',
        ref: t.credentialId ?? undefined,
      })
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

// ── helpers ──────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const day = Math.floor(h / 24)
  if (day < 14) return `${day}d ago`
  return iso.slice(0, 10)
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ── styles ───────────────────────────────────────────────────────────────

const BOARD_CSS = `
.ot-board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 28px;
}
@media (max-width: 980px) {
  .ot-board { grid-template-columns: 1fr; }
}

.ot-col {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid var(--surface-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.ot-col__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--surface-border);
}
.ot-col__head-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ot-col__icon {
  display: grid; place-items: center;
  width: 26px; height: 26px;
  border-radius: 7px;
  background: rgba(255,255,255,0.85);
  border: 1px solid var(--surface-border);
}
.ot-col__label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.ot-col__hint {
  font-size: 11px;
  color: var(--fg-subtle);
  margin-top: 2px;
}
.ot-col__count {
  display: grid; place-items: center;
  min-width: 28px; height: 26px;
  padding: 0 8px;
  border-radius: 9999px;
  border: 1px solid;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ot-col__list {
  list-style: none;
  margin: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
}
.ot-col__empty {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  font-family: var(--font-mono);
  font-size: 11px; letter-spacing: 0.06em;
  color: var(--fg-subtle);
  border: 1px dashed var(--surface-border);
  border-radius: 10px;
  background: rgba(241, 245, 249, 0.4);
}

/* Card */
.ot-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 14px 14px 12px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: linear-gradient(180deg, #ffffff 0%, #fafbfd 100%);
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.ot-card:hover {
  border-color: var(--col-accent, var(--surface-border));
  box-shadow:
    0 12px 24px -14px rgba(15,23,42,0.20),
    0 1px 2px rgba(15,23,42,0.06);
}
.ot-card.is-open {
  border-color: var(--col-accent);
  background: linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--col-accent) 8%, #ffffff) 100%);
  box-shadow:
    0 0 0 1px var(--col-accent) inset,
    0 18px 32px -16px color-mix(in srgb, var(--col-accent) 46%, transparent);
}

.ot-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ot-card__kind {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border-radius: 9999px;
  border: 1px solid;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}
.ot-card__badge {
  display: grid; place-items: center;
  width: 22px; height: 22px;
  border-radius: 9999px;
  background: rgba(220,38,38,0.10);
  color: #DC2626;
}
.ot-card__pulse {
  position: relative;
  width: 10px; height: 10px;
  display: inline-block;
}
.ot-card__pulse-dot {
  position: absolute;
  inset: 2px;
  border-radius: 9999px;
  background: #D97706;
}
.ot-card__pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: rgba(217,119,6,0.40);
  animation: ot-pulse 1.6s ease-out infinite;
}
@keyframes ot-pulse {
  0%   { transform: scale(0.7); opacity: 1; }
  100% { transform: scale(1.8); opacity: 0; }
}

.ot-card__product {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ot-card__chain {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ot-card__avatar {
  display: grid; place-items: center;
  width: 24px; height: 24px;
  border-radius: 9999px;
  background: var(--surface-hover);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--fg-muted);
  flex-shrink: 0;
}
.ot-card__avatar--recipient {
  background: var(--col-accent);
  color: #ffffff;
}
.ot-card__chain-arrow {
  color: var(--fg-subtle);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.ot-card__recipient {
  font-size: 11.5px;
  color: var(--fg-default);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.ot-card__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--surface-border);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--fg-subtle);
}
.ot-card__time, .ot-card__ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ot-card__ref { min-width: 0; flex: 1; }

/* Empty board */
.ot-board-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 56px 32px;
  border-radius: 16px;
  border: 1px dashed var(--surface-border);
  background: var(--surface-page);
  margin-bottom: 28px;
}
.ot-board-empty__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-default);
}
.ot-board-empty__sub {
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 480px;
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .ot-card { transition: none; }
  .ot-card__pulse-ring { animation: none; }
}
`

const DRAWER_CSS = `
.ot-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(560px, 100vw);
  z-index: 901;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  border-left: 1px solid var(--surface-border);
  box-shadow: -24px 0 48px -16px rgba(15,23,42,0.20);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.ot-drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 22px 18px;
  border-bottom: 1px solid var(--surface-border);
}
.ot-drawer__head-block { display: flex; gap: 12px; min-width: 0; }
.ot-drawer__icon {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid;
  flex-shrink: 0;
}
.ot-drawer__eyebrow {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.ot-drawer__title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.012em;
  line-height: 1.2;
  color: var(--fg-default);
}
.ot-drawer__close {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 8px;
  color: var(--fg-subtle);
  background: transparent;
  border: 1px solid transparent;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.ot-drawer__close:hover {
  background: var(--surface-hover);
  color: var(--fg-default);
  border-color: var(--surface-border);
}

.ot-drawer__chain {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--surface-border);
}
.ot-drawer__chain-arrow {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 9999px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
  color: var(--fg-muted);
}

.ot-party {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--surface-page);
  border: 1px solid var(--surface-border);
}
.ot-party.is-highlight {
  background: linear-gradient(180deg, rgba(15,76,129,0.06) 0%, rgba(15,76,129,0.02) 100%);
  border-color: rgba(15,76,129,0.25);
}
.ot-party__avatar {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 9999px;
  background: var(--color-accent, #0F4C81);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.ot-party__role {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.ot-party__org {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ot-party__did {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-muted);
  word-break: break-all;
}

.ot-drawer__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
  padding: 8px 0;
  margin: 0;
  border-bottom: 1px solid var(--surface-border);
}
.ot-drawer__cell {
  padding: 14px 22px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ot-drawer__cell-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.ot-drawer__cell-value {
  font-size: 13px;
  color: var(--fg-default);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  margin: 0;
}
.ot-drawer__time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg-default);
}
.ot-drawer__sub {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-subtle);
}
.ot-drawer__mono {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--fg-default);
  background: var(--surface-page);
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
  width: fit-content;
}
.ot-drawer__mono--break { word-break: break-all; }
.ot-drawer__state {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px;
  border-radius: 9999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.ot-drawer__vc, .ot-drawer__note {
  padding: 16px 22px;
  border-bottom: 1px solid var(--surface-border);
}
.ot-drawer__section-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  margin-bottom: 8px;
}
.ot-drawer__vc-row {
  display: flex; gap: 10px; align-items: center;
  padding: 6px 0;
}
.ot-drawer__vc-key {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-muted);
  min-width: 84px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.ot-drawer__note-body {
  font-size: 13px;
  line-height: 1.55;
  color: var(--fg-default);
  white-space: pre-wrap;
}

.ot-drawer__actions {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 22px;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-page);
}
.ot-drawer__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 150ms ease;
}
.ot-drawer__btn:disabled { opacity: 0.6; cursor: progress; }
.ot-drawer__btn--primary {
  background: var(--color-accent, #0F4C81);
  color: #ffffff;
  box-shadow: 0 6px 14px -8px rgba(15,76,129,0.5);
}
.ot-drawer__btn--ghost {
  background: var(--surface-page);
  border-color: var(--surface-border);
  color: var(--fg-default);
}
.ot-drawer__btn--danger {
  background: transparent;
  color: #B91C1C;
  margin-left: auto;
}
`

const ACTIVITY_CSS = `
.ot-activity {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.ot-activity__item {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}
.ot-activity__item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 24px;
  bottom: -12px;
  width: 1px;
  background: var(--surface-border);
}
.ot-activity__pip {
  width: 10px; height: 10px;
  margin-left: 4px;
  margin-top: 4px;
  border-radius: 9999px;
  position: relative;
  z-index: 1;
}
.ot-activity__line {
  font-size: 13px;
  line-height: 1.4;
  color: var(--fg-default);
  margin: 0;
}
.ot-activity__actor {
  font-weight: 600;
}
.ot-activity__verb { color: var(--fg-muted); }
.ot-activity__object { color: var(--fg-default); }
.ot-activity__meta {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-subtle);
  display: flex; align-items: center; gap: 6px;
}
.ot-activity__sep { opacity: 0.5; }
`
