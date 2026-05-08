import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email/send'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    console.error('[auth/callback] No code in request')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  try {
    const supabase = await createClient()

    // 1. Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('[auth/callback] Exchange error:', exchangeError.message)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    // 2. Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('[auth/callback] getUser error:', userError?.message)
      return NextResponse.redirect(`${origin}/login?error=user_not_found`)
    }

    // 3. Look up their workspace (two separate queries to avoid join issues)
    const serviceClient = createServiceClient()

    const { data: dbUser, error: dbUserError } = await serviceClient
      .from('users')
      .select('workspace_id')
      .eq('id', user.id)
      .maybeSingle()

    if (dbUserError) {
      console.error('[auth/callback] users table error:', dbUserError.message, dbUserError.code)
      // Table may not exist yet — show a clear error
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Database not set up. Run schema.sql in Supabase SQL editor.')}`
      )
    }

    if (dbUser?.workspace_id) {
      // Existing user — find their workspace slug
      const { data: workspace, error: wsError } = await serviceClient
        .from('workspaces')
        .select('slug')
        .eq('id', dbUser.workspace_id)
        .single()

      if (wsError || !workspace) {
        console.error('[auth/callback] workspace lookup error:', wsError?.message)
        return NextResponse.redirect(`${origin}/login?error=workspace_not_found`)
      }

      return NextResponse.redirect(`${origin}/${workspace.slug}/dashboard`)
    }

    // Check if there's a pending invitation for this email (invite-based signup)
    const { data: invitation } = await serviceClient
      .from('invitations')
      .select('*, workspaces(id, slug)')
      .eq('email', user.email ?? '')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invitation?.workspaces) {
      const ws = invitation.workspaces as { id: string; slug: string }
      const fullName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'

      await serviceClient.from('users').insert({
        id: user.id,
        workspace_id: ws.id,
        full_name: fullName,
        email: user.email ?? '',
        role: invitation.role,
      })

      await serviceClient.from('workspace_members').insert({
        user_id: user.id,
        workspace_id: ws.id,
        role: invitation.role,
      })

      await serviceClient.from('invitations').update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      }).eq('id', invitation.id)

      return NextResponse.redirect(`${origin}/${ws.slug}/dashboard`)
    }

    // New user with no invite — provision with a temp slug
    const fullName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'
    const tempSlug = `workspace-${Date.now().toString(36)}`

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const { data: workspace, error: wsInsertError } = await serviceClient
      .from('workspaces')
      .insert({
        name: `${fullName}'s workspace`,
        slug: tempSlug,
        plan: 'free',
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single()

    if (wsInsertError || !workspace) {
      console.error('[auth/callback] workspace insert error:', wsInsertError?.message, wsInsertError?.code)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(wsInsertError?.message ?? 'Failed to create workspace')}`
      )
    }

    const { error: userInsertError } = await serviceClient.from('users').insert({
      id: user.id,
      workspace_id: workspace.id,
      full_name: fullName,
      email: user.email ?? '',
      role: 'owner',
    })

    if (userInsertError) {
      console.error('[auth/callback] user insert error:', userInsertError.message, userInsertError.code)
      // Clean up the workspace we just created
      await serviceClient.from('workspaces').delete().eq('id', workspace.id)
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(userInsertError.message)}`
      )
    }

    await serviceClient.from('workspace_members').insert({
      user_id: user.id,
      workspace_id: workspace.id,
      role: 'owner',
    })

    // Fire-and-forget welcome email
    void sendWelcomeEmail({
      fullName,
      workspaceName: workspace.name,
      dashboardUrl: `${origin}/${tempSlug}/dashboard`,
      toEmail: user.email ?? '',
    })

    return NextResponse.redirect(`${origin}/${tempSlug}/onboarding`)
  } catch (err) {
    console.error('[auth/callback] Unexpected error:', err)
    return NextResponse.redirect(`${origin}/login?error=unexpected`)
  }
}
