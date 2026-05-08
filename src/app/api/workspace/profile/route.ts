import { NextRequest } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { workspace } = await requireAuth()
    const body = await req.json()

    const {
      offer_description,
      brand_website_url,
      icp_services,
      icp_niches,
      icp_city,
    } = body

    if (!offer_description?.trim()) {
      return Response.json({ error: 'offer_description is required' }, { status: 400 })
    }

    const niches: string[] = Array.isArray(icp_niches) ? icp_niches : []
    // Populate icp_category with the first niche for backward compat with lead_searches
    const icp_category = niches[0] ?? null

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('workspaces')
      .update({
        offer_description: offer_description.trim(),
        brand_website_url: brand_website_url?.trim() ?? null,
        icp_services: Array.isArray(icp_services) && icp_services.length > 0 ? icp_services : null,
        icp_niches: niches.length > 0 ? niches : null,
        icp_category,
        icp_city: icp_city?.trim() ?? null,
        // Reset the cached search plan so the agent regenerates it with the new profile
        agent_search_plan: null,
        agent_profile_hash: null,
      })
      .eq('id', workspace.id)

    if (error) throw error

    return Response.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
