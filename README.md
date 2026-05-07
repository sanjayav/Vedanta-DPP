# C6 Trail · Vedanta · Hindustan Zinc · Digital Product Passport Platform

A production-foundation, Chem-X v1.0–aligned, multi-tenant DPP platform for
Hindustan Zinc Limited (HZL) and downstream customers across galvanising,
die-casting, batteries, and electronics.

> **Status** — foundation in place. End-to-end pipeline (simulator → signed DPP
> → public viewer) is wired and demoable. Sprint backlog continues per the
> Software Design Document and the Chem-X-aligned version manifests.
>
> **Tagline** — *Six measures. One trail. Verifiable end-to-end.*

## Repo layout

```
vedanta-hzl-passport/
├── apps/
│   ├── api/              # FastAPI 0.115 · Python 3.12 · Pydantic v2 · SQLAlchemy 2.0 async
│   ├── web-public/       # Next.js 15 · public DPP viewer (editorial aesthetic, SSR, edge-cached)
│   └── web-console/      # Next.js 15 · all 6 authenticated surfaces with role-driven routing
├── packages/
│   ├── schema/           # Canonical JSON Schema 2020-12 + presets + validators · source of truth
│   ├── ui/               # Shared design system: tokens, Tailwind preset, primitives, motion utils
│   ├── viewer-blocks/    # (reserved) — extracted public-viewer animation blocks
│   ├── ts-types/         # (codegen target) — TS types generated from JSON schemas
│   ├── py-models/        # (codegen target) — Pydantic models generated from JSON schemas
│   └── sim/              # DPP simulator CLI + library
├── infra/
│   └── docker/           # docker-compose.yml — Postgres 17 + Redis 7 + MinIO + Mailhog
├── docs/
│   └── adr/              # Architecture Decision Records
└── scripts/              # Codegen, dev tooling
```

## Quick start

```bash
# 1. Install Node + pnpm + Python toolchain
nvm use                          # picks up .nvmrc → Node 20.18
corepack enable                  # provides pnpm 9
brew install uv                  # Python 3.12 + venv manager (or pipx install uv)

# 2. Bring up the local infrastructure
cp .env.example .env             # adjust if needed; defaults are dev-safe
pnpm infra:up                    # Postgres 17 + Redis 7 + MinIO + Mailhog

# 3. Install JS dependencies
pnpm install

# 4. Install Python dependencies + run the initial migration
cd apps/api
uv sync
uv run alembic upgrade head      # creates the schema, RLS policies, seeds HZL tenant
cd ../..

# 5. Validate canonical schemas
pnpm schema:validate

# 6. Run everything (in separate terminals or `pnpm dev` for parallel)
pnpm api:dev                     # FastAPI on :8000
pnpm --filter @dpp/web-public dev      # public viewer on :3000
pnpm --filter @dpp/web-console dev     # console on :3001

# 7. Fire your first DPP
pnpm sim:fire zinc-ecozen-shg-99-995
# → returns a UPI; visit http://localhost:3000/dpp/<upi>
```

## What works today

- **Canonical schema** (`packages/schema/schemas/dpp/v1.0.0.json`) — JSON Schema
  Draft 2020-12 covering the Chem-X-aligned attribute set for the trust-building
  DPP/DMP 1.0 manifest (zinc, lead, silver). Validates against ajv (Node) and
  jsonschema (Python).
- **Cast event → DPP pipeline** — POST a canonical cast event to
  `/api/v1/cast-events/`, the API validates, persists, generates a canonical DPP
  body, signs it with Ed25519 inside a W3C VC 2.0 envelope, writes a
  hash-chained audit-log entry, and returns the resolvable UPI. Total wall time
  on a laptop: ~150ms.
- **Public viewer** — server-rendered scroll-driven story with Hero, Story
  (comparison bars), Carbon (stage-by-stage decomposition), Compliance (dark
  grid), Verification (cryptographic-signature ceremony with three-state
  button), and Footer. Honours `prefers-reduced-motion`. Sample routes available
  at `/dpp/sample/ecozen`, `/dpp/sample/cgg-jumbo`, `/dpp/sample/lead-99-99`.
- **Console** — Stripe-dashboard layout with role-driven default landing, live
  Pipeline activity feed, DPPs table, Sources tab with one-click "Fire event"
  against the simulator presets.
- **Multi-tenant data plane** — Postgres row-level security enforced on
  `cast_events`, `dpp_records`, `audit_log`. HZL seeded as `tenant_id=1`.
- **GS1 Digital Link resolver** — `/01/{gtin}/10/{batch}/21/{serial}` redirects
  to the public viewer; content-negotiates for JSON-LD.

## What's next (per the SDD sprint plan)

| Sprint | Weeks | Focus                                                 |
| ------ | ----- | ----------------------------------------------------- |
| 1      | 1–2   | ✅ Foundation                                         |
| 2      | 3–4   | ✅ Cast event flow                                    |
| 3      | 5–6   | DPP generator hardening (PCF enrichment, MTC linkage) |
| 4      | 7–8   | ✅ Signing + QR (PNG/SVG/ZPL ready in service layer)  |
| 5      | 9–10  | ✅ Public viewer + resolver                           |
| 6      | 11–12 | Customer Portal (5 zones, IMDS export, webhooks)      |
| 7      | 13–14 | Authority + Verifier + Audit                          |
| 8      | 15–16 | Super Admin + DPP Management Console + hardening      |

## Architecture notes

- **Two aesthetics, one design system.** All authenticated surfaces share the
  Stripe/Linear/Notion enterprise aesthetic (Vedanta green primary, HZL navy
  authority accent, Inter). The public viewer breaks from that with the
  editorial Apple Environmental Report aesthetic (Fraunces serif, recycled-paper
  warmth, trail-amber accent). Both consume the same design tokens via
  `data-theme="c6trail-enterprise"` and `data-theme="c6trail-editorial"` on
  `<html>`. See `packages/ui/src/tokens/tokens.css`.
- **Schema is the contract.** `packages/schema/schemas/*.json` is the source of
  truth. Hand-authored TypeScript mirrors live in `packages/schema/src/types/`.
  Pydantic models are codegen'd into `apps/api/dpp_api/_generated/`. CI runs ajv
  validation against fixtures to keep them honest.
- **Ed25519, not ECDSA.** Per SDD §8.3 risk register — Ed25519 is conservative,
  widely supported, and aligns with W3C VC 2.0 Ed25519Signature2020.
- **Append-only everything.** Cast events, DPP records (revisions never
  overwrite), audit log (hash-chained). The DPP record table is the only one
  with `UPDATE` traffic, and only for lifecycle state transitions.
- **Multi-tenancy from day one.** `tenant_id` on every row, RLS enforced at the
  database, every request runs inside `SET LOCAL app.current_tenant_id`. HZL is
  `tenant_id=1`. Adding sister Vedanta entities or downstream converter tenants
  is a tenant-onboarding workflow, not a code change.

## Useful commands

```bash
pnpm infra:up                    # bring up Postgres / Redis / MinIO / Mailhog
pnpm infra:reset                 # destroy volumes + start fresh
pnpm api:dev                     # start FastAPI with --reload
pnpm api:migrate                 # alembic upgrade head
pnpm dev                         # turbo run dev --parallel (everything)
pnpm schema:validate             # ajv-validate every schema in packages/schema
pnpm sim:fire zinc-ecozen-shg-99-995  # fire an EcoZen preset against the API
pnpm typecheck                   # tsc across all packages
pnpm format                      # prettier write
```

## Where to read deeper

- `docs/adr/` — architecture decision records (locked decisions from §1-§14)
- `Chem-X_Sustainability-Guideline_v1.0.pdf` — six EF 3.1 LCIA categories,
  TfS PCF v3.0, DQR / PDS / cut-off rules
- `Chem-X_Business-Identity-Guideline_v1.0.pdf` — CX-0010 BPN scheme, BPDM
  data model
- `Chem-X_Material-ID-Guideline_v1.0.pdf` — DID:web pattern for DPP/DMP
- `HZL_Product_Brochure_2025_*.pdf` — canonical site list and product portfolio
- Each app/package has its own `README.md` with surface-specific notes.

## Licence

UNLICENSED · proprietary platform foundation. Do not redistribute.
