import { createClient } from '@/lib/supabase/server'
import type { User, Workspace } from '@/lib/types'

export interface AuthContext {
  user: User
  workspace: Workspace
}

export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    throw new UnauthorizedError('Not authenticated')
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!dbUser) throw new UnauthorizedError('User profile not found')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', dbUser.workspace_id)
    .single()

  if (!workspace) throw new UnauthorizedError('Workspace not found')

  return { user: dbUser as User, workspace: workspace as Workspace }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: err.message }, { status: 401 })
  }
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[API Error]', err)
  return Response.json({ error: message }, { status: 500 })
}
