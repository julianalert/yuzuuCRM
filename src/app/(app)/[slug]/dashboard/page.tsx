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
    { count: signalLeadCount },
    { data: openDeals },
    { data: hotLeads },
    { data: closingDeals },
  ] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', workspaceId).single(),

    // Total leads
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),

    // Avg surface score
    supabase.from('leads').select('surface_score').eq('workspace_id', workspaceId).not('surface_score', 'is', null),

    // Signals: leads with at least one raw signal
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .or('website.is.null,rating.lt.4,review_count.lt.20'),

    // Open pipeline value
    supabase.from('deals').select('value').eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .not('stage', 'in', '("closed_won","closed_lost")'),

    // Hot leads — top 5 by surface_score, enriched ones bump up via opportunity_score ordering
    supabase.from('leads')
      .select('id, name, category, website, rating, review_count, surface_score, opportunity_score, enrichment_status, lead_searches(category, city, country)')
      .eq('workspace_id', workspaceId)
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .order('surface_score', { ascending: false })
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
  ])

  const avgScore = leadScores && leadScores.length > 0
    ? Math.round(leadScores.reduce((sum, l) => sum + (l.surface_score ?? 0), 0) / leadScores.length)
    : 0

  const openPipelineValue = openDeals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) ?? 0

  const trialDaysLeft = workspace?.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(workspace.trial_ends_at), new Date()))
    : null

  const stats = [
    { label: 'Total Leads',    value: (leadCount ?? 0).toLocaleString(),        delta: 'across all searches',          up: true },
    { label: 'Avg Lead Score', value: avgScore > 0 ? avgScore.toString() : '—', delta: 'surface score average',         up: avgScore >= 60 },
    { label: 'Signals',        value: (signalLeadCount ?? 0).toLocaleString(),  delta: 'leads with opportunities',     up: true },
    { label: 'Open Pipeline',  value: formatCurrency(openPipelineValue),        delta: `${openDeals?.length ?? 0} active deals`, up: true },
  ]

  return (
    <div className="page-enter">
      {/* Trial banner */}
      {workspace?.subscription_status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 7 && (
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
