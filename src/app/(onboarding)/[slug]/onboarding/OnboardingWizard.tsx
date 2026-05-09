'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { trackOnboardingCompleted } from '@/lib/analytics/mixpanel-events'
import { Icon, Icons } from '@/components/shared/Icon'

interface Props {
  slug: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SERVICES = [
  { id: 'seo',              label: 'Local SEO',          signal: 'missing GMB optimisation, low review velocity, low quality on-page SEO' },
  { id: 'web',              label: 'Web Design',          signal: 'no website or outdated site' },
  { id: 'ads',              label: 'Paid Ads',            signal: 'no Google/Meta ad presence' },
  { id: 'social',           label: 'Social Media',        signal: 'inactive or absent social profiles' },
  { id: 'rep',              label: 'Reputation Mgmt',     signal: 'low review count or unresponsive reviews' },
  { id: 'email',            label: 'Email Marketing',     signal: 'no visible email or newsletter presence' },
  { id: 'booking',          label: 'Online Booking',      signal: 'no booking system detected · phone-only contact · "By appointment" with no booking link' },
  { id: 'ai-receptionist',  label: 'AI Receptionist',     signal: 'no chat widget on site · limited hours (closed evenings/weekends) · missed call risk' },
]

const NICHES = [
  'Restaurants & Cafés',
  'Dental & Medical',
  'Automotive',
  'Real Estate',
  'Fitness & Wellness',
  'Legal Services',
  'Home Services',
  'Retail & E-commerce',
  'Beauty & Salons',
  'Education & Tutoring',
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function AddCustomNiche({ onAdd }: { onAdd: (value: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function open() {
    setAdding(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    const v = value.trim()
    if (v) onAdd(v)
    setValue('')
    setAdding(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setValue(''); setAdding(false) }
  }

  const pillBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    fontSize: 13.5,
    fontFamily: 'DM Sans, sans-serif',
    lineHeight: 1.3,
    transition: 'all 0.12s ease',
  }

  if (adding) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder="Type and press Enter"
        style={{
          ...pillBase,
          border: '1.5px solid var(--accent)',
          background: 'var(--surface)',
          color: 'var(--text-1)',
          outline: 'none',
          width: 200,
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      style={{
        ...pillBase,
        border: '1px dashed var(--border-2)',
        background: 'transparent',
        color: 'var(--text-3)',
        cursor: 'pointer',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      Add type
    </button>
  )
}

function SelectionPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 14px',
        borderRadius: 'var(--radius)',
        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: selected ? 'var(--accent)' : 'var(--surface)',
        color: selected ? 'var(--accent-fg)' : 'var(--text-2)',
        fontSize: 13.5,
        fontWeight: selected ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        fontFamily: 'DM Sans, sans-serif',
        lineHeight: 1.3,
      }}
    >
      {label}
    </button>
  )
}

// ── Step 1: Brand Profile (unchanged) ──────────────────────────────────────────

function StepBrand({ slug, onNext }: { slug: string; onNext: () => void }) {
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const store = useOnboardingStore()
  const router = useRouter()

  useEffect(() => {
    const s = useOnboardingStore.getState()
    if (s.companyName) setCompanyName(s.companyName)
    if (s.websiteUrl) setWebsiteUrl(s.websiteUrl)
  }, [])

  function isValidUrl(value: string): boolean {
    try {
      const url = new URL(value.trim())
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function handleNext() {
    if (!companyName.trim()) {
      toast.error('Please enter your company name.')
      return
    }
    if (!websiteUrl.trim()) {
      toast.error('Please enter your website URL.')
      return
    }
    if (!isValidUrl(websiteUrl)) {
      toast.error('Please enter a valid URL starting with https:// or http://')
      return
    }

    setLoading(true)
    store.setCompanyName(companyName.trim())
    store.setWebsiteUrl(websiteUrl.trim())

    try {
      const renameRes = await fetch('/api/workspace/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: companyName.trim() }),
      })
      const renameData = await renameRes.json()
      if (!renameRes.ok) throw new Error(renameData.error ?? 'Failed to save company name')

      const newSlug: string = renameData.slug

      const extractRes = await fetch('/api/brand/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl: websiteUrl.trim() }),
      })
      const extractData = await extractRes.json()
      if (!extractRes.ok) throw new Error(extractData.error ?? 'Failed to extract brand profile')

      store.setOfferDescription(extractData.offerDescription ?? '')
      store.setBrandSummary(extractData.brandSummary ?? '')
      store.setStep(2)

      if (newSlug !== slug) {
        router.replace(`/${newSlug}/onboarding`)
        return
      }

      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 640, margin: '0 auto', padding: '40px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📍</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
          Set up your workspace
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Enter your website and we&rsquo;ll build your brand profile automatically.
        </p>
      </div>

      <div className="card" style={{ padding: 28 }}>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Company name</label>
          <input
            className="form-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleNext()}
            placeholder="e.g. Acme Agency"
            autoFocus
          />
        </div>

        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">Your website URL</label>
          <input
            className="form-input"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleNext()}
            placeholder="https://your-agency.com"
            type="url"
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            We&rsquo;ll read your website to understand what you sell and craft a lead scoring offer.
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}
          onClick={handleNext}
          disabled={loading || !companyName.trim() || !websiteUrl.trim() || !isValidUrl(websiteUrl)}
        >
          {loading ? (
            <><span className="spinner" /> Analysing your website…</>
          ) : (
            <>Continue →</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Step 2: What do you sell? ──────────────────────────────────────────────────

function StepServices({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const store = useOnboardingStore()
  const [services, setServicesLocal] = useState<string[]>([])
  const [offerDescription, setOfferDescription] = useState('')

  useEffect(() => {
    const s = useOnboardingStore.getState()
    setServicesLocal(s.services.length > 0 ? s.services : [])
    setOfferDescription(s.offerDescription)
  }, [])

  function toggle(id: string) {
    setServicesLocal((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function handleNext() {
    if (services.length === 0) {
      toast.error('Select at least one service you offer.')
      return
    }
    store.setServices(services)
    store.setOfferDescription(offerDescription.trim())
    store.setStep(3)
    onNext()
  }

  const selectedServices = SERVICES.filter((s) => services.includes(s.id))
  const canAdvance = services.length > 0

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'var(--text-3)',
          marginBottom: 10,
          fontFamily: 'DM Mono, monospace',
        }}>
          Step 2 of 5
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
          What do you sell?
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 520 }}>
          Yuzuu scores leads based on your specific offer — not generic data. Tell us what you do
          and we&rsquo;ll only surface businesses that actually need it.
        </p>
      </div>

      {/* Service pills */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <label className="form-label" style={{ marginBottom: 12 }}>Services you offer</label>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
          {SERVICES.map((s) => (
            <SelectionPill
              key={s.id}
              label={s.label}
              selected={services.includes(s.id)}
              onClick={() => toggle(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Scoring signals panel */}
      {selectedServices.length > 0 && (
        <div className="page-enter card" style={{
          padding: '16px 20px',
          marginBottom: 16,
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'var(--text-3)',
            fontFamily: 'DM Mono, monospace',
            marginBottom: 10,
          }}>
            Scoring signals activated
          </div>
          {selectedServices.map((s) => (
            <div key={s.id} style={{
              display: 'flex',
              gap: 8,
              fontSize: 13,
              color: 'var(--text-2)',
              marginBottom: 6,
              lineHeight: 1.5,
            }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
              <span>
                <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{s.label}:</span>
                {' '}{s.signal}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Offer description review */}
      {offerDescription && (
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <label className="form-label" style={{ marginBottom: 8 }}>
            Your offer description
            <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>
              — extracted from your website, edit if needed
            </span>
          </label>
          <textarea
            className="form-input"
            value={offerDescription}
            onChange={(e) => setOfferDescription(e.target.value)}
            style={{ height: 90, resize: 'vertical' as const, padding: 10, lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            This is used by AI to score leads and write outreach emails.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
        >
          ← Back
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 15 }}
          onClick={handleNext}
          disabled={!canAdvance}
        >
          Set my scoring signals →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Where's your market? ──────────────────────────────────────────────

function StepMarket({
  slug,
  onBack,
  onStartRedirect,
}: {
  slug: string
  onBack: () => void
  onStartRedirect: () => void
}) {
  const store = useOnboardingStore()
  const router = useRouter()
  const [niches, setNichesLocal] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const s = useOnboardingStore.getState()
    setNichesLocal(s.niches.length > 0 ? s.niches : [])
    setLocation(s.location)
  }, [])

  function toggleNiche(niche: string) {
    setNichesLocal((prev) =>
      prev.includes(niche) ? prev.filter((x) => x !== niche) : [...prev, niche]
    )
  }

  const selectedServiceLabels = SERVICES
    .filter((s) => store.services.includes(s.id))
    .map((s) => s.label)

  const canAdvance = niches.length > 0 && location.trim().length > 1

  async function handleSave() {
    if (!canAdvance) {
      toast.error('Select at least one business type and enter a location.')
      return
    }

    store.setNiches(niches)
    store.setLocation(location.trim())

    setLoading(true)
    try {
      const res = await fetch('/api/workspace/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_description: store.offerDescription || `Agency offering ${store.services.join(', ')} services`,
          brand_website_url: store.websiteUrl || null,
          icp_services: store.services,
          icp_niches: niches,
          icp_city: location.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save profile')

      trackOnboardingCompleted({
        workspace_slug: slug,
        services_count: store.services.length,
        niches_count: niches.length,
        has_website_url: Boolean(store.websiteUrl?.trim()),
      })

      // Fire the agent in the background — don't await so navigation is instant.
      // keepalive: true tells the browser to keep this request alive even after
      // the page navigates away (critical for production / Vercel).
      fetch('/api/agent/run', { method: 'POST', keepalive: true }).catch(() => null)

      onStartRedirect()
      store.reset()
      router.push(`/${slug}/leads?agentRunning=1`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'var(--text-3)',
          marginBottom: 10,
          fontFamily: 'DM Mono, monospace',
        }}>
          Step 3 of 3
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 8 }}>
          Where&rsquo;s your market?
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-3)', lineHeight: 1.6, maxWidth: 520 }}>
          Pick the business type(s) and location. Yuzuu will scan that market and surface the ones that
          need your services most.
        </p>
      </div>

      {/* Niche multi-select */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Business type / niche</label>
          <button
            type="button"
            onClick={() => {
              const allNiches = [...NICHES, ...niches.filter((n) => !NICHES.includes(n))]
              const allSelected = allNiches.every((n) => niches.includes(n))
              setNichesLocal(allSelected ? [] : allNiches)
            }}
            style={{
              fontSize: 12,
              color: 'var(--text-3)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {[...NICHES, ...niches.filter((n) => !NICHES.includes(n))].every((n) => niches.includes(n))
              ? 'Deselect all'
              : 'Select all'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
          {[...NICHES, ...niches.filter((n) => !NICHES.includes(n))].map((n) => (
            <SelectionPill
              key={n}
              label={n}
              selected={niches.includes(n)}
              onClick={() => toggleNiche(n)}
            />
          ))}
          <AddCustomNiche onAdd={(v) => {
            if (!niches.includes(v)) setNichesLocal((prev) => [...prev, v])
          }} />
        </div>
      </div>

      {/* Location */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">City, area or country</label>
          <input
            className="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Paris, Île de France, France…"
            onKeyDown={(e) => e.key === 'Enter' && !loading && canAdvance && handleSave()}
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            Enter a city for local targeting or a country for broader reach.
          </div>
        </div>
      </div>

      {/* Preview confirmation */}
      {canAdvance && (
        <div className="page-enter card" style={{
          padding: '16px 20px',
          marginBottom: 16,
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--accent)' }}>→</span>
              <span>
                Scanning:{' '}
                <strong style={{ color: 'var(--text-1)' }}>{niches.join(', ')}</strong>
                {' '}in <strong style={{ color: 'var(--text-1)' }}>{location.trim()}</strong>
              </span>
            </div>
            {selectedServiceLabels.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>→</span>
                <span>Scoring for: {selectedServiceLabels.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          disabled={loading}
        >
          ← Back
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, justifyContent: 'center', padding: '12px', fontSize: 15 }}
          onClick={handleSave}
          disabled={!canAdvance || loading}
        >
          {loading ? (
            <><span className="spinner" /> Building your lead list…</>
          ) : (
            <>Get leads built for my offer →</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────────

export function OnboardingWizard({ slug }: Props) {
  const { step, setStep } = useOnboardingStore()
  const [redirecting, setRedirecting] = useState(false)

  const STEPS = [
    { n: 1, label: 'Workspace' },
    { n: 2, label: 'Services' },
    { n: 3, label: 'Market' },
  ]

  if (redirecting) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 12, color: 'var(--text-3)', fontSize: 15,
      }}>
        <span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.12)', borderTopColor: 'var(--accent)' }} />
        Building your lead list…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
      {/* Step indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: 8,
        paddingTop: 32,
        flexWrap: 'wrap' as const,
      }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: step > s.n ? 'var(--accent)' : step === s.n ? 'var(--accent)' : 'var(--border)',
              color: step >= s.n ? 'white' : 'var(--text-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
              transition: 'all 0.2s',
            }}>
              {step > s.n ? <Icon d={Icons.check} size={11} /> : s.n}
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: step === s.n ? 600 : 400,
              color: step >= s.n ? 'var(--text-1)' : 'var(--text-3)',
              margin: '0 6px',
              whiteSpace: 'nowrap' as const,
            }}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div style={{
                width: 28,
                height: 1,
                background: step > s.n ? 'var(--accent)' : 'var(--border)',
                margin: '0 2px',
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <StepBrand
          slug={slug}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepServices
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepMarket
          slug={slug}
          onBack={() => setStep(2)}
          onStartRedirect={() => setRedirecting(true)}
        />
      )}

      {/* Bottom progress bar */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: 'var(--border)',
        zIndex: 10,
      }}>
        <div style={{
          height: '100%',
          width: `${((step - 1) / STEPS.length) * 100}%`,
          background: 'var(--accent)',
          transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  )
}

