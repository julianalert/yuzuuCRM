import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { scoreDeal } from '@/lib/ai/deal-scorer'
import type { Deal, Account, Activity } from '@/lib/types'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const supabase = createServiceClient()

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    if (!deal.account_id) {
      return NextResponse.json({ error: 'Deal has no linked account' }, { status: 400 })
    }

    const [{ data: account }, { data: activities }] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', deal.account_id).single(),
      supabase.from('activities').select('*').eq('account_id', deal.account_id).order('occurred_at', { ascending: false }).limit(20),
    ])

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const result = await scoreDeal(deal as Deal, account as Account, (activities ?? []) as Activity[])
    const health = result.score >= 60 ? 'green' : result.score >= 40 ? 'amber' : 'red'
    const stall = result.score < 50 ? new Date().toISOString() : null
    const clearStall = result.score >= 60 ? null : undefined

    const { data: updated, error: updateError } = await supabase
      .from('deals')
      .update({
        ai_health_score: result.score,
        ai_health_reason: result.reason,
        ai_health_factors: result.factors,
        health,
        stall_detected_at: clearStall !== undefined ? clearStall : stall,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ deal: updated, score: result })
  } catch (err) {
    return errorResponse(err)
  }
}
