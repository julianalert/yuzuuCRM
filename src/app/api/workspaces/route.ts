import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user } = await requireAuth()
    // Use serviceClient throughout — the workspaces table RLS restricts SELECT
    // to only the user's *active* workspace (get_user_workspace_id()), which
    // would hide all non-active workspaces in a join. Service role bypasses this.
    const serviceClient = createServiceClient()

    // Self-heal: ensure the active workspace always has a membership row
    await serviceClient
      .from('workspace_members')
      .insert({ user_id: user.id, workspace_id: user.workspace_id, role: user.role })
      .select()

    // Fetch all membership ids for this user
    const { data: members, error: membersError } = await serviceClient
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })

    if (membersError) throw membersError

    if (!members || members.length === 0) {
      return Response.json({ workspaces: [] })
    }

    // Fetch workspace details for all memberships
    const workspaceIds = members.map((m) => m.workspace_id)

    const { data: wsData, error: wsError } = await serviceClient
      .from('workspaces')
      .select('id, name, slug, offer_description')
      .in('id', workspaceIds)

    if (wsError) throw wsError

    const wsMap = Object.fromEntries((wsData ?? []).map((w) => [w.id, w]))

    const workspaces = members
      .map((m) => {
        const ws = wsMap[m.workspace_id]
        if (!ws) return null
        return { ...ws, role: m.role }
      })
      .filter(Boolean)

    return Response.json({ workspaces })
  } catch (err) {
    return errorResponse(err)
  }
}
