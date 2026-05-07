"""Customer-tier read service.

Customers see DPPs at the legitimate-interest tier — full chemistry, MTC
references, mechanical properties, but NOT the calculation parameters or
internal correspondence that authority tier reveals.

In v1.0 customers see every DPP issued by the tenant; v1.5 introduces a
shipment ↔ customer-org relationship and gates by that. The legitimate-tier
field filter is applied here regardless.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import DppRecord
from .dpps import filter_for_tier


async def list_for_customer(
    session: AsyncSession,
    *,
    customer_org: str,
    brand: str | None = None,
    period_from: str | None = None,
    period_to: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    stmt = select(DppRecord).where(DppRecord.state == "published")
    count_stmt = select(func.count()).select_from(DppRecord).where(DppRecord.state == "published")
    if brand:
        stmt = stmt.where(DppRecord.brand == brand)
        count_stmt = count_stmt.where(DppRecord.brand == brand)
    if period_from:
        stmt = stmt.where(DppRecord.issued_at >= period_from)
        count_stmt = count_stmt.where(DppRecord.issued_at >= period_from)
    if period_to:
        stmt = stmt.where(DppRecord.issued_at <= period_to)
        count_stmt = count_stmt.where(DppRecord.issued_at <= period_to)
    stmt = stmt.order_by(DppRecord.issued_at.desc().nullslast()).limit(limit).offset(offset)

    rows = (await session.scalars(stmt)).all()
    total = (await session.scalar(count_stmt)) or 0
    items = [
        {
            "upi": r.upi,
            "brand": r.brand,
            "alloy": r.alloy,
            "form": r.form,
            "weightKg": r.weight_kg,
            "cfpKgCo2ePerTonne": r.cfp_kg_co2e_per_tonne,
            "recycledContentPct": r.recycled_content_pct,
            "issuedAt": r.issued_at.isoformat() if r.issued_at else None,
            "digitalLinkUrl": r.body.get("upi", {}).get("digitalLinkUrl"),
            # Legitimate-tier ONLY — never include the full body in list views.
            # Use /api/v1/customer/dpps/{upi} to fetch detail.
            "verifierName": r.body.get("carbon", {}).get("verifier", {}).get("name"),
            "asiCertificateRef": r.body.get("recycledContent", {}).get("asiCertificateRef"),
        }
        for r in rows
    ]
    return items, int(total)


async def fetch_for_customer(
    session: AsyncSession, *, upi: str, customer_org: str
) -> dict[str, Any] | None:
    record = await session.scalar(select(DppRecord).where(DppRecord.upi == upi))
    if record is None or record.state == "withdrawn":
        return None
    body = filter_for_tier(record.body, "legitimate")
    return {
        "upi": record.upi,
        "tier": "legitimate",
        "state": record.state,
        "issuedAt": record.issued_at.isoformat() if record.issued_at else None,
        "expiresAt": record.expires_at.isoformat() if record.expires_at else None,
        "signatureRef": {
            "algorithm": "Ed25519Signature2020",
            "value": record.signature,
            "bodySha256": record.body_sha256,
        }
        if record.signature
        else None,
        "dpp": body,
    }


async def compliance_summary(session: AsyncSession) -> dict[str, Any]:
    """Aggregate compliance posture across the visible DPP population."""
    rows = (await session.scalars(select(DppRecord).where(DppRecord.state == "published"))).all()

    by_status: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    total = 0
    for r in rows:
        total += 1
        regs = r.body.get("compliance", {}).get("regulations", [])
        certs = r.body.get("compliance", {}).get("certifications", [])
        for entry in regs + certs:
            name = entry.get("name", "Unknown")
            by_status[name][entry.get("status", "pending")] += 1

    items = [
        {
            "name": name,
            "compliant": stats.get("compliant", 0),
            "nonCompliant": stats.get("non_compliant", 0),
            "pending": stats.get("pending", 0),
            "notApplicable": stats.get("n_a", 0),
            "coveragePct": (stats.get("compliant", 0) / total * 100) if total else 0,
        }
        for name, stats in sorted(by_status.items())
    ]
    return {"totalDpps": total, "items": items}


async def carbon_aggregate(session: AsyncSession) -> dict[str, Any]:
    """CFP aggregates per brand — table + comparison ready for the UI."""
    rows = (await session.scalars(select(DppRecord).where(DppRecord.state == "published"))).all()

    by_brand: dict[str, list[float]] = defaultdict(list)
    weights_by_brand: dict[str, float] = defaultdict(float)
    for r in rows:
        by_brand[r.brand].append(r.cfp_kg_co2e_per_tonne)
        weights_by_brand[r.brand] += r.weight_kg

    items = []
    for brand, values in sorted(by_brand.items()):
        if not values:
            continue
        items.append(
            {
                "brand": brand,
                "count": len(values),
                "avgCfpKgCo2ePerTonne": sum(values) / len(values),
                "minCfpKgCo2ePerTonne": min(values),
                "maxCfpKgCo2ePerTonne": max(values),
                "totalWeightKg": weights_by_brand[brand],
                "embodiedTonnesCo2e": sum(values) / 1000 * weights_by_brand[brand] / 1000,
            }
        )
    return {
        "industryAverageKgCo2ePerTonne": 14600,
        "items": items,
    }


async def recycled_content_aggregate(session: AsyncSession) -> dict[str, Any]:
    rows = (await session.scalars(select(DppRecord).where(DppRecord.state == "published"))).all()
    total_weight = sum(r.weight_kg for r in rows) or 1
    weighted_avg = sum(r.weight_kg * r.recycled_content_pct for r in rows) / total_weight

    by_brand: dict[str, dict[str, float]] = defaultdict(lambda: {"weight": 0.0, "recycled": 0.0})
    for r in rows:
        b = by_brand[r.brand]
        b["weight"] += r.weight_kg
        b["recycled"] += r.weight_kg * (r.recycled_content_pct / 100)

    return {
        "totalWeightKg": total_weight,
        "weightedAvgRecycledPct": weighted_avg,
        "items": [
            {
                "brand": brand,
                "totalWeightKg": stats["weight"],
                "recycledTonnes": stats["recycled"] / 1000,
                "recycledPct": (stats["recycled"] / stats["weight"] * 100)
                if stats["weight"]
                else 0,
            }
            for brand, stats in sorted(by_brand.items())
        ],
    }
