import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from './KanbanBoard'
import { UpgradeGate } from '@/components/shared/UpgradeGate'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PipelinePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUser } = await supabase.from('users').select('workspace_id').eq('id', authUser.id).single()
  if (!dbUser) redirect('/login')

  const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', dbUser.workspace_id).single()
  if (!workspace) redirect('/login')

  // Check pipeline feature access
  const hasPipeline = workspace.plan !== 'free'

  // Fetch initial deals
  const { data: deals } = await supabase
    .from('deals')
    .select('*, accounts(id, name, domain), users!deals_owner_id_fkey(id, full_name, email)')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!hasPipeline) {
    return (
      <UpgradeGate feature="pipeline" requiredPlan="starter">
        <div />
      </UpgradeGate>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <KanbanBoard slug={slug} initialDeals={(deals ?? []) as any} />
}
