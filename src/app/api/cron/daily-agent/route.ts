import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runAgentForWorkspace } from '@/lib/agent/run-agent'

/**
 * POST /api/cron/daily-agent
 *
 * Called by Vercel Cron every day at 7:00 UTC.
 * Iterates all workspaces that have completed onboarding (offer_description set)
 * and runs the lead agent for each one sequentially.
 *
 * Protected by CRON_SECRET — Vercel automatically sends this as the
 * Authorization header when invoking cron routes.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Load all workspaces that have finished onboarding
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name')
    .not('offer_description', 'is', null)

  if (error) {
    console.error('[cron] Failed to load workspaces:', error)
    return Response.json({ error: 'Failed to load workspaces' }, { status: 500 })
  }

  if (!workspaces || workspaces.length === 0) {
    return Response.json({ ran: 0, message: 'No workspaces to process' })
  }

  const results: Array<{ workspaceId: string; name: string; result: unknown }> = []

  for (const ws of workspaces) {
    try {
      console.log(`[cron] Running agent for workspace "${ws.name}" (${ws.id})`)
      const result = await runAgentForWorkspace(ws.id)
      results.push({ workspaceId: ws.id, name: ws.name, result })
      console.log(`[cron] Done — leadsFound=${result.leadsFound} leadsEnriched=${result.leadsEnriched} skipped=${result.skipped}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[cron] Agent failed for workspace ${ws.id}:`, message)
      results.push({ workspaceId: ws.id, name: ws.name, result: { error: message } })
    }
  }

  return Response.json({ ran: results.length, results })
}
