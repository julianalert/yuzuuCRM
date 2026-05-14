/**
 * contact-enrichment.ts
 *
 * Surfaces the decision-maker's contact info for a hot lead. Two-stage:
 *
 *  1. Free website-scrape pass — looks for mailto:, common patterns,
 *     LinkedIn URLs, and tries to attribute a name from About/Team copy.
 *     Runs on every lead we already scrape (no extra cost).
 *
 *  2. Paid Hunter.io fallback — Domain Search + Email Verifier. Only fires
 *     when (a) the free pass didn't find a usable email AND (b) the lead
 *     just turned `hot` AND (c) the workspace has Hunter budget remaining.
 *
 * Provider boundary lives in the Hunter*  functions so we can drop in
 * Dropcontact later behind the same `enrichLeadContact()` orchestrator.
 */

export type EmailStatus = 'valid' | 'risky' | 'invalid' | 'unverifiable' | 'unknown'
export type ContactSource = 'website_scrape' | 'hunter' | 'manual'

export interface BestContact {
  name: string | null
  email: string | null
  emailStatus: EmailStatus
  linkedinUrl: string | null
  source: ContactSource
  /**
   * Per-API cost in cents charged to the workspace's monthly budget.
   * 0 when the free scrape produced the result.
   */
  costCents: number
}

const HUNTER_EMAIL_LOOKUP_COST_CENTS = 4  // ~$0.034 + rounded up for safety

// ── Free website scrape ──────────────────────────────────────────────────────

/**
 * Pull all candidate emails out of HTML using a robust regex + decode
 * cloudflare-style `[email protected]` obfuscation when present.
 */
function extractEmailsFromHtml(html: string): string[] {
  const out = new Set<string>()
  // Standard regex catches mailto: + plaintext
  const rx = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(html)) !== null) {
    out.add(m[0].toLowerCase())
  }
  // Cloudflare email obfuscation: data-cfemail="<hex>"
  const cfRx = /data-cfemail="([a-f0-9]+)"/gi
  while ((m = cfRx.exec(html)) !== null) {
    const decoded = decodeCfEmail(m[1])
    if (decoded) out.add(decoded.toLowerCase())
  }
  return Array.from(out)
}

function decodeCfEmail(encoded: string): string | null {
  try {
    const r = parseInt(encoded.slice(0, 2), 16)
    let email = ''
    for (let n = 2; n < encoded.length; n += 2) {
      email += String.fromCharCode(parseInt(encoded.slice(n, n + 2), 16) ^ r)
    }
    return /@/.test(email) ? email : null
  } catch { return null }
}

/**
 * Score each candidate email and return the best one. Prefers:
 *   1. emails on the business's own domain
 *   2. personal-looking local parts ("first.last", "first") over generic
 *   3. avoids `noreply`, `do-not-reply`, hosting-platform addresses
 */
function pickBestEmail(emails: string[], domain: string | null): { email: string; score: number } | null {
  if (emails.length === 0) return null
  const lowerDomain = domain?.toLowerCase() ?? null

  const blacklist = [
    'noreply', 'no-reply', 'no.reply', 'donotreply', 'do-not-reply',
    'wix.com', 'wixsite.com', 'godaddy.com', 'gmail.com', 'yahoo.com',
    'outlook.com', 'hotmail.com', 'example.com', 'sentry.io', 'jetpack.com',
    'wordpress.com', 'jsdelivr.net',
  ]
  const genericLocal = new Set(['info', 'contact', 'hello', 'admin', 'support', 'office'])

  let best: { email: string; score: number } | null = null
  for (const raw of emails) {
    const email = raw.trim().toLowerCase()
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) continue
    if (blacklist.some((bad) => email.includes(bad))) continue

    const [local, host] = email.split('@')
    let score = 50
    if (lowerDomain && (host === lowerDomain || host.endsWith(`.${lowerDomain}`))) score += 30
    if (genericLocal.has(local)) score -= 10
    if (local.includes('.') || local.includes('-')) score += 15  // looks personal
    if (local.length <= 3) score -= 5
    if (best === null || score > best.score) best = { email, score }
  }
  return best
}

/**
 * Try to attribute a name to the email by looking at:
 *  - the email's local part ("first.last@…" → "First Last")
 *  - About/Team paragraph copy near a likely name pattern
 */
function inferNameFromEmail(email: string): string | null {
  const local = email.split('@')[0]
  if (!local) return null
  // first.last, first_last, first-last all map to "First Last"
  const parts = local.split(/[._-]/).filter((p) => p.length >= 2 && /^[a-z]+$/.test(p))
  if (parts.length < 2) return null
  return parts.slice(0, 2).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ')
}

function inferNameFromHtml(html: string): string | null {
  // Look for an "Owner: <Name>" or "Founder: <Name>" pattern in copy.
  const patterns = [
    /\b(?:owner|founder|fondateur|fondatrice|propriétaire|director|directeur|directrice|gérant|gérante|chef|manager|geschäftsführer|inhaber)\s*[:—–-]?\s*([A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+){1,2})/u,
  ]
  for (const rx of patterns) {
    const m = rx.exec(html)
    if (m && m[1] && m[1].length < 40) return m[1].trim()
  }
  return null
}

function extractLinkedinUrl(html: string): string | null {
  const rx = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|company)\/[A-Za-z0-9_\-/%]+/i
  const m = rx.exec(html)
  return m ? m[0] : null
}

export interface ScrapeContactsInput {
  html: string
  domain: string | null
}

export function extractContactsFromHtml(input: ScrapeContactsInput): BestContact {
  const emails = extractEmailsFromHtml(input.html)
  const best = pickBestEmail(emails, input.domain)
  const linkedinUrl = extractLinkedinUrl(input.html)
  if (!best) {
    return {
      name: inferNameFromHtml(input.html),
      email: null,
      emailStatus: 'unknown',
      linkedinUrl,
      source: 'website_scrape',
      costCents: 0,
    }
  }

  const name = inferNameFromHtml(input.html) ?? inferNameFromEmail(best.email)

  return {
    name,
    email: best.email,
    // We don't verify scraped emails for free; status starts 'unknown' and
    // can be upgraded by Hunter Verifier when we have budget.
    emailStatus: 'unknown',
    linkedinUrl,
    source: 'website_scrape',
    costCents: 0,
  }
}

// ── Hunter.io provider ───────────────────────────────────────────────────────

interface HunterDomainSearchResponse {
  data?: {
    emails?: Array<{
      value: string
      type?: string                 // 'personal' | 'generic'
      confidence?: number          // 0..100
      first_name?: string | null
      last_name?: string | null
      position?: string | null
      department?: string | null
      seniority?: string | null
      linkedin?: string | null
      verification?: { status?: string }
    }>
  }
}

interface HunterVerifierResponse {
  data?: {
    status?: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown'
    result?: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
    score?: number
  }
}

const HUNTER_BASE = 'https://api.hunter.io/v2'

async function hunterFetch<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) return null

  const qs = new URLSearchParams({ ...params, api_key: apiKey }).toString()
  try {
    const res = await fetch(`${HUNTER_BASE}/${path}?${qs}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[contact-enrichment] Hunter ${path} returned ${res.status}`)
      return null
    }
    return await res.json() as T
  } catch (err) {
    console.warn(`[contact-enrichment] Hunter ${path} failed:`, err)
    return null
  }
}

const POSITION_RANK: Array<{ rx: RegExp; rank: number }> = [
  { rx: /\b(?:owner|founder|co-?founder|propriétaire|fondateur|fondatrice|gérant|gérante|inhaber)\b/i, rank: 100 },
  { rx: /\b(?:ceo|chief\s+executive|président|presidente)\b/i, rank: 95 },
  { rx: /\b(?:cmo|chief\s+marketing|head\s+of\s+marketing|directeur\s+marketing)\b/i, rank: 80 },
  { rx: /\bmarketing\b/i, rank: 70 },
  { rx: /\b(?:director|directeur|directrice|manager|chef)\b/i, rank: 60 },
]

function rankPosition(position: string | null | undefined): number {
  if (!position) return 0
  for (const { rx, rank } of POSITION_RANK) if (rx.test(position)) return rank
  return 10
}

export async function lookupHunterDomain(domain: string): Promise<{
  contact: BestContact | null
  costCents: number
}> {
  if (!process.env.HUNTER_API_KEY) {
    return { contact: null, costCents: 0 }
  }
  const res = await hunterFetch<HunterDomainSearchResponse>('domain-search', { domain, limit: '10' })
  if (!res?.data?.emails || res.data.emails.length === 0) {
    return { contact: null, costCents: HUNTER_EMAIL_LOOKUP_COST_CENTS }
  }

  // Pick the highest-ranked decision-maker email
  const ranked = res.data.emails
    .filter((e) => !!e.value)
    .map((e) => ({
      raw: e,
      score: rankPosition(e.position) + (e.type === 'personal' ? 20 : 0) + Math.round((e.confidence ?? 0) / 2),
    }))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]?.raw
  if (!top) return { contact: null, costCents: HUNTER_EMAIL_LOOKUP_COST_CENTS }

  const name = [top.first_name, top.last_name].filter(Boolean).join(' ').trim() || null

  // Hunter's domain-search includes basic verification status for each email.
  const status = mapHunterVerification(top.verification?.status)

  return {
    contact: {
      name,
      email: top.value.toLowerCase(),
      emailStatus: status,
      linkedinUrl: top.linkedin ?? null,
      source: 'hunter',
      costCents: HUNTER_EMAIL_LOOKUP_COST_CENTS,
    },
    costCents: HUNTER_EMAIL_LOOKUP_COST_CENTS,
  }
}

export async function verifyEmailHunter(email: string): Promise<EmailStatus> {
  if (!process.env.HUNTER_API_KEY) return 'unknown'
  const res = await hunterFetch<HunterVerifierResponse>('email-verifier', { email })
  if (!res?.data) return 'unknown'
  return mapHunterVerification(res.data.result ?? res.data.status)
}

function mapHunterVerification(s: string | null | undefined): EmailStatus {
  if (!s) return 'unknown'
  const v = s.toLowerCase()
  if (v === 'valid' || v === 'deliverable') return 'valid'
  if (v === 'invalid' || v === 'undeliverable' || v === 'disposable') return 'invalid'
  if (v === 'risky' || v === 'accept_all' || v === 'webmail') return 'risky'
  return 'unverifiable'
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface EnrichContactInput {
  websiteHtml: string | null
  websiteUrl: string | null
  /** Pre-extracted scrape result (already done in the runner). */
  prescraped?: BestContact | null
  /**
   * Available Hunter budget in cents this month. If <= cost, Hunter is
   * skipped (free scrape result is returned unchanged).
   */
  availableHunterBudgetCents: number
}

export interface EnrichContactResult {
  contact: BestContact
  hunterUsed: boolean
  hunterCostCents: number
}

/**
 * Coordinate website-scrape → Hunter fallback → optional verifier upgrade.
 * Pure function returning a single best contact; the caller persists it.
 */
export async function enrichLeadContact(input: EnrichContactInput): Promise<EnrichContactResult> {
  const domain = input.websiteUrl ? domainFromUrl(input.websiteUrl) : null

  // 1. Free scrape (skip if caller already did it)
  let contact = input.prescraped
                ?? (input.websiteHtml
                      ? extractContactsFromHtml({ html: input.websiteHtml, domain })
                      : emptyContact())

  // 2. If we have a domain-matching email already, optionally verify it.
  if (contact.email && contact.emailStatus === 'unknown' &&
      domain && contact.email.endsWith(`@${domain}`) &&
      input.availableHunterBudgetCents >= HUNTER_EMAIL_LOOKUP_COST_CENTS &&
      process.env.HUNTER_API_KEY) {
    const status = await verifyEmailHunter(contact.email)
    return {
      contact: { ...contact, emailStatus: status },
      hunterUsed: true,
      hunterCostCents: HUNTER_EMAIL_LOOKUP_COST_CENTS,
    }
  }

  // 3. Otherwise, hit Hunter Domain Search if we have a domain and budget.
  if ((!contact.email || contact.emailStatus === 'unknown') &&
      domain &&
      input.availableHunterBudgetCents >= HUNTER_EMAIL_LOOKUP_COST_CENTS) {
    const { contact: hunter, costCents } = await lookupHunterDomain(domain)
    if (hunter && hunter.email) {
      return {
        contact: {
          ...hunter,
          // Keep the LinkedIn URL we may have already scraped if Hunter
          // didn't return one.
          linkedinUrl: hunter.linkedinUrl ?? contact.linkedinUrl,
          name: hunter.name ?? contact.name,
        },
        hunterUsed: true,
        hunterCostCents: costCents,
      }
    }
    // Hunter charged us but found nothing — still debit so the budget
    // tracker stays accurate.
    return { contact, hunterUsed: true, hunterCostCents: costCents }
  }

  return { contact, hunterUsed: false, hunterCostCents: 0 }
}

function emptyContact(): BestContact {
  return {
    name: null,
    email: null,
    emailStatus: 'unknown',
    linkedinUrl: null,
    source: 'website_scrape',
    costCents: 0,
  }
}

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}
