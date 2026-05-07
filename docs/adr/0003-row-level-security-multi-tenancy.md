# ADR 0003 · Multi-tenancy via Postgres row-level security

**Status** Accepted · 2026-05-04

## Context

The platform ships to Hindustan Zinc Limited (HZL) as the first tenant but is
engineered to serve multiple non-ferrous metals producers. We need tenant
isolation that:

- Survives careless application code (a developer who forgets to add
  `WHERE tenant_id = ?` must not leak data).
- Doesn't multiply infrastructure cost per tenant.
- Lets HZL opt into a dedicated database later without code changes.

## Decision

Default posture: **shared database, shared schema, row-level security enforced
by Postgres**. Every tenant-scoped table carries `tenant_id`. Every table has
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY`
(which blocks even table owners from bypassing the policy). Each request opens a
session and immediately runs:

```sql
SELECT set_config('app.current_tenant_id', '<verified id>', true);
```

The RLS policy reads that GUC and filters automatically. If the GUC is unset,
the policy denies all rows (fail-closed for background jobs that forget to scope
themselves).

Tier-2 tenants (the future sister Vedanta entities or downstream converter
customers) can opt into:

- **schema-per-tenant** — same connection, separate Postgres schemas; useful for
  regulatory isolation requirements.
- **dedicated database** — full physical isolation; useful for sensitive
  tenants. Connection pool routes by tenant slug.

## Why not a per-tenant subdomain + database

- Premature. Adds operational cost (per-tenant migrations, per-tenant
  monitoring) before we have any tenant requesting it.
- Not portable: code written against a single database can later be hosted in a
  per-tenant database without changing application logic. The reverse is not
  true.

## Why FORCE RLS

- The application-tier user runs as the database owner in dev; without `FORCE`,
  the owner bypasses RLS and we'd lose isolation in CI.
- In production we'd run as a non-owner role anyway, but `FORCE` is
  belt-and-braces — a future migration that escalates the role can't silently
  disable isolation.

## Consequences

- Every service-layer function must accept tenant context (today via the GUC; in
  v1.5 via an injected `RequestContext`). Adding `tenant_id` to WHERE clauses is
  no longer required but writing `WHERE tenant_id = X` is still encouraged for
  query plan clarity.
- Background workers (Temporal in v2) must set the GUC at activity start. We'll
  wrap this in a decorator.
- Cross-tenant aggregates (Super Admin Dashboard) require either a special
  super-admin role that bypasses RLS, or a dedicated read replica. We chose the
  bypass role; it lives in `apps/api/dpp_api/db/admin.py` and is gated behind
  the `platform_admin` role.
