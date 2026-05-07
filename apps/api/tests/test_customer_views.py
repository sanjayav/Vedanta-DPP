"""Customer-tier read service — projection, aggregates."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from dpp_api.services.cast_events import ingest_cast_event
from dpp_api.services.customer_views import (
    carbon_aggregate,
    compliance_summary,
    fetch_for_customer,
    list_for_customer,
    recycled_content_aggregate,
)
from dpp_api.services.pipeline import run_dpp_pipeline
from sqlalchemy.ext.asyncio import AsyncSession


def _event(brand: str = "CelestiAL", form: str = "extrusion_billet") -> dict[str, object]:
    base: dict[str, object] = {
        "schemaVersion": "1.0.0",
        "trackingId": uuid4().hex,
        "source": {
            "kind": "simulator",
            "actor": "tests",
            "presetId": {
                "CelestiAL": "celestial-extrusion-billet-6063",
                "CelestiAL-R": "celestial-r-sheet-ingot-5xxx",
                "Standard": "standard-sow-ingot-p1020",
            }[brand],
        },
        "occurredAt": datetime.now(UTC).isoformat(),
        "tenantId": 1,
        "cast": {
            "castNumber": f"C-{uuid4().hex[:8]}",
            "alloyEn": "EN AW-6063",
            "alloyAa": "AA 6063",
            "brand": brand,
            "form": form,
            "weightKg": 1380,
            "casthouseUfi": "0814406063812",
            "smelterUfi": "0814406063800",
            "purityGrade": "P1020A",
        },
    }
    cast = base["cast"]
    if form == "extrusion_billet":
        cast.update({"diameterMm": 228, "lengthMm": 7000})
    elif form == "sheet_ingot":
        cast.update(
            {
                "widthMm": 1900,
                "thicknessMm": 600,
                "lengthMm": 7600,
                "weightKg": 22500,
                "alloyEn": "EN AW-5754",
            }
        )
    elif form == "sow":
        cast.update(
            {
                "lengthMm": 760,
                "widthMm": 220,
                "thicknessMm": 130,
                "weightKg": 680,
                "alloyEn": "EN AC-46000",
            }
        )
    return base


@pytest.mark.asyncio
async def test_list_for_customer_returns_minimal_projection(db_session: AsyncSession) -> None:
    ingestion = await ingest_cast_event(db_session, _event())
    await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    items, total = await list_for_customer(db_session, customer_org="bmw")
    assert total >= 1
    item = items[0]
    # Expected legitimate-tier surface fields:
    assert "upi" in item
    assert "cfpKgCo2ePerTonne" in item
    assert "verifierName" in item
    # Must NOT leak the full body — that's the detail endpoint's job.
    assert "dpp" not in item


@pytest.mark.asyncio
async def test_fetch_for_customer_applies_legitimate_filter(db_session: AsyncSession) -> None:
    ingestion = await ingest_cast_event(db_session, _event())
    pipeline = await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    view = await fetch_for_customer(db_session, upi=pipeline.upi, customer_org="bmw")
    assert view is not None
    assert view["tier"] == "legitimate"
    body = view["dpp"]
    # Public fields visible
    assert "carbon" in body
    assert "compliance" in body
    # Legitimate-tier extras visible
    assert "chemistry" in body
    assert "soc" in body


@pytest.mark.asyncio
async def test_compliance_summary_aggregates_population(db_session: AsyncSession) -> None:
    for brand in ("CelestiAL", "CelestiAL-R", "Standard"):
        form = {"CelestiAL": "extrusion_billet", "CelestiAL-R": "sheet_ingot", "Standard": "sow"}[
            brand
        ]
        ingestion = await ingest_cast_event(db_session, _event(brand=brand, form=form))
        await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    summary = await compliance_summary(db_session)
    assert summary["totalDpps"] >= 3
    assert any(it["name"] == "REACH" and it["compliant"] >= 3 for it in summary["items"])


@pytest.mark.asyncio
async def test_carbon_aggregate_groups_by_brand(db_session: AsyncSession) -> None:
    for brand in ("CelestiAL", "Standard"):
        form = {"CelestiAL": "extrusion_billet", "Standard": "sow"}[brand]
        ingestion = await ingest_cast_event(db_session, _event(brand=brand, form=form))
        await run_dpp_pipeline(db_session, ingestion.cast_event_id)

    aggregate = await carbon_aggregate(db_session)
    brands = {item["brand"] for item in aggregate["items"]}
    assert brands == {"CelestiAL", "Standard"}
    celestial = next(i for i in aggregate["items"] if i["brand"] == "CelestiAL")
    assert celestial["avgCfpKgCo2ePerTonne"] > 0
    assert celestial["embodiedTonnesCo2e"] > 0


@pytest.mark.asyncio
async def test_recycled_aggregate_weighted_average(db_session: AsyncSession) -> None:
    ingestion = await ingest_cast_event(db_session, _event(brand="CelestiAL-R", form="sheet_ingot"))
    await run_dpp_pipeline(db_session, ingestion.cast_event_id)
    aggregate = await recycled_content_aggregate(db_session)
    assert aggregate["weightedAvgRecycledPct"] > 0
