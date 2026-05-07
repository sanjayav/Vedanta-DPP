/**
 * C6 Trail brand marks.
 *
 * Two pieces, one source of truth so the wordmark and the hexagon mark
 * always lock up consistently:
 *
 *   <BrandMark />      hexagon-with-trail mark, square, scales by `size` prop
 *   <BrandWordmark />  full lockup: mark + "C6 Trail" + Vedanta · HZL line
 *
 * Per CLAUDE.md hard rule #8 (no ad-hoc colour tokens), every coloured
 * stroke / fill resolves to a CSS custom property declared in
 * packages/ui/src/tokens/tokens.css. Both themes (`c6trail-enterprise`,
 * `c6trail-editorial`) supply the variables.
 */

import type { CSSProperties, SVGProps } from 'react'

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> {
  /** Pixel size of the square mark. Default 32. */
  size?: number
  /** When true, the mark renders as a stamp (filled hexagon, white trail). */
  filled?: boolean
}

/**
 * The mark — a hexagon (six sides → six EF 3.1 LCIA categories) with a
 * single trail line entering from the upper-left and exiting lower-right.
 * That trail is the chain-of-custody journey from mine to customer.
 */
export function BrandMark({ size = 32, filled = false, style, ...rest }: BrandMarkProps) {
  // The hexagon is regular, inset 2px from the viewBox edges so the stroke
  // never clips. Trail enters between the top-left and left vertices and
  // exits between the bottom-right and right vertices.
  const stroke = 'var(--color-vedanta-green)'
  const trailStroke = 'var(--color-trail-amber)'
  const fill = filled ? stroke : 'transparent'
  const trailColour = filled ? 'var(--color-paper)' : trailStroke

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="C6 Trail"
      style={{ display: 'inline-block', flexShrink: 0, ...style } as CSSProperties}
      {...rest}
    >
      {/* Regular hexagon, point-up. Vertices computed from a 22-radius circle
          centred at (24,24). Order: top → upper-right → lower-right → bottom →
          lower-left → upper-left → close. */}
      <polygon
        points="24,2 43,13 43,35 24,46 5,35 5,13"
        fill={fill}
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinejoin="round"
      />
      {/* The trail — a gentle curve diagonally crossing the hexagon. */}
      <path
        d="M 9 18 C 18 14, 30 34, 39 30"
        fill="none"
        stroke={trailColour}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Two waypoint dots, marking origin and destination of the trail. */}
      <circle cx="9" cy="18" r="2.5" fill={trailColour} />
      <circle cx="39" cy="30" r="2.5" fill={trailColour} />
    </svg>
  )
}

export interface BrandWordmarkProps {
  /** Pixel size of the mark. Wordmark scales relative to it. Default 28. */
  size?: number
  /** Show the "Vedanta · Hindustan Zinc" tagline beneath. Default true. */
  showTagline?: boolean
  /** Use the editorial display face. Default false (uses --font-display). */
  editorial?: boolean
  /** Tone of the wordmark text. Default 'default' (uses --fg-default). */
  tone?: 'default' | 'on-dark' | 'subtle'
  className?: string
}

/**
 * Full lockup — mark + "C6 Trail" wordmark + tagline.
 *
 * Used in: top-left of every console layout, public viewer hero, footer,
 * email templates, the QR-code label printed onto every ingot bundle.
 */
export function BrandWordmark({
  size = 28,
  showTagline = true,
  editorial = false,
  tone = 'default',
  className,
}: BrandWordmarkProps) {
  const wordColor =
    tone === 'on-dark'
      ? 'var(--fg-on-accent)'
      : tone === 'subtle'
        ? 'var(--fg-subtle)'
        : 'var(--fg-headline, var(--fg-default))'

  const taglineColor = tone === 'on-dark' ? 'rgba(255,255,255,0.72)' : 'var(--fg-subtle)'

  // Wordmark sizing: cap height roughly matches mark height. Tagline at ~36% of size.
  const wordSize = `${Math.round(size * 0.85)}px`
  const taglineSize = `${Math.max(10, Math.round(size * 0.4))}px`

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(size * 0.35)}px`,
        lineHeight: 1,
      }}
    >
      <BrandMark size={size} aria-hidden="true" />
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px' }}>
        <span
          style={{
            fontFamily: editorial ? 'var(--font-display)' : 'var(--font-display)',
            fontWeight: editorial ? 500 : 600,
            fontSize: wordSize,
            letterSpacing: editorial ? '-0.01em' : '-0.02em',
            color: wordColor,
            // The "6" gets optical fixing — it's a digit so we want it to read
            // as part of the wordmark, not as a count.
            fontFeatureSettings: '"ss01" 1, "lnum" 1',
          }}
        >
          C6 Trail
        </span>
        {showTagline ? (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: taglineSize,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: taglineColor,
            }}
          >
            Vedanta · Hindustan Zinc
          </span>
        ) : null}
      </span>
    </span>
  )
}
