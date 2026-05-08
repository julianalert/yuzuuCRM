import { NextResponse } from 'next/server'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { data: chat, error: chatError } = await supabase
      .from('ai_chats')
      .select('id, title, created_at, updated_at')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    const { data: messages, error: msgError } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('chat_id', id)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    return NextResponse.json({ chat, messages: messages ?? [] })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { user, workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('ai_chats')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)

    if (error) throw error

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return errorResponse(err)
  }
}
