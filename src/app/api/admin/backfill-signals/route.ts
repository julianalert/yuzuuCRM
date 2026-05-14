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
import { detectExistingAgency, domainFromUrl } from '@/lib/agent/agency-detector'
import { orchestrateSnapshotReport } from '@/lib/agent/snapshot-orchestrator'
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

  // Get full workspace records for relevance + snapshot orchestration.
  const workspaceIds = Array.from(new Set(leads.map((l) => l.workspace_id)))
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, plan, offer_description, icp_services, icp_category, report_spend_cents_month, report_spend_month_key, agent_profile_hash')
    .in('id', workspaceIds)
  const wsById = new Map((workspaces ?? []).map((w) => [w.id, w]))

  let withSignals = 0
  let hotCount = 0
  let agencyFlagged = 0
  let reportsGenerated = 0

  for (const lead of leads as DbLead[]) {
    const place = leadToPlace(lead)
    const scrape = leadToScrape(lead)
    const signals: DetectedSignal[] = detectAllSignals({
      place, websiteScrape: scrape, hasBookingFromMaps: lead.has_booking_system ?? false,
    })

    // Agency detection — backfill mode runs the tech-hints branch only
    // (we don't have the HTML body for existing leads). It still catches
    // strong "this is an agency-built shop" signals: HubSpot, Webflow,
    // Klaviyo et al.
    const agency = detectExistingAgency({
      html: '',
      domain: domainFromUrl(lead.website ?? null) ?? '',
      techHints: lead.website_tech ?? [],
    })

    const ws = wsById.get(lead.workspace_id)

    const r = computeRelevance({
      signals,
      workspaceServices: ws?.icp_services ?? null,
      surfaceScore: lead.surface_score,
      agencyConfidence: agency.confidence,
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
    if (agency.hasAgency) agencyFlagged++

    await supabase
      .from('leads')
      .update({
        intent_score: r.intent_score,
        relevance: r.relevance,
        has_existing_agency: agency.hasAgency,
        existing_agency_confidence: agency.confidence,
        existing_agency_evidence:
          agency.evidence.length > 0 ? (agency.evidence as unknown as Json) : null,
      })
      .eq('id', lead.id)

    // Generate a snapshot report for hot leads that don't have one yet.
    // Respects per-workspace monthly report cap; one shared budget across
    // all leads in a workspace.
    if (r.relevance === 'hot' && ws) {
      try {
        const result = await orchestrateSnapshotReport({
          supabase,
          workspace: {
            id: ws.id,
            name: ws.name,
            plan: ws.plan,
            offer_description: ws.offer_description,
            icp_services: ws.icp_services,
            icp_category: ws.icp_category,
            report_spend_cents_month: ws.report_spend_cents_month ?? 0,
            report_spend_month_key: ws.report_spend_month_key ?? null,
            agent_profile_hash: ws.agent_profile_hash,
          },
          lead: {
            id: lead.id,
            name: lead.name,
            category: lead.category,
            rating: lead.rating,
            review_count: lead.review_count,
            address: null,
            website: lead.website,
            intent_score: r.intent_score,
          },
          signals,
        })
        if (result.ok && result.reason !== 'fresh_report_exists') reportsGenerated++
        // Refresh local cached spend so subsequent leads in the same
        // workspace see the updated month-spend without re-querying.
        if (result.ok && result.reason !== 'fresh_report_exists') {
          const cached = wsById.get(ws.id)
          if (cached) cached.report_spend_cents_month = (cached.report_spend_cents_month ?? 0) + 1
        }
      } catch (err) {
        console.warn(`[backfill] snapshot failed lead=${lead.id}:`, err)
      }
    }
  }

  return Response.json({
    processed:  leads.length,
    withSignals,
    hotCount,
    agencyFlagged,
    reportsGenerated,
  })
}
