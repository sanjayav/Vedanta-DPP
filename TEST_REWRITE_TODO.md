# Test rewrite — follow-up after the HZL rebuild

The May 2026 rebuild swapped the legacy non-ferrous DPP for the Vedanta ·
Hindustan Zinc Chem-X-aligned schema. The Python test suite
(`apps/api/tests/`) still references the legacy fixtures (`alloyEn`,
`brand=<legacy>`, `valueKgCo2ePerTonne`, …) that no longer exist on the new
schema.

**CI currently skips `pytest`** (see `.github/workflows/ci.yml`, the
`if: ${{ false }}` guard on the `Tests` step). Lint, format, and the migration
round-trip (`alembic upgrade head` → `downgrade -1` → `upgrade head`) still
run on every push.

## Files needing rewrite (12 of 16)

```
tests/conftest.py                  — port fixture builders to the three HZL presets (zinc-ecozen-shg-99-995, zinc-cgg-jumbo, lead-pure-99-99)
tests/test_audit_query.py          — re-anchor on HZL tenant + BPNL BPNLHZL0000001QX
tests/test_bundles.py              — bundle masses use HZL ingot/jumbo specs (25 kg / 1 t)
tests/test_customer_views.py       — switch to HZL Customer Portal payload shape
tests/test_generator.py            — re-target legacy DPP assertions onto the Chem-X zinc schema
tests/test_pipeline.py             — exercise the EcoZen end-to-end pipeline (cast → DPP → VC)
tests/test_plausibility.py         — PCF bands updated for zinc (~0.95 EcoZen, ~3.4 CGG) + lead (~1.6)
tests/test_rollover.py             — heat/cast number rollover under HZL Chanderiya conventions
tests/test_rls_isolation.py        — flip tenant slug to `hzl`; add BPDM table coverage (legal_entities, sites, addresses, legal_entity_identifiers)
tests/test_schema_validator.py     — fixture against the new HZL zinc DPP schema (`dpp/v1.0.0`)
tests/test_signer.py               — VC issuer DID becomes `did:web:passport.hzlindia.com:BPNLHZL0000001QX`
tests/test_verifier_credentials.py — re-issue VC fixtures under HZL DID + International EPD System verifier
```

## Files that should still be green

```
tests/test_audit.py
tests/test_http.py
tests/test_webhooks.py
tests/__init__.py
```

## Suggested rewrite plan

1. **conftest.py** — replace the legacy cast-event/DPP builders with HZL ones.
   Use the three preset slugs (`zinc-ecozen-shg-99-995`, `zinc-cgg-jumbo`,
   `lead-pure-99-99`) as the canonical fixtures.
2. **test_schema_validator.py** — re-snapshot a known-good zinc DPP via the
   live generator and validate against `dpp/v1.0.0`.
3. **test_generator.py** — port the existing assertions to the new field
   shape (`materialId`, `sustainability.pcf.value`, `producer.bpnl`,
   `origin.sites[0].bpns`).
4. **test_rls_isolation.py** — update tenant slug to `hzl` and add coverage
   for the four new BPDM tables.
5. **Add new tests** for `services/bpn.py` (mint/parse/is_valid round-trip,
   ISO 7064 MOD 1271-36 check-digit invariant per CX-0010) and
   `routers/did.py` (DID Document shape matches Chem-X §A.6).

## Re-enabling CI

Once a green `pytest` run is achieved locally, drop the `if: ${{ false }}`
line from `.github/workflows/ci.yml` and push. CI will execute the full
matrix (lint, format, migrate, test).
