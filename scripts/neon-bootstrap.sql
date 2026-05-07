-- =============================================================================
-- Vedanta · Hindustan Zinc Passport — Neon bootstrap
-- =============================================================================
-- Run this ONCE on the Neon SQL editor (https://console.neon.tech) BEFORE the
-- first `alembic upgrade head` against the new database.
--
-- Why: the migrations run as `neondb_owner` (the database owner) so DDL works,
-- but the FastAPI runtime MUST connect as `dpp_app` — a non-owner role that
-- the FORCE ROW LEVEL SECURITY policies actually constrain. CLAUDE.md §3
-- mandates this split. Without it, every API connection bypasses RLS and the
-- multi-tenant guarantees in 0001_initial / 0007_bpdm_tables become advisory.
--
-- After running this you must update .env:
--   DATABASE_URL          → postgresql+asyncpg://dpp_app:<APP_PASS>@.../neondb?ssl=require
--   DATABASE_URL_SYNC     → postgresql+psycopg://dpp_app:<APP_PASS>@.../neondb?sslmode=require
--   DATABASE_URL_SYNC_ADMIN remains on neondb_owner (used only by Alembic)
-- =============================================================================

-- 1. Create the runtime application role.
--    Replace 'CHANGE_ME_STRONG_PASSWORD' with a fresh random password before
--    committing to a secrets manager.
CREATE ROLE dpp_app LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

-- 2. Connect privileges (do not grant SUPERUSER, BYPASSRLS, REPLICATION).
GRANT CONNECT ON DATABASE neondb TO dpp_app;
GRANT USAGE   ON SCHEMA public  TO dpp_app;

-- 3. Object-level CRUD on all current and future tables/sequences.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO dpp_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO dpp_app;

-- 4. Default privileges on objects created LATER (i.e. by Alembic migrations
--    run as neondb_owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO dpp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT                  ON SEQUENCES TO dpp_app;

-- 5. Sanity check: confirm dpp_app exists and is NOT a superuser / RLS-bypasser.
--    Expected output: 1 row, rolsuper=false, rolbypassrls=false.
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
  FROM pg_roles
 WHERE rolname = 'dpp_app';

-- =============================================================================
-- Optional: rotate the app role's password later via:
--   ALTER ROLE dpp_app PASSWORD 'NEW_PASSWORD_HERE';
-- =============================================================================
