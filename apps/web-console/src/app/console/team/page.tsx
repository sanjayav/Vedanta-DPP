import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  KeySquare,
  Lock,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
  Workflow,
} from 'lucide-react'

import { currentUser } from '@/lib/auth'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_PROFILES,
  TENANT_ROLES,
  canManage,
  hasPermission,
  type Permission,
  type PermissionGroup,
  type RoleProfile,
  type TenantRole,
} from '@/lib/rbac'

import { AnimatedKpi } from '@/components/console/AnimatedKpi'

import { InviteMemberDialog } from './InviteMemberDialog'
import { TeamRowMenu } from './TeamRowMenu'
import { listPendingInvites } from './invite-store'

export const revalidate = 30

type MemberStatus = 'active' | 'pending' | 'suspended'

interface Member {
  id: string
  name: string | null
  email: string
  role: TenantRole
  unit: string
  status: MemberStatus
  invitedAt: string
  joinedAt: string | null
  lastActiveAt: string | null
  mfaEnabled: boolean
  invitedBy: string
}

// HZL directory · plausible Vedanta names + corporate / operational emails.
const MEMBERS: Member[] = [
  { id: 'u-hzl-admin', name: 'Aashima V Khanna', email: 'sustainability.lead@vedanta.co.in', role: 'tenant_admin', unit: 'Sustainability & Compliance · Yashad Bhawan', status: 'active', invitedAt: '2025-12-01', joinedAt: '2025-12-02', lastActiveAt: '2026-05-08T09:32:00Z', mfaEnabled: true, invitedBy: 'platform' },
  { id: 'u-hzl-it', name: 'Rajesh Sharma', email: 'it.ops@vedanta.co.in', role: 'it_administrator', unit: 'Group IT · Udaipur HQ', status: 'active', invitedAt: '2026-01-10', joinedAt: '2026-01-10', lastActiveAt: '2026-05-07T17:11:00Z', mfaEnabled: true, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'u-hzl-ops-cha', name: 'Vikram Singh', email: 'chanderiya.ops@hzlindia.com', role: 'dpp_operator', unit: 'Chanderiya Lead-Zinc Smelter', status: 'active', invitedAt: '2026-01-15', joinedAt: '2026-01-15', lastActiveAt: '2026-05-08T07:45:00Z', mfaEnabled: true, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'u-hzl-ops-dar', name: 'Priya Iyer', email: 'dariba.ops@hzlindia.com', role: 'dpp_operator', unit: 'Dariba Smelting Complex', status: 'active', invitedAt: '2026-02-01', joinedAt: '2026-02-02', lastActiveAt: '2026-05-07T22:18:00Z', mfaEnabled: false, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'u-hzl-ops-pmp', name: 'Ananya Reddy', email: 'pantnagar.ops@hzlindia.com', role: 'dpp_operator', unit: 'Pantnagar Silver Refinery', status: 'active', invitedAt: '2026-02-15', joinedAt: '2026-02-16', lastActiveAt: '2026-05-06T13:09:00Z', mfaEnabled: true, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'u-hzl-qa-1', name: 'Arjun Rao', email: 'qa.carbon@vedanta.co.in', role: 'dpp_reviewer', unit: 'QA & Carbon Analyst', status: 'active', invitedAt: '2026-01-20', joinedAt: '2026-01-21', lastActiveAt: '2026-05-08T08:50:00Z', mfaEnabled: true, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'u-hzl-qa-2', name: 'Sneha Patel', email: 'lca.review@vedanta.co.in', role: 'dpp_reviewer', unit: 'LCA & Sustainability Reviewer', status: 'active', invitedAt: '2026-02-05', joinedAt: '2026-02-05', lastActiveAt: '2026-05-07T11:30:00Z', mfaEnabled: true, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'u-hzl-audit-1', name: 'Ramesh Naik', email: 'audit.internal@vedanta.co.in', role: 'tenant_auditor', unit: 'Internal Audit · Vedanta Group', status: 'active', invitedAt: '2026-01-20', joinedAt: '2026-01-22', lastActiveAt: '2026-05-05T16:00:00Z', mfaEnabled: true, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'u-hzl-audit-2', name: 'Pooja Mehta', email: 'compliance.bis@vedanta.co.in', role: 'tenant_auditor', unit: 'BIS / EPD Compliance', status: 'active', invitedAt: '2026-02-10', joinedAt: '2026-02-11', lastActiveAt: '2026-05-07T09:42:00Z', mfaEnabled: false, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'inv-1', name: null, email: 'logistics.mundra@hzlindia.com', role: 'dpp_operator', unit: 'Mundra Port Logistics', status: 'pending', invitedAt: '2026-04-25', joinedAt: null, lastActiveAt: null, mfaEnabled: false, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'inv-2', name: null, email: 'lab.tech.dariba@hzlindia.com', role: 'dpp_operator', unit: 'Dariba NABL Lab', status: 'pending', invitedAt: '2026-04-28', joinedAt: null, lastActiveAt: null, mfaEnabled: false, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'inv-3', name: null, email: 'environmental.cha@vedanta.co.in', role: 'tenant_auditor', unit: 'Environmental · Chanderiya', status: 'pending', invitedAt: '2026-05-01', joinedAt: null, lastActiveAt: null, mfaEnabled: false, invitedBy: 'sustainability.lead@vedanta.co.in' },
  { id: 'inv-4', name: null, email: 'shift.supervisor@hzlindia.com', role: 'dpp_operator', unit: 'Casthouse Shift A · Chanderiya', status: 'pending', invitedAt: '2026-05-05', joinedAt: null, lastActiveAt: null, mfaEnabled: false, invitedBy: 'it.ops@vedanta.co.in' },
  { id: 'sus-1', name: 'Karan Mehra', email: 'former.ops@vedanta.co.in', role: 'dpp_operator', unit: 'Left organisation · 2026-03-01', status: 'suspended', invitedAt: '2025-08-15', joinedAt: '2025-08-16', lastActiveAt: '2026-03-01T12:00:00Z', mfaEnabled: true, invitedBy: 'it.ops@vedanta.co.in' },
]

const RECENT_RBAC_EVENTS: { at: string; actor: string; action: string; target: string; detail: string }[] = [
  { at: '2026-05-07T17:11:00Z', actor: 'it.ops@vedanta.co.in', action: 'invited', target: 'lab.tech.dariba@hzlindia.com', detail: 'Role: DPP Operator' },
  { at: '2026-05-06T09:00:00Z', actor: 'sustainability.lead@vedanta.co.in', action: 'role_changed', target: 'qa.carbon@vedanta.co.in', detail: 'Operator → DPP Reviewer' },
  { at: '2026-05-02T14:30:00Z', actor: 'it.ops@vedanta.co.in', action: 'mfa_enforced', target: 'tenant', detail: 'MFA now required for tenant_admin and dpp_reviewer' },
  { at: '2026-04-25T08:30:00Z', actor: 'it.ops@vedanta.co.in', action: 'invited', target: 'logistics.mundra@hzlindia.com', detail: 'Role: DPP Operator' },
  { at: '2026-03-01T12:00:00Z', actor: 'sustainability.lead@vedanta.co.in', action: 'suspended', target: 'former.ops@vedanta.co.in', detail: 'Reason: left organisation' },
]

const STATUS_FILTERS: { key: 'all' | MemberStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
]

interface PageProps {
  searchParams: Promise<{ status?: string; role?: string }>
}

export default async function TeamPage({ searchParams }: PageProps) {
  const [me, params] = await Promise.all([currentUser(), searchParams])
  const myRole: TenantRole = (TENANT_ROLES as readonly string[]).includes(me.role)
    ? (me.role as TenantRole)
    : 'tenant_auditor'

  const liveInvites: Member[] = listPendingInvites().map((i) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    role: i.role,
    unit: 'Newly invited',
    status: 'pending',
    invitedAt: i.invitedAt,
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: i.invitedBy,
  }))
  const allMembers = [...liveInvites, ...MEMBERS]

  const statusFilter = (params.status ?? 'all') as 'all' | MemberStatus
  const roleFilter = (params.role ?? '') as TenantRole | ''

  const filtered = allMembers.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (roleFilter && m.role !== roleFilter) return false
    return true
  })

  const active = allMembers.filter((m) => m.status === 'active')
  const pending = allMembers.filter((m) => m.status === 'pending')
  const suspended = allMembers.filter((m) => m.status === 'suspended')
  const mfaCovered = active.filter((m) => m.mfaEnabled).length
  const mfaPct = active.length > 0 ? Math.round((mfaCovered / active.length) * 100) : 0

  const roleCounts: Record<TenantRole, number> = TENANT_ROLES.reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<TenantRole, number>,
  )
  for (const m of active) roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1

  const canManageUsers = hasPermission(myRole, 'manage_users')

  return (
    <div className="tm-page">
      <style>{TEAM_CSS}</style>

      <div className="tm-page__inner">
        {/* ── Hero ─────────────────────────────────────────── */}
        <header className="tm-hero">
          <div className="tm-hero__head">
            <div className="tm-hero__avatar" aria-hidden>
              <Users className="h-5 w-5" />
            </div>
            <div className="tm-hero__text">
              <p className="tm-hero__eyebrow">
                Tenant administration · {(me.tenantSlug ?? 'hzl').toUpperCase()}
              </p>
              <h1 className="tm-hero__title">Team &amp; Access</h1>
              <p className="tm-hero__sub">
                Five tenant roles map 1 : 1 to the SDD §12.1.1 RBAC table. Every state change is
                hash-chained to the audit log and reflected on the recipient&apos;s permission scope
                within the same request cycle.
              </p>
            </div>
          </div>
          <div className="tm-hero__actions">
            <Link href="/console/audit" className="tm-btn tm-btn--ghost">
              <ShieldCheck className="h-3.5 w-3.5" />
              Audit log
            </Link>
            {canManageUsers ? (
              <InviteMemberDialog
                grantableRoles={TENANT_ROLES.filter((r) => canManage(myRole, r))}
                myEmail={me.email}
              />
            ) : (
              <span
                className="tm-btn tm-btn--disabled"
                title="Requires Tenant Admin or IT Administrator"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite Member
              </span>
            )}
          </div>
        </header>

        {/* ── KPI strip — fixed 5 columns ────────────────────── */}
        <section className="tm-kpis">
          <KpiTile tone="navy" icon={<Users className="h-4 w-4" />} label="Total members" value={String(allMembers.length)} hint="All states" delay={0} />
          <KpiTile tone="green" icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={String(active.length)} hint={`${mfaCovered} MFA · ${active.length - mfaCovered} not`} delay={0.05} />
          <KpiTile tone="amber" icon={<Clock className="h-4 w-4" />} label="Pending invites" value={String(pending.length)} hint="Awaiting acceptance" delay={0.1} />
          <KpiTile tone="red" icon={<ShieldOff className="h-4 w-4" />} label="Suspended" value={String(suspended.length)} hint="Access revoked" delay={0.15} />
          <KpiTile tone="violet" icon={<KeySquare className="h-4 w-4" />} label="MFA coverage" value={String(mfaPct)} unit="%" hint="Of active members" delay={0.2} />
        </section>

        {/* ── Roles & reach (5 columns, exact) ───────────────── */}
        <section className="tm-section">
          <header className="tm-sectionhead">
            <p className="tm-sectionhead__eyebrow">SDD §12.1.1 · five tenant roles</p>
            <h2 className="tm-sectionhead__title">Roles &amp; reach</h2>
            <p className="tm-sectionhead__sub">
              Each role grants a precise set of permissions to a tenant-scoped surface. Hover any
              card to read the role&apos;s full description; click to reveal the permission grant.
            </p>
          </header>
          <div className="tm-roles">
            {TENANT_ROLES.map((r) => (
              <RoleCard
                key={r}
                profile={ROLE_PROFILES[r]}
                count={roleCounts[r] ?? 0}
                isMine={r === myRole}
                totalActive={active.length}
              />
            ))}
          </div>
        </section>

        {/* ── Permission matrix ──────────────────────────────── */}
        <section className="tm-section">
          <header className="tm-sectionhead">
            <p className="tm-sectionhead__eyebrow">Permission matrix · 19 capabilities</p>
            <h2 className="tm-sectionhead__title">Who can do what</h2>
            <p className="tm-sectionhead__sub">
              Coarse-grained, tenant-scoped permissions. Hover any row to highlight the full grant.
              The matrix scrolls horizontally on narrow viewports while the permission column stays
              put.
            </p>
          </header>
          <PermissionMatrix />
        </section>

        {/* ── Members table — single unified table with filter pills ─── */}
        <section className="tm-section">
          <header className="tm-sectionhead">
            <p className="tm-sectionhead__eyebrow">Directory</p>
            <h2 className="tm-sectionhead__title">Members</h2>
            <p className="tm-sectionhead__sub">
              {filtered.length} of {allMembers.length} shown · filter by status or role.
            </p>
          </header>

          <form action="/console/team" method="get" className="tm-filters">
            <div className="tm-filters__group">
              <span className="tm-filters__label">Status</span>
              <div className="tm-filters__chips">
                {STATUS_FILTERS.map((f) => {
                  const q = new URLSearchParams()
                  if (f.key !== 'all') q.set('status', f.key)
                  if (roleFilter) q.set('role', roleFilter)
                  const url = q.toString() ? `/console/team?${q.toString()}` : '/console/team'
                  const isActive = (statusFilter === 'all' && f.key === 'all') || statusFilter === f.key
                  const count =
                    f.key === 'all'
                      ? allMembers.length
                      : f.key === 'active'
                        ? active.length
                        : f.key === 'pending'
                          ? pending.length
                          : suspended.length
                  return (
                    <a key={f.key} href={url} className={`tm-chip${isActive ? ' is-active' : ''}`}>
                      {f.label}
                      <span className="tm-chip__count">{count}</span>
                    </a>
                  )
                })}
              </div>
            </div>
            <div className="tm-filters__group">
              <span className="tm-filters__label">Role</span>
              <div className="tm-filters__chips">
                {[
                  { key: '', label: 'All roles' },
                  ...TENANT_ROLES.map((r) => ({ key: r, label: ROLE_PROFILES[r].shortLabel })),
                ].map((f) => {
                  const q = new URLSearchParams()
                  if (statusFilter !== 'all') q.set('status', statusFilter)
                  if (f.key) q.set('role', f.key)
                  const url = q.toString() ? `/console/team?${q.toString()}` : '/console/team'
                  const isActive = (roleFilter === '' && f.key === '') || roleFilter === f.key
                  return (
                    <a key={f.key || 'any'} href={url} className={`tm-chip${isActive ? ' is-active' : ''}`}>
                      {f.label}
                    </a>
                  )
                })}
              </div>
            </div>
          </form>

          <div className="tm-table">
            <div className="tm-table__head" role="row">
              <span role="columnheader">Member</span>
              <span role="columnheader">Site / unit</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">MFA</span>
              <span role="columnheader">Last active</span>
              <span role="columnheader" aria-label="Actions" />
            </div>
            <ul className="tm-table__body">
              {filtered.length === 0 ? (
                <li className="tm-table__empty">
                  No members match these filters.
                </li>
              ) : (
                filtered.map((m) => {
                  const editable = canManage(myRole, m.role) && m.id !== me.id
                  const initial = (m.name ?? m.email)[0]?.toUpperCase() ?? '?'
                  const tone = ROLE_PROFILES[m.role].tone
                  return (
                    <li key={m.id} className={`tm-row tm-row--${m.status}`} role="row">
                      <div className="tm-row__cell tm-row__cell--member">
                        <span className={`tm-row__avatar tm-row__avatar--${tone}${m.status === 'suspended' ? ' is-muted' : ''}`}>
                          {initial}
                        </span>
                        <div className="tm-row__name">
                          <span className="tm-row__primary">
                            {m.name ?? m.email}
                            {m.id === me.id && <span className="tm-tag tm-tag--you">You</span>}
                          </span>
                          {m.name && <span className="tm-row__secondary">{m.email}</span>}
                        </div>
                      </div>
                      <span className="tm-row__cell tm-row__cell--unit" title={m.unit}>
                        {m.unit}
                      </span>
                      <span className="tm-row__cell tm-row__cell--role">
                        <RoleBadge role={m.role} muted={m.status === 'suspended'} />
                      </span>
                      <span className="tm-row__cell tm-row__cell--status">
                        <StatusPill status={m.status} />
                      </span>
                      <span className="tm-row__cell tm-row__cell--mfa">
                        {m.status === 'pending' ? (
                          <span className="tm-mfa tm-mfa--pending">—</span>
                        ) : m.status === 'suspended' ? (
                          <span className="tm-mfa tm-mfa--off">
                            <ShieldOff className="h-3 w-3" /> Revoked
                          </span>
                        ) : m.mfaEnabled ? (
                          <span className="tm-mfa tm-mfa--on">
                            <Lock className="h-3 w-3" /> Enabled
                          </span>
                        ) : (
                          <span className="tm-mfa tm-mfa--off">
                            <Lock className="h-3 w-3" /> Off
                          </span>
                        )}
                      </span>
                      <span className="tm-row__cell tm-row__cell--time">
                        {m.lastActiveAt
                          ? formatRelative(m.lastActiveAt)
                          : m.status === 'pending'
                            ? `Invited ${formatDate(m.invitedAt)}`
                            : '—'}
                      </span>
                      <span className="tm-row__cell tm-row__cell--actions">
                        {editable ? (
                          <TeamRowMenu kind={m.status === 'active' ? 'member' : m.status} />
                        ) : (
                          <span className="tm-row__dash">—</span>
                        )}
                      </span>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </section>

        {/* ── Recent RBAC events · audit timeline ───────────── */}
        <section className="tm-section">
          <header className="tm-sectionhead">
            <p className="tm-sectionhead__eyebrow">Audit timeline</p>
            <h2 className="tm-sectionhead__title">
              Recent RBAC events
              <Link href="/console/audit" className="tm-viewall">
                View full audit →
              </Link>
            </h2>
            <p className="tm-sectionhead__sub">
              Hash-chained · Ed25519-signed · streamed to <code>/api/v1/audit</code>.
            </p>
          </header>
          <ol className="tm-audit">
            {RECENT_RBAC_EVENTS.map((e, i) => {
              const tone = AUDIT_TONE[e.action] ?? '#94a3b8'
              return (
                <li key={i} className="tm-audit__row">
                  <span
                    className="tm-audit__pip"
                    style={{ background: tone, boxShadow: `0 0 0 4px ${tone}26` }}
                    aria-hidden
                  />
                  <div className="tm-audit__body">
                    <p className="tm-audit__line">
                      <span className="tm-audit__actor">{e.actor}</span>
                      <span className="tm-audit__verb"> {actionLabel(e.action)} </span>
                      <span className="tm-audit__target">{e.target}</span>
                    </p>
                    <p className="tm-audit__meta">
                      <span>{formatRelative(e.at)}</span>
                      <span aria-hidden>·</span>
                      <span>{e.detail}</span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </div>
  )
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function KpiTile({
  tone,
  icon,
  label,
  value,
  unit,
  hint,
  delay,
}: {
  tone: 'navy' | 'green' | 'amber' | 'red' | 'violet'
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  hint: string
  delay: number
}) {
  return (
    <article className={`tm-kpi tm-kpi--${tone}`}>
      <div className="tm-kpi__head">
        <span className={`tm-kpi__icon tm-kpi__icon--${tone}`}>{icon}</span>
        <p className="tm-kpi__label">{label}</p>
      </div>
      <div className="tm-kpi__value">
        <AnimatedKpi label="" value={value} unit={unit} hint={hint} delay={delay} />
      </div>
    </article>
  )
}

function RoleCard({
  profile,
  count,
  isMine,
  totalActive,
}: {
  profile: RoleProfile
  count: number
  isMine: boolean
  totalActive: number
}) {
  const pct = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0
  const top = profile.permissions.slice(0, 3)
  return (
    <details className={`tm-role tm-role--${profile.tone}`}>
      <summary className="tm-role__summary">
        <span className={`tm-role__glyph tm-role__glyph--${profile.tone}`} aria-hidden>
          {profile.glyph}
        </span>
        <div className="tm-role__head">
          <span className="tm-role__label">{profile.label}</span>
          {isMine && <span className="tm-tag tm-tag--you">Your role</span>}
        </div>
        <p className="tm-role__sub">{profile.summary}</p>
        <div className="tm-role__stats">
          <span className="tm-role__count">{count}</span>
          <span className="tm-role__count-label">{pct}% of active</span>
        </div>
      </summary>
      <div className="tm-role__body">
        <p className="tm-role__description">{profile.description}</p>
        <p className="tm-role__perm-label">
          Top {top.length} of {profile.permissions.length} permissions
        </p>
        <ul className="tm-role__perms">
          {top.map((p) => (
            <li key={p}>
              <CheckCircle2 className="h-3 w-3 text-[var(--color-green,#16a34a)]" />
              <span>{PERMISSION_LABELS[p].label}</span>
            </li>
          ))}
        </ul>
        <p className="tm-role__landing">
          Default landing · <code>{profile.defaultLanding}</code>
        </p>
      </div>
    </details>
  )
}

function PermissionMatrix() {
  const groups: PermissionGroup[] = PERMISSION_GROUPS
  return (
    <div className="tm-matrix-wrap">
      <table className="tm-matrix">
        <colgroup>
          <col className="tm-matrix__col-perm" />
          {TENANT_ROLES.map((r) => (
            <col key={r} className="tm-matrix__col-role" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="tm-matrix__th-perm">Permission</th>
            {TENANT_ROLES.map((r) => (
              <th key={r} className="tm-matrix__th-role">
                <span className={`tm-role__glyph tm-role__glyph--${ROLE_PROFILES[r].tone}`} aria-hidden>
                  {ROLE_PROFILES[r].glyph}
                </span>
                <span>{ROLE_PROFILES[r].shortLabel}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const perms = (Object.keys(PERMISSION_LABELS) as Permission[]).filter(
              (p) => PERMISSION_LABELS[p].group === g,
            )
            return (
              <>
                <tr key={`group-${g}`} className="tm-matrix__group">
                  <td colSpan={1 + TENANT_ROLES.length}>
                    <Workflow className="h-3 w-3" />
                    {g}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p} className="tm-matrix__row">
                    <td className="tm-matrix__perm">
                      <span className="tm-matrix__perm-label">{PERMISSION_LABELS[p].label}</span>
                      <span className="tm-matrix__perm-detail">
                        {PERMISSION_LABELS[p].description}
                      </span>
                    </td>
                    {TENANT_ROLES.map((r) => (
                      <td
                        key={r}
                        className={`tm-matrix__cell${
                          hasPermission(r, p) ? ' tm-matrix__cell--on' : ''
                        }`}
                      >
                        {hasPermission(r, p) ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <span className="tm-matrix__no">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RoleBadge({ role, muted }: { role: TenantRole; muted?: boolean }) {
  const p = ROLE_PROFILES[role]
  return (
    <span className={`tm-rolebadge tm-rolebadge--${p.tone}${muted ? ' is-muted' : ''}`}>
      <span className="tm-rolebadge__glyph">{p.glyph}</span>
      {p.shortLabel}
    </span>
  )
}

function StatusPill({ status }: { status: MemberStatus }) {
  const map: Record<MemberStatus, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'tm-status--active' },
    pending: { label: 'Pending', cls: 'tm-status--pending' },
    suspended: { label: 'Suspended', cls: 'tm-status--suspended' },
  }
  const s = map[status]
  return (
    <span className={`tm-status ${s.cls}`}>
      <span className="tm-status__dot" />
      {s.label}
    </span>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

const AUDIT_TONE: Record<string, string> = {
  invited: '#3B82F6',
  role_changed: '#7C3AED',
  mfa_enforced: '#0F4C81',
  suspended: '#DC2626',
  reinstated: '#16A34A',
}

function actionLabel(a: string): string {
  if (a === 'role_changed') return 'changed role for'
  if (a === 'mfa_enforced') return 'enforced MFA on'
  if (a === 'invited') return 'invited'
  if (a === 'suspended') return 'suspended'
  if (a === 'reinstated') return 'reinstated'
  return a.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return iso.slice(0, 10)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

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
  return formatDate(iso)
}

// ── styles ───────────────────────────────────────────────────────────────

const TEAM_CSS = `
.tm-page {
  min-height: calc(100vh - 56px);
  background: var(--surface-canvas, #f7f8fb);
}
.tm-page__inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* ── Hero ─────────────────────────────────────────────────────────── */
.tm-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: center;
  padding: 28px 28px 28px;
  margin: 0 -28px 0;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.08), transparent 55%),
    radial-gradient(circle at 100% 0%, rgba(124,58,237,0.06), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, var(--surface-canvas) 100%);
  border-bottom: 1px solid var(--surface-divider);
}
@media (max-width: 720px) {
  .tm-hero { grid-template-columns: 1fr; gap: 16px; }
}

.tm-hero__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  min-width: 0;
}
.tm-hero__avatar {
  display: grid; place-items: center;
  width: 48px; height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--color-accent, #0F4C81), #4F8FC7);
  color: #ffffff;
  flex-shrink: 0;
  box-shadow: 0 12px 28px -12px rgba(15,76,129,0.45);
}
.tm-hero__text { min-width: 0; }
.tm-hero__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
  margin: 0;
}
.tm-hero__title {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: clamp(22px, 2.6vw, 28px);
  font-weight: 600;
  letter-spacing: -0.014em;
  line-height: 1.2;
  color: var(--fg-default);
}
.tm-hero__sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 640px;
  line-height: 1.55;
}
.tm-hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-self: end;
}
@media (max-width: 720px) { .tm-hero__actions { justify-self: start; } }

.tm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: background 150ms ease, opacity 150ms ease;
}
.tm-btn--ghost {
  background: var(--surface-page);
  color: var(--fg-default);
  border: 1px solid var(--surface-border);
}
.tm-btn--ghost:hover { background: var(--surface-hover); }
.tm-btn--disabled {
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
  color: var(--fg-subtle);
  cursor: not-allowed;
}

/* ── KPI strip · 5 fixed columns ──────────────────────────────────── */
.tm-kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 1100px) { .tm-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px)  { .tm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.tm-kpi {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 18px 20px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  min-height: 116px;
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}
.tm-kpi:hover {
  transform: translateY(-2px);
  border-color: rgba(15,76,129,0.25);
  box-shadow: 0 14px 26px -16px rgba(15,23,42,0.20);
}
.tm-kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 16px; right: 16px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--kpi-accent, #94A3B8);
  opacity: 0.85;
}
.tm-kpi--navy   { --kpi-accent: #0F4C81; }
.tm-kpi--green  { --kpi-accent: #16A34A; }
.tm-kpi--amber  { --kpi-accent: #D97706; }
.tm-kpi--red    { --kpi-accent: #DC2626; }
.tm-kpi--violet { --kpi-accent: #7C3AED; }

.tm-kpi__head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tm-kpi__icon {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
}
.tm-kpi__icon--navy   { background: rgba(15,76,129,0.10);  color: #0F4C81; }
.tm-kpi__icon--green  { background: rgba(22,163,74,0.10);  color: #16A34A; }
.tm-kpi__icon--amber  { background: rgba(217,119,6,0.14);  color: #B45309; }
.tm-kpi__icon--red    { background: rgba(220,38,38,0.10);  color: #B91C1C; }
.tm-kpi__icon--violet { background: rgba(124,58,237,0.10); color: #7C3AED; }
.tm-kpi__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.tm-kpi__value { display: flex; align-items: flex-end; gap: 4px; min-height: 38px; }

/* ── Section + section-head shared rhythm ─────────────────────────── */
.tm-section { display: flex; flex-direction: column; gap: 14px; }
.tm-sectionhead { display: flex; flex-direction: column; gap: 4px; }
.tm-sectionhead__eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
  margin: 0;
}
.tm-sectionhead__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(20px, 2.4vw, 24px);
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--fg-default);
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.tm-sectionhead__sub {
  margin: 0;
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 640px;
  line-height: 1.55;
}
.tm-sectionhead__sub code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--surface-canvas);
  border-radius: 3px;
  border: 1px solid var(--surface-border);
}

.tm-viewall {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--color-accent);
  font-weight: 600;
}

/* ── Roles · 5 fixed columns ──────────────────────────────────────── */
.tm-roles {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 1180px) { .tm-roles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 720px)  { .tm-roles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px)  { .tm-roles { grid-template-columns: 1fr; } }

.tm-role {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow: hidden;
  transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
}
.tm-role:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 26px -14px rgba(15,23,42,0.18);
}
.tm-role[open] {
  box-shadow: 0 18px 30px -16px rgba(15,23,42,0.20);
}
.tm-role::before {
  content: '';
  position: absolute;
  top: 0; left: 14px; right: 14px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--role-accent);
}
.tm-role--accent  { --role-accent: linear-gradient(90deg, #0F4C81, #4F8FC7); }
.tm-role--success { --role-accent: linear-gradient(90deg, #16A34A, #4ADE80); }
.tm-role--warning { --role-accent: linear-gradient(90deg, #D97706, #F59E0B); }
.tm-role--info    { --role-accent: linear-gradient(90deg, #3B82F6, #60A5FA); }
.tm-role--neutral { --role-accent: linear-gradient(90deg, #64748B, #94A3B8); }

.tm-role__summary {
  list-style: none;
  cursor: pointer;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  column-gap: 12px;
  row-gap: 6px;
  padding: 18px 16px 16px;
}
.tm-role__summary::-webkit-details-marker { display: none; }
.tm-role__glyph {
  grid-row: 1 / span 2;
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  font-size: 18px;
}
.tm-role__glyph--accent  { background: rgba(15,76,129,0.10);  color: #0F4C81; }
.tm-role__glyph--success { background: rgba(22,163,74,0.10);  color: #14532D; }
.tm-role__glyph--warning { background: rgba(217,119,6,0.14);  color: #92400E; }
.tm-role__glyph--info    { background: rgba(59,130,246,0.10); color: #1E40AF; }
.tm-role__glyph--neutral { background: rgba(100,116,139,0.12); color: #475569; }

.tm-role__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.tm-role__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tm-role__sub {
  grid-column: 2;
  margin: 0;
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tm-role__stats {
  grid-column: 1 / span 2;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px dashed var(--surface-border);
}
.tm-role__count {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.014em;
  line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.tm-role__count-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}

.tm-role__body {
  padding: 0 16px 18px;
  border-top: 1px dashed var(--surface-border);
  margin: 0 4px;
}
.tm-role__description {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fg-muted);
}
.tm-role__perm-label {
  margin: 14px 0 8px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.tm-role__perms {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.tm-role__perms li {
  display: flex; align-items: center; gap: 6px;
  font-size: 12.5px;
  color: var(--fg-default);
}
.tm-role__landing {
  margin: 14px 0 0;
  font-size: 11px;
  color: var(--fg-subtle);
}
.tm-role__landing code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 6px;
  background: var(--surface-canvas);
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

/* ── Permission matrix ────────────────────────────────────────────── */
.tm-matrix-wrap {
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow-x: auto;
  scrollbar-width: thin;
}
.tm-matrix {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 760px;
}
.tm-matrix__col-perm { width: 40%; min-width: 320px; }
.tm-matrix__col-role { width: calc(60% / 5); min-width: 96px; }

.tm-matrix__th-perm,
.tm-matrix__th-role {
  background: var(--surface-canvas);
  border-bottom: 1px solid var(--surface-border);
  padding: 14px 16px;
  position: sticky;
  top: 0;
  z-index: 1;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-default);
  font-weight: 700;
}
.tm-matrix__th-perm { text-align: left; }
.tm-matrix__th-role {
  text-align: center;
  vertical-align: middle;
  padding: 12px 8px;
}
.tm-matrix__th-role .tm-role__glyph {
  width: 28px; height: 28px; font-size: 14px;
  margin: 0 auto 6px;
}

.tm-matrix__group td {
  padding: 12px 16px 8px;
  background: linear-gradient(180deg, var(--surface-canvas) 0%, transparent 100%);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.tm-matrix__group td svg {
  display: inline-block;
  margin-right: 6px;
  vertical-align: -1px;
}

.tm-matrix__row { transition: background 120ms ease; }
.tm-matrix__row:hover { background: rgba(15,76,129,0.04); }

.tm-matrix__perm {
  padding: 12px 16px;
  border-top: 1px solid var(--surface-divider);
  vertical-align: middle;
}
.tm-matrix__perm-label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-default);
}
.tm-matrix__perm-detail {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--fg-subtle);
  line-height: 1.4;
}

.tm-matrix__cell {
  padding: 12px 8px;
  text-align: center;
  vertical-align: middle;
  border-top: 1px solid var(--surface-divider);
  color: var(--fg-subtle);
}
.tm-matrix__cell svg { display: inline-block; vertical-align: middle; }
.tm-matrix__cell--on {
  color: #16A34A;
  background: rgba(22,163,74,0.04);
}
.tm-matrix__no {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--fg-subtle);
  opacity: 0.5;
}

/* ── Filter chips ─────────────────────────────────────────────────── */
.tm-filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
}
.tm-filters__group {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.tm-filters__label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.tm-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: var(--surface-canvas);
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-muted);
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.tm-chip:hover {
  background: var(--surface-hover);
  color: var(--fg-default);
}
.tm-chip.is-active {
  background: var(--color-accent, #0F4C81);
  color: #ffffff;
  border-color: var(--color-accent, #0F4C81);
}
.tm-chip__count {
  display: inline-grid; place-items: center;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: 9999px;
  background: rgba(255,255,255,0.20);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.tm-chip:not(.is-active) .tm-chip__count {
  background: var(--surface-hover);
  color: var(--fg-subtle);
}

/* ── Members table — strict 7-col grid, identical for head and rows ── */
.tm-table {
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow: hidden;
}

.tm-table__head,
.tm-row {
  display: grid;
  grid-template-columns:
    minmax(0, 2.4fr)  /* member */
    minmax(0, 1.7fr)  /* unit */
    minmax(0, 1fr)    /* role */
    minmax(0, 0.8fr)  /* status */
    minmax(0, 0.9fr)  /* mfa */
    minmax(0, 1fr)    /* time */
    44px;             /* actions */
  gap: 16px;
  align-items: center;
}

.tm-table__head {
  padding: 14px 18px;
  background: var(--surface-canvas);
  border-bottom: 1px solid var(--surface-border);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.tm-table__body { list-style: none; margin: 0; padding: 0; }
.tm-table__empty {
  padding: 56px 24px;
  text-align: center;
  color: var(--fg-subtle);
  font-size: 13px;
}

.tm-row {
  padding: 14px 18px;
  border-top: 1px solid var(--surface-divider);
  transition: background 120ms ease;
  min-height: 64px;
}
.tm-table__body > .tm-row:first-child { border-top: 0; }
.tm-row:hover { background: var(--surface-canvas); }
.tm-row--suspended { opacity: 0.86; }
.tm-row--pending { background: linear-gradient(180deg, rgba(217,119,6,0.04) 0%, transparent 100%); }

.tm-row__cell {
  font-size: 12.5px;
  color: var(--fg-default);
  min-width: 0;
}
.tm-row__cell--member { display: flex; align-items: center; gap: 12px; min-width: 0; }
.tm-row__avatar {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}
.tm-row__avatar--accent  { background: linear-gradient(135deg, #0F4C81, #4F8FC7); }
.tm-row__avatar--success { background: linear-gradient(135deg, #16A34A, #4ADE80); }
.tm-row__avatar--warning { background: linear-gradient(135deg, #D97706, #F59E0B); }
.tm-row__avatar--info    { background: linear-gradient(135deg, #3B82F6, #60A5FA); }
.tm-row__avatar--neutral { background: linear-gradient(135deg, #64748B, #94A3B8); }
.tm-row__avatar.is-muted {
  background: linear-gradient(135deg, #94A3B8, #CBD5E1);
  color: #475569;
}

.tm-row__name { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tm-row__primary {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.tm-row__secondary {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-row__cell--unit {
  font-size: 12px;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tm-row__cell--time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tm-row__cell--actions { display: flex; justify-content: flex-end; }
.tm-row__dash { color: var(--fg-subtle); font-family: var(--font-mono); font-size: 12px; }

.tm-tag {
  display: inline-flex; align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 9999px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
}
.tm-tag--you {
  background: rgba(15,76,129,0.10);
  border: 1px solid rgba(15,76,129,0.25);
  color: #0F4C81;
}

.tm-rolebadge {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.tm-rolebadge__glyph { font-size: 11px; line-height: 1; }
.tm-rolebadge--accent  { background: rgba(15,76,129,0.08);  color: #0F4C81; border-color: rgba(15,76,129,0.25); }
.tm-rolebadge--success { background: rgba(22,163,74,0.08);  color: #14532D; border-color: rgba(22,163,74,0.30); }
.tm-rolebadge--warning { background: rgba(217,119,6,0.10);  color: #92400E; border-color: rgba(217,119,6,0.30); }
.tm-rolebadge--info    { background: rgba(59,130,246,0.08); color: #1E40AF; border-color: rgba(59,130,246,0.30); }
.tm-rolebadge--neutral { background: rgba(100,116,139,0.10); color: #475569; border-color: rgba(100,116,139,0.30); }
.tm-rolebadge.is-muted { opacity: 0.7; }

.tm-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}
.tm-status__dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }
.tm-status--active    { color: #16A34A; }
.tm-status--pending   { color: #B45309; }
.tm-status--suspended { color: #B91C1C; }

.tm-mfa {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.tm-mfa--on { color: #16A34A; }
.tm-mfa--off { color: var(--fg-subtle); }
.tm-mfa--pending { color: var(--fg-subtle); font-family: var(--font-mono); font-size: 12px; }

/* ── Audit timeline ───────────────────────────────────────────────── */
.tm-audit {
  list-style: none;
  margin: 0; padding: 0;
}
.tm-audit__row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 0;
  position: relative;
}
.tm-audit__row:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 8px; top: 24px; bottom: -12px;
  width: 1px;
  background: var(--surface-border);
}
.tm-audit__pip {
  width: 10px; height: 10px;
  margin-left: 4px;
  margin-top: 5px;
  border-radius: 9999px;
  position: relative;
  z-index: 1;
}
.tm-audit__body { min-width: 0; }
.tm-audit__line {
  font-size: 13px;
  color: var(--fg-default);
  line-height: 1.4;
  margin: 0;
  word-break: break-word;
}
.tm-audit__actor { font-weight: 600; }
.tm-audit__verb { color: var(--fg-muted); }
.tm-audit__target { font-family: var(--font-mono); font-size: 12px; color: var(--fg-default); }
.tm-audit__meta {
  margin: 3px 0 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-subtle);
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
`
