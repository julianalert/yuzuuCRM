'use client'

import type { ReactNode } from 'react'

/** Shared layout shell so route `loading` → wizard → persist-ready states don’t jump. */
export const ONBOARDING_SHELL_STYLE = {
  maxWidth: 760,
  margin: '0 auto',
  padding: '0 24px',
  paddingTop: 32,
  minHeight: 480,
} as const

export function OnboardingShell({ children }: { children?: ReactNode }) {
  return <div style={ONBOARDING_SHELL_STYLE}>{children}</div>
}
