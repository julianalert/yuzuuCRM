import { NextRequest } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { runAgentForWorkspace } from '@/lib/agent/run-agent'

// Allow up to 5 minutes — Apify scraping + Claude enrichment can take 30-60s.
// Requires Vercel Pro or higher; on Hobby the hard cap is 10s.
export const maxDuration = 300

/**
 * POST /api/agent/run
 *
 * Triggers the autonomous lead agent for the authenticated workspace.
 * Called:
 *  - From OnboardingWizard after profile save (fire-and-forget, keepalive: true)
 *  - From the cron handler (/api/cron/daily-agent) with service-role context
 *
 * Body (optional):
 *  { workspaceId?: string }  — when called from cron with a specific workspace id
 */
export async function POST(req: NextRequest) {
  try {
    let workspaceId: string

    // Check if this is a cron-authenticated call
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (isCronCall) {
      // Cron calls must provide workspaceId in body
      const body = await req.json().catch(() => ({}))
      if (!body.workspaceId) {
        return Response.json({ error: 'workspaceId is required for cron calls' }, { status: 400 })
      }
      workspaceId = body.workspaceId
    } else {
      // Regular user call — use their authenticated workspace
      const { workspace } = await requireAuth()
      workspaceId = workspace.id
    }

    // Run the agent — this is intentionally synchronous so the first
    // onboarding run completes before the user sees the leads page.
    // For cron calls the handler awaits each workspace sequentially.
    const result = await runAgentForWorkspace(workspaceId)

    return Response.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}
