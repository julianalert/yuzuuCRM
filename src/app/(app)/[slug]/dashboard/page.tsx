import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { differenceInDays, addDays, startOfDay } from 'date-fns'

interface Props {
  params: Promise<{ slug: string }>
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

function leadIcon(lead: { website: string | null; rating: number | null; review_count: number | null }): { icon: string; bg: string } {
  if (!lead.website) return { icon: '🌐', bg: '#FCEAEA' }
  if (lead.rating !== null && lead.rating < 4) return { icon: '⭐', bg: '#FEF6E7' }
  if (lead.review_count !== null && lead.review_count < 20) return { icon: '💬', bg: '#FEF6E7' }
  return { icon: '📍', bg: '#EBF5F0' }
}

const STAGE_LABELS: Record<string, string> = {
  discovery:   'Discovery',
  demo:        'Demo',
  proposal:    'Proposal',
  negotiation: 'Negotiation',
}

export default async function DashboardPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUser } = await supabase.from('users').select('workspace_id').eq('id', authUser.id).single()
  if (!dbUser) redirect('/login')

  const workspaceId = dbUser.workspace_id
  const today = startOfDay(new Date()).toISOString()
  const in30Days = addDays(new Date(), 30).toISOString()

  const [
    { data: workspace },
    { count: leadCount },
    { data: leadScores },
    { count: hotLeadCount },
    { data: openDeals },
    { data: hotLeads },
    { data: closingDeals },
    { data: cellStats },
  ] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', workspaceId).single(),

    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .is('archived_at', null),

    supabase.from('leads').select('surface_score').eq('workspace_id', workspaceId).not('surface_score', 'is', null),

    // Hot leads: actually relevance-routed by the intent engine
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('relevance', 'hot')
      .is('archived_at', null),

    supabase.from('deals').select('value').eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('stage', 'in', '("closed_won","closed_lost")'),

    // Hot leads — pick by intent_score first now that we have it, with
    // opportunity_score (post-enrichment) as a tiebreaker.
    supabase.from('leads')
      .select('id, name, category, website, rating, review_count, surface_score, opportunity_score, intent_score, relevance, enrichment_status, lead_searches(category, city, country)')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .eq('relevance', 'hot')
      .order('intent_score', { ascending: false, nullsFirst: false })
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .limit(5),

    // Deals closing in the next 30 days
    supabase.from('deals')
      .select('id, name, value, stage, close_date, health, accounts(name)')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .gte('close_date', today)
      .lte('close_date', in30Days)
      .order('close_date', { ascending: true })
      .limit(5),

    // Market coverage stats from market_cells
    supabase.from('market_cells').select('status').eq('workspace_id', workspaceId),
  ])

  const cellCounts = (cellStats ?? []).reduce(
    (acc, c) => {
      acc.total++
      if (c.status === 'exhausted' || c.status === 'dead') acc.done++
      else if (c.status === 'scanning' || c.status === 'partial') acc.inProgress++
      else if (c.status === 'pending') acc.pending++
      return acc
    },
    { total: 0, done: 0, inProgress: 0, pending: 0 },
  )
  const coveragePct = cellCounts.total > 0
    ? Math.round((cellCounts.done / cellCounts.total) * 100)
    : 0

  const avgScore = leadScores && leadScores.length > 0
    ? Math.round(leadScores.reduce((sum, l) => sum + (l.surface_score ?? 0), 0) / leadScores.length)
    : 0

  const openPipelineValue = openDeals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) ?? 0

  const trialDaysLeft = workspace?.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(workspace.trial_ends_at), new Date()))
    : null

  const stats = [
    { label: 'Total Leads',    value: (leadCount ?? 0).toLocaleString(),        delta: 'across all searches',          up: true },
    { label: 'Hot Leads',      value: (hotLeadCount ?? 0).toLocaleString(),     delta: 'matched to your services',      up: true },
    { label: 'Avg Lead Score', value: avgScore > 0 ? avgScore.toString() : '—', delta: 'surface score average',         up: avgScore >= 60 },
    { label: 'Open Pipeline',  value: formatCurrency(openPipelineValue),        delta: `${openDeals?.length ?? 0} active deals`, up: true },
  ]

  return (
    <div className="page-enter">
      {/* Trial banner */}
      {workspace?.subscription_status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 1 && (
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid #F0D090', borderRadius: 'var(--radius)',
          padding: '10px 16px', fontSize: 13, marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--amber)' }}>
            ⏱ <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> left in your trial
          </span>
          <Link href={`/${slug}/settings/billing`} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--amber)', textDecoration: 'underline' }}>
            Upgrade now →
          </Link>
        </div>
      )}

      {/* Payment failed banner */}
      {workspace?.subscription_status === 'past_due' && (
        <div style={{
          background: 'var(--red-bg)', border: '1px solid #E8B0B0', borderRadius: 'var(--radius)',
          padding: '10px 16px', fontSize: 13, marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--red)' }}>⚠ Payment failed — update your card to avoid losing access</span>
          <Link href={`/${slug}/settings/billing`} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--red)', textDecoration: 'underline' }}>
            Update card →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.up ? 'delta-up' : ''}`}>
              <span>{s.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Market Coverage — full width because density of info matters more
          than horizontal compactness here */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Market Coverage</span>
          {workspace?.tam_status === 'fully_scanned' && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
              background: 'rgba(45,164,78,0.14)', color: 'var(--green, #2da44e)',
            }}>
              TAM fully scanned
            </span>
          )}
        </div>
        <div className="card-body" style={{ padding: '20px 20px 24px' }}>
          {cellCounts.total === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Your agent is building your market map. It will populate within the next agent run.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>{coveragePct}%</span>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  of your market scanned · {cellCounts.done} of {cellCounts.total} zones complete
                </span>
              </div>
              <div style={{
                width: '100%', height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden',
                marginBottom: 14,
              }}>
                <div style={{
                  width: `${coveragePct}%`, height: '100%',
                  background: coveragePct >= 80 ? 'var(--green, #2da44e)' : 'var(--text-1)',
                  transition: 'width 300ms',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 28, fontSize: 12.5, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                <span><strong style={{ color: 'var(--text-1)' }}>{cellCounts.pending}</strong> pending</span>
                <span><strong style={{ color: 'var(--text-1)' }}>{cellCounts.inProgress}</strong> in progress</span>
                <span><strong style={{ color: 'var(--text-1)' }}>{cellCounts.done}</strong> exhausted</span>
              </div>
              {workspace?.tam_status === 'fully_scanned' && (
                <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.55 }}>
                  Every zone in your target market has been scanned. Your agent will now keep existing leads fresh and surface changes (new businesses, review shifts) as they happen.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid-2">
        {/* Hot Leads */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔥 Hot Leads</span>
            <Link href={`/${slug}/leads`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View leads →
            </Link>
          </div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {!hotLeads || hotLeads.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <div className="empty-title" style={{ fontSize: 13 }}>No leads yet</div>
                <div className="empty-sub">Run a search to find local businesses</div>
              </div>
            ) : (
              hotLeads.map((lead) => {
                const { icon, bg } = leadIcon(lead)
                const score = lead.enrichment_status === 'done' && lead.opportunity_score !== null
                  ? lead.opportunity_score
                  : lead.surface_score
                const scoreClass = (score ?? 0) >= 70 ? 'score-high' : (score ?? 0) >= 40 ? 'score-mid' : 'score-low'
                const search = lead.lead_searches as { category: string | null; city: string | null; country: string | null } | null
                const searchLabel = search
                  ? [search.category, search.city].filter(Boolean).join(' · ')
                  : null

                return (
                  <div key={lead.id} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius)',
                      background: bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.name ?? '—'}
                      </div>
                      {searchLabel && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{searchLabel}</div>
                      )}
                    </div>
                    {score !== null && (
                      <span className={`score ${scoreClass}`} style={{ fontSize: 11 }}>
                        {score}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Closing Soon */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📅 Closing Soon</span>
            <Link href={`/${slug}/pipeline`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View pipeline →
            </Link>
          </div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {!closingDeals || closingDeals.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <div className="empty-title" style={{ fontSize: 13 }}>No deals closing soon</div>
                <div className="empty-sub">Add a close date to your deals to track urgency here</div>
              </div>
            ) : (
              closingDeals.map((deal) => {
                const accountName = (deal.accounts as unknown as { name: string } | null)?.name ?? '—'
                const value = deal.value ? formatCurrency(Number(deal.value)) : '—'
                const daysLeft = deal.close_date
                  ? differenceInDays(new Date(deal.close_date), new Date())
                  : null
                const urgencyColor = daysLeft !== null
                  ? daysLeft < 7  ? 'var(--red)'   : daysLeft < 14 ? 'var(--amber)'  : 'var(--green)'
                  : 'var(--text-3)'
                const urgencyBg = daysLeft !== null
                  ? daysLeft < 7  ? 'var(--red-bg)' : daysLeft < 14 ? 'var(--amber-bg)' : 'var(--green-bg)'
                  : 'var(--border)'

                return (
                  <div key={deal.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                    {/* Days badge */}
                    <div style={{
                      minWidth: 36, textAlign: 'center',
                      padding: '3px 6px', borderRadius: 6,
                      background: urgencyBg, color: urgencyColor,
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      fontFamily: 'DM Mono, monospace',
                    }}>
                      {daysLeft !== null ? `${daysLeft}d` : '—'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deal.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span>{accountName}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{STAGE_LABELS[deal.stage] ?? deal.stage}</span>
                      </div>
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)', flexShrink: 0 }}>
                      {value}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
