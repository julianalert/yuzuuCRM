import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, UnauthorizedError } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { canAddSeat } from '@/lib/stripe/plans'
import { sendInviteEmail } from '@/lib/email/send'

export async function GET(_req: Request) {
  try {
    const { workspace } = await requireAuth()
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('invitations')
      .select('*, users!invitations_invited_by_fkey(full_name)')
      .eq('workspace_id', workspace.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ invitations: data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req: Request) {
  try {
    const { user, workspace } = await requireAuth()

    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new UnauthorizedError('Only admins and owners can invite members')
    }

    const { email, role = 'member' } = await req.json() as { email: string; role?: 'admin' | 'member' }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check seat limit
    const { count: seatCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)

    if (!canAddSeat(workspace, seatCount ?? 0)) {
      return NextResponse.json({ error: 'upgrade_required', reason: 'Seat limit reached' }, { status: 403 })
    }

    // Check not already a member
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'This email is already a member of this workspace' }, { status: 400 })
    }

    // Check not already invited
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('email', email)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 400 })
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        workspace_id: workspace.id,
        email,
        role,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw error

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`

    // Fire-and-forget email
    void sendInviteEmail({
      inviterName: user.full_name,
      workspaceName: workspace.name,
      role,
      inviteUrl,
      toEmail: email,
    })

    return NextResponse.json({ invitation }, { status: 201 })
  } catch (err) {
    return errorResponse(err)
  }
}
