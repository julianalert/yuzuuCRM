import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { user, workspace } = await requireAuth()
    const body = await req.json() as {
      deal_id: string
      account_id?: string
      contact_id?: string
      type: 'note' | 'call' | 'meeting'
      subject?: string
      body?: string
    }

    if (!body.deal_id || !body.type) {
      return NextResponse.json({ error: 'deal_id and type are required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Verify deal belongs to workspace
    const { data: deal } = await supabase
      .from('deals')
      .select('id, account_id')
      .eq('id', body.deal_id)
      .eq('workspace_id', workspace.id)
      .single()

    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({
        workspace_id: workspace.id,
        deal_id: body.deal_id,
        account_id: body.account_id ?? deal.account_id,
        contact_id: body.contact_id ?? null,
        user_id: user.id,
        type: body.type,
        source: 'manual',
        subject: body.subject ?? null,
        body: body.body ?? null,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Update deal last_activity_at
    await supabase
      .from('deals')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', body.deal_id)

    return NextResponse.json({ activity }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
