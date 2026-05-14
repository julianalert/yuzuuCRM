/**
 * lead-utils.ts
 *
 * Helpers shared by the discovery runner and the refresh loop:
 *   - scrapeWebsite()      — fetches and extracts tech/social/quality signals.
 *   - computeSurfaceScore() — cheap heuristic ranking from raw GMB fields.
 *   - placeToLeadRow()      — Apify place → leads.Insert row.
 *
 * Pure; no DB access.
 */

import crypto from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApifyPlace {
  title?: string
  categoryName?: string
  address?: string
  phone?: string
  website?: string
  totalScore?: number
  reviewsCount?: number
  url?: string
  placeId?: string
  bookingLinks?: unknown[]
  reserveTableUrl?: string | null
  orderBy?: unknown[]
  permanentlyClosed?: boolean
  temporarilyClosed?: boolean
  reviews?: Array<{
    stars?: number | null
    publishedAtDate?: string | null
    responseFromOwnerText?: string | null
  }>
}

export interface SocialLinks {
  [key: string]: string | undefined
}

export interface WebsiteScrapeResult {
  qualityScore: number
  hasSocialPresence: boolean
  socialLinks: SocialLinks
  hasBooking: boolean
  techHints: string[]
  bodyExcerpt: string
  /**
   * Raw HTML (capped at 250KB to bound memory). Kept for downstream
   * agency-detector + contact-enrichment passes so they don't re-fetch.
   */
  html: string
  /** Effective URL after redirects, used to derive the canonical domain. */
  finalUrl: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function computeSurfaceScore(place: ApifyPlace): number {
  let score = 50
  if (!place.website) score += 20
  const reviews = place.reviewsCount ?? 0
  if (reviews < 10) score += 15
  else if (reviews < 30) score += 8
  const rating = place.totalScore ?? 5
  if (rating < 3.5) score += 15
  else if (rating < 4.0) score += 8
  return Math.min(score, 100)
}

export function computeProfileHash(niches: string[], city: string, offer: string): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify({ niches: [...niches].sort(), city: city.toLowerCase().trim(), offer }))
    .digest('hex')
}

export async function scrapeWebsite(url: string): Promise<WebsiteScrapeResult> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yuzuu/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    const socialLinks: SocialLinks = {}
    const socialPatterns: [string, RegExp][] = [
      ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i],
      ['facebook',  /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i],
      ['linkedin',  /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/i],
      ['twitter',   /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/i],
      ['youtube',   /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/i],
      ['tiktok',    /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/i],
    ]
    for (const [key, pattern] of socialPatterns) {
      const match = html.match(pattern)
      if (match) socialLinks[key] = match[0]
    }

    const bookingKeywords = /book|reserv|rendez-vous|appointment|agenda|calendar|schedule|réserver/i
    const hasBooking = bookingKeywords.test(html)

    const scriptTags = html.match(/<script[^>]+src=["'][^"']+["']/g) ?? []
    const techMap: Record<string, string> = {
      'wordpress':    'WordPress',
      'wp-content':   'WordPress',
      'wix.com':      'Wix',
      'shopify':      'Shopify',
      'squarespace':  'Squarespace',
      'webflow':      'Webflow',
      'framer':       'Framer',
      'react':        'React',
      'next':         'Next.js',
      'analytics.js': 'Google Analytics',
      'gtag':         'Google Analytics',
      'pixel':        'Facebook Pixel',
    }
    const techHints = Array.from(
      new Set(
        scriptTags.flatMap((tag) =>
          Object.entries(techMap)
            .filter(([key]) => tag.toLowerCase().includes(key))
            .map(([, label]) => label),
        ),
      ),
    )

    let qualityScore = 50
    if (html.includes('<meta property="og:')) qualityScore += 10
    if (html.includes('schema.org'))           qualityScore += 5
    if (techHints.length > 0)                  qualityScore += 5
    if (Object.keys(socialLinks).length > 0)   qualityScore += 10
    if (hasBooking)                            qualityScore += 10
    if (html.includes('ssl') || res.url.startsWith('https')) qualityScore += 5
    if (html.length > 30_000)                  qualityScore += 5

    const bodyExcerpt = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800)

    return {
      qualityScore: Math.min(qualityScore, 100),
      hasSocialPresence: Object.keys(socialLinks).length > 0,
      socialLinks,
      hasBooking,
      techHints,
      bodyExcerpt,
      html: html.slice(0, 250_000),
      finalUrl: res.url || null,
    }
  } catch {
    return {
      qualityScore: 10, hasSocialPresence: false, socialLinks: {},
      hasBooking: false, techHints: [], bodyExcerpt: '',
      html: '', finalUrl: null,
    }
  }
}

export function placeHasBookingFromMaps(place: ApifyPlace): boolean {
  return Boolean(
    place.reserveTableUrl ||
    (Array.isArray(place.bookingLinks) && place.bookingLinks.length > 0) ||
    (Array.isArray(place.orderBy) && place.orderBy.length > 0),
  )
}

/**
 * Map an Apify place to a leads.Insert row. The caller fills search_id +
 * workspace_id (and any intent_score/relevance after detectors run).
 */
export function placeToLeadRow(place: ApifyPlace, now: string) {
  return {
    name:              place.title ?? null,
    category:          place.categoryName ?? null,
    address:           place.address ?? null,
    phone:             place.phone ?? null,
    website:           place.website ?? null,
    rating:            place.totalScore ?? null,
    review_count:      place.reviewsCount ?? null,
    google_maps_url:   place.url ?? null,
    place_id:          place.placeId ?? null,
    surface_score:     computeSurfaceScore(place),
    has_booking_system: placeHasBookingFromMaps(place),
    discovered_at:     now,
  }
}
