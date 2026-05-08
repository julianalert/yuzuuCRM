import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth()
    const { workspaceId } = (await request.json()) as { workspaceId: string }

    if (!workspaceId) {
      return Response.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify the user is actually a member of the target workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!membership) {
      return Response.json({ error: 'Not a member of that workspace' }, { status: 403 })
    }

    const serviceClient = createServiceClient()

    // Fetch the target workspace slug
    const { data: workspace, error: wsError } = await serviceClient
      .from('workspaces')
      .select('id, slug, offer_description')
      .eq('id', workspaceId)
      .single()

    if (wsError || !workspace) {
      return Response.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Preserve membership in the current workspace before switching away
    await serviceClient
      .from('workspace_members')
      .insert({ user_id: user.id, workspace_id: user.workspace_id, role: user.role })
      .select()
      // Intentionally ignoring conflict errors — row may already exist

    // Update the user's active workspace
    const { error: userError } = await serviceClient
      .from('users')
      .update({ workspace_id: workspaceId })
      .eq('id', user.id)

    if (userError) throw userError

    // If onboarding incomplete, direct to onboarding; otherwise dashboard
    const destination = workspace.offer_description
      ? `/${workspace.slug}/dashboard`
      : `/${workspace.slug}/onboarding`

    return Response.json({ slug: workspace.slug, destination })
  } catch (err) {
    return errorResponse(err)
  }
}
