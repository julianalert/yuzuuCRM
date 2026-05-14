/**
 * POST /api/leads/[id]/report/regenerate
 *
 * Forces a new snapshot report for a lead. Used when the agency edits
 * their ICP/offer (existing stale-flagging flow), or when the user
 * presses the "Regenerate" button in the lead profile.
 *
 * Costs one snapshot credit from the workspace's monthly budget.
 */

import { NextRequest } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { orchestrateSnapshotReport } from '@/lib/agent/snapshot-orchestrator'
import type { DetectedSignal, SignalType } from '@/lib/agent/signal-detectors'

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await requireAuth()
    const { id: leadId } = await params

    const supabase = createServiceClient()

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id, name, category, rating, review_count, address, website, intent_score, workspace_id')
      .eq('id', leadId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    if (leadErr || !lead) {
      return Response.json({ error: 'Lead not found' }, { status: 404 })
    }

    const { data: signalRows } = await supabase
      .from('lead_signals')
      .select('type, severity, evidence')
      .eq('lead_id', leadId)

    const signals: DetectedSignal[] = (signalRows ?? []).map((r) => ({
      type: r.type as SignalType,
      severity: r.severity,
      evidence: (r.evidence as Record<string, unknown> | null) ?? {},
    }))

    const result = await orchestrateSnapshotReport({
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
      lead,
      signals,
      force: true,
    })

    if (!result.ok) {
      if (result.reason === 'budget_exhausted') {
        return Response.json({ error: 'Monthly report budget exhausted' }, { status: 402 })
      }
      return Response.json({ error: result.error ?? 'Report generation failed' }, { status: 500 })
    }

    // Also lift the "stale" flag from the outreach email — the agency just
    // refreshed the snapshot, so they almost certainly want fresh outreach
    // copy too on the next enrichment pass.
    await supabase
      .from('leads')
      .update({ outreach_email_stale: true })
      .eq('id', leadId)

    return Response.json({
      ok: true,
      reportId: result.reportId,
      publicToken: result.publicToken,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
