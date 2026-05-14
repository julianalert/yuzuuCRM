'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useWorkspace } from '@/hooks/useWorkspace'

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
    padding: '7px 13px',
    borderRadius: 'var(--radius)',
    fontSize: 13.5,
    fontFamily: 'DM Sans, sans-serif',
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

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '7px 13px',
        borderRadius: 'var(--radius)',
        border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
        background: selected ? 'var(--accent)' : 'var(--surface)',
        color: selected ? 'var(--accent-fg)' : 'var(--text-2)',
        fontSize: 13.5,
        fontWeight: selected ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 0.12s ease',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {label}
    </button>
  )
}

export default function ProfilePage() {
  const workspace = useWorkspace()
  const router = useRouter()

  const [websiteUrl, setWebsiteUrl] = useState('')
  const [services, setServices] = useState<string[]>([])
  const [niches, setNiches] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setWebsiteUrl(workspace.brand_website_url ?? '')
    setServices((workspace.icp_services as string[] | null) ?? [])
    setNiches((workspace.icp_niches as string[] | null) ?? [])
    setLocation(workspace.icp_city ?? '')
  }, [workspace])

  function isValidUrl(value: string): boolean {
    const v = value.trim()
    if (!v) return true
    try {
      const url = new URL(v)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  function toggleService(id: string) {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleNiche(niche: string) {
    setNiches((prev) =>
      prev.includes(niche) ? prev.filter((x) => x !== niche) : [...prev, niche]
    )
  }

  const selectedServices = SERVICES.filter((s) => services.includes(s.id))

  async function handleSave() {
    const trimmedUrl = websiteUrl.trim()
    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      toast.error('Enter a valid website URL (https://…)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/workspace/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_website_url: trimmedUrl || null,
          icp_services: services,
          icp_niches: niches,
          icp_city: location.trim() || null,
          icp_country: null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Profile saved.')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>
          Your profile
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.5 }}>
          Yuzuu uses this to score leads and generate outreach, keep it sharp.
        </p>
      </div>

      {/* Website URL */}
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Website URL</label>
          <input
            className="form-input"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://your-agency.com"
            autoComplete="url"
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
            Your agency site — used for context when scoring and reaching out to leads.
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <label className="form-label" style={{ marginBottom: 12 }}>Services you offer</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SERVICES.map((s) => (
            <Pill
              key={s.id}
              label={s.label}
              selected={services.includes(s.id)}
              onClick={() => toggleService(s.id)}
            />
          ))}
        </div>
      </div>

      {selectedServices.length > 0 && (
        <div
          className="page-enter card"
          style={{
            padding: '16px 20px',
            marginBottom: 12,
            borderLeft: '3px solid var(--accent)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: 'var(--text-3)',
              fontFamily: 'DM Mono, monospace',
              marginBottom: 10,
            }}
          >
            Scoring signals activated
          </div>
          {selectedServices.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                gap: 8,
                fontSize: 13,
                color: 'var(--text-2)',
                marginBottom: 6,
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>→</span>
              <span>
                <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{s.label}:</span>
                {' '}
                {s.signal}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Target niches */}
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Target business types</label>
          <button
            type="button"
            onClick={() => {
              const allNiches = [...NICHES, ...niches.filter((n) => !NICHES.includes(n))]
              const allSelected = allNiches.every((n) => niches.includes(n))
              setNiches(allSelected ? [] : allNiches)
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[...NICHES, ...niches.filter((n) => !NICHES.includes(n))].map((n) => (
            <Pill
              key={n}
              label={n}
              selected={niches.includes(n)}
              onClick={() => toggleNiche(n)}
            />
          ))}
          <AddCustomNiche onAdd={(v) => {
            if (!niches.includes(v)) setNiches((prev) => [...prev, v])
          }} />
        </div>
      </div>

      {/* Location */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Target location</label>
          <input
            className="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Paris, Île de France, France"
          />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5 }}>
            City, area or country, used when scanning for new leads.
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ padding: '10px 24px', fontSize: 14 }}
        onClick={handleSave}
        disabled={loading || (Boolean(websiteUrl.trim()) && !isValidUrl(websiteUrl))}
      >
        {loading ? <><span className="spinner" /> Saving…</> : 'Save profile'}
      </button>
    </div>
  )
}
