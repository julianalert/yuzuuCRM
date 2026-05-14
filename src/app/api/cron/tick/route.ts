import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runSliceForWorkspace } from '@/lib/agent/run-agent'
import { runExpansionIfNeeded } from '@/lib/agent/expander'
import { sendDailyDigests } from '@/lib/agent/digest'
import { archivePiledUpHotLeads } from '@/lib/agent/pile-up'
import type { Database } from '@/lib/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

// Vercel Pro: 300s hard cap. Each Apify run is 30-120s, so we pick a small
// batch per invocation and let the next tick (every 30 min) drain the rest.
export const maxDuration = 300

const MAX_WORKSPACES_PER_TICK = 3

/**
 * GET /api/cron/tick
 *
 * Vercel cron every 30 minutes. Atomically claims up to N due workspaces
 * (skipping ones already locked by a concurrent invocation), runs one
 * slice per workspace, then opportunistically triggers the expander and
 * sends daily digests.
 *
 * Protected by CRON_SECRET — Vercel cron automatically sends this as the
 * Authorization header.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = createServiceClient()

  const { data: claimed, error } = await supabase.rpc('claim_next_workspaces', {
    p_limit: MAX_WORKSPACES_PER_TICK,
  })

  if (error) {
    console.error('[cron/tick] claim_next_workspaces failed:', error)
    return Response.json({ error: 'claim failed' }, { status: 500 })
  }

  const workspaces = (claimed ?? []) as unknown as Workspace[]
  const results: Array<{ workspaceId: string; name: string; result: unknown }> = []

  for (const ws of workspaces) {
    try {
      const result = await runSliceForWorkspace(ws.id)
      results.push({ workspaceId: ws.id, name: ws.name, result })
      console.log(`[cron/tick] ${ws.name} (${ws.id}) — mode=${result.mode ?? 'idle'} leadsFound=${result.leadsFound} hot=${result.hotLeadsCreated} skipped=${result.skipped}${result.skipReason ? ` (${result.skipReason})` : ''}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron/tick] Slice failed for ${ws.id}:`, message)
      results.push({ workspaceId: ws.id, name: ws.name, result: { error: message } })
      // Release the workspace claim so it retries next tick.
      await supabase
        .from('workspaces')
        .update({ next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
        .eq('id', ws.id)
    }
  }

  // Opportunistic: trigger expander for workspaces with high cell exhaustion.
  // Cheap (only a DB read per workspace unless it actually needs expanding).
  try {
    await runExpansionIfNeeded(MAX_WORKSPACES_PER_TICK)
  } catch (err) {
    console.error('[cron/tick] expander failed:', err)
  }

  // Send daily digests for workspaces with new hot leads + due send.
  try {
    const digestResult = await sendDailyDigests()
    if (digestResult.sent > 0) console.log(`[cron/tick] sent ${digestResult.sent} digest(s)`)
  } catch (err) {
    console.error('[cron/tick] digest failed:', err)
  }

  // Once a day around UTC 4 AM, run the pile-up archiver. Cheap and idempotent.
  if (new Date().getUTCHours() === 4) {
    try {
      await archivePiledUpHotLeads()
    } catch (err) {
      console.error('[cron/tick] pile-up failed:', err)
    }
  }

  return Response.json({
    ran: results.length,
    elapsedMs: Date.now() - startedAt,
    results,
  })
}
