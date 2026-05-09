/**
 * Typed Mixpanel events (browser SDK loaded from root layout).
 */

type MixpanelSdk = { track: (event: string, props?: Record<string, unknown>) => void }

function getMixpanel(): MixpanelSdk | null {
  if (typeof window === 'undefined') return null
  const mp = (window as unknown as { mixpanel?: MixpanelSdk }).mixpanel
  return mp && typeof mp.track === 'function' ? mp : null
}

function track(event: string, props?: Record<string, unknown>) {
  getMixpanel()?.track(event, props)
}

/** New account created (email form, OAuth provisioning, or invite acceptance). Event name: SignedUP */
export function trackSignedUp(props: {
  method: 'email' | 'oauth' | 'invite'
  workspace_slug?: string
}) {
  track('SignedUP', props)
}

export function trackOnboardingCompleted(props: {
  workspace_slug: string
  services_count: number
  niches_count: number
  has_website_url: boolean
}) {
  track('OnboardingCompleted', props)
}

export function trackLeadSearchCompleted(props: {
  workspace_slug: string
  category: string
  city: string
  country: string
  leads_found: number
  max_results: number
  trial_limited: boolean
}) {
  track('LeadSearchCompleted', props)
}

export function trackLeadViewed(props: {
  workspace_slug: string
  lead_id: string
  lead_name: string
}) {
  track('LeadViewed', props)
}
