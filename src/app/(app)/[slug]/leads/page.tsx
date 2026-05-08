import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Workspace } from '@/lib/types'
import { LeadFinderView } from './LeadFinderView'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LeadsPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUser } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', authUser.id)
    .single()

  if (!dbUser) redirect('/login')

  const { data: workspaceRaw } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', dbUser.workspace_id)
    .single()

  const workspace = workspaceRaw as Workspace | null
  if (!workspace) redirect('/login')

  // Load all leads with their parent search context
  const { data: initialLeads } = await supabase
    .from('leads')
    .select(`
      *,
      lead_searches ( category, city, country )
    `)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <LeadFinderView
      workspace={workspace}
      initialLeads={initialLeads ?? []}
      slug={slug}
    />
  )
}
