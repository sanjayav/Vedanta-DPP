'use client'

import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Globe,
  Layers,
  Recycle,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Workflow,
} from 'lucide-react'

import type { Role } from '@/lib/auth'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ── Demo roles (preserves the /api/auth/sign-in contract) ───────────────
const DEMO_ROLES: { id: Role; label: string; tag: string; tone: string }[] = [
  { id: 'tenant_admin', label: 'Tenant Admin', tag: 'Sustainability lead', tone: 'accent' },
  { id: 'dpp_operator', label: 'DPP Operator', tag: 'Casthouse operations', tone: 'success' },
  { id: 'dpp_reviewer', label: 'DPP Reviewer', tag: 'QA / publish', tone: 'warning' },
  { id: 'tenant_auditor', label: 'Tenant Auditor', tag: 'Read-only audit', tone: 'neutral' },
  { id: 'it_administrator', label: 'IT Administrator', tag: 'SSO / integrations', tone: 'info' },
  { id: 'verifier', label: 'Verifier', tag: 'DNV · Bureau Veritas', tone: 'verifier' },
  { id: 'authority', label: 'EU Authority', tag: 'Market surveillance', tone: 'authority' },
  { id: 'customer_user', label: 'Customer · Portal', tag: 'Tata Steel · JSW', tone: 'customer' },
]

// ── FY 2024-25 anchor metrics (HZL Sustainability Report) ───────────────
const ANCHOR_METRICS: { value: string; unit?: string; label: string }[] = [
  { value: '827', unit: 'kt', label: 'Zinc · FY 2024-25' },
  { value: '225', unit: 'kt', label: 'Lead · FY 2024-25' },
  { value: '687', unit: 'MT', label: 'Silver · FY 2024-25' },
  { value: '0.95', unit: 'kg CO₂e/kg', label: 'EcoZen PCF' },
  { value: '75', unit: '%', label: 'Below IZA average' },
  { value: '#1', label: 'S&P CSA · Metals & Mining' },
]

// ── Flagship products ──────────────────────────────────────────────────
const FLAGSHIPS = [
  {
    slug: 'ecozen',
    image: '/products/ecozen.jpg',
    badge: 'Marquee',
    name: 'EcoZen — SHG 99.995%',
    grade: 'IS 209:1992 · LME Vedanta SHG 99.995',
    pcf: '0.95',
    pcfUnit: 'kg CO₂e/kg',
    delta: '~75% below IZA global average',
    bullets: ['EPD-IES-0006472:001', 'IZA Zinc Mark · Chanderiya'],
    tone: 'green' as const,
  },
  {
    slug: 'zinc-cgg',
    image: '/products/zinc-cgg.jpg',
    badge: 'Volume',
    name: 'CGG Jumbo — Continuous Galvanising',
    grade: 'ASTM B852-13 · 1 t bundles',
    pcf: '3.4',
    pcfUnit: 'kg CO₂e/kg',
    delta: 'Tata Steel · JSW Steel anchor',
    bullets: ['Al control 0.25–0.80 %', 'Hot-dip galvanising spec'],
    tone: 'amber' as const,
  },
  {
    slug: 'lead',
    image: '/products/lead.jpg',
    badge: 'LME registered',
    name: 'Refined Lead 99.99 — Vedanta brand',
    grade: 'IS 27:2023 · 25 kg ingots',
    pcf: '1.6',
    pcfUnit: 'kg CO₂e/kg',
    delta: '~16% below ILA primary lead avg',
    bullets: ['LME approved · "Vedanta 99.99"', 'Battery + radiation shielding'],
    tone: 'navy' as const,
  },
]

// ── Six EF 3.1 categories (EcoZen values) ──────────────────────────────
const SIX_MEASURES = [
  {
    short: 'PCF',
    title: 'Product Carbon Footprint',
    value: '0.95',
    unit: 'kg CO₂e/kg',
    blurb: 'IPCC AR6 GWP100y · ISO 14067:2018',
  },
  {
    short: 'RU·F',
    title: 'Resource Use · Fossil',
    value: '14.2',
    unit: 'MJ/kg',
    blurb: 'EF 3.1 · Van Oers et al. 2002',
  },
  {
    short: 'WS',
    title: 'Water Scarcity',
    value: '4.8',
    unit: 'm³ world eq/kg',
    blurb: 'EF 3.1 · AWARE country resolution',
  },
  {
    short: 'AP',
    title: 'Acidification',
    value: '0.041',
    unit: 'mol H+ eq/kg',
    blurb: 'EF 3.1 · Accumulated Exceedance',
  },
  {
    short: 'ODP',
    title: 'Ozone Depletion',
    value: '1.2 × 10⁻⁹',
    unit: 'kg CFC-11 eq/kg',
    blurb: 'EF 3.1 · WMO 2014 ODP',
  },
  {
    short: 'POCP',
    title: 'Photochemical Ozone',
    value: '0.0089',
    unit: 'kg NMVOC eq/kg',
    blurb: 'EF 3.1 · LOTOS-EUROS',
  },
]

// ── Trust scaffold: standards + certifications ─────────────────────────
const TRUST_BADGES = [
  'Chem-X Sustainability v1.0',
  'Chem-X Business Identity (CX-0010)',
  'Chem-X Material ID · did:web',
  'ISO 14067:2018',
  'ISO 14025 EPD',
  'ISO 50001 Energy',
  'ISO 14001 Environmental',
  'ISO 45001 OH&S',
  'IZA Zinc Mark',
  'ICMM (since 2025)',
  'BIS · IS 209 / IS 27',
  'ASTM B852-13',
  'LME registered brands',
  'LBMA (silver)',
  'GRI 14 · Mining Standard',
  'IFRS S2 Climate',
  'TNFD',
  'S&P CSA #1 · Metals & Mining',
]

export function Landing() {
  const reduceMotion = useReducedMotion()
  const [activeRole, setActiveRole] = useState<Role>('tenant_admin')
  const { scrollY } = useScroll()
  const heroParallax = useTransform(scrollY, [0, 600], [0, 80])

  return (
    <main className="cl-land">
      <Style />
      <Backdrop reduceMotion={!!reduceMotion} />

      <Topbar />

      <Hero parallaxY={heroParallax} reduceMotion={!!reduceMotion} />

      <MetricsStrip />

      <Flagships />

      <SixMeasures />

      <TrustWall />

      <SignInPanel
        activeRole={activeRole}
        onRoleChange={setActiveRole}
      />

      <Footer />
    </main>
  )
}

// ── Topbar ──────────────────────────────────────────────────────────────

function Topbar() {
  return (
    <header className="cl-topbar">
      <a className="cl-brand" href="#hero">
        <BrandMark />
        <span>
          <strong>C6 Trail</strong>
          <em>Vedanta · Hindustan Zinc</em>
        </span>
      </a>
      <nav className="cl-topnav">
        <a href="#products">Products</a>
        <a href="#measures">Six measures</a>
        <a href="#trust">Trust</a>
        <a href="#signin">Sign in →</a>
      </nav>
    </header>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────

function Hero({
  parallaxY,
  reduceMotion,
}: {
  parallaxY: ReturnType<typeof useTransform<number, number>>
  reduceMotion: boolean
}) {
  const taglineWords = ['Six', 'measures.', 'One', 'trail.', 'Verifiable', 'end-to-end.']
  const wordVariants: Variants = {
    hidden: { opacity: 0, y: 18 },
    show: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: 0.18 + i * 0.06, ease: EASE },
    }),
  }
  return (
    <section id="hero" className="cl-hero">
      <motion.div
        style={reduceMotion ? undefined : { y: parallaxY }}
        className="cl-hero__layer"
      >
        <HexConstellation reduceMotion={reduceMotion} />
      </motion.div>

      <div className="cl-hero__content">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="cl-hero__eyebrow"
        >
          <span className="cl-hero__eyebrow-dot" />
          Digital Product Passport · Chem-X v1.0 aligned
        </motion.p>

        <h1 className="cl-hero__title" aria-label="Six measures. One trail. Verifiable end-to-end.">
          {taglineWords.map((word, i) => {
            const isAccent = word === 'Verifiable' || word === 'end-to-end.'
            return (
              <motion.span
                key={`${word}-${i}`}
                custom={i}
                initial="hidden"
                animate="show"
                variants={wordVariants}
                className={isAccent ? 'cl-hero__title-accent' : ''}
              >
                {word + ' '}
              </motion.span>
            )
          })}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
          className="cl-hero__sub"
        >
          The C6 Trail platform issues per-batch passports for every cast of zinc, lead, and silver
          out of Hindustan Zinc — anchored to the Chem-X Sustainability Guideline (six EF 3.1
          metrics), CX-0010 BPDM identifiers, and a <code>did:web</code> trail back to a real mine
          in Rajasthan.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85, ease: EASE }}
          className="cl-hero__cta"
        >
          <MagneticButton href="#signin" tone="primary">
            <Sparkles className="h-4 w-4" />
            Open the dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </MagneticButton>
          <a href="#products" className="cl-hero__cta-secondary">
            View a passport
            <ArrowDown className="h-3 w-3" />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.05, ease: EASE }}
          className="cl-hero__scroll-cue"
          aria-hidden
        >
          <span>Scroll for the lineage</span>
          <span className="cl-hero__scroll-line" />
        </motion.div>
      </div>
    </section>
  )
}

function HexConstellation({ reduceMotion }: { reduceMotion: boolean }) {
  // Six floating hexagons that drift in a slow loop. The trace gives the
  // hero a quiet, "data-flowing" texture without distracting from the type.
  const hexes = [
    { x: 8, y: 12, s: 28, d: 0.0 },
    { x: 88, y: 18, s: 18, d: 0.7 },
    { x: 14, y: 78, s: 22, d: 1.4 },
    { x: 80, y: 70, s: 32, d: 0.4 },
    { x: 50, y: 8, s: 14, d: 1.1 },
    { x: 60, y: 88, s: 20, d: 1.8 },
  ]
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="cl-hero__hex"
      aria-hidden
    >
      <defs>
        <radialGradient id="cl-hex-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.20)" />
          <stop offset="60%" stopColor="rgba(59,130,246,0.05)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </radialGradient>
        <linearGradient id="cl-hex-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(15,76,129,0.55)" />
          <stop offset="100%" stopColor="rgba(217,164,65,0.45)" />
        </linearGradient>
      </defs>
      {hexes.map((h, i) => {
        const points = hexagonPoints(h.x, h.y, h.s / 8)
        return (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={
              reduceMotion
                ? { opacity: 0.5, scale: 1 }
                : {
                    opacity: [0.35, 0.7, 0.35],
                    scale: [1, 1.06, 1],
                    y: [0, -1.2, 0],
                  }
            }
            transition={{
              duration: 7 + i * 0.7,
              delay: h.d,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ transformOrigin: `${h.x}% ${h.y}%` }}
          >
            <circle cx={`${h.x}%`} cy={`${h.y}%`} r={`${h.s / 6}%`} fill="url(#cl-hex-glow)" />
            <polygon
              points={points}
              fill="none"
              stroke="url(#cl-hex-stroke)"
              strokeWidth="0.18"
              vectorEffect="non-scaling-stroke"
            />
          </motion.g>
        )
      })}
    </svg>
  )
}

function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    pts.push(`${x},${y}`)
  }
  return pts.join(' ')
}

// ── Magnetic button — gently follows the cursor ────────────────────────

function MagneticButton({
  children,
  href,
  tone = 'primary',
  onClick,
  type,
}: {
  children: React.ReactNode
  href?: string
  tone?: 'primary' | 'ghost'
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18 })
  const sy = useSpring(y, { stiffness: 220, damping: 18 })
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  function handleMove(e: React.MouseEvent) {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top + r.height / 2)
    x.set(dx * 0.18)
    y.set(dy * 0.18)
  }
  function handleLeave() {
    x.set(0)
    y.set(0)
  }

  const className = `cl-magnet cl-magnet--${tone}`
  const inner = (
    <motion.span style={{ x: sx, y: sy }} className="cl-magnet__inner">
      {children}
    </motion.span>
  )
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="cl-magnet-wrap"
    >
      {href ? (
        <a href={href} className={className}>
          {inner}
        </a>
      ) : (
        <button type={type ?? 'button'} onClick={onClick} className={className}>
          {inner}
        </button>
      )}
    </div>
  )
}

// ── Animated counter ───────────────────────────────────────────────────

function Counter({ value, unit, label, delay = 0 }: { value: string; unit?: string; label: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [text, setText] = useState<string>('0')
  const reduce = useReducedMotion()
  // Try to parse the number; if it has a special character (× / # / -) just show as-is.
  const parsed = Number(value.replace(/,/g, ''))
  const isNumeric = Number.isFinite(parsed)
  const decimals = isNumeric && value.includes('.') ? value.split('.')[1]!.length : 0

  useEffect(() => {
    if (!inView || !isNumeric) {
      if (!isNumeric) setText(value)
      return
    }
    if (reduce) {
      setText(value)
      return
    }
    const start = performance.now()
    const dur = 1100
    let raf = 0
    function tick(now: number) {
      const t = Math.min(1, (now - start - delay * 1000) / dur)
      const eased = 1 - Math.pow(1 - Math.max(0, t), 3)
      const n = parsed * eased
      setText(
        n.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      )
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, isNumeric, value, parsed, decimals, delay, reduce])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className="cl-counter"
    >
      <p className="cl-counter__value">
        <span className="tabular-nums">{text}</span>
        {unit && <span className="cl-counter__unit">{unit}</span>}
      </p>
      <p className="cl-counter__label">{label}</p>
    </motion.div>
  )
}

// ── Metrics strip ──────────────────────────────────────────────────────

function MetricsStrip() {
  return (
    <section className="cl-metrics" aria-label="FY 2024-25 anchor metrics">
      <p className="cl-metrics__eyebrow">
        <Globe className="h-3 w-3" />
        Vedanta · Hindustan Zinc · FY 2024-25
      </p>
      <div className="cl-metrics__grid">
        {ANCHOR_METRICS.map((m, i) => (
          <Counter key={m.label} value={m.value} unit={m.unit} label={m.label} delay={i * 0.06} />
        ))}
      </div>
    </section>
  )
}

// ── Flagship product cards ─────────────────────────────────────────────

function Flagships() {
  return (
    <section id="products" className="cl-flagships">
      <SectionHeader
        eyebrow="Three flagships"
        title="Born in Rajasthan, traceable end-to-end."
        sub="Each demo passport carries the canonical Chem-X v1.0 body — six EF 3.1 LCIA categories, BPDM identifiers, did:web Material ID, and a hash-chained audit trail."
      />
      <div className="cl-flagships__grid">
        {FLAGSHIPS.map((f, i) => (
          <FlagshipCard key={f.slug} flagship={f} index={i} />
        ))}
      </div>
    </section>
  )
}

function FlagshipCard({
  flagship,
  index,
}: {
  flagship: (typeof FLAGSHIPS)[number]
  index: number
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rx = useSpring(useTransform(y, [-1, 1], [3.5, -3.5]), { stiffness: 220, damping: 22 })
  const ry = useSpring(useTransform(x, [-1, 1], [-3.5, 3.5]), { stiffness: 220, damping: 22 })

  function handleMove(e: React.MouseEvent) {
    if (reduce) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) / (r.width / 2))
    y.set((e.clientY - (r.top + r.height / 2)) / (r.height / 2))
  }
  function handleLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      ref={ref}
      href={`/dpp/sample/${flagship.slug}`}
      target="_blank"
      rel="noreferrer"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: EASE }}
      className={`cl-flag cl-flag--${flagship.tone}`}
    >
      <div className="cl-flag__media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flagship.image} alt={flagship.name} />
        <span className="cl-flag__badge">{flagship.badge}</span>
        <span className="cl-flag__hover-shine" aria-hidden />
      </div>
      <div className="cl-flag__body">
        <p className="cl-flag__grade">{flagship.grade}</p>
        <h3 className="cl-flag__name">{flagship.name}</h3>
        <div className="cl-flag__pcf">
          <span className="cl-flag__pcf-num">{flagship.pcf}</span>
          <span className="cl-flag__pcf-unit">{flagship.pcfUnit}</span>
        </div>
        <p className="cl-flag__delta">
          <TrendingDown className="h-3 w-3" />
          {flagship.delta}
        </p>
        <ul className="cl-flag__bullets">
          {flagship.bullets.map((b) => (
            <li key={b}>
              <CheckCircle2 className="h-3 w-3" />
              {b}
            </li>
          ))}
        </ul>
        <span className="cl-flag__cta">
          Open passport
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </motion.a>
  )
}

// ── Six measures grid ──────────────────────────────────────────────────

function SixMeasures() {
  return (
    <section id="measures" className="cl-measures">
      <SectionHeader
        eyebrow="The six EF 3.1 measures"
        title="One column. Six categories. Methodology disclosed."
        sub="EcoZen at the factory gate. Each measure is computed per Chem-X v1.0, with method, data-quality rating, and primary-data share carried into the passport."
      />
      <div className="cl-measures__grid">
        {SIX_MEASURES.map((m, i) => (
          <motion.article
            key={m.short}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: i * 0.05, ease: EASE }}
            whileHover={{ y: -3 }}
            className="cl-measure"
          >
            <div className="cl-measure__head">
              <span className="cl-measure__short">{m.short}</span>
              <span className="cl-measure__title">{m.title}</span>
            </div>
            <p className="cl-measure__value">
              <span className="cl-measure__num">{m.value}</span>
              <span className="cl-measure__unit">{m.unit}</span>
            </p>
            <p className="cl-measure__blurb">{m.blurb}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

// ── Trust wall (marquee of badges) ─────────────────────────────────────

function TrustWall() {
  const list = [...TRUST_BADGES, ...TRUST_BADGES]
  return (
    <section id="trust" className="cl-trust">
      <SectionHeader
        eyebrow="Trust scaffold"
        title="Anchored to the standards regulators already trust."
        sub="The platform is built once, against open standards, then tested across the EU regulatory matrix and the BIS / IZA / ICMM private rails."
      />
      <div className="cl-trust__marquee" aria-hidden>
        <div className="cl-trust__track">
          {list.map((b, i) => (
            <span key={`${b}-${i}`} className="cl-trust__chip">
              <ShieldCheck className="h-3 w-3" />
              {b}
            </span>
          ))}
        </div>
      </div>
      <ul className="cl-trust__pillars">
        <li>
          <Layers className="h-4 w-4" />
          <span>
            <strong>BPDM</strong>
            <em>CX-0010 16-char BPNs · ISO 7064 check digits</em>
          </span>
        </li>
        <li>
          <Workflow className="h-4 w-4" />
          <span>
            <strong>did:web</strong>
            <em>Material URL · BPNL?dpp=&lt;uuid&gt;</em>
          </span>
        </li>
        <li>
          <ShieldCheck className="h-4 w-4" />
          <span>
            <strong>Ed25519 VC</strong>
            <em>W3C VC 2.0 envelope · canonicalised body</em>
          </span>
        </li>
        <li>
          <Recycle className="h-4 w-4" />
          <span>
            <strong>EoL chain</strong>
            <em>Custody / ownership / EoL VCs · Cradle-to-grave audit</em>
          </span>
        </li>
      </ul>
    </section>
  )
}

// ── Sign-in panel ──────────────────────────────────────────────────────

function SignInPanel({
  activeRole,
  onRoleChange,
}: {
  activeRole: Role
  onRoleChange: (r: Role) => void
}) {
  return (
    <section id="signin" className="cl-signin">
      <SectionHeader
        eyebrow="Demo access"
        title="Step into any role."
        sub="Production sign-in is OIDC against Microsoft Entra. For this demo, pick a role and drop straight into the surface that role lands on."
      />
      <form method="post" action="/api/auth/sign-in" className="cl-signin__form">
        <div className="cl-signin__roles">
          {DEMO_ROLES.map((r, i) => (
            <motion.label
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: EASE }}
              className={`cl-role${activeRole === r.id ? ' is-active' : ''}`}
            >
              <input
                type="radio"
                name="role"
                value={r.id}
                checked={activeRole === r.id}
                onChange={() => onRoleChange(r.id)}
              />
              {activeRole === r.id && (
                <motion.span
                  layoutId="cl-role-pill"
                  className="cl-role__pill"
                  transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                />
              )}
              <span className={`cl-role__dot cl-role__dot--${r.tone}`} />
              <span className="cl-role__text">
                <span className="cl-role__label">{r.label}</span>
                <span className="cl-role__tag">{r.tag}</span>
              </span>
              <AnimatePresence>
                {activeRole === r.id && (
                  <motion.span
                    key="chev"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.2 }}
                    className="cl-role__chev"
                    aria-hidden
                  >
                    <ArrowRight className="h-3 w-3" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.label>
          ))}
        </div>

        <div className="cl-signin__foot">
          <span className="cl-signin__hint">
            <ShieldCheck className="inline h-3 w-3" /> Demo mode · no credentials needed.
          </span>
          <MagneticButton type="submit" tone="primary">
            Continue as {DEMO_ROLES.find((r) => r.id === activeRole)?.label ?? 'user'}
            <ArrowRight className="h-3.5 w-3.5" />
          </MagneticButton>
        </div>
      </form>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="cl-footer">
      <div className="cl-footer__brand">
        <BrandMark small />
        <span>C6 Trail · Vedanta · Hindustan Zinc</span>
      </div>
      <div className="cl-footer__meta">
        <span>EU ESPR deadline · 18 Feb 2027</span>
        <span aria-hidden>·</span>
        <span>Schema v1.0</span>
        <span aria-hidden>·</span>
        <a href="/dpp/sample/ecozen" target="_blank" rel="noreferrer">
          Sample passport ↗
        </a>
      </div>
    </footer>
  )
}

// ── Backdrop · drifting gradient mesh ──────────────────────────────────

function Backdrop({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="cl-backdrop" aria-hidden>
      <div className="cl-backdrop__grid" />
      {!reduceMotion && (
        <>
          <motion.div
            initial={{ x: '-10%', y: '-5%' }}
            animate={{ x: ['-10%', '12%', '-10%'], y: ['-5%', '8%', '-5%'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="cl-backdrop__blob cl-backdrop__blob--blue"
          />
          <motion.div
            initial={{ x: '12%', y: '4%' }}
            animate={{ x: ['12%', '-6%', '12%'], y: ['4%', '-8%', '4%'] }}
            transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="cl-backdrop__blob cl-backdrop__blob--amber"
          />
        </>
      )}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string
  title: string
  sub?: string
}) {
  return (
    <header className="cl-section-head">
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="cl-section-head__eyebrow"
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.55, delay: 0.05, ease: EASE }}
        className="cl-section-head__title"
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
          className="cl-section-head__sub"
        >
          {sub}
        </motion.p>
      )}
    </header>
  )
}

// ── Brand mark (hexagon · trail line) ─────────────────────────────────

function BrandMark({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={small ? 'h-5 w-5' : 'h-9 w-9'}>
      <defs>
        <linearGradient id="cl-mark-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e7c5a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
        <linearGradient id="cl-mark-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.5 L26.5 9.5 L26.5 22.5 L16 28.5 L5.5 22.5 L5.5 9.5 Z"
        fill="url(#cl-mark-fill)"
      />
      <path d="M16 5 L24.5 9.7 L24.5 14 L16 9 L7.5 14 L7.5 9.7 Z" fill="url(#cl-mark-glow)" />
      <path
        d="M8.5 20 L13 17.5 L16 19 L19 17.5 L23.5 20"
        stroke="#d9a441"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="16" cy="14" r="1.4" fill="#fff" />
    </svg>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────

function Style() {
  return <style>{LANDING_CSS}</style>
}

const LANDING_CSS = `
.cl-land {
  position: relative;
  min-height: 100vh;
  background: var(--surface-page, #ffffff);
  color: var(--fg-default, #0b2545);
  isolation: isolate;
  overflow-x: clip;
}

/* Drifting gradient mesh + grid backdrop */
.cl-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background: linear-gradient(180deg, #fbfcff 0%, #f4f7fc 100%);
}
.cl-backdrop__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15,76,129,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15,76,129,0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at 50% 0%, black 30%, transparent 80%);
  opacity: 0.7;
}
.cl-backdrop__blob {
  position: absolute;
  width: 720px; height: 720px;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.55;
}
.cl-backdrop__blob--blue {
  top: -10%; left: -5%;
  background: radial-gradient(circle, rgba(59,130,246,0.45), transparent 60%);
}
.cl-backdrop__blob--amber {
  top: 22%; right: -6%;
  background: radial-gradient(circle, rgba(217,164,65,0.40), transparent 60%);
}

/* Topbar */
.cl-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 32px;
  backdrop-filter: blur(12px);
  background: rgba(255,255,255,0.72);
  border-bottom: 1px solid rgba(15,76,129,0.08);
}
.cl-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.cl-brand strong {
  display: block;
  font-family: var(--font-display, "Fraunces", Inter, serif);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.012em;
  color: var(--fg-default);
}
.cl-brand em {
  display: block;
  font-family: var(--font-mono, "JetBrains Mono", monospace);
  font-style: normal;
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-muted, #475569);
}
.cl-topnav {
  display: inline-flex;
  align-items: center;
  gap: 22px;
  font-size: 13px;
  color: var(--fg-muted);
}
.cl-topnav a { transition: color 150ms ease; }
.cl-topnav a:hover { color: var(--color-accent, #0F4C81); }
@media (max-width: 720px) { .cl-topnav { display: none; } }

/* Hero */
.cl-hero {
  position: relative;
  padding: 120px 32px 80px;
  display: grid;
  place-items: center;
  text-align: center;
  min-height: 88vh;
}
.cl-hero__layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.cl-hero__hex {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.7;
}

.cl-hero__content {
  position: relative;
  z-index: 1;
  max-width: 920px;
}

.cl-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(15,76,129,0.07);
  border: 1px solid rgba(15,76,129,0.15);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 600;
}
.cl-hero__eyebrow-dot {
  width: 6px; height: 6px;
  border-radius: 9999px;
  background: var(--color-accent, #0F4C81);
  box-shadow: 0 0 0 4px rgba(15,76,129,0.18);
}

.cl-hero__title {
  margin: 26px auto 0;
  font-family: var(--font-display, "Fraunces", Inter, serif);
  font-weight: 400;
  font-size: clamp(40px, 7vw, 78px);
  line-height: 1.02;
  letter-spacing: -0.026em;
  color: var(--fg-default);
}
.cl-hero__title-accent {
  background: linear-gradient(120deg, #0e7c5a 0%, #0F4C81 50%, #d9a441 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.cl-hero__sub {
  margin: 22px auto 0;
  font-size: 17px;
  line-height: 1.55;
  color: var(--fg-muted);
  max-width: 720px;
}
.cl-hero__sub code {
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(15,76,129,0.08);
  color: var(--color-accent);
}

.cl-hero__cta {
  margin-top: 32px;
  display: inline-flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  justify-content: center;
}
.cl-hero__cta-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-default);
  border-radius: 9999px;
  border: 1px solid var(--surface-border, rgba(15,23,42,0.10));
  background: rgba(255,255,255,0.6);
  transition: background 200ms ease, border-color 200ms ease;
}
.cl-hero__cta-secondary:hover { background: rgba(255,255,255,0.95); border-color: rgba(15,76,129,0.30); }

.cl-hero__scroll-cue {
  margin-top: 56px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle, #64748b);
}
.cl-hero__scroll-line {
  width: 1px; height: 32px;
  background: linear-gradient(180deg, transparent 0%, rgba(15,76,129,0.4) 100%);
  animation: cl-scroll 1.6s ease-in-out infinite;
}
@keyframes cl-scroll {
  0% { transform: scaleY(0); transform-origin: top; }
  50% { transform: scaleY(1); transform-origin: top; }
  100% { transform: scaleY(0); transform-origin: bottom; }
}
@media (prefers-reduced-motion: reduce) {
  .cl-hero__scroll-line { animation: none; }
}

/* Magnetic button */
.cl-magnet-wrap { display: inline-block; }
.cl-magnet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  border: 0;
  transition: box-shadow 200ms ease, opacity 150ms ease;
}
.cl-magnet__inner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 22px;
}
.cl-magnet--primary {
  background: linear-gradient(135deg, #0e7c5a 0%, #0b2545 100%);
  color: #fff;
  box-shadow: 0 14px 32px -12px rgba(11,37,69,0.45);
}
.cl-magnet--primary:hover {
  box-shadow: 0 16px 40px -10px rgba(11,37,69,0.55);
}
.cl-magnet--ghost {
  background: rgba(255,255,255,0.85);
  color: var(--fg-default);
  border: 1px solid var(--surface-border);
}

/* Section header */
.cl-section-head {
  max-width: 720px;
  margin: 0 auto 48px;
  text-align: center;
}
.cl-section-head__eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-accent, #0F4C81);
  font-weight: 700;
}
.cl-section-head__title {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: clamp(28px, 4.5vw, 44px);
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.08;
  color: var(--fg-default);
}
.cl-section-head__sub {
  margin-top: 14px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--fg-muted);
}

/* Metrics strip */
.cl-metrics {
  position: relative;
  padding: 70px 32px;
  border-top: 1px solid rgba(15,76,129,0.08);
  border-bottom: 1px solid rgba(15,76,129,0.08);
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(8px);
}
.cl-metrics__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto 22px;
  text-align: center;
  width: fit-content;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
  display: flex;
  justify-content: center;
}
.cl-metrics__grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}
@media (max-width: 980px) { .cl-metrics__grid { grid-template-columns: repeat(3, 1fr); gap: 24px; } }
@media (max-width: 560px) { .cl-metrics__grid { grid-template-columns: repeat(2, 1fr); gap: 20px; } }
.cl-counter {
  text-align: center;
}
.cl-counter__value {
  font-family: var(--font-display);
  font-size: clamp(28px, 3vw, 38px);
  font-weight: 500;
  letter-spacing: -0.018em;
  line-height: 1;
  color: var(--fg-default);
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  margin: 0;
}
.cl-counter__unit {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
  letter-spacing: 0.05em;
}
.cl-counter__label {
  margin-top: 6px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 600;
}

/* Flagship cards */
.cl-flagships { padding: 96px 32px; }
.cl-flagships__grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}
@media (max-width: 880px) { .cl-flagships__grid { grid-template-columns: 1fr; } }

.cl-flag {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  border: 1px solid var(--surface-border, rgba(15,23,42,0.10));
  background: linear-gradient(180deg, #ffffff 0%, #fafbfd 100%);
  overflow: hidden;
  transition: border-color 240ms ease, box-shadow 240ms ease;
  box-shadow:
    0 1px 2px rgba(15,23,42,0.04),
    0 8px 24px -16px rgba(15,23,42,0.10);
  will-change: transform;
}
.cl-flag:hover {
  border-color: rgba(15,76,129,0.30);
  box-shadow:
    0 1px 2px rgba(15,23,42,0.04),
    0 24px 48px -16px rgba(15,23,42,0.20);
}
.cl-flag--green:hover { border-color: rgba(14,124,90,0.35); }
.cl-flag--amber:hover { border-color: rgba(217,164,65,0.45); }
.cl-flag--navy:hover { border-color: rgba(11,37,69,0.40); }

.cl-flag__media {
  position: relative;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  background: var(--surface-hover, #f1f5f9);
}
.cl-flag__media img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1);
}
.cl-flag:hover .cl-flag__media img { transform: scale(1.045); }
.cl-flag__badge {
  position: absolute;
  top: 12px; left: 12px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 9999px;
  background: rgba(11,37,69,0.85);
  color: #ffffff;
  backdrop-filter: blur(8px);
}
.cl-flag__hover-shine {
  position: absolute;
  inset: -10% -30% -10% 100%;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%);
  transform: skewX(-18deg);
  opacity: 0;
  transition: transform 800ms ease, opacity 400ms ease;
  pointer-events: none;
}
.cl-flag:hover .cl-flag__hover-shine {
  transform: skewX(-18deg) translateX(-180%);
  opacity: 0.9;
}

.cl-flag__body { padding: 22px 22px 22px; display: flex; flex-direction: column; gap: 10px; }
.cl-flag__grade {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
  margin: 0;
}
.cl-flag__name {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.014em;
  line-height: 1.15;
  color: var(--fg-default);
  margin: 0;
}
.cl-flag__pcf {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 12px 0 8px;
  border-bottom: 1px dashed var(--surface-border);
}
.cl-flag__pcf-num {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.cl-flag--green .cl-flag__pcf-num { color: #0e7c5a; }
.cl-flag--amber .cl-flag__pcf-num { color: #b45309; }
.cl-flag--navy .cl-flag__pcf-num { color: #0F4C81; }
.cl-flag__pcf-unit {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--fg-muted);
}
.cl-flag__delta {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px;
  color: var(--fg-muted);
  margin: 0;
}
.cl-flag--green .cl-flag__delta { color: #0e7c5a; }
.cl-flag__bullets {
  list-style: none; padding: 0; margin: 4px 0 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.cl-flag__bullets li {
  display: flex; align-items: center; gap: 6px;
  font-size: 12.5px;
  color: var(--fg-muted);
}
.cl-flag__bullets li svg { color: #0e7c5a; flex-shrink: 0; }
.cl-flag__cta {
  margin-top: auto;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--color-accent, #0F4C81);
}

/* Six measures */
.cl-measures { padding: 96px 32px; background: rgba(15,76,129,0.02); border-top: 1px solid rgba(15,76,129,0.08); border-bottom: 1px solid rgba(15,76,129,0.08); }
.cl-measures__grid {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
@media (max-width: 880px) { .cl-measures__grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .cl-measures__grid { grid-template-columns: 1fr; } }
.cl-measure {
  border-radius: 16px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 200px;
  transition: border-color 220ms ease, box-shadow 220ms ease;
}
.cl-measure:hover {
  border-color: rgba(15,76,129,0.25);
  box-shadow: 0 18px 32px -16px rgba(15,23,42,0.18);
}
.cl-measure__head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cl-measure__short {
  display: inline-flex; align-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 4px 9px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0e7c5a 0%, #0b2545 100%);
  color: #fff;
}
.cl-measure__title { font-size: 13px; font-weight: 500; color: var(--fg-default); }
.cl-measure__value {
  display: flex; align-items: baseline; gap: 8px;
  margin: 4px 0 0;
}
.cl-measure__num {
  font-family: var(--font-display);
  font-size: 30px; font-weight: 500;
  letter-spacing: -0.02em; line-height: 1;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
}
.cl-measure__unit {
  font-family: var(--font-mono);
  font-size: 11px; color: var(--fg-muted);
}
.cl-measure__blurb {
  margin-top: auto;
  font-size: 12px;
  color: var(--fg-subtle);
  line-height: 1.5;
}

/* Trust wall */
.cl-trust { padding: 96px 0 80px; }
.cl-trust__marquee {
  position: relative;
  overflow: hidden;
  margin: 0 -32px 56px;
  padding: 14px 0;
  border-block: 1px solid rgba(15,76,129,0.08);
  background: rgba(255,255,255,0.65);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
}
.cl-trust__track {
  display: inline-flex;
  gap: 12px;
  white-space: nowrap;
  animation: cl-marquee 80s linear infinite;
}
@keyframes cl-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .cl-trust__track { animation: none; }
}
.cl-trust__chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.85);
  font-size: 12px; font-weight: 500;
  color: var(--fg-default);
  flex-shrink: 0;
}
.cl-trust__chip svg { color: #0e7c5a; flex-shrink: 0; }
.cl-trust__pillars {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 32px;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}
@media (max-width: 880px) { .cl-trust__pillars { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .cl-trust__pillars { grid-template-columns: 1fr; } }
.cl-trust__pillars li {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.85);
}
.cl-trust__pillars li svg { color: var(--color-accent); margin-top: 2px; flex-shrink: 0; }
.cl-trust__pillars strong { display: block; font-size: 13px; font-weight: 600; color: var(--fg-default); }
.cl-trust__pillars em {
  display: block;
  font-style: normal;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg-muted);
}

/* Sign-in panel */
.cl-signin { padding: 96px 32px 48px; max-width: 1100px; margin: 0 auto; }
.cl-signin__form {
  margin-top: 24px;
  border-radius: 22px;
  border: 1px solid var(--surface-border);
  background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%);
  backdrop-filter: blur(12px);
  padding: 28px 28px 24px;
  box-shadow:
    0 1px 2px rgba(15,23,42,0.04),
    0 24px 48px -16px rgba(15,23,42,0.18);
}
.cl-signin__roles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
@media (max-width: 880px) { .cl-signin__roles { grid-template-columns: repeat(2, 1fr); } }

.cl-role {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 150ms ease;
}
.cl-role input { position: absolute; opacity: 0; pointer-events: none; }
.cl-role:hover { background: rgba(15,76,129,0.04); }
.cl-role__pill {
  position: absolute; inset: 0;
  border-radius: 12px;
  background: rgba(15,76,129,0.08);
  border: 1px solid rgba(15,76,129,0.20);
  z-index: 0;
}
.cl-role__dot {
  position: relative;
  width: 10px; height: 10px;
  border-radius: 9999px;
  background: var(--fg-subtle);
  flex-shrink: 0;
  z-index: 1;
}
.cl-role__dot--accent { background: linear-gradient(135deg, #0e7c5a, #0b2545); }
.cl-role__dot--success { background: #16a34a; }
.cl-role__dot--warning { background: #d97706; }
.cl-role__dot--neutral { background: #94a3b8; }
.cl-role__dot--info { background: #3b82f6; }
.cl-role__dot--verifier { background: #7c3aed; }
.cl-role__dot--authority { background: #be123c; }
.cl-role__dot--customer { background: #f59e0b; }
.cl-role__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; z-index: 1; position: relative; }
.cl-role__label {
  font-size: 12.5px; font-weight: 600;
  color: var(--fg-default);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cl-role__tag {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.10em;
  color: var(--fg-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cl-role__chev {
  margin-left: auto;
  color: var(--color-accent);
  z-index: 1;
  position: relative;
}

.cl-signin__foot {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.cl-signin__hint {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px;
  color: var(--fg-muted);
}

/* Footer */
.cl-footer {
  padding: 28px 32px 36px;
  border-top: 1px solid rgba(15,76,129,0.08);
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--fg-muted);
}
.cl-footer__brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 500; }
.cl-footer__meta {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--fg-subtle);
}
.cl-footer__meta a { color: var(--color-accent); }
`
