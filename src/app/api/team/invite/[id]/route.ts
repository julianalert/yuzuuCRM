import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, UnauthorizedError } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspace } = await requireAuth()
    const { id } = await params

    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new UnauthorizedError('Only admins and owners can cancel invitations')
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('status', 'pending')

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
