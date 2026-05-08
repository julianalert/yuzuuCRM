import { NextRequest } from 'next/server'
import { ApifyClient } from 'apify-client'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getPlanLimits } from '@/lib/plans'

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

export async function POST(req: NextRequest) {
  try {
    const { workspace, user } = await requireAuth()
    const body = await req.json()
    const { category, city, country, maxResults: rawMax, offerDescription } = body

    if (!category || !city || !country) {
      return Response.json(
        { error: 'category, city, and country are required' },
        { status: 400 }
      )
    }

    const limits = getPlanLimits(workspace.plan)
    const maxResults = Math.min(Number(rawMax) || limits.maxLeadsPerSearch, limits.maxLeadsPerSearch)
    const trialLimited = workspace.plan === 'free' && (Number(rawMax) || 20) > limits.maxLeadsPerSearch

    const apifyToken = process.env.APIFY_API_TOKEN
    if (!apifyToken) throw new Error('APIFY_API_TOKEN is not configured')

    const supabase = createServiceClient()

    // Create search record
    const { data: searchRow, error: searchErr } = await supabase
      .from('lead_searches')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        category,
        city,
        country,
        offer_description: offerDescription ?? workspace.offer_description,
        status: 'running',
      })
      .select()
      .single()

    if (searchErr || !searchRow) throw searchErr ?? new Error('Failed to create search')

    // Call Apify
    const client = new ApifyClient({ token: apifyToken })
    const run = await client.actor('nwua9Gu5YrADL7ZDj').call({
      searchStringsArray: [category],
      locationQuery: `${city}, ${country}`,
      maxCrawledPlacesPerSearch: maxResults,
      language: 'en',
      reviewsCount: 5,
    })

    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    const places = items as ApifyPlace[]

    // Map + score
    const leadRows = places.map((p) => ({
      search_id: searchRow.id,
      workspace_id: workspace.id,
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
      // Detect booking presence from raw Apify data directly
      has_booking_system: Boolean(
        p.reserveTableUrl ||
        (Array.isArray(p.bookingLinks) && p.bookingLinks.length > 0) ||
        (Array.isArray(p.orderBy) && p.orderBy.length > 0)
      ),
    }))

    const { data: insertedLeads, error: insertErr } = await supabase
      .from('leads')
      .insert(leadRows)
      .select()

    if (insertErr) throw insertErr

    // Mark search done
    await supabase
      .from('lead_searches')
      .update({ status: 'done', result_count: insertedLeads?.length ?? 0, apify_run_id: run.id })
      .eq('id', searchRow.id)

    return Response.json({
      searchId: searchRow.id,
      leads: insertedLeads ?? [],
      trialLimited,
      planLimit: limits.maxLeadsPerSearch,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
