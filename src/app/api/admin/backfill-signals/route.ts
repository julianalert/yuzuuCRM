/**
 * One-shot admin endpoint: backfill intent signals on existing leads.
 *
 * For every existing lead with no signals yet, run the cheap (no-network)
 * subset of detectors using whatever data we already have in the DB
 * (rating, review_count, website presence, has_booking_system,
 * website_tech, has_social_presence, website_quality_score). Doesn't
 * re-scrape Google Maps or the lead's website — those require Apify $.
 *
 * Idempotent: detectors upsert by (lead_id, type). Also writes leads.intent_score
 * and leads.relevance.
 *
 * POST /api/admin/backfill-signals
 * Authorization: Bearer <CRON_SECRET>
 *
 * Optional body: { workspaceId?: string, limit?: number }
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  type DetectedSignal,
  type PlaceLike,
  type WebsiteScrapeLike,
  detectAllSignals,
} from '@/lib/agent/signal-detectors'
import { computeRelevance } from '@/lib/agent/relevance'
import type { Json } from '@/lib/types/database'

export const maxDuration = 300

interface DbLead {
  id: string
  workspace_id: string
  name: string | null
  category: string | null
  website: string | null
  phone: string | null
  rating: number | null
  review_count: number | null
  surface_score: number | null
  has_booking_system: boolean | null
  website_tech: string[] | null
  website_quality_score: number | null
  has_social_presence: boolean | null
  social_links: Record<string, unknown> | null
}

function leadToPlace(lead: DbLead): PlaceLike {
  return {
    place_id:     null,
    name:         lead.name,
    category:     lead.category,
    website:      lead.website,
    phone:        lead.phone,
    rating:       lead.rating,
    review_count: lead.review_count,
    reviews:      null,  // no reviews stored at lead level
    permanentlyClosed: false,
  }
}

function leadToScrape(lead: DbLead): WebsiteScrapeLike | null {
  if (lead.website_quality_score == null && (lead.website_tech ?? []).length === 0) return null
  return {
    qualityScore:      lead.website_quality_score ?? 0,
    hasSocialPresence: lead.has_social_presence ?? false,
    socialLinks:       (lead.social_links ?? {}) as Record<string, string>,
    hasBooking:        lead.has_booking_system ?? false,
    techHints:         lead.website_tech ?? [],
    bodyExcerpt:       '',
  }
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { workspaceId?: string; limit?: number }
  const limit = Math.min(body.limit ?? 1000, 5000)

  const supabase = createServiceClient()

  let query = supabase
    .from('leads')
    .select('id, workspace_id, name, category, website, phone, rating, review_count, surface_score, has_booking_system, website_tech, website_quality_score, has_social_presence, social_links')
    .is('archived_at', null)
    .limit(limit)

  if (body.workspaceId) query = query.eq('workspace_id', body.workspaceId)

  const { data: leads, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!leads || leads.length === 0) return Response.json({ processed: 0 })

  // Get workspace ICP services for relevance routing.
  const workspaceIds = Array.from(new Set(leads.map((l) => l.workspace_id)))
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, icp_services')
    .in('id', workspaceIds)
  const servicesByWs = new Map((workspaces ?? []).map((w) => [w.id, w.icp_services as string[] | null]))

  let withSignals = 0
  let hotCount = 0

  for (const lead of leads as DbLead[]) {
    const place = leadToPlace(lead)
    const scrape = leadToScrape(lead)
    const signals: DetectedSignal[] = detectAllSignals({
      place, websiteScrape: scrape, hasBookingFromMaps: lead.has_booking_system ?? false,
    })

    const r = computeRelevance({
      signals,
      workspaceServices: servicesByWs.get(lead.workspace_id) ?? null,
      surfaceScore: lead.surface_score,
    })

    if (signals.length > 0) {
      withSignals++
      await supabase.from('lead_signals').upsert(
        signals.map((s) => ({
          lead_id: lead.id,
          workspace_id: lead.workspace_id,
          type: s.type as string,
          severity: s.severity,
          evidence: s.evidence as unknown as Json,
          detected_at: new Date().toISOString(),
        })),
        { onConflict: 'lead_id,type' },
      )
    }

    if (r.relevance === 'hot') hotCount++

    await supabase
      .from('leads')
      .update({ intent_score: r.intent_score, relevance: r.relevance })
      .eq('id', lead.id)
  }

  return Response.json({
    processed:  leads.length,
    withSignals,
    hotCount,
  })
}
