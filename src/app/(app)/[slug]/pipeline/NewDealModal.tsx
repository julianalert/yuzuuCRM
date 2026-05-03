'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Deal, Account, User } from '@/lib/types'
import { Icon, Icons } from '@/components/shared/Icon'

interface NewDealModalProps {
  slug: string
  defaultStage?: Deal['stage']
  onClose: () => void
  onCreated: (deal: Deal & { accounts?: Account; users?: User }) => void
}

const STAGES: { value: Deal['stage']; label: string }[] = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'demo', label: 'Demo' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
]

export function NewDealModal({ defaultStage = 'discovery', onClose, onCreated }: NewDealModalProps) {
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [closeDate, setCloseDate] = useState('')
  const [stage, setStage] = useState<Deal['stage']>(defaultStage)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [ownerId, setOwnerId] = useState('')
  const [accountSearch, setAccountSearch] = useState('')

  useEffect(() => {
    fetch('/api/tam/accounts?limit=100')
      .then(r => r.json())
      .then((d: { accounts?: Account[] }) => setAccounts(d.accounts ?? []))
      .catch(() => {})

    fetch('/api/team/members')
      .then(r => r.json())
      .then((d: { members?: User[] }) => setMembers(d.members ?? []))
      .catch(() => {})
  }, [])

  const filteredAccounts = accounts.filter(a =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/pipeline/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          account_id: accountId || undefined,
          value: value ? parseFloat(value) : undefined,
          currency,
          close_date: closeDate || undefined,
          stage,
          owner_id: ownerId || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json() as { deal?: Deal; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to create deal')

      toast.success('Deal created')
      onCreated(data.deal!)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create deal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="card-header">
          <span className="card-title">New Deal</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <Icon d={Icons.x} size={16} />
          </button>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Deal name *</label>
              <input
                className="form-input"
                placeholder="e.g. Enterprise Platform Deal"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Account</label>
              <input
                className="form-input"
                placeholder="Search accounts…"
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                style={{ marginBottom: accountSearch ? 4 : 0 }}
              />
              {accountSearch && filteredAccounts.length > 0 && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                  maxHeight: 160, overflowY: 'auto', marginTop: 2,
                }}>
                  {filteredAccounts.slice(0, 8).map(a => (
                    <div
                      key={a.id}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13.5,
                        background: accountId === a.id ? 'var(--bg)' : undefined,
                      }}
                      onClick={() => { setAccountId(a.id); setAccountSearch(a.name) }}
                    >
                      {a.name}
                      {a.domain && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>{a.domain}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }} className="form-group">
              <div>
                <label className="form-label">Deal value</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Currency</label>
                <select
                  className="form-input"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Expected close date</label>
              <input
                className="form-input"
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stage</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STAGES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStage(s.value)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                      cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                      background: stage === s.value ? 'var(--accent)' : 'var(--bg)',
                      color: stage === s.value ? 'white' : 'var(--text-2)',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {members.length > 0 && (
              <div className="form-group">
                <label className="form-label">Assigned to</label>
                <select
                  className="form-input"
                  value={ownerId}
                  onChange={e => setOwnerId(e.target.value)}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                placeholder="Optional notes…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                style={{ height: 'auto', paddingTop: 8, paddingBottom: 8, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
                {loading ? <><span className="spinner" />Creating…</> : 'Create deal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
