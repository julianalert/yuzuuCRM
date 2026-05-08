'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { SettingsLayout } from '@/components/layout/SettingsLayout'
import { useWorkspace } from '@/hooks/useWorkspace'
import { PLAN_PRICING, getPlanFeatureLimits, type PlanName } from '@/lib/stripe/plans'
import { format, differenceInDays } from 'date-fns'

interface UsageData {
  seats: number
  leads: number
}

const PLAN_CARDS: { key: PlanName; tagline: string; features: string[] }[] = [
  {
    key: 'starter',
    tagline: 'Perfect for solo or small agency founders who are tired of spending hours building lead lists every week.',
    features: ['1 seat', '500 leads', '1 sequence', 'Pipeline', 'AI scoring'],
  },
  {
    key: 'growth',
    tagline: 'Perfect for growing agencies ready to build a repeatable outbound engine and stop the guesswork.',
    features: ['5 seats', '5,000 leads', '10 sequences', 'Pipeline', 'AI scoring'],
  },
  {
    key: 'enterprise',
    tagline: 'Perfect for established agencies scaling outbound across the whole team with full visibility.',
    features: ['15 seats', '25,000 leads', 'Unlimited sequences', 'Pipeline', 'AI scoring'],
  },
]

const PLAN_ORDER: PlanName[] = ['free', 'starter', 'growth', 'enterprise']

export default function BillingPage() {
  const workspace = useWorkspace()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null)

  useEffect(() => {
    if (!workspace) return
    fetch('/api/billing/usage')
      .then(r => r.json())
      .then((d: UsageData) => setUsage(d))
      .catch(() => setUsage({ seats: 0, leads: 0 }))
  }, [workspace])

  if (!workspace) return null

  const plan = workspace.plan as PlanName
  const limits = getPlanFeatureLimits(plan)
  const planInfo = PLAN_PRICING[plan]
  const status = workspace.subscription_status

  const trialDaysLeft = workspace.trial_ends_at
    ? Math.max(0, differenceInDays(new Date(workspace.trial_ends_at), new Date()))
    : null

  async function handleManagePlan() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? 'Failed to open billing portal')
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setLoadingPortal(false)
    }
  }

  async function handleUpgrade(planKey: PlanName) {
    setLoadingCheckout(planKey)
    try {
      const priceIds: Partial<Record<PlanName, string>> = {
        starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? '',
        growth: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID ?? '',
        enterprise: process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID ?? '',
      }
      const priceId = priceIds[planKey]
      if (!priceId) {
        toast.error('Price ID not configured. Please contact support.')
        return
      }

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          success_url: `${window.location.origin}${window.location.pathname}?checkout=success`,
          cancel_url: window.location.href,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else toast.error(data.error ?? 'Failed to start checkout')
    } catch {
      toast.error('Failed to start checkout')
    } finally {
      setLoadingCheckout(null)
    }
  }

  const seatUsed = usage?.seats ?? 0
  const leadUsed = usage?.leads ?? 0

  return (
    <SettingsLayout>
      {/* Status banners */}
      {status === 'past_due' && (
        <div style={{
          background: 'var(--red-bg)', border: '1px solid #E8B0B0', borderRadius: 'var(--radius)',
          padding: '10px 16px', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ color: 'var(--red)' }}>⚠ Payment failed — update your card to avoid losing access</span>
          <button className="btn btn-sm" style={{ background: 'var(--red)', color: 'white' }} onClick={handleManagePlan}>
            Update card →
          </button>
        </div>
      )}

      {status === 'canceled' && (
        <div style={{
          background: 'var(--red-bg)', border: '1px solid #E8B0B0', borderRadius: 'var(--radius)',
          padding: '24px', fontSize: 13.5, marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--red)', fontSize: 16, marginBottom: 8 }}>Your subscription has been canceled</div>
          <div style={{ color: 'var(--text-2)', marginBottom: 16 }}>Reactivate to regain access to all your data and features.</div>
          <button className="btn btn-primary" onClick={() => handleUpgrade('growth')}>Reactivate subscription</button>
        </div>
      )}

      {/* Current plan */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Current Plan</span>
          {workspace.stripe_customer_id && (
            <button className="btn btn-secondary btn-sm" onClick={handleManagePlan} disabled={loadingPortal}>
              {loadingPortal ? 'Opening…' : 'Manage plan'}
            </button>
          )}
        </div>
        <div className="card-body">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', marginBottom: 16,
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{planInfo.label} Plan</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {planInfo.price === 0 ? 'Free' : `$${planInfo.price}/month`} · {limits.seats} seat{limits.seats !== 1 ? 's' : ''} · {limits.accounts.toLocaleString()} leads
              </div>
            </div>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: status === 'active' ? 'var(--green-bg)' : status === 'trialing' ? 'var(--amber-bg)' : 'var(--red-bg)',
              color: status === 'active' ? 'var(--green)' : status === 'trialing' ? 'var(--amber)' : 'var(--red)',
            }}>
              {status === 'trialing' ? `Trial (${trialDaysLeft}d left)` : status}
            </span>
          </div>

          {/* Usage bars */}
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Seats used', used: seatUsed, total: limits.seats },
              { label: 'Leads', used: leadUsed, total: limits.accounts },
            ].map(({ label, used, total }) => (
              <div key={label} style={{ flex: 1, padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  {used.toLocaleString()} / {(total as number) >= 99999 ? '∞' : (total as number).toLocaleString()}
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, transition: 'width 0.3s',
                    width: `${Math.min(100, (total as number) > 0 ? (used / (total as number)) * 100 : 0)}%`,
                    background: (total as number) > 0 && used / (total as number) > 0.9 ? 'var(--red)' : (total as number) > 0 && used / (total as number) > 0.7 ? 'var(--amber)' : 'var(--green)',
                  }} />
                </div>
              </div>
            ))}
            {workspace.trial_ends_at && status === 'trialing' && (
              <div style={{ flex: 1, padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>Trial ends</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{format(new Date(workspace.trial_ends_at), 'MMM d, yyyy')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan cards — always show all 3 paid plans */}
      <div className="card">
        <div className="card-header"><span className="card-title">Plans</span></div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {PLAN_CARDS.map(({ key, tagline, features }) => {
              const info = PLAN_PRICING[key]
              const isCurrent = key === plan
              const isUpgrade = PLAN_ORDER.indexOf(key) > PLAN_ORDER.indexOf(plan)

              return (
                <div key={key} style={{
                  padding: 16, borderRadius: 'var(--radius-lg)',
                  border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 12,
                  background: isCurrent ? 'var(--bg)' : 'transparent',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{info.label}</div>
                      {isCurrent && (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 20, background: 'var(--accent)', color: 'white',
                        }}>
                          Current plan
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                      ${info.price}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-3)' }}>/mo</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.5 }}>
                      {tagline}
                    </div>
                  </div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    {features.map(f => (
                      <li key={f} style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'center' }} onClick={handleManagePlan} disabled={loadingPortal}>
                      {loadingPortal ? 'Opening…' : 'Manage plan'}
                    </button>
                  ) : isUpgrade ? (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ justifyContent: 'center' }}
                      onClick={() => void handleUpgrade(key)}
                      disabled={loadingCheckout === key}
                    >
                      {loadingCheckout === key ? 'Loading…' : `Upgrade to ${info.label} →`}
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} onClick={handleManagePlan}>
                      Downgrade
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SettingsLayout>
  )
}
