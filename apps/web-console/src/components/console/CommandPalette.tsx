'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  CornerDownLeft,
  Database,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Gauge,
  Globe,
  Inbox,
  Layers,
  Link2,
  Plug,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
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

import { toast } from '@dpp/ui'

interface CommandItem {
  id: string
  label: string
  hint?: string
  /** Lowercased keywords for fuzzy match. */
  keywords?: string[]
  icon: React.ComponentType<{ className?: string }>
  group: 'navigate' | 'create' | 'shortcut'
  href?: string
  action?: () => void
  shortcut?: string
}

const STATIC_COMMANDS: CommandItem[] = [
  // ── Navigation
  { id: 'nav-overview',   label: 'Dashboard',           hint: 'Workspace overview',           icon: Gauge,            group: 'navigate', href: '/console/overview',         keywords: ['home', 'kpi', 'metrics'] },
  { id: 'nav-passports',  label: 'Passports',           hint: 'Issued DPP records',           icon: Layers,           group: 'navigate', href: '/console/dpps',             keywords: ['list', 'dpp'] },
  { id: 'nav-eu',         label: 'EU Registry',         hint: 'Anchored passports',           icon: Globe,            group: 'navigate', href: '/console/eu-registry',      keywords: ['cbam', 'european'] },
  { id: 'nav-create',     label: 'Create Passport',     hint: 'Author a new DPP',             icon: ClipboardList,    group: 'navigate', href: '/console/create-passport',  keywords: ['new', 'wizard'] },
  { id: 'nav-assignments',label: 'My Assignments',      hint: 'Inbox',                        icon: Inbox,            group: 'navigate', href: '/console/my-assignments',   keywords: ['todo'] },
  { id: 'nav-batch',      label: 'Batch Import',        hint: 'CSV import',                   icon: FileSpreadsheet,  group: 'navigate', href: '/console/batch-import',     keywords: ['csv', 'upload'] },
  { id: 'nav-team',       label: 'Team',                hint: 'Members + roles',              icon: Users,            group: 'navigate', href: '/console/team' },
  { id: 'nav-supply',     label: 'Supply Chain',        hint: 'Partners + sites',             icon: Link2,            group: 'navigate', href: '/console/supply-chain' },
  { id: 'nav-transfers',  label: 'Ownership Transfers', hint: 'Customer hand-off',            icon: RefreshCw,        group: 'navigate', href: '/console/ownership-transfers' },
  { id: 'nav-compliance', label: 'Compliance Report',   hint: 'BIS / CBAM / REACH',           icon: FileText,         group: 'navigate', href: '/console/compliance-report' },
  { id: 'nav-pipeline',   label: 'Data Collection',     hint: 'Ingestion pipeline',           icon: Gauge,            group: 'navigate', href: '/console/pipeline' },
  { id: 'nav-sources',    label: 'Data Sources',        hint: 'SCADA / MES / ERP',            icon: Database,         group: 'navigate', href: '/console/sources' },
  { id: 'nav-plant',      label: 'Plant Monitor',       hint: 'Live signals',                 icon: Gauge,            group: 'navigate', href: '/console/plant-monitor' },
  { id: 'nav-monitor',    label: 'Attribute Monitor',   hint: 'Attribute timeseries',         icon: Gauge,            group: 'navigate', href: '/console/monitoring' },
  { id: 'nav-assurance',  label: 'Assurance',           hint: 'Verifier registry',            icon: ShieldCheck,      group: 'navigate', href: '/console/verifiers' },
  { id: 'nav-audit',      label: 'Audit Trail',         hint: 'Hash-chained log',             icon: FileSearch,       group: 'navigate', href: '/console/audit' },
  { id: 'nav-integrations', label: 'Integrations',      hint: 'Connectors',                   icon: Plug,             group: 'navigate', href: '/console/integrations' },
  { id: 'nav-settings',   label: 'Settings',            hint: 'Tenant preferences',           icon: Settings,         group: 'navigate', href: '/console/settings' },
]

const QUICK_ACTIONS: CommandItem[] = [
  {
    id: 'qa-new-passport',
    label: 'Create a passport',
    hint: 'Pick a product, then identify the cast',
    icon: ClipboardList,
    group: 'create',
    href: '/console/create-passport/new',
    shortcut: 'C',
  },
  {
    id: 'qa-fire-ecozen',
    label: 'Fire EcoZen sample event',
    hint: 'Issue a demo passport for the marquee zinc grade',
    icon: Sparkles,
    group: 'create',
    action: () => {
      toast({
        tone: 'info',
        title: 'EcoZen demo event',
        description: 'Use the "Fire" button on the dashboard to ingest a sample cast.',
      })
    },
  },
]

interface CommandPaletteContextValue {
  open: () => void
  close: () => void
}
const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette() must be used inside <CommandPaletteProvider />')
  return ctx
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [isOpen, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }, [])

  // Global keyboard: Cmd/Ctrl+K toggles, Escape closes when open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        return
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  // Auto-focus the input when opened.
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [isOpen])

  // Scroll the active item into view on arrow-key navigation.
  useEffect(() => {
    if (!isOpen) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  const allCommands = useMemo<CommandItem[]>(
    () => [...QUICK_ACTIONS, ...STATIC_COMMANDS],
    [],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCommands
    return allCommands.filter((c) => {
      if (c.label.toLowerCase().includes(q)) return true
      if (c.hint?.toLowerCase().includes(q)) return true
      if (c.keywords?.some((k) => k.toLowerCase().includes(q))) return true
      return false
    })
  }, [allCommands, query])

  // Re-bound active index when filtering changes.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const groups = useMemo(() => {
    const order: CommandItem['group'][] = ['create', 'navigate', 'shortcut']
    const labels: Record<CommandItem['group'], string> = {
      create: 'Quick actions',
      navigate: 'Pages',
      shortcut: 'Shortcuts',
    }
    return order
      .map((g) => ({ key: g, label: labels[g], items: filtered.filter((c) => c.group === g) }))
      .filter((s) => s.items.length > 0)
  }, [filtered])

  const flatList = useMemo(() => groups.flatMap((g) => g.items), [groups])

  function runCommand(cmd: CommandItem) {
    close()
    if (cmd.href) {
      router.push(cmd.href as Route)
    } else {
      cmd.action?.()
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatList.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = flatList[activeIndex]
      if (cmd) runCommand(cmd)
    }
  }

  const ctx = useMemo<CommandPaletteContextValue>(() => ({ open, close }), [open, close])

  return (
    <CommandPaletteContext.Provider value={ctx}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="cp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            className="fixed inset-0 z-[900] bg-[rgba(15,23,42,0.36)] backdrop-blur-sm"
            aria-hidden
          />
        )}
        {isOpen && (
          <motion.div
            key="cp-panel"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onListKeyDown}
            className="fixed left-1/2 top-[14vh] z-[1000] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-[var(--surface-border)] bg-white/95 shadow-[0_28px_60px_-20px_rgba(15,23,42,0.50),0_8px_20px_-8px_rgba(15,23,42,0.18)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3">
              <Search className="h-4 w-4 flex-shrink-0 text-[var(--fg-subtle)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, products, casts, BPNs…"
                className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--fg-default)] placeholder:text-[var(--fg-subtle)] focus:outline-none"
                autoComplete="off"
                spellCheck={false}
                aria-controls="cp-list"
              />
              <kbd className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-page)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--fg-subtle)]">
                ESC
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto" id="cp-list" ref={listRef as never}>
              {groups.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                    No results
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
                    Try a different search · or press{' '}
                    <kbd className="rounded border border-[var(--surface-border)] bg-[var(--surface-page)] px-1 py-0.5 font-mono text-[10px]">
                      ESC
                    </kbd>{' '}
                    to close.
                  </p>
                </div>
              ) : (
                <ul className="py-2" role="listbox">
                  {groups.map((group) => (
                    <li key={group.key} className="mb-1.5 last:mb-0">
                      <p className="px-4 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
                        {group.label}
                      </p>
                      <ul>
                        {group.items.map((cmd) => {
                          const idx = flatList.indexOf(cmd)
                          const isActive = idx === activeIndex
                          return (
                            <li key={cmd.id}>
                              <button
                                type="button"
                                data-index={idx}
                                onMouseEnter={() => setActiveIndex(idx)}
                                onClick={() => runCommand(cmd)}
                                className={[
                                  'group flex w-full items-center gap-3 px-4 py-2 text-left transition',
                                  isActive
                                    ? 'bg-[var(--color-fog,rgba(15,76,129,0.06))]'
                                    : 'bg-transparent',
                                ].join(' ')}
                              >
                                <span
                                  className={[
                                    'grid h-7 w-7 flex-shrink-0 place-items-center rounded-md transition',
                                    isActive
                                      ? 'bg-[var(--color-accent,#0F4C81)] text-white shadow-[0_2px_8px_rgba(15,76,129,0.30)]'
                                      : 'bg-[var(--surface-hover)] text-[var(--fg-muted)]',
                                  ].join(' ')}
                                >
                                  <cmd.icon className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium text-[var(--fg-default)]">
                                    {cmd.label}
                                  </span>
                                  {cmd.hint && (
                                    <span className="block truncate text-[11px] text-[var(--fg-subtle)]">
                                      {cmd.hint}
                                    </span>
                                  )}
                                </span>
                                {cmd.shortcut && (
                                  <kbd className="rounded-md border border-[var(--surface-border)] bg-[var(--surface-page)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--fg-subtle)]">
                                    {cmd.shortcut}
                                  </kbd>
                                )}
                                {cmd.href && (
                                  <ArrowUpRight
                                    className={[
                                      'h-3.5 w-3.5 flex-shrink-0 transition',
                                      isActive
                                        ? 'text-[var(--color-accent)]'
                                        : 'text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100',
                                    ].join(' ')}
                                  />
                                )}
                                {!cmd.href && cmd.action && (
                                  <ArrowRight
                                    className={[
                                      'h-3.5 w-3.5 flex-shrink-0 transition',
                                      isActive
                                        ? 'text-[var(--color-accent)]'
                                        : 'text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100',
                                    ].join(' ')}
                                  />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer hint bar */}
            <div className="flex items-center justify-between gap-3 border-t border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-2 text-[11px] text-[var(--fg-subtle)]">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-[var(--surface-border)] bg-white px-1 py-0.5 font-mono text-[10px]">
                  ↑
                </kbd>
                <kbd className="rounded border border-[var(--surface-border)] bg-white px-1 py-0.5 font-mono text-[10px]">
                  ↓
                </kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="inline-flex items-center gap-0.5 rounded border border-[var(--surface-border)] bg-white px-1 py-0.5 font-mono text-[10px]">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </kbd>
                run
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded border border-[var(--surface-border)] bg-white px-1 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
                toggle
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CommandPaletteContext.Provider>
  )
}
