'use client'

import Link from 'next/link'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Icon, Icons } from '@/components/shared/Icon'

export function TrialBanner() {
  const workspace = useWorkspace()

  if (workspace.subscription_status !== 'trialing' || !workspace.trial_ends_at) {
    return null
  }

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(workspace.trial_ends_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  )

  if (daysLeft <= 0) return null

  return (
    <div className="trial-banner">
      <Icon d={Icons.zap} size={13} fill="currentColor" stroke="none" />
      <span>
        You have <strong>{daysLeft} days</strong> left on your free trial.
      </span>
      <Link href={`/${workspace.slug}/settings/billing`} style={{ color: 'white', textDecoration: 'underline', marginLeft: 4 }}>
        Upgrade now →
      </Link>
    </div>
  )
}
