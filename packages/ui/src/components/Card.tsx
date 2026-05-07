'use client'

import { motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * A surface with motion lift + shadow animation on hover. The default
 * elevation level matches the C6 Trail design system: a tight low-light
 * shadow at rest, lifted to a softer dropshadow on hover.
 */
export interface CardProps extends HTMLMotionProps<'div'> {
  children?: ReactNode
  className?: string
  /** Disable the hover lift (still applies the shadow scale on hover). */
  static?: boolean
  /** Tone-coloured top accent strip · matches the tier palette. */
  accent?: 'amber' | 'blue' | 'green' | 'violet' | 'navy'
  /** Extra elevation at rest. Defaults to "rest" (subtle). */
  elevation?: 'rest' | 'raised' | 'flat'
}

const ACCENT_COLOR: Record<NonNullable<CardProps['accent']>, string> = {
  amber: '#D4A574',
  blue: '#3B82F6',
  green: '#16a34a',
  violet: '#7C3AED',
  navy: '#0F4C81',
}

const ELEVATION_REST: Record<NonNullable<CardProps['elevation']>, string> = {
  flat: 'none',
  rest: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -8px rgba(15,23,42,0.10)',
  raised: '0 4px 8px rgba(15,23,42,0.04), 0 12px 24px -12px rgba(15,23,42,0.18)',
}
const ELEVATION_HOVER: Record<NonNullable<CardProps['elevation']>, string> = {
  flat: '0 2px 6px rgba(15,23,42,0.06)',
  rest: '0 4px 8px rgba(15,23,42,0.06), 0 16px 32px -14px rgba(15,23,42,0.22)',
  raised: '0 8px 16px rgba(15,23,42,0.08), 0 24px 48px -18px rgba(15,23,42,0.30)',
}

export function Card({
  children,
  className,
  static: isStatic,
  accent,
  elevation = 'rest',
  ...rest
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      whileHover={isStatic ? undefined : { y: -2 }}
      style={{
        boxShadow: ELEVATION_REST[elevation],
      }}
      whileFocus={isStatic ? undefined : { y: -1 }}
      {...rest}
      className={cn(
        'relative rounded-[var(--radius-md,12px)] border border-[var(--surface-border)] bg-white transition-shadow',
        className,
      )}
      onMouseEnter={(e) => {
        if (!isStatic) {
          e.currentTarget.style.boxShadow = ELEVATION_HOVER[elevation]
        }
        rest.onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = ELEVATION_REST[elevation]
        rest.onMouseLeave?.(e)
      }}
    >
      {accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 right-3 top-0 h-[3px] rounded-b-[3px]"
          style={{ background: ACCENT_COLOR[accent], opacity: 0.85 }}
        />
      )}
      {children}
    </motion.div>
  )
}
