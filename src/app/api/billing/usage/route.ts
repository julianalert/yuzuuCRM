import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: Request) {
  try {
    const { workspace } = await requireAuth()
    const supabase = createServiceClient()

    const [seatsResult, leadsResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('workspace_id', workspace.id),
    ])

    return NextResponse.json({
      seats: seatsResult.count ?? 0,
      leads: leadsResult.count ?? 0,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
