import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'C6 Trail · Vedanta · Hindustan Zinc', template: '%s · C6 Trail' },
  description:
    'C6 Trail — Chem-X-aligned Digital Product Passport platform for Vedanta · Hindustan Zinc. Six EF 3.1 sustainability metrics, CX-0010 BPN identity, did:web verifiable.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="c6trail-enterprise">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=JetBrains+Mono:wght@400..600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
