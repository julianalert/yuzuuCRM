import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const supabase = createServiceClient()

    // Verify deal belongs to workspace
    const { data: deal } = await supabase
      .from('deals')
      .select('id, account_id')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .single()

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    // Fetch activities for both the deal directly and the linked account
    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('workspace_id', workspace.id)
      .or(deal.account_id
        ? `deal_id.eq.${id},account_id.eq.${deal.account_id}`
        : `deal_id.eq.${id}`)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ activities })
  } catch (err) {
    return errorResponse(err)
  }
}
