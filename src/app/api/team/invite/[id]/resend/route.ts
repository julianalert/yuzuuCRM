import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, UnauthorizedError } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email/send'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspace } = await requireAuth()
    const { id } = await params

    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new UnauthorizedError('Only admins and owners can resend invitations')
    }

    const supabase = createServiceClient()

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error } = await supabase
      .from('invitations')
      .update({ expires_at: newExpiresAt })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('status', 'pending')
      .select()
      .single()

    if (error) throw error
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`

    void sendInviteEmail({
      inviterName: user.full_name,
      workspaceName: workspace.name,
      role: invitation.role,
      inviteUrl,
      toEmail: invitation.email,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
