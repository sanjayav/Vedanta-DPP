'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'motion/react'

// Inline SVG icons to keep @dpp/ui free of a lucide-react dependency.
function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function IconXCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}
function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function IconInfo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}
function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastInput {
  id?: string
  title: string
  description?: string
  tone?: ToastTone
  /** Auto-dismiss delay in ms. 0 = sticky. Default 4500. */
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface Toast extends Required<Pick<ToastInput, 'id' | 'title' | 'tone' | 'duration'>> {
  description?: string
  action?: ToastInput['action']
}

interface ToastContextValue {
  push: (t: ToastInput) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _externalPush: ((t: ToastInput) => string) | null = null

/**
 * Imperative API. Works outside React tree once `<Toaster />` has mounted.
 *   toast({ tone: 'success', title: 'Passport issued' })
 */
export function toast(t: ToastInput): string {
  if (!_externalPush) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[toast] called before <Toaster /> mounted; dropping:', t.title)
    }
    return ''
  }
  return _externalPush(t)
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast() must be used inside <Toaster />')
  }
  return ctx
}

const TONE_ICON: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: IconCheckCircle,
  error: IconXCircle,
  info: IconInfo,
  warning: IconAlertTriangle,
}
const TONE_ACCENT: Record<ToastTone, string> = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#0F4C81',
  warning: '#d97706',
}
const TONE_TINT: Record<ToastTone, string> = {
  success: 'rgba(22, 163, 74, 0.10)',
  error: 'rgba(220, 38, 38, 0.10)',
  info: 'rgba(15, 76, 129, 0.10)',
  warning: 'rgba(217, 119, 6, 0.12)',
}

export function Toaster({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((curr) => curr.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((t: ToastInput): string => {
    const id = t.id ?? `toast-${++idRef.current}`
    const toast: Toast = {
      id,
      title: t.title,
      description: t.description,
      tone: t.tone ?? 'info',
      duration: t.duration ?? 4500,
      action: t.action,
    }
    setToasts((curr) => [...curr, toast])
    if (toast.duration > 0) {
      window.setTimeout(() => {
        setToasts((curr) => curr.filter((x) => x.id !== id))
      }, toast.duration)
    }
    return id
  }, [])

  // Wire the imperative API on mount.
  useEffect(() => {
    _externalPush = push
    return () => {
      _externalPush = null
    }
  }, [push])

  const ctx = useMemo<ToastContextValue>(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex flex-col items-end gap-2 px-4 pb-4 sm:px-6 sm:pb-6"
        role="region"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = TONE_ICON[t.tone]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92, x: 60, transition: { duration: 0.2 } }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[14px] border bg-white px-4 py-3 shadow-[0_18px_38px_-18px_rgba(15,23,42,0.32),0_4px_12px_-6px_rgba(15,23,42,0.16)] backdrop-blur"
                style={{
                  borderColor: 'var(--surface-border)',
                  background: `linear-gradient(180deg, #ffffff 0%, ${TONE_TINT[t.tone]} 100%)`,
                }}
              >
                <span
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full"
                  style={{ background: TONE_TINT[t.tone], color: TONE_ACCENT[t.tone] }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-tight text-[var(--fg-default)]">
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fg-muted)]">
                      {t.description}
                    </p>
                  )}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action?.onClick()
                        dismiss(t.id)
                      }}
                      className="mt-2 text-[12px] font-semibold underline-offset-4 hover:underline"
                      style={{ color: TONE_ACCENT[t.tone] }}
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="-mt-0.5 -mr-0.5 rounded-md p-1 text-[var(--fg-subtle)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--fg-default)]"
                  aria-label="Dismiss"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
