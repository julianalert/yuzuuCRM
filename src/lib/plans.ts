export interface PlanLimits {
  maxLeadsPerSearch: number
  enrichmentCredits: number  // default credits granted on signup
}

export function getPlanLimits(plan: string): PlanLimits {
  switch (plan) {
    case 'starter':
      return { maxLeadsPerSearch: 50,  enrichmentCredits: 50  }
    case 'growth':
      return { maxLeadsPerSearch: 100, enrichmentCredits: 200 }
    case 'enterprise':
      return { maxLeadsPerSearch: 200, enrichmentCredits: 500 }
    default:
      // free / trialing
      return { maxLeadsPerSearch: 10,  enrichmentCredits: 3   }
  }
}

export const PLAN_LABELS: Record<string, string> = {
  free:       'Free trial',
  trialing:   'Free trial',
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
}
