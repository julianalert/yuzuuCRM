'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Icon, Icons } from '@/components/shared/Icon'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CompanyLogo } from '@/components/shared/CompanyLogo'
import type { Account, Contact, Signal, AccountStatus, User } from '@/lib/types'

const STATUS_OPTIONS: AccountStatus[] = ['new', 'contacted', 'in_progress', 'qualified', 'not_a_fit']
const STATUS_LABELS: Record<AccountStatus, string> = {
  new: 'New', contacted: 'Contacted', in_progress: 'In Progress',
  qualified: 'Qualified', not_a_fit: 'Not a Fit',
}

function Skeleton({ w = '100%', h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{ background: 'var(--border)', borderRadius: 4, height: h, width: w }} />
  )
}

interface AccountDetailData {
  account: Account
  contacts: Contact[]
  signals: Signal[]
}

export default function AccountDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()
  const router = useRouter()

  const [data, setData] = useState<AccountDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [rescoring, setRescoring] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tam/accounts/${id}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setData(d)
      setNotes(d.account.description ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load account')
      router.push(`/${slug}/tam`)
    } finally {
      setLoading(false)
    }
  }, [id, slug, router])

  useEffect(() => { load() }, [load])

  async function updateStatus(status: AccountStatus) {
    if (!data) return
    setData({ ...data, account: { ...data.account, status } })
    const res = await fetch(`/api/tam/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      load()
      toast.error('Failed to update status')
    } else {
      toast.success('Account status updated')
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/tam/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value }),
      })
      if (res.ok) {
        setNotesSaved(true)
        toast.success('Notes saved', { duration: 1500 })
      }
    }, 1000)
  }

  async function handleRescore() {
    setRescoring(true)
    try {
      const res = await fetch(`/api/tam/accounts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rescore' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      if (data) {
        setData({ ...data, account: { ...data.account, ai_score: d.score, ai_score_reason: d.reason } })
      }
      toast.success('Account rescored')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rescoring failed')
    } finally {
      setRescoring(false)
    }
  }

  if (loading) {
    return (
      <div className="page-enter" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <Skeleton h={24} w="60%" />
          <div style={{ marginTop: 16 }}><Skeleton h={80} /></div>
        </div>
        <div className="card" style={{ padding: 24 }}><Skeleton h={200} /></div>
      </div>
    )
  }

  if (!data) return null
  const { account, contacts, signals } = data

  return (
    <div className="page-enter">
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href={`/${slug}/tam`}
          style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Icon d={Icons.chevronRight} size={12} style={{ transform: 'rotate(180deg)' }} />
          Back to TAM
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Company header */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 48, height: 48, flexShrink: 0 }}>
                <CompanyLogo domain={account.domain ?? ''} name={account.name} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 4 }}>
                  {account.name}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-3)' }}>
                  {account.domain && <span>{account.domain}</span>}
                  {account.location && <span>📍 {account.location}</span>}
                  {account.employee_count && <span>👥 {account.employee_count.toLocaleString()} employees</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {account.linkedin_url && (
                  <a href={account.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    LinkedIn
                  </a>
                )}
                {account.website && (
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* AI Score card */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="card-title" style={{ marginBottom: 16 }}>AI Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                background: account.ai_score !== null && account.ai_score >= 75 ? 'var(--green-bg)' : account.ai_score !== null && account.ai_score >= 50 ? 'var(--amber-bg)' : 'var(--red-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700, fontFamily: 'DM Mono, monospace',
                color: account.ai_score !== null && account.ai_score >= 75 ? 'var(--green)' : account.ai_score !== null && account.ai_score >= 50 ? 'var(--amber)' : 'var(--red)',
              }}>
                {account.ai_score ?? '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {account.ai_score_reason ?? (account.ai_score === null ? 'Scoring pending…' : 'No reason provided')}
                </div>
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRescore}
              disabled={rescoring}
            >
              {rescoring ? 'Rescoring…' : '↻ Re-score'}
            </button>
          </div>

          {/* Contacts */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Contacts</span>
            </div>
            <div style={{ padding: '0 20px' }}>
              {contacts.length === 0 && (
                <div className="empty" style={{ padding: '32px 0' }}>
                  <div className="empty-sub">No contacts found for this account</div>
                </div>
              )}
              {contacts.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar" style={{ fontSize: 11 }}>
                    {(c.first_name[0] ?? '') + (c.last_name?.[0] ?? '')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                      {c.first_name} {c.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{c.title}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="btn btn-ghost btn-sm btn-icon">
                        <Icon d={Icons.mail} size={13} />
                      </a>
                    )}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        in
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="card-title">Notes</div>
              {notesSaved && <span style={{ fontSize: 11.5, color: 'var(--green)' }}>Saved ✓</span>}
            </div>
            <textarea
              className="form-input"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this account…"
              style={{ height: 100, resize: 'vertical', padding: 12, lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Status</div>
            <select
              className="form-input"
              value={account.status}
              onChange={(e) => updateStatus(e.target.value as AccountStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Company details */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Company Details</div>
            {account.industry && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Industry</div>
                <span className="tag">{account.industry}</span>
              </div>
            )}
            {account.funding_stage && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Funding</div>
                <span className="tag">{account.funding_stage}</span>
              </div>
            )}
            {account.technology_stack.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tech Stack</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {account.technology_stack.slice(0, 8).map((t) => (
                    <span key={t} className="tag" style={{ fontSize: 11.5 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Signals */}
          <div className="card">
            <div className="card-header"><span className="card-title">Signals</span></div>
            {signals.length === 0 ? (
              <div className="empty" style={{ padding: '28px 20px' }}>
                <div className="empty-sub">No signals yet</div>
              </div>
            ) : (
              <div style={{ padding: '0 20px' }}>
                {signals.slice(0, 5).map((s) => (
                  <div key={s.id} className="signal-item" style={{ padding: '12px 0' }}>
                    <div className="signal-body">
                      <div className="signal-title">{s.title}</div>
                      <div className="signal-meta">{s.type} · {new Date(s.detected_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity timeline placeholder */}
          <div className="card">
            <div className="card-header"><span className="card-title">Activity</span></div>
            <div className="empty" style={{ padding: '28px 20px' }}>
              <div className="empty-sub">Activity timeline coming in Step 3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
