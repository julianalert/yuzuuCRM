/**
 * define-search.ts
 *
 * Uses GPT-4o mini to translate a workspace's abstract ICP profile
 * (e.g. "home services", "French Riviera") into concrete, Google Maps–
 * searchable queries (e.g. "plumber" in "Nice, France").
 *
 * This is intentionally cheap: GPT-4o mini is sufficient for structured
 * output tasks like this. Claude is reserved for the heavier lead scoring.
 */

import OpenAI from 'openai'

export interface SearchEntry {
  query: string     // concrete GMB search term, e.g. "plumber"
  location: string  // resolved city + country, e.g. "Nice, France"
}

export interface SearchPlan {
  searches: SearchEntry[]
  reasoning: string
}

export interface WorkspaceProfile {
  icp_niches: string[] | null
  icp_city: string | null
  icp_services: string[] | null
  offer_description: string | null
}

export async function defineSearchPlan(profile: WorkspaceProfile): Promise<SearchPlan> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const niches = (profile.icp_niches ?? []).join(', ') || 'local businesses'
  const location = profile.icp_city ?? 'Unknown location'
  const services = (profile.icp_services ?? []).join(', ') || 'digital services'
  const offer = profile.offer_description ?? `Agency offering ${services}`

  const prompt = `You are a lead generation specialist. Your task is to translate a service agency's ICP (Ideal Customer Profile) into concrete Google Maps search queries.

Agency profile:
- Target niches: ${niches}
- Target location: ${location}
- Services offered: ${services}
- Offer description: ${offer}

Instructions:
1. For each niche, expand it into 3-5 SPECIFIC, searchable business types that would appear on Google Maps. Examples:
   - "home services" → plumber, electrician, gardener, handyman, cleaning service
   - "legal" → lawyer, accountant, notary, tax advisor
   - "restaurants" → restaurant, café, brasserie, bistro
   - "beauty" → hair salon, nail salon, spa, barbershop

2. Resolve the location to the most specific, internationally recognised city name(s) that Google Maps can reliably find. Examples:
   - "French Riviera" → "Nice, France" (use the main city)
   - "Greater London" → "London, United Kingdom"
   - "Bay Area" → "San Francisco, California"
   - If a specific city is given (e.g. "Paris"), use it as-is with the country appended

3. Focus on businesses most likely to NEED the agency's services. Prioritise types that typically have weak online presence or outdated websites.

Return ONLY valid JSON, no markdown, no explanation:
{
  "searches": [
    { "query": "<specific business type>", "location": "<City, Country>" },
    ...
  ],
  "reasoning": "<one sentence explaining your choices>"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 800,
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as SearchPlan

  if (!Array.isArray(parsed.searches) || parsed.searches.length === 0) {
    throw new Error('defineSearchPlan: GPT returned an empty searches array')
  }

  return parsed
}
