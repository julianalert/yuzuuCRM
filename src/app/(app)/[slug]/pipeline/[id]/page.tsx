'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import type { Deal, Account, Activity, User, Contact } from '@/lib/types'
import { Icon, Icons } from '@/components/shared/Icon'

type DealFactor = { label: string; status: 'positive' | 'neutral' | 'negative'; detail: string }

type FullDeal = Deal & {
  accounts?: Account | null
  contacts?: Contact | null
  users?: User | null
}

const STAGES: { value: Deal['stage']; label: string }[] = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'demo', label: 'Demo' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
]

const ACTIVITY_ICONS: Record<string, string> = {
  email: '📧', meeting: '📅', call: '📞', note: '📝', linkedin: '💼',
}

function scoreColor(score: number) {
  if (score >= 70) return 'var(--green)'
  if (score >= 40) return 'var(--amber)'
  return 'var(--red)'
}

function scoreLabel(score: number) {
  if (score >= 80) return 'Healthy'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'At risk'
  return 'Stalling'
}

export default function DealDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>()
  const router = useRouter()

  const [deal, setDeal] = useState<FullDeal | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [scoring, setScoring] = useState(false)
  const [notes, setNotes] = useState('')
  const [logType, setLogType] = useState<'note' | 'call' | 'meeting'>('note')
  const [logBody, setLogBody] = useState('')
  const [loggingActivity, setLoggingActivity] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')

  const fetchDeal = useCallback(async () => {
    const [dealRes, activitiesRes] = await Promise.all([
      fetch(`/api/pipeline/deals/${id}`),
      fetch(`/api/pipeline/deals/${id}/activities`),
    ])

    const dealData = await dealRes.json() as { deal?: FullDeal }
    if (dealData.deal) {
      setDeal(dealData.deal)
      setNotes(dealData.deal.notes ?? '')
      setNameValue(dealData.deal.name)
    }

    const actData = await activitiesRes.json() as { activities?: Activity[] }
    setActivities(actData.activities ?? [])

    setLoading(false)
  }, [id])

  useEffect(() => {
    void fetchDeal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])


  async function updateDeal(patch: Partial<Deal>) {
    const res = await fetch(`/api/pipeline/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json() as { deal?: FullDeal }
    if (res.ok && data.deal) {
      setDeal(prev => prev ? { ...prev, ...data.deal } : data.deal!)
    } else {
      toast.error('Failed to update deal')
    }
  }

  async function handleStageChange(stage: Deal['stage']) {
    setDeal(prev => prev ? { ...prev, stage } : prev)
    await updateDeal({ stage })
  }

  async function handleCloseWon() {
    await updateDeal({ stage: 'closed_won' })
    toast.success('Deal marked as Closed Won 🎉')
  }

  async function handleCloseLost() {
    await updateDeal({ stage: 'closed_lost' })
    toast.error('Deal marked as Closed Lost')
  }

  async function handleNotesBlur() {
    if (deal && notes !== deal.notes) {
      await updateDeal({ notes })
    }
  }

  async function handleRescore() {
    setScoring(true)
    try {
      const res = await fetch(`/api/pipeline/deals/${id}/score`, { method: 'POST' })
      const data = await res.json() as { deal?: FullDeal }
      if (res.ok && data.deal) {
        setDeal(prev => prev ? { ...prev, ...data.deal } : data.deal!)
        toast.success('Deal re-scored')
      }
    } catch {
      toast.error('Failed to re-score deal')
    } finally {
      setScoring(false)
    }
  }

  async function handleLogActivity(e: React.FormEvent) {
    e.preventDefault()
    setLoggingActivity(true)
    try {
      const res = await fetch('/api/pipeline/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: id, type: logType, body: logBody }),
      })
      const data = await res.json() as { activity?: Activity }
      if (res.ok && data.activity) {
        setActivities(prev => [data.activity!, ...prev])
        setLogBody('')
        setShowActivityForm(false)
        toast.success('Activity logged')
      }
    } catch {
      toast.error('Failed to log activity')
    } finally {
      setLoggingActivity(false)
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/pipeline/deals/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Deal deleted')
      router.push(`/${slug}/pipeline`)
    } else {
      toast.error('Failed to delete deal')
    }
  }

  async function handleNameSubmit() {
    if (nameValue.trim() && nameValue !== deal?.name) {
      await updateDeal({ name: nameValue.trim() })
    }
    setEditingName(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading deal…</div>
      </div>
    )
  }

  if (!deal) {
    return (
      <div className="empty">
        <div className="empty-title">Deal not found</div>
        <Link href={`/${slug}/pipeline`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', marginTop: 12 }}>
          ← Back to Pipeline
        </Link>
      </div>
    )
  }

  const healthScore = deal.ai_health_score
  const factors = (deal.ai_health_factors ?? []) as DealFactor[]

  return (
    <div className="page-enter">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href={`/${slug}/pipeline`} style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Pipeline</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-1)' }}>{deal.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Deal header card */}
          <div className="card">
            <div className="card-body">
              {/* Editable name */}
              <div style={{ marginBottom: 12 }}>
                {editingName ? (
                  <input
                    className="form-input"
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={e => { if (e.key === 'Enter') { void handleNameSubmit() } if (e.key === 'Escape') { setEditingName(false); setNameValue(deal.name) } }}
                    autoFocus
                    style={{ fontSize: 18, fontWeight: 700 }}
                  />
                ) : (
                  <h1
                    style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px', cursor: 'pointer' }}
                    onClick={() => setEditingName(true)}
                    title="Click to edit"
                  >
                    {deal.name}
                  </h1>
                )}
                {deal.accounts && (
                  <Link
                    href={`/${slug}/tam/${deal.account_id}`}
                    style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}
                  >
                    {deal.accounts.name}
                  </Link>
                )}
              </div>

              {/* Stage pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {STAGES.slice(0, 5).map(s => (
                  <button
                    key={s.value}
                    onClick={() => handleStageChange(s.value)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                      cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                      background: deal.stage === s.value ? 'var(--accent)' : 'var(--bg)',
                      color: deal.stage === s.value ? 'white' : 'var(--text-2)',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-bg)' }}
                  onClick={handleCloseWon}
                  disabled={deal.stage === 'closed_won'}
                >
                  ✓ Closed Won
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-bg)' }}
                  onClick={handleCloseLost}
                  disabled={deal.stage === 'closed_lost'}
                >
                  ✕ Closed Lost
                </button>
              </div>
            </div>
          </div>

          {/* AI Health card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🧠 AI Deal Health</span>
              <button className="btn btn-ghost btn-sm" onClick={handleRescore} disabled={scoring || !deal.account_id}>
                {scoring ? <><span className="spinner" style={{ borderTopColor: 'var(--text-2)' }} />Scoring…</> : '↻ Re-score'}
              </button>
            </div>
            <div className="card-body">
              {healthScore != null ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--bg)', border: `3px solid ${scoreColor(healthScore)}`,
                      fontSize: 18, fontWeight: 700, color: scoreColor(healthScore), fontFamily: 'DM Mono, monospace',
                    }}>
                      {healthScore}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: scoreColor(healthScore), fontSize: 15 }}>{scoreLabel(healthScore)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        Last scored {deal.updated_at ? formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true }) : 'never'}
                      </div>
                    </div>
                  </div>
                  {deal.ai_health_reason && (
                    <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>{deal.ai_health_reason}</p>
                  )}
                  {factors.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {factors.map((f, i) => (
                        <span
                          key={i}
                          title={f.detail}
                          style={{
                            fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                            background: f.status === 'positive' ? 'var(--green-bg)' : f.status === 'negative' ? 'var(--red-bg)' : 'var(--bg)',
                            color: f.status === 'positive' ? 'var(--green)' : f.status === 'negative' ? 'var(--red)' : 'var(--text-2)',
                            cursor: 'help',
                          }}
                        >
                          {f.status === 'positive' ? '✓' : f.status === 'negative' ? '✗' : '·'} {f.label}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: 13.5 }}>
                  {deal.account_id
                    ? 'No score yet. Click Re-score to assess this deal.'
                    : 'Link an account to enable AI deal health scoring.'}
                </div>
              )}
            </div>
          </div>

          {/* Activity timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Activity Timeline</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowActivityForm(v => !v)}>
                + Log activity
              </button>
            </div>
            {showActivityForm && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                <form onSubmit={handleLogActivity}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {(['note', 'call', 'meeting'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLogType(t)}
                        style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                          background: logType === t ? 'var(--accent)' : 'var(--surface)',
                          color: logType === t ? 'white' : 'var(--text-2)',
                        }}
                      >
                        {ACTIVITY_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="form-input"
                    placeholder="Notes…"
                    value={logBody}
                    onChange={e => setLogBody(e.target.value)}
                    rows={2}
                    style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, resize: 'none', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={loggingActivity}>
                      {loggingActivity ? 'Logging…' : 'Log'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowActivityForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
            <div className="card-body" style={{ padding: '8px 0' }}>
              {activities.length === 0 ? (
                <div className="empty" style={{ padding: '24px 20px' }}>
                  <div className="empty-title" style={{ fontSize: 13 }}>No activity yet</div>
                  <div className="empty-sub">Connect Gmail to auto-capture emails</div>
                </div>
              ) : (
                activities.slice(0, 20).map(a => (
                  <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }}>{ACTIVITY_ICONS[a.type] ?? '📌'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>
                        {a.subject ?? a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                      </div>
                      {a.summary && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{a.summary}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                        {formatDistanceToNow(new Date(a.occurred_at), { addSuffix: true })}
                      </div>
                    </div>
                    {a.sentiment && (
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, alignSelf: 'flex-start',
                        background: a.sentiment === 'positive' ? 'var(--green-bg)' : a.sentiment === 'negative' ? 'var(--red-bg)' : 'var(--bg)',
                        color: a.sentiment === 'positive' ? 'var(--green)' : a.sentiment === 'negative' ? 'var(--red)' : 'var(--text-3)',
                      }}>
                        {a.sentiment}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Notes</span>
            </div>
            <div className="card-body">
              <textarea
                className="form-input"
                placeholder="Add notes about this deal…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={5}
                style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Deal info card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Deal Info</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Value</div>
                <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'DM Mono, monospace' }}>
                  {deal.value ? `${deal.currency === 'GBP' ? '£' : deal.currency === 'EUR' ? '€' : '$'}${Number(deal.value).toLocaleString()}` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Close Date</div>
                <div style={{ fontSize: 13.5 }}>
                  {deal.close_date ? format(new Date(deal.close_date), 'MMM d, yyyy') : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Created</div>
                <div style={{ fontSize: 13.5 }}>{format(new Date(deal.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Owner</div>
                <div style={{ fontSize: 13.5 }}>{deal.users?.full_name ?? '—'}</div>
              </div>
            </div>
          </div>

          {/* Company card */}
          {deal.accounts && (
            <div className="card">
              <div className="card-header"><span className="card-title">Company</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="co-logo">
                    {deal.accounts.domain ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://logo.clearbit.com/${deal.accounts.domain}`}
                        alt={deal.accounts.name}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : null}
                    <span>{deal.accounts.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{deal.accounts.name}</div>
                    {deal.accounts.industry && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{deal.accounts.industry}</div>}
                  </div>
                </div>
                {deal.accounts.ai_score != null && (
                  <div style={{ marginBottom: 8 }}>
                    <span className={`score ${deal.accounts.ai_score >= 70 ? 'score-high' : deal.accounts.ai_score >= 40 ? 'score-mid' : 'score-low'}`}>
                      {deal.accounts.ai_score}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>TAM Score</span>
                  </div>
                )}
                <Link
                  href={`/${slug}/tam/${deal.account_id}`}
                  className="btn btn-ghost btn-sm"
                  style={{ textDecoration: 'none', fontSize: 12.5 }}
                >
                  View account →
                </Link>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--text-3)', userSelect: 'none', marginBottom: 8 }}>
              Danger zone
            </summary>
            <div className="card" style={{ borderColor: 'var(--red-bg)' }}>
              <div className="card-body">
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                  Deleting this deal is permanent and cannot be undone.
                </div>
                {showDeleteConfirm ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'var(--red)', color: 'white', border: 'none' }}
                      onClick={handleDelete}
                    >
                      Confirm delete
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  </div>
                ) : (
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-bg)' }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Icon d={Icons.trash} size={13} /> Delete deal
                  </button>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
