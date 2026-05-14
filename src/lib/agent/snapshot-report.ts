/**
 * snapshot-report.ts
 *
 * One-shot generator for the 1-page lead snapshot reports — Yuzuu's
 * "killer feature". Each hot lead gets a structured report the agency can
 * paste into outreach (or download as PDF / share via link).
 *
 * The report is *structured JSON* — the React/PDF renderers turn it into
 * an HTML page or PDF document. Schema is stable so we can render the
 * same payload in three places without re-prompting.
 *
 * Cost: one gpt-4o-mini call, ~$0.005. Caller gates with the workspace's
 * monthlyReportCreditsCap.
 */

import OpenAI from 'openai'
import crypto from 'crypto'
import type { DetectedSignal } from './signal-detectors'

// ── Payload schema ───────────────────────────────────────────────────────────

export interface SnapshotPayload {
  /** Single sentence headline for the report card / share preview. */
  headline: string
  /** Numeric/categorical highlights compared to a category benchmark. */
  snapshot: Array<{
    label: string
    value: string
    benchmark: string | null
    verdict: 'good' | 'neutral' | 'bad'
  }>
  /** "Here's what we noticed" — bullets, each tied to a detected signal. */
  observations: Array<{
    title: string
    detail: string
    signalType: string | null
  }>
  /** Rough business-impact bullets. Not financial advice; the LLM is told
   *  to use cautious language. */
  estimatedCost: Array<{ area: string; rough_impact: string }>
  /** What the agency should propose. Each recommendation is mapped to one
   *  of the agency's own services so the upsell story writes itself. */
  recommendations: Array<{
    service: string
    what: string
    why: string
    expectedOutcome: string
  }>
  /** The "next step" call-to-action the agency can paste verbatim. */
  callToAction: string
  /** Language code the LLM chose (matches the business locale). */
  language: string
}

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface SnapshotInput {
  lead: {
    name: string | null
    category: string | null
    rating: number | null
    review_count: number | null
    address: string | null
    website: string | null
    intent_score: number | null
  }
  signals: DetectedSignal[]
  /** Optional category benchmarks computed by the caller (rating avg etc.). */
  benchmarks?: {
    avgRating: number | null
    avgReviewCount: number | null
    medianWebsiteQuality: number | null
    category: string | null
  }
  workspace: {
    name: string
    offerDescription: string | null
    services: string[] | null
  }
}

export const SNAPSHOT_REPORT_MODEL = 'gpt-4o-mini'

const SIGNAL_LABELS: Record<string, string> = {
  owner_unresponsive:          'Owner not replying to reviews',
  negative_review_streak:      'Recent negative review streak',
  review_velocity_drop:        'Review velocity dropped',
  review_velocity_spike:       'Review velocity surging',
  recently_opened:             'Recently opened business',
  no_tracking_pixel:           'No marketing tracking installed',
  outdated_stack:              'Outdated website stack',
  no_booking_on_needs_booking: 'No booking system for a booking-driven niche',
  phone_only:                  'Phone-only — no website',
  no_social:                   'No social presence',
  no_website:                  'No website at all',
  low_rating:                  'Low overall rating',
}

function formatSignals(signals: DetectedSignal[]): string {
  if (signals.length === 0) return '(none detected)'
  return signals
    .map((s) => `- ${SIGNAL_LABELS[s.type] ?? s.type} (severity ${s.severity}/100): ${JSON.stringify(s.evidence)}`)
    .join('\n')
}

// ── Generator ────────────────────────────────────────────────────────────────

export async function generateSnapshotReport(input: SnapshotInput): Promise<SnapshotPayload> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const services = (input.workspace.services ?? []).join(', ') || 'general marketing services'
  const offer = input.workspace.offerDescription ?? 'Marketing services for local businesses.'

  const benchLine = input.benchmarks
    ? `Category benchmarks for ${input.benchmarks.category ?? 'this niche'}:
- Avg rating: ${input.benchmarks.avgRating ?? 'n/a'}
- Avg review count: ${input.benchmarks.avgReviewCount ?? 'n/a'}
- Median website quality: ${input.benchmarks.medianWebsiteQuality ?? 'n/a'}/100`
    : '(no benchmarks provided)'

  const prompt = `You are writing a 1-page "lead snapshot report" that a marketing agency will send to a local-business owner as part of an outreach pitch.

AGENCY (you are writing on their behalf):
- Agency name: ${input.workspace.name}
- Agency offer: ${offer}
- Agency services: ${services}

PROSPECT (the local business this report is about):
- Name: ${input.lead.name ?? 'Unknown'}
- Category: ${input.lead.category ?? 'Unknown'}
- Rating: ${input.lead.rating ?? 'n/a'} (${input.lead.review_count ?? 0} reviews)
- Location: ${input.lead.address ?? 'n/a'}
- Has website: ${input.lead.website ? 'Yes' : 'No'}
- Intent score: ${input.lead.intent_score ?? 'n/a'}/100

${benchLine}

Detected intent signals (these are why we surfaced this prospect to the agency):
${formatSignals(input.signals)}

WRITING RULES:
1. Write entirely in the same language as the business's location (French for a French city, English for a UK/US city, etc.). Default to English if unsure.
2. Be specific, not generic. Reference actual numbers and signals from above.
3. Tone: warm, professional, not salesy. Never make medical/legal/financial claims. Use cautious wording like "likely", "tends to", "could".
4. For "estimatedCost" use plain-language ranges (e.g. "around 15-25% of bookings", "an estimated 200-400 monthly visitors") — never concrete dollar amounts.
5. Each recommendation MUST map to one of the agency's services (web, seo, ads, social, rep, email, booking, ai-receptionist) from the list above.
6. Keep observations and recommendations to 3-4 each. Quality over quantity.
7. The callToAction is a single sentence the agency will paste at the bottom of the email.

Return ONLY valid JSON in this exact shape — no markdown, no extra prose:

{
  "headline": "<one sentence; 80 chars max>",
  "snapshot": [
    { "label": "<eg 'Google rating'>", "value": "<eg '3.6 / 5'>", "benchmark": "<eg 'Category avg 4.3'>", "verdict": "good|neutral|bad" }
  ],
  "observations": [
    { "title": "<short>", "detail": "<1-2 sentences>", "signalType": "<one of the signal type strings above, or null>" }
  ],
  "estimatedCost": [
    { "area": "<eg 'lost bookings'>", "rough_impact": "<eg 'an estimated 15-25% of nightly covers'>" }
  ],
  "recommendations": [
    { "service": "<one of: web, seo, ads, social, rep, email, booking, ai-receptionist>", "what": "<concrete action>", "why": "<tied to a signal>", "expectedOutcome": "<plausible language>" }
  ],
  "callToAction": "<one sentence>",
  "language": "<ISO 2-letter language code>"
}`

  const response = await openai.chat.completions.create({
    model: SNAPSHOT_REPORT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 1400,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<SnapshotPayload>

  // Light validation / defaults — the renderer should never see undefined.
  return {
    headline:        typeof parsed.headline === 'string' ? parsed.headline : '',
    snapshot:        Array.isArray(parsed.snapshot)
                       ? parsed.snapshot.map(normaliseSnapshot).filter(nonNull)
                       : [],
    observations:    Array.isArray(parsed.observations)
                       ? parsed.observations.map(normaliseObservation).filter(nonNull)
                       : [],
    estimatedCost:   Array.isArray(parsed.estimatedCost)
                       ? parsed.estimatedCost
                           .filter((e): e is { area: string; rough_impact: string } =>
                             typeof e?.area === 'string' && typeof e?.rough_impact === 'string')
                       : [],
    recommendations: Array.isArray(parsed.recommendations)
                       ? parsed.recommendations.map(normaliseRecommendation).filter(nonNull)
                       : [],
    callToAction:    typeof parsed.callToAction === 'string' ? parsed.callToAction : '',
    language:        typeof parsed.language === 'string' ? parsed.language : 'en',
  }
}

function normaliseSnapshot(s: unknown): SnapshotPayload['snapshot'][number] | null {
  if (typeof s !== 'object' || s === null) return null
  const o = s as Record<string, unknown>
  if (typeof o.label !== 'string' || typeof o.value !== 'string') return null
  const verdict = (o.verdict === 'good' || o.verdict === 'bad') ? o.verdict : 'neutral'
  return {
    label: o.label,
    value: o.value,
    benchmark: typeof o.benchmark === 'string' ? o.benchmark : null,
    verdict,
  }
}

function normaliseObservation(o: unknown): SnapshotPayload['observations'][number] | null {
  if (typeof o !== 'object' || o === null) return null
  const r = o as Record<string, unknown>
  if (typeof r.title !== 'string' || typeof r.detail !== 'string') return null
  return {
    title: r.title,
    detail: r.detail,
    signalType: typeof r.signalType === 'string' ? r.signalType : null,
  }
}

function normaliseRecommendation(r: unknown): SnapshotPayload['recommendations'][number] | null {
  if (typeof r !== 'object' || r === null) return null
  const o = r as Record<string, unknown>
  if (typeof o.service !== 'string' || typeof o.what !== 'string') return null
  return {
    service: o.service,
    what: o.what,
    why: typeof o.why === 'string' ? o.why : '',
    expectedOutcome: typeof o.expectedOutcome === 'string' ? o.expectedOutcome : '',
  }
}

function nonNull<T>(x: T | null): x is T { return x !== null }

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe 24-character token for `lead_reports.public_token`.
 * 192 bits of entropy — not enumerable.
 */
export function generatePublicToken(): string {
  return crypto.randomBytes(18).toString('base64url')
}

/**
 * Approximate cost of one snapshot generation, in cents. Used by the runner
 * to debit the workspace's monthly report budget.
 */
export const SNAPSHOT_REPORT_COST_CENTS = 1   // gpt-4o-mini is cheap; round up
