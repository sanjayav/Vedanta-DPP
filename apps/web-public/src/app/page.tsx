import Link from 'next/link'

import { BrandWordmark } from '@dpp/ui'

/**
 * Public root landing for C6 Trail.
 *
 * Production deploys redirect / to a marketing site or the tenant's own home
 * page. This view is what a developer or a curious viewer sees when they hit
 * passport.hzlindia.com directly. Three demo passports anchor the brand —
 * EcoZen as the marquee, CGG Jumbo as the high-volume galvanising case,
 * Refined Lead 99.99 as the LME-registered sibling product.
 */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <BrandWordmark size={32} editorial />

      <div className="mt-14 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
        Digital Product Passport · v1.0 · Chem-X aligned
      </div>
      <h1
        className="mt-4 text-[clamp(40px,6vw,72px)] font-light leading-[1.05]"
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--fg-headline)',
          letterSpacing: '-0.02em',
        }}
      >
        Six measures.
        <br />
        One trail.
        <br />
        <span style={{ color: 'var(--color-trail-amber-deep)' }}>Verifiable end-to-end.</span>
      </h1>
      <p
        className="mt-8 max-w-xl text-[20px] italic"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-muted)' }}
      >
        Every passport carries the six EF&nbsp;3.1 sustainability metrics, the Catena-X CX-0010
        BPN identity stack, and a <code className="font-mono not-italic text-[16px]">did:web</code>{' '}
        trail back to a real mine in Rajasthan.
      </p>

      <section className="mt-16 grid gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
          Demo passports
        </h2>
        <ul className="mt-2 grid gap-3 text-[15px]">
          <li>
            <Link
              href="/dpp/sample/ecozen"
              className="group inline-flex flex-wrap items-baseline gap-3 underline-offset-4 hover:underline"
              style={{ color: 'var(--color-trail-amber-deep)' }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                EcoZen — Special High Grade Zinc 99.995%
              </span>
              <span className="tabular text-[12px] text-[var(--fg-subtle)]">
                0.95 kg CO₂e/kg · ~75% below the IZA global average →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/dpp/sample/zinc-cgg"
              className="group inline-flex flex-wrap items-baseline gap-3 underline-offset-4 hover:underline"
              style={{ color: 'var(--color-trail-amber-deep)' }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                CGG Jumbo — Continuous Galvanising Grade
              </span>
              <span className="tabular text-[12px] text-[var(--fg-subtle)]">
                3.4 kg CO₂e/kg · ASTM B852 →
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/dpp/sample/lead"
              className="group inline-flex flex-wrap items-baseline gap-3 underline-offset-4 hover:underline"
              style={{ color: 'var(--color-trail-amber-deep)' }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                Refined Lead 99.99% — Vedanta brand
              </span>
              <span className="tabular text-[12px] text-[var(--fg-subtle)]">
                LME-registered · IS&nbsp;27:2023 →
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-16 border-t pt-8" style={{ borderColor: 'var(--surface-border)' }}>
        <p className="font-mono text-[13px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Standards
        </p>
        <p className="mt-2 text-[15px]" style={{ color: 'var(--fg-muted)' }}>
          Chem-X Sustainability Guideline v1.0 (six EF&nbsp;3.1 LCIA categories) ·{' '}
          Chem-X Business Identity (CX-0010 BPN) · Chem-X Material ID (W3C did:web) ·{' '}
          ISO&nbsp;14067:2018 · ISO&nbsp;14025 EPD · ESPR Annex&nbsp;III · BIS IS&nbsp;209/IS&nbsp;27.
        </p>
      </section>

      <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--surface-border)' }}>
        <p className="font-mono text-[13px] uppercase tracking-[0.15em] text-[var(--fg-subtle)]">
          Issue a live passport
        </p>
        <p className="mt-2 text-[15px]" style={{ color: 'var(--fg-muted)' }}>
          From a developer machine, run{' '}
          <code className="font-mono text-[14px]">pnpm sim:fire zinc-ecozen-shg-99-995</code>{' '}
          against the local API. The QR code on the cast slip resolves back to{' '}
          <code className="font-mono text-[14px]">/dpp/&lt;bpnl&gt;/&lt;uuid&gt;</code>.
        </p>
      </section>

      <footer
        className="mt-20 border-t pt-6 text-[12px]"
        style={{
          borderColor: 'var(--surface-border)',
          color: 'var(--fg-subtle)',
        }}
      >
        Issued by Hindustan Zinc Limited · BPNL{' '}
        <code className="font-mono">BPNLHZL0000001QX</code> · Verifiable via{' '}
        <code className="font-mono">/.well-known/did.json</code>
      </footer>
    </main>
  )
}
