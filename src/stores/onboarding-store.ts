import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type OnboardingStep = 1 | 2 | 3

interface OnboardingState {
  step: OnboardingStep
  companyName: string
  websiteUrl: string
  offerDescription: string
  brandSummary: string
  services: string[]
  niches: string[]
  location: string
  // kept for compat with lead_searches
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

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...defaults,
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
    }),
    {
      name: 'yuzuu-onboarding',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
    }
  )
)
