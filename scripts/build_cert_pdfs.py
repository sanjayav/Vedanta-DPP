#!/usr/bin/env python3
"""Generate one branded placeholder PDF per certificate / regulation.

Output: a unique downloadable document per `documentId` referenced by demo
passports + API-generated DPPs. The files land under
`apps/<app>/public/dpp-assets/docs/certs/<doc-id>.pdf`.

Each PDF is real (one page, A4, header + cert metadata + a "this is a
demo placeholder" footer) so when an auditor clicks "PDF ↓" on the
public viewer they get something credible instead of the same
cfp-statement.pdf for every link.
"""

from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
WEB_PUBLIC = ROOT / "apps" / "web-public" / "public" / "dpp-assets" / "docs" / "certs"
WEB_CONSOLE = ROOT / "apps" / "web-console" / "public" / "dpp-assets" / "docs" / "certs"

# (doc_id, title, kind, issuer, reference, validity)
DOCS: list[tuple[str, str, str, str, str, str]] = [
    # Certifications
    ("doc-asi-perf",    "IZA Zinc Mark · Performance Certificate",            "Certification", "International Zinc Association",      "IZA Zinc Mark #HZL-2025-01 · Chanderiya, Dariba, Debari, Pantnagar", "Valid until 2027-05-01"),
    ("doc-asi-coc",     "ISO 22095 Chain of Custody · Certificate",           "Certification", "TÜV Rheinland",                       "ISO 22095 CoC #HZL-428",                                    "Valid until 2027-05-01"),
    ("doc-iso-9001",    "ISO 9001:2015 Quality Management",                   "Certification", "BSI Management Systems",              "BSI FS 612893",                                             "Valid until 2026-09-15"),
    ("doc-iso-14001",   "ISO 14001:2015 Environmental Management",            "Certification", "BSI Management Systems",              "BSI EMS 591222",                                            "Valid until 2026-09-15"),
    ("doc-iso-45001",   "ISO 45001:2018 Occupational Health & Safety",        "Certification", "BSI Management Systems",              "BSI OHS 615001",                                            "Valid until 2026-09-15"),
    ("doc-iso-50001",   "ISO 50001:2018 Energy Management",                   "Certification", "BSI Management Systems",              "BSI ENMS 614720",                                           "Valid until 2026-09-15"),
    ("doc-iso-17025",   "ISO/IEC 17025:2017 Lab Accreditation",               "Certification", "NABL India",                          "NABL TC-0029",                                              "Valid until 2027-03-30"),
    # Regulations
    ("doc-reg-cbam",    "EU CBAM · Embedded-Emissions Declaration",            "Regulation",    "HZL Compliance",                      "Regulation (EU) 2023/956 · CBAM-HZL-2026-Q1",                "Q1 2026 reporting period"),
    ("doc-reg-espr",    "EU ESPR · DPP Conformity Statement",                  "Regulation",    "HZL Compliance",                      "Regulation (EU) 2024/1781 · ESPR-DPP-HZL-001",               "Issued 2026-04-12"),
    ("doc-reg-reach",   "REACH · Article 33(1) Declaration",                   "Regulation",    "HZL Compliance",                      "Regulation (EC) 1907/2006 · REACH-HZL-2025",                 "Reviewed 2025-12-31"),
    ("doc-reg-rohs",    "RoHS 2 · Directive 2011/65/EU Declaration",          "Regulation",    "HZL Compliance",                      "Directive 2011/65/EU · RoHS-HZL-2025",                       "Reviewed 2025-12-31"),
    ("doc-reg-tsca",    "US TSCA · Section 8(b) Declaration",                  "Regulation",    "HZL Compliance",                      "US TSCA · TSCA-HZL-2025",                                    "Reviewed 2025-12-31"),
    ("doc-reg-3tg",     "Responsible Minerals · Due-Diligence Statement",      "Regulation",    "HZL Compliance",                      "OECD DDG · RM-HZL-2025",                                     "Reviewed 2025-12-31"),
    ("doc-reg-pfas",    "PFAS · REACH Annex XVII Statement",                   "Regulation",    "HZL Compliance",                      "Regulation (EU) 2024/879 · PFAS-HZL-2025",                   "Reviewed 2025-12-31"),
    ("doc-reg-alu-da",  "ESPR Annex III · Readiness Assessment",               "Regulation",    "HZL Compliance",                      "Regulation (EU) 2024/1781 · ESPR-ANX3-HZL-2025",             "Reviewed 2026-03-31"),
    # Bonus: PCF / EPD verification statement
    ("doc-cfp",         "Carbon Footprint Verification Statement (ISO 14067:2018)", "Verification statement", "International EPD System", "EPD-IES-0006472:001 · EcoZen SHG 99.995 · ISO 14067:2018", "Valid 2023-01-16 → 2028-01-15"),
    ("doc-lca-full",    "HZL Primary Zinc · Life-Cycle Assessment",            "LCA report",    "HZL Sustainability",                  "ISO 14040:2006 + ISO 14044:2006 · cradle-to-gate",          "Reporting period 2023"),
    ("doc-product-booklet", "HZL Product Brochure 2025",                       "Product info",  "Hindustan Zinc Limited",              "2025 edition",                                              "—"),
    ("doc-tech-booklet",    "HZL Technology Brochure · RLE smelter line",      "Technology",    "Hindustan Zinc Limited",              "2025 edition",                                              "—"),
]

INK = HexColor("#1c1917")
ACCENT = HexColor("#0F4C81")
MUTED = HexColor("#6b6864")
PAPER = HexColor("#ffffff")
HAIRLINE = HexColor("#d6d3cc")
WARN = HexColor("#b66323")


def draw_certificate(c: canvas.Canvas, *, doc_id: str, title: str, kind: str, issuer: str, reference: str, validity: str) -> None:
    width, height = A4

    # Top brand band
    c.setFillColor(ACCENT)
    c.rect(0, height - 22 * mm, width, 22 * mm, stroke=0, fill=1)
    c.setFillColor(PAPER)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(20 * mm, height - 14 * mm, "C6 TRAIL · Vedanta · Hindustan Zinc")
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, height - 19 * mm, "Digital Product Passport · evidence document")

    # Header eyebrow
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(20 * mm, height - 36 * mm, kind.upper() + "  ·  " + doc_id)

    # Title
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 19)
    text_obj = c.beginText(20 * mm, height - 48 * mm)
    text_obj.setLeading(22)
    for line in _wrap(title, 50):
        text_obj.textLine(line)
    c.drawText(text_obj)

    # Decorative rule
    c.setStrokeColor(HAIRLINE)
    c.setLineWidth(0.5)
    c.line(20 * mm, height - 70 * mm, width - 20 * mm, height - 70 * mm)

    # Metadata grid
    rows = [
        ("Issued by", issuer),
        ("Reference", reference),
        ("Validity", validity),
        ("Subject", "Hindustan Zinc Limited · Udaipur, Rajasthan, India"),
        ("Issued for", "Zinc / Lead DPP evidence (Public · Customer · Verifier · Authority)"),
        ("Document id", doc_id),
        ("Generated", date.today().isoformat()),
    ]
    y = height - 80 * mm
    for label, value in rows:
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(20 * mm, y, label.upper())
        c.setFillColor(INK)
        c.setFont("Helvetica", 11)
        text_obj = c.beginText(60 * mm, y)
        text_obj.setLeading(13)
        for line in _wrap(value, 70):
            text_obj.textLine(line)
        c.drawText(text_obj)
        y -= 11 * mm

    # Statement block
    y -= 4 * mm
    c.setStrokeColor(HAIRLINE)
    c.line(20 * mm, y, width - 20 * mm, y)
    y -= 8 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Conformity statement")
    y -= 6 * mm
    statement = (
        f"This document attests that {issuer} has assessed the subject's "
        f"compliance with {reference}. Conformity has been verified against "
        f"the criteria of the standard / regulation, and the subject's "
        f"production system was found to operate within the applicable "
        f"control framework during the validity window above."
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 10)
    text_obj = c.beginText(20 * mm, y)
    text_obj.setLeading(14)
    for line in _wrap(statement, 90):
        text_obj.textLine(line)
    c.drawText(text_obj)

    # Footer · placeholder marker
    c.setFillColor(WARN)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(20 * mm, 18 * mm, "DEMO PLACEHOLDER")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(46 * mm, 18 * mm, "· Production deployments replace this with the verifier-uploaded signed PDF.")
    c.setFillColor(MUTED)
    c.drawString(20 * mm, 12 * mm, f"C6 Trail · {doc_id} · generated for the Vedanta · Hindustan Zinc DPP platform")


def _wrap(text: str, max_chars: int) -> list[str]:
    out: list[str] = []
    line = ""
    for word in text.split():
        if len(line) + len(word) + 1 <= max_chars:
            line = (line + " " + word).strip()
        else:
            if line:
                out.append(line)
            line = word
    if line:
        out.append(line)
    return out or [""]


def main() -> None:
    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)
    WEB_CONSOLE.mkdir(parents=True, exist_ok=True)

    for doc_id, title, kind, issuer, reference, validity in DOCS:
        path = WEB_PUBLIC / f"{doc_id}.pdf"
        c = canvas.Canvas(str(path), pagesize=A4)
        draw_certificate(c, doc_id=doc_id, title=title, kind=kind, issuer=issuer, reference=reference, validity=validity)
        c.showPage()
        c.save()
        # Mirror to console
        shutil.copyfile(path, WEB_CONSOLE / f"{doc_id}.pdf")
        print(f"  ✓ {doc_id}.pdf")

    print(f"\nGenerated {len(DOCS)} PDFs into {WEB_PUBLIC} and {WEB_CONSOLE}.")


if __name__ == "__main__":
    main()
