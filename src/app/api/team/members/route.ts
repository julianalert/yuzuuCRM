import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: Request) {
  try {
    const { workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ members: data })
  } catch (err) {
    return errorResponse(err)
  }
}
