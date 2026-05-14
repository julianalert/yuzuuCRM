/**
 * /r/[token]
 *
 * Public, no-auth share page for a generated snapshot report. The agency
 * pastes this URL into their outreach so the prospect can preview the
 * pitch without signing up.
 *
 * - Reads `lead_reports` by `public_token` via the service-role client
 *   (table has RLS but no public policy; service role bypasses).
 * - SEO: noindex (we don't want these in search).
 * - Rate-limited per token+IP to deter scraping.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { SnapshotReport, type SnapshotReportBranding } from '@/components/reports/SnapshotReport'
import { rateLimit } from '@/lib/rate-limit'
import type { SnapshotPayload } from '@/lib/agent/snapshot-report'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicReportPage({ params }: PageProps) {
  const { token } = await params

  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound()

  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon').slice(0, 64)
  const rl = rateLimit(`r:${token}:${ip}`, 60, 60_000)
  if (!rl.ok) {
    return (
      <main style={mainWrap}>
        <div style={cardWrap}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Too many requests</h1>
          <p style={{ color: '#6B6860', marginTop: 8 }}>
            Please slow down a bit.
          </p>
        </div>
      </main>
    )
  }

  const supabase = createServiceClient()

  const { data: report, error } = await supabase
    .from('lead_reports')
    .select(`
      id, payload, generated_at, workspace_id, lead_id, public_token,
      leads:lead_id (
        id, name, category, address, website, rating, review_count
      ),
      workspaces:workspace_id (
        id, name, logo_url, plan
      )
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error || !report || !report.leads || !report.workspaces) notFound()

  const workspace = Array.isArray(report.workspaces) ? report.workspaces[0] : report.workspaces
  const lead      = Array.isArray(report.leads)      ? report.leads[0]      : report.leads
  if (!workspace || !lead) notFound()

  const branding: SnapshotReportBranding = {
    agencyName: workspace.name ?? 'Agency',
    agencyLogoUrl: workspace.logo_url ?? null,
    accent: '#1A1916',
    hideYuzuuBranding: workspace.plan === 'enterprise',
  }

  const payload = report.payload as unknown as SnapshotPayload

  return (
    <main style={mainWrap}>
      <div style={{ width: '100%', maxWidth: 800 }}>
        <SnapshotReport
          payload={payload}
          branding={branding}
          lead={lead}
          generatedAt={report.generated_at}
        />
      </div>
    </main>
  )
}

const mainWrap: React.CSSProperties = {
  minHeight: '100vh',
  background: '#F4F2EE',
  padding: '40px 16px',
  display: 'flex',
  justifyContent: 'center',
}

const cardWrap: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #E8E6E1',
  borderRadius: 14,
  padding: 32,
  maxWidth: 480,
  width: '100%',
}
