# CLAUDE.md — engineering instructions for the Vedanta · Hindustan Zinc Passport platform

This file is loaded into every Claude Code session in this repo. It captures the
conventions and load-bearing decisions that aren't obvious from a single file
read. The platform was rebuilt in May 2026 from the original EGA aluminium PoC
to a Hindustan Zinc (HZL) build aligned with the Chem-X v1.0 standards
(Sustainability, Business Identity / BPDM, Material ID).

## Read first

- `Chem-X_Sustainability-Guideline_v1.0.pdf` — six EF 3.1 LCIA categories,
  TfS PCF v3.0 anchoring, DQR / PDS / cut-off / allocation rules.
- `Chem-X_Business-Identity-Guideline_v1.0.pdf` — Catena-X CX-0010 BPN scheme,
  BPDM data model, identifier-type taxonomy.
- `Chem-X_Material-ID-Guideline_v1.0.pdf` — DID:web pattern; the legal entity
  owns one DID Document, materials ride as `?dpp=<uuid>` query params.
- `HZL_Product_Brochure_2025_*.pdf` — canonical HZL site list (5 mines + 4
  smelter/refinery + 8 depots) and product portfolio.
- `docs/RUNBOOK_NEON_BOOTSTRAP.md` — how to bring the codebase up against Neon.
- `README.md` — developer quick-start.

## Hard rules

1. **The JSON Schema is the contract.** Never change a TypeScript or Pydantic
   type without first changing `packages/schema/schemas/dpp/v1.0.0.json`. The
   schema is authoritative; codegen and hand-authored types must mirror it
   exactly.
2. **No new direct DB queries from the routers.** All persistence goes through
   `apps/api/dpp_api/services/*`. Routers translate HTTP ↔ service calls only.
3. **Multi-tenancy on every row.** `tenant_id` is non-nullable on every
   tenant-scoped table. RLS is `FORCE`d. Tests must verify isolation. The
   runtime app role on Neon (`dpp_app`) is non-owner; migrations run as
   `neondb_owner` via `DATABASE_URL_SYNC_ADMIN`.
4. **Append-only first.** New mutation? Default to a new row, not an update.
   The only tables that legitimately get `UPDATE` traffic are
   `dpp_records.state` for lifecycle transitions and the BPDM tables when an
   entity / site / address record changes (lifecycle still tracked via
   `valid_from` / `valid_until`).
5. **Audit every mutation.** Every state-changing service call writes to
   `audit_log` via `services.audit.append_audit`. The hash chain is invariant.
6. **BPN integrity.** Never construct a BPN by string concatenation. Use
   `apps/api/dpp_api/services/bpn.py` (`mint`, `is_valid`, `parse`). The
   ISO/IEC 7064 MOD 1271-36 check digits are non-negotiable per CX-0010.
7. **DID:web pattern.** Per-material identifiers are query parameters on the
   *legal entity's* DID, never their own DID Document. Form:
   `did:web:passport.hzlindia.com:<BPNL>?dpp=<uuid>` (or `?dmp=<uuid>`).
8. **Honour `prefers-reduced-motion`** in every animated component. The CSS in
   `packages/ui/src/tokens/tokens.css` does this globally; never override it.
9. **Public Viewer must SSR.** No client-only components above the fold. Every
   above-the-fold pixel must paint without JavaScript.
10. **No ad-hoc colour or font tokens.** Use the CSS variables from
    `@dpp/ui/tokens.css`. New tokens must be added to that file with a
    comment pointing at the Chem-X / HZL brand source that motivated them.

## Where things live

| Concern                         | Path                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| DPP / DMP schema                | `packages/schema/schemas/dpp/v1.0.0.json`                                   |
| Cast event schema               | `packages/schema/schemas/cast-event/v1.0.0.json`                            |
| W3C VC envelope schema          | `packages/schema/schemas/envelope/v1.0.0.json`                              |
| HZL-anchored seed presets       | `packages/schema/presets/{zinc-ecozen,zinc-cgg-jumbo,lead-pure-99-99}.json` |
| TS types mirroring schema       | `packages/schema/src/types/{dpp,cast-event,preset,envelope}.ts`             |
| Design tokens                   | `packages/ui/src/tokens/tokens.css`                                         |
| Public viewer page              | `apps/web-public/src/app/dpp/[...upi]/page.tsx`                             |
| Public viewer client / synth    | `apps/web-public/src/lib/dpp-client.ts`                                     |
| Console role-driven landing     | `apps/web-console/src/lib/auth.ts` (`DEFAULT_LANDING`)                      |
| Cast event ingestion API        | `apps/api/dpp_api/routers/cast_events.py`                                   |
| DPP generator (cast → passport) | `apps/api/dpp_api/services/generator.py`                                    |
| BPN minter (CX-0010)            | `apps/api/dpp_api/services/bpn.py`                                          |
| W3C VC signer (Ed25519)         | `apps/api/dpp_api/services/signer.py`                                       |
| Audit log hash chain            | `apps/api/dpp_api/services/audit.py`                                        |
| End-to-end pipeline             | `apps/api/dpp_api/services/pipeline.py`                                     |
| BPDM ORM (LegalEntity/Site/...) | `apps/api/dpp_api/db/models.py` (bottom of file)                            |
| BPDM tables migration           | `apps/api/alembic/versions/0007_bpdm_tables.py`                             |
| HZL seed migration              | `apps/api/alembic/versions/0008_hzl_seed.py`                                |
| Neon role bootstrap             | `scripts/neon-bootstrap.sql`                                                |
| did:web Document router         | `apps/api/dpp_api/routers/did.py`                                           |

## Hindustan Zinc anchors (do not retype these — import them)

- Legal entity: `bpn.HZL_BPNL` = `BPNLHZL0000001QX`
- Smelters: `bpn.CHANDERIYA_BPNS`, `bpn.DARIBA_SMELTER_BPNS`,
  `bpn.DEBARI_BPNS`, `bpn.PANTNAGAR_BPNS`
- Mines: `bpn.RAMPURA_AGUCHA_BPNS`, `bpn.SINDESAR_KHURD_BPNS`,
  `bpn.RAJPURA_DARIBA_BPNS`, `bpn.ZAWAR_BPNS`, `bpn.KAYAD_BPNS`
- Depots: `bpn.DEPOT_{HYD,PUN,CHE,KOL,JAM,FAR,BEN,RAI}_BPNS`
- Statutory IDs: CIN `L27204RJ1966PLC001208`, LEI `335800LB39TLJ8YTWM98`,
  PAN `AAACH7354K`, GSTIN-RJ `08AAACH7354K1ZB`, ISIN `INE267A01025`
- Marquee EPD: `EPD-IES-0006472:001` (zinc, programme operator
  International EPD System, valid 2023-01-16 → 2028-01-15)

## The three PoC products

1. **EcoZen SHG 99.995** (`zinc-ecozen-shg-99-995`) — Asia's first low-carbon
   zinc, PCF ≈ 0.95 kg CO2e/kg, EPD-published, Chanderiya. The marquee DPP.
2. **CGG Jumbo** (`zinc-cgg-jumbo`) — Continuous Galvanising Grade for
   Tata Steel and similar, ASTM B852, PCF ≈ 3.4 kg CO2e/kg.
3. **Refined Lead 99.99%** (`lead-pure-99-99`) — LME brand "Vedanta 99.99",
   IS 27:2023, PCF ≈ 1.6 kg CO2e/kg.

## Conventions

- **Python**: `ruff` for lint + format (line length 100, double quotes).
  `mypy --strict`. Async everywhere on the request path; sync only inside
  Alembic and CLI scripts.
- **TypeScript**: `tsc --noEmit` strict, `noUncheckedIndexedAccess: true`. No
  `any`. `unknown` + narrowing instead. Imports use the `.js` extension in
  source files (NodeNext / ESM).
- **Imports**: barrel files only at package boundaries (`@dpp/schema`,
  `@dpp/ui`). Inside a package, import directly from the file that owns the
  export.
- **Components**: prefer Server Components in Next.js. Mark Client Components
  with `'use client'` only when they need state, effects, or browser APIs.
- **Naming**:
  - Pydantic models: `PascalCase` matching the JSON Schema title.
  - SQLAlchemy table names: snake_case, plural (`dpp_records`, `legal_entities`).
  - React components: `PascalCase` files in `src/components/<surface>/`.
  - CSS variables: `--kebab-case`.
- **Commits**: imperative present tense ("add ed25519 signing", not "added").
  Scope by package (`api:`, `web-public:`, `schema:`, etc.).

## Testing posture

- Schema validation runs via `pnpm schema:validate` on every PR.
- API tests live under `apps/api/tests/` (pytest + httpx). Database tests use
  the live Postgres container; we don't mock SQLAlchemy.
- Public viewer accessibility: Lighthouse 100 is the contract.

## Things to ask before changing

- The Chem-X-aligned schema sections (`sustainability`, `producer.identifiers`,
  `materialId`, `origin.sites`). Adds are fine; renames or removals require a
  new schema version (`v1.1.0`) and a downstream sweep.
- The BPN minter (`services/bpn.py`). The MOD 1271-36 algorithm and 16-char
  layout are CX-0010 invariants — changing them breaks federation with
  Catena-X / Cofinity-X.
- The signer's canonicalisation (`canonicalise()` in `services/signer.py`).
  Switching to JCS or RDF Dataset Canonicalisation is a v1.5 change.
- The role taxonomy in `apps/web-console/src/lib/auth.ts`. New roles need a
  governance update first.

## Don't

- Don't add a "demo data" branch. Use the simulator presets — they ARE the
  trust-building data path.
- Don't hand-roll an LCIA value anywhere. Fetch from `services/presets.py` or
  the reference-data store.
- Don't import directly from `apps/web-public/*` into `apps/web-console/*`.
  Anything reused belongs in `packages/ui` or `packages/viewer-blocks`.
- Don't create new top-level routes outside the established surface map
  (`/console`, `/portal`, `/authority`, `/verifier`, `/admin`). Add tabs to
  the existing console layout instead.
- Don't put the Neon `neondb_owner` URL in `DATABASE_URL` for the runtime API.
  That bypasses RLS. Use `dpp_app` per `scripts/neon-bootstrap.sql`.
