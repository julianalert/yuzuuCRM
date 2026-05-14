/**
 * snapshot-orchestrator.ts
 *
 * Glue between the LLM generator (snapshot-report.ts) and the database.
 * Handles:
 *   - per-workspace monthly report-credit budget
 *   - month-key rollover (same pattern as Apify spend)
 *   - inserting a fresh `lead_reports` row + invalidating the previous one
 *   - generating the public share token
 *
 * Used by both the runner (auto-generate on new hot leads) and the
 * /regenerate API route (manual refresh).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { DetectedSignal } from './signal-detectors'
import {
  generateSnapshotReport,
  generatePublicToken,
  SNAPSHOT_REPORT_COST_CENTS,
  SNAPSHOT_REPORT_MODEL,
  type SnapshotInput,
} from './snapshot-report'
import { getPlanLimits } from '@/lib/plans'

type ServiceClient = SupabaseClient<Database>

export interface OrchestrateSnapshotInput {
  supabase: ServiceClient
  workspace: {
    id: string
    name: string
    plan: string
    offer_description: string | null
    icp_services: string[] | null
    icp_category: string | null
    report_spend_cents_month: number
    report_spend_month_key: string | null
    agent_profile_hash: string | null
  }
  lead: {
    id: string
    name: string | null
    category: string | null
    rating: number | null
    review_count: number | null
    address: string | null
    website: string | null
    intent_score: number | null
  }
  signals: DetectedSignal[]
  /** Force regen even if a fresh non-stale report already exists. */
  force?: boolean
}

export interface OrchestrateSnapshotResult {
  ok: boolean
  reportId?: string
  publicToken?: string
  reason?: 'budget_exhausted' | 'fresh_report_exists' | 'generation_failed'
  error?: string
}

const monthKey = () => new Date().toISOString().slice(0, 7)  // YYYY-MM

export async function orchestrateSnapshotReport(
  input: OrchestrateSnapshotInput
): Promise<OrchestrateSnapshotResult> {
  const { supabase, workspace, lead, signals, force } = input

  // 1. Short-circuit if a fresh report already exists, unless caller is
  //    explicitly regenerating (manual button / ICP change).
  if (!force) {
    const { data: existing } = await supabase
      .from('lead_reports')
      .select('id, public_token, regenerated_for_profile_hash')
      .eq('lead_id', lead.id)
      .eq('is_stale', false)
      .maybeSingle()
    if (existing && existing.regenerated_for_profile_hash === workspace.agent_profile_hash) {
      return { ok: true, reportId: existing.id, publicToken: existing.public_token, reason: 'fresh_report_exists' }
    }
  }

  // 2. Budget check (with month rollover).
  const cap = getPlanLimits(workspace.plan).monthlyReportCreditsCap
  const currentMonth = monthKey()
  const spentThisMonth = workspace.report_spend_month_key === currentMonth
    ? workspace.report_spend_cents_month
    : 0
  if (spentThisMonth + SNAPSHOT_REPORT_COST_CENTS > cap * SNAPSHOT_REPORT_COST_CENTS) {
    return { ok: false, reason: 'budget_exhausted' }
  }

  // 3. Pull category benchmarks from workspace's own dataset (cheap query).
  const benchmarks = await fetchBenchmarks(supabase, workspace.id, lead.category)

  // 4. Generate.
  let payload
  try {
    const snapshotInput: SnapshotInput = {
      lead,
      signals,
      benchmarks,
      workspace: {
        name: workspace.name,
        offerDescription: workspace.offer_description,
        services: workspace.icp_services,
      },
    }
    payload = await generateSnapshotReport(snapshotInput)
  } catch (err) {
    return {
      ok: false,
      reason: 'generation_failed',
      error: err instanceof Error ? err.message : 'unknown',
    }
  }

  // 5. Invalidate the previous active report (unique partial index enforces 1 active).
  await supabase
    .from('lead_reports')
    .update({ is_stale: true })
    .eq('lead_id', lead.id)
    .eq('is_stale', false)

  // 6. Insert new row.
  const token = generatePublicToken()
  const { data: inserted, error: insertErr } = await supabase
    .from('lead_reports')
    .insert({
      lead_id: lead.id,
      workspace_id: workspace.id,
      public_token: token,
      payload: payload as unknown as Database['public']['Tables']['lead_reports']['Insert']['payload'],
      model: SNAPSHOT_REPORT_MODEL,
      is_stale: false,
      regenerated_for_profile_hash: workspace.agent_profile_hash,
    })
    .select('id, public_token')
    .single()

  if (insertErr || !inserted) {
    return { ok: false, reason: 'generation_failed', error: insertErr?.message ?? 'insert failed' }
  }

  // 7. Debit budget.
  await supabase
    .from('workspaces')
    .update({
      report_spend_cents_month: spentThisMonth + SNAPSHOT_REPORT_COST_CENTS,
      report_spend_month_key: currentMonth,
    })
    .eq('id', workspace.id)

  return { ok: true, reportId: inserted.id, publicToken: inserted.public_token }
}

/**
 * Compute average rating + review count for the workspace's leads in the
 * same category. Cheap query, gives the LLM real context to anchor its
 * "verdict" labels in.
 */
async function fetchBenchmarks(
  supabase: ServiceClient,
  workspaceId: string,
  category: string | null,
): Promise<SnapshotInput['benchmarks']> {
  if (!category) return undefined
  const { data } = await supabase
    .from('leads')
    .select('rating, review_count, website_quality_score')
    .eq('workspace_id', workspaceId)
    .eq('category', category)
    .not('rating', 'is', null)
    .limit(200)
  if (!data || data.length === 0) {
    return { avgRating: null, avgReviewCount: null, medianWebsiteQuality: null, category }
  }
  const ratings = data.map((r) => r.rating).filter((x): x is number => typeof x === 'number')
  const reviews = data.map((r) => r.review_count).filter((x): x is number => typeof x === 'number')
  const qualities = data.map((r) => r.website_quality_score).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b)
  const median = qualities.length > 0 ? qualities[Math.floor(qualities.length / 2)] : null
  return {
    avgRating:           ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    avgReviewCount:      reviews.length ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : null,
    medianWebsiteQuality: median,
    category,
  }
}
