import type { Workspace } from '@/lib/types'

export const PLAN_LIMITS = {
  free: {
    seats: 1,
    accounts: 50,
    sequences: 0,
    pipeline: false,
    ai_scoring: false,
  },
  starter: {
    seats: 1,
    accounts: 500,
    sequences: 1,
    pipeline: true,
    ai_scoring: true,
  },
  growth: {
    seats: 5,
    accounts: 5000,
    sequences: 10,
    pipeline: true,
    ai_scoring: true,
  },
  enterprise: {
    seats: 15,
    accounts: 25000,
    sequences: 999,
    pipeline: true,
    ai_scoring: true,
  },
} as const

export type FeaturePlanLimits = typeof PLAN_LIMITS
export type PlanName = keyof FeaturePlanLimits

export const PLAN_PRICING: Record<PlanName, { label: string; price: number; interval: string; seats: number; accounts: number }> = {
  free: { label: 'Free', price: 0, interval: 'month', seats: 1, accounts: 50 },
  starter: { label: 'Starter', price: 49, interval: 'month', seats: 1, accounts: 500 },
  growth: { label: 'Growth', price: 149, interval: 'month', seats: 5, accounts: 5000 },
  enterprise: { label: 'Scale', price: 399, interval: 'month', seats: 15, accounts: 25000 },
}

export function getPlanFeatureLimits(plan: string): FeaturePlanLimits[PlanName] {
  return PLAN_LIMITS[plan as PlanName] ?? PLAN_LIMITS.free
}

export function canAddSeat(workspace: Workspace, currentSeatCount: number): boolean {
  const limits = getPlanFeatureLimits(workspace.plan)
  return currentSeatCount < limits.seats
}

export function canAddAccount(workspace: Workspace, currentCount: number): boolean {
  const limits = getPlanFeatureLimits(workspace.plan)
  return currentCount < limits.accounts
}

export function hasFeature(workspace: Workspace, feature: 'pipeline' | 'ai_scoring' | 'sequences'): boolean {
  const limits = getPlanFeatureLimits(workspace.plan)
  if (feature === 'sequences') return limits.sequences > 0
  return limits[feature]
}

export function getPriceIdForPlan(plan: PlanName): string | undefined {
  const map: Partial<Record<PlanName, string | undefined>> = {
    starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
    growth: process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID,
    enterprise: process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID,
  }
  return map[plan]
}

export function getPlanFromPriceId(priceId: string): PlanName {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID) return 'starter'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_GROWTH_PRICE_ID) return 'growth'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID) return 'enterprise'
  return 'free'
}
