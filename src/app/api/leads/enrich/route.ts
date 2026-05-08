import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

interface SocialLinks {
  instagram?: string
  facebook?: string
  linkedin?: string
  twitter?: string
  youtube?: string
  tiktok?: string
  [key: string]: string | undefined
}

async function scrapeWebsite(url: string): Promise<{
  qualityScore: number
  hasSocialPresence: boolean
  socialLinks: SocialLinks
  hasBooking: boolean
  techHints: string[]
  bodyExcerpt: string
}> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yuzuu/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()

    // Detect social links
    const socialLinks: SocialLinks = {}
    const socialPatterns: [keyof SocialLinks, RegExp][] = [
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

    // Detect booking keywords
    const bookingKeywords = /book|reserv|rendez-vous|appointment|agenda|calendar|schedule|réserver/i
    const hasBooking = bookingKeywords.test(html)

    // Tech hints from script srcs
    const scriptTags = html.match(/<script[^>]+src=["'][^"']+["']/g) ?? []
    const techMap: Record<string, string> = {
      'wordpress': 'WordPress',
      'wp-content': 'WordPress',
      'wix.com': 'Wix',
      'shopify': 'Shopify',
      'squarespace': 'Squarespace',
      'webflow': 'Webflow',
      'framer': 'Framer',
      'react': 'React',
      'next': 'Next.js',
      'analytics.js': 'Google Analytics',
      'gtag': 'Google Analytics',
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

    // Quality score heuristic
    let qualityScore = 50
    if (html.includes('<meta property="og:')) qualityScore += 10
    if (html.includes('schema.org')) qualityScore += 5
    if (techHints.length > 0) qualityScore += 5
    if (Object.keys(socialLinks).length > 0) qualityScore += 10
    if (hasBooking) qualityScore += 10
    if (html.includes('ssl') || res.url.startsWith('https')) qualityScore += 5
    if (html.length > 30000) qualityScore += 5

    // Strip HTML for excerpt
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
      qualityScore: 10,
      hasSocialPresence: false,
      socialLinks: {},
      hasBooking: false,
      techHints: [],
      bodyExcerpt: '',
    }
  }
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  let leadId: string | undefined

  try {
    const { workspace } = await requireAuth()
    const body = await req.json()
    leadId = body.leadId

    if (!leadId) {
      return Response.json({ error: 'leadId is required' }, { status: 400 })
    }

    // Fetch the lead + verify ownership
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('workspace_id', workspace.id)
      .single()

    if (leadErr || !lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }

    if (lead.enrichment_status === 'loading') {
      return Response.json({ error: 'Enrichment already in progress' }, { status: 409 })
    }

    if (lead.enrichment_status === 'done') {
      return Response.json({ error: 'Lead already enriched' }, { status: 409 })
    }

    // Deduct 1 credit atomically
    const { data: updatedWs, error: creditErr } = await supabase
      .from('workspaces')
      .update({ enrichment_credits: (workspace.enrichment_credits ?? 0) - 1 })
      .eq('id', workspace.id)
      .gt('enrichment_credits', 0)
      .select('enrichment_credits')
      .single()

    if (creditErr || !updatedWs) {
      return Response.json({ error: 'Not enough credits' }, { status: 402 })
    }

    // Mark as loading
    await supabase
      .from('leads')
      .update({ enrichment_status: 'loading' })
      .eq('id', leadId)

    // Scrape website if available
    let websiteScrape = {
      qualityScore: 0,
      hasSocialPresence: false,
      socialLinks: {} as SocialLinks,
      hasBooking: lead.has_booking_system ?? false,
      techHints: [] as string[],
      bodyExcerpt: '',
    }

    if (lead.website) {
      websiteScrape = await scrapeWebsite(lead.website)
      if (lead.has_booking_system) websiteScrape.hasBooking = true
    }

    // Claude: score + email generation
    const offerDescription = workspace.offer_description ?? 'Digital marketing and web services'

    const prompt = `You are a lead scoring assistant for a service agency.

Agency offer: ${offerDescription}

Business profile:
- Name: ${lead.name}
- Category: ${lead.category}
- Rating: ${lead.rating ?? 'N/A'} (${lead.review_count ?? 0} reviews)
- Address: ${lead.address ?? 'N/A'}
- Has website: ${lead.website ? 'Yes' : 'No'}
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

    // Update lead with enriched data — Supabase Realtime will push this to the client
    const { data: updatedLead, error: updateErr } = await supabase
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
      .eq('id', leadId)
      .select()
      .single()

    if (updateErr) throw updateErr

    return Response.json({ lead: updatedLead, creditsRemaining: updatedWs.enrichment_credits })
  } catch (err) {
    // Refund credit + mark error on the lead
    if (leadId) {
      await supabase
        .from('leads')
        .update({ enrichment_status: 'error' })
        .eq('id', leadId)

      // Best-effort refund
      try {
        const { data: ws } = await supabase
          .from('workspaces')
          .select('enrichment_credits, id')
          .eq('id', (await requireAuth().catch(() => null))?.workspace?.id ?? '')
          .single()
        if (ws) {
          await supabase
            .from('workspaces')
            .update({ enrichment_credits: (ws.enrichment_credits ?? 0) + 1 })
            .eq('id', ws.id)
        }
      } catch {
        // Ignore refund failure
      }
    }

    return errorResponse(err)
  }
}
