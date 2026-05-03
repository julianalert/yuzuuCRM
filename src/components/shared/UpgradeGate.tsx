'use client'

import { useWorkspace } from '@/hooks/useWorkspace'
import { getPlanFeatureLimits, PLAN_PRICING, type PlanName } from '@/lib/stripe/plans'
import { useParams, useRouter } from 'next/navigation'

interface UpgradeGateProps {
  feature: 'pipeline' | 'ai_scoring' | 'sequences'
  requiredPlan: PlanName
  children: React.ReactNode
}

export function UpgradeGate({ feature, requiredPlan, children }: UpgradeGateProps) {
  const workspace = useWorkspace()
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  if (!workspace) return null

  const limits = getPlanFeatureLimits(workspace.plan)
  let allowed = true

  if (feature === 'pipeline') allowed = limits.pipeline
  else if (feature === 'ai_scoring') allowed = limits.ai_scoring
  else if (feature === 'sequences') allowed = limits.sequences > 0

  if (allowed) return <>{children}</>

  const planInfo = PLAN_PRICING[requiredPlan]

  async function handleUpgrade() {
    const priceId = process.env[`NEXT_PUBLIC_STRIPE_${requiredPlan.toUpperCase()}_PRICE_ID`]
    if (!priceId) {
      router.push(`/${slug}/settings/billing`)
      return
    }

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price_id: priceId,
        success_url: `${window.location.origin}/${slug}/settings/billing?checkout=success`,
        cancel_url: window.location.href,
      }),
    })
    const data = await res.json() as { url?: string }
    if (data.url) window.location.href = data.url
    else router.push(`/${slug}/settings/billing`)
  }

  const featureLabels: Record<string, string> = {
    pipeline: 'Pipeline & Deal Management',
    ai_scoring: 'AI Deal Health Scoring',
    sequences: 'Email Sequences',
  }

  return (
    <div className="page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '40px 32px' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, letterSpacing: '-0.3px' }}>
          Upgrade to unlock {featureLabels[feature]}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.6 }}>
          This feature requires the <strong style={{ color: 'var(--text-2)' }}>{planInfo.label}</strong> plan at 
          ${planInfo.price}/month. Upgrade to unlock {planInfo.seats} seats, {planInfo.accounts.toLocaleString()} accounts, and more.
        </div>
        <button
          className="btn btn-primary"
          style={{ justifyContent: 'center', padding: '10px 24px', fontSize: 14 }}
          onClick={handleUpgrade}
        >
          Upgrade to {planInfo.label} →
        </button>
        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push(`/${slug}/settings/billing`)}
          >
            View all plans
          </button>
        </div>
      </div>
    </div>
  )
}
