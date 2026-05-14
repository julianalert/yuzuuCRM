'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Lead } from '@/lib/types'

type LeadWithSearch = Lead & {
  lead_searches: { category: string | null; city: string | null; country: string | null } | null
}

interface DbSignal {
  id: string
  lead_id: string
  type: string
  severity: number
  evidence: unknown
  detected_at: string
}

interface Props {
  leads: LeadWithSearch[]
  signals: DbSignal[]
  slug: string
}

// ── UI metadata for every signal type produced by signal-detectors.ts ─────

interface SignalMeta {
  label: string
  icon: string
  bg: string
  describe: (lead: LeadWithSearch, signal: DbSignal) => string
}

function ev(s: DbSignal): Record<string, unknown> {
  return (s.evidence as Record<string, unknown> | null) ?? {}
}

const SIGNAL_META: Record<string, SignalMeta> = {
  no_website: {
    label: 'No website', icon: '🌐', bg: '#FCEAEA',
    describe: (l) => `${l.name ?? 'This lead'} doesn't have a website yet — full web build opportunity.`,
  },
  low_rating: {
    label: 'Low rating', icon: '⭐', bg: '#FEF6E7',
    describe: (l, s) => {
      const r = (ev(s).rating as number | undefined) ?? l.rating ?? 0
      return `Rated ${r}/5 on Google — reputation management opportunity.`
    },
  },
  negative_review_streak: {
    label: 'Negative reviews streak', icon: '📉', bg: '#FCEAEA',
    describe: (_l, s) => {
      const e = ev(s)
      const n = (e.negative_count as number | undefined) ?? 0
      const w = (e.window as number | undefined) ?? 5
      return `${n} of the last ${w} reviews were negative. They need help now.`
    },
  },
  review_velocity_drop: {
    label: 'Reviews stopped', icon: '🔕', bg: '#EBF1FA',
    describe: (_l, s) => {
      const days = (ev(s).days_silent as number | undefined) ?? 0
      return `No new reviews in ${days} days — visibility is dropping.`
    },
  },
  review_velocity_spike: {
    label: 'Reviews surging', icon: '📈', bg: '#EBF5F0',
    describe: (_l, s) => {
      const n = (ev(s).recent_30d as number | undefined) ?? 0
      return `${n} new reviews in the last 30 days — momentum and openness to spend.`
    },
  },
  recently_opened: {
    label: 'Recently opened', icon: '🆕', bg: '#EBF5F0',
    describe: (_l, s) => {
      const months = (ev(s).age_months as number | undefined) ?? 0
      return `Business opened ~${Math.round(months)} months ago — needs the full stack.`
    },
  },
  owner_unresponsive: {
    label: 'Owner not replying', icon: '🔇', bg: '#EBF1FA',
    describe: (_l, s) => {
      const rate = (ev(s).reply_rate as number | undefined) ?? 0
      return `Owner replies to only ${Math.round(rate * 100)}% of reviews — review management gap.`
    },
  },
  no_tracking_pixel: {
    label: 'No ads tracking', icon: '📊', bg: '#FEF6E7',
    describe: () => 'No GA or Pixel detected — running ads blind, perfect upsell.',
  },
  outdated_stack: {
    label: 'Outdated website', icon: '🖥️', bg: '#FCEAEA',
    describe: (_l, s) => {
      const tech = (ev(s).tech_hints as string[] | undefined)?.join(', ') ?? 'legacy stack'
      return `Built on ${tech} — redesign opportunity.`
    },
  },
  no_booking_on_needs_booking: {
    label: 'No booking system', icon: '📅', bg: '#FCEAEA',
    describe: (l) => `${l.category ?? 'This business'} typically needs online booking — currently missing.`,
  },
  phone_only: {
    label: 'Phone-only', icon: '☎️', bg: '#FEF6E7',
    describe: () => 'No website, only a phone — AI receptionist or web build opportunity.',
  },
  no_social: {
    label: 'No social presence', icon: '📱', bg: '#F3F2EF',
    describe: () => 'No social channels detected on the website — full content opportunity.',
  },
}

function fallbackMeta(type: string): SignalMeta {
  return {
    label: type, icon: '⚪', bg: '#F3F2EF',
    describe: () => 'Detected signal',
  }
}

function timeAgo(date: string) {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

export function SignalsView({ leads, signals, slug }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const leadsById = new Map(leads.map((l) => [l.id, l]))

  // Pair each signal with its lead (drop signals whose lead is archived /
  // not in the current page result).
  const rows = signals
    .map((s) => {
      const lead = leadsById.get(s.lead_id)
      return lead ? { lead, signal: s } : null
    })
    .filter((r): r is { lead: LeadWithSearch; signal: DbSignal } => r !== null)

  // Filter buttons reflect what's actually in the dataset
  const counts: Record<string, number> = { all: rows.length }
  for (const r of rows) counts[r.signal.type] = (counts[r.signal.type] ?? 0) + 1

  const filtered = activeFilter === 'all'
    ? rows
    : rows.filter((r) => r.signal.type === activeFilter)

  const filters: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All' },
    ...Object.keys(counts)
      .filter((k) => k !== 'all')
      .sort((a, b) => counts[b] - counts[a])
      .map((id) => ({ id, label: (SIGNAL_META[id] ?? fallbackMeta(id)).label })),
  ]

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
      </div>

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
                  ? 'Your agent will detect signals as it discovers leads.'
                  : 'No signals match this filter.'}
              </div>
              {leads.length === 0 && (
                <Link href={`/${slug}/leads`} className="btn btn-primary"
                  style={{ display: 'inline-flex', marginTop: 16, gap: 6, textDecoration: 'none' }}>
                  Open leads →
                </Link>
              )}
            </div>
          ) : (
            filtered.map(({ lead, signal }) => {
              const meta = SIGNAL_META[signal.type] ?? fallbackMeta(signal.type)
              return (
                <div key={signal.id} className="signal-item">
                  <div className="signal-icon" style={{ background: meta.bg, fontSize: 16 }}>
                    {meta.icon}
                  </div>
                  <div className="signal-body">
                    <div className="signal-title">
                      {lead.name ?? '—'}
                      <span style={{
                        marginLeft: 8, fontSize: 10.5, fontWeight: 700,
                        padding: '1px 7px', borderRadius: 20,
                        background: meta.bg, color: 'var(--text-2)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="signal-meta">{meta.describe(lead, signal)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className="signal-time">{timeAgo(signal.detected_at)}</span>
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
    </div>
  )
}
