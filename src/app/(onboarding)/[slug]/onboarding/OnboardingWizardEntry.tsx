'use client'

import { OnboardingWizard } from './OnboardingWizard'

export function OnboardingWizardEntry({ slug }: { slug: string }) {
  return <OnboardingWizard slug={slug} />
}
