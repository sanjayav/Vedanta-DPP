'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import { motion } from 'motion/react'
import {
  Activity,
  Bell,
  ChevronRight,
  ClipboardList,
  Command,
  Database,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Gauge,
  Globe,
  Inbox,
  Layers,
  Link2,
  LogOut,
  Plug,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import type { SessionUser } from '@/lib/auth'
import { useCommandPalette } from './CommandPalette'

type NavSection = 'workspace' | 'manage' | 'data' | 'admin'

interface NavItem {
  href: Route
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: SessionUser['role'][]
  section: NavSection
}

const NAV: NavItem[] = [
  // Workspace · what an operator looks at every day
  {
    href: '/console/overview',
    label: 'Dashboard',
    icon: Gauge,
    section: 'workspace',
    roles: ['tenant_admin', 'tenant_auditor'],
  },
  { href: '/console/dpps', label: 'Passports', icon: Layers, section: 'workspace' },
  { href: '/console/eu-registry', label: 'EU Registry', icon: Globe, section: 'workspace' },
  {
    href: '/console/create-passport' as Route,
    label: 'Create Passport',
    icon: ClipboardList,
    section: 'workspace',
    roles: ['tenant_admin', 'dpp_operator'],
  },
  {
    href: '/console/my-assignments' as Route,
    label: 'My Assignments',
    icon: Inbox,
    section: 'workspace',
  },
  {
    href: '/console/batch-import',
    label: 'Batch Import',
    icon: FileSpreadsheet,
    section: 'workspace',
    roles: ['tenant_admin', 'dpp_operator'],
  },

  // Manage · tenant admin & supply-chain
  { href: '/console/team', label: 'Team', icon: Users, section: 'manage' },
  { href: '/console/supply-chain', label: 'Supply Chain', icon: Link2, section: 'manage' },
  {
    href: '/console/ownership-transfers',
    label: 'Ownership Transfers',
    icon: RefreshCw,
    section: 'manage',
  },
  {
    href: '/console/compliance-report',
    label: 'Compliance Report',
    icon: FileText,
    section: 'manage',
  },

  // Data · pipeline & sources
  { href: '/console/pipeline', label: 'Data Collection', icon: Activity, section: 'data' },
  {
    href: '/console/sources',
    label: 'Data Sources',
    icon: Database,
    section: 'data',
    roles: ['dpp_operator', 'tenant_admin'],
  },
  {
    href: '/console/plant-monitor',
    label: 'Plant Monitor',
    icon: Gauge,
    section: 'data',
  },
  {
    href: '/console/monitoring',
    label: 'Attribute Monitor',
    icon: Activity,
    section: 'data',
  },
  {
    href: '/console/verifiers',
    label: 'Assurance',
    icon: ShieldCheck,
    section: 'data',
    roles: ['tenant_admin', 'it_administrator'],
  },

  // Admin · guarded
  {
    href: '/console/audit',
    label: 'Audit Trail',
    icon: FileSearch,
    section: 'admin',
    roles: ['tenant_auditor', 'tenant_admin'],
  },
  {
    href: '/console/integrations',
    label: 'Integrations',
    icon: Plug,
    section: 'admin',
    roles: ['tenant_admin', 'it_administrator'],
  },
  {
    href: '/console/settings',
    label: 'Settings',
    icon: Settings,
    section: 'admin',
    roles: ['tenant_admin', 'it_administrator'],
  },
]

const SECTION_LABEL: Record<NavSection, string> = {
  workspace: 'Workspace',
  manage: 'Manage',
  data: 'Data',
  admin: 'Admin',
}

export function ConsoleShell({
  user,
  children,
  rightRail,
}: {
  user: SessionUser
  children: React.ReactNode
  rightRail?: React.ReactNode
}) {
  const pathname = usePathname()
  const palette = useCommandPalette()
  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(user.role))
  const sections: NavSection[] = ['workspace', 'manage', 'data', 'admin']

  return (
    <div className="al-shell grid min-h-screen grid-cols-[var(--rail-expanded)_1fr]">
      <style>{SHELL_CSS}</style>
      <div className="al-page-bg" aria-hidden />

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="al-sidebar">
        {/* Brand */}
        <Link href="/console/dpps" className="al-brand" aria-label="C6 Trail home">
          <span className="al-brand-mark" aria-hidden>
            <BrandMark />
          </span>
          <span className="al-brand-text">
            <span className="al-brand-name">
              C6 <span className="al-brand-name-accent">Trail</span>
            </span>
            <span className="al-brand-by">Vedanta · Hindustan Zinc</span>
          </span>
          <span className="al-brand-glow" aria-hidden />
        </Link>

        {/* Search shortcut · opens command palette */}
        <motion.button
          type="button"
          onClick={palette.open}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="al-search"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </motion.button>

        {/* Nav */}
        <nav className="al-nav">
          {sections.map((section) => {
            const items = visibleNav.filter((n) => n.section === section)
            if (items.length === 0) return null
            return (
              <div key={section} className="al-nav-section">
                <p className="al-nav-section-label">{SECTION_LABEL[section]}</p>
                <ul className="al-nav-list">
                  {items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch
                          className={`al-nav-link${isActive ? ' is-active' : ''}`}
                        >
                          {isActive && (
                            <motion.span
                              layoutId="al-nav-active-pill"
                              className="al-nav-pill"
                              aria-hidden
                              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                            />
                          )}
                          <span className="al-nav-icon-wrap">
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span className="al-nav-label">{item.label}</span>
                          {isActive && <ChevronRight className="al-nav-active-chev h-3 w-3" />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* User card */}
        <div className="al-user">
          <div className="al-user-avatar" aria-hidden>
            {user.displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            <span className="al-user-status" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="al-user-name">{user.displayName}</p>
            <p className="al-user-role">{user.role.replace(/_/g, ' ')}</p>
          </div>
          <form action="/api/auth/sign-out" method="post">
            <button type="submit" className="al-user-action" title="Sign out" aria-label="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className={`grid ${rightRail ? 'grid-cols-[1fr_320px]' : ''}`}>
        <div className="flex min-h-screen min-w-0 flex-col">
          {/* Top bar */}
          <header className="al-topbar">
            <div className="al-topbar-crumb">
              <span>{tenantLabel(user)}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="al-topbar-current">
                {pathname?.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? 'Console'}
              </span>
            </div>
            <div className="al-topbar-actions">
              <motion.button
                type="button"
                onClick={palette.open}
                whileHover={{ y: -1, boxShadow: '0 6px 16px -8px rgba(15,76,129,0.28)' }}
                whileTap={{ scale: 0.98 }}
                className="al-topbar-search"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search products, casts…</span>
                <kbd>⌘K</kbd>
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.94 }}
                className="al-topbar-bell"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="al-topbar-bell-dot" />
              </motion.button>
              <span className="al-topbar-rolepill">
                <Sparkles className="h-3 w-3" />
                {user.role.replace(/_/g, ' ')}
              </span>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-auto">{children}</main>
        </div>

        {rightRail && (
          <aside className="border-l border-[var(--surface-border)] bg-[var(--color-cream)]">
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  )
}

function tenantLabel(user: SessionUser): string {
  if (user.tenantId === 0) return 'C6 Trail · platform'
  return `${user.tenantSlug?.toUpperCase() || 'HZL'} · Manufacturer Portal`
}

/** Custom mark · stylised zinc/lead ingot profile with a trailing footprint
 *  dot. Reads as "C6 · Trail" without leaning on a specific glyph. */
function BrandMark() {
  // C6 Trail mark · hexagon (six EF 3.1 LCIA categories) with the trail
  // line passing through. Vedanta-green to HZL-navy gradient with the
  // trail painted in trail-amber.
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="al-mark-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e7c5a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
        <linearGradient id="al-mark-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.5 L26.5 9.5 L26.5 22.5 L16 28.5 L5.5 22.5 L5.5 9.5 Z"
        fill="url(#al-mark-fill)"
      />
      <path d="M16 5 L24.5 9.7 L24.5 14 L16 9 L7.5 14 L7.5 9.7 Z" fill="url(#al-mark-glow)" />
      <path
        d="M8.5 20 L13 17.5 L16 19 L19 17.5 L23.5 20"
        stroke="#d9a441"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="14" r="1.4" fill="#fff" />
    </svg>
  )
}

const SHELL_CSS = `
/* Shell wrapper — sets the platform-wide background mesh that every
 * authenticated route inherits. The mesh is fixed-position so it doesn't
 * scroll with the content; saturate on the topbar/sidebar adds depth. */
.al-shell {
  background: var(--surface-page, #fafaf6);
  position: relative;
  isolation: isolate;
}
.al-page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 40% at 50% 0%, rgba(14, 124, 90, 0.05), transparent 70%),
    radial-gradient(ellipse 60% 50% at 100% 50%, rgba(11, 37, 69, 0.04), transparent 70%),
    radial-gradient(ellipse 50% 60% at 0% 100%, rgba(217, 164, 65, 0.04), transparent 70%);
}
.al-page-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(11, 37, 69, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(11, 37, 69, 0.03) 1px, transparent 1px);
  background-size: 64px 64px;
  -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%);
  mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%);
  opacity: 0.6;
}

/* Sidebar — premium two-tone surface with grain + soft brand glow */
.al-sidebar {
  display: flex;
  flex-direction: column;
  position: relative;
  background:
    linear-gradient(180deg, #ffffff 0%, #fafaf6 60%, #f4f3ec 100%);
  border-right: 1px solid var(--surface-border);
  overflow: hidden;
  z-index: 1;
}
.al-sidebar::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 280px;
  background:
    radial-gradient(circle at 8% 0%, rgba(14, 124, 90, 0.14), transparent 55%),
    radial-gradient(circle at 95% 0%, rgba(11, 37, 69, 0.10), transparent 60%);
  pointer-events: none;
}
.al-sidebar::after {
  /* Vertical accent line on the right edge to separate from the canvas */
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 1px;
  background: linear-gradient(180deg,
    rgba(14, 124, 90, 0.20) 0%,
    rgba(11, 37, 69, 0.10) 30%,
    rgba(11, 37, 69, 0.04) 100%);
  pointer-events: none;
}

/* Brand — radial backlight behind the mark + dual-tone wordmark */
.al-brand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 18px 20px;
  margin: 8px 8px 4px;
  border-radius: 14px;
  transition: background 200ms ease;
  z-index: 1;
}
.al-brand::before {
  content: '';
  position: absolute;
  left: 6px; top: 50%;
  width: 56px; height: 56px;
  margin-top: -28px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(14, 124, 90, 0.22), transparent 70%);
  filter: blur(14px);
  pointer-events: none;
}
.al-brand:hover { background: rgba(11, 37, 69, 0.04); }
.al-brand-mark {
  position: relative;
  width: 42px; height: 42px;
  display: grid; place-items: center;
  flex-shrink: 0;
  filter: drop-shadow(0 8px 16px rgba(14, 124, 90, 0.30));
}
.al-brand-mark svg { width: 100%; height: 100%; }
.al-brand-text { display: flex; flex-direction: column; line-height: 1.08; min-width: 0; }
.al-brand-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.022em;
  color: var(--fg-default);
}
.al-brand-name-accent {
  background: linear-gradient(135deg, #0e7c5a 0%, #0b2545 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 700;
}
.al-brand-by {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 600;
}
.al-brand-glow {
  position: absolute;
  inset: auto 8px -1px 8px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(14, 124, 90, 0.30), transparent);
}

/* Search tile · sidebar entry to the ⌘K palette */
.al-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 12px 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(8px);
  font-size: 12px;
  color: var(--fg-subtle);
  text-align: left;
  font-weight: 500;
  cursor: pointer;
  transition: background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease;
  z-index: 1;
}
.al-search:hover {
  background: var(--surface-page);
  border-color: rgba(14, 124, 90, 0.40);
  color: var(--fg-default);
  box-shadow: 0 4px 14px -8px rgba(14, 124, 90, 0.22);
}
.al-search kbd {
  margin-left: auto;
  display: inline-flex; align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--fg-muted);
}

/* Nav */
.al-nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-border) transparent;
  z-index: 1;
}
.al-nav::-webkit-scrollbar { width: 6px; }
.al-nav::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 9999px; }
.al-nav-section { margin-bottom: 18px; }
.al-nav-section-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 8px 12px;
  margin-bottom: 4px;
}
.al-nav-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

.al-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px 10px 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-muted);
  transition: color 180ms ease, transform 180ms ease;
}
.al-nav-link:hover {
  color: var(--fg-default);
  transform: translateX(1px);
}
.al-nav-link.is-active {
  color: var(--color-vedanta-green, #0e7c5a);
  font-weight: 600;
}
.al-nav-pill {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background:
    linear-gradient(95deg, rgba(14, 124, 90, 0.12), rgba(14, 124, 90, 0.04)),
    linear-gradient(0deg, rgba(255,255,255,0.6), rgba(255,255,255,0.6));
  border: 1px solid rgba(14, 124, 90, 0.22);
  box-shadow:
    0 8px 16px -10px rgba(14, 124, 90, 0.30),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  z-index: 0;
}

.al-nav-icon-wrap {
  position: relative;
  display: grid; place-items: center;
  width: 24px; height: 24px;
  border-radius: 7px;
  color: var(--fg-subtle);
  flex-shrink: 0;
  z-index: 1;
  transition: background 180ms ease, color 180ms ease, transform 180ms ease;
}
.al-nav-link:hover .al-nav-icon-wrap {
  color: var(--fg-default);
  background: rgba(11, 37, 69, 0.04);
}
.al-nav-link.is-active .al-nav-icon-wrap {
  background: linear-gradient(135deg, rgba(14, 124, 90, 0.18), rgba(14, 124, 90, 0.08));
  color: var(--color-vedanta-green, #0e7c5a);
  box-shadow: inset 0 0 0 1px rgba(14, 124, 90, 0.16);
}
.al-nav-label {
  position: relative;
  z-index: 1;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.005em;
}
.al-nav-active-chev {
  position: relative;
  z-index: 1;
  color: var(--color-vedanta-green, #0e7c5a);
  opacity: 0.7;
}

/* User card · glass tile pinned at the bottom */
.al-user {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 4px 12px 14px;
  padding: 12px 13px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.62) 100%);
  backdrop-filter: blur(10px);
  border: 1px solid var(--surface-border);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.8) inset,
    0 8px 22px -12px rgba(11, 37, 69, 0.20);
  z-index: 1;
}
.al-user-avatar {
  position: relative;
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 9999px;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.32), transparent 50%),
    linear-gradient(135deg, #0e7c5a 0%, #0b2545 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
  flex-shrink: 0;
  box-shadow:
    0 4px 12px -4px rgba(14, 124, 90, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.20);
}
.al-user-status {
  position: absolute;
  right: -1px; bottom: -1px;
  width: 11px; height: 11px;
  border-radius: 9999px;
  background: var(--color-verified, #2e8b57);
  box-shadow:
    0 0 0 2px #fff,
    0 0 8px rgba(46, 139, 87, 0.5);
}
.al-user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.005em;
}
.al-user-role {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--fg-subtle);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.al-user-action {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  color: var(--fg-subtle);
  transition: background 180ms ease, color 180ms ease;
}
.al-user-action:hover {
  background: rgba(192, 57, 43, 0.10);
  color: var(--color-error, #c0392b);
}

/* Top bar — glassy, sticky, with a soft separator below */
.al-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 60px;
  padding: 0 24px;
  background: rgba(255, 255, 255, 0.80);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
}
.al-topbar::after {
  /* Soft fade separator instead of a hard 1 px border — more refined */
  content: '';
  position: absolute;
  inset: auto 0 0 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(11, 37, 69, 0.10) 8%,
    rgba(11, 37, 69, 0.10) 92%,
    transparent 100%);
}
.al-topbar-crumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--fg-subtle);
}
.al-topbar-crumb > span:first-child {
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.al-topbar-current {
  font-weight: 500;
  color: var(--fg-muted);
  text-transform: capitalize;
  letter-spacing: -0.005em;
}

.al-topbar-actions { display: flex; align-items: center; gap: 10px; }

.al-topbar-search {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  min-width: 280px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  font-size: 12.5px;
  color: var(--fg-subtle);
  font-weight: 500;
  cursor: pointer;
  transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
}
.al-topbar-search:hover {
  border-color: rgba(14, 124, 90, 0.40);
  background: var(--surface-page);
  box-shadow: 0 6px 16px -10px rgba(14, 124, 90, 0.32);
}
.al-topbar-search kbd {
  margin-left: auto;
  display: inline-flex; align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--fg-muted);
}

.al-topbar-bell {
  position: relative;
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  color: var(--fg-muted);
  cursor: pointer;
  transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
}
.al-topbar-bell:hover {
  background: var(--surface-page);
  color: var(--fg-default);
  border-color: rgba(14, 124, 90, 0.30);
}
.al-topbar-bell-dot {
  position: absolute;
  top: 7px; right: 9px;
  width: 8px; height: 8px;
  border-radius: 9999px;
  background: var(--color-trail-amber, #d9a441);
  box-shadow:
    0 0 0 2px #fff,
    0 0 8px rgba(217, 164, 65, 0.6);
}

.al-topbar-rolepill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background:
    linear-gradient(135deg, rgba(14, 124, 90, 0.12) 0%, rgba(14, 124, 90, 0.05) 100%);
  border: 1px solid rgba(14, 124, 90, 0.28);
  color: var(--color-vedanta-green, #0e7c5a);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
`
