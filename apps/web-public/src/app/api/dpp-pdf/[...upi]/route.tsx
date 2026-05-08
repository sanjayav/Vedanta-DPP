/**
 * GET /dpp/[...upi]/dpp.pdf
 *
 * Returns the same DPP rendered as an A4 PDF — the QR on the live passport
 * resolves here so a scan lands directly on the document. The HTML viewer
 * remains at /dpp/[...upi] for desktop browsing; this route is the
 * mobile-first / archival format.
 *
 * Uses @react-pdf/renderer (server-side, no headless browser).
 */

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'

import { fetchDpp } from '@/lib/dpp-client'
import { DppPdfDocument } from '@/components/dpp-pdf/DppPdfDocument'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Ctx {
  params: Promise<{ upi: string[] }>
}

export async function GET(req: Request, ctx: Ctx) {
  const { upi } = await ctx.params
  const upiPath = upi.join('/')
  const dpp = await fetchDpp(upiPath, 'public')
  if (!dpp) {
    return new NextResponse('DPP not found', { status: 404 })
  }

  // QR points back to the canonical live HTML viewer so a scan from the
  // printed PDF still leads to the verified record (not back to itself).
  const url = new URL(req.url)
  const liveUrl = `${url.origin}/dpp/${upiPath}`
  const qrPng = await QRCode.toDataURL(liveUrl, {
    margin: 0,
    errorCorrectionLevel: 'M',
    width: 360,
    color: { dark: '#0B2545', light: '#FFFFFF' },
  })

  let buffer: Buffer
  try {
    buffer = await renderToBuffer(
      <DppPdfDocument dpp={dpp} qrPng={qrPng} resolverUrl={liveUrl} />,
    )
  } catch (err) {
    console.error('[dpp.pdf] render failed', err)
    return new NextResponse(
      `PDF render failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
      { status: 500, headers: { 'content-type': 'text/plain' } },
    )
  }

  // Filename: "<grade>-<castNumber>.pdf" so downloads are self-describing.
  const ident = (dpp.dpp.identification ?? {}) as {
    gradeCode?: string
    tradeName?: string
  }
  const upiBlock = (dpp.dpp.upi ?? {}) as { itemSerial?: string }
  const filename = sanitize(
    [ident.tradeName ?? ident.gradeCode ?? 'hzl', upiBlock.itemSerial]
      .filter(Boolean)
      .join('-') + '.pdf',
  )

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'public, max-age=60, s-maxage=300',
    },
  })
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100) || 'passport.pdf'
}
