/**
 * agency-detector.ts
 *
 * Detects whether a local business already has a marketing agency working
 * for them. This is the single biggest false-positive killer for lead
 * scoring: an "objectively underperforming" business that's already paying
 * an agency is a terrible prospect, no matter how many signals fire.
 *
 * Inputs: the already-scraped website HTML + the tech hints we extracted
 * from script tags. Zero new network calls, zero extra cost.
 *
 * Output: { hasAgency, confidence, evidence[] } consumed by the relevance
 * router to downgrade or kill the lead's `hot` status.
 *
 * Confidence levels:
 *   high   — explicit credit ("Site by X", agency partner badge, or a
 *            clear marketing-stack footprint that small businesses don't
 *            self-set-up). Force `cold`.
 *   medium — multiple medium-evidence items (ESP + analytics + CRM form
 *            embed, etc.). Cap at `warm`, multiply intent_score by 0.4.
 *   low    — single medium-evidence item, or several weak-evidence ones.
 *            No effect on relevance, but surfaced as a soft warning.
 *   none   — nothing detected.
 */

export type AgencyConfidence = 'none' | 'low' | 'medium' | 'high'

export interface AgencyEvidence {
  type: string
  value: string
  weight: 'strong' | 'medium' | 'weak'
}

export interface AgencyDetectionResult {
  hasAgency: boolean
  confidence: AgencyConfidence
  evidence: AgencyEvidence[]
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface AgencyDetectorInput {
  /** Raw HTML body (we already fetched it in lead-utils.scrapeWebsite). */
  html: string
  /** The domain of the website being scraped (host, no protocol). */
  domain: string
  /** Tech hints extracted by lead-utils.scrapeWebsite. */
  techHints: string[]
}

// ── Strong evidence ──────────────────────────────────────────────────────────

/**
 * Footer / credits explicitly saying who built the site. We look for the
 * pattern + a same-line link to a different domain, so generic copy doesn't
 * trip the detector.
 */
const STRONG_CREDIT_PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: 'site_by_en',     rx: /\b(?:site|website)\s+(?:by|built\s+by|made\s+by|designed\s+by|crafted\s+by|powered\s+by|developed\s+by)\b/i },
  { name: 'site_by_fr',     rx: /\b(?:site\s+(?:par|réalisé\s+par|conçu\s+par|créé\s+par|développé\s+par)|réalisation\s*:\s*|design\s*:\s*)/i },
  { name: 'site_by_es',     rx: /\b(?:sitio\s+(?:por|realizado\s+por|diseñado\s+por))\b/i },
  { name: 'site_by_de',     rx: /\b(?:website\s+von|umgesetzt\s+von|entwickelt\s+von|gestaltet\s+von)\b/i },
  { name: 'site_by_it',     rx: /\b(?:sito\s+(?:da|realizzato\s+da|sviluppato\s+da))\b/i },
  { name: 'webflow_partner', rx: /webflow[-\s]+(?:partner|expert)/i },
  { name: 'squarespace_partner', rx: /squarespace[-\s]+circle/i },
  { name: 'shopify_partner', rx: /shopify[-\s]+(?:partner|expert)/i },
]

/**
 * Find a "made by X" string anywhere in the HTML AND verify there's a
 * link near it pointing to a different domain than the host. That gives
 * us high confidence the credit refers to a real third party.
 */
function detectExplicitCredit(html: string, domain: string): AgencyEvidence[] {
  const evidence: AgencyEvidence[] = []
  const lowerDomain = domain.toLowerCase()

  for (const { name, rx } of STRONG_CREDIT_PATTERNS) {
    const match = rx.exec(html)
    if (!match) continue

    // Search a 250-char window around the match for an external link.
    const start = Math.max(0, match.index - 80)
    const end = Math.min(html.length, match.index + 250)
    const window = html.slice(start, end)
    const linkRx = /href=["']([^"']+)["']/gi
    let lm: RegExpExecArray | null
    let externalHref: string | null = null
    while ((lm = linkRx.exec(window)) !== null) {
      const href = lm[1]
      try {
        const url = new URL(href.startsWith('http') ? href : `https://${href}`)
        const linkHost = url.hostname.replace(/^www\./, '').toLowerCase()
        if (linkHost && linkHost !== lowerDomain && !linkHost.endsWith(`.${lowerDomain}`)) {
          externalHref = url.hostname
          break
        }
      } catch { /* malformed href, ignore */ }
    }

    if (externalHref) {
      evidence.push({ type: name, value: externalHref, weight: 'strong' })
    } else if (name.startsWith('site_by_')) {
      // Found the credit phrase but no external link nearby — still a
      // medium signal because we trust the phrase itself.
      evidence.push({ type: name, value: match[0].trim(), weight: 'medium' })
    } else {
      // Partner badges (webflow_partner etc.) are strong even without a link
      evidence.push({ type: name, value: match[0].trim(), weight: 'strong' })
    }
  }

  return evidence
}

// ── Medium evidence: agency-grade marketing stack ────────────────────────────

/**
 * Mapping of normalised tech-hint substrings → human label. The lead-utils
 * scrape returns labels like "WordPress", "Google Analytics" etc.; we
 * pattern-match again in case it missed something.
 */
const AGENCY_TECH_MARKERS: Array<{ name: string; rx: RegExp }> = [
  // Email-service providers usually configured by an agency or marketing
  // ops person — small businesses rarely set these up unaided.
  { name: 'klaviyo',         rx: /\bklaviyo\b/i },
  { name: 'mailchimp_full',  rx: /mailchimp\.com\/(?:track|popup|embed)/i },
  { name: 'activecampaign',  rx: /activecampaign|trackcmp\.net/i },
  { name: 'convertkit',      rx: /convertkit\.com|kit\.com\/forms/i },
  { name: 'iterable',        rx: /iterable\.com|api\.iterable\.com/i },
  { name: 'customer_io',     rx: /customerioapi\.com|customer\.io/i },
  { name: 'sendinblue',      rx: /sendinblue|brevo\.com/i },
  // Behaviour analytics (set up by performance teams)
  { name: 'hotjar',          rx: /hotjar\.com|static\.hotjar/i },
  { name: 'fullstory',       rx: /fullstory\.com|fs\.js/i },
  { name: 'ms_clarity',      rx: /clarity\.ms/i },
  { name: 'mixpanel',        rx: /mixpanel\.com/i },
  { name: 'amplitude',       rx: /amplitude\.com/i },
  { name: 'segment',         rx: /cdn\.segment\.com|segment\.io/i },
  // CRM / sales tools (signal "they have a real funnel")
  { name: 'hubspot_full',    rx: /js\.hs-scripts\.com|hubspot\.com\/cs/i },
  { name: 'salesforce_w2l',  rx: /webto\.salesforce\.com/i },
  { name: 'pardot',          rx: /pi\.pardot\.com/i },
  { name: 'intercom',        rx: /widget\.intercom\.io/i },
  { name: 'drift',           rx: /js\.driftt\.com|drift\.com/i },
  // Conversion / experimentation (agency-grade)
  { name: 'gtm',             rx: /googletagmanager\.com\/gtm/i },
  { name: 'meta_pixel',      rx: /connect\.facebook\.net|fbq\(/i },
  { name: 'meta_capi',       rx: /fbevents\.js.*capi|conversions[-\s_]api/i },
  { name: 'tiktok_pixel',    rx: /analytics\.tiktok\.com\/i18n\/pixel/i },
  { name: 'optimizely',      rx: /cdn\.optimizely\.com/i },
  { name: 'vwo',             rx: /dev\.visualwebsiteoptimizer|wingify/i },
  // Reviews / UGC tools (only agencies/serious shops set these up)
  { name: 'yotpo',           rx: /staticw2\.yotpo\.com|yotpo\.com/i },
  { name: 'trustpilot_widget', rx: /widget\.trustpilot\.com/i },
  // Reservation / booking SaaS that costs real money + integration work
  { name: 'thefork',         rx: /widget\.thefork\.com|module\.thefork\.com/i },
  { name: 'opentable',       rx: /opentable\.com\/widget/i },
]

function detectAgencyTech(html: string, techHints: string[]): AgencyEvidence[] {
  const evidence: AgencyEvidence[] = []
  const lowerHints = techHints.map((t) => t.toLowerCase())

  for (const { name, rx } of AGENCY_TECH_MARKERS) {
    if (rx.test(html)) {
      evidence.push({ type: `tech_${name}`, value: name, weight: 'medium' })
    }
  }

  // Cross-check the tech hints we already extracted (some labels there are
  // proxies for agency presence).
  for (const hint of lowerHints) {
    if (hint.includes('hubspot')) evidence.push({ type: 'tech_hubspot_hint', value: hint, weight: 'medium' })
  }

  // Dedup by `type`.
  const seen = new Set<string>()
  return evidence.filter((e) => {
    if (seen.has(e.type)) return false
    seen.add(e.type)
    return true
  })
}

// ── Weak evidence: high-effort content ops ──────────────────────────────────

function detectBlogCadence(html: string): AgencyEvidence | null {
  // Pull any ISO dates that look like blog post timestamps. We're not
  // parsing the site map; this is a cheap heuristic.
  const dateRx = /\b(20\d{2})-(\d{2})-(\d{2})\b/g
  const recent: number[] = []
  const ninetyDaysAgo = Date.now() - 90 * 86_400_000
  let m: RegExpExecArray | null
  while ((m = dateRx.exec(html)) !== null) {
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`)
    if (!Number.isFinite(t)) continue
    if (t >= ninetyDaysAgo && t <= Date.now()) recent.push(t)
    if (recent.length > 50) break  // bound work
  }
  const distinctDays = new Set(recent.map((t) => Math.floor(t / 86_400_000))).size
  if (distinctDays < 3) return null
  return {
    type: 'recent_blog_cadence',
    value: `${distinctDays} dated content points in last 90 days`,
    weight: 'weak',
  }
}

function detectFullFunnel(html: string): AgencyEvidence | null {
  // GTM + Pixel + (CAPI or GA) === someone built a measurement stack.
  const hasGtm = /googletagmanager\.com\/gtm/i.test(html)
  const hasPixel = /connect\.facebook\.net|fbq\(/i.test(html)
  const hasGa = /gtag\(\s*['"]config['"]/i.test(html) || /google-analytics\.com\/(?:analytics|collect)/i.test(html)
  if (hasGtm && hasPixel && hasGa) {
    return { type: 'full_measurement_stack', value: 'GTM+Pixel+GA', weight: 'weak' }
  }
  return null
}

// ── Composer ─────────────────────────────────────────────────────────────────

/**
 * Run all detectors and roll them up into a confidence level.
 *
 * Confidence rules:
 *  - ANY strong evidence            → high
 *  - 3+ medium evidence             → high
 *  - 1-2 medium evidence            → medium
 *  - 1+ weak only                   → low
 *  - nothing                        → none
 */
export function detectExistingAgency(input: AgencyDetectorInput): AgencyDetectionResult {
  const hasHtml = !!input.html && input.html.length >= 200
  const hasTech = input.techHints && input.techHints.length > 0
  // Nothing to inspect — bail with 'none'. The runner uses this both for
  // discovery (full HTML available) and backfill (only techHints from DB).
  if (!hasHtml && !hasTech) {
    return { hasAgency: false, confidence: 'none', evidence: [] }
  }

  const evidence: AgencyEvidence[] = []
  if (hasHtml) evidence.push(...detectExplicitCredit(input.html, input.domain))
  evidence.push(...detectAgencyTech(hasHtml ? input.html : '', input.techHints))
  if (hasHtml) {
    const blog = detectBlogCadence(input.html)
    if (blog) evidence.push(blog)
    const funnel = detectFullFunnel(input.html)
    if (funnel) evidence.push(funnel)
  }

  const strong = evidence.filter((e) => e.weight === 'strong').length
  const medium = evidence.filter((e) => e.weight === 'medium').length

  let confidence: AgencyConfidence
  if (strong >= 1)        confidence = 'high'
  else if (medium >= 3)   confidence = 'high'
  else if (medium >= 1)   confidence = 'medium'
  else if (evidence.length > 0) confidence = 'low'
  else                    confidence = 'none'

  return {
    hasAgency: confidence === 'high' || confidence === 'medium',
    confidence,
    evidence,
  }
}

/**
 * Extract the bare domain from any URL string. Used by the runner when
 * passing lead.website into the detector.
 */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}
