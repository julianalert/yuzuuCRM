/**
 * enrich.ts
 *
 * Generates an opportunity score + outreach email for hot leads.
 *
 * Uses gpt-4o-mini (was claude-opus-4-5 previously). The prompt is simple
 * structured JSON — Opus was overkill and ~50× more expensive. We also
 * inject the detected intent signals so the email reflects *why* the
 * timing is right.
 */

import OpenAI from 'openai'
import type { Lead } from '@/lib/types'
import type { DetectedSignal } from './signal-detectors'
import type { WebsiteScrapeResult } from './lead-utils'

export interface EnrichResult {
  opportunity_score: number
  score_reasoning: string
  review_sentiment: 'positive' | 'mixed' | 'negative'
  outreach_email: string
}

export interface EnrichInput {
  lead: Pick<Lead, 'name' | 'category' | 'rating' | 'review_count' | 'address' | 'website'>
  offerDescription: string
  workspaceServices: string[] | null | undefined
  signals: DetectedSignal[]
  websiteScrape: WebsiteScrapeResult | null
}

function formatSignals(signals: DetectedSignal[]): string {
  if (signals.length === 0) return '(none detected)'
  return signals
    .map((s) => `- ${s.type} (severity ${s.severity}/100): ${JSON.stringify(s.evidence)}`)
    .join('\n')
}

export async function enrichLead(input: EnrichInput): Promise<EnrichResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const openai = new OpenAI({ apiKey })

  const services = (input.workspaceServices ?? []).join(', ') || 'marketing services'
  const ws = input.websiteScrape

  const prompt = `You are a lead scoring assistant for a marketing agency.

Agency offer: ${input.offerDescription}
Agency services: ${services}

Business profile:
- Name: ${input.lead.name ?? 'Unknown'}
- Category: ${input.lead.category ?? 'Unknown'}
- Rating: ${input.lead.rating ?? 'N/A'} (${input.lead.review_count ?? 0} reviews)
- Address: ${input.lead.address ?? 'N/A'}
- Has website: ${input.lead.website ? 'Yes' : 'No'}
${ws ? `- Website quality score: ${ws.qualityScore}/100
- Has booking widget: ${ws.hasBooking ? 'Yes' : 'No'}
- Social channels: ${Object.keys(ws.socialLinks).join(', ') || 'None found'}
- Tech stack: ${ws.techHints.join(', ') || 'None detected'}
${ws.bodyExcerpt ? `- Website excerpt: ${ws.bodyExcerpt.slice(0, 400)}` : ''}` : ''}

Detected intent signals (these are why we surfaced this lead):
${formatSignals(input.signals)}

Score this lead from 0-100 on how likely they are to need and BUY the agency's offer right now.
Write a personalized, NON-cringe cold outreach email in the same language as the business's location.

Return ONLY valid JSON — no markdown, no extra prose:
{
  "opportunity_score": <0-100>,
  "score_reasoning": "<3-5 short bullets separated by newlines, citing the intent signals>",
  "review_sentiment": "positive" | "mixed" | "negative",
  "outreach_email": "<full email body. The FIRST line MUST be 'Subject: <subject>'. Reference the specific intent signal(s) that prompted the outreach. Keep it under 130 words. No emojis. Sound like a human.>"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 700,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  const parsed = JSON.parse(raw) as Partial<EnrichResult>

  return {
    opportunity_score: clamp(Number(parsed.opportunity_score ?? 50), 0, 100),
    score_reasoning:   String(parsed.score_reasoning ?? '').trim(),
    review_sentiment:  (parsed.review_sentiment === 'positive' || parsed.review_sentiment === 'negative'
                        ? parsed.review_sentiment
                        : 'mixed'),
    outreach_email:    String(parsed.outreach_email ?? '').trim(),
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}
