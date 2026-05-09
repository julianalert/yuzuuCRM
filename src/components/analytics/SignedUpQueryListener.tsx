'use client'

import { useEffect } from 'react'
import { trackSignedUp } from '@/lib/analytics/mixpanel-events'

/**
 * Handles `?signed_up=oauth` and `?signed_up=invite` from auth/callback and invite accept redirects.
 */
export function SignedUpQueryListener() {
  useEffect(() => {
    const u = new URL(window.location.href)
    const raw = u.searchParams.get('signed_up')
    if (raw !== 'oauth' && raw !== 'invite') return

    trackSignedUp({ method: raw === 'invite' ? 'invite' : 'oauth' })
    u.searchParams.delete('signed_up')
    const next = `${u.pathname}${u.search}${u.hash}`
    window.history.replaceState({}, '', next)
  }, [])

  return null
}
