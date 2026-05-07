'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Route } from 'next'
import {
  Activity,
  Bell,
  ChevronRight,
  ClipboardList,
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
  const visibleNav = NAV.filter((item) => !item.roles || item.roles.includes(user.role))
  const sections: NavSection[] = ['workspace', 'manage', 'data', 'admin']

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-[var(--surface-page)]">
      <style>{SHELL_CSS}</style>

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

        {/* Search shortcut */}
        <button type="button" className="al-search">
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd>⌘K</kbd>
        </button>

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
                          {isActive && <span className="al-nav-pill" aria-hidden />}
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
              <button type="button" className="al-topbar-search">
                <Search className="h-3.5 w-3.5" />
                <span>Search products, casts…</span>
                <kbd>⌘K</kbd>
              </button>
              <button type="button" className="al-topbar-bell" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                <span className="al-topbar-bell-dot" />
              </button>
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
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="al-mark-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e6abf" />
          <stop offset="100%" stopColor="#0f4c81" />
        </linearGradient>
        <linearGradient id="al-mark-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Hexagonal mark · references the carbon-6 ring (C6 Trail) and zinc's HCP atomic packing */}
      <path
        d="M16 3.5 L26.5 9.5 L26.5 22.5 L16 28.5 L5.5 22.5 L5.5 9.5 Z"
        fill="url(#al-mark-fill)"
        stroke="rgba(15,76,129,0.4)"
        strokeWidth="0.5"
      />
      {/* Inner highlight */}
      <path d="M16 5 L24.5 9.7 L24.5 14 L16 9 L7.5 14 L7.5 9.7 Z" fill="url(#al-mark-glow)" />
      {/* Trail mark · three dots flowing */}
      <circle cx="11.5" cy="20" r="1.4" fill="#fff" opacity="0.92" />
      <circle cx="16" cy="18" r="1.6" fill="#fff" />
      <circle cx="20.5" cy="20" r="1.4" fill="#fff" opacity="0.92" />
    </svg>
  )
}

const SHELL_CSS = `
.al-sidebar {
  display: flex;
  flex-direction: column;
  position: relative;
  background:
    linear-gradient(180deg, var(--surface-page) 0%, var(--color-cream) 100%);
  border-right: 1px solid var(--surface-border);
  overflow: hidden;
}
.al-sidebar::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 220px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.10), transparent 60%),
    radial-gradient(circle at 100% 0%, rgba(245,158,11,0.05), transparent 60%);
  pointer-events: none;
}

/* Brand */
.al-brand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  margin: 4px;
  border-radius: 14px;
  transition: background 200ms ease;
  z-index: 1;
}
.al-brand:hover { background: rgba(15,76,129,0.04); }
.al-brand-mark {
  width: 38px; height: 38px;
  display: grid; place-items: center;
  flex-shrink: 0;
  filter: drop-shadow(0 6px 14px rgba(15,76,129,0.32));
}
.al-brand-mark svg { width: 100%; height: 100%; }
.al-brand-text { display: flex; flex-direction: column; line-height: 1.1; min-width: 0; }
.al-brand-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--fg-default);
}
.al-brand-name-accent {
  background: linear-gradient(135deg, #0f4c81, #2a6cb8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 700;
}
.al-brand-by {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.al-brand-glow {
  position: absolute;
  inset: auto 0 -1px 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(15,76,129,0.18), transparent);
}

/* Search shortcut tile */
.al-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 6px 12px 12px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.6);
  font-size: 12px;
  color: var(--fg-subtle);
  text-align: left;
  transition: background 150ms, border-color 150ms;
  z-index: 1;
}
.al-search:hover { background: var(--surface-page); border-color: var(--color-graphite); color: var(--fg-default); }
.al-search kbd {
  margin-left: auto;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-muted);
}

/* Nav */
.al-nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-border) transparent;
}
.al-nav::-webkit-scrollbar { width: 6px; }
.al-nav::-webkit-scrollbar-thumb { background: var(--surface-border); border-radius: 9999px; }
.al-nav-section { margin-bottom: 14px; }
.al-nav-section-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 6px 12px;
  margin-bottom: 2px;
}
.al-nav-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1px; }

.al-nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px 7px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fg-muted);
  transition: color 150ms, background 150ms;
}
.al-nav-link:hover {
  background: rgba(15, 23, 42, 0.04);
  color: var(--fg-default);
}
.al-nav-link.is-active {
  color: var(--color-accent);
  font-weight: 600;
}
.al-nav-pill {
  position: absolute;
  inset: 0;
  border-radius: 9px;
  background: linear-gradient(95deg, rgba(15,76,129,0.10), rgba(15,76,129,0.04));
  border: 1px solid rgba(15,76,129,0.18);
  box-shadow: 0 4px 12px -4px rgba(15,76,129,0.18);
  z-index: 0;
}

.al-nav-icon-wrap {
  position: relative;
  display: grid; place-items: center;
  width: 22px; height: 22px;
  border-radius: 6px;
  color: var(--fg-subtle);
  flex-shrink: 0;
  z-index: 1;
  transition: background 150ms, color 150ms;
}
.al-nav-link:hover .al-nav-icon-wrap { color: var(--fg-default); }
.al-nav-link.is-active .al-nav-icon-wrap {
  background: rgba(15,76,129,0.14);
  color: var(--color-accent);
}
.al-nav-label {
  position: relative;
  z-index: 1;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.al-nav-active-chev {
  position: relative;
  z-index: 1;
  color: var(--color-accent);
  opacity: 0.7;
}

/* User card */
.al-user {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 12px 12px;
  padding: 11px 12px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55));
  border: 1px solid var(--surface-border);
  box-shadow: 0 4px 14px -8px rgba(15,23,42,0.18);
}
.al-user-avatar {
  position: relative;
  display: grid; place-items: center;
  width: 34px; height: 34px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #0f4c81, #4f8fc7);
  color: #fff;
  font-size: 12px; font-weight: 700;
  letter-spacing: -0.01em;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -4px rgba(15,76,129,0.45);
}
.al-user-status {
  position: absolute;
  right: -1px; bottom: -1px;
  width: 10px; height: 10px;
  border-radius: 9999px;
  background: var(--color-green, #16a34a);
  box-shadow: 0 0 0 2px #fff, 0 0 6px rgba(22,163,74,0.5);
}
.al-user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.al-user-role {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--fg-subtle);
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.al-user-action {
  display: grid; place-items: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  color: var(--fg-subtle);
  transition: background 150ms, color 150ms;
}
.al-user-action:hover {
  background: var(--surface-hover);
  color: var(--fg-default);
}

/* Top bar */
.al-topbar {
  position: sticky;
  top: 0; z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 56px;
  padding: 0 22px;
  border-bottom: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.78);
  backdrop-filter: saturate(140%) blur(14px);
  -webkit-backdrop-filter: saturate(140%) blur(14px);
}
.al-topbar-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--fg-subtle);
}
.al-topbar-crumb > span:first-child { font-weight: 600; color: var(--fg-default); }
.al-topbar-current {
  font-weight: 500;
  color: var(--fg-muted);
  text-transform: capitalize;
}
.al-topbar-actions { display: flex; align-items: center; gap: 10px; }
.al-topbar-search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  min-width: 240px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.7);
  font-size: 12px;
  color: var(--fg-subtle);
  transition: border-color 150ms, background 150ms;
}
.al-topbar-search:hover { border-color: var(--color-graphite); background: var(--surface-page); }
.al-topbar-search kbd {
  margin-left: auto;
  padding: 1.5px 6px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-muted);
}
.al-topbar-bell {
  position: relative;
  display: grid; place-items: center;
  width: 34px; height: 34px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.7);
  color: var(--fg-muted);
  transition: background 150ms, color 150ms, border-color 150ms;
}
.al-topbar-bell:hover { background: var(--surface-page); color: var(--fg-default); border-color: var(--color-graphite); }
.al-topbar-bell-dot {
  position: absolute;
  top: 6px; right: 8px;
  width: 7px; height: 7px;
  border-radius: 9999px;
  background: var(--color-accent);
  box-shadow: 0 0 0 2px #fff;
}
.al-topbar-rolepill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 9999px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
`
