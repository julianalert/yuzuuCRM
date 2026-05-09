'use server'

import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export async function signUp(formData: FormData) {
  const fullName = formData.get('full_name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const workspaceName = formData.get('workspace_name') as string

  if (!fullName || !email || !password || !workspaceName) {
    return { error: 'All fields are required.' }
  }

  const supabase = await createClient()

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Failed to create account.' }
  }

  const serviceClient = createServiceClient()

  const baseSlug = slugify(workspaceName) || 'workspace'
  let slug = baseSlug
  let attempt = 0
  while (attempt < 10) {
    const { data: existing } = await serviceClient
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const { data: workspace, error: wsError } = await serviceClient
    .from('workspaces')
    .insert({
      name: workspaceName,
      slug,
      plan: 'free',
      subscription_status: 'trialing',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select()
    .single()

  if (wsError || !workspace) {
    return { error: 'Failed to create workspace.' }
  }

  const { error: userError } = await serviceClient.from('users').insert({
    id: authData.user.id,
    workspace_id: workspace.id,
    full_name: fullName,
    email,
    role: 'owner',
  })

  if (userError) {
    return { error: 'Failed to create user profile.' }
  }

  await serviceClient.from('workspace_members').insert({
    user_id: authData.user.id,
    workspace_id: workspace.id,
    role: 'owner',
  })

  return { ok: true as const, slug }
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('workspace_id, workspaces(slug)')
    .eq('id', (await supabase.auth.getUser()).data.user!.id)
    .single()

  if (!dbUser?.workspaces) {
    return { error: 'No workspace found for this account.' }
  }

  const ws = dbUser.workspaces as { slug: string }
  redirect(`/${ws.slug}/dashboard`)
}
