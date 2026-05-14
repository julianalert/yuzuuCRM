/**
 * plans.ts — single source of truth for plan limits used by the intent engine.
 *
 * - runIntervalHours: how often the cron tick will schedule a new slice for
 *   this workspace (capped at >=12h per cost discipline).
 * - maxLeadsPerRun: how many Apify places we ask for in one cell scan. Lower
 *   is cheaper. Apify charges per scraped place.
 * - monthlyApifyBudgetCents: hard ceiling on per-workspace Apify spend per
 *   calendar month. The runner skips the workspace when reached.
 * - refreshIntervalDays: how stale a lead must be before the refresh loop
 *   picks it up (re-scrape via direct place URLs, paid add-on rate).
 * - trialBurstHours: during the first N hours after onboarding, the runner
 *   ignores runIntervalHours and runs cells back-to-back inside the tick so
 *   the (now 3-day) trial is actually evaluable.
 */

export interface PlanLimits {
  /** Hours between successive slices for this workspace (cap >=12). */
  runIntervalHours: number
  /** Apify maxCrawledPlacesPerSearch per cell scan. */
  maxLeadsPerRun: number
  /** Hard monthly Apify spend ceiling per workspace, in cents. */
  monthlyApifyBudgetCents: number
  /** Refresh staleness threshold (days). */
  refreshIntervalDays: number
  /** First N hours after onboarding: burst mode (ignore runIntervalHours). */
  trialBurstHours: number
  /** Default credits granted on signup (legacy field, kept for billing). */
  enrichmentCredits: number
  /** Legacy: max leads per manual search modal. Kept for backward-compat. */
  maxLeadsPerSearch: number
  /** Max paid contact lookups per workspace per month. */
  monthlyContactLookupsCap: number
  /** Max snapshot reports generated per workspace per month. */
  monthlyReportCreditsCap: number
}

export function getPlanLimits(plan: string): PlanLimits {
  switch (plan) {
    case 'starter':
      return {
        runIntervalHours:        24,
        maxLeadsPerRun:          50,
        monthlyApifyBudgetCents: 800,    // $8/mo
        refreshIntervalDays:     14,
        trialBurstHours:         0,      // paid plans don't burst
        enrichmentCredits:       50,
        maxLeadsPerSearch:       50,
        monthlyContactLookupsCap: 50,
        monthlyReportCreditsCap:  30,
      }
    case 'growth':
      return {
        runIntervalHours:        12,
        maxLeadsPerRun:          100,
        monthlyApifyBudgetCents: 2000,   // $20/mo
        refreshIntervalDays:     14,
        trialBurstHours:         0,
        enrichmentCredits:       200,
        maxLeadsPerSearch:       100,
        monthlyContactLookupsCap: 200,
        monthlyReportCreditsCap:  100,
      }
    case 'enterprise':
      return {
        runIntervalHours:        12,
        maxLeadsPerRun:          200,
        monthlyApifyBudgetCents: 6000,   // $60/mo
        refreshIntervalDays:     14,
        trialBurstHours:         0,
        enrichmentCredits:       500,
        maxLeadsPerSearch:       200,
        monthlyContactLookupsCap: 500,
        monthlyReportCreditsCap:  500,
      }
    default:
      // free / trialing
      return {
        runIntervalHours:        24,
        maxLeadsPerRun:          10,
        monthlyApifyBudgetCents: 100,    // $1/mo — bounds trial cost
        refreshIntervalDays:     14,
        trialBurstHours:         24,     // burst for the first day to make
                                         // the 3-day trial evaluable
        enrichmentCredits:       3,
        maxLeadsPerSearch:       10,
        monthlyContactLookupsCap: 10,
        monthlyReportCreditsCap:  5,
      }
  }
}

/**
 * Apify pricing (per 1000 scraped places) at the [Business tier](https://apify.com/compass/crawler-google-places/pricing).
 * We assume Business tier because that's where the unit economics work; if
 * the org isn't on Business yet, the runner will overspend our internal
 * budget by ~2x — caught by the monthly reconciliation job (P2 follow-up).
 */
export const APIFY_CENTS_PER_PLACE_DISCOVERY = 0.21  // $2.10 / 1k
export const APIFY_CENTS_PER_PLACE_REFRESH   = 0.105 // $1.05 / 1k (add-on rate, place-details only)
export const APIFY_CENTS_PER_REVIEW          = 0.026 // $0.26 / 1k reviews (add-on)

/**
 * Returns the current month key in 'YYYY-MM' format, used by the runner to
 * detect month rollover and reset apify_spend_cents_month to 0 on the first
 * scan of a new month.
 */
export function currentMonthKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export const PLAN_LABELS: Record<string, string> = {
  free:       'Free trial',
  trialing:   'Free trial',
  starter:    'Starter',
  growth:     'Growth',
  enterprise: 'Enterprise',
}
