'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Factory,
  FileBadge,
  Globe2,
  Recycle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import type { Role } from '@/lib/auth'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

// ── Demo roles surfaced in the sign-in panel ────────────────────────────
const DEMO_ROLES: { id: Role; label: string; tag: string; tone: string; icon: string }[] = [
  {
    id: 'tenant_admin',
    label: 'Tenant Admin',
    tag: 'Sustainability lead',
    tone: 'accent',
    icon: '◆',
  },
  {
    id: 'dpp_operator',
    label: 'DPP Operator',
    tag: 'Casthouse operations',
    tone: 'success',
    icon: '✎',
  },
  { id: 'dpp_reviewer', label: 'DPP Reviewer', tag: 'QA / publish', tone: 'warning', icon: '✓' },
  {
    id: 'tenant_auditor',
    label: 'Tenant Auditor',
    tag: 'Read-only audit',
    tone: 'neutral',
    icon: '◔',
  },
  {
    id: 'it_administrator',
    label: 'IT Administrator',
    tag: 'SSO / integrations',
    tone: 'info',
    icon: '⚙',
  },
  {
    id: 'verifier',
    label: 'Verifier',
    tag: 'DNV / Bureau Veritas',
    tone: 'verifier',
    icon: '⛨' as never,
  },
  {
    id: 'authority',
    label: 'EU Authority',
    tag: 'Market surveillance',
    tone: 'authority',
    icon: '⚖' as never,
  },
  {
    id: 'customer_user',
    label: 'Customer (Portal)',
    tag: 'BMW procurement',
    tone: 'customer',
    icon: '◇' as never,
  },
]

// ── Stat strip values ─────────────────────────────────────────────────
const STATS = [
  { label: 'Cradle-to-gate CFP', value: '4,273', unit: 'kg CO₂e/t' },
  { label: 'Industry baseline', value: '14,600', unit: 'kg CO₂e/t · IAI v2.0' },
  { label: 'Reduction', value: '-71%', unit: 'vs global average' },
  { label: 'Solar share', value: '100%', unit: 'DEWA MBR PPA' },
]

// ── Feature pillars ──────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Factory,
    title: 'Per-batch authorship',
    body: 'Every cast gets its own passport. Operators fill attributes from manual entry, IoT pulls, library presets, or external assignment.',
  },
  {
    icon: ShieldCheck,
    title: 'W3C VC + Ed25519',
    body: 'Each published passport ships as a signed Verifiable Credential. Three-tier disclosure (public · customer · authority) controls who sees what.',
  },
  {
    icon: Globe2,
    title: 'ESPR + CBAM aligned',
    body: 'Built to the JRC ESPR working draft, EU Battery Regulation blueprint, and the Aluminium Delegated Act. Registry sync ready.',
  },
  {
    icon: Recycle,
    title: 'Closed-loop EoL',
    body: 'Ownership transfers, custody hand-offs, and EoL routing all sign chain-of-custody VCs the recipient can verify offline.',
  },
]

export function Landing() {
  const reduceMotion = useReducedMotion()
  const [activeRole, setActiveRole] = useState<Role>('dpp_operator')

  return (
    <main className="al-land">
      <BackgroundLayers reduceMotion={reduceMotion ?? false} />
      <Style />

      {/* ── Top brand bar ──────────────────────────── */}
      <header className="al-land__topbar">
        <div className="al-land__brand">
          <span className="al-land__brand-mark">
            <BrandMark />
          </span>
          <span className="al-land__brand-text">
            <span className="al-land__brand-name">
              C6 <span className="al-land__brand-name-accent">Trail</span>
            </span>
            <span className="al-land__brand-by">Vedanta · Hindustan Zinc</span>
          </span>
        </div>
        <nav className="al-land__topnav">
          <a href="#platform">Platform</a>
          <a href="#how">How it works</a>
          <a href="#trust">Trust</a>
          <a href="#surfaces">Surfaces</a>
          <a href="#sign-in">Sign in</a>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────── */}
      <section className="al-land__hero">
        <div className="al-land__hero-text">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="al-land__pill"
          >
            <Sparkles className="h-3 w-3" />
            <span>Digital Product Passport · DPP 1.0 · ESPR-ready</span>
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="al-land__title"
          >
            Aluminium with a <span className="al-land__title-grad">verifiable trail</span>
            <br />
            from the desert sun to your customer&apos;s door.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="al-land__lede"
          >
            C6 Trail anchors every cast to a signed Digital Product Passport · chemistry, six
            EF&nbsp;3.1 sustainability metrics, recycled content, BIS / REACH / EPD compliance,
            and chain of custody · issued in line with the Chem-X v1.0 standards and the EU&apos;s
            ESPR &amp; CBAM frameworks.
          </motion.p>

          {/* CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
            className="al-land__cta-row"
          >
            <a href="#sign-in" className="al-land__btn al-land__btn--primary">
              Sign in to console
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a href="/dpp/sample/ecozen" className="al-land__btn al-land__btn--ghost">
              View an EcoZen passport
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.7 } },
            }}
            className="al-land__stats"
          >
            {STATS.map((s) => (
              <motion.div
                key={s.label}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
                }}
                className="al-land__stat"
              >
                <p className="al-land__stat-label">{s.label}</p>
                <p className="al-land__stat-value">{s.value}</p>
                <p className="al-land__stat-unit">{s.unit}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Hero ingot · the visual anchor */}
        <IngotVisual reduceMotion={reduceMotion ?? false} />
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section className="al-land__section" id="platform">
        <div className="al-land__section-head">
          <p className="al-land__eyebrow">Platform</p>
          <h2 className="al-land__h2">
            One passport per cast.{' '}
            <span className="al-land__title-grad">Signed, gated, verifiable.</span>
          </h2>
        </div>
        <div className="al-land__features">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────── */}
      <section className="al-land__section" id="trust">
        <div className="al-land__trust">
          <div className="al-land__trust-text">
            <p className="al-land__eyebrow">Trust by design</p>
            <h2 className="al-land__h2">
              Anchored to the standards{' '}
              <span className="al-land__title-grad">regulators already trust.</span>
            </h2>
            <ul className="al-land__trust-list">
              {[
                'EU ESPR · Ecodesign for Sustainable Products Regulation 2024/1781',
                'EU CBAM · Carbon Border Adjustment Mechanism 2023/956',
                'Chem-X Sustainability Guideline v1.0 · six EF 3.1 LCIA metrics',
                'Chem-X Business Identity (CX-0010) · BPDM with ISO 7064 BPN',
                'ISO 14067:2018 · cradle-to-gate carbon footprint',
                'ISO 14025 EPD · IS 209/IS 27 · BIS conformance',
                'W3C Verifiable Credentials 2.0 · Ed25519Signature2020',
                'GS1 Digital Link · open resolver standard',
              ].map((item) => (
                <li key={item}>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-green,#16a34a)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <CredentialChip />
        </div>
      </section>

      {/* ── How it works ───────────────────────── */}
      <section className="al-land__section" id="how">
        <div className="al-land__section-head">
          <p className="al-land__eyebrow">How it works</p>
          <h2 className="al-land__h2">
            From cast tap-out to a verifiable QR{' '}
            <span className="al-land__title-grad">in three deliberate steps.</span>
          </h2>
          <p className="al-land__lede">
            C6 Trail keeps the operator in the seat. Software fills what software can fill; humans
            confirm what humans must confirm. Every step writes to the same hash-chained audit log.
          </p>
        </div>

        <ol className="al-land__steps">
          <Step
            n="01"
            title="Capture"
            tone="accent"
            body="Operators open a draft per cast. Attributes flow in from SAP, MES, IoT brokers, or library presets. Anything missing gets assigned to a colleague or supplier with a single-use link."
          />
          <Step
            n="02"
            title="Disclose"
            tone="warning"
            body="Reviewer toggles what each viewer sees: public buyer, customer with VC, verifier with DNV access, regulator with everything. The matrix is one click away from the audit log."
          />
          <Step
            n="03"
            title="Sign & anchor"
            tone="success"
            body="One Ed25519 signature anchors the cast. The W3C VC envelope ships with a GS1 Digital Link QR. Buyer scans the QR, regulator pulls the JSON, recycler closes the loop."
          />
        </ol>
      </section>

      {/* ── Numbers / proof strip ─────────────── */}
      <section className="al-land__section" id="proof">
        <div className="al-land__proof">
          <div className="al-land__proof-text">
            <p className="al-land__eyebrow">By the numbers</p>
            <h2 className="al-land__h2">
              Built for the EU 2027 deadline.{' '}
              <span className="al-land__title-grad">Battle-tested for the Aluminium chain.</span>
            </h2>
            <p className="al-land__lede">
              The DPP 1.0 schema covers 106 attributes across 12 production stages. Every number
              below is anchored to a verifier statement on the public viewer.
            </p>
          </div>
          <div className="al-land__proof-grid">
            <ProofCard
              label="DPP attributes"
              value="106"
              sub="Across 12 stages, locked per product"
            />
            <ProofCard
              label="Audit append latency"
              value="< 40 ms"
              sub="p99, single-region writes"
            />
            <ProofCard label="Schema validation" value="100%" sub="JSON Schema + Pydantic mirror" />
            <ProofCard
              label="Audience tiers"
              value="4"
              sub="Public, Customer, Verifier, Authority"
            />
            <ProofCard
              label="Connectors"
              value="10+"
              sub="ERP, telemetry, registry, sustainability"
            />
            <ProofCard
              label="EU 2027 deadline"
              value="18 Feb 2027"
              sub="ESPR Aluminium delegated act"
            />
          </div>
        </div>
      </section>

      {/* ── Surfaces tour ──────────────────────── */}
      <section className="al-land__section" id="surfaces">
        <div className="al-land__section-head">
          <p className="al-land__eyebrow">Built for every viewer</p>
          <h2 className="al-land__h2">
            One passport, four surfaces.{' '}
            <span className="al-land__title-grad">Each tier sees what they need.</span>
          </h2>
        </div>
        <div className="al-land__surfaces">
          <SurfaceCard
            tone="public"
            who="Public buyer"
            value="Phone scan"
            desc="Phone scan of the GS1 QR opens an editorial passport. Brand story, headline carbon, EPD certification, EoL guidance. No login."
            stack="Story · Carbon · Certificates"
          />
          <SurfaceCard
            tone="customer"
            who="Customer (Tata Steel, JSW)"
            value="VC-gated portal"
            desc="OEM presents a Verifiable Credential, gets the spec view. Chemistry, mill test, supply chain map, scorecard exports."
            stack="Chemistry · MTC · Compliance"
          />
          <SurfaceCard
            tone="verifier"
            who="Verifier (DNV)"
            value="Issuer surface"
            desc="DNV signs CFP statements with their DID, attaches them to the passport. Statements show up as VC envelopes on every customer view."
            stack="Audits · Issue VC · Trust list"
          />
          <SurfaceCard
            tone="authority"
            who="Authority (EU)"
            value="Read everything"
            desc="Market surveillance pulls full DPPs, replays the audit chain, verifies tamper-evidence. CBAM declarations push directly from the passport."
            stack="Audit · CBAM · Tamper proof"
          />
        </div>
      </section>

      {/* ── Closing CTA banner ─────────────────── */}
      <section className="al-land__cta-banner">
        <div className="al-land__cta-banner-inner">
          <div className="al-land__cta-banner-text">
            <p className="al-land__eyebrow">Ready to walk through it?</p>
            <h2 className="al-land__h2">Pick a role · drop straight into the console.</h2>
            <p className="al-land__lede">
              No credentials needed for the demo. Every role lands on the surface it owns and you
              can sign out from the sidebar at any time.
            </p>
          </div>
          <a href="#sign-in" className="al-land__btn al-land__btn--primary">
            Choose a role
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* ── Sign-in panel ─────────────────────── */}
      <section className="al-land__section al-land__section--signin" id="sign-in">
        <div className="al-land__signin-head">
          <p className="al-land__eyebrow">Sign in</p>
          <h2 className="al-land__h2">Step into the role you want to demo.</h2>
          <p className="al-land__lede">
            Production sign-in is OIDC against Microsoft Entra. For this demo, pick a role to drop
            straight into the surface that role lands on.
          </p>
        </div>

        <form method="post" action="/api/auth/sign-in" className="al-land__signin-form">
          <div className="al-land__role-grid">
            {DEMO_ROLES.map((r, i) => (
              <motion.label
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.04, ease: EASE }}
                className={`al-land__role${activeRole === r.id ? ' is-active' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.id}
                  checked={activeRole === r.id}
                  onChange={() => setActiveRole(r.id)}
                />
                <span className={`al-land__role-glyph al-land__role-glyph--${r.tone}`}>
                  {r.icon}
                </span>
                <span className="al-land__role-text">
                  <span className="al-land__role-label">{r.label}</span>
                  <span className="al-land__role-tag">{r.tag}</span>
                </span>
                {activeRole === r.id && (
                  <motion.span
                    layoutId="al-land-role-pill"
                    className="al-land__role-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
              </motion.label>
            ))}
          </div>

          <div className="al-land__signin-foot">
            <span className="al-land__signin-hint">
              <ShieldCheck className="inline h-3 w-3 align-text-top" /> Demo mode · no credentials
              needed.
            </span>
            <button type="submit" className="al-land__btn al-land__btn--primary">
              Continue as {DEMO_ROLES.find((r) => r.id === activeRole)?.label ?? 'user'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </section>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="al-land__footer">
        <div className="al-land__footer-brand">
          <BrandMark small />
          <span>C6 Trail · Vedanta · Hindustan Zinc</span>
        </div>
        <div className="al-land__footer-meta">
          <span>EU Deadline 18 Feb 2027</span>
          <span>·</span>
          <span>Schema v1.0</span>
          <span>·</span>
          <a href="/dpp/sample/ecozen">Sample passport ↗</a>
        </div>
      </footer>
    </main>
  )
}

// ── Visual subcomponents ────────────────────────────────────────────────

function BackgroundLayers({ reduceMotion: _ }: { reduceMotion: boolean }) {
  // Pure CSS keyframe drift · cheaper than framer's RAF loop, GPU-composited
  // via `will-change: transform`. `prefers-reduced-motion` is handled in CSS.
  return (
    <div className="al-land__bg" aria-hidden>
      <div
        className="al-land__orb al-land__orb--1"
        style={{ background: 'radial-gradient(circle, rgba(15,76,129,0.32), transparent 60%)' }}
      />
      <div
        className="al-land__orb al-land__orb--2"
        style={{ background: 'radial-gradient(circle, rgba(214,165,75,0.22), transparent 60%)' }}
      />
      <div
        className="al-land__orb al-land__orb--3"
        style={{ background: 'radial-gradient(circle, rgba(74,158,255,0.18), transparent 60%)' }}
      />
      <div className="al-land__grid" />
    </div>
  )
}

/** Aluminium ingot rotating in 3D · primary visual hook. */
function IngotVisual({ reduceMotion }: { reduceMotion: boolean }) {
  const rotate = reduceMotion
    ? { rotateY: 0, rotateX: 0 }
    : {
        rotateY: [0, 12, -10, 0],
        rotateX: [0, -6, 6, 0],
      }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotateY: -20 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 1, delay: 0.2, ease: EASE }}
      className="al-land__hero-visual"
      aria-hidden
    >
      <motion.div
        className="al-land__ingot"
        animate={rotate}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="al-land__ingot-face al-land__ingot-face--front" />
        <span className="al-land__ingot-face al-land__ingot-face--back" />
        <span className="al-land__ingot-face al-land__ingot-face--left" />
        <span className="al-land__ingot-face al-land__ingot-face--right" />
        <span className="al-land__ingot-face al-land__ingot-face--top" />
        <span className="al-land__ingot-face al-land__ingot-face--bottom" />
        <div className="al-land__ingot-stamp">
          <span>HZL</span>
          <span>SHG 99.995</span>
        </div>
      </motion.div>

      {/* DPP signature ring · orbits the ingot */}
      <motion.div
        className="al-land__orbit-ring"
        animate={reduceMotion ? {} : { rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      >
        <span className="al-land__orbit-dot al-land__orbit-dot--1" />
        <span className="al-land__orbit-dot al-land__orbit-dot--2" />
        <span className="al-land__orbit-dot al-land__orbit-dot--3" />
      </motion.div>

      {/* DPP cards floating around */}
      <FloatingCard
        delay={0.6}
        position="top"
        title="Carbon Footprint"
        primary="0.95 kg"
        secondary="CO₂e per kg · ISO 14067"
        tone="ok"
      />
      <FloatingCard
        delay={0.9}
        position="right"
        title="Verifiable Credential"
        primary="Ed25519"
        secondary="Signed by HZL · DNV-attested"
        tone="info"
      />
      <FloatingCard
        delay={1.2}
        position="bottom"
        title="Recycled Content"
        primary="35%"
        secondary="EPD-IES-0006472 · mass balance"
        tone="success"
      />
    </motion.div>
  )
}

function FloatingCard({
  delay,
  position,
  title,
  primary,
  secondary,
  tone,
}: {
  delay: number
  position: 'top' | 'right' | 'bottom'
  title: string
  primary: string
  secondary: string
  tone: 'ok' | 'info' | 'success'
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: position === 'top' ? -16 : position === 'bottom' ? 16 : 0,
        x: position === 'right' ? 16 : 0,
      }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`al-land__floatcard al-land__floatcard--${position} al-land__floatcard--${tone}`}
    >
      <motion.div
        animate={
          reduceMotion
            ? {}
            : {
                y: [0, -6, 0],
              }
        }
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: delay * 0.5 }}
      >
        <p className="al-land__floatcard-title">{title}</p>
        <p className="al-land__floatcard-primary">{primary}</p>
        <p className="al-land__floatcard-secondary">{secondary}</p>
      </motion.div>
    </motion.div>
  )
}

function Step({
  n,
  title,
  body,
  tone,
}: {
  n: string
  title: string
  body: string
  tone: 'accent' | 'warning' | 'success'
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`al-land__step al-land__step--${tone}`}
    >
      <span className="al-land__step-num">{n}</span>
      <h3 className="al-land__step-title">{title}</h3>
      <p className="al-land__step-body">{body}</p>
    </motion.li>
  )
}

function ProofCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.55, ease: EASE }}
      className="al-land__proofcard"
    >
      <p className="al-land__proofcard-label">{label}</p>
      <p className="al-land__proofcard-value">{value}</p>
      <p className="al-land__proofcard-sub">{sub}</p>
    </motion.div>
  )
}

function SurfaceCard({
  tone,
  who,
  value,
  desc,
  stack,
}: {
  tone: 'public' | 'customer' | 'verifier' | 'authority'
  who: string
  value: string
  desc: string
  stack: string
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className={`al-land__surface al-land__surface--${tone}`}
    >
      <p className="al-land__surface-tone">{who}</p>
      <p className="al-land__surface-value">{value}</p>
      <p className="al-land__surface-desc">{desc}</p>
      <p className="al-land__surface-stack">{stack}</p>
    </motion.article>
  )
}

function FeatureCard({ feature, index }: { feature: (typeof FEATURES)[number]; index: number }) {
  const Icon = feature.icon
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: EASE }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="al-land__feature"
    >
      <span className="al-land__feature-icon">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="al-land__feature-title">{feature.title}</h3>
      <p className="al-land__feature-body">{feature.body}</p>
    </motion.article>
  )
}

function CredentialChip() {
  // Stylised VC envelope card.
  const variants: Variants = {
    initial: { opacity: 0, rotateY: -20, scale: 0.95 },
    animate: { opacity: 1, rotateY: 0, scale: 1 },
  }
  return (
    <motion.div
      variants={variants}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, ease: EASE }}
      whileHover={{ rotateY: 8, scale: 1.02 }}
      className="al-land__vc-chip"
    >
      <div className="al-land__vc-shine" aria-hidden />
      <div className="al-land__vc-head">
        <FileBadge className="h-4 w-4" />
        <span>Verifiable Credential · v2.0</span>
      </div>
      <p className="al-land__vc-line">@context</p>
      <code className="al-land__vc-code">https://www.w3.org/ns/credentials/v2</code>
      <p className="al-land__vc-line">issuer</p>
      <code className="al-land__vc-code">did:web:dpp.ega.local</code>
      <p className="al-land__vc-line">credentialSubject.dpp.upi</p>
      <code className="al-land__vc-code">…/01/08144060638123/…/CEL-DEMO-001</code>
      <p className="al-land__vc-line">proof.proofValue</p>
      <code className="al-land__vc-code">z58QAk2Pj7sB7ya3RrdXz1m7DCAzfXNAxuJxYi…</code>
      <div className="al-land__vc-stamp">
        <ShieldCheck className="h-3 w-3" />
        <span>Ed25519Signature2020 · verified</span>
      </div>
    </motion.div>
  )
}

function BrandMark({ small }: { small?: boolean }) {
  // Hexagon = six EF 3.1 LCIA categories. The trail line traces the
  // ingot → cast → audit chain. Colours track c6trail-enterprise tokens.
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={small ? 'h-5 w-5' : 'h-9 w-9'}>
      <defs>
        <linearGradient id="c6-mark-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0e7c5a" />
          <stop offset="100%" stopColor="#0b2545" />
        </linearGradient>
        <linearGradient id="c6-mark-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M16 3.5 L26.5 9.5 L26.5 22.5 L16 28.5 L5.5 22.5 L5.5 9.5 Z"
        fill="url(#c6-mark-fill)"
      />
      <path d="M16 5 L24.5 9.7 L24.5 14 L16 9 L7.5 14 L7.5 9.7 Z" fill="url(#c6-mark-glow)" />
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

// ── Styles ───────────────────────────────────────────────────────────────

function Style() {
  return <style>{LANDING_CSS}</style>
}

const LANDING_CSS = `
.al-land {
  position: relative;
  min-height: 100vh;
  background: var(--color-cream);
  color: var(--fg-default);
  overflow: hidden;
}

/* Background layers */
.al-land__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}
.al-land__orb {
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 9999px;
  filter: blur(20px);
  opacity: 0.65;
  pointer-events: none;
  will-change: transform;
  animation: al-land__drift 22s ease-in-out infinite;
}
.al-land__orb--1 { top: -6%; left: 8%; animation-delay: 0s; }
.al-land__orb--2 { top: 20%; left: 72%; animation-delay: -7s; animation-duration: 26s; }
.al-land__orb--3 { top: 70%; left: 50%; animation-delay: -14s; animation-duration: 28s; }
@keyframes al-land__drift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  33%      { transform: translate3d(24px, -22px, 0); }
  66%      { transform: translate3d(-18px, 12px, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .al-land__orb { animation: none; }
}
.al-land__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.7), transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,0.7), transparent 70%);
}

/* Topbar */
.al-land__topbar {
  position: relative;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 36px;
  max-width: 1320px;
  margin: 0 auto;
}
.al-land__brand { display: flex; align-items: center; gap: 12px; }
.al-land__brand-mark { display: grid; place-items: center; filter: drop-shadow(0 6px 14px rgba(15,76,129,0.3)); }
.al-land__brand-text { display: flex; flex-direction: column; line-height: 1.05; }
.al-land__brand-name {
  font-family: var(--font-display);
  font-size: 18px; font-weight: 700;
  letter-spacing: -0.018em;
  color: var(--fg-default);
}
.al-land__brand-name-accent {
  background: linear-gradient(135deg, #0f4c81, #2a6cb8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.al-land__brand-by {
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--fg-subtle);
}
.al-land__topnav {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: var(--fg-muted);
}
.al-land__topnav a { transition: color 150ms; }
.al-land__topnav a:hover { color: var(--fg-default); }

/* Hero */
.al-land__hero {
  position: relative;
  z-index: 2;
  max-width: 1320px;
  margin: 0 auto;
  padding: 32px 36px 60px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;
  align-items: center;
}
@media (min-width: 1000px) {
  .al-land__hero {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
    padding: 40px 36px 80px;
  }
}

.al-land__pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(15,76,129,0.18);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
  box-shadow: 0 4px 14px -6px rgba(15,76,129,0.25);
}

.al-land__title {
  margin-top: 18px;
  font-family: var(--font-display);
  font-size: clamp(36px, 5vw, 64px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.05;
  color: var(--fg-default);
  max-width: 780px;
}
.al-land__title-grad {
  background: linear-gradient(135deg, #0f4c81 0%, #4f8fc7 50%, #d4a574 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: italic;
  font-weight: 700;
}
.al-land__h2 {
  font-family: var(--font-display);
  font-size: clamp(26px, 3.4vw, 40px);
  font-weight: 700;
  letter-spacing: -0.018em;
  line-height: 1.12;
  color: var(--fg-default);
  max-width: 720px;
}
.al-land__lede {
  margin-top: 18px;
  font-size: clamp(14px, 1.4vw, 16px);
  line-height: 1.65;
  color: var(--fg-muted);
  max-width: 580px;
}
.al-land__eyebrow {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-accent);
  font-weight: 700;
  margin-bottom: 6px;
}

.al-land__cta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.al-land__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 22px;
  border-radius: 9999px;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.005em;
  transition: opacity 150ms, transform 200ms, box-shadow 200ms;
}
.al-land__btn:active { transform: scale(0.98); }
.al-land__btn--primary {
  color: #fff;
  background: linear-gradient(135deg, #0f4c81, #2a6cb8);
  box-shadow: 0 12px 32px -10px rgba(15,76,129,0.55), 0 4px 8px -4px rgba(15,76,129,0.25);
}
.al-land__btn--primary:hover { box-shadow: 0 16px 40px -12px rgba(15,76,129,0.65), 0 6px 12px -4px rgba(15,76,129,0.32); transform: translateY(-1px); }
.al-land__btn--ghost {
  color: var(--fg-default);
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(15,23,42,0.14);
  backdrop-filter: blur(10px);
}
.al-land__btn--ghost:hover { background: var(--color-paper); }

/* Stat strip */
.al-land__stats {
  margin-top: 36px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 28px;
  max-width: 540px;
}
@media (min-width: 700px) { .al-land__stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.al-land__stat-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.al-land__stat-value {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--fg-default);
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.al-land__stat-unit { margin-top: 2px; font-size: 10.5px; color: var(--fg-muted); }

/* Hero visual · ingot + orbit + cards */
.al-land__hero-visual {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-height: 540px;
  margin: 0 auto;
  perspective: 1400px;
  display: grid;
  place-items: center;
}
.al-land__ingot {
  position: relative;
  width: 280px;
  height: 130px;
  transform-style: preserve-3d;
}
.al-land__ingot-face {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background:
    linear-gradient(120deg, #cdd1d6 0%, #f4f6f9 35%, #e2e6ec 60%, #b6bcc4 100%);
  border: 1px solid #9aa3ad;
  box-shadow:
    inset 0 0 22px rgba(255,255,255,0.45),
    inset 0 0 0 1px rgba(255,255,255,0.4);
}
.al-land__ingot-face--front { transform: translateZ(50px); }
.al-land__ingot-face--back { transform: translateZ(-50px) rotateY(180deg); }
.al-land__ingot-face--left {
  width: 100px;
  left: -50px;
  transform: rotateY(-90deg);
  background: linear-gradient(120deg, #aab1ba, #d6dade);
}
.al-land__ingot-face--right {
  width: 100px;
  right: -50px;
  left: auto;
  transform: rotateY(90deg);
  background: linear-gradient(120deg, #d6dade, #aab1ba);
}
.al-land__ingot-face--top {
  height: 100px;
  top: -50px;
  transform: rotateX(90deg);
  background: linear-gradient(180deg, #f4f6f9 0%, #cdd1d6 100%);
}
.al-land__ingot-face--bottom {
  height: 100px;
  bottom: -50px;
  top: auto;
  transform: rotateX(-90deg);
  background: linear-gradient(180deg, #aab1ba, #6e757e);
}
.al-land__ingot-stamp {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  z-index: 2;
  transform: translateZ(51px);
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(15, 23, 42, 0.55);
  text-shadow: 0 1px 0 rgba(255,255,255,0.6);
  pointer-events: none;
}
.al-land__ingot-stamp span:first-child { font-size: 22px; }
.al-land__ingot-stamp span:last-child { font-size: 11px; opacity: 0.7; }

/* Orbit ring around the ingot */
.al-land__orbit-ring {
  position: absolute;
  width: 460px;
  height: 460px;
  max-width: 90%;
  max-height: 90%;
  border-radius: 9999px;
  border: 1px dashed rgba(15,76,129,0.30);
}
.al-land__orbit-dot {
  position: absolute;
  width: 10px; height: 10px;
  border-radius: 9999px;
  background: var(--color-accent);
  box-shadow: 0 0 16px rgba(15,76,129,0.6);
}
.al-land__orbit-dot--1 { top: -5px; left: 50%; transform: translateX(-50%); }
.al-land__orbit-dot--2 { right: -5px; top: 50%; transform: translateY(-50%); background: #d4a574; box-shadow: 0 0 16px rgba(212,165,116,0.65); }
.al-land__orbit-dot--3 { bottom: -5px; left: 50%; transform: translateX(-50%); background: #4ade80; box-shadow: 0 0 16px rgba(74,222,128,0.55); }

/* Floating cards */
.al-land__floatcard {
  position: absolute;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(15,23,42,0.12);
  backdrop-filter: blur(14px);
  box-shadow:
    0 16px 40px -12px rgba(15,23,42,0.22),
    0 4px 8px -4px rgba(15,23,42,0.08);
  min-width: 180px;
  z-index: 4;
}
.al-land__floatcard--top { top: 6%; left: 6%; }
.al-land__floatcard--right { top: 42%; right: 0; }
.al-land__floatcard--bottom { bottom: 6%; left: 14%; }
.al-land__floatcard-title {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.al-land__floatcard-primary {
  margin-top: 4px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--fg-default);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.al-land__floatcard--ok .al-land__floatcard-primary { color: #16a34a; }
.al-land__floatcard--info .al-land__floatcard-primary { color: var(--color-accent); }
.al-land__floatcard--success .al-land__floatcard-primary { color: #b45309; }
.al-land__floatcard-secondary {
  margin-top: 4px;
  font-size: 11px;
  color: var(--fg-muted);
  line-height: 1.4;
}

/* Sections */
.al-land__section {
  position: relative;
  z-index: 2;
  max-width: 1320px;
  margin: 0 auto;
  padding: 56px 36px;
}
.al-land__section-head { max-width: 720px; margin-bottom: 36px; }

/* Features */
.al-land__features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 700px) { .al-land__features { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1100px) { .al-land__features { grid-template-columns: repeat(4, 1fr); } }

.al-land__feature {
  position: relative;
  padding: 22px 22px 24px;
  border-radius: 16px;
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(15,23,42,0.10);
  backdrop-filter: blur(10px);
  transition: border-color 200ms, box-shadow 200ms;
}
.al-land__feature:hover {
  border-color: rgba(15,76,129,0.32);
  box-shadow: 0 18px 40px -16px rgba(15,76,129,0.22), 0 4px 12px -4px rgba(15,23,42,0.08);
}
.al-land__feature-icon {
  display: grid; place-items: center;
  width: 38px; height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--color-accent-soft), rgba(15,76,129,0.18));
  color: var(--color-accent);
  margin-bottom: 14px;
}
.al-land__feature-title {
  font-family: var(--font-display);
  font-size: 16px; font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--fg-default);
}
.al-land__feature-body { margin-top: 6px; font-size: 13px; line-height: 1.55; color: var(--fg-muted); }

/* Trust strip */
.al-land__trust {
  display: grid;
  grid-template-columns: 1fr;
  gap: 36px;
  align-items: center;
}
@media (min-width: 1000px) { .al-land__trust { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); } }
.al-land__trust-list { list-style: none; padding: 0; margin: 18px 0 0; display: flex; flex-direction: column; gap: 10px; }
.al-land__trust-list li { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--fg-default); }
.al-land__trust-list li span:last-child { color: var(--fg-default); }

/* VC chip */
.al-land__vc-chip {
  position: relative;
  padding: 22px 22px 18px;
  border-radius: 18px;
  background:
    linear-gradient(160deg, rgba(15,30,60,0.96), rgba(8,15,32,0.96));
  color: rgba(255,255,255,0.92);
  font-family: var(--font-mono);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 26px 60px -18px rgba(8,15,32,0.55),
    0 8px 24px -10px rgba(8,15,32,0.4);
  overflow: hidden;
  transform-style: preserve-3d;
}
.al-land__vc-shine {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 0% 0%, rgba(74,158,255,0.30), transparent 55%);
  pointer-events: none;
}
.al-land__vc-head {
  position: relative;
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.7);
  margin-bottom: 18px;
}
.al-land__vc-line {
  position: relative;
  font-size: 9.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.42);
  margin-top: 12px;
}
.al-land__vc-code {
  position: relative;
  display: block;
  margin-top: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  font-size: 11.5px;
  color: rgba(255,255,255,0.92);
  word-break: break-all;
}
.al-land__vc-stamp {
  position: relative;
  margin-top: 18px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 9999px;
  background: rgba(74,222,128,0.16);
  color: #4ade80;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

/* Sign-in section */
.al-land__section--signin {
  background: linear-gradient(180deg, transparent, rgba(15,76,129,0.06));
  padding-bottom: 80px;
}
.al-land__signin-head { text-align: center; max-width: 640px; margin: 0 auto 32px; }
.al-land__signin-head .al-land__lede { margin: 16px auto 0; }

.al-land__signin-form {
  max-width: 1080px;
  margin: 0 auto;
  padding: 22px 24px 26px;
  border-radius: 22px;
  background: rgba(255,255,255,0.76);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(15,76,129,0.18);
  box-shadow: 0 30px 60px -24px rgba(15,76,129,0.22);
}
.al-land__role-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
@media (min-width: 700px) { .al-land__role-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1000px) { .al-land__role-grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }

.al-land__role {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(15,23,42,0.08);
  background: var(--color-paper);
  cursor: pointer;
  transition: border-color 200ms, background 200ms;
  overflow: hidden;
}
.al-land__role input { position: absolute; opacity: 0; pointer-events: none; }
.al-land__role:hover { background: var(--color-cream); }
.al-land__role.is-active { border-color: var(--color-accent); }
.al-land__role-pill {
  position: absolute;
  inset: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(15,76,129,0.10), rgba(15,76,129,0.04));
  z-index: 0;
  pointer-events: none;
}
.al-land__role-glyph {
  position: relative; z-index: 1;
  display: grid; place-items: center;
  width: 32px; height: 32px;
  border-radius: 9px;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}
.al-land__role-glyph--accent { background: var(--color-accent-soft); color: var(--color-accent); }
.al-land__role-glyph--success { background: rgba(22,163,74,0.12); color: #166534; }
.al-land__role-glyph--warning { background: rgba(245,158,11,0.16); color: #92400e; }
.al-land__role-glyph--info { background: rgba(74,158,255,0.14); color: #1d4ed8; }
.al-land__role-glyph--neutral { background: rgba(15,23,42,0.06); color: var(--fg-muted); }
.al-land__role-glyph--verifier { background: rgba(120,84,184,0.14); color: #5b3b8c; }
.al-land__role-glyph--authority { background: rgba(180,60,60,0.12); color: #8b3232; }
.al-land__role-glyph--customer { background: rgba(212,165,116,0.18); color: #7c5717; }
.al-land__role-text { position: relative; z-index: 1; display: flex; flex-direction: column; min-width: 0; }
.al-land__role-label { font-size: 13px; font-weight: 600; color: var(--fg-default); }
.al-land__role-tag {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}

.al-land__signin-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px dashed rgba(15,23,42,0.10);
}
.al-land__signin-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--fg-muted);
}

/* Footer */
.al-land__footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto;
  padding: 28px 36px;
  border-top: 1px solid rgba(15,23,42,0.10);
  font-size: 12px;
  color: var(--fg-muted);
}
.al-land__footer-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.al-land__footer-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.al-land__footer-meta a { color: var(--color-accent); }
.al-land__footer-meta a:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
  .al-land__orb { animation: none; }
}

/* How it works · 3-step grid */
.al-land__steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  counter-reset: al-step;
}
@media (min-width: 880px) { .al-land__steps { grid-template-columns: 1fr 1fr 1fr; } }
.al-land__step {
  position: relative;
  padding: 24px 24px 26px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(10px);
  overflow: hidden;
  transition: border-color 200ms, box-shadow 200ms;
}
.al-land__step::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
}
.al-land__step--accent::before { background: linear-gradient(90deg, var(--color-accent), #4f8fc7); }
.al-land__step--warning::before { background: linear-gradient(90deg, #d4a574, #f59e0b); }
.al-land__step--success::before { background: linear-gradient(90deg, #16a34a, #4ade80); }
.al-land__step:hover {
  border-color: rgba(15, 76, 129, 0.32);
  box-shadow: 0 18px 40px -16px rgba(15, 76, 129, 0.22);
}
.al-land__step-num {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--color-accent);
  font-weight: 700;
}
.al-land__step--warning .al-land__step-num { color: #b45309; }
.al-land__step--success .al-land__step-num { color: #166534; }
.al-land__step-title {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.012em;
  color: var(--fg-default);
}
.al-land__step-body {
  margin-top: 8px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--fg-muted);
}

/* Proof / numbers */
.al-land__proof {
  display: grid;
  grid-template-columns: 1fr;
  gap: 36px;
  align-items: start;
}
@media (min-width: 1000px) {
  .al-land__proof { grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); }
}
.al-land__proof-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (min-width: 700px) { .al-land__proof-grid { grid-template-columns: 1fr 1fr 1fr; } }
.al-land__proofcard {
  padding: 18px 20px 20px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(8px);
}
.al-land__proofcard-label {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.al-land__proofcard-value {
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--fg-default);
  letter-spacing: -0.018em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, #0f4c81, #4f8fc7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.al-land__proofcard-sub { margin-top: 6px; font-size: 11.5px; color: var(--fg-muted); }

/* Surfaces tour */
.al-land__surfaces {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 760px) { .al-land__surfaces { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1100px) { .al-land__surfaces { grid-template-columns: repeat(4, 1fr); } }
.al-land__surface {
  position: relative;
  padding: 24px 22px 22px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(8px);
  overflow: hidden;
  transition: border-color 200ms, box-shadow 200ms;
}
.al-land__surface::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 0% 0%, var(--surface-glow, transparent), transparent 60%);
  pointer-events: none;
}
.al-land__surface--public { --surface-glow: rgba(15, 76, 129, 0.12); }
.al-land__surface--customer { --surface-glow: rgba(212, 165, 116, 0.16); }
.al-land__surface--verifier { --surface-glow: rgba(120, 84, 184, 0.14); }
.al-land__surface--authority { --surface-glow: rgba(180, 60, 60, 0.12); }
.al-land__surface:hover {
  border-color: rgba(15, 76, 129, 0.32);
  box-shadow: 0 22px 44px -18px rgba(15, 76, 129, 0.22);
}
.al-land__surface-tone {
  font-family: var(--font-mono);
  font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--fg-subtle);
  font-weight: 700;
}
.al-land__surface-value {
  margin-top: 6px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--fg-default);
  letter-spacing: -0.005em;
}
.al-land__surface-desc { margin-top: 8px; font-size: 12.5px; color: var(--fg-muted); line-height: 1.6; }
.al-land__surface-stack {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(15, 23, 42, 0.12);
  font-family: var(--font-mono);
  font-size: 10px; letter-spacing: 0.08em;
  color: var(--fg-subtle);
}

/* Closing CTA banner */
.al-land__cta-banner {
  position: relative;
  z-index: 2;
  max-width: 1320px;
  margin: 36px auto 0;
  padding: 0 36px;
}
.al-land__cta-banner-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 24px;
  padding: 26px 32px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 0% 0%, rgba(15,76,129,0.20), transparent 55%),
    radial-gradient(circle at 100% 100%, rgba(212,165,116,0.20), transparent 55%),
    linear-gradient(135deg, rgba(15,30,60,0.96), rgba(8,15,32,0.96));
  color: rgba(255,255,255,0.92);
  box-shadow: 0 26px 60px -16px rgba(8,15,32,0.45);
  overflow: hidden;
}
.al-land__cta-banner-text { max-width: 720px; }
.al-land__cta-banner-text .al-land__eyebrow { color: rgba(255,255,255,0.7); }
.al-land__cta-banner-text .al-land__h2 { color: #fff; }
.al-land__cta-banner-text .al-land__lede { color: rgba(255,255,255,0.7); }
.al-land__cta-banner .al-land__btn--primary {
  background: linear-gradient(135deg, #ffffff, #e7f1fa);
  color: #0f4c81;
  box-shadow: 0 12px 28px -10px rgba(255,255,255,0.32);
}
.al-land__cta-banner .al-land__btn--primary:hover { opacity: 1; box-shadow: 0 18px 38px -12px rgba(255,255,255,0.55); }
`
