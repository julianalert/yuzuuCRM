'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { trackLeadSearchCompleted, trackLeadViewed } from '@/lib/analytics/mixpanel-events'
import { Icon, Icons } from '@/components/shared/Icon'
import type { Workspace, Lead } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

// Leads joined with their parent search context
type LeadWithSearch = Lead & {
  lead_searches: { category: string | null; city: string | null; country: string | null } | null
}

type SignalChip = { type: string; severity: number }

interface Props {
  workspace: Workspace
  initialLeads: LeadWithSearch[]
  initialSignalsByLead?: Record<string, SignalChip[]>
  slug: string
}

type SortKey = 'intent_score' | 'surface_score' | 'opportunity_score' | 'rating' | 'review_count' | 'name'
type SortDir = 'asc' | 'desc'
type LeadTab = 'hot' | 'warm' | 'all' | 'backlog'

const SIGNAL_LABELS: Record<string, string> = {
  owner_unresponsive:          'Owner not replying',
  negative_review_streak:      'Negative reviews',
  review_velocity_drop:        'Reviews stopped',
  review_velocity_spike:       'Review surge',
  recently_opened:             'New business',
  no_tracking_pixel:           'No ads tracking',
  outdated_stack:              'Outdated site',
  no_booking_on_needs_booking: 'No booking',
  phone_only:                  'Phone-only',
  no_social:                   'No social',
  no_website:                  'No website',
  low_rating:                  'Low rating',
}

function SignalChips({ signals }: { signals: SignalChip[] | undefined }) {
  if (!signals || signals.length === 0) return null
  const top = signals.slice(0, 3)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {top.map((s) => (
        <span key={s.type} style={{
          fontSize: 10.5, fontWeight: 500,
          padding: '2px 7px', borderRadius: 999,
          background: 'rgba(245,200,66,0.18)', color: '#92660a',
        }}>
          {SIGNAL_LABELS[s.type] ?? s.type}
        </span>
      ))}
      {signals.length > top.length && (
        <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>+{signals.length - top.length}</span>
      )}
    </div>
  )
}

function RelevancePill({ relevance }: { relevance: string | null | undefined }) {
  if (!relevance) return null
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    hot:  { bg: 'rgba(229,83,75,0.14)', color: '#c03d35', label: 'Hot' },
    warm: { bg: 'rgba(245,200,66,0.18)', color: '#92660a', label: 'Warm' },
    cold: { bg: 'rgba(0,0,0,0.05)',      color: 'var(--text-3)', label: 'Cold' },
  }
  const s = styles[relevance] ?? styles.cold
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 7px',
      borderRadius: 20, background: s.bg, color: s.color,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {s.label}
    </span>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function searchLabel(lead: LeadWithSearch) {
  const s = lead.lead_searches
  if (!s) return null
  return [s.category, s.city, s.country].filter(Boolean).join(' · ')
}

function isNewToday(lead: Lead): boolean {
  const ts = (lead as Lead & { discovered_at?: string | null }).discovered_at
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < 24 * 60 * 60 * 1000
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 2) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return `${Math.floor(diffHrs / 24)}d ago`
}

function ScoreBadge({ score, enriched }: { score: number | null; enriched?: boolean }) {
  if (score === null) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
  const color = score >= 75
    ? 'var(--green, #2da44e)'
    : score >= 50 ? 'var(--accent)' : 'var(--text-3)'
  return (
    <span style={{ fontWeight: 700, fontSize: 13, color: enriched ? color : 'var(--text-2)' }}>
      {score}
      {enriched && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 1 }}>/100</span>}
    </span>
  )
}

// ── Search Modal ──────────────────────────────────────────────────────────────

function SearchModal({
  workspace,
  slug,
  onClose,
  onResults,
}: {
  workspace: Workspace
  slug: string
  onClose: () => void
  onResults: (leads: LeadWithSearch[], trialLimited: boolean) => void
}) {
  const [category, setCategory] = useState(workspace.icp_category ?? '')
  const [city, setCity] = useState(workspace.icp_city ?? '')
  const [country, setCountry] = useState(workspace.icp_country ?? '')
  const [maxResults, setMaxResults] = useState(20)
  const [offerDescription, setOfferDescription] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('yuzuu-offer') ?? workspace.offer_description ?? ''
    }
    return workspace.offer_description ?? ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && offerDescription) {
      localStorage.setItem('yuzuu-offer', offerDescription)
    }
  }, [offerDescription])

  // Close on backdrop click or Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSearch() {
    if (!category.trim() || !city.trim() || !country.trim()) {
      toast.error('Category, city, and country are required.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, city, country, maxResults, offerDescription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')

      // Attach mock search context so rows show immediately without a page reload
      const enriched: LeadWithSearch[] = (data.leads ?? []).map((l: Lead) => ({
        ...l,
        lead_searches: { category, city, country },
      }))

      toast.success(`Found ${enriched.length} leads`)
      trackLeadSearchCompleted({
        workspace_slug: slug,
        category: category.trim(),
        city: city.trim(),
        country: country.trim(),
        leads_found: enriched.length,
        max_results: maxResults,
        trial_limited: data.trialLimited ?? false,
      })
      onResults(enriched, data.trialLimited ?? false)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '100%', maxWidth: 560, padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New search</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <Icon d={Icons.x} size={15} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <label className="form-label">Business category</label>
            <input
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Restaurant, Plumber, Hair salon"
              autoFocus
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">City</label>
            <input
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Paris"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Country</label>
            <input
              className="form-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. France"
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Max results</label>
          <select
            className="form-input"
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            style={{ cursor: 'pointer' }}
          >
            <option value={10}>10 leads</option>
            <option value={20}>20 leads</option>
            <option value={50}>50 leads</option>
            <option value={100}>100 leads</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 22 }}>
          <label className="form-label">Your offer (used for AI scoring)</label>
          <textarea
            className="form-input"
            value={offerDescription}
            onChange={(e) => setOfferDescription(e.target.value)}
            placeholder="e.g. We help local restaurants get more bookings through Google Ads and social media."
            style={{ height: 72, resize: 'vertical', padding: 10, lineHeight: 1.5, fontSize: 13 }}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14 }}
          onClick={handleSearch}
          disabled={loading || !category.trim() || !city.trim() || !country.trim()}
        >
          {loading ? (
            <><span className="spinner" /> Searching Google Maps…</>
          ) : (
            <><Icon d={Icons.search} size={14} /> Search leads</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Lead Profile Panel ────────────────────────────────────────────────────────

function LeadProfile({
  lead,
  onClose,
  onEnrich,
  credits,
  slug,
}: {
  lead: LeadWithSearch
  onClose: () => void
  onEnrich: (leadId: string) => Promise<void>
  credits: number
  slug: string
}) {
  const [enriching, setEnriching] = useState(false)
  const [copied, setCopied] = useState(false)

  const isEnriched = lead.enrichment_status === 'done'
  const isLoading = lead.enrichment_status === 'loading'

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleEnrich() {
    setEnriching(true)
    await onEnrich(lead.id)
    setEnriching(false)
  }

  function copyEmail() {
    if (lead.outreach_email) {
      navigator.clipboard.writeText(lead.outreach_email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
      zIndex: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3, wordBreak: 'break-word' }}>
            {lead.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{lead.category}</span>
            {searchLabel(lead) && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span>Found in: {searchLabel(lead)}</span>
              </>
            )}
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ flexShrink: 0 }}>
          <Icon d={Icons.x} size={15} />
        </button>
      </div>

      <div style={{ padding: 22, flex: 1 }}>
        {/* Score cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          <div className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Surface score
            </div>
            <ScoreBadge score={lead.surface_score} />
          </div>
          <div className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Opportunity
            </div>
            {isEnriched ? (
              <ScoreBadge score={lead.opportunity_score} enriched />
            ) : isLoading ? (
              <span className="spinner" style={{ display: 'inline-block' }} />
            ) : (
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Enrich to unlock</span>
            )}
          </div>
        </div>

        {/* Score bar + reasoning */}
        {isEnriched && lead.opportunity_score !== null && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ height: 7, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%',
                width: `${lead.opportunity_score}%`,
                background: lead.opportunity_score >= 70 ? 'var(--green, #2da44e)' : lead.opportunity_score >= 45 ? 'var(--accent)' : 'var(--text-3)',
                borderRadius: 8, transition: 'width 0.6s ease',
              }} />
            </div>
            {lead.score_reasoning && (
              <div className="card" style={{ padding: 12, background: 'var(--bg)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Why this score
                </div>
                {lead.score_reasoning.split('\n').filter(Boolean).map((line, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>•</span>
                    <span>{line.replace(/^[•\-*]\s*/, '')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contact info */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Contact info
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lead.address && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'flex-start' }}>
                <Icon d={Icons.leads} size={13} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
                <span>{lead.address}</span>
              </div>
            )}
            {lead.phone && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                <Icon d={Icons.phone} size={13} style={{ color: 'var(--text-3)' }} />
                <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-1)' }}>{lead.phone}</a>
              </div>
            )}
            {lead.website && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                <Icon d={Icons.integrations} size={13} style={{ color: 'var(--text-3)' }} />
                <a href={lead.website} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {lead.google_maps_url && (
              <div style={{ display: 'flex', gap: 8, fontSize: 13, alignItems: 'center' }}>
                <Icon d={Icons.search} size={13} style={{ color: 'var(--text-3)' }} />
                <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                  View on Google Maps
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Enriched tags */}
        {isEnriched && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Digital presence
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {lead.has_booking_system && (
                <span className="tag" style={{ background: 'rgba(45,164,78,0.12)', color: 'var(--green, #2da44e)' }}>Has booking</span>
              )}
              {lead.has_social_presence && (
                <span className="tag" style={{ background: 'rgba(45,164,78,0.12)', color: 'var(--green, #2da44e)' }}>Social presence</span>
              )}
              {!lead.website && (
                <span className="tag" style={{ background: 'rgba(229,83,75,0.12)', color: 'var(--red, #e5534b)' }}>No website</span>
              )}
              {lead.review_sentiment && (
                <span className="tag">Reviews: {lead.review_sentiment}</span>
              )}
              {lead.website_quality_score !== null && (
                <span className="tag">Web quality: {lead.website_quality_score}/100</span>
              )}
              {Array.isArray(lead.website_tech) && (lead.website_tech as string[]).map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Outreach email */}
        {isEnriched && lead.outreach_email && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Outreach email
              </div>
              <button onClick={copyEmail} className="btn btn-ghost btn-sm" style={{ fontSize: 12, padding: '3px 8px', gap: 4 }}>
                <Icon d={copied ? Icons.check : Icons.mail} size={12} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="card" style={{
              padding: 14, background: 'var(--bg)', fontSize: 12.5, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: 260, overflowY: 'auto', color: 'var(--text-2)',
            }}>
              {lead.outreach_email}
            </div>
          </div>
        )}

        {/* Enrich CTA */}
        {!isEnriched && !isLoading && (
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>Unlock full profile</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.5 }}>
              Get opportunity score, AI outreach email, website analysis, and social presence.
            </div>
            {credits > 0 ? (
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleEnrich}
                disabled={enriching}
              >
                {enriching ? <><span className="spinner" /> Enriching…</> : <>Enrich — 1 credit ({credits} left)</>}
              </button>
            ) : (
              <Link href={`/${slug}/settings/billing`} className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                Upgrade to get more credits
              </Link>
            )}
          </div>
        )}

        {isLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: 16,
            borderRadius: 10, border: '1px solid var(--border)', fontSize: 13.5, color: 'var(--text-2)',
          }}>
            <span className="spinner" />
            Enriching… this takes 10–20 seconds.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Enrich Button (inline table action) ──────────────────────────────────────

function EnrichButton({ lead, onEnrich, credits }: {
  lead: LeadWithSearch
  onEnrich: (id: string) => Promise<void>
  credits: number
}) {
  const [enriching, setEnriching] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (lead.enrichment_status !== 'none' && lead.enrichment_status !== 'error') return
    setEnriching(true)
    await onEnrich(lead.id)
    setEnriching(false)
  }

  if (lead.enrichment_status === 'done') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--green, #2da44e)', fontWeight: 600 }}>
        <Icon d={Icons.check} size={12} /> Enriched
      </span>
    )
  }

  if (lead.enrichment_status === 'loading' || enriching) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-3)' }}>
        <span className="spinner" style={{ width: 12, height: 12 }} /> Enriching…
      </span>
    )
  }

  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{ fontSize: 12, padding: '4px 10px', opacity: credits === 0 ? 0.5 : 1 }}
      onClick={handleClick}
      disabled={credits === 0}
      title={credits === 0 ? 'No credits remaining' : 'Enrich this lead'}
    >
      <Icon d={Icons.zap} size={12} /> Enrich
    </button>
  )
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function LeadFinderView({ workspace, initialLeads, initialSignalsByLead, slug }: Props) {
  const [leads, setLeads] = useState<LeadWithSearch[]>(initialLeads)
  const [signalsByLead, setSignalsByLead] = useState<Record<string, SignalChip[]>>(initialSignalsByLead ?? {})
  const [selectedLead, setSelectedLead] = useState<LeadWithSearch | null>(null)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [trialLimited, setTrialLimited] = useState(false)
  const [credits, setCredits] = useState(workspace.enrichment_credits ?? 0)
  const [searching, setSearching] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('intent_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tab, setTab] = useState<LeadTab>(() => {
    if (typeof window === 'undefined') return 'hot'
    const t = new URLSearchParams(window.location.search).get('tab')
    return (t === 'hot' || t === 'warm' || t === 'all' || t === 'backlog') ? t : 'hot'
  })
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const searchParams = useSearchParams()
  const [agentLastRan, setAgentLastRan] = useState<string | null>(null)
  const [agentRunning, setAgentRunning] = useState(() => searchParams.get('agentRunning') === '1')
  const agentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!selectedLead?.id) return
    trackLeadViewed({
      workspace_slug: slug,
      lead_id: selectedLead.id,
      lead_name: selectedLead.name ?? '',
    })
  }, [selectedLead?.id, selectedLead?.name, slug])

  // Clean the ?agentRunning param from the URL immediately, and set a
  // safety timeout so the banner never hangs forever if the agent silently fails.
  useEffect(() => {
    if (!agentRunning) return

    const url = new URL(window.location.href)
    url.searchParams.delete('agentRunning')
    window.history.replaceState({}, '', url.toString())

    // Auto-dismiss after 90s as a safety net
    agentTimeoutRef.current = setTimeout(() => setAgentRunning(false), 90_000)
    return () => {
      if (agentTimeoutRef.current) clearTimeout(agentTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load last agent run time for the status bar
  useEffect(() => {
    supabase
      .from('agent_runs')
      .select('ran_at')
      .eq('workspace_id', workspace.id)
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.ran_at) setAgentLastRan(data.ran_at)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: subscribe to lead inserts (agent) and updates (enrichment)
  useEffect(() => {
    const channel = supabase
      .channel('leads-workspace')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `workspace_id=eq.${workspace.id}` },
        (payload) => {
          const inserted = payload.new as Lead
          // Prepend agent-inserted leads; avoid duplicates
          setLeads((prev) => {
            if (prev.some((l) => l.id === inserted.id)) return prev
            return [{ ...inserted, lead_searches: null }, ...prev]
          })
          setAgentLastRan(new Date().toISOString())
          // Dismiss the "agent running" banner and surface a toast on first lead
          setAgentRunning((wasRunning) => {
            if (wasRunning) {
              if (agentTimeoutRef.current) clearTimeout(agentTimeoutRef.current)
              toast.success('First leads found! More are on the way.')
            }
            return false
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `workspace_id=eq.${workspace.id}` },
        (payload) => {
          const updated = payload.new as Lead
          setLeads((prev) =>
            prev.map((l) =>
              l.id === updated.id
                ? { ...updated, lead_searches: l.lead_searches }
                : l
            )
          )
          setSelectedLead((prev) =>
            prev?.id === updated.id
              ? { ...updated, lead_searches: prev.lead_searches }
              : prev
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // supabase is stabilised via useRef — intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id])

  // Realtime: lead_signals inserts (signals appear as the runner detects them)
  useEffect(() => {
    const channel = supabase
      .channel('lead-signals-workspace')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lead_signals', filter: `workspace_id=eq.${workspace.id}` },
        (payload) => {
          const s = payload.new as { lead_id: string; type: string; severity: number }
          setSignalsByLead((prev) => {
            const existing = prev[s.lead_id] ?? []
            if (existing.some((e) => e.type === s.type)) return prev
            return { ...prev, [s.lead_id]: [...existing, { type: s.type, severity: s.severity }].sort((a, b) => b.severity - a.severity) }
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id])

  // Polling fallback while the agent is running.
  // Covers the case where the Supabase Realtime channel doesn't deliver
  // the INSERT event (publication not yet configured, cold connection, etc.).
  // Stops as soon as leads appear or agentRunning flips to false.
  useEffect(() => {
    if (!agentRunning) return
    let cancelled = false

    const poll = setInterval(async () => {
      if (cancelled) return
      const { data } = await supabase
        .from('leads')
        .select('*, lead_searches(category, city, country)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (cancelled || !data || data.length === 0) return

      cancelled = true
      clearInterval(poll)
      setLeads((prev) => {
        const existingIds = new Set(prev.map((l) => l.id))
        const incoming = (data as LeadWithSearch[]).filter((l) => !existingIds.has(l.id))
        return incoming.length > 0 ? [...incoming, ...prev] : prev
      })
      if (agentTimeoutRef.current) clearTimeout(agentTimeoutRef.current)
      setAgentRunning(false)
    }, 3000)

    return () => { cancelled = true; clearInterval(poll) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentRunning, workspace.id])

  function handleNewResults(newLeads: LeadWithSearch[], limited: boolean) {
    setLeads((prev) => [...newLeads, ...prev])
    setTrialLimited(limited)
  }

  async function handleQuickSearch() {
    setSearching(true)
    try {
      const res = await fetch('/api/agent/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')

      if (data.skipped) {
        toast.info(data.skipReason ?? 'No new leads found right now — try again later')
      } else {
        toast.success(`Found ${data.leadsFound} new opportunities`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleEnrich = useCallback(async (leadId: string) => {
    try {
      const res = await fetch('/api/leads/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Enrichment failed')
        return
      }
      if (data.creditsRemaining !== undefined) setCredits(data.creditsRemaining)
    } catch {
      toast.error('Enrichment request failed')
    }
  }, [])

  // Sort
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const tabCounts = leads.reduce((acc, l) => {
    const archived = (l as Lead & { archived_at?: string | null }).archived_at != null
    const relevance = (l as Lead & { relevance?: string }).relevance ?? 'cold'
    if (archived) acc.backlog++
    else if (relevance === 'hot') acc.hot++
    else if (relevance === 'warm') acc.warm++
    acc.all++
    return acc
  }, { hot: 0, warm: 0, all: 0, backlog: 0 })

  const filtered = leads.filter((l) => {
    const archived = (l as Lead & { archived_at?: string | null }).archived_at != null
    const relevance = (l as Lead & { relevance?: string }).relevance ?? 'cold'
    switch (tab) {
      case 'hot':     return !archived && relevance === 'hot'
      case 'warm':    return !archived && relevance === 'warm'
      case 'backlog': return archived || relevance === 'cold'
      case 'all':     return !archived
    }
  })

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    const bVal = b[sortKey] ?? (sortDir === 'desc' ? -Infinity : Infinity)
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'desc' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
    }
    return sortDir === 'desc' ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal)
  })

  function SortTh({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <th onClick={() => toggleSort(k)} style={{
        padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
        fontSize: 11.5, fontWeight: 600, color: active ? 'var(--text-1)' : 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: 0.3, userSelect: 'none', whiteSpace: 'nowrap',
      }}>
        {label}{active && <span style={{ marginLeft: 4 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </th>
    )
  }

  const StaticTh = ({ label }: { label: string }) => (
    <th style={{
      padding: '10px 12px', fontSize: 11.5, fontWeight: 600,
      color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
    }}>{label}</th>
  )

  return (
    <>
    <div className="page-enter">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: agentLastRan ? 12 : 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>Leads</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
            {leads.length > 0
              ? `${leads.length} leads · Your agent finds new leads every day, you can look for new opportunities now if you can't wait`
              : 'Your agent scans Google Maps daily and surfaces the best leads for your offer'}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleQuickSearch}
          disabled={searching}
          style={{ gap: 6 }}
        >
          {searching ? (
            <><span className="spinner" /> Searching…</>
          ) : (
            <><Icon d={Icons.search} size={14} /> Find more opportunities now</>
          )}
        </button>
      </div>

      {/* Quick search in-progress banner */}
      {searching && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
          padding: '14px 18px', borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <span className="spinner" style={{
            flexShrink: 0, width: 18, height: 18,
            borderColor: 'rgba(0,0,0,0.12)', borderTopColor: 'var(--text-1)',
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
              Looking for new opportunities…
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Scanning Google Maps for up to 50 leads. This takes about 20–30 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Agent running banner — shown right after onboarding while the first search is in-flight */}
      {agentRunning && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20,
          padding: '14px 18px', borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <span className="spinner" style={{
            flexShrink: 0, width: 18, height: 18,
            borderColor: 'rgba(0,0,0,0.12)', borderTopColor: 'var(--text-1)',
          }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
              Your agent is scanning Google Maps…
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Generating your search plan and finding leads tailored to your offer. This takes about 20–30 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Agent status bar — shown after the agent has already run */}
      {!agentRunning && agentLastRan && (() => {
        const ranAt = new Date(agentLastRan).getTime()
        const leadsFound = leads.filter(l => {
          const diff = new Date((l as Lead & { created_at?: string }).created_at ?? '').getTime() - ranAt
          return diff >= -60 * 60 * 1000 && diff <= 2 * 60 * 60 * 1000
        }).length
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            fontSize: 12, color: 'var(--text-3)',
          }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: 'var(--green, #2da44e)',
            }} />
            Agent last ran {formatRelativeTime(agentLastRan)} · found {leadsFound} {leadsFound === 1 ? 'lead' : 'leads'} · runs daily at 7am UTC
          </div>
        )
      })()}

      {/* Trial limit banner */}
      {trialLimited && (
        <div style={{
          marginBottom: 20, padding: '14px 18px', borderRadius: 10,
          background: 'linear-gradient(135deg, #fef9ec, #fff8e6)',
          border: '1px solid #f5c842', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#92660a' }}>
              Free trial — limited to 10 leads per search
            </div>
            <div style={{ fontSize: 12, color: '#b07c1a', marginTop: 2 }}>
              Upgrade to Starter to search up to 50 leads at once
            </div>
          </div>
          <Link href={`/${slug}/settings/billing`} style={{
            fontSize: 12.5, fontWeight: 600, color: '#92660a', textDecoration: 'none',
            padding: '5px 12px', borderRadius: 6, border: '1px solid #f5c842',
            background: '#fffbf0', whiteSpace: 'nowrap',
          }}>
            Upgrade →
          </Link>
        </div>
      )}

      {/* Relevance tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}>
        {([
          { id: 'hot',     label: 'Hot',          count: tabCounts.hot },
          { id: 'warm',    label: 'Worth a look', count: tabCounts.warm },
          { id: 'all',     label: 'All',          count: tabCounts.all },
          { id: 'backlog', label: 'Backlog',      count: tabCounts.backlog },
        ] as const).map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'transparent', border: 'none',
                padding: '8px 14px', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--text-1)' : 'var(--text-3)',
                borderBottom: active ? '2px solid var(--text-1)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
              <span style={{
                marginLeft: 6, fontSize: 11, padding: '1px 7px', borderRadius: 999,
                background: active ? 'var(--text-1)' : 'var(--border)',
                color: active ? '#fff' : 'var(--text-3)',
                fontWeight: 600,
              }}>{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* Leads table */}
      {sorted.length > 0 ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <SortTh label="Business" k="name" />
                  <SortTh label="Intent" k="intent_score" />
                  <SortTh label="Surface" k="surface_score" />
                  <SortTh label="Opportunity" k="opportunity_score" />
                  <SortTh label="Rating" k="rating" />
                  <SortTh label="Reviews" k="review_count" />
                  <StaticTh label="Website" />
                  <StaticTh label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((lead, i) => {
                  const label = searchLabel(lead)
                  const isSelected = selectedLead?.id === lead.id
                  const relevance = (lead as Lead & { relevance?: string }).relevance
                  const intentScore = (lead as Lead & { intent_score?: number | null }).intent_score
                  const leadSignals = signalsByLead[lead.id]
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(isSelected ? null : lead)}
                      style={{
                        borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--bg)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* Business */}
                      <td style={{ padding: '12px 12px', maxWidth: 320 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{lead.name ?? '—'}</span>
                          <RelevancePill relevance={relevance} />
                          {isNewToday(lead) && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                              background: 'rgba(45,164,78,0.14)', color: 'var(--green, #2da44e)',
                              letterSpacing: '0.05em', textTransform: 'uppercase',
                            }}>
                              New
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                          {lead.category ?? '—'}
                          {label && <span style={{ marginLeft: 6 }}>· {label}</span>}
                        </div>
                        <SignalChips signals={leadSignals} />
                      </td>
                      {/* Intent score */}
                      <td style={{ padding: '12px 12px' }}>
                        <ScoreBadge score={intentScore ?? null} enriched={intentScore != null && intentScore >= 60} />
                      </td>
                      {/* Surface score */}
                      <td style={{ padding: '12px 12px' }}>
                        <ScoreBadge score={lead.surface_score} />
                      </td>
                      {/* Opportunity score */}
                      <td style={{ padding: '12px 12px' }}>
                        {lead.enrichment_status === 'done' ? (
                          <ScoreBadge score={lead.opportunity_score} enriched />
                        ) : lead.enrichment_status === 'loading' ? (
                          <span className="spinner" style={{ display: 'inline-block', width: 14, height: 14 }} />
                        ) : (
                          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      {/* Rating */}
                      <td style={{ padding: '12px 12px', fontSize: 13 }}>
                        {lead.rating !== null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Icon d={Icons.star} size={12} style={{ color: '#f5c842' }} />
                            {lead.rating}
                          </span>
                        ) : '—'}
                      </td>
                      {/* Reviews */}
                      <td style={{ padding: '12px 12px', fontSize: 13, color: 'var(--text-2)' }}>
                        {lead.review_count ?? '—'}
                      </td>
                      {/* Website pill */}
                      <td style={{ padding: '12px 12px' }}>
                        {lead.website ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5,
                            padding: '2px 8px', borderRadius: 20,
                            background: 'rgba(45,164,78,0.12)', color: 'var(--green, #2da44e)', fontWeight: 600,
                          }}>✓ Yes</span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5,
                            padding: '2px 8px', borderRadius: 20,
                            background: 'rgba(229,83,75,0.1)', color: 'var(--red, #e5534b)', fontWeight: 600,
                          }}>✗ No</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '12px 12px' }} onClick={(e) => e.stopPropagation()}>
                        <EnrichButton lead={lead} onEnrich={handleEnrich} credits={credits} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '80px 24px', textAlign: 'center',
          border: '2px dashed var(--border)', borderRadius: 14,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
          {agentRunning ? (
            <div style={{ fontSize: 13.5, color: 'var(--text-3)', maxWidth: 380, lineHeight: 1.6 }}>
              Your agent is scanning Google Maps right now — leads will appear here in a few seconds.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No leads yet</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 24, maxWidth: 380, lineHeight: 1.6 }}>
                Your agent scans Google Maps daily and surfaces the best leads for your offer. Can't wait? Find new opportunities now.
              </div>
              <button className="btn btn-primary" onClick={handleQuickSearch} disabled={searching} style={{ gap: 6 }}>
                {searching ? (
                  <><span className="spinner" /> Searching…</>
                ) : (
                  <><Icon d={Icons.search} size={14} /> Find more opportunities now</>
                )}
              </button>
            </>
          )}
        </div>
      )}

    </div>

    {/* Search modal — outside animated wrapper to avoid transform containing-block issue */}
    {showSearchModal && (
      <SearchModal
        workspace={workspace}
        slug={slug}
        onClose={() => setShowSearchModal(false)}
        onResults={handleNewResults}
      />
    )}

    {/* Lead profile panel + backdrop — must be outside page-enter div whose
        transform:translateY(0) (fill-mode forwards) would create a new containing
        block and prevent position:fixed from escaping to the viewport */}
    {selectedLead && (
      <>
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 199, backdropFilter: 'blur(1px)' }}
          onClick={() => setSelectedLead(null)}
        />
        <LeadProfile
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onEnrich={handleEnrich}
          credits={credits}
          slug={slug}
        />
      </>
    )}
    </>
  )
}
