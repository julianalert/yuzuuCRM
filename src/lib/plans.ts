export interface PlanLimits {
  maxPages: number        // Apollo pages × 25 results each
  maxCompanies: number    // derived from maxPages
  contactsPerCompany: number
}

export function getPlanLimits(plan: string): PlanLimits {
  switch (plan) {
    case 'starter':
      return { maxPages: 8,  maxCompanies: 200, contactsPerCompany: 3 }
    case 'growth':
      return { maxPages: 20, maxCompanies: 500, contactsPerCompany: 5 }
    case 'enterprise':
      return { maxPages: 40, maxCompanies: 1000, contactsPerCompany: 5 }
    default:
      // free / trialing
      return { maxPages: 1,  maxCompanies: 25,  contactsPerCompany: 1 }
  }
}

export const PLAN_LABELS: Record<string, string> = {
  free:       'Free trial',
  trialing:   'Free trial',
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
}
