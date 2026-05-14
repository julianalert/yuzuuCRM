/**
 * relevance.ts
 *
 * Combines detected intent signals with workspace.icp_services to compute:
 *  - intent_score (0..100): weighted, alignment-aware
 *  - relevance: 'hot' | 'warm' | 'cold'
 *
 * Rules:
 *  - intent_score = sum(signal.severity * weight if aligned, else severity * weight * 0.25),
 *                   normalised to 0..100.
 *  - 'hot'  when intent_score >= 60 AND at least one aligned signal exists.
 *  - 'warm' when intent_score in [30, 60) OR surface_score >= 60 even without alignment.
 *  - 'cold' otherwise.
 */

import type { DetectedSignal, SignalType } from './signal-detectors'
import { alignmentScore } from './signal-detectors'

const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  owner_unresponsive:          0.7,
  negative_review_streak:      1.0,   // acute, actionable now
  review_velocity_drop:        0.6,
  review_velocity_spike:       0.9,
  recently_opened:             0.85,
  no_tracking_pixel:           0.5,
  outdated_stack:              0.8,
  no_booking_on_needs_booking: 0.8,
  phone_only:                  0.75,
  no_social:                   0.4,
  no_website:                  0.7,
  low_rating:                  0.5,
}

export interface RelevanceInput {
  signals: DetectedSignal[]
  workspaceServices: string[] | null | undefined
  surfaceScore: number | null | undefined
}

export interface RelevanceOutput {
  intent_score: number
  relevance: 'hot' | 'warm' | 'cold'
  aligned_signals: DetectedSignal[]
  alignedServicesByType: Record<string, string[]>
}

import { alignedServices } from './signal-detectors'

export function computeRelevance(input: RelevanceInput): RelevanceOutput {
  const { signals, workspaceServices } = input
  const surfaceScore = input.surfaceScore ?? 0

  let total = 0
  const aligned: DetectedSignal[] = []
  const alignedServicesByType: Record<string, string[]> = {}

  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s.type] ?? 0.5
    const isAligned = alignmentScore(s.type, workspaceServices) === 1
    total += s.severity * w * (isAligned ? 1 : 0.25)
    if (isAligned) {
      aligned.push(s)
      alignedServicesByType[s.type] = alignedServices(s.type, workspaceServices)
    }
  }

  // Normalise: a typical hot lead has 2-3 strong aligned signals.
  // 3 signals * severity 80 * weight 1.0 = 240; that maps to ~100.
  const intent_score = Math.min(100, Math.round(total / 2.4))

  let relevance: 'hot' | 'warm' | 'cold'
  if (intent_score >= 60 && aligned.length > 0) {
    relevance = 'hot'
  } else if (intent_score >= 30 || surfaceScore >= 60) {
    relevance = 'warm'
  } else {
    relevance = 'cold'
  }

  return { intent_score, relevance, aligned_signals: aligned, alignedServicesByType }
}
