/**
 * Stub auth context. v1.0 reads role from a cookie/header for local dev.
 * v1.5 swaps in OIDC against Microsoft Entra; v2 adds W3C VC presentation.
 *
 * The role taxonomy (SDD §12.1.1) drives default landing per surface:
 *   tenant_admin       → /console/overview
 *   dpp_operator       → /console/pipeline
 *   dpp_reviewer       → /console/dpps
 *   tenant_auditor     → /console/audit
 *   it_administrator   → /console/settings
 */

import { cookies } from 'next/headers'

export type Role =
  | 'platform_admin'
  | 'platform_support'
  | 'tenant_admin'
  | 'dpp_operator'
  | 'dpp_reviewer'
  | 'tenant_auditor'
  | 'it_administrator'
  | 'customer_user'
  | 'customer_admin'
  | 'verifier'
  | 'authority'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: Role
  tenantId: number
  tenantSlug: string
}

const DEV_USERS: Record<Role, SessionUser> = {
  platform_admin: {
    id: 'u-platform',
    email: 'admin@platform.local',
    displayName: 'Platform Admin',
    role: 'platform_admin',
    tenantId: 0,
    tenantSlug: '__platform__',
  },
  platform_support: {
    id: 'u-platform-support',
    email: 'support@platform.local',
    displayName: 'Platform Support',
    role: 'platform_support',
    tenantId: 0,
    tenantSlug: '__platform__',
  },
  tenant_admin: {
    id: 'u-hzl-admin',
    email: 'sustainability.lead@vedanta.co.in',
    displayName: 'HZL Sustainability Director',
    role: 'tenant_admin',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  dpp_operator: {
    id: 'u-hzl-ops',
    email: 'casthouse.ops@vedanta.co.in',
    displayName: 'Casthouse Operations',
    role: 'dpp_operator',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  dpp_reviewer: {
    id: 'u-hzl-qa',
    email: 'qa@vedanta.co.in',
    displayName: 'HZL Quality Assurance',
    role: 'dpp_reviewer',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  tenant_auditor: {
    id: 'u-hzl-audit',
    email: 'audit@vedanta.co.in',
    displayName: 'HZL Internal Audit',
    role: 'tenant_auditor',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  it_administrator: {
    id: 'u-hzl-it',
    email: 'it@vedanta.co.in',
    displayName: 'HZL IT',
    role: 'it_administrator',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  customer_user: {
    id: 'u-tata',
    email: 'procurement@tatasteel.com',
    displayName: 'Tata Steel Procurement',
    role: 'customer_user',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  customer_admin: {
    id: 'u-tata-admin',
    email: 'it@tatasteel.com',
    displayName: 'Tata Steel IT',
    role: 'customer_admin',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  verifier: {
    id: 'u-dnv',
    email: 'verifier@dnv.com',
    displayName: 'DNV Verifier',
    role: 'verifier',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
  authority: {
    id: 'u-mksb',
    email: 'authority@market-surveillance.eu',
    displayName: 'EU Market Surveillance',
    role: 'authority',
    tenantId: 1,
    tenantSlug: 'hzl',
  },
}

export async function currentUser(): Promise<SessionUser> {
  const store = await cookies()
  const role = (store.get('dpp_role')?.value as Role) || 'dpp_operator'
  return DEV_USERS[role] ?? DEV_USERS.dpp_operator
}

export const DEFAULT_LANDING: Record<Role, string> = {
  platform_admin: '/admin',
  platform_support: '/admin',
  tenant_admin: '/console/overview',
  dpp_operator: '/console/pipeline',
  dpp_reviewer: '/console/dpps',
  tenant_auditor: '/console/audit',
  it_administrator: '/console/settings',
  customer_user: '/portal',
  customer_admin: '/portal',
  verifier: '/verifier',
  authority: '/authority',
}
