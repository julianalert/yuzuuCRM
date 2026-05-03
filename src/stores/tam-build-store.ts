import { create } from 'zustand'

interface StepStatus {
  done: boolean
  count: number
}

interface BuildStatus {
  status: 'idle' | 'running' | 'complete' | 'error'
  jobId: string | null
  slug: string | null
  steps: {
    finding: StepStatus
    enriching: StepStatus
    scoring: StepStatus
  }
  total_accounts: number
  error: string | null
}

interface TamBuildStore extends BuildStatus {
  startJob: (jobId: string, slug: string) => void
  updateStatus: (status: Omit<BuildStatus, 'jobId' | 'slug'>) => void
  reset: () => void
}

const defaultSteps = {
  finding: { done: false, count: 0 },
  enriching: { done: false, count: 0 },
  scoring: { done: false, count: 0 },
}

export const useTamBuildStore = create<TamBuildStore>((set) => ({
  status: 'idle',
  jobId: null,
  slug: null,
  steps: defaultSteps,
  total_accounts: 0,
  error: null,
  startJob: (jobId, slug) =>
    set({ status: 'running', jobId, slug, steps: defaultSteps, error: null }),
  updateStatus: (status) => set(status),
  reset: () =>
    set({ status: 'idle', jobId: null, slug: null, steps: defaultSteps, total_accounts: 0, error: null }),
}))
