'use client'

import { useEffect, useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [invitation, setInvitation] = useState<{ email: string; workspace: { name: string } } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function loadInvite() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invitations')
        .select('email, status, workspaces(name)')
        .eq('token', token)
        .eq('status', 'pending')
        .single()

      if (error || !data) {
        setError('This invitation is invalid or has already been used.')
      } else {
        setInvitation({
          email: data.email,
          workspace: { name: (data.workspaces as { name: string }).name },
        })
      }
      setLoading(false)
    }
    loadInvite()
  }, [token])

  async function handleSubmit(formData: FormData) {
    if (!invitation) return
    setError(null)

    startTransition(async () => {
      const supabase = createClient()
      const fullName = formData.get('full_name') as string
      const password = formData.get('password') as string

      const { error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      const { error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token)

      if (updateError) {
        setError('Failed to accept invitation.')
        return
      }

      window.location.href = '/login'
    })
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading invitation…</div>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo">
            <div className="logo-mark">Y</div>
            <span>Yuzuu</span>
          </div>
          <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>
          <Link href="/login" className="btn btn-secondary" style={{ marginTop: 16, textDecoration: 'none' }}>
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">Y</div>
          <span>Yuzuu</span>
        </div>

        <h1 className="auth-title">You&apos;ve been invited</h1>
        <p className="auth-sub">
          Join <strong>{invitation?.workspace.name}</strong> on Yuzuu
        </p>

        <form action={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              value={invitation?.email ?? ''}
              readOnly
              style={{ background: 'var(--bg)', color: 'var(--text-3)' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              className="form-input"
              placeholder="Your name"
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Choose a password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
            disabled={isPending}
          >
            {isPending ? 'Joining…' : 'Accept invitation'}
          </button>
        </form>
      </div>
    </div>
  )
}
