import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { scoreAccount } from '@/lib/ai/scorer'
import type { ICP, AccountStatus } from '@/lib/types'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params

    const supabase = await createClient()

    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .single()

    if (error || !account) {
      return Response.json({ error: 'Account not found' }, { status: 404 })
    }

    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('account_id', id)
      .limit(5)

    const { data: signals } = await supabase
      .from('signals')
      .select('*')
      .eq('account_id', id)
      .order('detected_at', { ascending: false })
      .limit(10)

    return Response.json({
      account,
      contacts: contacts ?? [],
      signals: signals ?? [],
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params
    const body = (await request.json()) as {
      status?: AccountStatus
      notes?: string
      owner_id?: string
    }

    const supabase = await createClient()

    const updates: {
      status?: AccountStatus
      description?: string
    } = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.notes !== undefined) updates.description = body.notes

    const { data: account, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .select()
      .single()

    if (error || !account) {
      return Response.json({ error: 'Account not found' }, { status: 404 })
    }

    return Response.json({ account })
  } catch (err) {
    return errorResponse(err)
  }
}

// Re-score a single account
export async function POST(request: Request, { params }: Params) {
  try {
    const { workspace } = await requireAuth()
    const { id } = await params
    const body = (await request.json()) as { action: 'rescore' }

    if (body.action !== 'rescore') {
      return Response.json({ error: 'Unknown action' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .single()

    if (!account) return Response.json({ error: 'Account not found' }, { status: 404 })

    const { data: icp } = await supabase
      .from('icps')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!icp) return Response.json({ error: 'No active ICP found' }, { status: 404 })

    const anthropicKey = workspace.anthropic_api_key ?? undefined
    const result = await scoreAccount(account, icp as ICP, anthropicKey)

    const serviceClient = createServiceClient()
    await serviceClient
      .from('accounts')
      .update({ ai_score: result.score, ai_score_reason: result.reason })
      .eq('id', id)

    return Response.json({ score: result.score, reason: result.reason })
  } catch (err) {
    return errorResponse(err)
  }
}
