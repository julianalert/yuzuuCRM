import { create } from 'zustand'

type OnboardingStep = 1 | 2 | 3

const STORAGE_KEY = 'yuzuu-onboarding'

interface OnboardingState {
  step: OnboardingStep
  companyName: string
  websiteUrl: string
  offerDescription: string
  brandSummary: string
  services: string[]
  niches: string[]
  location: string
  category: string
  city: string
  country: string
  setStep: (step: OnboardingStep) => void
  setCompanyName: (v: string) => void
  setWebsiteUrl: (v: string) => void
  setOfferDescription: (v: string) => void
  setBrandSummary: (v: string) => void
  setServices: (v: string[]) => void
  toggleService: (id: string) => void
  setNiches: (v: string[]) => void
  toggleNiche: (niche: string) => void
  setLocation: (v: string) => void
  setCategory: (v: string) => void
  setCity: (v: string) => void
  setCountry: (v: string) => void
  reset: () => void
}

const defaults = {
  step: 1 as OnboardingStep,
  companyName: '',
  websiteUrl: '',
  offerDescription: '',
  brandSummary: '',
  services: [] as string[],
  niches: [] as string[],
  location: '',
  category: '',
  city: '',
  country: '',
}

/** Same shape Zustand `persist` used — read synchronously so first paint matches session. */
function readPersistedSync(): Partial<typeof defaults> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { state?: unknown }
    const s = parsed?.state
    if (!s || typeof s !== 'object') return {}
    const o = s as Record<string, unknown>
    const out: Partial<typeof defaults> = {}
    if (typeof o.companyName === 'string') out.companyName = o.companyName
    if (typeof o.websiteUrl === 'string') out.websiteUrl = o.websiteUrl
    if (typeof o.offerDescription === 'string') out.offerDescription = o.offerDescription
    if (typeof o.brandSummary === 'string') out.brandSummary = o.brandSummary
    if (typeof o.location === 'string') out.location = o.location
    if (typeof o.category === 'string') out.category = o.category
    if (typeof o.city === 'string') out.city = o.city
    if (typeof o.country === 'string') out.country = o.country
    if (o.step === 1 || o.step === 2 || o.step === 3) out.step = o.step
    if (Array.isArray(o.services)) {
      out.services = o.services.filter((x): x is string => typeof x === 'string')
    }
    if (Array.isArray(o.niches)) {
      out.niches = o.niches.filter((x): x is string => typeof x === 'string')
    }
    return out
  } catch {
    return {}
  }
}

function writePersisted(state: OnboardingState) {
  if (typeof window === 'undefined') return
  const slice = {
    step: state.step,
    companyName: state.companyName,
    websiteUrl: state.websiteUrl,
    offerDescription: state.offerDescription,
    brandSummary: state.brandSummary,
    services: state.services,
    niches: state.niches,
    location: state.location,
    category: state.category,
    city: state.city,
    country: state.country,
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ state: slice, version: 0 }))
  } catch {
    /* quota / private mode */
  }
}

const initial = { ...defaults, ...readPersistedSync() }

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initial,
  setStep: (step) => set({ step }),
  setCompanyName: (companyName) => set({ companyName }),
  setWebsiteUrl: (websiteUrl) => set({ websiteUrl }),
  setOfferDescription: (offerDescription) => set({ offerDescription }),
  setBrandSummary: (brandSummary) => set({ brandSummary }),
  setServices: (services) => set({ services }),
  toggleService: (id) => set((s) => ({
    services: s.services.includes(id)
      ? s.services.filter((x) => x !== id)
      : [...s.services, id],
  })),
  setNiches: (niches) => set({ niches }),
  toggleNiche: (niche) => set((s) => ({
    niches: s.niches.includes(niche)
      ? s.niches.filter((x) => x !== niche)
      : [...s.niches, niche],
  })),
  setLocation: (location) => set({ location }),
  setCategory: (category) => set({ category }),
  setCity: (city) => set({ city }),
  setCountry: (country) => set({ country }),
  reset: () => set(defaults),
}))

if (typeof window !== 'undefined') {
  useOnboardingStore.subscribe((state) => {
    writePersisted(state)
  })
}
