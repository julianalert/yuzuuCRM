/**
 * digest.ts
 *
 * Sends the daily-opportunities email per workspace, throttled to once
 * per 24h, only when there's >= 1 new hot lead in the last 24h, and only
 * around the user's local 8 AM (workspaces.timezone).
 *
 * Recipient: owner only (P2 follow-up: opt-in for admins/members).
 */

import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import {
  dailyOpportunitiesHtml,
  dailyOpportunitiesSubject,
  type DigestLead,
} from '@/lib/email/templates/daily-opportunities'

const FROM = 'Yuzuu <opportunities@yuzuu.co>'
const MAX_LEADS = 10
const SEND_HOUR_LOCAL = 8  // 8 AM in workspace timezone

const SIGNAL_LABELS: Record<string, string> = {
  owner_unresponsive:          'Owner not replying',
  negative_review_streak:      'Negative reviews streak',
  review_velocity_drop:        'Reviews stopped',
  review_velocity_spike:       'Surge of reviews',
  recently_opened:             'New business',
  no_tracking_pixel:           'No ads tracking',
  outdated_stack:              'Outdated website',
  no_booking_on_needs_booking: 'No booking system',
  phone_only:                  'Phone-only',
  no_social:                   'No social presence',
  no_website:                  'No website',
  low_rating:                  'Low rating',
}

/**
 * Returns the current "hour-of-day" for a given IANA timezone.
 * Uses Intl APIs (built in, no deps).
 */
function hourInTimezone(tz: string, now: Date = new Date()): number {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', hour12: false, timeZone: tz,
    })
    const parts = f.formatToParts(now)
    const h = parts.find((p) => p.type === 'hour')?.value
    return h ? parseInt(h, 10) : 0
  } catch {
    return now.getUTCHours()
  }
}

export async function sendDailyDigests(): Promise<{ sent: number; checked: number }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[digest] RESEND_API_KEY missing — skipping')
    return { sent: 0, checked: 0 }
  }
  const resend = new Resend(apiKey)
  const supabase = createServiceClient()

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // Eligible workspaces: have onboarded, not canceled, last_digest_sent_at
  // is null OR older than 24h.
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, slug, timezone, last_digest_sent_at, subscription_status')
    .not('offer_description', 'is', null)
    .or('last_digest_sent_at.is.null,last_digest_sent_at.lt.' + dayAgo)
    .neq('subscription_status', 'canceled')

  if (!workspaces || workspaces.length === 0) return { sent: 0, checked: 0 }

  let sent = 0
  let checked = 0

  for (const ws of workspaces) {
    checked++
    // Only send at workspace-local 8 AM. The cron fires every 30 min so
    // every workspace gets one 30-min window per day to qualify.
    const tz = ws.timezone ?? 'UTC'
    const localHour = hourInTimezone(tz)
    if (localHour !== SEND_HOUR_LOCAL) continue

    // Find new hot leads in the last 24h for this workspace.
    const { data: hotLeads } = await supabase
      .from('leads')
      .select('id, name, category, intent_score, address, lead_searches(city, country)')
      .eq('workspace_id', ws.id)
      .eq('relevance', 'hot')
      .is('archived_at', null)
      .gte('discovered_at', dayAgo)
      .order('intent_score', { ascending: false })
      .limit(MAX_LEADS + 5)

    if (!hotLeads || hotLeads.length === 0) continue

    // Hydrate the signals per lead so the email shows what's actionable.
    const leadIds = hotLeads.map((l) => l.id)
    const { data: signals } = await supabase
      .from('lead_signals')
      .select('lead_id, type, severity')
      .in('lead_id', leadIds)
      .order('severity', { ascending: false })

    const signalsByLead = new Map<string, Array<{ type: string; severity: number }>>()
    for (const s of signals ?? []) {
      const arr = signalsByLead.get(s.lead_id) ?? []
      arr.push({ type: s.type, severity: s.severity })
      signalsByLead.set(s.lead_id, arr)
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.yuzuu.co'}/${ws.slug}/leads?tab=hot`

    const digestLeads: DigestLead[] = hotLeads.slice(0, MAX_LEADS).map((l) => {
      const search = l.lead_searches as { city: string | null; country: string | null } | null
      return {
        name:        l.name ?? 'Unnamed business',
        category:    l.category,
        city:        search?.city ?? null,
        intentScore: l.intent_score ?? 0,
        signals:     (signalsByLead.get(l.id) ?? [])
                       .slice(0, 3)
                       .map((s) => ({ label: SIGNAL_LABELS[s.type] ?? s.type })),
        url:         dashboardUrl,
      }
    })

    // Owner email
    const { data: owner } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('workspace_id', ws.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()

    if (!owner?.email) continue

    try {
      await resend.emails.send({
        from: FROM,
        to: owner.email,
        subject: dailyOpportunitiesSubject({ agencyName: ws.name, count: digestLeads.length }),
        html: dailyOpportunitiesHtml({
          agencyName: ws.name,
          ownerName: owner.full_name ?? 'there',
          leads: digestLeads,
          dashboardUrl,
          totalHotInLast24h: hotLeads.length,
        }),
      })

      await supabase
        .from('workspaces')
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq('id', ws.id)

      sent++
      console.log(`[digest] sent ${digestLeads.length} leads to ${owner.email} (${ws.name})`)
    } catch (err) {
      console.error(`[digest] send failed for workspace ${ws.id}:`, err)
    }
  }

  return { sent, checked }
}
