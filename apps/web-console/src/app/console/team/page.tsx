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

interface Member {
  id: string
  name: string | null
  email: string
  role: TenantRole
  /** Department / site for the directory list. */
  unit: string
  status: 'active' | 'pending' | 'suspended'
  invitedAt: string
  joinedAt: string | null
  lastActiveAt: string | null
  mfaEnabled: boolean
  invitedBy: string
}

// HZL directory · plausible Vedanta names + corporate / operational emails.
// These map to the five tenant roles in the SDD §12.1.1 RBAC table.
const MEMBERS: Member[] = [
  {
    id: 'u-hzl-admin',
    name: 'Aashima V Khanna',
    email: 'sustainability.lead@vedanta.co.in',
    role: 'tenant_admin',
    unit: 'Sustainability & Compliance · Yashad Bhawan',
    status: 'active',
    invitedAt: '2025-12-01',
    joinedAt: '2025-12-02',
    lastActiveAt: '2026-05-08T09:32:00Z',
    mfaEnabled: true,
    invitedBy: 'platform',
  },
  {
    id: 'u-hzl-it',
    name: 'Rajesh Sharma',
    email: 'it.ops@vedanta.co.in',
    role: 'it_administrator',
    unit: 'Group IT · Udaipur HQ',
    status: 'active',
    invitedAt: '2026-01-10',
    joinedAt: '2026-01-10',
    lastActiveAt: '2026-05-07T17:11:00Z',
    mfaEnabled: true,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  {
    id: 'u-hzl-ops-cha',
    name: 'Vikram Singh',
    email: 'chanderiya.ops@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Chanderiya Lead-Zinc Smelter (CLZS)',
    status: 'active',
    invitedAt: '2026-01-15',
    joinedAt: '2026-01-15',
    lastActiveAt: '2026-05-08T07:45:00Z',
    mfaEnabled: true,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  {
    id: 'u-hzl-ops-dar',
    name: 'Priya Iyer',
    email: 'dariba.ops@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Dariba Smelting Complex (DSC)',
    status: 'active',
    invitedAt: '2026-02-01',
    joinedAt: '2026-02-02',
    lastActiveAt: '2026-05-07T22:18:00Z',
    mfaEnabled: false,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  {
    id: 'u-hzl-ops-pmp',
    name: 'Ananya Reddy',
    email: 'pantnagar.ops@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Pantnagar Metal Plant · Silver Refinery',
    status: 'active',
    invitedAt: '2026-02-15',
    joinedAt: '2026-02-16',
    lastActiveAt: '2026-05-06T13:09:00Z',
    mfaEnabled: true,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  {
    id: 'u-hzl-qa-1',
    name: 'Arjun Rao',
    email: 'qa.carbon@vedanta.co.in',
    role: 'dpp_reviewer',
    unit: 'QA & Carbon Analyst · Group',
    status: 'active',
    invitedAt: '2026-01-20',
    joinedAt: '2026-01-21',
    lastActiveAt: '2026-05-08T08:50:00Z',
    mfaEnabled: true,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  {
    id: 'u-hzl-qa-2',
    name: 'Sneha Patel',
    email: 'lca.review@vedanta.co.in',
    role: 'dpp_reviewer',
    unit: 'LCA & Sustainability Reviewer',
    status: 'active',
    invitedAt: '2026-02-05',
    joinedAt: '2026-02-05',
    lastActiveAt: '2026-05-07T11:30:00Z',
    mfaEnabled: true,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  {
    id: 'u-hzl-audit-1',
    name: 'Ramesh Naik',
    email: 'audit.internal@vedanta.co.in',
    role: 'tenant_auditor',
    unit: 'Internal Audit · Vedanta Group',
    status: 'active',
    invitedAt: '2026-01-20',
    joinedAt: '2026-01-22',
    lastActiveAt: '2026-05-05T16:00:00Z',
    mfaEnabled: true,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  {
    id: 'u-hzl-audit-2',
    name: 'Pooja Mehta',
    email: 'compliance.bis@vedanta.co.in',
    role: 'tenant_auditor',
    unit: 'BIS / EPD Compliance',
    status: 'active',
    invitedAt: '2026-02-10',
    joinedAt: '2026-02-11',
    lastActiveAt: '2026-05-07T09:42:00Z',
    mfaEnabled: false,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  // Pending invites
  {
    id: 'inv-1',
    name: null,
    email: 'logistics.mundra@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Mundra Port Logistics',
    status: 'pending',
    invitedAt: '2026-04-25',
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  {
    id: 'inv-2',
    name: null,
    email: 'lab.tech.dariba@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Dariba NABL Lab',
    status: 'pending',
    invitedAt: '2026-04-28',
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  {
    id: 'inv-3',
    name: null,
    email: 'environmental.cha@vedanta.co.in',
    role: 'tenant_auditor',
    unit: 'Environmental · Chanderiya',
    status: 'pending',
    invitedAt: '2026-05-01',
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: 'sustainability.lead@vedanta.co.in',
  },
  {
    id: 'inv-4',
    name: null,
    email: 'shift.supervisor@hzlindia.com',
    role: 'dpp_operator',
    unit: 'Casthouse Shift A · Chanderiya',
    status: 'pending',
    invitedAt: '2026-05-05',
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: 'it.ops@vedanta.co.in',
  },
  // Suspended
  {
    id: 'sus-1',
    name: 'Karan Mehra',
    email: 'former.ops@vedanta.co.in',
    role: 'dpp_operator',
    unit: 'Left organisation · 2026-03-01',
    status: 'suspended',
    invitedAt: '2025-08-15',
    joinedAt: '2025-08-16',
    lastActiveAt: '2026-03-01T12:00:00Z',
    mfaEnabled: true,
    invitedBy: 'it.ops@vedanta.co.in',
  },
]

const RECENT_RBAC_EVENTS: { at: string; actor: string; action: string; target: string; detail: string }[] = [
  {
    at: '2026-05-07T17:11:00Z',
    actor: 'it.ops@vedanta.co.in',
    action: 'invited',
    target: 'lab.tech.dariba@hzlindia.com',
    detail: 'Role: DPP Operator',
  },
  {
    at: '2026-05-06T09:00:00Z',
    actor: 'sustainability.lead@vedanta.co.in',
    action: 'role_changed',
    target: 'qa.carbon@vedanta.co.in',
    detail: 'Operator → DPP Reviewer',
  },
  {
    at: '2026-05-02T14:30:00Z',
    actor: 'it.ops@vedanta.co.in',
    action: 'mfa_enforced',
    target: 'tenant',
    detail: 'MFA now required for tenant_admin and dpp_reviewer',
  },
  {
    at: '2026-04-25T08:30:00Z',
    actor: 'it.ops@vedanta.co.in',
    action: 'invited',
    target: 'logistics.mundra@hzlindia.com',
    detail: 'Role: DPP Operator',
  },
  {
    at: '2026-03-01T12:00:00Z',
    actor: 'sustainability.lead@vedanta.co.in',
    action: 'suspended',
    target: 'former.ops@vedanta.co.in',
    detail: 'Reason: left organisation',
  },
]

export default async function TeamPage() {
  const me = await currentUser()
  const myRole: TenantRole = (TENANT_ROLES as readonly string[]).includes(me.role)
    ? (me.role as TenantRole)
    : 'tenant_auditor'

  const liveInvites: Member[] = listPendingInvites().map((i) => ({
    id: i.id,
    name: i.name,
    email: i.email,
    role: i.role,
    unit: 'Newly invited',
    status: 'pending' as const,
    invitedAt: i.invitedAt,
    joinedAt: null,
    lastActiveAt: null,
    mfaEnabled: false,
    invitedBy: i.invitedBy,
  }))
  const allMembers = [...liveInvites, ...MEMBERS]

  const active = allMembers.filter((m) => m.status === 'active')
  const pending = allMembers.filter((m) => m.status === 'pending')
  const suspended = allMembers.filter((m) => m.status === 'suspended')
  const mfaCovered = active.filter((m) => m.mfaEnabled).length

  const roleCounts: Record<TenantRole, number> = TENANT_ROLES.reduce(
    (acc, r) => ({ ...acc, [r]: 0 }),
    {} as Record<TenantRole, number>,
  )
  for (const m of active) roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1

  const canManageUsers = hasPermission(myRole, 'manage_users')

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[var(--surface-canvas)]">
      <style>{TEAM_CSS}</style>

      <div className="mx-auto max-w-[1320px] px-7 py-7">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <header className="team__hero">
          <div className="team__hero-block">
            <div className="team__hero-avatar" aria-hidden>
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="team__hero-eyebrow">Tenant administration · {(me.tenantSlug ?? 'hzl').toUpperCase()}</p>
              <h1 className="team__hero-title">Team &amp; Access</h1>
              <p className="team__hero-sub">
                Five tenant roles map 1:1 to the SDD §12.1.1 RBAC table. Every state change is
                hash-chained into the audit log, signed Ed25519, and reflected on the recipient&apos;s
                permission scope within the same request cycle.
              </p>
            </div>
          </div>
          <div className="team__hero-actions">
            <Link href="/console/audit" className="team__btn team__btn--ghost">
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
                className="team__btn team__btn--disabled"
                title="Requires Tenant Admin or IT Administrator"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite Member
              </span>
            )}
          </div>
        </header>

        {/* ── KPI strip · animated counters ──────────────────────── */}
        <section className="team__kpis">
          <KpiTile
            tone="navy"
            icon={<Users className="h-4 w-4" />}
            label="Total members"
            value={String(MEMBERS.length)}
            hint="All states"
            delay={0}
          />
          <KpiTile
            tone="green"
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Active"
            value={String(active.length)}
            hint={`${mfaCovered}/${active.length} have MFA`}
            delay={0.05}
          />
          <KpiTile
            tone="amber"
            icon={<Clock className="h-4 w-4" />}
            label="Pending invites"
            value={String(pending.length)}
            hint="Awaiting acceptance"
            delay={0.10}
          />
          <KpiTile
            tone="red"
            icon={<ShieldOff className="h-4 w-4" />}
            label="Suspended"
            value={String(suspended.length)}
            hint="Access revoked"
            delay={0.15}
          />
          <KpiTile
            tone="violet"
            icon={<KeySquare className="h-4 w-4" />}
            label="MFA coverage"
            value={`${active.length > 0 ? Math.round((mfaCovered / active.length) * 100) : 0}`}
            unit="%"
            hint="Active members"
            delay={0.20}
          />
        </section>

        {/* ── Role pillars · the centerpiece ────────────────────── */}
        <section className="team__roles">
          <header className="team__sectionhead">
            <p className="team__sectionhead-eyebrow">SDD §12.1.1 · five tenant roles</p>
            <h2 className="team__sectionhead-title">Roles &amp; reach</h2>
            <p className="team__sectionhead-sub">
              Each role grants a precise set of permissions to a tenant-scoped surface. Click a
              card to see the full grant.
            </p>
          </header>
          <div className="team__role-grid">
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

        {/* ── Permission matrix — always visible, with hover ───── */}
        <section className="team__matrix-section">
          <header className="team__sectionhead">
            <p className="team__sectionhead-eyebrow">Permission matrix · 19 capabilities</p>
            <h2 className="team__sectionhead-title">Who can do what</h2>
            <p className="team__sectionhead-sub">
              Permissions are coarse-grained, scoped to one tenant. Hover a row to highlight the
              full grant; the matrix is sticky on both axes for long lists.
            </p>
          </header>
          <PermissionMatrix />
        </section>

        {/* ── Pending invitations ───────────────────────────────── */}
        {pending.length > 0 && (
          <section className="team__section">
            <header className="team__list-head">
              <h2 className="team__list-title">
                Pending invitations
                <span className="team__count team__count--amber">{pending.length}</span>
              </h2>
              <p className="team__list-sub">Single-use links · expire in 7 days · MFA required on accept.</p>
            </header>
            <ul className="team__rows">
              {pending.map((m) => (
                <li key={m.id} className="team__row team__row--pending">
                  <span className="team__row-icon team__row-icon--amber">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="team__row-primary">{m.email}</p>
                    <p className="team__row-secondary">
                      {m.unit} · invited {formatDate(m.invitedAt)} by {m.invitedBy}
                    </p>
                  </div>
                  <RoleBadge role={m.role} />
                  <span className="team__pill team__pill--amber">Pending</span>
                  {canManage(myRole, m.role) && <TeamRowMenu kind="pending" />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Active members ────────────────────────────────────── */}
        <section className="team__section">
          <header className="team__list-head">
            <h2 className="team__list-title">
              Members
              <span className="team__count">{active.length}</span>
            </h2>
            <p className="team__list-sub">Sorted by role · most-recently active first.</p>
          </header>
          <div className="team__rows-card">
            <div className="team__rows-head">
              <span>Member</span>
              <span>Site / unit</span>
              <span>Role</span>
              <span>MFA</span>
              <span>Last active</span>
              <span aria-hidden />
            </div>
            <ul className="team__rows team__rows--flat">
              {active.map((m) => {
                const editable = canManage(myRole, m.role) && m.id !== me.id
                return (
                  <li key={m.id} className="team__row team__row--member">
                    <div className="team__row-name">
                      <div className={`team__avatar team__avatar--${ROLE_PROFILES[m.role].tone}`}>
                        {(m.name ?? m.email)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="team__row-primary">
                          {m.name ?? m.email}
                          {m.id === me.id && <span className="team__youtag">You</span>}
                        </p>
                        <p className="team__row-secondary">{m.email}</p>
                      </div>
                    </div>
                    <span className="team__row-unit">{m.unit}</span>
                    <RoleBadge role={m.role} />
                    {m.mfaEnabled ? (
                      <span className="team__mfa team__mfa--on">
                        <Lock className="h-3 w-3" /> Enabled
                      </span>
                    ) : (
                      <span className="team__mfa team__mfa--off">
                        <Lock className="h-3 w-3" /> Off
                      </span>
                    )}
                    <span className="team__row-time" title={m.lastActiveAt ?? '—'}>
                      {m.lastActiveAt ? formatRelative(m.lastActiveAt) : '—'}
                    </span>
                    {editable ? (
                      <TeamRowMenu kind="member" />
                    ) : (
                      <span className="team__row-time">—</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ── Suspended ─────────────────────────────────────────── */}
        {suspended.length > 0 && (
          <section className="team__section">
            <header className="team__list-head">
              <h2 className="team__list-title">
                Suspended
                <span className="team__count team__count--danger">{suspended.length}</span>
              </h2>
              <p className="team__list-sub">Access revoked · session keys rotated · audit retained.</p>
            </header>
            <ul className="team__rows">
              {suspended.map((m) => (
                <li key={m.id} className="team__row team__row--member team__row--muted">
                  <div className="team__row-name">
                    <div className="team__avatar team__avatar--muted">
                      {(m.name ?? m.email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="team__row-primary">{m.name ?? m.email}</p>
                      <p className="team__row-secondary">{m.email}</p>
                    </div>
                  </div>
                  <span className="team__row-unit">{m.unit}</span>
                  <RoleBadge role={m.role} muted />
                  <span className="team__mfa team__mfa--off">
                    <ShieldOff className="h-3 w-3" /> Revoked
                  </span>
                  <span className="team__row-time">
                    {m.lastActiveAt ? formatRelative(m.lastActiveAt) : '—'}
                  </span>
                  {canManage(myRole, m.role) && <TeamRowMenu kind="suspended" />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Recent RBAC events · audit timeline ───────────────── */}
        <section className="team__section">
          <header className="team__list-head">
            <h2 className="team__list-title">
              Recent RBAC events
              <Link href="/console/audit" className="team__viewall">
                View full audit →
              </Link>
            </h2>
            <p className="team__list-sub">
              Hash-chained · Ed25519-signed · streamed to <code>/api/v1/audit</code>.
            </p>
          </header>
          <ol className="team__audit">
            {RECENT_RBAC_EVENTS.map((e, i) => {
              const tone = AUDIT_TONE[e.action] ?? '#94a3b8'
              return (
                <li key={i} className="team__audit-row">
                  <span
                    className="team__audit-pip"
                    style={{ background: tone, boxShadow: `0 0 0 4px ${tone}26` }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="team__audit-line">
                      <span className="team__audit-actor">{e.actor}</span>
                      <span className="team__audit-verb"> {actionLabel(e.action)} </span>
                      <span className="team__audit-target">{e.target}</span>
                    </p>
                    <p className="team__audit-meta">
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
    <article className={`team__kpi team__kpi--${tone}`}>
      <div className="team__kpi-head">
        <span className={`team__kpi-icon team__kpi-icon--${tone}`}>{icon}</span>
        <p className="team__kpi-label">{label}</p>
      </div>
      <AnimatedKpi label="" value={value} unit={unit} hint={hint} delay={delay} />
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
    <details className={`team__role team__role--${profile.tone}`}>
      <summary className="team__role-summary">
        <span className={`team__role-glyph team__role-glyph--${profile.tone}`}>
          {profile.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="team__role-head">
            <h3 className="team__role-label">{profile.label}</h3>
            {isMine && <span className="team__youtag">Your role</span>}
          </div>
          <p className="team__role-sub">{profile.summary}</p>
        </div>
        <div className="team__role-stat">
          <span className="team__role-count">{count}</span>
          <span className="team__role-count-label">{pct}% of active</span>
        </div>
      </summary>
      <div className="team__role-body">
        <p className="team__role-description">{profile.description}</p>
        <div className="team__role-perms">
          <p className="team__role-perm-label">
            Top {top.length} of {profile.permissions.length} permissions
          </p>
          <ul className="team__role-perm-list">
            {top.map((p) => (
              <li key={p}>
                <CheckCircle2 className="h-3 w-3 text-[var(--color-green,#16a34a)]" />
                <span>{PERMISSION_LABELS[p].label}</span>
              </li>
            ))}
          </ul>
          <p className="team__role-meta">
            Default landing: <code>{profile.defaultLanding}</code>
          </p>
        </div>
      </div>
    </details>
  )
}

function PermissionMatrix() {
  const groups: PermissionGroup[] = PERMISSION_GROUPS
  return (
    <div className="team__matrix-wrap">
      <table className="team__matrix">
        <thead>
          <tr>
            <th className="team__matrix-th-label">Permission</th>
            {TENANT_ROLES.map((r) => (
              <th key={r} className={`team__matrix-th team__matrix-th--${ROLE_PROFILES[r].tone}`}>
                <span className={`team__role-glyph team__role-glyph--${ROLE_PROFILES[r].tone}`}>
                  {ROLE_PROFILES[r].glyph}
                </span>
                <span className="block">{ROLE_PROFILES[r].shortLabel}</span>
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
                <tr key={`group-${g}`} className="team__matrix-grouprow-row">
                  <td colSpan={1 + TENANT_ROLES.length} className="team__matrix-grouprow">
                    <Workflow className="h-3 w-3" />
                    {g}
                  </td>
                </tr>
                {perms.map((p) => (
                  <tr key={p} className="team__matrix-row">
                    <td className="team__matrix-perm">
                      <span className="team__matrix-perm-label">{PERMISSION_LABELS[p].label}</span>
                      <span className="team__matrix-perm-detail">
                        {PERMISSION_LABELS[p].description}
                      </span>
                    </td>
                    {TENANT_ROLES.map((r) => (
                      <td
                        key={r}
                        className={`team__matrix-cell${
                          hasPermission(r, p) ? ' team__matrix-cell--on' : ''
                        }`}
                      >
                        {hasPermission(r, p) ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5" />
                        ) : (
                          <span className="team__matrix-cell-no">—</span>
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
    <span
      className={`team__rolebadge team__rolebadge--${p.tone}${muted ? ' team__rolebadge--muted' : ''}`}
    >
      <span className="team__rolebadge-glyph">{p.glyph}</span>
      {p.label}
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
/* Hero band — unifies the page with the rest of the console chrome */
.team__hero {
  position: relative;
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px;
  justify-content: space-between;
  padding: 28px 28px 26px;
  margin: 0 -28px 24px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.08), transparent 55%),
    radial-gradient(circle at 100% 0%, rgba(124,58,237,0.06), transparent 55%),
    linear-gradient(180deg, #ffffff 0%, var(--surface-canvas) 100%);
  border-bottom: 1px solid var(--surface-divider);
}
.team__hero-block { display: flex; align-items: flex-start; gap: 16px; min-width: 0; }
.team__hero-avatar {
  display: grid; place-items: center;
  width: 52px; height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--color-accent, #0F4C81), #4f8fc7);
  color: #ffffff;
  flex-shrink: 0;
  box-shadow:
    0 12px 28px -10px rgba(15,76,129,0.45),
    0 0 0 1px rgba(15,76,129,0.15) inset;
}
.team__hero-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.team__hero-title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: clamp(24px, 3vw, 30px);
  font-weight: 600;
  letter-spacing: -0.014em;
  line-height: 1.1;
  color: var(--fg-default);
}
.team__hero-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 660px;
  line-height: 1.55;
}
.team__hero-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.team__btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  border-radius: 9px;
  font-size: 12px; font-weight: 600;
  white-space: nowrap;
  transition: background 150ms, opacity 150ms;
}
.team__btn--ghost {
  background: var(--surface-page);
  color: var(--fg-default);
  border: 1px solid var(--surface-border);
}
.team__btn--ghost:hover { background: var(--surface-hover); }
.team__btn--disabled {
  background: var(--surface-canvas);
  border: 1px solid var(--surface-border);
  color: var(--fg-subtle);
  cursor: not-allowed;
}

/* KPI strip */
.team__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.team__kpi {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 18px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}
.team__kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 24px -16px rgba(15,23,42,0.20);
  border-color: rgba(15,76,129,0.25);
}
.team__kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 16px; right: 16px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--kpi-accent, #94A3B8);
  opacity: 0.85;
}
.team__kpi--navy   { --kpi-accent: #0F4C81; }
.team__kpi--green  { --kpi-accent: #16A34A; }
.team__kpi--amber  { --kpi-accent: #D97706; }
.team__kpi--red    { --kpi-accent: #DC2626; }
.team__kpi--violet { --kpi-accent: #7C3AED; }

.team__kpi-head { display: flex; align-items: center; gap: 10px; }
.team__kpi-icon {
  display: grid; place-items: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--surface-hover);
}
.team__kpi-icon--navy   { background: rgba(15,76,129,0.10); color: #0F4C81; }
.team__kpi-icon--green  { background: rgba(22,163,74,0.10); color: #16A34A; }
.team__kpi-icon--amber  { background: rgba(217,119,6,0.14); color: #B45309; }
.team__kpi-icon--red    { background: rgba(220,38,38,0.10); color: #B91C1C; }
.team__kpi-icon--violet { background: rgba(124,58,237,0.10); color: #7C3AED; }

.team__kpi-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}

/* Section heads */
.team__sectionhead { margin-bottom: 18px; }
.team__sectionhead-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.team__sectionhead-title {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: clamp(20px, 2.4vw, 24px);
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--fg-default);
}
.team__sectionhead-sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--fg-muted);
  max-width: 640px;
}

/* Role pillars · the centerpiece */
.team__roles { margin-bottom: 36px; }
.team__role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(232px, 1fr));
  gap: 12px;
}
.team__role {
  position: relative;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow: hidden;
  transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
}
.team__role:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px -16px rgba(15,23,42,0.20);
}
.team__role[open] { box-shadow: 0 18px 32px -16px rgba(15,23,42,0.24); }
.team__role::before {
  content: '';
  position: absolute;
  top: 0; left: 14px; right: 14px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: var(--role-accent);
}
.team__role--accent  { --role-accent: linear-gradient(90deg, #0F4C81, #4F8FC7); }
.team__role--success { --role-accent: linear-gradient(90deg, #16A34A, #4ADE80); }
.team__role--warning { --role-accent: linear-gradient(90deg, #D97706, #F59E0B); }
.team__role--info    { --role-accent: linear-gradient(90deg, #3B82F6, #60A5FA); }
.team__role--neutral { --role-accent: linear-gradient(90deg, #64748B, #94A3B8); }

.team__role-summary {
  list-style: none;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 16px 14px;
}
.team__role-summary::-webkit-details-marker { display: none; }
.team__role-glyph {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  font-size: 18px;
  flex-shrink: 0;
}
.team__role-glyph--accent  { background: rgba(15,76,129,0.10);  color: #0F4C81; }
.team__role-glyph--success { background: rgba(22,163,74,0.10);  color: #14532D; }
.team__role-glyph--warning { background: rgba(217,119,6,0.14);  color: #92400E; }
.team__role-glyph--info    { background: rgba(59,130,246,0.10); color: #1E40AF; }
.team__role-glyph--neutral { background: rgba(100,116,139,0.12); color: #475569; }

.team__role-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.team__role-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-default);
}
.team__youtag {
  display: inline-flex; align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 9999px;
  background: rgba(15,76,129,0.10);
  border: 1px solid rgba(15,76,129,0.25);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #0F4C81;
}
.team__role-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.45;
}
.team__role-stat {
  display: flex; flex-direction: column; align-items: flex-end;
  flex-shrink: 0;
}
.team__role-count {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.014em;
  line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.team__role-count-label {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 600;
}
.team__role-body {
  padding: 0 16px 16px;
  border-top: 1px dashed var(--surface-border);
  margin: 0 4px;
}
.team__role-description {
  margin-top: 12px;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--fg-muted);
}
.team__role-perms { margin-top: 14px; }
.team__role-perm-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.team__role-perm-list {
  list-style: none; margin: 8px 0 0; padding: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.team__role-perm-list li {
  display: flex; align-items: center; gap: 6px;
  font-size: 12.5px;
  color: var(--fg-default);
}
.team__role-meta {
  margin-top: 12px;
  font-size: 11px;
  color: var(--fg-subtle);
}
.team__role-meta code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--surface-canvas);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--surface-border);
}

/* Permission matrix · always visible, sticky-ish, hover row+col */
.team__matrix-section { margin-bottom: 36px; }
.team__matrix-wrap {
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow-x: auto;
  scrollbar-width: thin;
}
.team__matrix {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
  font-size: 12.5px;
}
.team__matrix-th-label,
.team__matrix-th {
  padding: 14px 14px;
  text-align: center;
  background: var(--surface-canvas);
  border-bottom: 1px solid var(--surface-border);
  position: sticky;
  top: 0;
  z-index: 1;
}
.team__matrix-th-label {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
  width: 40%;
}
.team__matrix-th { vertical-align: middle; padding: 12px 6px; }
.team__matrix-th .team__role-glyph {
  width: 28px; height: 28px; font-size: 14px; margin: 0 auto 4px;
}
.team__matrix-th .block {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: var(--fg-default);
  font-weight: 700;
}
.team__matrix-grouprow td {
  padding: 10px 16px 6px;
  background: linear-gradient(180deg, var(--surface-canvas) 0%, transparent 100%);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.team__matrix-grouprow td svg {
  display: inline-block;
  margin-right: 6px;
  vertical-align: -1px;
}
.team__matrix-row {
  transition: background 120ms ease;
}
.team__matrix-row:hover { background: rgba(15,76,129,0.04); }
.team__matrix-row:hover .team__matrix-cell { background: rgba(15,76,129,0.04); }
.team__matrix-perm {
  padding: 10px 14px;
  display: flex; flex-direction: column; gap: 2px;
  border-bottom: 1px solid var(--surface-divider);
}
.team__matrix-perm-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-default);
}
.team__matrix-perm-detail {
  font-size: 11px;
  color: var(--fg-subtle);
  line-height: 1.4;
}
.team__matrix-cell {
  padding: 10px 6px;
  text-align: center;
  border-bottom: 1px solid var(--surface-divider);
  color: var(--fg-subtle);
  transition: background 120ms ease, color 120ms ease;
}
.team__matrix-cell--on {
  color: #16A34A;
  background: rgba(22,163,74,0.04);
}
.team__matrix-cell-no {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--fg-subtle);
  opacity: 0.5;
}

/* List sections — pending / active / suspended */
.team__section { margin-bottom: 28px; }
.team__list-head { margin-bottom: 14px; }
.team__list-title {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--fg-default);
}
.team__count {
  display: grid; place-items: center;
  min-width: 26px; height: 22px;
  padding: 0 8px;
  border-radius: 9999px;
  background: var(--surface-hover);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.team__count--amber  { background: rgba(217,119,6,0.14); color: #92400E; }
.team__count--danger { background: rgba(220,38,38,0.10); color: #B91C1C; }
.team__list-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--fg-muted);
}
.team__list-sub code {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--surface-canvas);
  border-radius: 3px;
  border: 1px solid var(--surface-border);
}
.team__viewall {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-accent);
  letter-spacing: 0.04em;
}

.team__rows-card {
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  overflow: hidden;
}
.team__rows-head {
  display: grid;
  grid-template-columns: 2.4fr 1.6fr 1.4fr 1fr 1fr auto;
  gap: 12px;
  padding: 12px 18px;
  background: var(--surface-canvas);
  border-bottom: 1px solid var(--surface-border);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.team__rows-head > span { white-space: nowrap; }
.team__rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.team__rows--flat .team__row {
  border-radius: 0;
  border: none;
  border-bottom: 1px solid var(--surface-divider);
  background: transparent;
}
.team__rows--flat .team__row:last-child { border-bottom: none; }
.team__row {
  display: grid;
  grid-template-columns: 2.4fr 1.6fr 1.4fr 1fr 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: var(--surface-page);
  margin-bottom: 8px;
  transition: background 120ms ease;
}
.team__rows-card .team__row:last-child { margin-bottom: 0; }
.team__row:hover { background: var(--surface-canvas); }
.team__row--pending {
  display: flex; gap: 12px;
  align-items: center;
  padding: 14px 18px;
  margin-bottom: 8px;
}
.team__row--muted { opacity: 0.85; }
.team__row-icon {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 9px;
  flex-shrink: 0;
}
.team__row-icon--amber {
  background: rgba(217,119,6,0.14);
  color: #B45309;
}
.team__row-name { display: flex; align-items: center; gap: 12px; min-width: 0; }
.team__avatar {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.team__avatar--accent  { background: linear-gradient(135deg, #0F4C81, #4F8FC7); }
.team__avatar--success { background: linear-gradient(135deg, #16A34A, #4ADE80); }
.team__avatar--warning { background: linear-gradient(135deg, #D97706, #F59E0B); }
.team__avatar--info    { background: linear-gradient(135deg, #3B82F6, #60A5FA); }
.team__avatar--neutral { background: linear-gradient(135deg, #64748B, #94A3B8); }
.team__avatar--muted   { background: linear-gradient(135deg, #94A3B8, #CBD5E1); color: #475569; }

.team__row-primary {
  font-size: 13px; font-weight: 600;
  color: var(--fg-default);
  display: inline-flex; align-items: center; gap: 8px;
}
.team__row-secondary {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-subtle);
}
.team__row-unit {
  font-size: 12px;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.team__row-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-subtle);
  white-space: nowrap;
}

.team__rolebadge {
  display: inline-flex; align-items: center; gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 9999px;
  font-size: 11px; font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}
.team__rolebadge-glyph { font-size: 11px; line-height: 1; }
.team__rolebadge--accent  { background: rgba(15,76,129,0.08);  color: #0F4C81; border-color: rgba(15,76,129,0.25); }
.team__rolebadge--success { background: rgba(22,163,74,0.08);  color: #14532D; border-color: rgba(22,163,74,0.30); }
.team__rolebadge--warning { background: rgba(217,119,6,0.10);  color: #92400E; border-color: rgba(217,119,6,0.30); }
.team__rolebadge--info    { background: rgba(59,130,246,0.08); color: #1E40AF; border-color: rgba(59,130,246,0.30); }
.team__rolebadge--neutral { background: rgba(100,116,139,0.10); color: #475569; border-color: rgba(100,116,139,0.30); }
.team__rolebadge--muted { opacity: 0.7; }

.team__pill {
  display: inline-flex; align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: 9999px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.team__pill--amber {
  background: rgba(217,119,6,0.14);
  color: #92400E;
  border: 1px solid rgba(217,119,6,0.30);
}

.team__mfa {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}
.team__mfa--on { color: #16A34A; }
.team__mfa--off { color: var(--fg-subtle); }

/* Audit timeline */
.team__audit {
  list-style: none;
  margin: 0; padding: 0;
}
.team__audit-row {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}
.team__audit-row:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 24px;
  bottom: -12px;
  width: 1px;
  background: var(--surface-border);
}
.team__audit-pip {
  width: 10px; height: 10px;
  margin-left: 4px;
  margin-top: 4px;
  border-radius: 9999px;
  position: relative;
  z-index: 1;
}
.team__audit-line {
  font-size: 13px;
  color: var(--fg-default);
  line-height: 1.4;
  margin: 0;
}
.team__audit-actor { font-weight: 600; }
.team__audit-verb { color: var(--fg-muted); }
.team__audit-target { font-family: var(--font-mono); font-size: 12px; color: var(--fg-default); }
.team__audit-meta {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-subtle);
  display: flex; align-items: center; gap: 6px;
}
`
