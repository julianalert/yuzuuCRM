import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './OnboardingWizard'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function OnboardingPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: dbUser } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', user.id)
    .single()

  if (!dbUser) redirect('/login')

  // If workspace already has a completed TAM build, skip onboarding
  const { data: completedBuild } = await supabase
    .from('tam_build_jobs')
    .select('id')
    .eq('workspace_id', dbUser.workspace_id)
    .eq('status', 'complete')
    .limit(1)
    .maybeSingle()

  if (completedBuild) {
    redirect(`/${slug}/tam`)
  }

  return <OnboardingWizard slug={slug} />
}
