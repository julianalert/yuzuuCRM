/**
 * run-agent.ts
 *
 * Core autonomous lead-finding agent.
 * Runs once per workspace per day (enforced via fingerprint + 24h cooldown).
 *
 * Flow:
 * 1. Load workspace ICP profile
 * 2. Reuse or regenerate the GPT-4o mini search plan when profile changes
 * 3. Pick today's search entry from the plan (rotating through the list)
 * 4. Check 24h cooldown via fingerprint
 * 5. Call Apify (Google Maps scraper)
 * 6. Dedup by place_id — skip any business already stored for this workspace
 * 7. Insert new leads
 * 8. Auto-enrich leads with surface_score ≥ 60 (Claude opportunity scoring)
 * 9. Record the agent_run
 */

import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { ApifyClient } from 'apify-client'
import { createServiceClient } from '@/lib/supabase/server'
import { defineSearchPlan, type SearchPlan } from './define-search'
import { getPlanLimits } from '@/lib/plans'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApifyPlace {
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
}

interface SocialLinks {
  [key: string]: string | undefined
}

export interface AgentRunResult {
  skipped: boolean
  skipReason?: string
  leadsFound: number
  leadsEnriched: number
  searchQuery?: string
  locationQuery?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeFingerprint(query: string, location: string): string {
  return crypto
    .createHash('md5')
    .update(`${query.toLowerCase().trim()}::${location.toLowerCase().trim()}`)
    .digest('hex')
}

function computeProfileHash(niches: string[], city: string, offer: string): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify({ niches: [...niches].sort(), city: city.toLowerCase().trim(), offer }))
    .digest('hex')
}

function computeSurfaceScore(place: ApifyPlace): number {
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

async function scrapeWebsite(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yuzuu/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    const socialLinks: SocialLinks = {}
    const socialPatterns: [string, RegExp][] = [
      ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i],
      ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i],
      ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/i],
      ['twitter', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/i],
      ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/i],
      ['tiktok', /https?:\/\/(?:www\.)?tiktok\.com\/[^\s"'<>]+/i],
    ]
    for (const [key, pattern] of socialPatterns) {
      const match = html.match(pattern)
      if (match) socialLinks[key] = match[0]
    }

    const bookingKeywords = /book|reserv|rendez-vous|appointment|agenda|calendar|schedule|réserver/i
    const hasBooking = bookingKeywords.test(html)

    const scriptTags = html.match(/<script[^>]+src=["'][^"']+["']/g) ?? []
    const techMap: Record<string, string> = {
      'wordpress': 'WordPress', 'wp-content': 'WordPress',
      'wix.com': 'Wix', 'shopify': 'Shopify',
      'squarespace': 'Squarespace', 'webflow': 'Webflow',
      'framer': 'Framer', 'react': 'React', 'next': 'Next.js',
      'analytics.js': 'Google Analytics', 'gtag': 'Google Analytics',
      'pixel': 'Facebook Pixel',
    }
    const techHints = Array.from(
      new Set(
        scriptTags.flatMap((tag) =>
          Object.entries(techMap)
            .filter(([key]) => tag.toLowerCase().includes(key))
            .map(([, label]) => label)
        )
      )
    )

    let qualityScore = 50
    if (html.includes('<meta property="og:')) qualityScore += 10
    if (html.includes('schema.org')) qualityScore += 5
    if (techHints.length > 0) qualityScore += 5
    if (Object.keys(socialLinks).length > 0) qualityScore += 10
    if (hasBooking) qualityScore += 10
    if (html.includes('ssl') || res.url.startsWith('https')) qualityScore += 5
    if (html.length > 30000) qualityScore += 5

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
    }
  } catch {
    return {
      qualityScore: 10, hasSocialPresence: false, socialLinks: {},
      hasBooking: false, techHints: [], bodyExcerpt: '',
    }
  }
}

// ── Main agent function ───────────────────────────────────────────────────────

export async function runAgentForWorkspace(workspaceId: string): Promise<AgentRunResult> {
  const supabase = createServiceClient()

  // 1. Load workspace
  const { data: workspace, error: wsErr } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()

  if (wsErr || !workspace) {
    throw new Error(`Workspace ${workspaceId} not found`)
  }

  if (!workspace.offer_description) {
    return { skipped: true, skipReason: 'No offer description — onboarding not complete', leadsFound: 0, leadsEnriched: 0 }
  }

  const niches = workspace.icp_niches ?? []
  const city = workspace.icp_city ?? ''

  if (niches.length === 0 || !city) {
    return { skipped: true, skipReason: 'Missing ICP niches or city', leadsFound: 0, leadsEnriched: 0 }
  }

  // 2. Compute profile hash to detect ICP changes
  const profileHash = computeProfileHash(niches, city, workspace.offer_description)

  // 3. Get or regenerate search plan
  let plan: SearchPlan

  const cachedPlan = workspace.agent_search_plan as SearchPlan | null
  const cachedHash = workspace.agent_profile_hash as string | null

  if (!cachedPlan || cachedHash !== profileHash) {
    console.log(`[agent] Regenerating search plan for workspace ${workspaceId}`)
    plan = await defineSearchPlan({
      icp_niches: niches,
      icp_city: city,
      icp_services: workspace.icp_services,
      offer_description: workspace.offer_description,
    })

    await supabase
      .from('workspaces')
      .update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        agent_search_plan: plan as any,
        agent_profile_hash: profileHash,
      })
      .eq('id', workspaceId)
  } else {
    plan = cachedPlan
  }

  if (!plan.searches || plan.searches.length === 0) {
    return { skipped: true, skipReason: 'Search plan is empty', leadsFound: 0, leadsEnriched: 0 }
  }

  // 4. Pick today's search by rotating through the plan
  const { count: runCount } = await supabase
    .from('agent_runs')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  const index = (runCount ?? 0) % plan.searches.length
  const { query, location } = plan.searches[index]

  // 5. Check 24h fingerprint cooldown
  const fingerprint = computeFingerprint(query, location)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recentRun } = await supabase
    .from('agent_runs')
    .select('id, ran_at')
    .eq('workspace_id', workspaceId)
    .eq('fingerprint', fingerprint)
    .gte('ran_at', since24h)
    .limit(1)
    .maybeSingle()

  if (recentRun) {
    return {
      skipped: true,
      skipReason: `Search "${query}" in "${location}" already ran within 24h`,
      leadsFound: 0,
      leadsEnriched: 0,
      searchQuery: query,
      locationQuery: location,
    }
  }

  // 6. Call Apify
  const apifyToken = process.env.APIFY_API_TOKEN
  if (!apifyToken) throw new Error('APIFY_API_TOKEN is not configured')

  const limits = getPlanLimits(workspace.plan)
  const maxResults = limits.maxLeadsPerSearch

  console.log(`[agent] Searching "${query}" in "${location}" (max ${maxResults})`)

  const apifyClient = new ApifyClient({ token: apifyToken })
  const run = await apifyClient.actor('nwua9Gu5YrADL7ZDj').call({
    searchStringsArray: [query],
    locationQuery: location,
    maxCrawledPlacesPerSearch: maxResults,
    language: 'en',
    reviewsCount: 5,
  })

  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems()
  const places = items as ApifyPlace[]

  if (places.length === 0) {
    await supabase.from('agent_runs').insert({
      workspace_id: workspaceId,
      search_query: query,
      location_query: location,
      fingerprint,
      leads_found: 0,
      leads_enriched: 0,
      status: 'done',
    })
    return { skipped: false, leadsFound: 0, leadsEnriched: 0, searchQuery: query, locationQuery: location }
  }

  // 7. Dedup: find place_ids already stored for this workspace
  const incomingPlaceIds = places.map((p) => p.placeId).filter(Boolean) as string[]

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('place_id')
    .eq('workspace_id', workspaceId)
    .in('place_id', incomingPlaceIds)

  const seenIds = new Set((existingLeads ?? []).map((l) => l.place_id).filter(Boolean))
  const newPlaces = places.filter((p) => !p.placeId || !seenIds.has(p.placeId))

  if (newPlaces.length === 0) {
    await supabase.from('agent_runs').insert({
      workspace_id: workspaceId,
      search_query: query,
      location_query: location,
      fingerprint,
      leads_found: 0,
      leads_enriched: 0,
      status: 'done',
    })
    return { skipped: false, leadsFound: 0, leadsEnriched: 0, searchQuery: query, locationQuery: location }
  }

  // 8. Create lead_searches record
  const { data: searchRow, error: searchErr } = await supabase
    .from('lead_searches')
    .insert({
      workspace_id: workspaceId,
      category: query,
      city: location,
      country: null,
      offer_description: workspace.offer_description,
      status: 'done',
      result_count: newPlaces.length,
      apify_run_id: run.id,
    })
    .select()
    .single()

  if (searchErr || !searchRow) throw searchErr ?? new Error('Failed to create lead_searches row')

  // 9. Insert new leads
  const now = new Date().toISOString()
  const leadRows = newPlaces.map((p) => ({
    search_id: searchRow.id,
    workspace_id: workspaceId,
    name: p.title ?? null,
    category: p.categoryName ?? null,
    address: p.address ?? null,
    phone: p.phone ?? null,
    website: p.website ?? null,
    rating: p.totalScore ?? null,
    review_count: p.reviewsCount ?? null,
    google_maps_url: p.url ?? null,
    place_id: p.placeId ?? null,
    surface_score: computeSurfaceScore(p),
    has_booking_system: Boolean(
      p.reserveTableUrl ||
      (Array.isArray(p.bookingLinks) && p.bookingLinks.length > 0) ||
      (Array.isArray(p.orderBy) && p.orderBy.length > 0)
    ),
    discovered_at: now,
  }))

  const { data: insertedLeads, error: insertErr } = await supabase
    .from('leads')
    .insert(leadRows)
    .select()

  if (insertErr) throw insertErr

  const savedLeads = insertedLeads ?? []
  let enrichedCount = 0

  // 10. Auto-enrich leads with surface_score ≥ 60
  const toEnrich = savedLeads.filter((l) => (l.surface_score ?? 0) >= 60 && l.website)

  if (toEnrich.length > 0 && workspace.enrichment_credits > 0) {
    const anthropic = new Anthropic()
    const offerDescription = workspace.offer_description ?? 'Digital marketing and web services'

    for (const lead of toEnrich) {
      if (enrichedCount >= workspace.enrichment_credits) break

      try {
        // Deduct 1 credit
        const { data: updatedWs } = await supabase
          .from('workspaces')
          .update({ enrichment_credits: workspace.enrichment_credits - enrichedCount - 1 })
          .eq('id', workspaceId)
          .gt('enrichment_credits', 0)
          .select('enrichment_credits')
          .single()

        if (!updatedWs) break // no credits left

        await supabase.from('leads').update({ enrichment_status: 'loading' }).eq('id', lead.id)

        const websiteScrape = await scrapeWebsite(lead.website!)
        if (lead.has_booking_system) websiteScrape.hasBooking = true

        const prompt = `You are a lead scoring assistant for a service agency.

Agency offer: ${offerDescription}

Business profile:
- Name: ${lead.name}
- Category: ${lead.category}
- Rating: ${lead.rating ?? 'N/A'} (${lead.review_count ?? 0} reviews)
- Address: ${lead.address ?? 'N/A'}
- Has website: Yes
- Website quality score: ${websiteScrape.qualityScore}/100
- Has booking system: ${websiteScrape.hasBooking ? 'Yes' : 'No'}
- Has social presence: ${websiteScrape.hasSocialPresence ? 'Yes' : 'No'}
- Social channels: ${Object.keys(websiteScrape.socialLinks).join(', ') || 'None found'}
- Tech stack hints: ${websiteScrape.techHints.join(', ') || 'None detected'}
${websiteScrape.bodyExcerpt ? `- Website excerpt: ${websiteScrape.bodyExcerpt}` : ''}

Score this lead from 0-100 based on how likely they are to need and buy the agency's offer.
Return ONLY valid JSON — no markdown, no explanation:
{
  "opportunity_score": <number 0-100>,
  "score_reasoning": "<3-5 bullet points separated by newlines explaining the score>",
  "review_sentiment": "<positive|mixed|negative>",
  "outreach_email": "<full personalised cold email in the same language as the business location. Include subject line as first line starting with 'Subject: '>"
}`

        const message = await anthropic.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        })

        const raw = (message.content[0] as { type: string; text: string }).text.trim()
        const aiResult = JSON.parse(raw)

        await supabase
          .from('leads')
          .update({
            enrichment_status: 'done',
            enriched_at: new Date().toISOString(),
            website_tech: websiteScrape.techHints.length > 0 ? websiteScrape.techHints : null,
            website_quality_score: websiteScrape.qualityScore || null,
            has_booking_system: websiteScrape.hasBooking,
            has_social_presence: websiteScrape.hasSocialPresence,
            social_links: Object.keys(websiteScrape.socialLinks).length > 0
              ? websiteScrape.socialLinks
              : null,
            review_sentiment: aiResult.review_sentiment ?? null,
            opportunity_score: aiResult.opportunity_score ?? null,
            score_reasoning: aiResult.score_reasoning ?? null,
            outreach_email: aiResult.outreach_email ?? null,
          })
          .eq('id', lead.id)

        enrichedCount++
      } catch (enrichErr) {
        console.error(`[agent] Enrichment failed for lead ${lead.id}:`, enrichErr)
        await supabase.from('leads').update({ enrichment_status: 'error' }).eq('id', lead.id)
      }
    }
  }

  // 11. Save agent_run record
  await supabase.from('agent_runs').insert({
    workspace_id: workspaceId,
    search_query: query,
    location_query: location,
    fingerprint,
    leads_found: savedLeads.length,
    leads_enriched: enrichedCount,
    status: 'done',
  })

  return {
    skipped: false,
    leadsFound: savedLeads.length,
    leadsEnriched: enrichedCount,
    searchQuery: query,
    locationQuery: location,
  }
}
