import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ICPParams } from '@/lib/ai/icp-extractor'

type OnboardingStep = 1 | 2 | 3

interface OnboardingState {
  step: OnboardingStep
  description: string
  jobId: string | null
  params: ICPParams | null
  setStep: (step: OnboardingStep) => void
  setDescription: (description: string) => void
  setJobId: (id: string) => void
  setParams: (params: ICPParams) => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      step: 1,
      description: '',
      jobId: null,
      params: null,
      setStep: (step) => set({ step }),
      setDescription: (description) => set({ description }),
      setJobId: (jobId) => set({ jobId }),
      setParams: (params) => set({ params }),
      reset: () => set({ step: 1, description: '', jobId: null, params: null }),
    }),
    {
      name: 'revenue-engine-onboarding',
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
