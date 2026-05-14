import { NextRequest } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email/send'
import { computeProfileHash } from '@/lib/agent/lead-utils'
import type { Database } from '@/lib/types/database'

type WorkspaceUpdate = Database['public']['Tables']['workspaces']['Update']

export async function POST(req: NextRequest) {
  try {
    const { workspace, user } = await requireAuth()
    const body = await req.json()

    const {
      offer_description,
      brand_website_url,
      icp_services,
      icp_niches,
      icp_city,
      send_welcome_email,
    } = body

    const offer =
      typeof offer_description === 'string' && offer_description.trim()
        ? offer_description.trim()
        : (workspace.offer_description ?? '').trim()

    if (!offer) {
      return Response.json(
        { error: 'Offer description is missing. Complete onboarding first.' },
        { status: 400 },
      )
    }

    const niches: string[] = Array.isArray(icp_niches) ? icp_niches : []
    // Populate icp_category with the first niche for backward compat with lead_searches
    const icp_category = niches[0] ?? null
    const city = icp_city?.trim() ?? null

    const supabase = createServiceClient()

    const newProfileHash = computeProfileHash(niches, city ?? '', offer)
    const oldProfileHash = workspace.agent_profile_hash
    const isOnboarding = !workspace.onboarding_completed_at
    const isIcpChange  = !isOnboarding && oldProfileHash != null && oldProfileHash !== newProfileHash

    const update: WorkspaceUpdate = {
      offer_description: offer,
      brand_website_url: brand_website_url?.trim() ?? null,
      icp_services: Array.isArray(icp_services) && icp_services.length > 0 ? icp_services : null,
      icp_niches: niches.length > 0 ? niches : null,
      icp_category,
      icp_city: city,
      agent_profile_hash: newProfileHash,
      next_run_at: new Date().toISOString(),
    }
    if (isOnboarding) {
      update.onboarding_completed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('workspaces')
      .update(update)
      .eq('id', workspace.id)

    if (error) throw error

    // ── ICP change: demote old cells, mark outreach stale ─────────────────
    // We do NOT delete cells — they may still be partially exhausted and
    // hold useful coverage. Priority 99 means "run only when nothing else
    // is pending". The new cells (seeded by the runner via cell-planner)
    // will get priority 1 and naturally take precedence.
    if (isIcpChange) {
      await Promise.all([
        supabase
          .from('market_cells')
          .update({ priority: 99 })
          .eq('workspace_id', workspace.id)
          .lt('priority', 99),
        supabase
          .from('leads')
          .update({ outreach_email_stale: true })
          .eq('workspace_id', workspace.id)
          .not('outreach_email', 'is', null),
      ])
    }

    if (send_welcome_email === true) {
      const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://app.yuzuu.co'
      void sendWelcomeEmail({
        fullName: user.full_name,
        workspaceName: workspace.name,
        dashboardUrl: `${appBase}/${workspace.slug}/leads`,
        toEmail: user.email,
      })
    }

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
