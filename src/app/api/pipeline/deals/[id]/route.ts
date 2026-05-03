import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { Deal } from '@/lib/types'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('deals')
      .select('*, accounts(*), contacts(*), users!deals_owner_id_fkey(id, full_name, email, avatar_url)')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .single()

    if (error) throw error
    return NextResponse.json({ deal: data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const body = await req.json() as Partial<{
      name: string
      stage: Deal['stage']
      value: number
      currency: string
      close_date: string
      owner_id: string
      notes: string
    }>

    const supabase = createServiceClient()

    const { data: deal, error } = await supabase
      .from('deals')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .select()
      .single()

    if (error) throw error

    // Re-score if stage changed
    if (body.stage && deal.account_id) {
      void (async () => {
        try {
          const { scoreDeal } = await import('@/lib/ai/deal-scorer')
          const { data: account } = await supabase.from('accounts').select('*').eq('id', deal.account_id!).single()
          const { data: activities } = await supabase.from('activities').select('*').eq('account_id', deal.account_id!).order('occurred_at', { ascending: false }).limit(20)

          if (account) {
            const result = await scoreDeal(deal, account, activities ?? [])
            const health = result.score >= 60 ? 'green' : result.score >= 40 ? 'amber' : 'red'
            const stall = result.score < 50 ? new Date().toISOString() : null

            await supabase.from('deals').update({
              ai_health_score: result.score,
              ai_health_reason: result.reason,
              ai_health_factors: result.factors,
              health,
              stall_detected_at: stall,
            }).eq('id', id)
          }
        } catch (e) {
          console.error('[Pipeline] Failed to re-score deal after stage change:', e)
        }
      })()
    }

    return NextResponse.json({ deal })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('deals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
