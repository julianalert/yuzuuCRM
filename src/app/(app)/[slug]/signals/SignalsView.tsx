'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Lead } from '@/lib/types'

type LeadWithSearch = Lead & {
  lead_searches: { category: string | null; city: string | null; country: string | null } | null
}

interface Props {
  leads: LeadWithSearch[]
  slug: string
}

type SignalId =
  | 'no_website'
  | 'low_rating'
  | 'few_reviews'
  | 'recently_opened'
  | 'no_review_reply'
  | 'low_web_quality'
  | 'low_seo'
  | 'no_social'

interface SignalDef {
  id: SignalId
  label: string
  icon: string
  bg: string
  getTitle: (l: LeadWithSearch) => string
  getMeta: (l: LeadWithSearch) => string
  requiresEnrichment: boolean
}

const SIGNAL_DEFS: SignalDef[] = [
  {
    id: 'no_website',
    label: 'No website',
    icon: '🌐',
    bg: '#FCEAEA',
    getTitle: (l) => `${l.name} — No website found`,
    getMeta: (l) => `No website · ${[l.lead_searches?.city, l.lead_searches?.country].filter(Boolean).join(', ')}`,
    requiresEnrichment: false,
  },
  {
    id: 'low_rating',
    label: 'Rating below 4 ⭐',
    icon: '⭐',
    bg: '#FEF6E7',
    getTitle: (l) => `${l.name} — Rated ${l.rating}/5`,
    getMeta: (l) => `Low rating · ${l.review_count ?? 0} reviews · ${l.category ?? ''}`,
    requiresEnrichment: false,
  },
  {
    id: 'few_reviews',
    label: 'Low review count 💬',
    icon: '💬',
    bg: '#FEF6E7',
    getTitle: (l) => `${l.name} — Only ${l.review_count ?? 0} reviews`,
    getMeta: (l) => `Low digital maturity · ${l.category ?? ''} · ${l.lead_searches?.city ?? ''}`,
    requiresEnrichment: false,
  },
  {
    id: 'recently_opened',
    label: 'Recently opened 🆕',
    icon: '🆕',
    bg: '#EBF5F0',
    getTitle: (l) => `${l.name} — Appears to be a new business`,
    getMeta: (l) => `New business · ${l.category ?? ''} · ${l.lead_searches?.city ?? ''}`,
    requiresEnrichment: false,
  },
  {
    id: 'no_review_reply',
    label: 'Not replying to reviews 🔇',
    icon: '🔇',
    bg: '#EBF1FA',
    getTitle: (l) => `${l.name} — Not responding to Google reviews`,
    getMeta: (l) => `Review management · ${l.owner_response_rate ?? 0}% response rate`,
    requiresEnrichment: true,
  },
  {
    id: 'low_web_quality',
    label: 'Low quality website 🖥️',
    icon: '🖥️',
    bg: '#FCEAEA',
    getTitle: (l) => `${l.name} — Website quality ${l.website_quality_score ?? '?'}/100`,
    getMeta: (l) => `Website redesign opportunity · ${l.category ?? ''}`,
    requiresEnrichment: true,
  },
  {
    id: 'low_seo',
    label: 'Poor SEO signals 🔍',
    icon: '🔍',
    bg: '#FCEAEA',
    getTitle: (l) => `${l.name} — Missing key SEO elements`,
    getMeta: (l) => `Local SEO opportunity · ${l.category ?? ''} · ${l.lead_searches?.city ?? ''}`,
    requiresEnrichment: true,
  },
  {
    id: 'no_social',
    label: 'No social presence 📱',
    icon: '📱',
    bg: '#F3F2EF',
    getTitle: (l) => `${l.name} — No social media profiles`,
    getMeta: (l) => `Social media opportunity · ${l.category ?? ''}`,
    requiresEnrichment: true,
  },
]

function getLeadSignals(lead: LeadWithSearch): SignalId[] {
  const signals: SignalId[] = []
  if (!lead.website) signals.push('no_website')
  if (lead.rating !== null && lead.rating < 4) signals.push('low_rating')
  if (lead.review_count !== null && lead.review_count < 20) signals.push('few_reviews')
  if (lead.review_count !== null && lead.review_count < 10) signals.push('recently_opened')
  if (lead.enrichment_status === 'done') {
    if (!lead.has_social_presence) signals.push('no_social')
    if (lead.owner_response_rate !== null && lead.owner_response_rate < 20) signals.push('no_review_reply')
    if (lead.website_quality_score !== null && lead.website_quality_score < 50) signals.push('low_web_quality')
    if (lead.website_quality_score !== null && lead.website_quality_score < 35) signals.push('low_seo')
  }
  return signals
}

function timeAgo(date: string) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function SignalsView({ leads, slug }: Props) {
  const [activeFilter, setActiveFilter] = useState<SignalId | 'all'>('all')

  // Explode: one row per (lead × signal)
  const rows = leads.flatMap((lead) =>
    getLeadSignals(lead).map((signalId) => ({ lead, signalId }))
  )

  const counts: Partial<Record<SignalId | 'all', number>> = { all: rows.length }
  for (const def of SIGNAL_DEFS) {
    counts[def.id] = rows.filter((r) => r.signalId === def.id).length
  }

  const filtered = activeFilter === 'all'
    ? rows
    : rows.filter((r) => r.signalId === activeFilter)

  const filters: Array<{ id: SignalId | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    ...SIGNAL_DEFS
      .filter((d) => (counts[d.id] ?? 0) > 0)
      .map((d) => ({ id: d.id, label: d.label })),
  ]

  const SIGNAL_DEF_MAP = Object.fromEntries(SIGNAL_DEFS.map((d) => [d.id, d])) as Record<SignalId, SignalDef>

  const unenrichedCount = leads.filter((l) => l.enrichment_status === 'none').length
  const lockedDefs = SIGNAL_DEFS.filter((d) => d.requiresEnrichment && (counts[d.id] ?? 0) === 0)

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.id}
            className={`btn btn-sm ${activeFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
            {counts[f.id] ? ` (${counts[f.id]})` : ''}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          {unenrichedCount > 0 && (
            <Link href={`/${slug}/leads`} className="btn btn-secondary btn-sm">
              ⚡ Enrich more leads
            </Link>
          )}
        </div>
      </div>

      {/* Enrichment nudge */}
      {unenrichedCount > 0 && leads.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--amber-bg, #FEF6E7)', border: '1px solid #f5c842',
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{unenrichedCount} leads</strong> haven&rsquo;t been enriched yet — enriching them unlocks{' '}
            <strong>4 more signal types</strong> (web quality, SEO, social presence, review replies).
          </div>
          <Link href={`/${slug}/leads`} style={{
            fontSize: 12, fontWeight: 600, color: 'var(--amber, #92580A)',
            textDecoration: 'none', padding: '4px 12px', borderRadius: 6,
            border: '1px solid #f5c842', background: '#fffbf0', whiteSpace: 'nowrap',
          }}>
            Enrich leads →
          </Link>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: '0 20px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-1)' }}>
                No signals yet
              </div>
              <div style={{ fontSize: 13 }}>
                {leads.length === 0
                  ? 'Run a lead search first — signals are detected automatically.'
                  : 'No leads match this signal type.'}
              </div>
              {leads.length === 0 && (
                <Link href={`/${slug}/leads`} className="btn btn-primary"
                  style={{ display: 'inline-flex', marginTop: 16, gap: 6, textDecoration: 'none' }}>
                  Find leads →
                </Link>
              )}
            </div>
          ) : (
            filtered.map(({ lead, signalId }, i) => {
              const def = SIGNAL_DEF_MAP[signalId]
              return (
                <div key={`${lead.id}-${signalId}-${i}`} className="signal-item">
                  <div className="signal-icon" style={{ background: def.bg, fontSize: 16 }}>
                    {def.icon}
                  </div>
                  <div className="signal-body">
                    <div className="signal-title">{def.getTitle(lead)}</div>
                    <div className="signal-meta">{def.getMeta(lead)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className="signal-time">{timeAgo(lead.created_at)}</span>
                    <Link href={`/${slug}/leads`} className="btn btn-secondary btn-sm">
                      View lead →
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Locked signals legend */}
      {leads.length > 0 && lockedDefs.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Locked — enrich leads to unlock:</span>
          {lockedDefs.map((def) => (
            <span key={def.id} style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 20,
              border: '1px dashed var(--border-2)', color: 'var(--text-3)',
            }}>
              {def.icon} {def.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
