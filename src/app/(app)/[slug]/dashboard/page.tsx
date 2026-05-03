import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { differenceInDays } from 'date-fns'

interface Props {
  params: Promise<{ slug: string }>
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

function HealthDot({ health }: { health: string | null }) {
  const color = health === 'green' ? '#2ECC71' : health === 'red' ? '#E74C3C' : '#F39C12'
  const bg = health === 'green' ? '#EBF5F0' : health === 'red' ? '#FCEAEA' : '#FEF6E7'
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 2px ${bg}`, flexShrink: 0 }} />
}

export default async function DashboardPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUser } = await supabase.from('users').select('workspace_id').eq('id', authUser.id).single()
  if (!dbUser) redirect('/login')

  const workspaceId = dbUser.workspace_id

  const [
    { data: workspace },
    { count: accountCount },
    { data: avgScoreData },
    { data: openDeals },
    { count: activeSeqCount },
    { data: hotSignals },
    { data: stalledDeals },
  ] = await Promise.all([
    supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
    supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    supabase.from('accounts').select('ai_score').eq('workspace_id', workspaceId).not('ai_score', 'is', null),
    supabase.from('deals').select('value, currency').eq('workspace_id', workspaceId).is('deleted_at', null).not('stage', 'in', '("closed_won","closed_lost")'),
    supabase.from('sequences').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active'),
    supabase.from('signals').select('*, accounts(name, domain)').eq('workspace_id', workspaceId).order('detected_at', { ascending: false }).limit(5),
    supabase.from('deals').select('*, accounts(name)').eq('workspace_id', workspaceId).is('deleted_at', null).not('stall_detected_at', 'is', null).order('value', { ascending: false }).limit(5),
  ])

  const avgScore = avgScoreData && avgScoreData.length > 0
    ? Math.round(avgScoreData.reduce((sum, a) => sum + (a.ai_score ?? 0), 0) / avgScoreData.length)
    : 0

  const openPipelineValue = openDeals?.reduce((sum, d) => sum + (Number(d.value) || 0), 0) ?? 0

  // Also get at-risk deals (score < 50 without stall)
  const { data: atRiskDeals } = await supabase
    .from('deals')
    .select('*, accounts(name)')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .not('stage', 'in', '("closed_won","closed_lost")')
    .lt('ai_health_score', 50)
    .is('stall_detected_at', null)
    .order('value', { ascending: false })
    .limit(3)

  const allAtRisk = [
    ...(stalledDeals ?? []),
    ...(atRiskDeals ?? []),
  ].slice(0, 5)

  const trialDaysLeft = workspace?.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(workspace.trial_ends_at), new Date()))
    : null

  const stats = [
    { label: 'Total Accounts', value: (accountCount ?? 0).toLocaleString(), delta: `in your TAM`, up: true },
    { label: 'Avg TAM Score', value: avgScore.toString(), delta: 'AI-scored', up: avgScore >= 60 },
    { label: 'Open Pipeline', value: formatCurrency(openPipelineValue), delta: `${openDeals?.length ?? 0} active deals`, up: true },
    { label: 'Active Sequences', value: (activeSeqCount ?? 0).toString(), delta: 'running', up: false },
  ]

  return (
    <div className="page-enter">
      {/* Trial / payment banners */}
      {workspace?.subscription_status === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 7 && (
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid #F0D090', borderRadius: 'var(--radius)',
          padding: '10px 16px', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--amber)' }}>
            ⏱ <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong> left in your trial
          </span>
          <Link href={`/${slug}/settings/billing`} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--amber)', textDecoration: 'underline' }}>
            Upgrade now →
          </Link>
        </div>
      )}

      {workspace?.subscription_status === 'past_due' && (
        <div style={{
          background: 'var(--red-bg)', border: '1px solid #E8B0B0', borderRadius: 'var(--radius)',
          padding: '10px 16px', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
        {/* Hot accounts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔥 Hot Accounts</span>
            <Link href={`/${slug}/signals`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View signals →
            </Link>
          </div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {!hotSignals || hotSignals.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <div className="empty-title" style={{ fontSize: 13 }}>No signals yet</div>
                <div className="empty-sub">Signals will appear as your accounts get activity</div>
              </div>
            ) : (
              hotSignals.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 'var(--radius)',
                    background: s.type === 'funding' ? '#EBF5F0' : s.type === 'hiring' ? '#EBF1FA' : '#FEF6E7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>
                    {s.type === 'funding' ? '💰' : s.type === 'hiring' ? '🧑‍💼' : s.type === 'tech_change' ? '🛠️' : '📰'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)' }}>
                      {(s.accounts as unknown as { name: string } | null)?.name ?? 'Unknown'} — {s.title}
                    </div>
                  </div>
                  {s.relevance_score != null && (
                    <span className={`score ${s.relevance_score >= 70 ? 'score-high' : s.relevance_score >= 40 ? 'score-mid' : 'score-low'}`} style={{ fontSize: 11 }}>
                      {s.relevance_score}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pipeline at risk */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Pipeline at Risk</span>
            <Link href={`/${slug}/pipeline`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
              View pipeline →
            </Link>
          </div>
          <div className="card-body" style={{ padding: '8px 0' }}>
            {allAtRisk.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>
                <div className="empty-title" style={{ fontSize: 13 }}>All deals are healthy</div>
                <div className="empty-sub">No stalled or at-risk deals</div>
              </div>
            ) : (
              allAtRisk.map(d => {
                    const accountName = (d.accounts as unknown as { name: string } | null)?.name ?? '—'
                const value = d.value ? formatCurrency(Number(d.value)) : '—'
                return (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                    <HealthDot health={d.health} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{accountName}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: 'var(--text-2)' }}>
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
