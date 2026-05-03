'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Icon, Icons } from '@/components/shared/Icon'
import { ScoreBadge } from '@/components/shared/ScoreBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CompanyLogo } from '@/components/shared/CompanyLogo'
import { useWorkspace } from '@/hooks/useWorkspace'
import { getPlanLimits } from '@/lib/plans'
import type { Account, AccountStatus } from '@/lib/types'

interface AccountWithContacts extends Account {
  contacts: { id: string; first_name: string; last_name: string | null; title: string | null }[]
}

const STATUS_OPTIONS: AccountStatus[] = ['new', 'contacted', 'in_progress', 'qualified', 'not_a_fit']
const STATUS_LABELS: Record<AccountStatus, string> = {
  new: 'New', contacted: 'Contacted', in_progress: 'In Progress',
  qualified: 'Qualified', not_a_fit: 'Not a Fit',
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i}>
          <div style={{ background: 'var(--border)', borderRadius: 4, height: 14, width: i === 0 ? '80%' : '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  )
}

function EmptyState({ slug }: { slug: string }) {
  return (
    <div className="empty" style={{ padding: '80px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🌱</div>
      <div className="empty-title">Your TAM is empty</div>
      <div className="empty-sub" style={{ marginBottom: 24 }}>Build your TAM to get started with AI-powered prospecting</div>
      <Link href={`/${slug}/onboarding`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
        Build TAM →
      </Link>
    </div>
  )
}

export default function TAMPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspace = useWorkspace()

  const [accounts, setAccounts] = useState<AccountWithContacts[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') ?? 'ai_score.desc')
  const [, startTransition] = useTransition()

  const fetchAccounts = useCallback(async (p: number, append = false) => {
    const params = new URLSearchParams()
    params.set('page', String(p))
    params.set('limit', '50')
    params.set('sort', sortBy)
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/tam/accounts?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (append) {
        setAccounts((prev) => [...prev, ...(data.accounts ?? [])])
      } else {
        setAccounts(data.accounts ?? [])
      }
      setTotal(data.total ?? 0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [search, statusFilter, sortBy])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    const timer = setTimeout(() => fetchAccounts(1), 300)
    return () => clearTimeout(timer)
  }, [fetchAccounts])

  async function handleStatusChange(accountId: string, status: AccountStatus) {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status } : a))
    )
    try {
      const res = await fetch(`/api/tam/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      toast.success('Account status updated')
    } catch {
      fetchAccounts(1)
      toast.error('Failed to update status')
    }
  }

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    setLoadingMore(true)
    fetchAccounts(nextPage, true)
  }

  const avgScore = accounts.length
    ? Math.round(accounts.reduce((sum, a) => sum + (a.ai_score ?? 0), 0) / accounts.length)
    : 0

  return (
    <div className="page-enter">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div className="search-wrap">
          <span className="search-icon"><Icon d={Icons.search} size={13} /></span>
          <input
            className="search-input"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ width: 140, height: 32, fontSize: 13 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          className="form-input"
          style={{ width: 170, height: 32, fontSize: 13 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="ai_score.desc">AI Score ↓</option>
          <option value="name.asc">Company Name ↑</option>
          <option value="employee_count.desc">Employees ↓</option>
          <option value="updated_at.desc">Last Updated ↓</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!loading && total > 0 && (
            <span style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
              {total} accounts · avg score {avgScore}
            </span>
          )}
          <button className="btn btn-secondary btn-sm">Import CSV</button>
          <Link href={`/${slug}/onboarding`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            <Icon d={Icons.plus} size={13} /> Rebuild TAM
          </Link>
        </div>
      </div>

      {/* Free trial upgrade banner */}
      {workspace && getPlanLimits(workspace.plan).maxCompanies <= 25 && total > 0 && (
        <div style={{
          marginBottom: 12, padding: '12px 16px', borderRadius: 10,
          background: 'linear-gradient(135deg, #fef9ec 0%, #fff8e6 100%)',
          border: '1px solid #f5c842', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong style={{ color: '#92660a' }}>Free trial:</strong>
            <span style={{ color: '#b07c1a' }}> showing {total} of many more companies matching your ICP. Upgrade to unlock up to 200+.</span>
          </div>
          <Link
            href={`/${slug}/settings/billing`}
            style={{ fontSize: 12.5, fontWeight: 600, color: '#92660a', textDecoration: 'none',
              padding: '5px 12px', borderRadius: 6, border: '1px solid #f5c842',
              background: '#fffbf0', whiteSpace: 'nowrap' }}
          >
            Upgrade →
          </Link>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Size</th>
                <th>Location</th>
                <th>AI Score</th>
                <th>Top Contact</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              }
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState slug={slug} />
                  </td>
                </tr>
              )}
              {!loading && accounts.map((a) => {
                const topContact = a.contacts?.[0]
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <CompanyLogo domain={a.domain ?? ''} name={a.name} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.domain}</div>
                        </div>
                      </div>
                    </td>
                    <td>{a.industry && <span className="tag">{a.industry}</span>}</td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>
                      {a.employee_count ? a.employee_count.toLocaleString() : '—'}
                    </td>
                    <td style={{ color: 'var(--text-2)', fontSize: 13 }}>{a.location ?? '—'}</td>
                    <td>
                      {a.ai_score !== null ? <ScoreBadge score={a.ai_score} /> : (
                        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      {topContact ? (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            {topContact.first_name} {topContact.last_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{topContact.title}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <select
                        className="status"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                        value={a.status}
                        onChange={(e) => handleStatusChange(a.id, e.target.value as AccountStatus)}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Link
                        href={`/${slug}/tam/${a.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && accounts.length < total && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : `Load more (${total - accounts.length} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
