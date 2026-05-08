import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const { user, workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ai_chats')
      .select('id, title, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ chats: data ?? [] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST() {
  try {
    const { user, workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { data: chat, error } = await supabase
      .from('ai_chats')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        title: 'New chat',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ chat }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
