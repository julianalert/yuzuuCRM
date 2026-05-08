import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const { user } = await requireAuth()
    const serviceClient = createServiceClient()

    // Generate a unique temp slug
    const tempSlug = `workspace-${Date.now().toString(36)}`

    const { data: workspace, error: wsError } = await serviceClient
      .from('workspaces')
      .insert({
        name: 'New Workspace',
        slug: tempSlug,
        plan: 'free',
        subscription_status: 'trialing',
        seat_limit: 1,
        account_limit: 100,
        enrichment_credits: 0,
      })
      .select('id, slug')
      .single()

    if (wsError) throw wsError

    // Preserve membership in the OLD workspace before switching away from it
    // (insert is a no-op if the row already exists)
    await serviceClient
      .from('workspace_members')
      .insert({ user_id: user.id, workspace_id: user.workspace_id, role: user.role })
      .select()
      // Intentionally ignoring conflict errors — row may already exist

    // Add the user as a member of the new workspace
    const { error: memberError } = await serviceClient
      .from('workspace_members')
      .insert({ user_id: user.id, workspace_id: workspace.id, role: 'owner' })

    if (memberError) throw memberError

    // Switch the user's active workspace so RLS resolves to the new one
    const { error: userError } = await serviceClient
      .from('users')
      .update({ workspace_id: workspace.id })
      .eq('id', user.id)

    if (userError) throw userError

    return Response.json({ slug: workspace.slug })
  } catch (err) {
    return errorResponse(err)
  }
}
