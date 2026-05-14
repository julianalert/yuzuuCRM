/**
 * GET /api/leads/[id]/report/pdf
 *
 * Streams the snapshot report for a lead as application/pdf. Auth is
 * required; the report must belong to the caller's workspace.
 */

import { NextRequest } from 'next/server'
import { renderToBuffer } from '@/components/reports/pdf-primitives'
import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { SnapshotReportPdf } from '@/components/reports/SnapshotReportPdf'
import type { SnapshotPayload } from '@/lib/agent/snapshot-report'
import type { SnapshotReportBranding } from '@/components/reports/SnapshotReport'

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { workspace } = await requireAuth()
    const { id: leadId } = await params

    const supabase = createServiceClient()
    const { data: report } = await supabase
      .from('lead_reports')
      .select(`
        id, payload, generated_at, workspace_id,
        leads:lead_id (
          id, name, category, address, rating, review_count
        )
      `)
      .eq('lead_id', leadId)
      .eq('workspace_id', workspace.id)
      .eq('is_stale', false)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!report) {
      return Response.json({ error: 'No active report for this lead' }, { status: 404 })
    }

    const lead = Array.isArray(report.leads) ? report.leads[0] : report.leads
    if (!lead) return Response.json({ error: 'Lead not found' }, { status: 404 })

    const branding: SnapshotReportBranding = {
      agencyName: workspace.name ?? 'Agency',
      agencyLogoUrl: workspace.logo_url ?? null,
      accent: '#1A1916',
      hideYuzuuBranding: workspace.plan === 'enterprise',
    }

    const buffer = await renderToBuffer(
      SnapshotReportPdf({
        payload: report.payload as unknown as SnapshotPayload,
        branding,
        lead,
        generatedAt: report.generated_at,
      })
    )

    const fileSafeName = (lead.name ?? 'snapshot').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="snapshot-${fileSafeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
