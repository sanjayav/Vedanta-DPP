# Test rewrite — follow-up after the HZL rebuild

The May 2026 rebuild swapped the EGA aluminium DPP for the Vedanta · Hindustan
Zinc Chem-X-aligned schema. The Python test suite (`apps/api/tests/`) still
references aluminium fixtures (`alloyEn`, `brand=CelestiAL`,
`valueKgCo2ePerTonne`, …) that no longer exist on the new schema.

**CI currently skips `pytest`** (see `.github/workflows/ci.yml`, the
`if: ${{ false }}` guard on the `Tests` step). Lint, format, and the migration
round-trip (`alembic upgrade head` → `downgrade -1` → `upgrade head`) still
run on every push.

## Files needing rewrite (12 of 16)

```
tests/conftest.py                  — fixture builders, mock cast event
tests/test_audit_query.py
tests/test_bundles.py
tests/test_customer_views.py
tests/test_generator.py            — mostly aluminium-shape DPP assertions
tests/test_pipeline.py
tests/test_plausibility.py
tests/test_rollover.py
tests/test_rls_isolation.py        — references EGA tenant slug
tests/test_schema_validator.py     — fixture against old DPP schema
tests/test_signer.py
tests/test_verifier_credentials.py
```

## Files that should still be green

```
tests/test_audit.py
tests/test_http.py
tests/test_webhooks.py
tests/__init__.py
```

## Suggested rewrite plan

1. **conftest.py** — replace EGA cast-event/DPP builders with HZL ones. Use
   the three preset slugs (`zinc-ecozen-shg-99-995`, `zinc-cgg-jumbo`,
   `lead-pure-99-99`) as the canonical fixtures.
2. **test_schema_validator.py** — re-snapshot a known-good zinc DPP via the
   live generator and validate against `dpp/v1.0.0`.
3. **test_generator.py** — port the existing assertions to the new field
   shape (`materialId`, `sustainability.pcf.value`, `producer.bpnl`,
   `origin.sites[0].bpns`).
4. **test_rls_isolation.py** — update tenant slug from `ega` → `hzl` and add
   coverage for the four new BPDM tables.
5. **Add new tests** for `services/bpn.py` (mint/parse/is_valid round-trip,
   ISO 7064 check-digit invariant) and `routers/did.py` (DID Document shape
   matches Chem-X §A.6).

## Re-enabling CI

Once a green `pytest` run is achieved locally, drop the `if: ${{ false }}`
line from `.github/workflows/ci.yml` and push. CI will execute the full
matrix (lint, format, migrate, test).
