import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { ApolloClient } from '@/lib/apollo/client'
import { scoreAccountsBatch } from '@/lib/ai/scorer'
import { getPlanLimits } from '@/lib/plans'
import type { ICP, Account, Contact } from '@/lib/types'

// Allow up to 5 minutes on Vercel Pro; set to 60 on free plan
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAuth()
    const body = (await request.json()) as {
      description: string
      params: {
        industries: string[]
        employee_ranges: string[]
        locations: string[]
        technologies: string[]
        funding_stages: string[]
        keywords: string[]
      }
    }

    if (!body.description || !body.params) {
      return Response.json({ error: 'description and params are required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Mark any previous ICPs as inactive
    await serviceClient
      .from('icps')
      .update({ is_active: false })
      .eq('workspace_id', workspace.id)

    // Create the ICP record now (not during extraction)
    const { data: icp, error: icpError } = await serviceClient
      .from('icps')
      .insert({
        workspace_id: workspace.id,
        name: 'Main ICP',
        raw_description: body.description.trim(),
        extracted_params: body.params as unknown as import('@/lib/types/database').Json,
        industries: body.params.industries,
        locations: body.params.locations,
        keywords: body.params.keywords,
        technologies: body.params.technologies,
        funding_stages: body.params.funding_stages,
        employee_ranges: body.params.employee_ranges,
      })
      .select()
      .single()

    if (icpError || !icp) throw icpError ?? new Error('Failed to create ICP')

    // Create job record
    const { data: job, error: jobError } = await serviceClient
      .from('tam_build_jobs')
      .insert({ workspace_id: workspace.id, icp_id: icp.id, status: 'running' })
      .select()
      .single()

    if (jobError || !job) throw jobError ?? new Error('Failed to create job')

    const jobId = job.id
    const apolloKey = workspace.apollo_api_key ?? process.env.APOLLO_API_KEY ?? ''
    const anthropicKey = workspace.anthropic_api_key ?? process.env.ANTHROPIC_API_KEY ?? ''
    const limits = getPlanLimits(workspace.plan)

    // Run the job in background (non-blocking)
    void runTAMBuild(jobId, icp as ICP, apolloKey, anthropicKey, workspace.id, limits)

    return Response.json({ job_id: jobId })
  } catch (err) {
    return errorResponse(err)
  }
}

import type { Database } from '@/lib/types/database'

type JobUpdate = Database['public']['Tables']['tam_build_jobs']['Update']

async function updateJob(
  jobId: string,
  updates: JobUpdate,
): Promise<void> {
  const serviceClient = createServiceClient()
  await serviceClient.from('tam_build_jobs').update(updates).eq('id', jobId)
}

import type { PlanLimits } from '@/lib/plans'

async function runTAMBuild(
  jobId: string,
  icp: ICP,
  apolloKey: string,
  anthropicKey: string,
  workspaceId: string,
  limits: PlanLimits,
): Promise<void> {
  const serviceClient = createServiceClient()

  try {
    if (!apolloKey) {
      await updateJob(jobId, { status: 'error', error_message: 'Apollo API key not configured. Add it in Settings → Integrations.' })
      return
    }

    const apollo = new ApolloClient(apolloKey)

    // ── Step 1: Find companies ────────────────────────────────────────────────
    const companies = await apollo.searchCompanies(icp, limits, async (count) => {
      await updateJob(jobId, { step_finding_count: count })
    })

    if (companies.length === 0) {
      await updateJob(jobId, {
        status: 'error',
        error_message: 'No companies found for this ICP. Try broadening your criteria.',
        step_finding_done: true,
      })
      return
    }

    await updateJob(jobId, {
      step_finding_done: true,
      step_finding_count: companies.length,
      total_accounts: companies.length,
    })

    // ── Step 2: Save accounts + enrich contacts ───────────────────────────────
    // domain → { dbId, companyData } — used for accurate scoring after insert
    const domainToAccount = new Map<string, { id: string; raw: Partial<Account> }>()
    const BATCH_SIZE = 20

    for (let i = 0; i < companies.length; i += BATCH_SIZE) {
      const batch = companies.slice(i, i + BATCH_SIZE)
      const validBatch = batch.filter(
        (c): c is Partial<Account> & { name: string } => typeof c.name === 'string',
      )

      const { data: inserted } = await serviceClient
        .from('accounts')
        .insert(
          validBatch.map((c) => ({
            ...c,
            workspace_id: workspaceId,
            icp_id: icp.id,
          })),
        )
        .select('id, domain')

      if (inserted) {
        inserted.forEach((acct, idx) => {
          const raw = validBatch[idx]
          if (acct.domain) {
            domainToAccount.set(acct.domain, { id: acct.id, raw })
          } else {
            // No domain — store by index key so it still gets scored
            domainToAccount.set(`__no_domain_${acct.id}`, { id: acct.id, raw })
          }
        })

        // Enrich each account with contacts
        await Promise.all(
          inserted.map(async (acct) => {
            if (!acct.domain) return
            try {
              const contacts = await apollo.getContacts(acct.domain, limits.contactsPerCompany)
              if (contacts.length === 0) return
              await serviceClient.from('contacts').insert(
                contacts
                  .filter((c): c is Partial<Contact> & { first_name: string } => typeof c.first_name === 'string')
                  .map((c) => ({
                    ...c,
                    workspace_id: workspaceId,
                    account_id: acct.id,
                  })),
              )
            } catch {
              // Non-fatal: continue even if enrichment fails for one account
            }
          }),
        )
      }

      await updateJob(jobId, { step_enriching_count: Math.min(i + BATCH_SIZE, companies.length) })
    }

    await updateJob(jobId, {
      step_enriching_done: true,
      step_enriching_count: companies.length,
    })

    // ── Step 3: Score with Claude ─────────────────────────────────────────────
    const accountsToScore = Array.from(domainToAccount.values()).map(({ id, raw }) => ({
      ...raw,
      id,
    } as Partial<Account> & { id: string }))

    let scoredCount = 0

    await scoreAccountsBatch(
      accountsToScore,
      icp,
      async (accountId, score, reason) => {
        await serviceClient
          .from('accounts')
          .update({ ai_score: score, ai_score_reason: reason })
          .eq('id', accountId)
      },
      async (count) => {
        scoredCount = count
        if (count % 10 === 0) {
          await updateJob(jobId, { step_scoring_count: count })
        }
      },
      anthropicKey,
    )

    await updateJob(jobId, {
      status: 'complete',
      step_scoring_done: true,
      step_scoring_count: scoredCount,
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[TAM Build Error]', err)
    await updateJob(jobId, { status: 'error', error_message: message })
  }
}
