'use client'

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '../cn'

/**
 * Polished empty-screen treatment with motion entrance + a soft, slowly
 * pulsing aura behind the icon. Respects `prefers-reduced-motion`.
 */
export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'info'
  className?: string
}

const TONE_AURA: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  neutral: 'rgba(15, 76, 129, 0.12)',
  success: 'rgba(22, 163, 74, 0.14)',
  warning: 'rgba(217, 119, 6, 0.16)',
  info: 'rgba(59, 130, 246, 0.14)',
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--surface-border)] bg-[var(--surface-page)] px-8 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="relative grid place-items-center">
          <motion.span
            aria-hidden
            className="absolute inset-0 -m-2 rounded-full"
            style={{ background: TONE_AURA[tone] }}
            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--fg-default)] shadow-[0_4px_14px_-4px_rgba(15,23,42,0.18)] ring-1 ring-[var(--surface-border)]"
          >
            {icon}
          </motion.div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-[16px] font-semibold leading-tight text-[var(--fg-default)]">
          {title}
        </h3>
        {description && (
          <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">{description}</p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </motion.div>
  )
}
