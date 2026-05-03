import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createClient } from '@/lib/supabase/server'
import { getPlanLimits } from '@/lib/plans'

export async function GET(request: Request) {
  try {
    const { workspace } = await requireAuth()

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return Response.json({ error: 'job_id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: job } = await supabase
      .from('tam_build_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (!job) {
      return Response.json({ error: 'Job not found' }, { status: 404 })
    }

    return Response.json({
      status: job.status,
      steps: {
        finding:  { done: job.step_finding_done,   count: job.step_finding_count },
        enriching: { done: job.step_enriching_done, count: job.step_enriching_count },
        scoring:  { done: job.step_scoring_done,   count: job.step_scoring_count },
      },
      total_accounts: job.total_accounts,
      plan_limit: getPlanLimits(workspace.plan).maxCompanies,
      error: job.error_message ?? undefined,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
