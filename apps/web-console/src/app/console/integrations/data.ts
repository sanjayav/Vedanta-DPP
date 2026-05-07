/**
 * Catalog of available integrations. Real implementation reads from
 * `tenant_integrations` once the API lands; for now this is the canonical
 * demo set, organised by category and rendered server-side.
 */

export type IntegrationStatus = 'connected' | 'configuring' | 'disconnected'

export type IntegrationCategory =
  | 'erp'
  | 'compliance'
  | 'telemetry'
  | 'supply_chain'
  | 'sustainability'
  | 'custom'

export interface IntegrationField {
  key: string
  label: string
  placeholder?: string
  value?: string
  secret?: boolean
}

export interface Integration {
  id: string
  name: string
  vendor: string
  category: IntegrationCategory
  description: string
  status: IntegrationStatus
  brandTone:
    | 'sap'
    | 'eu'
    | 'catena'
    | 'mes'
    | 'asi'
    | 'oracle'
    | 'msft'
    | 'aws'
    | 'gs1'
    | 'cdp'
    | 'custom'
  iconKind:
    | 'erp'
    | 'eu'
    | 'auto'
    | 'factory'
    | 'recycle'
    | 'database'
    | 'cloud'
    | 'barcode'
    | 'leaf'
    | 'webhook'
  lastSyncAt?: string | null
  recordsSynced?: number
  capabilities: string[]
  standards: string[]
  docsUrl?: string
  fields: IntegrationField[]
  webhookUrl: string
}

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  erp: 'ERP',
  compliance: 'Compliance',
  telemetry: 'Telemetry',
  supply_chain: 'Supply Chain',
  sustainability: 'Sustainability',
  custom: 'Custom',
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'sap-s4',
    name: 'SAP S/4HANA',
    vendor: 'SAP SE',
    category: 'erp',
    description:
      'Auto-populate passport fields from your ERP. BOM, batch, item serial, and zinc/lead chemistry mapped to DPP attributes.',
    status: 'connected',
    brandTone: 'sap',
    iconKind: 'erp',
    lastSyncAt: '2026-05-05T03:11:00Z',
    recordsSynced: 1840,
    capabilities: [
      'BOM → cast event mapping',
      'Batch / item serial sync',
      'Zinc/lead chemistry (IS 209 / IS 27 / ASTM B852) extraction',
      'Outbound IDoc on passport publish',
    ],
    standards: ['IDoc', 'OData v4', 'OAuth 2.0'],
    docsUrl: 'https://help.sap.com',
    fields: [
      { key: 'host', label: 'Tenant host', placeholder: 's4.hzl.local', value: 's4.hzl.local' },
      { key: 'client', label: 'Client ID', placeholder: '300', value: '300' },
      { key: 'user', label: 'Service user', placeholder: 'C6_TRAIL_SVC', value: 'C6_TRAIL_SVC' },
      { key: 'token', label: 'OAuth token', secret: true, placeholder: '••••••••', value: '****' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/sap-s4hana/inbound',
  },
  {
    id: 'cbam',
    name: 'CBAM Declarant Portal',
    vendor: 'European Commission',
    category: 'compliance',
    description:
      'Submit embedded emissions directly to the EU CBAM transitional registry. Automated CN code mapping for zinc (Chapter 79) and lead (Chapter 78) Annex I goods.',
    status: 'configuring',
    brandTone: 'eu',
    iconKind: 'eu',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'Quarterly declaration submission',
      'CN code mapping (7901, 7904, 7801…)',
      'Default values + verifier override',
      'Free-allocation reconciliation',
    ],
    standards: ['EU 2023/956', 'EU 2023/1773'],
    docsUrl: 'https://taxation-customs.ec.europa.eu/cbam_en',
    fields: [
      {
        key: 'declarant_id',
        label: 'EORI declarant ID',
        placeholder: 'IN1234567890123',
        value: '',
      },
      {
        key: 'reporting_period',
        label: 'Reporting period',
        placeholder: '2026-Q2',
        value: '2026-Q2',
      },
      {
        key: 'submitter_email',
        label: 'Submitter email',
        placeholder: 'cbam@vedanta.co.in',
        value: 'cbam@vedanta.co.in',
      },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/cbam/inbound',
  },
  {
    id: 'catena-x',
    name: 'Catena-X / Cofinity-X',
    vendor: 'Catena-X Automotive Network',
    category: 'supply_chain',
    description:
      'Automotive supply-chain data exchange via Eclipse Dataspace Connector. Share DPP attributes with OEMs (BMW, Mercedes, Audi).',
    status: 'disconnected',
    brandTone: 'catena',
    iconKind: 'auto',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'EDC Connector (Tractus-X)',
      'Aspect models (Catena-X SAMM)',
      'Data sovereignty + usage policies',
      'Outbound DPP push to OEM partners',
    ],
    standards: ['Catena-X 24.05', 'IDS', 'Eclipse Dataspace Connector'],
    docsUrl: 'https://catena-x.net',
    fields: [
      { key: 'edc_endpoint', label: 'EDC endpoint', placeholder: 'https://edc.hzlindia.com' },
      { key: 'bpn', label: 'Business Partner Number', placeholder: 'BPNLHZL0000001QX' },
      { key: 'wallet', label: 'Managed wallet URL', placeholder: 'https://wallet.cofinity-x.com' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/catena-x/inbound',
  },
  {
    id: 'mes-iot',
    name: 'MES / IoT Gateway',
    vendor: 'HZL Digital & Technology',
    category: 'telemetry',
    description:
      'Ingest real-time smelter and refinery telemetry · roaster temperature, leach acid concentration, EW current density, cathode strip cycle · via MQTT or OPC-UA.',
    status: 'connected',
    brandTone: 'mes',
    iconKind: 'factory',
    lastSyncAt: '2026-05-05T05:22:00Z',
    recordsSynced: 942_330,
    capabilities: [
      'OPC-UA + MQTT 5.0 ingestion',
      'Per-cellhouse telemetry (RLE)',
      'Edge-buffered with replay',
      'Anomaly detection on cathode current density',
    ],
    standards: ['OPC-UA', 'MQTT 5.0', 'ISA-95'],
    fields: [
      {
        key: 'broker',
        label: 'MQTT broker',
        placeholder: 'mqtts://mes.hzlindia.com:8883',
        value: 'mqtts://mes.hzlindia.com:8883',
      },
      {
        key: 'opc_url',
        label: 'OPC-UA endpoint',
        placeholder: 'opc.tcp://opc.hzlindia.com:4840',
        value: 'opc.tcp://opc.hzlindia.com:4840',
      },
      {
        key: 'cert',
        label: 'Client certificate',
        secret: true,
        placeholder: '••••••••',
        value: '****',
      },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/mes-iot/inbound',
  },
  {
    id: 'iza-zinc-mark',
    name: 'IZA Zinc Mark',
    vendor: 'International Zinc Association',
    category: 'sustainability',
    description:
      'Synchronise IZA Zinc Mark certification status and EPD International records for responsible-sourcing claims on every passport.',
    status: 'disconnected',
    brandTone: 'asi',
    iconKind: 'recycle',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'Zinc Mark site-level status sync',
      'EPD-IES record import (International EPD System)',
      'Annual scope-3 certificate attach',
    ],
    standards: ['IZA Zinc Mark', 'EPD International ISO 14025'],
    docsUrl: 'https://www.zinc.org',
    fields: [
      { key: 'cert_id', label: 'EPD / Zinc Mark ID', placeholder: 'EPD-IES-0006472:001' },
      { key: 'auditor_did', label: 'Auditor DID', placeholder: 'did:web:environdec.com' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/iza-zinc-mark/inbound',
  },
  {
    id: 'oracle-erp',
    name: 'Oracle Fusion ERP',
    vendor: 'Oracle Corporation',
    category: 'erp',
    description:
      'Pull production orders, batch attributes, and material movements from Oracle ERP into the C6 Trail authoring engine.',
    status: 'disconnected',
    brandTone: 'oracle',
    iconKind: 'database',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'REST + OIC (Oracle Integration Cloud)',
      'Production order sync',
      'Quality results extraction',
    ],
    standards: ['REST', 'OAuth 2.0'],
    fields: [
      { key: 'host', label: 'Pod URL', placeholder: 'https://hzl.fa.ap1.oraclecloud.com' },
      { key: 'user', label: 'Integration user', placeholder: 'c6trail.svc' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/oracle-fusion/inbound',
  },
  {
    id: 'aws-iot',
    name: 'AWS IoT SiteWise',
    vendor: 'Amazon Web Services',
    category: 'telemetry',
    description:
      'Stream cellhouse and smelter telemetry from AWS IoT SiteWise asset hierarchies straight into the passport pipeline.',
    status: 'disconnected',
    brandTone: 'aws',
    iconKind: 'cloud',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'SiteWise asset model import',
      'IoT Core MQTT bridge',
      'Kinesis Data Streams sink',
    ],
    standards: ['MQTT 5.0', 'AWS Signature v4'],
    fields: [
      { key: 'region', label: 'AWS region', placeholder: 'ap-south-1', value: 'ap-south-1' },
      {
        key: 'role_arn',
        label: 'Cross-account role ARN',
        placeholder: 'arn:aws:iam::123:role/c6trail',
      },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/aws-iot/inbound',
  },
  {
    id: 'gs1',
    name: 'GS1 Digital Link Resolver',
    vendor: 'GS1 Global',
    category: 'supply_chain',
    description:
      'Register and resolve GTIN + serial → passport URL via the official GS1 Digital Link resolver. Ships QR ready out of the box.',
    status: 'connected',
    brandTone: 'gs1',
    iconKind: 'barcode',
    lastSyncAt: '2026-05-04T22:18:00Z',
    recordsSynced: 266,
    capabilities: [
      'GTIN + serial registration',
      'Resolver URL signing',
      'QR / Datamatrix generation',
    ],
    standards: ['GS1 Digital Link', 'ISO/IEC 18004'],
    fields: [
      {
        key: 'resolver',
        label: 'Resolver host',
        placeholder: 'id.hzlindia.com',
        value: 'id.hzlindia.com',
      },
      { key: 'gcp', label: 'GCP prefix', placeholder: '0890100', value: '0890100' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/gs1/inbound',
  },
  {
    id: 'cdp',
    name: 'CDP Climate Disclosure',
    vendor: 'CDP Worldwide',
    category: 'sustainability',
    description:
      'Auto-fill the climate questionnaire from aggregated passport carbon data. Supports zinc/lead-specific allocation.',
    status: 'disconnected',
    brandTone: 'cdp',
    iconKind: 'leaf',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'CDP 2026 Climate questionnaire',
      'Scope 1/2/3 aggregation',
      'Verification statement attach',
    ],
    standards: ['CDP', 'GHG Protocol'],
    fields: [
      { key: 'org_id', label: 'CDP organisation ID', placeholder: 'HZL-001' },
      { key: 'token', label: 'API token', secret: true, placeholder: '••••••••' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/cdp/inbound',
  },
  {
    id: 'webhook',
    name: 'Custom REST / Webhook',
    vendor: 'Build your own',
    category: 'custom',
    description:
      'Push and pull anything via a signed webhook. Bring your own URL; C6 Trail signs every payload with the tenant key.',
    status: 'disconnected',
    brandTone: 'custom',
    iconKind: 'webhook',
    lastSyncAt: null,
    recordsSynced: 0,
    capabilities: [
      'Outbound HMAC-signed webhooks',
      'Inbound JSON / XML accepted',
      'Replay protection (nonce)',
    ],
    standards: ['JSON', 'HMAC-SHA256'],
    fields: [
      { key: 'url', label: 'Outbound URL', placeholder: 'https://example.com/c6trail' },
      { key: 'shared_secret', label: 'Shared secret', secret: true, placeholder: '••••••••' },
    ],
    webhookUrl: 'https://passport.hzlindia.com/webhooks/custom/inbound',
  },
]
