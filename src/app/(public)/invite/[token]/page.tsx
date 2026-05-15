'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Invitation = {
  email: string
  workspace: { name: string }
  isExistingUser: boolean
}

type PageState = 'loading' | 'form' | 'accepting' | 'error'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [error, setError] = useState<string | null>(null)

  // Try to accept the invitation using the current authenticated session.
  async function acceptWithSession() {
    setPageState('accepting')
    const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      setError(
        body.error === 'expired'
          ? 'This invitation has expired.'
          : 'Failed to accept invitation. Please try again.',
      )
      setPageState('error')
      return
    }
    const { redirectTo } = (await res.json()) as { redirectTo: string }
    window.location.href = redirectTo
  }

  useEffect(() => {
    async function init() {
      if (!token) {
        setError('This invitation is invalid or has already been used.')
        setPageState('error')
        return
      }

      // Load the invitation
      let inv: Invitation | null = null
      try {
        const res = await fetch(`/api/invite/${encodeURIComponent(token)}`)
        const body = (await res.json()) as {
          email?: string
          workspace?: { name: string }
          isExistingUser?: boolean
          error?: string
        }
        if (!res.ok) {
          setError(
            body.error === 'expired'
              ? 'This invitation has expired.'
              : body.error === 'load_failed' || res.status >= 500
                ? 'Could not load this invitation. Try again in a moment.'
                : 'This invitation is invalid or has already been used.',
          )
          setPageState('error')
          return
        }
        if (!body.email || !body.workspace) {
          setError('This invitation is invalid or has already been used.')
          setPageState('error')
          return
        }
        inv = {
          email: body.email,
          workspace: body.workspace,
          isExistingUser: body.isExistingUser ?? false,
        }
        setInvitation(inv)
      } catch {
        setError('Could not load this invitation. Try again or ask for a new link.')
        setPageState('error')
        return
      }

      // Check if the user is already signed in (e.g. returned from OAuth)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email === inv.email) {
        // Already authenticated as the invited user — accept immediately
        await acceptWithSession()
        return
      }

      setPageState('form')
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function handleGoogleSignIn() {
    const supabase = createClient()
    // Store the invite path in a short-lived cookie so auth/callback can
    // redirect back here after OAuth. Query-param redirectTo URLs aren't
    // always in the Supabase allowed-redirect list, so we use a cookie instead.
    document.cookie = `invite_next=${encodeURIComponent(window.location.pathname)}; path=/; max-age=300; SameSite=Lax`
    void supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (pageState === 'loading' || pageState === 'accepting') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
            {pageState === 'accepting' ? 'Joining workspace…' : 'Loading invitation…'}
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <span className="brand-wordmark">Yuzuu</span>
          </div>
          <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>
          <Link href="/login" className="btn btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-wordmark">Yuzuu</span>
        </div>

        <h1 className="auth-title">You&apos;ve been invited</h1>
        <p className="auth-sub">
          Join <strong>{invitation?.workspace.name}</strong> on Yuzuu
        </p>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
          onClick={handleGoogleSignIn}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 8, flexShrink: 0 }}>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.79-3-.79-4.59s.29-3.14.79-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  )
}
