import { notFound } from 'next/navigation'

import { fetchDpp } from '@/lib/dpp-client'
import { AUDIENCES } from '@/lib/audience'
import type { DemoAudience } from '@dpp/ui'
import { DppDocument } from '@dpp/ui'
import { ScrollProgress } from '@/components/viewer/ScrollProgress'
import { TopBar } from '@/components/viewer/TopBar'
import { ExportToolbar } from '@/components/viewer/ExportToolbar'
import { AudienceSwitcher } from '@/components/viewer/AudienceSwitcher'
import { Documentation } from '@/components/viewer/Documentation'
import { FooterSection } from '@/components/viewer/FooterSection'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ upi: string[] }>
  searchParams: Promise<{ view?: string }>
}

function parseAudience(raw: string | undefined): DemoAudience {
  return (AUDIENCES as readonly string[]).includes(raw ?? '') ? (raw as DemoAudience) : 'public'
}

export default async function DppPage({ params, searchParams }: PageProps) {
  const { upi } = await params
  const { view } = await searchParams
  const audience = parseAudience(view)
  const upiPath = upi.join('/')
  const dpp = await fetchDpp(upiPath, audience)
  if (!dpp) notFound()

  return (
    <>
      <ScrollProgress />
      <TopBar dpp={dpp} />
      <main className="bg-[var(--surface-page)]">
        <ExportToolbar dpp={dpp} upiPath={upiPath} />
        <AudienceSwitcher dpp={dpp} upiPath={upiPath} />
        <DppDocument dpp={dpp} />
        <Documentation dpp={dpp} />
      </main>
      <FooterSection dpp={dpp} />
    </>
  )
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { upi } = await params
  const { view } = await searchParams
  const audience = parseAudience(view)
  const dpp = await fetchDpp(upi.join('/'), audience)
  if (!dpp) return { title: 'Not found' }
  const ident = dpp.dpp.identification as
    | { metal?: string; gradeCode?: string; tradeName?: string; designation?: string }
    | undefined
  const sustain = dpp.dpp.sustainability as
    | { pcf?: { value?: number; unit?: string } }
    | undefined
  const product = dpp.dpp.product as { name?: string } | undefined
  const heading = ident?.tradeName
    ? `${ident.tradeName} (${ident.gradeCode ?? ''})`.trim()
    : product?.name ?? `${ident?.metal ?? 'HZL'} ${ident?.gradeCode ?? ''}`.trim()
  const pcf = sustain?.pcf
  const pcfStr = pcf?.value !== undefined ? `${pcf.value} ${pcf.unit ?? 'kg CO₂e/kg'}` : '—'
  return {
    title: `${heading} · Vedanta · Hindustan Zinc`,
    description: `Verified Digital Product Passport · cradle-to-gate carbon footprint ${pcfStr}.`,
  }
}
