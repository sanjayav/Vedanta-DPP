'use client'

import { motion, useInView, useMotionValue, useTransform, animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/**
 * Animated KPI tile · counts the value up from 0 to the final number when
 * the tile scrolls into view. Falls back to a static render when the
 * target value isn't a parseable number, or when reduced motion is
 * preferred.
 */
export function AnimatedKpi({
  label,
  value,
  unit,
  hint,
  delay = 0,
}: {
  label: string
  value: string
  unit?: string
  hint?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  // Try to parse the value as a number for the counter; fall back to string.
  const parsed = Number(value.replace(/,/g, ''))
  const isNumeric = Number.isFinite(parsed)
  const decimals = isNumeric && value.includes('.') ? value.split('.')[1]!.length : 0

  const mv = useMotionValue(0)
  const display = useTransform(mv, (latest) => {
    if (!isNumeric) return value
    return latest.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  })
  const [text, setText] = useState<string>(isNumeric ? '0' : value)

  useEffect(() => {
    if (!inView || !isNumeric) {
      if (!isNumeric) setText(value)
      return
    }
    const controls = animate(mv, parsed, {
      duration: 1.1,
      delay,
      ease: [0.16, 1, 0.3, 1],
    })
    const unsub = display.on('change', (v) => setText(v))
    return () => {
      controls.stop()
      unsub()
    }
  }, [inView, isNumeric, parsed, value, delay, mv, display])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="flex flex-col rounded-[var(--radius-sm,8px)] px-1 py-0.5 transition-shadow"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
        {label}
      </span>
      <span className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-[var(--fg-default)]">
        <span className="tabular-nums">{text}</span>
        {unit && (
          <span className="ml-1 text-[12px] font-normal text-[var(--fg-muted)]">{unit}</span>
        )}
      </span>
      {hint && <span className="mt-0.5 text-[10px] text-[var(--fg-subtle)]">{hint}</span>}
    </motion.div>
  )
}
