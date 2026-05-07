import type { CSSProperties } from 'react'
import { cn } from '../cn'

/**
 * Animated shimmer placeholder. Sized via Tailwind classes or `style`. The
 * shimmer respects `prefers-reduced-motion` and falls back to a static tone.
 */
export interface SkeletonProps {
  className?: string
  style?: CSSProperties
  /** Renders as a circle (avatar / icon placeholder). */
  circle?: boolean
  /** Render multiple lines stacked, useful for paragraph blocks. */
  lines?: number
}

export function Skeleton({ className, style, circle, lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} style={style}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className={cn('skel-shimmer block h-3 rounded-md')}
            style={{ width: i === lines - 1 ? '70%' : '100%' }}
            aria-hidden
          />
        ))}
        <SkeletonStyle />
      </div>
    )
  }
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'skel-shimmer block bg-[var(--surface-hover)]',
          circle ? 'rounded-full' : 'rounded-md',
          className,
        )}
        style={style}
      />
      <SkeletonStyle />
    </>
  )
}

function SkeletonStyle() {
  return (
    <style>{`
      .skel-shimmer {
        position: relative;
        overflow: hidden;
        background-color: var(--surface-hover, #eef0f4);
      }
      .skel-shimmer::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255,255,255,0.6) 50%,
          transparent 100%
        );
        animation: skel-march 1.6s ease-in-out infinite;
      }
      @keyframes skel-march {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .skel-shimmer::after { animation: none; }
      }
    `}</style>
  )
}
