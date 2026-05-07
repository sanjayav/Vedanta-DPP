"""Dev-only bootstrap that populates a fresh database so the console isn't empty.

Idempotent. Runs once on lifespan startup when `DPP_ENV != "production"`.

Steps:
  1. Ensure the default tenant row exists (id from settings, slug "hzl").
  2. Bind `app.current_tenant_id` so RLS allows the upserts in step 3.
  3. Call `seed_canonical_data` to insert process steps, manifest attributes,
     HZL portfolio products, and product→step chain links.
  4. If there are zero issued DPPs for this tenant, fire one cast event per
     preset so the Passports / Audit / Pipeline surfaces have data to render.
     Skipped on every subsequent boot.

Production never runs this — real tenants come from operator onboarding and
real product data is curated, not seeded from code.
"""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DppManifestAttr,
    DppRecord,
    Product,
    ProductDppConfig,
    ProductProcessChain,
)
from ..logging import get_logger
from ..settings import Settings
from .cast_events import ingest_cast_event
from .pipeline import run_dpp_pipeline
from .presets import PRESETS
from .product_seed import seed_canonical_data

log = get_logger("dpp_api.bootstrap")


async def ensure_default_tenant(session: AsyncSession, settings: Settings) -> None:
    """Idempotently insert the default tenant. Tenants table has RLS disabled."""
    await session.execute(
        text(
            """
            INSERT INTO tenants (id, slug, legal_name, status, tier, branding, created_at)
            VALUES (
                :id, :slug, 'Hindustan Zinc Limited',
                'active', 'production', '{}', now()
            )
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": settings.dpp_default_tenant_id, "slug": settings.dpp_default_tenant_slug},
    )
    # Keep the sequence past the highest id so future tenant inserts don't collide.
    await session.execute(
        text(
            "SELECT setval(pg_get_serial_sequence('tenants','id'), "
            "GREATEST(1, (SELECT max(id) FROM tenants)))"
        )
    )


def _build_cast_event_payload(preset: dict[str, Any], tenant_id: int) -> dict[str, Any]:
    """Mirror of @dpp/sim buildCastEvent. Mutates nothing in `preset`.

    Maps the Chem-X v1.0 HZL preset shape onto the v1.0 cast-event payload
    contract (which still uses the legacy `alloyEn`/`alloyAa` field names —
    those are preserved as opaque grade-code carriers until a v1.5 cast-event
    schema lands).
    """
    cast_number = f"C-{datetime.now(UTC).strftime('%Y%m%d')}-{random.randint(10000, 99999)}"  # noqa: S311
    physical = preset.get("physical") or {}
    dims = physical.get("dimensions") or preset.get("dimensions") or {}
    grade_code = preset.get("gradeCode") or preset.get("tradeName") or "UNKNOWN"
    bis_or_iso = (preset.get("speakingCodes") or {}).get("bisStandard") or grade_code
    site_tag = preset.get("producingSiteTag", "CHA")
    casthouse_bpns = f"BPNSHZS{site_tag}00012N"
    smelter_bpns = casthouse_bpns
    cast_payload: dict[str, Any] = {
        "castNumber": cast_number,
        "alloyEn": bis_or_iso,
        "alloyAa": grade_code,
        "brand": preset.get("tradeName") or grade_code,
        "form": preset.get("form", "ingot_25kg"),
        "weightKg": float(physical.get("unitMassKg", 25.0)),
        "casthouseUfi": casthouse_bpns,
        "smelterUfi": smelter_bpns,
        "purityGrade": str(preset.get("purityPercent", 99.995)),
    }
    for key in ("diameterMm", "lengthMm", "widthMm", "thicknessMm", "heightMm"):
        if key in dims:
            cast_payload[key] = dims[key]

    return {
        "schemaVersion": "1.0.0",
        "trackingId": str(uuid4()),
        "source": {"kind": "simulator", "actor": "bootstrap", "presetId": preset["id"]},
        "occurredAt": datetime.now(UTC).isoformat(),
        "tenantId": tenant_id,
        "cast": cast_payload,
    }


async def _seed_demo_dpps_if_empty(session: AsyncSession, settings: Settings) -> None:
    """Fire several events per preset on first boot so the Passports list, QR
    grid, and audit trail aren't empty. Only runs when no DPPs exist for this
    tenant — subsequent reloads keep whatever state is in the DB.
    """
    existing = await session.scalar(
        select(func.count())
        .select_from(DppRecord)
        .where(DppRecord.tenant_id == settings.dpp_default_tenant_id)
    )
    if existing:
        return

    casts_per_preset = 6  # 3 presets × 6 → 18 demo DPPs
    issued: list[str] = []
    for preset in PRESETS.values():
        for _ in range(casts_per_preset):
            try:
                payload = _build_cast_event_payload(preset, settings.dpp_default_tenant_id)
                ingestion = await ingest_cast_event(session, payload)
                await session.flush()
                result = await run_dpp_pipeline(session, ingestion.cast_event_id)
                await session.commit()
                if result.upi:
                    issued.append(result.upi)
            except Exception as exc:
                log.warning(
                    "dpp_api.bootstrap.preset_failed",
                    preset_id=preset.get("id"),
                    error=str(exc),
                )
                await session.rollback()
    log.info("dpp_api.bootstrap.demo_dpps_issued", count=len(issued))


async def _lock_default_dpp_configs(session: AsyncSession, tenant_id: int) -> int:
    """For each product, ensure a v1.0 ProductDppConfig exists in `locked` state.

    Without a locked manifest the Create-Passport wizard's Parameters step shows
    "No locked manifest found …". In production a tenant_admin walks through the
    Onboarding flow to lock; in dev we fast-track by selecting every manifest
    attribute (mandatory + voluntary) for v1.0 and writing the row directly.
    """
    target_version = "1.0"
    locked = 0
    products = (await session.scalars(select(Product).where(Product.tenant_id == tenant_id))).all()
    for product in products:
        existing = await session.scalar(
            select(ProductDppConfig).where(
                ProductDppConfig.tenant_id == tenant_id,
                ProductDppConfig.product_id == product.id,
                ProductDppConfig.dpp_version == target_version,
            )
        )
        if existing is not None and existing.state == "locked":
            continue

        # Walk this product's chain steps and pick every manifest attr for v1.0
        # (cumulative — the manifest table records the version each attr was
        # introduced at, and a v1.0 lock includes everything ≤ 1.0).
        chain_step_ids = [
            row[0]
            for row in (
                await session.execute(
                    select(ProductProcessChain.process_step_id).where(
                        ProductProcessChain.product_id == product.id
                    )
                )
            ).all()
        ]
        if not chain_step_ids:
            continue

        attrs = (
            await session.execute(
                select(DppManifestAttr.process_step_id, DppManifestAttr.id).where(
                    DppManifestAttr.process_step_id.in_(chain_step_ids),
                    DppManifestAttr.dpp_version == target_version,
                )
            )
        ).all()
        selections: dict[str, list[int]] = {}
        for step_id, attr_id in attrs:
            selections.setdefault(str(step_id), []).append(attr_id)

        now = datetime.now(UTC)
        if existing is None:
            session.add(
                ProductDppConfig(
                    tenant_id=tenant_id,
                    product_id=product.id,
                    dpp_version=target_version,
                    state="locked",
                    selections=selections,
                    locked_at=now,
                    locked_by="bootstrap",
                )
            )
        else:
            existing.state = "locked"
            existing.selections = selections
            existing.locked_at = now
            existing.locked_by = "bootstrap"
            existing.updated_at = now
        locked += 1
    await session.flush()
    return locked


async def run_dev_bootstrap(session: AsyncSession, settings: Settings) -> None:
    """Run the dev seed pipeline against an open session."""
    await ensure_default_tenant(session, settings)
    # Bind the tenant GUC so RLS lets the products INSERT through.
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": str(settings.dpp_default_tenant_id)},
    )
    counts = await seed_canonical_data(session, tenant_id=settings.dpp_default_tenant_id)
    locked = await _lock_default_dpp_configs(session, tenant_id=settings.dpp_default_tenant_id)
    await session.commit()
    log.info("dpp_api.bootstrap.seeded", configs_locked=locked, **counts)

    # Re-bind the GUC after commit (it was transaction-local) and fire demo events.
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tid, true)"),
        {"tid": str(settings.dpp_default_tenant_id)},
    )
    await _seed_demo_dpps_if_empty(session, settings)
