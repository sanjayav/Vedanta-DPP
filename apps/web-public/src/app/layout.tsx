import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'C6 Trail · Vedanta · Hindustan Zinc',
    template: '%s · C6 Trail',
  },
  description:
    'C6 Trail issues Chem-X-aligned Digital Product Passports for Vedanta · Hindustan Zinc — six EF 3.1 sustainability metrics, CX-0010 BPN identity, did:web verifiable.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_RESOLVER_BASE_URL ?? 'http://localhost:3000',
  ),
  openGraph: {
    type: 'website',
    siteName: 'C6 Trail · Vedanta · Hindustan Zinc',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#F4F1E8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="c6trail-editorial">
      <head>
        {/* Inter for UI/body, Fraunces for editorial display, JetBrains Mono
            for every BPN / DID / hash / lab-cert ID. Self-host in production. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400..600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
