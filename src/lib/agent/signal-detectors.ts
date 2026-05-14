/**
 * signal-detectors.ts
 *
 * Pure functions that turn a single Apify-scraped place (plus a light
 * website scrape) into a list of intent signals. Each detector is
 * standalone and side-effect free; the caller persists the result.
 *
 * Service alignment: each signal type carries a list of `services` it
 * "fits". The relevance router weights aligned signals against the
 * workspace's `icp_services`. Misaligned signals still write rows (useful
 * for "what could we offer" exploration) but don't push intent_score.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalType =
  | 'owner_unresponsive'
  | 'negative_review_streak'
  | 'review_velocity_drop'
  | 'review_velocity_spike'
  | 'recently_opened'
  | 'no_tracking_pixel'
  | 'outdated_stack'
  | 'no_booking_on_needs_booking'
  | 'phone_only'
  | 'no_social'
  | 'no_website'
  | 'low_rating'

export interface DetectedSignal {
  type: SignalType
  severity: number  // 0..100
  evidence: Record<string, unknown>
}

export interface PlaceLike {
  place_id?: string | null
  name?: string | null
  category?: string | null
  website?: string | null
  phone?: string | null
  rating?: number | null
  review_count?: number | null
  reviews?: Array<{
    stars?: number | null
    publishedAtDate?: string | null
    responseFromOwnerText?: string | null
  }> | null
  /** Apify's permanentlyClosed; the runner filters these out before
   *  detectors are called, but defensive checks are cheap. */
  permanentlyClosed?: boolean | null
  /** First review date if known (used by recently_opened). */
  oldestReviewDate?: string | null
}

export interface WebsiteScrapeLike {
  qualityScore: number
  hasSocialPresence: boolean
  socialLinks: Record<string, string | undefined>
  hasBooking: boolean
  techHints: string[]
  bodyExcerpt: string
}

// ── Service-alignment map ────────────────────────────────────────────────────
// Mirrors the SERVICES list in OnboardingWizard.tsx.

const SIGNAL_TO_SERVICES: Record<SignalType, ReadonlyArray<string>> = {
  owner_unresponsive:          ['rep', 'social'],
  negative_review_streak:      ['rep'],
  review_velocity_drop:        ['seo', 'rep', 'social'],
  review_velocity_spike:       ['seo', 'web', 'ads', 'social', 'rep', 'email', 'booking', 'ai-receptionist'], // new business needs everything
  recently_opened:             ['web', 'seo', 'social', 'ads'],
  no_tracking_pixel:           ['ads'],
  outdated_stack:              ['web'],
  no_booking_on_needs_booking: ['booking'],
  phone_only:                  ['ai-receptionist', 'web'],
  no_social:                   ['social'],
  no_website:                  ['web'],
  low_rating:                  ['rep'],
}

export function alignmentScore(type: SignalType, workspaceServices: string[] | null | undefined): number {
  if (!workspaceServices || workspaceServices.length === 0) return 0
  const fits = SIGNAL_TO_SERVICES[type]
  return workspaceServices.some((s) => fits.includes(s)) ? 1 : 0
}

export function alignedServices(
  type: SignalType,
  workspaceServices: string[] | null | undefined,
): string[] {
  if (!workspaceServices) return []
  const fits = SIGNAL_TO_SERVICES[type]
  return workspaceServices.filter((s) => fits.includes(s))
}

// ── Niche → "needs booking" map ──────────────────────────────────────────────

const BOOKING_NICHE_KEYWORDS = [
  'restaurant', 'cafe', 'café', 'bistro', 'brasserie',
  'salon', 'spa', 'barber', 'beauty',
  'dental', 'dentist', 'medical', 'clinic', 'physio',
  'fitness', 'gym', 'yoga', 'pilates',
  'auto', 'mechanic', 'garage',
]

function nicheNeedsBooking(category: string | null | undefined): boolean {
  if (!category) return false
  const lower = category.toLowerCase()
  return BOOKING_NICHE_KEYWORDS.some((kw) => lower.includes(kw))
}

// ── Detectors ────────────────────────────────────────────────────────────────

function detectNoWebsite(place: PlaceLike): DetectedSignal | null {
  if (place.website && place.website.trim().length > 0) return null
  return {
    type: 'no_website',
    severity: 80,
    evidence: { website: place.website ?? null },
  }
}

function detectLowRating(place: PlaceLike): DetectedSignal | null {
  if (place.rating == null) return null
  if (place.rating >= 4) return null
  const reviews = place.review_count ?? 0
  if (reviews < 5) return null  // too few to count
  return {
    type: 'low_rating',
    severity: place.rating < 3 ? 80 : place.rating < 3.5 ? 65 : 50,
    evidence: { rating: place.rating, review_count: reviews },
  }
}

function detectNegativeReviewStreak(place: PlaceLike): DetectedSignal | null {
  const reviews = (place.reviews ?? []).filter((r) => r.publishedAtDate)
  if (reviews.length < 3) return null

  // Sort by publishedAtDate descending and look at the last 5.
  const recent = [...reviews]
    .sort((a, b) => +new Date(b.publishedAtDate!) - +new Date(a.publishedAtDate!))
    .slice(0, 5)

  if (recent.length < 3) return null
  const lowStars = recent.filter((r) => (r.stars ?? 0) <= 2).length
  if (lowStars < 3) return null

  return {
    type: 'negative_review_streak',
    severity: lowStars >= 4 ? 90 : 75,
    evidence: {
      window: recent.length,
      negative_count: lowStars,
      latest_review_date: recent[0]?.publishedAtDate,
    },
  }
}

function detectReviewVelocity(place: PlaceLike): DetectedSignal | null {
  const reviews = (place.reviews ?? []).filter((r) => r.publishedAtDate)
  if (reviews.length < 5) return null

  const sorted = [...reviews].sort(
    (a, b) => +new Date(a.publishedAtDate!) - +new Date(b.publishedAtDate!),
  )
  const oldest = +new Date(sorted[0].publishedAtDate!)
  const newest = +new Date(sorted[sorted.length - 1].publishedAtDate!)
  const ageDays = Math.max(1, (newest - oldest) / (1000 * 60 * 60 * 24))
  const baselinePerMonth = (reviews.length / ageDays) * 30

  const last30dCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recentCount = reviews.filter(
    (r) => +new Date(r.publishedAtDate!) >= last30dCutoff,
  ).length

  // Spike: recent rate >= 3× baseline, with at least 3 recent reviews.
  if (recentCount >= 3 && recentCount >= baselinePerMonth * 3) {
    return {
      type: 'review_velocity_spike',
      severity: Math.min(90, 60 + recentCount * 5),
      evidence: { recent_30d: recentCount, baseline_per_month: round(baselinePerMonth, 2) },
    }
  }

  // Drop: baseline >= 1/month and recent count == 0 over 90+ days.
  const last90dCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  const last90dCount = reviews.filter(
    (r) => +new Date(r.publishedAtDate!) >= last90dCutoff,
  ).length
  if (baselinePerMonth >= 1 && last90dCount === 0) {
    return {
      type: 'review_velocity_drop',
      severity: 70,
      evidence: { baseline_per_month: round(baselinePerMonth, 2), days_silent: round((Date.now() - newest) / 86_400_000, 0) },
    }
  }

  return null
}

function detectRecentlyOpened(place: PlaceLike): DetectedSignal | null {
  const dates = (place.reviews ?? [])
    .map((r) => r.publishedAtDate)
    .filter(Boolean) as string[]
  let oldest: number | null = null
  if (place.oldestReviewDate) {
    oldest = +new Date(place.oldestReviewDate)
  } else if (dates.length > 0) {
    oldest = dates.map((d) => +new Date(d)).reduce((a, b) => Math.min(a, b))
  }
  if (oldest == null) return null

  const ageMonths = (Date.now() - oldest) / (1000 * 60 * 60 * 24 * 30)
  if (ageMonths > 12) return null

  return {
    type: 'recently_opened',
    severity: ageMonths < 4 ? 90 : ageMonths < 8 ? 75 : 60,
    evidence: { age_months: round(ageMonths, 1) },
  }
}

function detectOwnerUnresponsive(place: PlaceLike): DetectedSignal | null {
  const reviews = place.reviews ?? []
  if (reviews.length < 5) return null
  const replied = reviews.filter((r) => r.responseFromOwnerText && r.responseFromOwnerText.trim().length > 0).length
  const rate = replied / reviews.length
  if (rate >= 0.1) return null
  return {
    type: 'owner_unresponsive',
    severity: rate === 0 ? 80 : 65,
    evidence: { reply_rate: round(rate, 3), reviews_seen: reviews.length },
  }
}

function detectNoTrackingPixel(scrape: WebsiteScrapeLike | null): DetectedSignal | null {
  if (!scrape) return null
  if (scrape.qualityScore <= 10) return null  // scrape failed; don't fire
  const tech = scrape.techHints.map((t) => t.toLowerCase())
  const hasGA = tech.some((t) => t.includes('analytics'))
  const hasPixel = tech.some((t) => t.includes('pixel'))
  if (hasGA || hasPixel) return null
  return {
    type: 'no_tracking_pixel',
    severity: 60,
    evidence: { tech_hints: scrape.techHints },
  }
}

function detectOutdatedStack(scrape: WebsiteScrapeLike | null): DetectedSignal | null {
  if (!scrape) return null
  const tech = scrape.techHints.map((t) => t.toLowerCase())
  const stale = tech.some((t) => t === 'wix' || t === 'wordpress')
  if (!stale) return null
  if (scrape.qualityScore >= 60) return null
  return {
    type: 'outdated_stack',
    severity: scrape.qualityScore < 35 ? 80 : 60,
    evidence: { tech_hints: scrape.techHints, quality_score: scrape.qualityScore },
  }
}

function detectNoBookingOnNeedsBooking(
  place: PlaceLike,
  websiteHasBooking: boolean,
): DetectedSignal | null {
  if (!nicheNeedsBooking(place.category)) return null
  if (websiteHasBooking) return null
  return {
    type: 'no_booking_on_needs_booking',
    severity: 70,
    evidence: { category: place.category },
  }
}

function detectPhoneOnly(place: PlaceLike): DetectedSignal | null {
  if (place.website && place.website.trim().length > 0) return null
  if (!place.phone) return null  // no contact at all isn't "phone-only"
  return {
    type: 'phone_only',
    severity: 75,
    evidence: { phone: place.phone },
  }
}

function detectNoSocial(scrape: WebsiteScrapeLike | null): DetectedSignal | null {
  if (!scrape) return null
  if (scrape.qualityScore <= 10) return null  // failed scrape
  if (scrape.hasSocialPresence) return null
  return {
    type: 'no_social',
    severity: 55,
    evidence: {},
  }
}

// ── Composer ─────────────────────────────────────────────────────────────────

export interface DetectorContext {
  place: PlaceLike
  websiteScrape: WebsiteScrapeLike | null
  hasBookingFromMaps: boolean
}

export function detectAllSignals(ctx: DetectorContext): DetectedSignal[] {
  if (ctx.place.permanentlyClosed) return []
  const websiteHasBooking = ctx.hasBookingFromMaps || (ctx.websiteScrape?.hasBooking ?? false)
  const signals: Array<DetectedSignal | null> = [
    detectNoWebsite(ctx.place),
    detectLowRating(ctx.place),
    detectNegativeReviewStreak(ctx.place),
    detectReviewVelocity(ctx.place),
    detectRecentlyOpened(ctx.place),
    detectOwnerUnresponsive(ctx.place),
    detectNoTrackingPixel(ctx.websiteScrape),
    detectOutdatedStack(ctx.websiteScrape),
    detectNoBookingOnNeedsBooking(ctx.place, websiteHasBooking),
    detectPhoneOnly(ctx.place),
    detectNoSocial(ctx.websiteScrape),
  ]
  return signals.filter((s): s is DetectedSignal => s !== null)
}

function round(n: number, places: number) {
  const f = Math.pow(10, places)
  return Math.round(n * f) / f
}
