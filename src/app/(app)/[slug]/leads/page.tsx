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

  // Load all leads with their parent search context. We don't filter
  // by relevance / archived here — the tab UI does that client-side
  // so we never need to re-hit the DB to switch tabs.
  const { data: initialLeads } = await supabase
    .from('leads')
    .select(`
      *,
      lead_searches ( category, city, country )
    `)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const leadIds = (initialLeads ?? []).map((l) => l.id)
  const { data: signals } = leadIds.length > 0
    ? await supabase
        .from('lead_signals')
        .select('lead_id, type, severity')
        .in('lead_id', leadIds)
        .order('severity', { ascending: false })
    : { data: [] }

  const signalsByLead: Record<string, Array<{ type: string; severity: number }>> = {}
  for (const s of signals ?? []) {
    if (!signalsByLead[s.lead_id]) signalsByLead[s.lead_id] = []
    signalsByLead[s.lead_id].push({ type: s.type, severity: s.severity })
  }

  return (
    <LeadFinderView
      workspace={workspace}
      initialLeads={initialLeads ?? []}
      initialSignalsByLead={signalsByLead}
      slug={slug}
    />
  )
}
