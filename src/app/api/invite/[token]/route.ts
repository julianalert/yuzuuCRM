import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Public invite lookup by secret token. Uses service role so workspace name
 * can be returned (workspaces RLS blocks anon users).
 * Also returns isExistingUser so the UI can show sign-in vs sign-up form.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('invitations')
    .select('email, status, expires_at, workspaces(name)')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) {
    console.error('[api/invite] load error:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (data.expires_at) {
    const expires = new Date(data.expires_at)
    if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
      return NextResponse.json({ error: 'expired' }, { status: 404 })
    }
  }

  // Check if this email already has a Yuzuu account
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', data.email)
    .maybeSingle()
  const isExistingUser = !!existingUser

  const ws = data.workspaces as { name: string } | null
  return NextResponse.json({
    email: data.email,
    workspace: { name: ws?.name ?? 'Workspace' },
    isExistingUser,
  })
}
