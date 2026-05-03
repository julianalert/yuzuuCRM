import type { Workspace } from '@/lib/types'
import { getPlanFeatureLimits, type PlanName } from './plans'

export interface FeatureAccessResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: PlanName
}

export function checkFeatureAccess(
  workspace: Workspace,
  feature: 'pipeline' | 'ai_scoring' | 'sequences',
): FeatureAccessResult {
  const limits = getPlanFeatureLimits(workspace.plan)

  if (feature === 'pipeline') {
    if (!limits.pipeline) {
      return { allowed: false, reason: 'Pipeline is not available on the Free plan', upgradeRequired: 'starter' }
    }
  }

  if (feature === 'ai_scoring') {
    if (!limits.ai_scoring) {
      return { allowed: false, reason: 'AI scoring requires a paid plan', upgradeRequired: 'starter' }
    }
  }

  if (feature === 'sequences') {
    if (limits.sequences === 0) {
      return { allowed: false, reason: 'Sequences require a Starter plan or above', upgradeRequired: 'starter' }
    }
  }

  // Check subscription is not canceled
  if (workspace.subscription_status === 'canceled') {
    return { allowed: false, reason: 'Your subscription has been canceled', upgradeRequired: 'starter' }
  }

  return { allowed: true }
}
