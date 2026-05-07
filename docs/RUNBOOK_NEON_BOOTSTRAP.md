# Vedanta Zinc Passport — Neon bootstrap runbook

End-to-end checklist to bring the rewritten codebase up against your Neon
database. Each step is independently re-runnable; nothing here is destructive
unless the comments say so.

## 0. Prerequisites

- Neon project provisioned (you've already done this — connection string is in `.env`).
- Local Python env: `uv sync` or equivalent; `pnpm install` for the workspace.
- `psql` client (any recent version) for the bootstrap SQL.

## 1. Create the runtime application role on Neon

CLAUDE.md hard-rule #3 requires `FORCE ROW LEVEL SECURITY`. The connection
string you shared uses `neondb_owner`, which is the database owner and
**bypasses RLS**. We split roles per the standard production pattern:

- `neondb_owner` → Alembic migrations only (DDL needs ownership).
- `dpp_app` → FastAPI runtime, RLS-effective.

Run [`scripts/neon-bootstrap.sql`](../scripts/neon-bootstrap.sql) on the
Neon SQL editor (or via psql against `DATABASE_URL_SYNC_ADMIN`). Edit the
file first to replace `CHANGE_ME_STRONG_PASSWORD` with a fresh password.

```bash
# From the Neon SQL editor, paste the contents of scripts/neon-bootstrap.sql.
# OR locally:
psql "$DATABASE_URL_SYNC_ADMIN" -f scripts/neon-bootstrap.sql
```

Expected last row:

```
 rolname  | rolsuper | rolbypassrls | rolcanlogin
----------+----------+--------------+-------------
 dpp_app  | f        | f            | t
```

## 2. Update `.env`

```bash
# Runtime app connections — RLS-effective
DATABASE_URL=postgresql+asyncpg://dpp_app:<APP_PASS>@ep-snowy-firefly-ap6ah71x-pooler.c-7.us-east-1.aws.neon.tech/neondb?ssl=require
DATABASE_URL_SYNC=postgresql+psycopg://dpp_app:<APP_PASS>@ep-snowy-firefly-ap6ah71x-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Migrations only — owner bypasses RLS by design
DATABASE_URL_SYNC_ADMIN=postgresql+psycopg://neondb_owner:<OWNER_PASS>@ep-snowy-firefly-ap6ah71x-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## 3. Run migrations

From `apps/api/`:

```bash
uv run alembic upgrade head
```

This applies migrations 0001…0008 in order. The new files in this rebuild are:

| Migration | What it does |
|---|---|
| `0007_bpdm_tables` | Creates `legal_entities`, `addresses`, `sites`, `legal_entity_identifiers` with FORCE RLS and CX-0010 BPN syntax checks. |
| `0008_hzl_seed` | Rebrands tenant 1 (`ega` → `hzl`); seeds HZL legal entity, 9 producing sites (5 mines + 4 smelter/refinery), 8 depots, registered office address, and 7 statutory identifiers (CIN, LEI, PAN, GSTIN-RJ, ISIN, NSE ticker, BSE code). |

To roll back the rebrand only (keeping pre-rebuild migrations):

```bash
uv run alembic downgrade 0006_passport_drafts
```

To re-seed without changing schema (if you tweak HZL data later):

```bash
uv run alembic downgrade 0007_bpdm_tables
uv run alembic upgrade head
```

## 4. Verify

```bash
uv run python - <<'PY'
import sys; sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
import os
e = create_engine(os.environ['DATABASE_URL_SYNC'])
with e.connect() as c:
    rows = c.execute(text("""
        SELECT bpns, name, function, main_address_bpna
          FROM sites
         WHERE owner_bpnl = 'BPNLHZL0000001QX'
         ORDER BY function, name
    """)).fetchall()
    for r in rows:
        print(r)
PY
```

Expected: 17 rows — 5 mines, 4 smelter/refinery, 8 depots — all under HZL_BPNL.

## 5. Smoke-test the generator

Validates that all three PoC presets emit a schema-conformant DPP:

```bash
cd apps/api
uv run python - <<'PY'
from dpp_api.services.generator import build_dpp_from_cast_event, new_tracking_id
from dpp_api.services.schema_validator import validate_against
from dpp_api.services import bpn

for pid, metal, grade, form, unit, bundle in [
    ('zinc-ecozen-shg-99-995', 'zinc', 'EcoZen-SHG', 'ingot_25kg', 25, 1000),
    ('zinc-cgg-jumbo',         'zinc', 'CGG',        'jumbo_1t',   950, 1000),
    ('lead-pure-99-99',        'lead', 'Lead-99.99', 'ingot_25kg', 25, 1000),
]:
    ev = {
        'schemaVersion': '1.0.0',
        'trackingId': new_tracking_id(),
        'source': {'kind': 'simulator', 'presetId': pid},
        'occurredAt': '2026-05-07T10:00:00Z',
        'tenantId': 1,
        'cast': {'castNumber': f'CHA-{pid}', 'metal': metal, 'gradeCode': grade,
                 'form': form, 'unitMassKg': unit, 'bundleMassKg': bundle,
                 'siteBpns': bpn.CHANDERIYA_BPNS},
    }
    dpp = build_dpp_from_cast_event(ev)
    validate_against('dpp/v1.0.0', dpp)
    print(f"OK  {pid:32s}  PCF={dpp['sustainability']['pcf']['value']:.3f} {dpp['sustainability']['pcf']['unit']}")
PY
```

## 6. Start the API

```bash
cd apps/api
uv run uvicorn dpp_api.main:app --reload --port 8001
```

Hit `http://localhost:8001/.well-known/did.json` — should return the HZL DID
Document (Chem-X Material ID Guideline §A.6 shape) with three service
endpoints (DPP resolver, DMP resolver, BPDM pool).

## 7. Out-of-scope for this rebuild (queued for next PR)

- `apps/web-public` viewer routing rewrite (`/dpp/[...upi]` → `/dpp/[bpnl]/[uuid]`).
- `apps/web-console` copy refresh (EGA → Vedanta HZL).
- `packages/sim` simulator presets — internal, low-impact.
- BIS / NABL / ISO certificate numbers — flagged "verify" in presets, awaiting
  HZL data drop. The schema fields are present and ready.
- Lead REACH dossier number, Kayad mine PIN, full depot street addresses —
  same status (NULL placeholder, ready to receive).

## What changed in this rebuild — file inventory

```
packages/schema/schemas/dpp/v1.0.0.json         — full rewrite for zinc/lead/silver
packages/schema/schemas/cast-event/v1.0.0.json  — metal-agnostic cast schema
packages/schema/presets/zinc-ecozen.json        — new
packages/schema/presets/zinc-cgg-jumbo.json     — new
packages/schema/presets/lead-pure-99-99.json    — new
packages/schema/presets/celestial*.json         — REMOVED
packages/schema/presets/standard.json           — REMOVED

apps/api/dpp_api/services/bpn.py                — new (CX-0010 BPN minter + check digits)
apps/api/dpp_api/services/generator.py          — full rewrite for zinc passports
apps/api/dpp_api/routers/did.py                 — full rewrite (Chem-X did:web pattern)
apps/api/dpp_api/db/models.py                   — appended LegalEntity / Site / Address / LegalEntityIdentifier ORM

apps/api/alembic/versions/0007_bpdm_tables.py   — new
apps/api/alembic/versions/0008_hzl_seed.py      — new

scripts/neon-bootstrap.sql                      — new (role provisioning)
docs/RUNBOOK_NEON_BOOTSTRAP.md                  — this file
.env                                            — DATABASE_URL points at Neon
```
