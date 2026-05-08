/**
 * Premium PDF rendition of the public DPP passport.
 *
 * Renders the same data as the HTML viewer but laid out for A4 print —
 * editorial typography, single-column hero, then dense sections with proper
 * page breaks. Uses @react-pdf/renderer (no headless browser dependency).
 *
 * Server-only — imported from the /dpp/[...upi]/dpp.pdf route handler.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  Font,
} from '@react-pdf/renderer'

import type { ViewerDpp } from '@/lib/dpp-client'

// ── Type helpers ──────────────────────────────────────────────────────────
type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {}
const asArray = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : [])
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : typeof v === 'number' ? String(v) : null
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
const fmt = (n: number | null, d = 2): string => {
  if (n === null) return '—'
  if (n === 0) return '0'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 1) return n.toFixed(Math.min(d, 2))
  if (Math.abs(n) >= 0.001) return n.toFixed(Math.min(d + 1, 4))
  return n.toExponential(2)
}

// ── Colors ────────────────────────────────────────────────────────────────
const ink = '#0B2545'
const muted = '#3F5779'
const subtle = '#7A8AA3'
const border = '#D9E0EA'
const paper = '#FFFFFF'
const wash = '#F4F6FA'
const accent = '#3D7A4B'
const amber = '#B8732A'

// ── Stylesheet ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: ink,
    backgroundColor: paper,
    lineHeight: 1.45,
  },

  // ── Header / Footer (running) ───────────────────────────────────────────
  runHeader: {
    position: 'absolute',
    top: 22,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 7.5,
    color: subtle,
    letterSpacing: 1.2,
  },
  runFooter: {
    position: 'absolute',
    bottom: 26,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: 7,
    color: subtle,
    letterSpacing: 1.1,
    paddingTop: 8,
    borderTopWidth: 0.6,
    borderTopColor: border,
  },

  // ── Cover ───────────────────────────────────────────────────────────────
  coverEyebrow: {
    fontSize: 8.5,
    letterSpacing: 2.5,
    color: accent,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coverWordmark: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: ink,
    letterSpacing: 2.2,
    marginBottom: 28,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Times-Roman',
    color: ink,
    lineHeight: 1.15,
    marginBottom: 12,
  },
  coverSubtitle: {
    fontSize: 13,
    color: muted,
    fontFamily: 'Times-Italic',
    marginBottom: 24,
    lineHeight: 1.4,
  },

  coverHero: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 24,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: 1.2,
    borderTopColor: ink,
    borderBottomWidth: 0.6,
    borderBottomColor: border,
  },
  coverHeroLeft: { flex: 1, paddingRight: 24 },
  coverHeroRight: { width: 156, alignItems: 'flex-end' },

  pcfLabel: {
    fontSize: 7.5,
    letterSpacing: 1.6,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pcfValue: {
    fontSize: 36,
    fontFamily: 'Times-Roman',
    color: ink,
    lineHeight: 1,
    marginBottom: 6,
  },
  pcfUnit: {
    fontSize: 9,
    color: muted,
    fontFamily: 'Helvetica',
    marginBottom: 10,
  },
  pcfFootnote: {
    fontSize: 8,
    color: muted,
    lineHeight: 1.5,
    fontFamily: 'Times-Italic',
  },

  qrBox: {
    padding: 8,
    borderWidth: 0.8,
    borderColor: border,
    borderRadius: 4,
    backgroundColor: paper,
    width: 124,
    alignItems: 'center',
  },
  qrImg: { width: 108, height: 108 },
  qrCaption: {
    marginTop: 6,
    fontSize: 7,
    color: subtle,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },

  // ── Section / generic ───────────────────────────────────────────────────
  section: { marginTop: 22 },
  sectionEyebrow: {
    fontSize: 7.5,
    letterSpacing: 2,
    color: accent,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Times-Roman',
    color: ink,
    marginBottom: 4,
    lineHeight: 1.2,
  },
  sectionDivider: {
    borderBottomWidth: 0.6,
    borderBottomColor: border,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionLede: {
    fontSize: 9,
    color: muted,
    fontFamily: 'Times-Italic',
    lineHeight: 1.5,
    marginBottom: 12,
  },

  // ── KV grid ─────────────────────────────────────────────────────────────
  kvGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  kvItem: {
    width: '50%',
    paddingRight: 16,
    paddingVertical: 6,
    borderBottomWidth: 0.4,
    borderBottomColor: border,
  },
  kvLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  kvValue: {
    fontSize: 10.5,
    color: ink,
    fontFamily: 'Helvetica',
  },

  // ── Chips / standards ───────────────────────────────────────────────────
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 12 },
  chip: {
    fontSize: 8,
    color: ink,
    backgroundColor: wash,
    borderWidth: 0.5,
    borderColor: border,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    fontFamily: 'Helvetica',
    letterSpacing: 0.4,
  },

  // ── Trail ───────────────────────────────────────────────────────────────
  trailRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.4,
    borderBottomColor: border,
  },
  trailIndex: {
    width: 22,
    fontSize: 8.5,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
  },
  trailRole: {
    width: 96,
    fontSize: 7.5,
    color: subtle,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  trailName: { flex: 1, fontSize: 10, color: ink, fontFamily: 'Helvetica' },
  trailBpn: { width: 132, fontSize: 8.5, color: ink, fontFamily: 'Courier' },

  // ── Tables ──────────────────────────────────────────────────────────────
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 5,
    borderBottomWidth: 0.8,
    borderBottomColor: ink,
    marginBottom: 4,
  },
  tableTh: {
    fontSize: 7,
    letterSpacing: 1.2,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4.5,
    borderBottomWidth: 0.4,
    borderBottomColor: border,
  },
  tableCell: { fontSize: 9, color: ink, fontFamily: 'Helvetica' },
  tableCellMono: { fontSize: 8.5, color: ink, fontFamily: 'Courier' },

  // ── LCIA card grid ──────────────────────────────────────────────────────
  lciaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  lciaCard: {
    width: '33.33%',
    padding: 10,
    borderWidth: 0.5,
    borderColor: border,
    marginRight: -0.5,
    marginBottom: -0.5,
  },
  lciaShort: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  lciaTitle: {
    fontSize: 8.5,
    color: ink,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  lciaValue: {
    fontSize: 16,
    fontFamily: 'Times-Roman',
    color: ink,
    lineHeight: 1.1,
  },
  lciaUnit: { fontSize: 8, color: muted, marginTop: 2 },

  // ── Circularity bullets ─────────────────────────────────────────────────
  bullet: { flexDirection: 'row', marginBottom: 6 },
  bulletLabel: {
    width: 88,
    fontSize: 7.5,
    letterSpacing: 1.2,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    paddingTop: 1,
  },
  bulletText: { flex: 1, fontSize: 9.5, color: ink, lineHeight: 1.5 },

  recycledNum: {
    fontSize: 36,
    fontFamily: 'Times-Roman',
    color: ink,
    lineHeight: 1,
    marginVertical: 6,
  },

  // ── Footer block ────────────────────────────────────────────────────────
  closingBlock: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: 0.6,
    borderTopColor: border,
  },
  closingRow: { flexDirection: 'row' },
  closingCol: { flex: 1, paddingRight: 16 },
  closingMonoLabel: {
    fontSize: 7,
    letterSpacing: 1.4,
    color: subtle,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  closingMono: {
    fontSize: 8,
    color: ink,
    fontFamily: 'Courier',
    lineHeight: 1.45,
  },

  disclaimer: {
    marginTop: 18,
    fontSize: 8,
    fontFamily: 'Times-Italic',
    color: muted,
    lineHeight: 1.55,
    maxWidth: 480,
  },
})

// ── Component ─────────────────────────────────────────────────────────────
export interface DppPdfProps {
  dpp: ViewerDpp
  qrPng: string // data: URL, PNG of the live resolver URL
  resolverUrl: string
}

export function DppPdfDocument({ dpp: viewer, qrPng, resolverUrl }: DppPdfProps) {
  const body = viewer.dpp ?? {}
  const ident = asDict(body.identification)
  const producer = asDict(body.producer)
  const origin = asDict(body.origin)
  const physical = asDict(body.physical)
  const composition = asDict(body.composition)
  const sustainability = asDict(body.sustainability)
  const recycled = asDict(body.recycledContent)
  const circularity = asDict(body.circularity)
  const espr = asDict(body.espr)
  const useAndLife = asDict(body.useAndLife)
  const compliance = asDict(body.compliance)
  const meta = asDict(body.meta)
  const materialId = asDict(body.materialId)

  // Identity
  const metal = str(ident.metal) ?? ''
  const grade = str(ident.gradeCode) ?? ''
  const trade = str(ident.tradeName) ?? str(ident.designation) ?? ''
  const purity = num(ident.purityPercent)
  const formLabel = str(ident.form)
  const standards = asArray(ident.applicableStandards)
    .map((d) => str(d.name) ?? str(d.reference))
    .filter(Boolean) as string[]

  const titlePrimary = trade || `${metal ? metal[0]!.toUpperCase() + metal.slice(1) : 'HZL'} ${grade}`.trim()
  const subtitle = [grade, formLabel, purity !== null ? `${fmt(purity, 3)}% purity` : null]
    .filter(Boolean)
    .join(' · ')

  // Producer
  const legalName = str(producer.legalName) ?? 'Hindustan Zinc Limited'
  const bpnl = str(producer.bpnl) ?? ''
  const identifiers = asArray(producer.identifiers)
  const regContact = asDict(producer.regulatoryContact)

  // Origin
  const sites = asArray(origin.sites)
  const originCountry = str(origin.country)
  const originSubdivision = str(origin.subdivision)
  const productionDate = str(origin.manufacturingDate) ?? str(origin.productionDate)
  const productionBatch = str(origin.manufacturingBatch) ?? str(origin.productionBatch)

  // Composition
  const compositionRows = asArray(composition.composition)

  // Sustainability
  const pcfBlock = asDict(sustainability.pcf)
  const pcfValue = num(pcfBlock.value)
  const pcfUnit = str(pcfBlock.unit) ?? 'kg CO₂e/kg'
  const pcfBreakdown = asDict(pcfBlock.breakdown)
  const epd = asDict(sustainability.epd)
  const renewablePct = num(sustainability.renewableElectricityPercent)

  // LCIA categories
  const lciaCats = [
    { key: 'pcf', short: 'GWP', title: 'Climate change', unit: pcfUnit },
    {
      key: 'resourceUseFossil',
      short: 'RU·F',
      title: 'Resource use, fossils',
      unit: 'MJ',
    },
    { key: 'waterUse', short: 'WS', title: 'Water scarcity', unit: 'm³ depriv.' },
    {
      key: 'acidification',
      short: 'AP',
      title: 'Acidification',
      unit: 'mol H+ eq.',
    },
    {
      key: 'ozoneDepletion',
      short: 'ODP',
      title: 'Ozone depletion',
      unit: 'kg CFC-11 eq.',
    },
    {
      key: 'photochemicalOzone',
      short: 'POCP',
      title: 'Photochemical ozone',
      unit: 'kg NMVOC eq.',
    },
  ] as const

  // Compliance
  const regulations = asArray(compliance.regulations)
  const certifications = asArray(compliance.certifications)

  // Meta
  const issuedAt = str(meta.createdAt) ?? viewer.issuedAt
  const expiresAt = str(meta.expiresAt) ?? viewer.expiresAt
  const lciaValid = str(meta.lciaValidUntil)
  const issuerDid = str(meta.issuerDid)
  const did = str(materialId.did) ?? issuerDid
  const languages = asArray(meta.languages).length
    ? asArray(meta.languages).map(String)
    : ['en', 'hi', 'de']

  const pageHeader = (
    <View style={s.runHeader} fixed>
      <Text>VEDANTA · HINDUSTAN ZINC · DIGITAL PRODUCT PASSPORT v1.0</Text>
      <Text>{titlePrimary.toUpperCase()}</Text>
    </View>
  )

  const pageFooter = (
    <View style={s.runFooter} fixed>
      <Text>{did ? did.slice(0, 84) : 'did:web:passport.hzlindia.com'}</Text>
      <Text
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )

  return (
    <Document
      author="Hindustan Zinc Limited"
      title={`${titlePrimary} · Digital Product Passport`}
      subject="Verified Digital Product Passport · Chem-X v1.0"
      keywords="DPP, Chem-X, EPD, ESPR, CBAM, zinc, lead"
    >
      {/* ── Page 1 · Cover + Identification ──────────────────────────── */}
      <Page size="A4" style={s.page}>
        {pageHeader}

        <Text style={s.coverWordmark}>VEDANTA · HINDUSTAN ZINC LIMITED</Text>
        <Text style={s.coverEyebrow}>Verified Digital Product Passport</Text>
        <Text style={s.coverTitle}>{titlePrimary}</Text>
        {subtitle ? <Text style={s.coverSubtitle}>{subtitle}</Text> : null}

        <View style={s.coverHero}>
          <View style={s.coverHeroLeft}>
            <Text style={s.pcfLabel}>Cradle-to-gate carbon footprint</Text>
            <Text style={s.pcfValue}>{pcfValue !== null ? fmt(pcfValue, 2) : '—'}</Text>
            <Text style={s.pcfUnit}>{pcfUnit}</Text>
            {str(epd.registrationNumber) ? (
              <Text style={s.pcfFootnote}>
                Anchored to {str(epd.registrationNumber)}
                {str(epd.programOperator) ? ` · ${str(epd.programOperator)}` : ''}
                {str(epd.validUntil) ? ` · valid until ${str(epd.validUntil)}` : ''}.
              </Text>
            ) : (
              <Text style={s.pcfFootnote}>
                Methodology: ISO 14067 + Chem-X PCF v1.0 · TfS PCF v3.0 anchored.
              </Text>
            )}
          </View>
          <View style={s.coverHeroRight}>
            <View style={s.qrBox}>
              <Image src={qrPng} style={s.qrImg} />
              <Text style={s.qrCaption}>Scan · GS1 Digital Link</Text>
            </View>
          </View>
        </View>

        {/* Identification */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>01 · Identification</Text>
          <Text style={s.sectionTitle}>What it is</Text>
          <View style={s.sectionDivider} />
          <View style={s.kvGrid}>
            <Kv label="Material" value={metal ? capitalize(metal) : '—'} />
            <Kv label="Grade code" value={grade || '—'} />
            <Kv label="Trade name" value={trade || '—'} />
            <Kv label="Purity" value={purity !== null ? `${fmt(purity, 3)}%` : '—'} />
            <Kv label="Form" value={formLabel ?? '—'} />
            <Kv
              label="UPI"
              value={str(asDict(body.upi).itemSerial) ?? str(asDict(body.upi).gtin) ?? '—'}
            />
          </View>
          {standards.length ? (
            <View style={s.chips}>
              {standards.slice(0, 12).map((sName, i) => (
                <Text key={`${sName}-${i}`} style={s.chip}>
                  {sName}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Producer */}
        <View style={s.section}>
          <Text style={s.sectionEyebrow}>02 · Producer</Text>
          <Text style={s.sectionTitle}>Who issued it</Text>
          <View style={s.sectionDivider} />
          <View style={s.kvGrid}>
            <Kv label="Legal entity" value={legalName} />
            <Kv label="BPNL (CX-0010)" value={bpnl || '—'} mono />
            {str(regContact.team) ? (
              <Kv label="Regulatory contact" value={str(regContact.team)!} />
            ) : null}
            {str(regContact.email) ? (
              <Kv label="Contact email" value={str(regContact.email)!} />
            ) : null}
          </View>
          {identifiers.length ? (
            <View style={{ marginTop: 8 }}>
              <View style={s.tableHead}>
                <Text style={[s.tableTh, { width: '24%' }]}>Type</Text>
                <Text style={[s.tableTh, { width: '40%' }]}>Value</Text>
                <Text style={[s.tableTh, { width: '36%' }]}>Issuer</Text>
              </View>
              {identifiers.slice(0, 6).map((id, i) => (
                <View key={`${str(id.type) ?? i}-${i}`} style={s.tableRow}>
                  <Text style={[s.tableCell, { width: '24%' }]}>{str(id.type) ?? '—'}</Text>
                  <Text style={[s.tableCellMono, { width: '40%' }]}>{str(id.value) ?? '—'}</Text>
                  <Text style={[s.tableCell, { width: '36%' }]}>
                    {str(id.issuingBody) ?? str(id.issuingCountry) ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {pageFooter}
      </Page>

      {/* ── Page 2 · Origin + BPN trail ───────────────────────────────── */}
      <Page size="A4" style={s.page}>
        {pageHeader}

        <View style={s.section}>
          <Text style={s.sectionEyebrow}>03 · Origin</Text>
          <Text style={s.sectionTitle}>Where it came from</Text>
          <View style={s.sectionDivider} />
          <View style={s.kvGrid}>
            <Kv label="Country" value={originCountry ?? '—'} />
            <Kv label="Subdivision" value={originSubdivision ?? '—'} />
            <Kv label="Manufacturing batch" value={productionBatch ?? '—'} />
            <Kv label="Manufacturing date" value={productionDate ?? '—'} />
          </View>
        </View>

        {sites.length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>04 · BPN trail</Text>
            <Text style={s.sectionTitle}>Who's on the trail</Text>
            <View style={s.sectionDivider} />
            <Text style={s.sectionLede}>
              Catena-X CX-0010 BPDM identifies every actor and site on the trail. Each BPN
              resolves to a DID Document at the issuer's /.well-known/did.json endpoint.
            </Text>

            <View style={s.tableHead}>
              <Text style={[s.tableTh, { width: 22 }]}>#</Text>
              <Text style={[s.tableTh, { width: 96 }]}>Role</Text>
              <Text style={[s.tableTh, { flex: 1 }]}>Name</Text>
              <Text style={[s.tableTh, { width: 132 }]}>BPN</Text>
            </View>
            <View style={s.trailRow}>
              <Text style={s.trailIndex}>0</Text>
              <Text style={s.trailRole}>Legal entity</Text>
              <Text style={s.trailName}>{legalName}</Text>
              <Text style={s.trailBpn}>{bpnl || '—'}</Text>
            </View>
            {sites.slice(0, 8).map((site, i) => (
              <View key={`${str(site.bpns) ?? i}-${i}`} style={s.trailRow}>
                <Text style={s.trailIndex}>{i + 1}</Text>
                <Text style={s.trailRole}>
                  {str(site.function) ? humanise(str(site.function)!) : 'Site'}
                </Text>
                <Text style={s.trailName}>{str(site.name) ?? '—'}</Text>
                <Text style={s.trailBpn}>{str(site.bpns) ?? '—'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {compositionRows.length ? (
          <View style={s.section} break={sites.length > 4}>
            <Text style={s.sectionEyebrow}>05 · Chemistry</Text>
            <Text style={s.sectionTitle}>What it's made of</Text>
            <View style={s.sectionDivider} />
            <View style={s.tableHead}>
              <Text style={[s.tableTh, { width: '18%' }]}>Element</Text>
              <Text style={[s.tableTh, { width: '20%' }]}>CAS</Text>
              <Text style={[s.tableTh, { width: '18%' }]}>Role</Text>
              <Text style={[s.tableTh, { width: '14%', textAlign: 'right' }]}>Min %</Text>
              <Text style={[s.tableTh, { width: '14%', textAlign: 'right' }]}>Max %</Text>
              <Text style={[s.tableTh, { width: '16%', textAlign: 'right' }]}>Typical</Text>
            </View>
            {compositionRows.slice(0, 12).map((row, i) => (
              <View key={`${str(row.element) ?? i}-${i}`} style={s.tableRow}>
                <Text style={[s.tableCell, { width: '18%', fontFamily: 'Helvetica-Bold' }]}>
                  {str(row.element) ?? '—'}
                </Text>
                <Text style={[s.tableCellMono, { width: '20%' }]}>{str(row.casNumber) ?? '—'}</Text>
                <Text style={[s.tableCell, { width: '18%' }]}>{str(row.role) ?? '—'}</Text>
                <Text style={[s.tableCellMono, { width: '14%', textAlign: 'right' }]}>
                  {fmt(num(row.guaranteedMinPercent), 4)}
                </Text>
                <Text style={[s.tableCellMono, { width: '14%', textAlign: 'right' }]}>
                  {fmt(num(row.guaranteedMaxPercent), 4)}
                </Text>
                <Text style={[s.tableCellMono, { width: '16%', textAlign: 'right' }]}>
                  {fmt(num(row.typicalAssayPercent), 4)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {Object.keys(physical).length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>06 · Physical</Text>
            <Text style={s.sectionTitle}>How it ships</Text>
            <View style={s.sectionDivider} />
            <View style={s.kvGrid}>
              <Kv
                label="Form"
                value={str(physical.form) ?? formLabel ?? '—'}
              />
              {num(physical.unitMassKg) !== null ? (
                <Kv label="Unit mass" value={`${fmt(num(physical.unitMassKg), 2)} kg`} />
              ) : null}
              {num(physical.bundleMassKg) !== null ? (
                <Kv label="Bundle mass" value={`${fmt(num(physical.bundleMassKg), 0)} kg`} />
              ) : null}
              {num(asDict(physical.dimensionsMm).length) !== null ? (
                <Kv
                  label="L × W × H"
                  value={`${fmt(num(asDict(physical.dimensionsMm).length), 0)} × ${fmt(num(asDict(physical.dimensionsMm).width), 0)} × ${fmt(num(asDict(physical.dimensionsMm).height), 0)} mm`}
                />
              ) : null}
              {str(physical.packaging) ? (
                <Kv label="Packaging" value={str(physical.packaging)!} />
              ) : null}
            </View>
          </View>
        ) : null}

        {pageFooter}
      </Page>

      {/* ── Page 3 · Sustainability + Circularity ─────────────────────── */}
      <Page size="A4" style={s.page}>
        {pageHeader}

        <View style={s.section}>
          <Text style={s.sectionEyebrow}>07 · Sustainability</Text>
          <Text style={s.sectionTitle}>Six EF 3.1 measures</Text>
          <View style={s.sectionDivider} />
          <Text style={s.sectionLede}>
            Per the Chem-X Sustainability Guideline v1.0. Every category reports its value,
            declared unit, methodology, and primary-data share.
          </Text>

          <View style={s.lciaGrid}>
            {lciaCats.map((cat) => {
              const c = asDict(sustainability[cat.key])
              const v = num(c.value)
              const u = str(c.unit) ?? cat.unit
              return (
                <View key={cat.key} style={s.lciaCard}>
                  <Text style={s.lciaShort}>{cat.short}</Text>
                  <Text style={s.lciaTitle}>{cat.title}</Text>
                  <Text style={s.lciaValue}>{fmt(v, 3)}</Text>
                  <Text style={s.lciaUnit}>{u}</Text>
                </View>
              )
            })}
          </View>

          {renewablePct !== null ? (
            <Text style={[s.sectionLede, { marginTop: 14 }]}>
              Renewable electricity share at the gate · {fmt(renewablePct, 0)}%.
            </Text>
          ) : null}
        </View>

        {Object.keys(pcfBreakdown).length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>08 · PCF breakdown</Text>
            <Text style={s.sectionTitle}>Where the carbon comes from</Text>
            <View style={s.sectionDivider} />
            <View style={{ marginTop: 4 }}>
              {Object.entries(pcfBreakdown)
                .filter(([, v]) => num(v) !== null)
                .slice(0, 8)
                .map(([k, v]) => {
                  const value = num(v) ?? 0
                  const pct = pcfValue ? Math.min(100, (value / pcfValue) * 100) : 0
                  return (
                    <View key={k} style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 9, color: ink, fontFamily: 'Helvetica' }}>
                          {humanise(k)}
                        </Text>
                        <Text style={{ fontSize: 9, color: ink, fontFamily: 'Courier' }}>
                          {fmt(value, 3)} {pcfUnit}
                        </Text>
                      </View>
                      <View
                        style={{
                          marginTop: 3,
                          height: 4,
                          backgroundColor: wash,
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${pct}%`,
                            height: 4,
                            backgroundColor: accent,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                    </View>
                  )
                })}
            </View>
          </View>
        ) : null}

        <View style={s.section} break>
          <Text style={s.sectionEyebrow}>09 · Circularity</Text>
          <Text style={s.sectionTitle}>What happens after use</Text>
          <View style={s.sectionDivider} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 160, paddingRight: 24 }}>
              <Text style={s.kvLabel}>Recycled content</Text>
              <Text style={s.recycledNum}>
                {fmt(num(recycled.totalPercent) ?? 0, 0)}%
              </Text>
              <View style={{ marginTop: 2 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 3,
                    borderBottomWidth: 0.4,
                    borderBottomColor: border,
                  }}
                >
                  <Text style={{ fontSize: 8.5, color: muted }}>Pre-consumer</Text>
                  <Text style={{ fontSize: 8.5, color: ink, fontFamily: 'Courier' }}>
                    {fmt(num(recycled.preConsumerPercent) ?? 0, 1)}%
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 3,
                    borderBottomWidth: 0.4,
                    borderBottomColor: border,
                  }}
                >
                  <Text style={{ fontSize: 8.5, color: muted }}>Post-consumer</Text>
                  <Text style={{ fontSize: 8.5, color: ink, fontFamily: 'Courier' }}>
                    {fmt(num(recycled.postConsumerPercent) ?? 0, 1)}%
                  </Text>
                </View>
                {str(recycled.chainOfCustodyModel) ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ fontSize: 8.5, color: muted }}>Chain of custody</Text>
                    <Text style={{ fontSize: 8.5, color: ink, fontFamily: 'Helvetica' }}>
                      {humanise(str(recycled.chainOfCustodyModel)!)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.kvLabel}>Circularity</Text>
              <View style={{ marginTop: 8 }}>
                {([
                  ['Recyclability', str(circularity.recyclabilityIndicator)],
                  ['Recovery', str(circularity.materialRecoveryPotential)],
                  ['Reuse', str(circularity.reuseInformation)],
                  ['Recycling', str(circularity.recyclingInformation)],
                  ['Disposal', str(circularity.disposalInformation)],
                ] as const)
                  .filter(([, v]) => !!v)
                  .map(([label, value]) => (
                    <View key={label} style={s.bullet}>
                      <Text style={s.bulletLabel}>{label}</Text>
                      <Text style={s.bulletText}>{value}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        </View>

        {pageFooter}
      </Page>

      {/* ── Page 4 · ESPR + Use & Safety + Compliance + Closing ────── */}
      <Page size="A4" style={s.page}>
        {pageHeader}

        {Object.keys(espr).length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>10 · ESPR</Text>
            <Text style={s.sectionTitle}>How it's designed to last</Text>
            <View style={s.sectionDivider} />
            <View style={s.kvGrid}>
              <Kv label="Durability" value={str(espr.durability) ?? '—'} />
              <Kv label="Reliability" value={str(espr.reliability) ?? '—'} />
              <Kv label="Reusability" value={str(espr.reusability) ?? '—'} />
              <Kv label="Energy efficiency" value={str(espr.energyEfficiency) ?? '—'} />
              <Kv
                label="Resource efficiency"
                value={str(espr.resourceEfficiency) ?? '—'}
              />
            </View>
          </View>
        ) : null}

        {Object.keys(useAndLife).length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>11 · Use & Safety</Text>
            <Text style={s.sectionTitle}>How to handle it</Text>
            <View style={s.sectionDivider} />
            {([
              ['Storage', str(useAndLife.storageInstructions)],
              ['Handling', str(useAndLife.handlingInstructions)],
              ['Safety', str(useAndLife.safetyInformation)],
              ['Disposal', str(useAndLife.disposalInformation)],
            ] as const)
              .filter(([, v]) => !!v)
              .map(([label, value]) => (
                <View key={label} style={s.bullet}>
                  <Text style={s.bulletLabel}>{label}</Text>
                  <Text style={s.bulletText}>{value}</Text>
                </View>
              ))}
          </View>
        ) : null}

        {regulations.length || certifications.length ? (
          <View style={s.section}>
            <Text style={s.sectionEyebrow}>12 · Compliance</Text>
            <Text style={s.sectionTitle}>What it conforms to</Text>
            <View style={s.sectionDivider} />

            {regulations.length ? (
              <>
                <Text style={[s.kvLabel, { marginBottom: 6 }]}>Regulations</Text>
                <View style={s.tableHead}>
                  <Text style={[s.tableTh, { width: '32%' }]}>Name</Text>
                  <Text style={[s.tableTh, { width: '24%' }]}>Reference</Text>
                  <Text style={[s.tableTh, { width: '14%' }]}>Status</Text>
                  <Text style={[s.tableTh, { width: '30%' }]}>Issuer</Text>
                </View>
                {regulations.slice(0, 8).map((r, i) => (
                  <View key={`${str(r.name) ?? i}-${i}`} style={s.tableRow}>
                    <Text
                      style={[s.tableCell, { width: '32%', fontFamily: 'Helvetica-Bold' }]}
                    >
                      {str(r.name) ?? '—'}
                    </Text>
                    <Text style={[s.tableCellMono, { width: '24%' }]}>
                      {str(r.reference) ?? '—'}
                    </Text>
                    <Text style={[s.tableCell, { width: '14%' }]}>{str(r.status) ?? '—'}</Text>
                    <Text style={[s.tableCell, { width: '30%' }]}>
                      {str(r.issuingBody) ?? '—'}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {certifications.length ? (
              <View style={{ marginTop: 14 }}>
                <Text style={[s.kvLabel, { marginBottom: 6 }]}>Certifications</Text>
                <View style={s.tableHead}>
                  <Text style={[s.tableTh, { width: '32%' }]}>Name</Text>
                  <Text style={[s.tableTh, { width: '28%' }]}>Reference</Text>
                  <Text style={[s.tableTh, { width: '14%' }]}>Status</Text>
                  <Text style={[s.tableTh, { width: '26%' }]}>Issuer</Text>
                </View>
                {certifications.slice(0, 10).map((r, i) => (
                  <View key={`${str(r.name) ?? i}-${i}`} style={s.tableRow}>
                    <Text
                      style={[s.tableCell, { width: '32%', fontFamily: 'Helvetica-Bold' }]}
                    >
                      {str(r.name) ?? '—'}
                    </Text>
                    <Text style={[s.tableCellMono, { width: '28%' }]}>
                      {str(r.reference) ?? '—'}
                    </Text>
                    <Text style={[s.tableCell, { width: '14%' }]}>{str(r.status) ?? '—'}</Text>
                    <Text style={[s.tableCell, { width: '26%' }]}>
                      {str(r.issuingBody) ?? '—'}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Closing block */}
        <View style={s.closingBlock}>
          <View style={s.closingRow}>
            <View style={s.closingCol}>
              <Text style={s.closingMonoLabel}>Issuance</Text>
              <Text style={s.closingMono}>
                Issued {issuedAt?.slice(0, 10) ?? '—'}
                {'\n'}
                Expires {expiresAt?.slice(0, 10) ?? '—'}
                {lciaValid ? `\nLCIA valid ${lciaValid}` : ''}
                {languages.length ? `\nLanguages ${languages.join(', ')}` : ''}
              </Text>
            </View>
            <View style={s.closingCol}>
              <Text style={s.closingMonoLabel}>Material ID</Text>
              <Text style={s.closingMono}>{did ?? '—'}</Text>
              {issuerDid && issuerDid !== did ? (
                <Text style={[s.closingMono, { marginTop: 4 }]}>Issuer · {issuerDid}</Text>
              ) : null}
            </View>
            <View style={s.closingCol}>
              <Text style={s.closingMonoLabel}>Live record</Text>
              <Text style={s.closingMono}>{resolverUrl}</Text>
              <Text style={[s.closingMono, { marginTop: 4, color: muted }]}>
                Scan the QR on the cover or visit the URL above for the
                cryptographically-verified live record.
              </Text>
            </View>
          </View>

          <Text style={s.disclaimer}>
            {viewer.isDemo
              ? "This is a demonstration passport. The cryptographic signature is a placeholder; production passports are signed Ed25519 by Hindustan Zinc Limited."
              : "Issued by Hindustan Zinc Limited. Cryptographic verification available at the issuer's /.well-known/did.json endpoint. This document is a faithful rendering of the live record at the time of issue; the canonical, signed record lives at the URL above."}
          </Text>
        </View>

        {pageFooter}
      </Page>
    </Document>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────
function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.kvItem}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={mono ? [s.kvValue, { fontFamily: 'Courier' }] : s.kvValue}>{value}</Text>
    </View>
  )
}

function capitalize(t: string): string {
  return t ? t[0]!.toUpperCase() + t.slice(1) : t
}

function humanise(t: string): string {
  return t
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// keep noUnusedVars happy on import-side
void Font
void amber
