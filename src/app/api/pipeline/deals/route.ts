import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { scoreDeal } from '@/lib/ai/deal-scorer'
import { checkFeatureAccess } from '@/lib/stripe/paywall'
import type { Deal, Account, Activity } from '@/lib/types'

type DealStage = Deal['stage']

export async function GET(req: Request) {
  try {
    const { workspace } = await requireAuth()
    const url = new URL(req.url)
    const stage = url.searchParams.get('stage')
    const ownerId = url.searchParams.get('owner_id')

    const supabase = createServiceClient()

    let query = supabase
      .from('deals')
      .select('*, accounts(id, name, domain, industry, employee_count, location, ai_score), users!deals_owner_id_fkey(id, full_name, email)')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (stage) query = query.eq('stage', stage as DealStage)
    if (ownerId) query = query.eq('owner_id', ownerId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ deals: data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    const { user, workspace } = await requireAuth()

    const access = checkFeatureAccess(workspace, 'pipeline')
    if (!access.allowed) {
      return NextResponse.json({ error: 'upgrade_required', plan: access.upgradeRequired }, { status: 403 })
    }

    const body = await req.json() as {
      name: string
      account_id?: string
      contact_id?: string
      value?: number
      currency?: string
      close_date?: string
      stage?: Deal['stage']
      owner_id?: string
      notes?: string
    }

    if (!body.name) {
      return NextResponse.json({ error: 'Deal name is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        workspace_id: workspace.id,
        name: body.name,
        account_id: body.account_id ?? null,
        contact_id: body.contact_id ?? null,
        value: body.value ?? null,
        currency: body.currency ?? 'USD',
        close_date: body.close_date ?? null,
        stage: body.stage ?? 'discovery',
        owner_id: body.owner_id ?? user.id,
        notes: body.notes ?? null,
      })
      .select()
      .single()

    if (error) throw error

    // Trigger AI scoring async (don't block)
    if (body.account_id) {
      void (async () => {
        try {
          const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', body.account_id!)
            .single()

          const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('account_id', body.account_id!)
            .order('occurred_at', { ascending: false })
            .limit(20)

          if (account) {
            const result = await scoreDeal(deal as Deal, account as Account, (activities ?? []) as Activity[])
            const health = result.score >= 60 ? 'green' : result.score >= 40 ? 'amber' : 'red'
            const stall = result.score < 50 ? new Date().toISOString() : null

            await supabase
              .from('deals')
              .update({
                ai_health_score: result.score,
                ai_health_reason: result.reason,
                ai_health_factors: result.factors,
                health,
                stall_detected_at: stall,
              })
              .eq('id', deal.id)
          }
        } catch (e) {
          console.error('[Pipeline] Failed to score new deal:', e)
        }
      })()
    }

    return NextResponse.json({ deal }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
