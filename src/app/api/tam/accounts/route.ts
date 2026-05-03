import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { workspace } = await requireAuth()
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
    const sort = searchParams.get('sort') ?? 'ai_score.desc'
    const status = searchParams.get('status')
    const minScore = searchParams.get('min_score')
    const industry = searchParams.get('industry')
    const search = searchParams.get('search')

    const supabase = await createClient()
    let query = supabase
      .from('accounts')
      .select('*, contacts(id, first_name, last_name, title)', { count: 'exact' })
      .eq('workspace_id', workspace.id)

    if (status) query = query.eq('status', status as 'new' | 'contacted' | 'in_progress' | 'qualified' | 'not_a_fit')
    if (minScore) query = query.gte('ai_score', parseInt(minScore))
    if (industry) query = query.ilike('industry', `%${industry}%`)
    if (search) query = query.ilike('name', `%${search}%`)

    const [sortField, sortDir] = sort.split('.')
    query = query.order(sortField, { ascending: sortDir !== 'desc', nullsFirst: false })

    const from = (page - 1) * limit
    query = query.range(from, from + limit - 1)

    const { data: accounts, count, error } = await query
    if (error) throw error

    return Response.json({ accounts: accounts ?? [], total: count ?? 0, page })
  } catch (err) {
    return errorResponse(err)
  }
}
