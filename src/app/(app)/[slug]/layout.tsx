import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { UserProvider } from '@/contexts/UserContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { TrialBanner } from '@/components/layout/TrialBanner'
import type { Workspace, User } from '@/lib/types'

interface Props {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function AppLayout({ children, params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUserRaw } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const dbUser = dbUserRaw as User | null
  if (!dbUser) redirect('/login')

  const { data: workspaceRaw } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', slug)
    .single()

  const workspace = workspaceRaw as Workspace | null
  if (!workspace) redirect('/login')

  // Verify the logged-in user is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('user_id', authUser.id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!membership) redirect('/login')

  // Lock app behind onboarding until the workspace has an offer_description set.
  // Onboarding itself is excluded via its own nested layout which doesn't
  // run this check, so we don't need a path-based exception here.
  if (!workspace.offer_description) {
    redirect(`/${slug}/onboarding`)
  }

  return (
    <WorkspaceProvider workspace={workspace}>
      <UserProvider user={dbUser}>
        <div className="app">
          <Sidebar />
          <div className="main">
            <TrialBanner />
            <Topbar />
            <main className="content">{children}</main>
          </div>
        </div>
      </UserProvider>
    </WorkspaceProvider>
  )
}
