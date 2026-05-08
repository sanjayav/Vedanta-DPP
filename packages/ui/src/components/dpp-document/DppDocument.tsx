/**
 * Server-rendered Digital Product Passport document for HZL / Chem-X v1.0.
 *
 * Sections (top → bottom):
 *   1. Header           — HZL crest, title, photo, GS1 QR, status
 *   2. Identification   — metal, grade, designation, form, standards
 *   3. Producer         — BPNL, BPDM identifiers, regulatory contact
 *   4. BPN trail        — legal entity → site → (downstream BPNL when present)
 *   5. Origin           — country, manufacturing batch, site cards
 *   6. Physical         — dimensions, mass, packaging
 *   7. Chemistry        — composition table (CAS, role, min/max, method)
 *   8. Six EF 3.1 LCIA  — PCF + 5 categories. The Chem-X hero.
 *   9. PCF breakdown    — stage contributions where reported
 *  10. Recycled / Circ  — recycled content + circularity instructions
 *  11. ESPR / Use       — ESPR Annex III parameters + storage / handling
 *  12. Compliance       — regulations, certifications, LME brand
 *  13. Footer           — issuance, expiry, disclaimer, did:web link
 *
 * The new schema is authoritative. Aluminium-only fields (alloyEn, brand,
 * carbon.valueKgCo2ePerTonne, recycledContent.totalPercent, processFlow) are
 * gone from the live API; this renderer reads only the v1.0.0 HZL fields.
 */

import QRCode from 'qrcode'

import { MarketingBand } from './MarketingBand'

export interface DppDocumentInput {
  /** Canonical DPP body · `dpp/v1.0.0` schema. */
  dpp: Record<string, unknown>
  /** ISO timestamp the passport was issued. */
  issuedAt?: string | null
  /** Whether this is a demo passport (badges a marker on the disclaimer). */
  isDemo?: boolean
}

type Dict = Record<string, unknown>

function asDict(v: unknown): Dict {
  return v && typeof v === 'object' ? (v as Dict) : {}
}
function asArray(v: unknown): Dict[] {
  return Array.isArray(v) ? (v as Dict[]) : []
}
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length === 0 ? null : s
}
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
function fmt(n: number | null, digits = 2): string {
  if (n === null) return '—'
  if (n === 0) return '0'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 1) return n.toFixed(Math.min(digits, 2))
  if (Math.abs(n) >= 0.001) return n.toFixed(Math.min(digits + 1, 4))
  return n.toExponential(2)
}
function humanise(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const COUNTRY_FLAG: Record<string, string> = {
  IN: '🇮🇳', AE: '🇦🇪', DE: '🇩🇪', JP: '🇯🇵', KR: '🇰🇷',
  TW: '🇹🇼', US: '🇺🇸', GB: '🇬🇧', CN: '🇨🇳', SG: '🇸🇬',
  IT: '🇮🇹', FR: '🇫🇷', NL: '🇳🇱', ES: '🇪🇸', BR: '🇧🇷',
}

const LCIA_ORDER: Array<{
  key: string
  title: string
  short: string
  blurb: string
}> = [
  {
    key: 'pcf',
    title: 'Product Carbon Footprint',
    short: 'PCF',
    blurb: 'Climate change · IPCC AR6 GWP100y · ISO 14067:2018',
  },
  {
    key: 'resourceUseFossil',
    title: 'Resource Use · Fossil',
    short: 'RU·F',
    blurb: 'EF 3.1 · Van Oers et al. 2002, LHV-based',
  },
  {
    key: 'waterScarcity',
    title: 'Water Scarcity',
    short: 'WS',
    blurb: 'EF 3.1 · AWARE country resolution',
  },
  {
    key: 'acidification',
    title: 'Acidification',
    short: 'AP',
    blurb: 'EF 3.1 · Accumulated Exceedance',
  },
  {
    key: 'ozoneDepletion',
    title: 'Ozone Depletion',
    short: 'ODP',
    blurb: 'EF 3.1 · WMO 2014 ODP factors',
  },
  {
    key: 'photochemicalOzone',
    title: 'Photochemical Ozone',
    short: 'POCP',
    blurb: 'EF 3.1 · LOTOS-EUROS (Van Zelm 2008)',
  },
]

export async function DppDocument({ dpp }: { dpp: DppDocumentInput }) {
  const body = dpp.dpp
  const materialId = asDict(body.materialId)
  const ident = asDict(body.identification)
  const producer = asDict(body.producer)
  const origin = asDict(body.origin)
  const product = asDict(body.product)
  const physical = asDict(body.physical)
  const chemistry = asDict(body.chemistry)
  const sustainability = asDict(body.sustainability)
  const recycled = asDict(body.recycledContent)
  const compliance = asDict(body.compliance)
  const circularity = asDict(body.circularity)
  const espr = asDict(body.espr)
  const useAndLife = asDict(body.useAndLife)
  const documentation = asDict(body.documentation)
  const meta = asDict(body.meta)

  const tradeName = str(ident.tradeName)
  const gradeCode = str(ident.gradeCode)
  const metal = str(ident.metal)
  const purityPercent = num(ident.purityPercent)
  const designation = str(ident.designation)
  const formRaw = str(ident.form)
  const formLabel = formRaw ? humanise(formRaw) : null
  const standards = asArray(ident.applicableStandards).map((x) => String(x))
    .concat(
      Array.isArray(ident.applicableStandards) && typeof ident.applicableStandards[0] === 'string'
        ? (ident.applicableStandards as string[])
        : [],
    )
  const standardsList = Array.isArray(ident.applicableStandards)
    ? (ident.applicableStandards as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  const titlePrimary = tradeName ?? str(product.name) ?? humanise(metal ?? 'Material')
  const titleSecondary = [gradeCode, designation].filter(Boolean).join(' · ')

  const productionDate = str(origin.manufacturingDate)
  const productionBatch = str(origin.manufacturingBatch)
  const originCountry = str(origin.country)
  const originSubdivision = str(origin.subdivision)
  const sites = asArray(origin.sites)

  const did = str(materialId.did) ?? str(meta.issuerDid) ?? null
  const uuid = str(materialId.uuid)
  const resolverUrl = str(materialId.resolverUrl)
  const issuerDid = str(meta.issuerDid)

  const bpnl = str(producer.bpnl)
  const legalName = str(producer.legalName) ?? 'Hindustan Zinc Limited'
  const shortName = str(producer.shortName) ?? 'HZL'
  const tradeNameProducer = str(producer.tradeName) ?? 'Vedanta · Hindustan Zinc'
  const identifiers = asArray(producer.identifiers)
  const regulatoryContact = asDict(producer.regulatoryContact)

  const issuedAt = str(meta.lastUpdated) ?? dpp.issuedAt ?? null
  const expiresAt = str(meta.expiresAt)
  const lciaValidUntil = str(meta.lciaValidUntil)
  const languages = Array.isArray(meta.languages)
    ? (meta.languages as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  const compositionRows = asArray(chemistry.composition)

  const pcf = asDict(sustainability.pcf)
  const pcfValue = num(pcf.value)
  const pcfUnit = str(pcf.unit) ?? 'kg CO₂e/kg'
  const pcfIndustry = asDict(pcf.industryAverage)
  const pcfIndustryValue = num(pcfIndustry.value)
  const pcfReductionPct =
    pcfIndustryValue !== null && pcfIndustryValue > 0 && pcfValue !== null
      ? Math.round(((pcfIndustryValue - pcfValue) / pcfIndustryValue) * 100)
      : null
  const pcfBreakdown = asDict(sustainability.pcfBreakdown)

  // Product hero photo · demo bodies carry it under media.productImage as
  // /dpp-assets/products/<slug>.jpg (public-viewer mount). Story content
  // gives us a marquee headline + subhead when available.
  const media = asDict(body.media)
  const productImage = str(media.productImage)
  const productImageAlt = str(media.productImageAlt) ?? `${titlePrimary} product photo`
  const story = asDict(body.story)
  const storyHeadline = str(story.headline)
  const storySubhead = str(story.subhead)
  const storyBullets = Array.isArray(story.bullets)
    ? (story.bullets as unknown[]).filter((x): x is string => typeof x === 'string')
    : []

  const renewableElectricityPercent = num(sustainability.renewableElectricityPercent)
  const epd = asDict(sustainability.epd)
  const epdNumber = str(epd.registrationNumber)
  const epdProgramOperator = str(epd.programOperator)
  const epdValidUntil = str(epd.validUntil)
  const epdUrl = str(epd.url)

  const documents = asArray(documentation.documents)

  const regulations = asArray(compliance.regulations)
  const certifications = asArray(compliance.certifications)
  const lmeBrand = asDict(compliance.lmeRegisteredBrand)

  // GS1 Digital Link · server-rendered SVG so the QR paints without JS.
  const digitalLink =
    resolverUrl ??
    (bpnl && uuid
      ? `https://passport.hzlindia.com/dpp/${bpnl}/${uuid}`
      : 'https://passport.hzlindia.com/dpp/sample/ecozen')
  // The QR target is the PDF endpoint — scanning hands the user the
  // self-contained, archival passport. The HTML viewer is still reachable at
  // `digitalLink` for desktop browsing. The PDF lives under /api/ to avoid
  // colliding with the /dpp/[...upi] catch-all that owns the HTML view.
  const qrTarget = digitalLink.replace(/\/dpp\//, '/api/dpp-pdf/')
  const qrSvg = await QRCode.toString(qrTarget, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b2545', light: '#ffffff' },
  })

  return (
    <article className="dpp-doc bg-[var(--color-paper)]">
      <DocStyle />

      {/* 1. Header — top strip with crest + eyebrow + status pills */}
      <header className="dpp-doc__header">
        <div className="dpp-doc__header-strip">
          <div className="dpp-doc__crest">
            <HzlCrest />
            <div>
              <p className="dpp-doc__crest-caption">Issued by</p>
              <p className="dpp-doc__crest-name">{legalName}</p>
            </div>
          </div>
          <div className="dpp-doc__status-bar">
            <span className="dpp-doc__pill dpp-doc__pill--ok">
              <span className="dpp-doc__pulse" />
              Verified · Ed25519
            </span>
            <span className="dpp-doc__pill">Chem-X v1.0</span>
            {dpp.isDemo ? (
              <span className="dpp-doc__pill dpp-doc__pill--demo">Demo</span>
            ) : null}
          </div>
        </div>

        {/* 2. Hero — product photo + title block + headline metric + QR */}
        <section className="dpp-doc__hero">
          <div className="dpp-doc__hero-photo">
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImage}
                alt={productImageAlt}
                className="dpp-doc__hero-photo-img"
                loading="eager"
              />
            ) : (
              <HeroPhotoFallback metal={metal} />
            )}
            {storyHeadline ? (
              <div className="dpp-doc__hero-photo-caption">
                <p>{storyHeadline}</p>
              </div>
            ) : null}
          </div>

          <div className="dpp-doc__hero-body">
            <p className="dpp-doc__eyebrow">
              Digital Product Passport · v1.0 · Chem-X aligned
            </p>
            <h1 className="dpp-doc__title">{titlePrimary}</h1>
            {titleSecondary ? (
              <p className="dpp-doc__subtitle">{titleSecondary}</p>
            ) : null}
            {formLabel || purityPercent !== null ? (
              <p className="dpp-doc__sub-subtitle">
                {[
                  formLabel,
                  purityPercent !== null
                    ? `${fmt(purityPercent, 3)}% purity`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}

            {/* Headline metric — the marquee PCF stat */}
            {pcfValue !== null ? (
              <div className="dpp-doc__hero-metric">
                <p className="dpp-doc__hero-metric-label">
                  Cradle-to-gate carbon footprint
                </p>
                <p className="dpp-doc__hero-metric-value">
                  <span className="dpp-doc__hero-metric-num">
                    {fmt(pcfValue, 3)}
                  </span>
                  <span className="dpp-doc__hero-metric-unit">{pcfUnit}</span>
                </p>
                {pcfReductionPct !== null && pcfReductionPct > 0 ? (
                  <p className="dpp-doc__hero-metric-delta">
                    <strong>~{pcfReductionPct}% below</strong>{' '}
                    {str(pcfIndustry.source) ?? 'industry average'}
                    {pcfIndustryValue !== null ? (
                      <>
                        {' '}
                        <span className="dpp-doc__hero-metric-delta-bench">
                          ({fmt(pcfIndustryValue, 2)} {pcfUnit})
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}

            <ul className="dpp-doc__title-meta">
              {productionBatch ? (
                <li>
                  <span>Batch</span>
                  <code>{productionBatch}</code>
                </li>
              ) : null}
              {productionDate ? (
                <li>
                  <span>Manufactured</span>
                  <code>{productionDate}</code>
                </li>
              ) : null}
              {bpnl ? (
                <li>
                  <span>BPNL</span>
                  <code>{bpnl}</code>
                </li>
              ) : null}
              {uuid ? (
                <li>
                  <span>UUID</span>
                  <code className="dpp-doc__truncate">{uuid}</code>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="dpp-doc__hero-qr">
            <div
              className="dpp-doc__qr-svg"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              aria-label="GS1 Digital Link QR for this passport"
            />
            <p className="dpp-doc__qr-caption">Scan · GS1 Digital Link</p>
          </div>
        </section>

        {storySubhead || storyBullets.length ? (
          <section className="dpp-doc__story">
            {storySubhead ? (
              <p className="dpp-doc__story-subhead">{storySubhead}</p>
            ) : null}
            {storyBullets.length ? (
              <ul className="dpp-doc__story-bullets">
                {storyBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}
      </header>

      {/* Section 01 · Identification */}
      <Section eyebrow="01 · Identification" title="What it is">
        <KvGrid
          rows={[
            ['Material', metal ? humanise(metal) : '—'],
            ['Grade code', gradeCode ?? '—'],
            ['Trade name', tradeName ?? '—'],
            ['Designation', designation ?? '—'],
            ['Purity', purityPercent !== null ? `${fmt(purityPercent, 3)}%` : '—'],
            ['Form', formLabel ?? '—'],
          ]}
        />
        {standardsList.length ? (
          <div className="dpp-doc__chips">
            {standardsList.map((s) => (
              <span key={s} className="dpp-doc__chip">
                {s}
              </span>
            ))}
          </div>
        ) : null}
      </Section>

      {/* Section 02 · Producer */}
      <Section eyebrow="02 · Producer" title="Who issued it">
        <div className="dpp-doc__producer-grid">
          <div>
            <p className="dpp-doc__producer-name">{legalName}</p>
            <p className="dpp-doc__producer-trade">{tradeNameProducer}</p>
            {bpnl ? (
              <p className="dpp-doc__bpn">
                <span>BPNL</span>
                <code>{bpnl}</code>
              </p>
            ) : null}
            {regulatoryContact.team || regulatoryContact.email ? (
              <p className="dpp-doc__contact">
                {str(regulatoryContact.team) ?? 'Regulatory Affairs'}
                {regulatoryContact.email ? (
                  <>
                    {' · '}
                    <a href={`mailto:${str(regulatoryContact.email)}`}>
                      {str(regulatoryContact.email)}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          {identifiers.length ? (
            <table className="dpp-doc__table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Issuer</th>
                </tr>
              </thead>
              <tbody>
                {identifiers.map((id, i) => (
                  <tr key={`${str(id.type) ?? i}-${i}`}>
                    <td>{str(id.type) ?? '—'}</td>
                    <td>
                      <code>{str(id.value) ?? '—'}</code>
                    </td>
                    <td>{str(id.issuingBody) ?? str(id.issuingCountry) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Section>

      {/* Section 03 · Origin · the geographic + temporal answer */}
      <Section eyebrow="03 · Origin" title="Where it came from">
        <KvGrid
          rows={[
            [
              'Country',
              originCountry
                ? `${COUNTRY_FLAG[originCountry] ?? ''} ${originCountry}`.trim()
                : '—',
            ],
            ['Subdivision', originSubdivision ?? '—'],
            ['Manufacturing batch', productionBatch ?? '—'],
            ['Manufacturing date', productionDate ?? '—'],
          ]}
        />
      </Section>

      {/* Section 04 · BPN trail · entity → site (the verifiable chain) */}
      {sites.length ? (
        <Section eyebrow="04 · BPN trail" title="Who’s on the trail">
          <p className="dpp-doc__lede">
            Catena-X CX-0010 BPDM identifies every actor and site on the trail. Each BPN
            resolves to a DID Document published at the issuer&rsquo;s
            <code> /.well-known/did.json</code>.
          </p>
          <ol className="dpp-doc__trail">
            <li className="dpp-doc__trail-node">
              <span className="dpp-doc__trail-pip" aria-hidden />
              <div>
                <p className="dpp-doc__trail-label">Legal entity</p>
                <p className="dpp-doc__trail-value">{legalName}</p>
                {bpnl ? <code className="dpp-doc__trail-code">{bpnl}</code> : null}
              </div>
            </li>
            {sites.map((site, i) => {
              const sBpns = str(site.bpns)
              const sName = str(site.name) ?? '—'
              const sFn = str(site.function)
              const sCountry = str(site.country)
              return (
                <li key={`${sBpns ?? i}-${i}`} className="dpp-doc__trail-node">
                  <span className="dpp-doc__trail-pip" aria-hidden />
                  <div>
                    <p className="dpp-doc__trail-label">
                      {sFn ? humanise(sFn) : 'Site'}
                      {sCountry ? (
                        <span className="dpp-doc__flag">
                          {' '}
                          {COUNTRY_FLAG[sCountry] ?? sCountry}
                        </span>
                      ) : null}
                    </p>
                    <p className="dpp-doc__trail-value">{sName}</p>
                    {sBpns ? <code className="dpp-doc__trail-code">{sBpns}</code> : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </Section>
      ) : null}

      {/* Section 05 · Chemistry · composition before form */}
      {compositionRows.length ? (
        <Section eyebrow="05 · Chemistry" title="What it&rsquo;s made of">
          <table className="dpp-doc__table dpp-doc__table--wide">
            <thead>
              <tr>
                <th>Element</th>
                <th>CAS</th>
                <th>Role</th>
                <th>Min %</th>
                <th>Max %</th>
                <th>Typical %</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {compositionRows.map((row, i) => {
                const min = num(row.guaranteedMinPercent)
                const max = num(row.guaranteedMaxPercent)
                const typical = num(row.typicalAssayPercent)
                return (
                  <tr key={`${str(row.element) ?? i}-${i}`}>
                    <td>
                      <strong>{str(row.element) ?? '—'}</strong>
                    </td>
                    <td>
                      <code>{str(row.casNumber) ?? '—'}</code>
                    </td>
                    <td>{str(row.role) ?? '—'}</td>
                    <td className="tabular">{min !== null ? fmt(min, 4) : '—'}</td>
                    <td className="tabular">{max !== null ? fmt(max, 4) : '—'}</td>
                    <td className="tabular">{typical !== null ? fmt(typical, 4) : '—'}</td>
                    <td className="dpp-doc__small">{str(row.method) ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      ) : null}

      {/* Section 06 · Physical · how the product ships */}
      {Object.keys(physical).length ? (
        <Section eyebrow="06 · Physical" title="How it ships">
          <PhysicalBlock physical={physical} />
        </Section>
      ) : null}

      {/* Section 07 · Six EF 3.1 LCIA · the Chem-X hero */}
      <Section
        eyebrow="07 · Sustainability"
        title="Six EF 3.1 measures"
        lede="Per the Chem-X Sustainability Guideline v1.0. Every category reports its value, declared unit, methodology, data-quality rating, and primary-data share."
      >
        <div className="dpp-doc__lcia-grid">
          {LCIA_ORDER.map((cat) => {
            const c = asDict(sustainability[cat.key])
            return (
              <LciaCard
                key={cat.key}
                title={cat.title}
                short={cat.short}
                blurb={cat.blurb}
                value={num(c.value)}
                unit={str(c.unit)}
                declaredUnit={str(c.declaredUnit)}
                dqr={asDict(c.dataQualityRating)}
                pds={num(c.primaryDataSharePercent)}
                referenceYear={num(c.referenceYear)}
                industryValue={
                  cat.key === 'pcf' ? num(asDict(c.industryAverage).value) : null
                }
                industrySource={
                  cat.key === 'pcf' ? str(asDict(c.industryAverage).source) : null
                }
              />
            )
          })}
        </div>
        {epdNumber ? (
          <p className="dpp-doc__lede dpp-doc__epd">
            Anchored to <strong>{epdNumber}</strong>
            {epdProgramOperator ? <> · {epdProgramOperator}</> : null}
            {epdValidUntil ? <> · valid until {epdValidUntil}</> : null}
            {epdUrl ? (
              <>
                {' · '}
                <a href={epdUrl} target="_blank" rel="noopener noreferrer">
                  view EPD ↗
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {renewableElectricityPercent !== null ? (
          <p className="dpp-doc__lede">
            Renewable electricity share at the gate ·{' '}
            <strong>{fmt(renewableElectricityPercent, 0)}%</strong>
          </p>
        ) : null}
      </Section>

      {/* Section 08 · PCF breakdown */}
      {Object.keys(pcfBreakdown).length ? (
        <Section eyebrow="08 · PCF breakdown" title="Where the carbon comes from">
          <PcfBreakdown breakdown={pcfBreakdown} unit={pcfUnit} total={pcfValue} />
        </Section>
      ) : null}

      {/* Section 09 · Recycled content + circularity */}
      <Section eyebrow="09 · Circularity" title="What happens after use">
        <RecycledBlock recycled={recycled} circularity={circularity} />
      </Section>

      {/* Section 10 · ESPR design profile · durability / reliability / efficiency */}
      {Object.keys(espr).length ? (
        <Section eyebrow="10 · ESPR" title="How it’s designed to last">
          <KvGrid
            rows={[
              ['Durability', str(espr.durability) ?? '—'],
              ['Reliability', str(espr.reliability) ?? '—'],
              ['Reusability', str(espr.reusability) ?? '—'],
              ['Energy efficiency', str(espr.energyEfficiency) ?? '—'],
              ['Resource efficiency', str(espr.resourceEfficiency) ?? '—'],
            ]}
          />
        </Section>
      ) : null}

      {/* Section 11 · Use & Safety · storage / handling / SDS */}
      {Object.keys(useAndLife).length ? (
        <Section eyebrow="11 · Use & Safety" title="How to handle it">
          <div className="dpp-doc__use">
            {str(useAndLife.storageInstructions) ? (
              <p>
                <strong>Storage.</strong> {str(useAndLife.storageInstructions)}
              </p>
            ) : null}
            {str(useAndLife.handlingInstructions) ? (
              <p>
                <strong>Handling.</strong> {str(useAndLife.handlingInstructions)}
              </p>
            ) : null}
            {str(useAndLife.safetyInformation) ? (
              <p>
                <strong>Safety.</strong> {str(useAndLife.safetyInformation)}
              </p>
            ) : null}
            {str(useAndLife.sdsUrl) ? (
              <p>
                <a href={str(useAndLife.sdsUrl) ?? '#'} target="_blank" rel="noopener noreferrer">
                  Safety Data Sheet ↗
                </a>
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Section 12 · Compliance · regulations + certifications */}
      {regulations.length || certifications.length ? (
        <Section eyebrow="12 · Compliance" title="What it conforms to">
          {regulations.length ? (
            <>
              <p className="dpp-doc__sub-eyebrow">Regulations</p>
              <ComplianceTable rows={regulations} />
            </>
          ) : null}
          {certifications.length ? (
            <>
              <p className="dpp-doc__sub-eyebrow">Certifications</p>
              <ComplianceTable rows={certifications} />
            </>
          ) : null}
          {str(lmeBrand.brandName) ? (
            <p className="dpp-doc__lede">
              LME-registered brand · <strong>{str(lmeBrand.brandName)}</strong>
              {str(lmeBrand.url) ? (
                <>
                  {' '}
                  <a href={str(lmeBrand.url) ?? '#'} target="_blank" rel="noopener noreferrer">
                    (LME approved brands ↗)
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </Section>
      ) : null}

      {/* Marketing band · buyer-tier impact, comparison, calculator, share.
          Sits at the end of the technical narrative so the editorial sections
          read top-to-bottom uninterrupted; the marketing summary lands just
          before the issuance/DID footer where a buyer is most ready to act. */}
      <MarketingBand
        body={dpp.dpp}
        resolverUrl={digitalLink}
        productName={titlePrimary}
      />

      {/* Footer · issuance, did, disclaimer */}
      <footer className="dpp-doc__footer">
        <div className="dpp-doc__footer-grid">
          <div className="dpp-doc__footer-col">
            <p className="dpp-doc__footer-eyebrow">Issuance</p>
            <dl className="dpp-doc__footer-dl">
              <div>
                <dt>Issued</dt>
                <dd>{issuedAt?.slice(0, 10) ?? '—'}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{expiresAt?.slice(0, 10) ?? '—'}</dd>
              </div>
              {lciaValidUntil ? (
                <div>
                  <dt>LCIA valid</dt>
                  <dd>{lciaValidUntil}</dd>
                </div>
              ) : null}
              {languages.length ? (
                <div>
                  <dt>Languages</dt>
                  <dd>{languages.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="dpp-doc__footer-col">
            <p className="dpp-doc__footer-eyebrow">Material ID</p>
            <dl className="dpp-doc__footer-dl dpp-doc__footer-dl--did">
              {did ? (
                <div>
                  <dt>DID</dt>
                  <dd>
                    <code className="dpp-doc__footer-did">{did}</code>
                  </dd>
                </div>
              ) : null}
              {issuerDid && issuerDid !== did ? (
                <div>
                  <dt>Issuer</dt>
                  <dd>
                    <code className="dpp-doc__footer-did">{issuerDid}</code>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="dpp-doc__footer-col">
            <p className="dpp-doc__footer-eyebrow">Documents on file</p>
            <div className="dpp-doc__footer-docs">
              <p className="dpp-doc__footer-count">
                {documents.length}
                <span className="dpp-doc__footer-count-suffix">
                  {documents.length === 1 ? 'attachment' : 'attachments'}
                </span>
              </p>
              {documents.length > 0 ? (
                <ul className="dpp-doc__footer-doclist">
                  {documents.slice(0, 4).map((d) => {
                    const doc = asDict(d)
                    const title = str(doc.title) ?? str(doc.id) ?? 'Document'
                    return (
                      <li key={String(doc.id ?? title)} title={title}>
                        <span className="dpp-doc__footer-doctype">
                          {(str(doc.type) ?? 'doc').toUpperCase()}
                        </span>
                        <span className="dpp-doc__footer-doctitle">{title}</span>
                      </li>
                    )
                  })}
                  {documents.length > 4 ? (
                    <li className="dpp-doc__footer-docmore">
                      +{documents.length - 4} more bundled with the passport
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="dpp-doc__footer-hint">
                  No supporting documents attached.
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="dpp-doc__disclaimer">
          {dpp.isDemo
            ? 'This is a demonstration passport. The cryptographic signature is a placeholder; production passports are signed Ed25519 by Hindustan Zinc Limited.'
            : 'Issued by Hindustan Zinc Limited. Cryptographic verification available at the issuer’s /.well-known/did.json endpoint.'}
        </p>
      </footer>
    </article>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section className="dpp-doc__section">
      <header className="dpp-doc__section-head">
        <p className="dpp-doc__eyebrow">{eyebrow}</p>
        <h2 className="dpp-doc__h2">{title}</h2>
        {lede ? <p className="dpp-doc__lede">{lede}</p> : null}
      </header>
      <div className="dpp-doc__section-body">{children}</div>
    </section>
  )
}

function KvGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="dpp-doc__kv">
      {rows.map(([k, v]) => (
        <div key={k} className="dpp-doc__kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function HeroPhotoFallback({ metal }: { metal: string | null }) {
  // Soft gradient + abstract bar/ingot shape so the hero never breaks when
  // a product carries no media.productImage.
  const m = metal?.toLowerCase() ?? 'zinc'
  const gradient =
    m === 'lead'
      ? 'linear-gradient(135deg, #475569 0%, #1e293b 100%)'
      : m === 'silver'
        ? 'linear-gradient(135deg, #cbd5e1 0%, #475569 100%)'
        : 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)'
  return (
    <div className="dpp-doc__hero-photo-fallback" style={{ background: gradient }} aria-hidden>
      <svg viewBox="0 0 200 120" className="dpp-doc__hero-photo-fallback-svg">
        <defs>
          <linearGradient id="hpf-gloss" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </linearGradient>
        </defs>
        {/* Stylised ingot block */}
        <path
          d="M30 60 L46 40 L154 40 L170 60 L154 80 L46 80 Z"
          fill="url(#hpf-gloss)"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="0.6"
        />
        <path d="M46 40 L154 40 L150 50 L50 50 Z" fill="rgba(255,255,255,0.16)" />
      </svg>
    </div>
  )
}

function HzlCrest() {
  return (
    <svg viewBox="0 0 64 64" className="dpp-doc__crest-mark" aria-hidden>
      <defs>
        <linearGradient id="dpp-doc-crest-fill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#0e7c5a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
      </defs>
      <path
        d="M32 6 L54 18 L54 42 L32 56 L10 42 L10 18 Z"
        fill="url(#dpp-doc-crest-fill)"
      />
      <path
        d="M14 41 L24 35 L32 38 L40 35 L50 41"
        stroke="#d9a441"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <text
        x="32"
        y="29"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="13"
        fontWeight="600"
        fill="#fff"
      >
        HZL
      </text>
    </svg>
  )
}

function PhysicalBlock({ physical }: { physical: Dict }) {
  const dim = asDict(physical.dimensions)
  const bdim = asDict(physical.bundleDimensions)
  const pkg = asDict(physical.packaging)
  const unitMass = num(physical.unitMassKg)
  const unitTol = num(physical.unitMassToleranceKg)
  const bundleMass = num(physical.bundleMassKg)
  const bundleTol = num(physical.bundleMassToleranceKg)
  const unitsPerBundle = num(physical.unitsPerBundle)

  const dimsStr = (d: Dict): string => {
    const l = num(d.lengthMm)
    const w = num(d.widthMm)
    const h = num(d.heightMm)
    const tol = str(d.tolerance)
    if (l === null && w === null && h === null) return '—'
    const base = `${l ?? '—'} × ${w ?? '—'} × ${h ?? '—'} mm`
    return tol ? `${base} (${tol})` : base
  }

  return (
    <div className="dpp-doc__physical-grid">
      <KvGrid
        rows={[
          ['Unit mass', unitMass !== null ? `${fmt(unitMass)} kg${unitTol !== null ? ` ±${fmt(unitTol)}` : ''}` : '—'],
          ['Bundle mass', bundleMass !== null ? `${fmt(bundleMass)} kg${bundleTol !== null ? ` ±${fmt(bundleTol)}` : ''}` : '—'],
          ['Units / bundle', unitsPerBundle !== null ? String(unitsPerBundle) : '—'],
          ['Unit dimensions', dimsStr(dim)],
          ['Bundle dimensions', dimsStr(bdim)],
        ]}
      />
      {Object.keys(pkg).length ? (
        <div className="dpp-doc__packaging">
          <p className="dpp-doc__sub-eyebrow">Packaging</p>
          <ul>
            {str(pkg.strapMaterial) ? <li>Strap · {str(pkg.strapMaterial)}</li> : null}
            {pkg.palletised === true ? <li>Palletised</li> : null}
            {str(pkg.markings) ? <li>Markings · {str(pkg.markings)}</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function LciaCard({
  title,
  short,
  blurb,
  value,
  unit,
  declaredUnit,
  dqr,
  pds,
  referenceYear,
  industryValue,
  industrySource,
}: {
  title: string
  short: string
  blurb: string
  value: number | null
  unit: string | null
  declaredUnit: string | null
  dqr: Dict
  pds: number | null
  referenceYear: number | null
  industryValue: number | null
  industrySource: string | null
}) {
  const overall = num(dqr.overall)
  const reductionPct =
    industryValue !== null && industryValue > 0 && value !== null
      ? Math.round(((industryValue - value) / industryValue) * 100)
      : null

  return (
    <div className={`dpp-doc__lcia${value === null ? ' dpp-doc__lcia--empty' : ''}`}>
      <div className="dpp-doc__lcia-head">
        <span className="dpp-doc__lcia-short">{short}</span>
        <span className="dpp-doc__lcia-title">{title}</span>
      </div>
      <p className="dpp-doc__lcia-value">
        <span className="dpp-doc__lcia-num">{value !== null ? fmt(value, 3) : '—'}</span>
        <span className="dpp-doc__lcia-unit">{unit ?? ''}</span>
      </p>
      <p className="dpp-doc__lcia-blurb">{blurb}</p>
      {reductionPct !== null && reductionPct > 0 ? (
        <p className="dpp-doc__lcia-delta">
          <strong>~{reductionPct}% below</strong>{' '}
          {industrySource ?? 'industry average'}
          {industryValue !== null ? (
            <>
              {' '}
              ({fmt(industryValue, 2)} {unit ?? ''})
            </>
          ) : null}
        </p>
      ) : null}
      <dl className="dpp-doc__lcia-meta">
        {overall !== null ? (
          <div>
            <dt>DQR</dt>
            <dd>
              {overall.toFixed(1)} / 5{' '}
              <span className="dpp-doc__lcia-dqr-bar" aria-hidden>
                <span style={{ width: `${(overall / 5) * 100}%` }} />
              </span>
            </dd>
          </div>
        ) : null}
        {pds !== null ? (
          <div>
            <dt>Primary data</dt>
            <dd>{fmt(pds, 0)}%</dd>
          </div>
        ) : null}
        {referenceYear !== null ? (
          <div>
            <dt>Year</dt>
            <dd>{referenceYear}</dd>
          </div>
        ) : null}
      </dl>
      {declaredUnit ? <p className="dpp-doc__lcia-decl">{declaredUnit}</p> : null}
    </div>
  )
}

function PcfBreakdown({
  breakdown,
  unit,
  total,
}: {
  breakdown: Dict
  unit: string
  total: number | null
}) {
  const labels: Record<string, string> = {
    miningKgCo2e: 'Mining',
    concentrationKgCo2e: 'Concentration',
    smeltingKgCo2e: 'Smelting',
    refiningKgCo2e: 'Refining',
    castingKgCo2e: 'Casting',
    electricityKgCo2e: 'Electricity',
    thermalEnergyKgCo2e: 'Thermal energy',
    transportInboundKgCo2e: 'Inbound transport',
  }
  const rows = Object.entries(breakdown)
    .map(([k, v]) => ({ key: k, label: labels[k] ?? humanise(k.replace(/KgCo2e$/, '')), value: num(v) }))
    .filter((r) => r.value !== null && r.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.value ?? 0))

  return (
    <div className="dpp-doc__pcf">
      {rows.map((r) => (
        <div key={r.key} className="dpp-doc__pcf-row">
          <span className="dpp-doc__pcf-label">{r.label}</span>
          <span className="dpp-doc__pcf-bar" aria-hidden>
            <span style={{ width: `${((r.value ?? 0) / max) * 100}%` }} />
          </span>
          <span className="dpp-doc__pcf-val tabular">
            {fmt(r.value, 3)} {unit}
          </span>
        </div>
      ))}
      {total !== null ? (
        <p className="dpp-doc__pcf-total">
          Total · <strong>{fmt(total, 3)}</strong> {unit}
        </p>
      ) : null}
    </div>
  )
}

function RecycledBlock({ recycled, circularity }: { recycled: Dict; circularity: Dict }) {
  const total = num(recycled.totalPercent)
  const pre = num(recycled.preConsumerPercent)
  const post = num(recycled.postConsumerPercent)
  const coc = str(recycled.chainOfCustodyModel)
  return (
    <div className="dpp-doc__recycled-grid">
      <div className="dpp-doc__recycled">
        <p className="dpp-doc__sub-eyebrow">Recycled content</p>
        <p className="dpp-doc__recycled-num">{total !== null ? `${fmt(total, 0)}%` : '—'}</p>
        <ul className="dpp-doc__recycled-split">
          <li>
            <span>Pre-consumer</span>
            <span className="tabular">{pre !== null ? `${fmt(pre, 1)}%` : '—'}</span>
          </li>
          <li>
            <span>Post-consumer</span>
            <span className="tabular">{post !== null ? `${fmt(post, 1)}%` : '—'}</span>
          </li>
          {coc ? (
            <li>
              <span>Chain of custody</span>
              <span>{humanise(coc)}</span>
            </li>
          ) : null}
        </ul>
      </div>
      <div className="dpp-doc__circularity">
        <p className="dpp-doc__sub-eyebrow">Circularity</p>
        <ul>
          {str(circularity.recyclabilityIndicator) ? (
            <li>
              <strong>Recyclability.</strong> {str(circularity.recyclabilityIndicator)}
            </li>
          ) : null}
          {str(circularity.materialRecoveryPotential) ? (
            <li>
              <strong>Recovery.</strong> {str(circularity.materialRecoveryPotential)}
            </li>
          ) : null}
          {str(circularity.reuseInformation) ? (
            <li>
              <strong>Reuse.</strong> {str(circularity.reuseInformation)}
            </li>
          ) : null}
          {str(circularity.recyclingInformation) ? (
            <li>
              <strong>Recycling.</strong> {str(circularity.recyclingInformation)}
            </li>
          ) : null}
          {str(circularity.disposalInformation) ? (
            <li>
              <strong>Disposal.</strong> {str(circularity.disposalInformation)}
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

function ComplianceTable({ rows }: { rows: Dict[] }) {
  return (
    <table className="dpp-doc__table dpp-doc__table--wide">
      <thead>
        <tr>
          <th>Name</th>
          <th>Reference</th>
          <th>Status</th>
          <th>Issuer</th>
          <th>Valid</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const status = str(r.status)
          const valid = [str(r.validFrom), str(r.validUntil)].filter(Boolean).join(' → ')
          return (
            <tr key={`${str(r.name) ?? i}-${i}`}>
              <td>
                <strong>{str(r.name) ?? '—'}</strong>
              </td>
              <td className="dpp-doc__small">{str(r.reference) ?? '—'}</td>
              <td>
                {status ? (
                  <span
                    className={`dpp-doc__pill dpp-doc__pill--${
                      status === 'compliant' ? 'ok' : 'neutral'
                    }`}
                  >
                    {humanise(status)}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="dpp-doc__small">{str(r.issuer) ?? '—'}</td>
              <td className="dpp-doc__small">{valid || '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

function DocStyle() {
  return <style>{DOC_CSS}</style>
}

const DOC_CSS = `
.dpp-doc {
  --doc-ink: var(--fg-headline, #0b2545);
  --doc-muted: var(--fg-muted, #475569);
  --doc-subtle: var(--fg-subtle, #94a3b8);
  --doc-border: var(--surface-border, rgba(11, 37, 69, 0.12));
  --doc-recessed: var(--surface-recessed, #f7f4ec);
  --doc-accent: var(--color-trail-amber-deep, #b97f1e);
  --doc-green: var(--color-vedanta-green, #0e7c5a);
  font-family: var(--font-sans, Inter, system-ui, sans-serif);
  color: var(--doc-ink);
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
}
.dpp-doc__truncate { word-break: break-all; max-width: 100%; }
.dpp-doc__small { font-size: 12px; color: var(--doc-muted); }

.dpp-doc__header {
  padding: 32px 0 28px;
  border-bottom: 1px solid var(--doc-border);
}

/* Top strip · crest left, status pills right */
.dpp-doc__header-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 24px;
  border-bottom: 1px dashed var(--doc-border);
  margin-bottom: 28px;
}
.dpp-doc__crest {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.dpp-doc__crest-mark { width: 48px; height: 48px; flex-shrink: 0; }
.dpp-doc__crest-caption {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 9.5px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--doc-subtle);
  margin: 0;
}
.dpp-doc__crest-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--doc-ink);
  margin: 2px 0 0;
}

/* Hero · product photo left, title block centre, QR right */
.dpp-doc__hero {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) auto;
  gap: 32px;
  align-items: center;
}
@media (max-width: 960px) {
  .dpp-doc__hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 24px;
  }
}

.dpp-doc__hero-photo {
  position: relative;
  aspect-ratio: 4 / 3;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: var(--doc-recessed);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 16px 32px -16px rgba(15, 23, 42, 0.18);
}
.dpp-doc__hero-photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dpp-doc__hero-photo-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
}
.dpp-doc__hero-photo-fallback-svg {
  width: 70%;
  height: auto;
}
.dpp-doc__hero-photo-caption {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  padding: 14px 16px;
  background: linear-gradient(180deg, rgba(11, 37, 69, 0) 0%, rgba(11, 37, 69, 0.78) 100%);
  color: #fff;
}
.dpp-doc__hero-photo-caption p {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-style: italic;
  font-size: 14px;
  line-height: 1.3;
  margin: 0;
}

.dpp-doc__hero-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.dpp-doc__hero-metric {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(14, 124, 90, 0.06) 0%, rgba(14, 124, 90, 0.02) 100%);
  border: 1px solid rgba(14, 124, 90, 0.18);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dpp-doc__hero-metric-label {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--doc-green);
  font-weight: 700;
  margin: 0;
}
.dpp-doc__hero-metric-value {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 2px 0 0;
}
.dpp-doc__hero-metric-num {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-size: 38px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--doc-ink);
  font-variant-numeric: tabular-nums;
}
.dpp-doc__hero-metric-unit {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 13px;
  color: var(--doc-muted);
}
.dpp-doc__hero-metric-delta {
  font-size: 13px;
  color: var(--doc-green);
  margin: 4px 0 0;
  line-height: 1.45;
}
.dpp-doc__hero-metric-delta strong { font-weight: 600; }
.dpp-doc__hero-metric-delta-bench {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px;
  color: var(--doc-muted);
}

.dpp-doc__hero-qr { display: flex; flex-direction: column; align-items: center; gap: 8px; }
@media (max-width: 960px) {
  .dpp-doc__hero-qr { align-self: flex-start; }
}

/* Story ribbon — quote-style subhead + bullet list */
.dpp-doc__story {
  margin-top: 28px;
  padding: 22px 24px;
  border-radius: 12px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--doc-accent) 8%, var(--doc-recessed)) 0%,
    var(--doc-recessed) 100%);
  border: 1px solid var(--doc-border);
}
.dpp-doc__story-subhead {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-style: italic;
  font-size: 17px;
  line-height: 1.5;
  color: var(--doc-ink);
  margin: 0;
}
.dpp-doc__story-bullets {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px 24px;
}
.dpp-doc__story-bullets li {
  position: relative;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--doc-muted);
}
.dpp-doc__story-bullets li::before {
  content: '';
  position: absolute;
  left: 0; top: 8px;
  width: 8px; height: 8px;
  border-radius: 9999px;
  background: var(--doc-accent);
  opacity: 0.7;
}
.dpp-doc__eyebrow {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--doc-subtle);
  margin: 0;
}
.dpp-doc__title {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-weight: 400;
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 8px 0 0;
  color: var(--doc-ink);
}
.dpp-doc__subtitle {
  font-size: 18px; color: var(--doc-muted); margin: 6px 0 0;
}
.dpp-doc__sub-subtitle { font-size: 14px; color: var(--doc-subtle); margin: 4px 0 0; }
.dpp-doc__title-meta {
  list-style: none; padding: 0; margin: 18px 0 0;
  display: flex; flex-wrap: wrap; gap: 18px;
}
.dpp-doc__title-meta li {
  display: flex; flex-direction: column; gap: 2px;
}
.dpp-doc__title-meta span {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--doc-subtle);
}
.dpp-doc__title-meta code {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 12px; color: var(--doc-ink); background: var(--doc-recessed);
  padding: 4px 8px; border-radius: 4px;
}
.dpp-doc__qr { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dpp-doc__qr-svg { width: 120px; height: 120px; padding: 8px; background: #fff; border: 1px solid var(--doc-border); border-radius: 6px; }
.dpp-doc__qr-svg svg { width: 100%; height: 100%; display: block; }
.dpp-doc__qr-caption {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--doc-subtle);
}

.dpp-doc__status-bar {
  margin-top: 24px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.dpp-doc__pill {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px; padding: 5px 10px; border-radius: 999px;
  background: var(--doc-recessed); color: var(--doc-muted);
  border: 1px solid var(--doc-border);
}
.dpp-doc__pill--ok { background: rgba(14, 124, 90, 0.1); color: var(--doc-green); border-color: rgba(14, 124, 90, 0.25); }
.dpp-doc__pill--demo { background: rgba(217, 164, 65, 0.15); color: var(--doc-accent); border-color: rgba(217, 164, 65, 0.4); }
.dpp-doc__pill--neutral { background: var(--doc-recessed); color: var(--doc-muted); }
.dpp-doc__pulse {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--doc-green); box-shadow: 0 0 0 0 rgba(14, 124, 90, 0.7);
  animation: dpp-doc-pulse 2.4s ease-out infinite;
}
@keyframes dpp-doc-pulse {
  0% { box-shadow: 0 0 0 0 rgba(14, 124, 90, 0.7); }
  70% { box-shadow: 0 0 0 8px rgba(14, 124, 90, 0); }
  100% { box-shadow: 0 0 0 0 rgba(14, 124, 90, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .dpp-doc__pulse { animation: none; }
}

.dpp-doc__section {
  padding: 64px 0;
  border-bottom: 1px solid var(--doc-border);
}
.dpp-doc__section:last-of-type {
  border-bottom: none;
}
.dpp-doc__section-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 32px;
  padding-bottom: 22px;
  border-bottom: 1px solid rgba(11, 37, 69, 0.06);
  max-width: 720px;
}
.dpp-doc__section-head .dpp-doc__eyebrow {
  color: var(--doc-green, #0e7c5a);
  font-weight: 700;
  letter-spacing: 0.22em;
}
.dpp-doc__h2 {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-weight: 400; font-size: clamp(26px, 3.5vw, 36px); line-height: 1.1;
  letter-spacing: -0.015em; margin: 6px 0 0; color: var(--doc-ink);
}
.dpp-doc__lede {
  font-size: 14px; line-height: 1.6; color: var(--doc-muted); margin: 14px 0 0; max-width: 640px;
}
.dpp-doc__sub-eyebrow {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--doc-subtle); margin: 24px 0 8px;
}

.dpp-doc__kv {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 32px;
  margin: 0;
  padding: 8px 0;
}
@media (max-width: 880px) { .dpp-doc__kv { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .dpp-doc__kv { grid-template-columns: 1fr; } }
.dpp-doc__kv-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-left: 14px;
  border-left: 1px solid rgba(11, 37, 69, 0.08);
}
.dpp-doc__kv-row dt {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  font-weight: 700;
}
.dpp-doc__kv-row dd {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--doc-ink);
  line-height: 1.4;
}

.dpp-doc__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
  padding-top: 22px;
  border-top: 1px dashed rgba(11, 37, 69, 0.10);
}
.dpp-doc__chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 11px;
  border-radius: 9999px;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--doc-recessed, #fafaf6);
  color: var(--doc-ink);
  border: 1px solid var(--doc-border);
}

.dpp-doc__producer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
  gap: 40px;
  align-items: start;
}
@media (max-width: 880px) { .dpp-doc__producer-grid { grid-template-columns: 1fr; gap: 28px; } }
.dpp-doc__producer-name {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.014em;
  margin: 0;
  color: var(--doc-ink);
  line-height: 1.15;
}
.dpp-doc__producer-trade {
  color: var(--doc-muted);
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.45;
}
.dpp-doc__bpn {
  margin: 18px 0 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dpp-doc__bpn span {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  font-weight: 700;
}
.dpp-doc__bpn code {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 13px;
  padding: 5px 10px;
  border-radius: 5px;
  background: linear-gradient(135deg, #0e7c5a 0%, #0b2545 100%);
  color: #fff;
  letter-spacing: 0.02em;
}
.dpp-doc__contact {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--doc-muted);
  line-height: 1.5;
}
.dpp-doc__contact a { color: var(--doc-accent); }

.dpp-doc__table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.dpp-doc__table--wide { font-size: 12.5px; }
.dpp-doc__table th {
  text-align: left;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  padding: 12px 14px;
  background: var(--doc-recessed, #fafaf6);
  border-bottom: 1px solid var(--doc-border);
}
.dpp-doc__table th:first-child { border-top-left-radius: 8px; }
.dpp-doc__table th:last-child  { border-top-right-radius: 8px; }
.dpp-doc__table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(11, 37, 69, 0.06);
  vertical-align: middle;
  line-height: 1.4;
}
.dpp-doc__table tbody tr:last-child td { border-bottom: 0; }
.dpp-doc__table tbody tr {
  transition: background 150ms ease;
}
.dpp-doc__table tbody tr:hover {
  background: rgba(14, 124, 90, 0.03);
}
.dpp-doc__table td code {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 12px; color: var(--doc-ink);
}
.tabular { font-variant-numeric: tabular-nums; }

.dpp-doc__trail {
  list-style: none; padding: 0; margin: 24px 0 0;
  display: flex; flex-direction: column; gap: 0;
  position: relative;
}
.dpp-doc__trail-node {
  display: grid; grid-template-columns: 24px 1fr; gap: 12px; align-items: start;
  padding: 12px 0; position: relative;
}
.dpp-doc__trail-node::before {
  content: ''; position: absolute; left: 11px; top: 28px; bottom: -12px;
  width: 2px; background: var(--doc-border);
}
.dpp-doc__trail-node:last-child::before { display: none; }
.dpp-doc__trail-pip {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--doc-green); border: 3px solid var(--doc-recessed);
  box-shadow: 0 0 0 1px var(--doc-green);
  margin-top: 4px; margin-left: 5px;
}
.dpp-doc__trail-label {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
  color: var(--doc-subtle); margin: 0;
}
.dpp-doc__trail-value { font-size: 15px; margin: 4px 0 0; color: var(--doc-ink); font-weight: 500; }
.dpp-doc__trail-code {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 12px; padding: 3px 6px; margin-top: 6px; display: inline-block;
  background: var(--doc-recessed); border-radius: 4px; color: var(--doc-muted);
}
.dpp-doc__flag { font-size: 14px; }

.dpp-doc__physical-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 32px; }
@media (max-width: 720px) { .dpp-doc__physical-grid { grid-template-columns: 1fr; } }
.dpp-doc__packaging ul { list-style: none; padding: 0; margin: 8px 0 0; font-size: 13px; color: var(--doc-muted); }
.dpp-doc__packaging li { padding: 4px 0; border-bottom: 1px dashed var(--doc-border); }

.dpp-doc__lcia-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 880px) {
  .dpp-doc__lcia-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .dpp-doc__lcia-grid { grid-template-columns: 1fr; }
}
.dpp-doc__lcia {
  border: 1px solid var(--doc-border); border-radius: 10px; padding: 18px;
  background: #fff;
  display: flex; flex-direction: column; gap: 12px;
  min-height: 232px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease;
}
.dpp-doc__lcia:hover {
  border-color: rgba(14, 124, 90, 0.25);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 14px 24px -16px rgba(15, 23, 42, 0.18);
  transform: translateY(-2px);
}
@media (prefers-reduced-motion: reduce) {
  .dpp-doc__lcia { transition: none; }
  .dpp-doc__lcia:hover { transform: none; }
}
.dpp-doc__lcia--empty { opacity: 0.55; }
.dpp-doc__lcia-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.dpp-doc__lcia-short {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11px; padding: 3px 8px; border-radius: 4px;
  background: var(--doc-ink); color: #fff; letter-spacing: 0.05em;
}
.dpp-doc__lcia-title { font-size: 14px; font-weight: 500; color: var(--doc-ink); }
.dpp-doc__lcia-value { display: flex; align-items: baseline; gap: 8px; margin: 0; }
.dpp-doc__lcia-num {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-size: 38px; font-weight: 500; line-height: 1; letter-spacing: -0.02em;
  color: var(--doc-ink); font-variant-numeric: tabular-nums;
}
.dpp-doc__lcia-unit {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 12px; color: var(--doc-muted);
}
.dpp-doc__lcia-blurb { font-size: 12px; color: var(--doc-subtle); margin: 0; line-height: 1.5; }
.dpp-doc__lcia-delta {
  font-size: 13px; color: var(--doc-green); margin: 0; line-height: 1.5;
}
.dpp-doc__lcia-meta {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
  margin: 0; padding-top: 10px; border-top: 1px dashed var(--doc-border);
}
.dpp-doc__lcia-meta div { display: flex; flex-direction: column; gap: 3px; }
.dpp-doc__lcia-meta dt {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--doc-subtle);
}
.dpp-doc__lcia-meta dd { margin: 0; font-size: 12px; color: var(--doc-ink); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 6px; }
.dpp-doc__lcia-dqr-bar {
  display: inline-block; width: 36px; height: 4px; background: var(--doc-recessed); border-radius: 2px; overflow: hidden;
}
.dpp-doc__lcia-dqr-bar span { display: block; height: 100%; background: var(--doc-green); }
.dpp-doc__lcia-decl { font-size: 11px; color: var(--doc-subtle); margin: 0; line-height: 1.5; font-style: italic; }
.dpp-doc__epd { padding: 14px; background: var(--doc-recessed); border-radius: 6px; margin-top: 18px; }
.dpp-doc__epd a { color: var(--doc-accent); }

.dpp-doc__pcf { display: flex; flex-direction: column; gap: 10px; }
.dpp-doc__pcf-row { display: grid; grid-template-columns: 160px 1fr 140px; align-items: center; gap: 16px; }
@media (max-width: 640px) { .dpp-doc__pcf-row { grid-template-columns: 1fr; gap: 4px; } }
.dpp-doc__pcf-label { font-size: 13px; color: var(--doc-muted); }
.dpp-doc__pcf-bar { height: 8px; background: var(--doc-recessed); border-radius: 4px; overflow: hidden; }
.dpp-doc__pcf-bar span { display: block; height: 100%; background: var(--doc-green); }
.dpp-doc__pcf-val { font-size: 12px; color: var(--doc-ink); text-align: right; font-family: var(--font-mono, JetBrains Mono, monospace); }
.dpp-doc__pcf-total { margin-top: 14px; font-size: 14px; color: var(--doc-ink); }

.dpp-doc__recycled-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 32px; }
@media (max-width: 720px) { .dpp-doc__recycled-grid { grid-template-columns: 1fr; } }
.dpp-doc__recycled-num {
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-size: 64px; font-weight: 500; letter-spacing: -0.03em; line-height: 1;
  color: var(--doc-ink); margin: 0;
}
.dpp-doc__recycled-split { list-style: none; padding: 0; margin: 18px 0 0; }
.dpp-doc__recycled-split li {
  display: flex; justify-content: space-between; padding: 8px 0;
  border-bottom: 1px dashed var(--doc-border);
  font-size: 13px; color: var(--doc-muted);
}
.dpp-doc__circularity ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.dpp-doc__circularity li { font-size: 13px; line-height: 1.6; color: var(--doc-muted); }
.dpp-doc__circularity strong { color: var(--doc-ink); margin-right: 4px; }

.dpp-doc__use { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
.dpp-doc__use p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--doc-muted); }
.dpp-doc__use strong { color: var(--doc-ink); margin-right: 4px; }
.dpp-doc__use a { color: var(--doc-accent); }

.dpp-doc__footer {
  padding: 56px 0 72px;
  background: linear-gradient(180deg, transparent 0%, rgba(11, 37, 69, 0.02) 100%);
  border-top: 1px solid var(--doc-border);
}
.dpp-doc__footer-grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1.5fr;
  gap: 48px;
  align-items: start;
}
@media (max-width: 880px) {
  .dpp-doc__footer-grid { grid-template-columns: 1fr; gap: 32px; }
}
.dpp-doc__footer-col {
  min-width: 0;
}
.dpp-doc__footer-eyebrow {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  font-weight: 700;
  margin: 0 0 16px;
}
.dpp-doc__footer-dl {
  margin: 0;
  display: grid;
  gap: 10px;
}
.dpp-doc__footer-dl > div {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 14px;
  align-items: baseline;
}
.dpp-doc__footer-dl--did > div {
  grid-template-columns: 64px minmax(0, 1fr);
}
.dpp-doc__footer-dl dt {
  color: var(--doc-subtle);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-weight: 700;
}
.dpp-doc__footer-dl dd {
  margin: 0;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 12.5px;
  color: var(--doc-ink);
  font-variant-numeric: tabular-nums;
  min-width: 0;
}
.dpp-doc__footer-did {
  display: block;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 11.5px;
  color: var(--doc-ink);
  word-break: break-all;
  line-height: 1.5;
}
.dpp-doc__footer-docs {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dpp-doc__footer-count {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-family: var(--font-display, Fraunces, Inter, serif);
  font-size: 38px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--doc-ink);
  font-variant-numeric: tabular-nums;
}
.dpp-doc__footer-count-suffix {
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  font-weight: 600;
}
.dpp-doc__footer-doclist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--doc-border);
  padding-top: 12px;
}
.dpp-doc__footer-doclist li {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  font-size: 12px;
  color: var(--doc-ink);
  line-height: 1.45;
}
.dpp-doc__footer-doctype {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 9999px;
  background: rgba(11, 37, 69, 0.05);
  border: 1px solid var(--doc-border);
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 9.5px;
  letter-spacing: 0.14em;
  font-weight: 700;
  color: var(--doc-subtle);
  width: max-content;
}
.dpp-doc__footer-doctitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  color: var(--doc-ink);
}
.dpp-doc__footer-docmore {
  grid-template-columns: 1fr !important;
  font-family: var(--font-mono, JetBrains Mono, monospace);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--doc-subtle);
  padding-top: 4px;
}
.dpp-doc__footer-hint {
  font-size: 12px;
  color: var(--doc-muted);
  margin: 0;
  line-height: 1.55;
}
.dpp-doc__disclaimer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--doc-border);
  font-size: 11.5px;
  font-style: italic;
  color: var(--doc-subtle);
  line-height: 1.65;
  max-width: 720px;
}
`
