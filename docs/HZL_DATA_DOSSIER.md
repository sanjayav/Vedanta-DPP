# HZL Data Dossier · canonical reference for the C6 Trail platform

This file is the single source of truth for Hindustan Zinc Limited (HZL) data
used in the C6 Trail DPP platform. Every value is sourced from an official
public document and the source is cited inline.

**Sources (all in [`public/`](../public/)):**
- `HZL_Product_Brochure_2025_537b31386b.pdf` (4 pages) — product portfolio,
  site map, certifications.
- `Sustainability_Report_26092025_45ea29a98a.pdf` (~120 pages, FY 2024-25) —
  the comprehensive ESG / GRI 2021 + GRI 14 disclosures.
- `zinc-day-consolidated-presentation-vf1.pdf` — investor positioning.
- `Chem-X_Sustainability-Guideline_v1.0.pdf` — six EF 3.1 LCIA categories.
- `Chem-X_Business-Identity-Guideline_v1.0.pdf` — CX-0010 BPDM scheme.
- `Chem-X_Material-ID-Guideline_v1.0.pdf` — did:web pattern.

When generating any HZL-anchored value (preset, demo passport, console copy,
plant-monitor target, scorecard cell, certification chip), **first check this
dossier**. If the value isn't here, prefer to add it here from a cited source
rather than invent one.

---

## 1 · Corporate identity (BPDM)

| Field | Value | Source |
|---|---|---|
| Legal name | Hindustan Zinc Limited | HZL Brochure p1 |
| Short name | HZL | HZL Brochure p1 |
| Trade name | Vedanta · Hindustan Zinc | HZL Brochure p4 (logo lockup) |
| BSE scrip code | 500188 | HZL Brochure p1; Sustainability cover letter |
| NSE trading symbol | HINDZINC | HZL Brochure p1; Sustainability cover letter |
| CIN | L27204RJ1966PLC001208 | Sustainability cover footer |
| LEI | 335800LB39TLJ8YTWM98 | GLEIF (cross-ref) |
| PAN | AAACH7354K | Public statutory record |
| GSTIN-RJ | 08AAACH7354K1ZB | Public statutory record |
| ISIN | INE267A01025 | NSE/BSE listing |
| Registered office | Yashad Bhawan, Udaipur, 313004, Rajasthan, India | Sustainability cover footer |
| Phone | +91 294 6604000-02 | Sustainability cover; HZL Brochure p4 (-20) |
| Website | www.hzlindia.com | All documents |
| Corporate email | hzl.secretarial@vedanta.co.in | Sustainability cover |
| Product email | infohzl@vedanta.co.in | HZL Brochure p4 |
| Sustainability email | Sustainability.Hzl@vedanta.co.in | Sustainability p3 |
| Group | Vedanta Group company | HZL Brochure p1 |
| Incorporated | 1966 | Sustainability p4 |
| Workforce (FY 2024-25) | 25,531 | Sustainability p4, p103 |
| Ownership (Mar 31 2025) | Vedanta 63.42% · GoI 27.92% · Public 8.66% | Sustainability p4 |

**Catena-X CX-0010 BPDM mapping** (assigned by C6 Trail platform):

| Site | Type | BPN | Location |
|---|---|---|---|
| Hindustan Zinc Limited (legal entity) | BPNL | `BPNLHZL0000001QX` | Udaipur, Rajasthan |
| Registered office | BPNA | `BPNAHZAREG0001IG` | Yashad Bhawan, Udaipur |
| Chanderiya Lead-Zinc Smelter (CLZS) | BPNS | `BPNSHZSCHA00012N` | Chittorgarh, Rajasthan |
| Dariba Smelting Complex (DSC) | BPNS | `BPNSHZSDAR00027L` | Rajsamand, Rajasthan |
| Debari Zinc Smelter (ZSD) | BPNS | `BPNSHZSDEB00033K` | Debari, Rajasthan |
| Pantnagar Metal Plant (PMP) | BPNS | `BPNSHZSPNT00041J` | Rudrapur, Uttarakhand |
| Rampura Agucha Mine | BPNS | `BPNSHZMRAG00056H` | Bhilwara, Rajasthan |
| Sindesar Khurd Mine (SKM) | BPNS | `BPNSHZMSKM00068F` | Rajsamand, Rajasthan |
| Rajpura Dariba Mine (RDM) | BPNS | `BPNSHZMRJD00071F` | Rajsamand, Rajasthan |
| Zawar Mines (ZM) | BPNS | `BPNSHZMZWR00082E` | Udaipur, Rajasthan |
| Kayad Mine (KM) | BPNS | `BPNSHZMKAY00094D` | Ajmer, Rajasthan |
| Bamnia Kalan Mine | BPNS | `BPNSHZMBKM00103C` | Rajsamand, Rajasthan |

> Bamnia Kalan appears in the Sustainability Report mining-asset list
> (p5) but **not** in the HZL Product Brochure 2025. Treat as early-stage.

**Depots (8):** Hyderabad · Pune · Chennai · Kolkata · Jamshedpur · Faridabad
· Bengaluru · Raipur. *Source: HZL Brochure p4.*

**Issuer DID for the C6 Trail platform:** `did:web:passport.hzlindia.com:BPNLHZL0000001QX`.

---

## 2 · Production (FY 2024-25)

*Source: Sustainability Report p4, p104.*

| Metric | Value | Notes |
|---|---|---|
| Zinc finished metal | **0.827 Mnt** (827 kt) | World's largest integrated zinc producer |
| Lead finished metal | **0.225 Mnt** (225 kt) | LME-registered "Vedanta 99.99" |
| Silver finished metal | **687 MT** | Top 5 globally; LBMA certified (Pantnagar) |
| Refined metal capacity | 1.123 Mnt | All metals combined |
| Total ore production | 16.33 Mnt | Mines |
| Total R&R | 453.2 Mnt | Mineral resource & reserves |
| Captive power capacity | 625.16 MW | All sites |

Historical production:

| Metric | FY24-25 | FY23-24 | FY22-23 | FY21-22 | FY20-21 |
|---|---|---|---|---|---|
| Zinc (Mnt) | 0.827 | 0.817 | 0.821 | 0.776 | 0.715 |
| Lead (Mnt) | 0.225 | 0.216 | 0.211 | 0.191 | 0.214 |
| Silver (MT) | 687 | 746 | 714 | 647 | 706 |

**Market share:** ~77% of primary zinc market in India. Supplies 40+ countries.
*Source: HZL Brochure p1.*

---

## 3 · Product portfolio (zinc + lead + silver)

### 3a · Zinc grades (HZL Brochure p2)

| Grade | Form | Unit mass | Bundle | Notes |
|---|---|---|---|---|
| **EcoZen** SHG 99.995 | Ingot | 25 kg | 1 t | Asia's 1st low-carbon zinc · 75% below IZA average · LCA-certified · 100% RE |
| CGG (Continuous Galvanising Grade) Jumbo | Jumbo | — | 1 t | Hot-dip galvanising bath for steel |
| SHG (Special High Grade) | Ingot | 25 kg | 1 t | LME-grade Z1, ≥99.995% Zn |
| SHG Jumbo | Jumbo | — | 1 t | SHG in jumbo format |
| PW (Prime Western) | Ingot | 25 kg | 1 t | Prime Western Zinc, ≥98% Zn |
| HG (High Grade) | Ingot | 25 kg | 1 t | High Grade, ≥99.95% Zn |
| HZDA3 (Hindustan Zinc Die-Casting Alloy 3) | Ingot | 9 kg | 1 t | Die-casting alloy with Al/Mg |
| HZDA5 (Hindustan Zinc Die-Casting Alloy 5) | Ingot | 9 kg | 1 t | Die-casting alloy with Cu |
| Jumbo HG | Jumbo | — | 1 t | High Grade in jumbo format |

**Zinc applications:** galvanizing, die-casting, automotive, infrastructure,
sunrise sectors, electronics, energy storage. *Source: HZL Brochure p2.*

**LME purity:** up to 99.99% LME-certified pure zinc.
**LME-registered brand name:** "Vedanta SHG 99.995".

### 3b · Lead (HZL Brochure p2)

| Product | Form | Unit mass | Bundle | Notes |
|---|---|---|---|---|
| Refined Lead 99.99 | Ingot | 25 kg | 1 t | LME-registered "Vedanta 99.99" · BIS IS 27:2023 |

**Applications:** automotive batteries, pigments, cable sheathing, die-casting.
**LME purity:** up to 99.99% LME-certified pure lead.

### 3c · Silver (HZL Brochure p3)

| Product | Form | Mass | Notes |
|---|---|---|---|
| Silver Bar | Bar | 30 kg | LBMA certified |
| Mini Silver Bars | Bar | 1 kg | LBMA certified |
| Silver Powder | Powder | — | LBMA certified |

**Applications:** electronics, AI, nanotechnology, biotechnology, solar,
silverware, energy transition.
**Pantnagar Plant:** 100% Green Power.
**Purity:** up to 99.9% LBMA certified pure silver.

### 3d · The three flagship DPP products (C6 Trail PoC)

| Slug (preset) | Trade name | Designation | PCF (kg CO₂e/kg) | Industry avg | Reduction |
|---|---|---|---|---|---|
| `zinc-ecozen-shg-99-995` | **EcoZen** | SHG 99.995 zinc | **0.95** | 3.7 (IZA SHG) | ~75% |
| `zinc-cgg-jumbo` | **CGG Jumbo** | Continuous Galvanising Grade | **3.4** | 3.7 (IZA SHG) | — |
| `lead-pure-99-99` | **Vedanta 99.99** | Refined Lead 99.99 | **1.6** | 1.9 (ILA primary lead) | ~16% |

> The PCF values for EcoZen are corroborated by the Sustainability Report
> p87: "Its carbon footprint is 75% lower than the global average (i.e.,
> < 1 tonne of carbon equivalent per tonne of zinc)" — i.e. <1 kg CO₂e/kg.

---

## 4 · Climate, energy & emissions (FY 2024-25)

*Source: Sustainability Report pages 83-88, 104-105.*

### 4a · GHG emissions (million MT CO₂e)

| Scope / category | FY24-25 | FY23-24 | FY22-23 | FY21-22 | FY20-21 |
|---|---|---|---|---|---|
| **Scope 1 (direct)** | **4.47** | 4.25 | 3.44 | 4.32 | 4.49 |
| · Coal | 3.91 | 3.74 | 2.92 | 3.87 | 4.09 |
| · Coke | 0.32 | 0.27 | 0.28 | 0.23 | 0.198 |
| · HSD/LDO | 0.184 | 0.22 | 0.21 | 0.16 | 0.160 |
| · LSHS | 0.03 | 0.003 | 0 | 0 | 0 |
| · Propane | 0.02 | 0.02 | 0.02 | 0 | 0.00042 |
| · LPG | 0.0005 | 0.0004 | 0.0003 | 0.0004 | 0.001 |
| · PNG | 0.003 | 0.003 | 0.01 | 0.02 | 0.014 |
| · Furnace oil / Pyrolysis oil | 0 | 0 | 0 | 0 | 0 |
| **Scope 2 (indirect, electricity)** | **0.39** | 0.56 | 1.14 | 0.49 | 0.31 |
| **Scope 3 (value chain) — total** | **1.54** | 1.60 | 1.61 | 1.77 | 1.65 |
| · Cat 1 — Purchased goods & services | 0.41 | 0.43 | 0.37 | 0.37 | 0.31 |
| · Cat 2 — Capital goods | 0.05 | 0.0024 | 0.022 | 0.007 | 0.007 |
| · Cat 3 — Fuel & energy-related | 0.73 | 0.84 | 0.92 | 1.01 | 0.96 |
| · Cat 4 — Upstream transport | 0.03 | 0.014 | 0.010 | 0.010 | 0.011 |
| · Cat 5 — Waste from operations | 0.02 | 0.010 | 0.008 | 0.009 | 0.009 |
| · Cat 6 — Business travel | 0.001 | 0.0002 | 0.0006 | 0.0002 | 0.0013 |
| · Cat 7 — Employee commuting | 0.0014 | 0.0012 | 0.0013 | 0.0018 | 0.0019 |
| · Cat 9 — Downstream transport | 0.050 | 0.043 | 0.047 | 0.026 | 0.019 |
| · Cat 10 — Processing of sold products | 0.23 | 0.236 | 0.223 | 0.319 | 0.305 |
| · Cat 12 — End-of-life treatment | 0.019 | 0.017 | 0.016 | 0.016 | 0.018 |

### 4b · Energy & intensity

| Metric | FY24-25 | FY23-24 | FY22-23 | FY21-22 |
|---|---|---|---|---|
| GHG intensity Scope 1+2 (MT CO₂e/T metal) | **4.61** | 4.66 | 4.44 | 4.97 |
| Energy intensity (GJ/MT) | **47.99** | 47.63 | 41.53 | 48.46 |
| Total non-renewable energy (MWh) | 1,33,18,427 | 1,31,51,306 | 1,13,03,993 | 1,26,90,937 |
| Total renewable energy (MWh) | 7,02,938 | 5,26,019 | 5,95,234 | 3,46,296 |

### 4c · Renewable energy programme

- **Serentica PDA III:** 530 MW (was 450 MW), Group Captive SPV (HZL 26% / INR
  3.5 bn stake, developer 74%), 70% Capacity Utilisation Factor, 307 mn units
  in FY 2024-25 (Sustainability p87). First flow: May 2024.
- Current renewable share of total power: **13%** (FY 2024-25) — target **70%**
  by FY 2028.
- Reduces CO₂e emissions by 3.67 million tonnes when fully ramped.

### 4d · Climate ambition

- **Net Zero by 2050 or earlier** — SBTi 1.5°C "Business Ambition" aligned.
- 50% reduction Scope 1+2 by 2030 (base FY 2019-20).
- 25% reduction Scope 3 by 2030.
- ~US $1 billion allocated to climate change initiatives.
- 75% fleet electrification by 2035.
- First Indian company to introduce underground BEVs (3 at Sindesar Khurd).
- 180 LNG vehicles for inter-unit / finished goods movement.
- 10 EV trucks, 3 EV charging stations.
- 0.67 mn tCO₂e GHG savings in FY 2024-25.
- 15% reduction in carbon intensity from FY 2019-20.
- 104,149 GJ energy saved → 20,687 tCO₂e reduced.
- All sites ISO 14001:2015 + ISO 50001:2018 certified.

---

## 5 · Water (FY 2024-25)

*Source: Sustainability Report pages 89-91.*

### 5a · Water balance (m³)

| Flow | FY 2024-25 |
|---|---|
| **Total water withdrawal** | 27,756,734 |
| · Surface water | 15,193,065 |
| · Third-party (incl. treated municipal waste) | 8,741,697 |
| · Groundwater | 3,821,972 |
| **Total water consumption** (op + non-op) | 27,756,734 |
| · Operational use (fresh + treated municipal) | 25,978,248 |
| · Non-operational use (CSR + evaporation + storage) | 1,775,645 |
| **Total water reused & recycled** | 21,821,588 |
| **Water discharge** | **0** (Zero Liquid Discharge) |

### 5b · Water performance trends

| Metric | FY24-25 | FY23-24 | FY22-23 | FY21-22 |
|---|---|---|---|---|
| Water recycling (%) | **46** | 41 | 42 | 44 |
| Water intensity (m³ / t metal) | **24.69** | 25.31 | 24.67 | 25.52 |

### 5c · Water highlights

- **3.32x water positive** status achieved (FY 2024-25).
- **Zero Liquid Discharge** at every site.
- 60 MLD Sewage Treatment Plant in Udaipur (PPP) — supplies 36% of total
  water withdrawal as treated sewage water. 80% of Udaipur's 29 lakh MLD
  annual sewage is converted to reusable water through the STP. 3.33 lakh
  Udaipur residents directly benefited. *Source: Sustainability p82, p98.*
- **4,000 KLD water treatment plant at Rampura Agucha Mine** — increased
  water positivity 3.2 → 5.3x, reduced fresh water use 40%, saved 125 crore
  litres of water annually. *Source: Sustainability p10, p90.*
- Rajpura Dariba achieved **Scope-1 Water Positive certification** under
  NITI Aayog framework.

---

## 6 · Air emissions (MT, FY 2024-25)

*Source: Sustainability Report pages 96, 105.*

| Pollutant | FY24-25 | FY23-24 | FY22-23 | FY21-22 | FY20-21 |
|---|---|---|---|---|---|
| Particulate Matter (PM, stack) | 1,247 | 1,261 | 1,048 | 963 | 1,097 |
| SOx (stack) | 26,753 | 25,199 | 17,247 | 22,006 | 19,600 |
| NOx (stack) | 6,606 | 7,033 | 4,851 | 6,145 | 8,098 |
| Hazardous Air Pollutants | BDL | — | — | — | — |
| Mercury | BDL | — | — | — | — |

> Mercury — per ICMM Position Statement, HZL does not produce or use
> mercury in mining or ore processing; mercury arises only as a smelting
> by-product and is sold to chemical/other industries as raw material.

---

## 7 · Waste (FY 2024-25)

*Source: Sustainability Report pages 92-93, 106.*

### 7a · Waste types & recycle rates

| Waste type | Generated (Mt) | Recycle / reuse rate | Disposal route |
|---|---|---|---|
| **Mineral — Waste Rock** | 3.86 | **95.04%** | Mine backfill, tailings dam embankment |
| **Mineral — Tailings** | 14.30 | 28.47% | Hydro fill, Paste fill, TSF disposal |
| **Slag** (smelting) | — | 72.67% | Cement manufacturing, road construction |
| **Fly Ash** (power gen) | — | 99.79% | Cement & brick manufacturers |
| **Jarosite / Jarofix** | — | 59% | Jarosite → cement; Jarofix (lime + cement stabilisation, M/s Canadian Electrolytic Zinc patent) → road construction |
| Hazardous waste | 0.108 | 62% | 4Rs framework |
| Non-Hazardous waste | 1.49 | 83% | 4Rs framework |

### 7b · R&D and circular economy

- **39,682 MT** jarosite reduction via fumer operations.
- **4.45 lakh MT** jarosite + jarofix repurposed in FY 2024-25.
- **~INR 10.26 crore** R&D expenditure for waste-to-resource.
- **2x increase** in gainful utilisation of smelting waste (>6 lakhs MT).
- Zinc Fumer Plant commissioned at Chanderiya (recovers metals from zinc
  residue, converts jarosite to clean slag).
- VEXL Environ Projects MoU — pilot plant for recovering saleable products
  from smelter waste. *Source: Sustainability p10.*
- EcoBounty partnership — scientific conversion of jarosite into
  construction-grade materials (cement additives, fillers).
- TERI partnership — 6.25 hectares of Jarofix yard at Chanderiya
  transformed into greenbelt (11,000 native saplings planted).

---

## 8 · Tailings management

*Source: Sustainability Report pages 94-95.*

- **Zero tailings facility incidents** in past 4 years.
- **100%** of active facilities covered by independent third-party reviews
  in last 3 years.
- **GISTM** (Global Industry Standard on Tailings Management) compliant.
- **Satellite-based InSAR** technology for early ground-movement detection.
- Dry tailings plants commissioned at **Zawar** and **Dariba**; another
  underway at **Rampura Agucha**.
- 13 million m³ water recovery from tailings dam in FY 2024-25.
- Acid Rock Drainage (ARD) review by ERM at Zawar / Rampura Agucha /
  Rajpura Dariba / Sindesar Khurd — pH 6.5–8.0 across operations,
  no current acid generation.

| Tailings risk class | FY 2024-25 |
|---|---|
| Active facilities (3) | 100% high-risk-potential — covered by review |
| Inactive (1) in care/maintenance | 100% high-risk-potential — covered |

---

## 9 · Biodiversity

*Source: Sustainability Report pages 97-100.*

- **0.74 million** trees planted (cumulative) since FY 2019-20 base.
- Cumulative plantation (lakhs): 4.04 (FY21-22) → 5.22 (FY22-23) → 6.7
  (FY23-24) → **7.4** (FY24-25).
- IUCN 3-year engagement for Biodiversity Management Plans (BMPs).
- TNFD report — first published FY23-24, second FY24-25 (extended to
  downstream value chain).
- IBAT (Integrated Biodiversity Assessment Tool), STAR metric.
- 32,500 saplings planted via **Miyawaki method** from 65 native species.
- **No fines, enforcement orders, or penalties** related to biodiversity
  violations recorded in FY 2024-25.
- 369-hectare **Zinc Baghdarrah Crocodile Conservation Reserve** under MoU
  with Rajasthan Protected Area Conservation Society.
- 9 operational sites; 3,072.29 hectares total acquired.
- Targets: No Net Loss (NNL), Net Positive Impact (NPI), no gross
  deforestation in protected areas / no net deforestation by 2050.
- Avoid: World Heritage Sites + IUCN Cat I-IV protected areas
  (ICMM Principle 7).

---

## 10 · Health & safety (FY 2024-25)

*Source: Sustainability Report page 107.*

| Indicator | FY24-25 | FY23-24 | FY22-23 |
|---|---|---|---|
| Fatalities (FTE) | 1 (subsidiary) | 0 | 1 |
| Fatalities (contract) | 3 | 0 | 6 |
| LTIFR (overall HZL, /M hours) | **0.55** | 0.88 | 0.70 |
| TRIFR (overall HZL, /M hours) | **1.20** | 1.84 | 1.93 |
| Occupational disease rate | 0 | 0 | 0 |
| Process Tier 1 incidents | 0 | 0 | 6 |
| Near miss reports | 37,693 | 29,362 | 21,310 |

- **55% reduction** in TRIFR from FY 2019-20 baseline.
- Per ICMM Guidelines on safety reporting.

---

## 11 · Economic indicators (INR crore, FY 2024-25)

*Source: Sustainability Report page 102.*

| Metric | FY24-25 | FY23-24 | FY22-23 |
|---|---|---|---|
| Revenue from Operations | **34,083** | 28,932 | 34,098 |
| Other Income | 983 | 1,074 | 1,379 |
| Total economic value generated | **35,066** | 30,006 | 35,477 |
| Profit before tax | 13,553 | 10,307 | 15,288 |
| Profit for the year | **10,353** | 7,759 | 10,511 |
| EPS (INR per share) | **24.5** | 18.36 | 24.88 |
| Payment to Government (Tax + Royalty) | 7,303 | 6,065 | 8,845 |
| Exchequer contribution | 18,963 | (FY23-24 ↑44%) | — |
| Community investments (CSR) | 265 | 265 | 214 |

- **5.6% Dividend Yield** (among India's highest).
- Top 10 wealth creators in Nifty 200.

---

## 12 · CSR (FY 2024-25)

*Source: Sustainability Report pages 73-82.*

- **INR 273.45 crore** CSR spend.
- **2.3 million** beneficiaries across 2,362 villages.
- 25% women executives.
- 23 LGBTQA+ individuals integrated into workforce.
- India's 1st All-Women Surface Mine Rescue Team (30 members) +
  India's 2nd All-Women Underground Mine Rescue Team.
- 23,810 person-days skill upgradation training.

**Programmes (anchor IDs for documentation refs):**
- **Shiksha Sambal** (with Vidya Bhawan Society + SARD): 35,000+ students,
  ~140 schools, 95% Class 10 pass rate.
- **Unchi Udaan** (with Vidya Bhawan Society + Resonance): 31 students
  batch-6 admitted to GEC; 27 placed at avg INR 9-10 LPA, max 21 LPA.
- **Jeevan Tarang** (with Badhir Bal Kalyan + Badhit Bal Vikas Samitis):
  2,600+ people with disabilities benefited.
- **Zinc Football Academy (ZFA):** 3-star AIFF rating; "Sports Academy of
  the Year" Sport India Awards 2024.
- **Suraksha Margdarshika** (in-house safety): 28,445 community members.

---

## 13 · Standards & frameworks (HZL aligns to)

*Source: Sustainability Report pages 3, 85, 108-120.*

### 13a · Reporting / disclosure

- GRI Standards 2021
- GRI 14: Mining and Metals Sector 2023 (sector-specific)
- SASB
- TCFD / TNFD (Taskforce on Nature-related Financial Disclosures, 2nd
  report FY 2024-25 with downstream value chain coverage)
- IFRS S2 (first Indian metals & mining company to publish aligned
  Climate Action Report)

### 13b · Membership / commitments

- **ICMM** (International Council on Mining and Metals) — first Indian
  company to join, **2025**.
- UNGC (UN Global Compact, signatory)
- UNGC Women Empowerment Principles
- UN CEO Water Mandate
- FIMI (Federation of Indian Mineral Industries)
- UN SDGs

### 13c · Quality / EHS / energy management

- **ISO 9001:2015** Quality Management
- **ISO 14001:2015** Environmental Management (all sites)
- **ISO 45001:2018** Occupational Health & Safety
- **ISO 50001:2018** Energy Management (all sites)
- **ISO 14025:2006** + **EN 15804:2012+A2:2019** EPD methodology
- **ISO 14067:2018** product carbon footprint (Chem-X anchor)
- **GISTM** (Global Industry Standard on Tailings Management)
- **TMFS** (Tailings Management Facility Standard, internal)
- SBTi 1.5°C "Business Ambition for 1.5°C"
- Mineral Conservation & Development Rules 2017 (Rule 23, India)
- IFC guidelines (mine closure)

### 13d · Product compliance

- **REACH** (EU 1907/2006) — zinc CAS 7440-66-6, lead CAS 7439-92-1
- **RoHS / ELV** (EU Annex II)
- **BIS** (Bureau of Indian Standards) certifications
  - **IS 209:1992** — refined zinc Z1/Z2/Z3/Z4/Z5
  - **IS 27:2023** — refined lead Pb 99.99
- **ASTM B6-18** (slab zinc)
- **ASTM B852-13** (CGG Continuous Galvanising Grade)
- **BS EN 1179:2003** (refined zinc)
- **CBAM** (EU 2023/956) declaration-ready
- **LME registered brand**: "Vedanta SHG 99.995" (zinc), "Vedanta 99.99" (lead)
- **LBMA** (London Bullion Market Association) for silver
- **IZA Zinc Mark** — Chanderiya site certified April 2026 (per CLAUDE.md
  PoC date)
- **EPD-IES-0006472:001** — EcoZen environmental declaration
  (International EPD System, valid 2023-01-16 → 2028-01-15)

### 13e · External assurance

- **S. R. Batliboi & Co. LLP** — limited assurance per ISAE 3000 (Revised)
  on FY 2024-25 Sustainability Report (independence-declared).

---

## 14 · Sustainability Goals 2030

*Source: Sustainability Report pages 8-9. Baseline: FY 2019-20.*

| Pillar | Targets |
|---|---|
| **Climate** | 50% reduction Scope 1+2 · 25% reduction Scope 3 · Net Zero by 2050 or earlier |
| **Water** | 50% reduction freshwater consumption · 100% low-quality water for smelting · supply-chain water-stress engagement |
| **Circular Economy** | Near to Zero waste to landfill via reuse / recycling / recovery |
| **Biodiversity** | Halting & reversing biodiversity loss · No Net Loss (NNL) at all mine sites by closure |
| **Responsible Sourcing** | 100% supplier ESG evaluation · 25% local procurement (base FY 2025) · greener fuels for Scope 3 reduction |
| **Zero Harm** | Zero Fatality + 100% elimination of high-consequence work-related injuries |
| **Social Impact** | 0.5 million lives directly impacted · 30,000 employable individuals |
| **Diversity** | 30% gender diversity (decision-making focus) |

**Pillars:** SAFE · SMART · SUSTAINABLE
**Driver:** ZERO HARM · ZERO WASTE · ZERO DISCHARGE

---

## 15 · Vision, mission, values

*Source: Sustainability Report pages 6-7.*

- **Vision:** Be the world's largest and most admired Zinc-Lead & Silver Company.
- **Mission:**
  1. Enhance stakeholder value through exploration, innovation, operational
     excellence, safety and sustainability.
  2. Be a globally lowest cost producer.
  3. Maintain market leadership and customer delight.
- **Values:** Entrepreneurship · Trust · Integrity · Care · Excellence ·
  Innovation · Respect.

---

## 16 · Awards & rankings

- **#1 in S&P Global Corporate Sustainability Assessment (CSA) 2024**
  (Metals & Mining sector), 2nd consecutive year. As of 31 Dec 2024.
- **World's Most Sustainable Metals & Mining Company** — 3rd consecutive
  year. *Source: HZL Brochure p1.*
- **First Indian Company to join ICMM** in 2025.
- **First Indian metals & mining company** to publish IFRS S2-aligned
  Climate Action Report.
- **'Sports Academy of the Year'** — Sport India Awards 2024 (ZFA).
- Recognised as **Employees' Choice Workplace** at W.E. Matter Global
  Awards 2024.

---

## 17 · Site nomenclature & abbreviations

For consistency in code / copy:

| Abbreviation | Full name |
|---|---|
| ZM | Zawar Mines |
| SKM | Sindesar Khurd Mine |
| RDM | Rajpura Dariba Mine |
| RAM | Rampura Agucha Mine |
| KM | Kayad Mine |
| BKM | Bamnia Kalan Mine |
| ZSD | Zinc Smelter Debari |
| CLZS | Chanderiya Lead-Zinc Smelter |
| DSC | Dariba Smelting Complex |
| PMP | Pantnagar Metal Plant |

> Note: HZL Brochure (consumer-facing) refers to the Debari smelter as
> "Zinc Smelter Debari"; Sustainability Report (regulatory) uses
> "Debari Zinc Smelter". Use either, not both, in any one surface.

---

## 18 · Process technology (used in plant-monitor and DraftWizard insights)

### 18a · Zinc — Roast-Leach-Electrowinning (RLE) hydrometallurgical route

The Chanderiya, Debari, and Dariba smelters operate the RLE hydromet route:
1. **Roasting** of zinc-sulphide concentrate → ZnO (calcine) + SO₂.
2. **Leaching** with sulphuric acid → ZnSO₄ solution.
3. **Purification** → impurity removal (Cu, Cd, Ni, Co cementation).
4. **Electrowinning** in the cellhouse → cathode zinc (>99.995% Zn).
5. **Casting** in induction furnaces → 25 kg ingots, 1 t jumbos.

Pyrometallurgical (Imperial Smelting Process, ISP) operates for lead
co-production at Chanderiya and Dariba.

### 18b · Lead — pyrometallurgical (ISP)

Lead-rich concentrate → sinter → blast furnace + ISP → bullion → refining
(decopperising, Parkes process for Ag, Betterton-Kroll for Bi) → 99.99% Pb.

### 18c · Silver — refinery (Pantnagar)

- 100% green-power electrolytic refinery
- Anode slimes from lead refining → silver bullion → cathode silver
  → 30 kg / 1 kg bars, powder

> **Important:** HZL does **not** use Hall-Héroult electrolysis (that is
> aluminium-specific). Any plant-monitor signal or insight that previously
> referenced Hall-Héroult cells, anode oxidation, PFCs, or DX+ Ultra cells
> belongs in an aluminium codebase, not here.

---

## 19 · How to use this dossier

| Surface | Where to pull from |
|---|---|
| Demo passport bodies | §1 (BPDM), §3d (PCF), §13d (compliance) |
| Console plant-monitor signal targets | §4 (energy intensity), §5 (water intensity), §6 (PM/SOx/NOx), §10 (TRIFR) |
| Portal scorecard cells | §11 (economic), §4-5 (climate/water), §10 (safety) |
| Verifier issue form defaults | §13 (standards) |
| Wizard insight library | §4-7 (technical / compliance) |
| Marketing / lede copy | §1, §3d, §4d (Net Zero), §16 (rankings) |
| README / DEPLOY | §1, §3, §13 |

When in doubt, **cite the source PDF + page number** in code comments so
future readers can verify.
