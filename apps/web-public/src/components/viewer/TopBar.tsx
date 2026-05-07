'use client'

import { motion, useScroll, useTransform } from 'motion/react'

import type { ViewerDpp } from '@/lib/dpp-client'

export function TopBar({ dpp }: { dpp: ViewerDpp }) {
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 200], [0, 1])
  const ident = dpp.dpp.identification as
    | { tradeName?: string; gradeCode?: string; metal?: string }
    | undefined
  const producer = dpp.dpp.producer as
    | { legalName?: string; shortName?: string; bpnl?: string }
    | undefined
  const materialId = dpp.dpp.materialId as { uuid?: string } | undefined
  const tag = ident?.tradeName ?? ident?.gradeCode ?? ident?.metal ?? ''

  return (
    <motion.div style={{ opacity }} className="fixed inset-x-0 top-0 z-40 backdrop-blur-md">
      <div className="bg-[var(--color-paper)]/85 border-b border-[var(--surface-divider)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="font-display grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] font-bold text-[var(--color-paper)]">
              {producer?.shortName?.charAt(0) ?? 'H'}
            </div>
            <span className="font-display text-[15px] font-semibold tracking-tight text-[var(--fg-default)]">
              {producer?.legalName ?? 'Hindustan Zinc Limited'}
            </span>
            {tag ? (
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-subtle)] md:inline">
                {tag}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {materialId?.uuid ? (
              <span className="tabular hidden font-mono text-[11px] text-[var(--fg-subtle)] md:inline">
                {materialId.uuid.slice(0, 8)}…
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-green)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-green)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-green)]" />
              </span>
              Verified
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
