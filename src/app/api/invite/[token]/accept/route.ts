import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/invite/[token]/accept
 *
 * Called after the user has authenticated (sign-up or sign-in).
 * Adds them to the invited workspace and marks the invitation accepted.
 * Returns { redirectTo: '/workspace-slug/dashboard' }.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Get the authenticated session
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const service = createServiceClient()

  // Load the invitation
  const { data: invitation, error: invErr } = await service
    .from('invitations')
    .select('id, email, role, workspace_id, expires_at, workspaces(slug)')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (invErr) {
    console.error('[invite/accept] load error:', invErr.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  if (!invitation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (invitation.email !== user.email) {
    return NextResponse.json({ error: 'email_mismatch' }, { status: 403 })
  }

  if (invitation.expires_at) {
    const expires = new Date(invitation.expires_at)
    if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }
  }

  const ws = invitation.workspaces as { slug: string } | null
  const workspaceId = invitation.workspace_id

  // Ensure a users row exists for this person in their invited workspace
  const { data: existingUser } = await service
    .from('users')
    .select('id, workspace_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!existingUser) {
    // Brand-new user — create their profile in the invited workspace
    const fullName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'
    const { error: insertErr } = await service.from('users').insert({
      id: user.id,
      workspace_id: workspaceId,
      full_name: fullName,
      email: user.email ?? '',
      role: invitation.role,
    })
    if (insertErr) {
      console.error('[invite/accept] user insert error:', insertErr.message)
      return NextResponse.json({ error: 'user_insert_failed' }, { status: 500 })
    }
  }

  // Add to workspace_members (ignore conflict — idempotent)
  await service
    .from('workspace_members')
    .insert({ user_id: user.id, workspace_id: workspaceId, role: invitation.role })
    .select()

  // Mark invitation accepted
  await service
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return NextResponse.json({ redirectTo: `/${ws?.slug ?? workspaceId}/dashboard` })
}
