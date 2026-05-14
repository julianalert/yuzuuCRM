/**
 * run-agent.ts
 *
 * The intent engine's per-workspace runner. The cron tick claims a workspace
 * (atomic, see `claim_next_workspaces` in migration 010) and then calls
 * `runSliceForWorkspace(workspaceId)`.
 *
 * One slice = one Apify run (either discovery or refresh). A slice:
 *  1. Validates lifecycle (subscription / trial expiry).
 *  2. Resets monthly Apify budget if calendar month rolled over.
 *  3. Picks discovery vs refresh mode.
 *  4. Atomically claims a cell (or refresh batch), runs Apify with proper
 *     customGeolocation / startUrls input, persists results.
 *  5. Runs intent detectors → relevance router.
 *  6. Enriches `hot` leads with gpt-4o-mini (was Opus).
 *  7. Marks cell status (exhausted / partial / needs_split / error).
 *  8. Schedules workspace's next_run_at based on plan (with trial burst).
 *
 * All Apify work is wrapped in per-cell try/catch — one failure cannot
 * kill the workspace's tick.
 */

import { ApifyClient } from 'apify-client'
import { createServiceClient } from '@/lib/supabase/server'
import {
  APIFY_CENTS_PER_PLACE_DISCOVERY,
  APIFY_CENTS_PER_PLACE_REFRESH,
  currentMonthKey,
  getPlanLimits,
} from '@/lib/plans'
import { planInitialCells, persistCells } from './cell-planner'
import {
  type ApifyPlace,
  computeProfileHash,
  placeHasBookingFromMaps,
  placeToLeadRow,
  scrapeWebsite,
} from './lead-utils'
import { detectAllSignals } from './signal-detectors'
import { computeRelevance } from './relevance'
import { enrichLead } from './enrich'
import { timezoneForCountry } from './geo-data/top-cities'
import { detectExistingAgency, domainFromUrl, type AgencyDetectionResult } from './agency-detector'
import { enrichLeadContact } from './contact-enrichment'
import { orchestrateSnapshotReport } from './snapshot-orchestrator'
import type { Database, Json } from '@/lib/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']
type MarketCell = Database['public']['Tables']['market_cells']['Row']

// ── Public surface ───────────────────────────────────────────────────────────

export interface SliceResult {
  skipped: boolean
  skipReason?: string
  mode?: 'discovery' | 'refresh'
  cellsScanned: number
  leadsFound: number
  leadsEnriched: number
  hotLeadsCreated: number
  apifySpendCents: number
}

export interface RunOptions {
  /** Force a mode. Default: pick automatically (refresh 30%, discovery 70%). */
  mode?: 'discovery' | 'refresh'
  /** Internal: how many cells we've already processed inside the same tick
   *  (used by trial-burst to avoid infinite loops). */
  burstIteration?: number
}

const APIFY_GMAPS_ACTOR = 'nwua9Gu5YrADL7ZDj' // compass/crawler-google-places

// Discovery: keep at 5 reviews to minimise add-on cost; refresh fetches more.
const REVIEWS_PER_DISCOVERY = 5
const REVIEWS_PER_REFRESH = 20

// Cell exhaustion thresholds
const DEDUP_RATIO_EXHAUSTED = 0.7  // 2 runs in a row above this → exhausted
const SPLIT_HARD_CAP = 120         // Google's per-area cap; hit it → needs_split

// ── Lifecycle / budget gates ─────────────────────────────────────────────────

function lifecycleSkipReason(workspace: Workspace): string | null {
  if (workspace.subscription_status === 'canceled') return 'subscription canceled'
  if (workspace.subscription_status === 'past_due') return 'subscription past_due'
  if (workspace.subscription_status === 'trialing' &&
      workspace.trial_ends_at &&
      new Date(workspace.trial_ends_at).getTime() < Date.now()) {
    return 'trial expired'
  }
  if (workspace.tam_status === 'expired') return 'tam status expired'
  return null
}

async function maybeResetMonthlyBudget(workspaceId: string, workspace: Workspace) {
  const supabase = createServiceClient()
  const key = currentMonthKey()
  if (workspace.apify_spend_month_key !== key) {
    await supabase
      .from('workspaces')
      .update({
        apify_spend_cents_month: 0,
        apify_spend_month_key: key,
      })
      .eq('id', workspaceId)
    workspace.apify_spend_cents_month = 0
    workspace.apify_spend_month_key = key
  }
}

function isInTrialBurst(workspace: Workspace): boolean {
  if (workspace.plan !== 'free' && workspace.subscription_status !== 'trialing') return false
  const limits = getPlanLimits(workspace.plan)
  if (limits.trialBurstHours <= 0) return false
  const start = workspace.onboarding_completed_at
  if (!start) return false
  const ageHours = (Date.now() - new Date(start).getTime()) / 3_600_000
  return ageHours <= limits.trialBurstHours
}

// ── Cell seeding (fired on first run if no cells exist) ──────────────────────

async function ensureCellsSeeded(workspace: Workspace): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('market_cells')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
  if ((count ?? 0) > 0) return count!

  console.log(`[agent] No cells for workspace ${workspace.id} — seeding from cell-planner`)
  const plan = await planInitialCells({
    icpCity:         workspace.icp_city,
    icpNiches:       workspace.icp_niches,
    icpServices:     workspace.icp_services,
    offerDescription: workspace.offer_description,
  })
  console.log(`[agent] ${plan.reasoning}`)
  const inserted = await persistCells(workspace.id, plan.cells)

  // Cache the (still-useful) profile hash and inferred timezone on the
  // workspace so subsequent ICP changes can be detected.
  const profileHash = computeProfileHash(
    workspace.icp_niches ?? [],
    workspace.icp_city ?? '',
    workspace.offer_description ?? '',
  )
  const tz = plan.geocode?.timezone ?? timezoneForCountry(plan.geocode?.country_code)
  await supabase
    .from('workspaces')
    .update({
      agent_profile_hash: profileHash,
      timezone: tz,
    })
    .eq('id', workspace.id)

  return inserted
}

// ── Atomic claim wrappers ────────────────────────────────────────────────────

async function claimNextCell(workspaceId: string): Promise<MarketCell | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('claim_next_cell', { p_workspace_id: workspaceId })
  if (error) {
    console.warn('[agent] claim_next_cell rpc failed:', error.message)
    return null
  }
  const rows = data as unknown as MarketCell[] | null
  return rows && rows.length > 0 ? rows[0] : null
}

async function releaseCellOnError(cell: MarketCell, errorMessage: string) {
  const supabase = createServiceClient()
  const retryCount = cell.retry_count + 1
  const backoffHours = Math.min(24, Math.pow(4, retryCount - 1))  // 1h, 4h, 16h, 24h
  const status = retryCount >= 5 ? 'dead' : 'error'
  const nextRetryAt = new Date(Date.now() + backoffHours * 3600 * 1000).toISOString()

  await supabase
    .from('market_cells')
    .update({
      status,
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
      last_error: errorMessage.slice(0, 500),
    })
    .eq('id', cell.id)
}

// ── Apify ────────────────────────────────────────────────────────────────────

interface ApifyDiscoveryRunInput {
  query: string
  lat: number
  lng: number
  radiusKm: number
  maxResults: number
}

async function apifyDiscoveryRun(input: ApifyDiscoveryRunInput): Promise<ApifyPlace[]> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not configured')

  const client = new ApifyClient({ token })
  const run = await client.actor(APIFY_GMAPS_ACTOR).call({
    searchStringsArray: [input.query],
    customGeolocation: {
      type: 'Point',
      coordinates: [input.lng, input.lat],
      radiusKm: input.radiusKm,
    },
    maxCrawledPlacesPerSearch: input.maxResults,
    language: 'en',
    reviewsCount: REVIEWS_PER_DISCOVERY,
  })
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items as unknown as ApifyPlace[]
}

async function apifyRefreshRun(placeUrls: string[]): Promise<ApifyPlace[]> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not configured')
  if (placeUrls.length === 0) return []

  const client = new ApifyClient({ token })
  const run = await client.actor(APIFY_GMAPS_ACTOR).call({
    startUrls: placeUrls.map((url) => ({ url })),
    reviewsCount: REVIEWS_PER_REFRESH,
    language: 'en',
  })
  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  return items as unknown as ApifyPlace[]
}

// ── Debit ────────────────────────────────────────────────────────────────────

async function debitApifySpend(workspaceId: string, cents: number) {
  if (cents <= 0) return
  const supabase = createServiceClient()
  const rounded = Math.max(1, Math.round(cents))
  // Use RPC-less increment via raw expression to avoid race with the cron.
  // Two writes from different ticks will serialise correctly because
  // Postgres serialises UPDATE on the same row, but we do read-then-write
  // here for simplicity; budget breach is checked at the start of the next
  // slice anyway, so a small overshoot is acceptable.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('apify_spend_cents_month')
    .eq('id', workspaceId)
    .single()
  await supabase
    .from('workspaces')
    .update({ apify_spend_cents_month: (ws?.apify_spend_cents_month ?? 0) + rounded })
    .eq('id', workspaceId)
}

// ── Discovery slice ──────────────────────────────────────────────────────────

async function runDiscoverySlice(workspace: Workspace): Promise<SliceResult> {
  const supabase = createServiceClient()
  const limits = getPlanLimits(workspace.plan)
  const cell = await claimNextCell(workspace.id)

  if (!cell) {
    // No workable cell. Hand off to expander (if available); for now mark
    // tam_status fully_scanned when expander reports nothing to add.
    return {
      skipped: true,
      skipReason: 'No pending cells available',
      mode: 'discovery',
      cellsScanned: 0,
      leadsFound: 0,
      leadsEnriched: 0,
      hotLeadsCreated: 0,
      apifySpendCents: 0,
    }
  }

  console.log(`[agent] Workspace ${workspace.id} claimed cell ${cell.id} (${cell.query} @ ${cell.lat},${cell.lng} r=${cell.radius_km}km)`)

  try {
    const places = await apifyDiscoveryRun({
      query: cell.query,
      lat: Number(cell.lat),
      lng: Number(cell.lng),
      radiusKm: Number(cell.radius_km),
      maxResults: limits.maxLeadsPerRun,
    })
    const scrapedCount = places.length

    // Charge per scraped place (we pay Apify regardless of dedup outcome).
    await debitApifySpend(workspace.id, scrapedCount * APIFY_CENTS_PER_PLACE_DISCOVERY)

    // ── Filter ─────────────────────────────────────────────────────────────
    // 1. permanentlyClosed → skip
    // 2. blocklist hits → skip
    // 3. already-seen place_ids (intra-tick + DB) → skip from "new" math, do
    //    not insert (dedup at DB layer via unique index)
    const liveOnly = places.filter((p) => !p.permanentlyClosed)

    const incomingPlaceIds = liveOnly.map((p) => p.placeId).filter((x): x is string => Boolean(x))

    const [{ data: blockedRows }, { data: existingRows }] = await Promise.all([
      supabase.from('lead_blocklist').select('place_id').eq('workspace_id', workspace.id).in('place_id', incomingPlaceIds),
      supabase.from('leads').select('place_id').eq('workspace_id', workspace.id).in('place_id', incomingPlaceIds),
    ])

    const blocked = new Set((blockedRows ?? []).map((r) => r.place_id))
    const existing = new Set((existingRows ?? []).map((r) => r.place_id).filter(Boolean) as string[])

    const newPlaces = liveOnly.filter(
      (p) => p.placeId && !blocked.has(p.placeId) && !existing.has(p.placeId),
    )

    const dedupRatio = scrapedCount > 0 ? 1 - newPlaces.length / scrapedCount : 0

    // ── Decide cell next state ────────────────────────────────────────────
    let nextStatus: MarketCell['status']
    if (scrapedCount >= SPLIT_HARD_CAP && dedupRatio < 0.3) {
      nextStatus = 'needs_split'
    } else if (scrapedCount < limits.maxLeadsPerRun) {
      // Apify returned fewer than we asked → cell is genuinely small. Done.
      nextStatus = 'exhausted'
    } else if (cell.last_dedup_ratio != null && Number(cell.last_dedup_ratio) >= DEDUP_RATIO_EXHAUSTED && dedupRatio >= DEDUP_RATIO_EXHAUSTED) {
      nextStatus = 'exhausted'
    } else {
      nextStatus = 'partial'
    }

    // ── Insert leads ──────────────────────────────────────────────────────
    let leadsInserted = 0
    let hotCreated = 0
    let enriched = 0

    if (newPlaces.length > 0) {
      // Create a lead_searches row (compat with existing pages that expect it).
      const { data: searchRow, error: searchErr } = await supabase
        .from('lead_searches')
        .insert({
          workspace_id:      workspace.id,
          category:          cell.query,
          city:              `${Number(cell.lat).toFixed(3)},${Number(cell.lng).toFixed(3)}`,
          country:           null,
          offer_description: workspace.offer_description,
          status:            'done',
          result_count:      newPlaces.length,
        })
        .select('id')
        .single()

      if (searchErr || !searchRow) throw searchErr ?? new Error('Failed to create lead_searches row')

      const now = new Date().toISOString()
      const rows = newPlaces.map((p) => ({
        search_id:    searchRow.id,
        workspace_id: workspace.id,
        ...placeToLeadRow(p, now),
      }))

      // On conflict (workspace_id, place_id) → skip. Index from migration 008.
      const { data: insertedLeads, error: insertErr } = await supabase
        .from('leads')
        .insert(rows)
        .select('*')

      if (insertErr) throw insertErr
      leadsInserted = insertedLeads?.length ?? 0

      // ── Detectors + relevance ───────────────────────────────────────────
      const hotLeads: Array<{ leadId: string; place: ApifyPlace; lead: typeof insertedLeads[number] }> = []

      // Cache scrapes inside this slice so we don't fetch the same site twice
      // when a lead transitions from "scored" to "enriched".
      const scrapeCache = new Map<string, Awaited<ReturnType<typeof scrapeWebsite>>>()

      for (const lead of insertedLeads ?? []) {
        const place = newPlaces.find((p) => p.placeId === lead.place_id)
        if (!place) continue

        // Optional website scrape for richer detectors (only on hot path)
        // Skip the network call for "weak" looking leads to save time.
        let scrape = null
        const shouldScrape = Boolean(place.website) && (lead.surface_score ?? 0) >= 50
        if (shouldScrape) {
          scrape = await scrapeWebsite(place.website!)
          scrapeCache.set(lead.id, scrape)
        }

        // ── Agency detection ────────────────────────────────────────────
        // Pure regex, fires on the HTML we already fetched — zero extra cost.
        // Strong evidence flips the lead to cold regardless of other signals.
        let agency: AgencyDetectionResult = { hasAgency: false, confidence: 'none', evidence: [] }
        const domain = domainFromUrl(place.website ?? null)
        if (scrape?.html && domain) {
          try {
            agency = detectExistingAgency({
              html: scrape.html,
              domain,
              techHints: scrape.techHints,
            })
          } catch (err) {
            console.warn(`[agent] agency-detector failed for lead=${lead.id}:`, err)
          }
        }

        const signals = detectAllSignals({
          place: {
            ...place,
            review_count: place.reviewsCount,
            rating: place.totalScore,
            category: place.categoryName,
          },
          websiteScrape: scrape,
          hasBookingFromMaps: placeHasBookingFromMaps(place),
        })

        const r = computeRelevance({
          signals,
          workspaceServices: workspace.icp_services,
          surfaceScore: lead.surface_score,
          agencyConfidence: agency.confidence,
        })

        if (signals.length > 0) {
          await supabase.from('lead_signals').upsert(
            signals.map((s) => ({
              lead_id: lead.id,
              workspace_id: workspace.id,
              type: s.type as string,
              severity: s.severity,
              evidence: s.evidence as unknown as Json,
              detected_at: new Date().toISOString(),
            })),
            { onConflict: 'lead_id,type' },
          )
        }

        await supabase
          .from('leads')
          .update({
            intent_score: r.intent_score,
            relevance:    r.relevance,
            website_tech: scrape?.techHints && scrape.techHints.length > 0 ? scrape.techHints : null,
            website_quality_score: scrape?.qualityScore ?? null,
            has_social_presence:   scrape?.hasSocialPresence ?? null,
            social_links: scrape && Object.keys(scrape.socialLinks).length > 0 ? scrape.socialLinks : null,
            has_existing_agency:        agency.hasAgency,
            existing_agency_confidence: agency.confidence,
            existing_agency_evidence:   agency.evidence.length > 0
                                          ? (agency.evidence as unknown as Json)
                                          : null,
          })
          .eq('id', lead.id)

        if (r.relevance === 'hot') {
          hotCreated++
          hotLeads.push({ leadId: lead.id, place, lead })
        }
      }

      // ── Enrichment (hot only, gpt-4o-mini) ──────────────────────────────
      // Refresh workspace budgets once before the loop so each hot lead can
      // share a single in-memory budget snapshot.
      const monthKey = new Date().toISOString().slice(0, 7)
      let contactSpend = workspace.contact_spend_month_key === monthKey
        ? workspace.contact_spend_cents_month : 0
      const contactCap = limits.monthlyContactLookupsCap * 4   // 4¢/lookup, cap is # of lookups

      let creditsAvailable = workspace.enrichment_credits ?? 0
      // Safety net: never enrich more than 10 leads per slice (planned cap)
      const HOT_ENRICHMENT_CAP_PER_SLICE = 10
      const hotsToProcess = hotLeads.slice(0, HOT_ENRICHMENT_CAP_PER_SLICE)

      for (const { leadId, place, lead } of hotsToProcess) {
        if (creditsAvailable <= 0) break
        try {
          // Decrement first to claim the credit
          const { data: updated } = await supabase
            .from('workspaces')
            .update({ enrichment_credits: creditsAvailable - 1 })
            .eq('id', workspace.id)
            .gt('enrichment_credits', 0)
            .select('enrichment_credits')
            .single()
          if (!updated) break
          creditsAvailable = updated.enrichment_credits

          await supabase.from('leads').update({ enrichment_status: 'loading' }).eq('id', leadId)

          const scrape = scrapeCache.get(leadId)
            ?? (place.website ? await scrapeWebsite(place.website).catch(() => null) : null)

          const signalsForPrompt = detectAllSignals({
            place: {
              ...place,
              review_count: place.reviewsCount,
              rating: place.totalScore,
              category: place.categoryName,
            },
            websiteScrape: scrape,
            hasBookingFromMaps: placeHasBookingFromMaps(place),
          })

          // ── Contact enrichment (free scrape + Hunter fallback) ─────────
          // Wrapped in its own try/catch so a Hunter outage can never block
          // outreach-email enrichment for this lead.
          try {
            const availableHunterBudget = Math.max(0, contactCap - contactSpend)
            const enrichResult = await enrichLeadContact({
              websiteHtml: scrape?.html ?? null,
              websiteUrl:  place.website ?? null,
              availableHunterBudgetCents: availableHunterBudget,
            })
            const c = enrichResult.contact
            if (c.email || c.name || c.linkedinUrl) {
              await supabase
                .from('leads')
                .update({
                  owner_name:         c.name,
                  owner_email:        c.email,
                  owner_email_status: c.emailStatus,
                  owner_linkedin_url: c.linkedinUrl,
                  contact_source:     c.source,
                  contact_enriched_at: new Date().toISOString(),
                })
                .eq('id', leadId)
            }
            if (enrichResult.hunterCostCents > 0) {
              contactSpend += enrichResult.hunterCostCents
              await supabase
                .from('workspaces')
                .update({
                  contact_spend_cents_month: contactSpend,
                  contact_spend_month_key: monthKey,
                })
                .eq('id', workspace.id)
            }
          } catch (err) {
            console.warn(`[agent] contact-enrich failed lead=${leadId}:`, err)
          }

          const result = await enrichLead({
            lead,
            offerDescription: workspace.offer_description ?? 'Marketing services for local businesses.',
            workspaceServices: workspace.icp_services,
            signals: signalsForPrompt,
            websiteScrape: scrape,
          })

          await supabase.from('leads').update({
            enrichment_status: 'done',
            enriched_at: new Date().toISOString(),
            opportunity_score: result.opportunity_score,
            score_reasoning: result.score_reasoning,
            review_sentiment: result.review_sentiment,
            outreach_email: result.outreach_email,
            outreach_email_stale: false,
          }).eq('id', leadId)
          enriched++

          // ── Snapshot report (gpt-4o-mini, gated by monthly report cap) ─
          // Wrapped in try/catch — a snapshot failure must not poison the
          // rest of the slice. Re-fetch the lead so we pass the most recent
          // values (esp. intent_score / owner_email).
          try {
            const { data: latest } = await supabase
              .from('leads')
              .select('id, name, category, rating, review_count, address, website, intent_score')
              .eq('id', leadId)
              .single()
            if (latest) {
              await orchestrateSnapshotReport({
                supabase,
                workspace: {
                  id: workspace.id,
                  name: workspace.name,
                  plan: workspace.plan,
                  offer_description: workspace.offer_description,
                  icp_services: workspace.icp_services,
                  icp_category: workspace.icp_category,
                  report_spend_cents_month: workspace.report_spend_cents_month,
                  report_spend_month_key: workspace.report_spend_month_key,
                  agent_profile_hash: workspace.agent_profile_hash,
                },
                lead: latest,
                signals: signalsForPrompt,
              })
            }
          } catch (err) {
            console.warn(`[agent] snapshot-report failed lead=${leadId}:`, err)
          }
        } catch (err) {
          console.error(`[agent] Enrich failed lead=${leadId}:`, err)
          await supabase.from('leads').update({ enrichment_status: 'error' }).eq('id', leadId)
        }
      }
    }

    // ── Update cell ─────────────────────────────────────────────────────────
    const updates: Partial<MarketCell> = {
      status: nextStatus,
      last_scanned_at: new Date().toISOString(),
      scraped_count: cell.scraped_count + scrapedCount,
      unique_count: cell.unique_count + leadsInserted,
      last_dedup_ratio: Number(dedupRatio.toFixed(4)),
    }
    if (nextStatus === 'exhausted') updates.exhausted_at = new Date().toISOString()
    await supabase.from('market_cells').update(updates).eq('id', cell.id)

    // ── Quadtree split (spawn 4 children) ─────────────────────────────────
    if (nextStatus === 'needs_split') {
      const childRadius = Number(cell.radius_km) / 2
      // Offset four child centers in a square; in lat/lng terms, 1 deg lat
      // ~ 111km, scale lng by cos(lat).
      const dLat = childRadius / 111
      const dLng = childRadius / (111 * Math.cos((Number(cell.lat) * Math.PI) / 180))
      const offsets: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      const children = offsets.map(([sy, sx]) => ({
        workspace_id: workspace.id,
        query: cell.query,
        lat: roundCoord(Number(cell.lat) + sy * dLat / 2),
        lng: roundCoord(Number(cell.lng) + sx * dLng / 2),
        radius_km: childRadius,
        priority: cell.priority,
        status: 'pending' as const,
        parent_cell_id: cell.id,
      }))
      await supabase.from('market_cells').upsert(children, {
        onConflict: 'workspace_id,query,lat,lng,radius_km',
        ignoreDuplicates: true,
      })
    }

    return {
      skipped: false,
      mode: 'discovery',
      cellsScanned: 1,
      leadsFound: leadsInserted,
      leadsEnriched: enriched,
      hotLeadsCreated: hotCreated,
      apifySpendCents: Math.round(scrapedCount * APIFY_CENTS_PER_PLACE_DISCOVERY),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent] Cell ${cell.id} failed:`, msg)
    await releaseCellOnError(cell, msg)
    return {
      skipped: true,
      skipReason: `Apify error: ${msg}`,
      mode: 'discovery',
      cellsScanned: 0,
      leadsFound: 0,
      leadsEnriched: 0,
      hotLeadsCreated: 0,
      apifySpendCents: 0,
    }
  }
}

// ── Refresh slice ────────────────────────────────────────────────────────────

async function runRefreshSlice(workspace: Workspace): Promise<SliceResult> {
  const supabase = createServiceClient()
  const limits = getPlanLimits(workspace.plan)
  const staleCutoff = new Date(Date.now() - limits.refreshIntervalDays * 86_400_000).toISOString()

  // Stale leads = lastRefreshedAt or createdAt older than cutoff, not archived,
  // not linked to a deal (those are already converted).
  const { data: candidates } = await supabase
    .from('leads')
    .select('id, place_id, google_maps_url')
    .eq('workspace_id', workspace.id)
    .is('archived_at', null)
    .or(`last_refreshed_at.lt.${staleCutoff},last_refreshed_at.is.null`)
    .not('google_maps_url', 'is', null)
    .order('last_refreshed_at', { ascending: true, nullsFirst: true })
    .limit(Math.min(limits.maxLeadsPerRun, 25))

  const urls = (candidates ?? [])
    .map((c) => c.google_maps_url)
    .filter((u): u is string => Boolean(u))

  if (urls.length === 0) {
    return {
      skipped: true,
      skipReason: 'No stale leads to refresh',
      mode: 'refresh',
      cellsScanned: 0,
      leadsFound: 0,
      leadsEnriched: 0,
      hotLeadsCreated: 0,
      apifySpendCents: 0,
    }
  }

  try {
    const places = await apifyRefreshRun(urls)
    await debitApifySpend(workspace.id, places.length * APIFY_CENTS_PER_PLACE_REFRESH)

    let hotCreated = 0
    for (const place of places) {
      if (!place.placeId) continue
      const candidate = candidates!.find((c) => c.place_id === place.placeId)
      if (!candidate) continue

      const scrape = place.website ? await scrapeWebsite(place.website) : null

      // Re-evaluate agency presence on refresh — a business may have hired
      // an agency between scans (a real reason to demote them).
      let agency: AgencyDetectionResult = { hasAgency: false, confidence: 'none', evidence: [] }
      const domain = domainFromUrl(place.website ?? null)
      if (scrape?.html && domain) {
        try {
          agency = detectExistingAgency({ html: scrape.html, domain, techHints: scrape.techHints })
        } catch (err) {
          console.warn(`[agent] refresh agency-detector failed lead=${candidate.id}:`, err)
        }
      }

      const signals = detectAllSignals({
        place: {
          ...place,
          review_count: place.reviewsCount,
          rating: place.totalScore,
          category: place.categoryName,
        },
        websiteScrape: scrape,
        hasBookingFromMaps: placeHasBookingFromMaps(place),
      })

      // Lookup previous relevance for the "new signal" transition.
      const { data: prev } = await supabase
        .from('leads')
        .select('relevance, intent_score, surface_score')
        .eq('id', candidate.id)
        .single()

      const r = computeRelevance({
        signals,
        workspaceServices: workspace.icp_services,
        surfaceScore: prev?.surface_score,
        agencyConfidence: agency.confidence,
      })

      if (signals.length > 0) {
        await supabase.from('lead_signals').upsert(
          signals.map((s) => ({
            lead_id: candidate.id,
            workspace_id: workspace.id,
            type: s.type as string,
            severity: s.severity,
            evidence: s.evidence as unknown as Json,
            detected_at: new Date().toISOString(),
          })),
          { onConflict: 'lead_id,type' },
        )
      }

      await supabase.from('leads').update({
        intent_score: r.intent_score,
        relevance: r.relevance,
        rating: place.totalScore ?? null,
        review_count: place.reviewsCount ?? null,
        last_refreshed_at: new Date().toISOString(),
        has_existing_agency:        agency.hasAgency,
        existing_agency_confidence: agency.confidence,
        existing_agency_evidence:   agency.evidence.length > 0
                                      ? (agency.evidence as unknown as Json)
                                      : null,
      }).eq('id', candidate.id)

      if (prev?.relevance !== 'hot' && r.relevance === 'hot') hotCreated++
    }

    return {
      skipped: false,
      mode: 'refresh',
      cellsScanned: 0,
      leadsFound: places.length,
      leadsEnriched: 0,
      hotLeadsCreated: hotCreated,
      apifySpendCents: Math.round(places.length * APIFY_CENTS_PER_PLACE_REFRESH),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[agent] Refresh failed workspace=${workspace.id}:`, msg)
    return {
      skipped: true,
      skipReason: `Apify refresh error: ${msg}`,
      mode: 'refresh',
      cellsScanned: 0,
      leadsFound: 0,
      leadsEnriched: 0,
      hotLeadsCreated: 0,
      apifySpendCents: 0,
    }
  }
}

// ── Slice driver ─────────────────────────────────────────────────────────────

export async function runSliceForWorkspace(
  workspaceId: string,
  options: RunOptions = {},
): Promise<SliceResult> {
  const supabase = createServiceClient()

  const { data: workspaceRaw, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single()
  if (error || !workspaceRaw) throw new Error(`Workspace ${workspaceId} not found`)
  const workspace = workspaceRaw as Workspace

  // 1. Lifecycle
  const lifecycle = lifecycleSkipReason(workspace)
  if (lifecycle) {
    if (lifecycle === 'trial expired') {
      await supabase.from('workspaces').update({ tam_status: 'expired' }).eq('id', workspaceId)
    }
    return {
      skipped: true, skipReason: lifecycle,
      cellsScanned: 0, leadsFound: 0, leadsEnriched: 0, hotLeadsCreated: 0, apifySpendCents: 0,
    }
  }

  // 2. Monthly budget reset
  await maybeResetMonthlyBudget(workspaceId, workspace)
  const limits = getPlanLimits(workspace.plan)
  if (workspace.apify_spend_cents_month >= limits.monthlyApifyBudgetCents) {
    return {
      skipped: true, skipReason: 'monthly Apify budget exhausted',
      cellsScanned: 0, leadsFound: 0, leadsEnriched: 0, hotLeadsCreated: 0, apifySpendCents: 0,
    }
  }

  // 3. Ensure cells exist (first-run seeding)
  const cellCount = await ensureCellsSeeded(workspace)
  if (cellCount === 0) {
    return {
      skipped: true, skipReason: 'No cells could be seeded for this workspace',
      cellsScanned: 0, leadsFound: 0, leadsEnriched: 0, hotLeadsCreated: 0, apifySpendCents: 0,
    }
  }

  // 4. Pick mode
  let mode = options.mode
  if (!mode) {
    // Refresh only when there's something to refresh AND random pick.
    const wantRefresh = Math.random() < 0.3
    if (wantRefresh) {
      const cutoff = new Date(Date.now() - limits.refreshIntervalDays * 86_400_000).toISOString()
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('archived_at', null)
        .or(`last_refreshed_at.lt.${cutoff},last_refreshed_at.is.null`)
      mode = (count ?? 0) > 0 ? 'refresh' : 'discovery'
    } else {
      mode = 'discovery'
    }
  }

  // 5. Run slice
  const result = mode === 'refresh'
    ? await runRefreshSlice(workspace)
    : await runDiscoverySlice(workspace)

  // 6. Schedule next_run_at
  const inBurst = isInTrialBurst(workspace)
  const stillHasBudget = (workspace.apify_spend_cents_month + result.apifySpendCents) < limits.monthlyApifyBudgetCents
  const burstIter = options.burstIteration ?? 0
  const canBurstAgain = inBurst && stillHasBudget && burstIter < 20 && !result.skipped && (result.leadsFound > 0 || result.cellsScanned > 0)

  const nextRunAt = canBurstAgain
    ? new Date(Date.now() + 1_000).toISOString()  // ~immediate; the cron tick will see and pick again
    : new Date(Date.now() + limits.runIntervalHours * 3600 * 1000).toISOString()

  await supabase
    .from('workspaces')
    .update({ next_run_at: nextRunAt })
    .eq('id', workspaceId)

  // 7. Persist agent_runs row (lightweight observability)
  await supabase.from('agent_runs').insert({
    workspace_id: workspaceId,
    search_query: result.mode ?? 'idle',
    location_query: '',
    fingerprint: result.mode ?? 'idle',
    leads_found: result.leadsFound,
    leads_enriched: result.leadsEnriched,
    status: result.skipped ? 'skipped' : 'done',
    error_message: result.skipReason ?? null,
  })

  return result
}

// ── Legacy alias kept so the existing onboarding fire-and-forget keeps
// working until the UI rewires to the new /api/cron/tick endpoint. The old
// route `/api/agent/run` calls this. ────────────────────────────────────────

export async function runAgentForWorkspace(workspaceId: string): Promise<{
  skipped: boolean
  skipReason?: string
  leadsFound: number
  leadsEnriched: number
}> {
  const r = await runSliceForWorkspace(workspaceId)
  return {
    skipped: r.skipped,
    skipReason: r.skipReason,
    leadsFound: r.leadsFound,
    leadsEnriched: r.leadsEnriched,
  }
}

// ── Local utility ────────────────────────────────────────────────────────────

function roundCoord(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000
}
