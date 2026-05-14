// Supabase Edge Function — trial-check
// Schedule: hourly via Supabase cron (the trial is 3 days; daily cadence
// would risk missing the 24h window).
// Finds workspaces with trial ending in ≤24h and sends a warning email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://app.yuzuu.co'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const dayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  // Workspaces trialing, ending within 24h, warning not yet sent
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, slug, trial_ends_at')
    .eq('subscription_status', 'trialing')
    .gte('trial_ends_at', now)
    .lte('trial_ends_at', dayFromNow)
    .is('trial_warning_sent_at', null)

  if (error) {
    console.error('Failed to fetch workspaces:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let sent = 0

  for (const workspace of workspaces ?? []) {
    // Get owner
    const { data: owner } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('workspace_id', workspace.id)
      .eq('role', 'owner')
      .single()

    if (!owner) continue

    // Count accounts
    const { count: accountCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)

    const daysLeft = Math.max(0, Math.ceil(
      (new Date(workspace.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ))

    // Send trial ending email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Yuzuu <noreply@yuzuu.co>',
        to: owner.email,
        subject: 'Your Yuzuu trial ends in 24 hours',
        html: `<p>Hi ${owner.full_name},</p>
<p>Your Yuzuu trial ends in <strong>${daysLeft === 0 ? 'less than a day' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}</strong>.</p>
<p>You've built a TAM of <strong>${accountCount ?? 0} accounts</strong>, all scored by AI.</p>
<p>Don't lose your data — <a href="${APP_URL}/${workspace.slug}/settings/billing">upgrade now</a> to keep access.</p>`,
      }),
    })

    // Mark warning sent
    await supabase
      .from('workspaces')
      .update({ trial_warning_sent_at: new Date().toISOString() })
      .eq('id', workspace.id)

    sent++
  }

  return new Response(JSON.stringify({ sent }), { status: 200 })
})
