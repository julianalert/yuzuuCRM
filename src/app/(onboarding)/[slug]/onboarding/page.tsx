import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizardEntry } from './OnboardingWizardEntry'

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

  // If workspace already has an offer_description, onboarding is done
  const { data: ws } = await supabase
    .from('workspaces')
    .select('offer_description')
    .eq('id', dbUser.workspace_id)
    .single()

  if (ws?.offer_description) {
    redirect(`/${slug}/leads`)
  }

  return <OnboardingWizardEntry slug={slug} />
}
