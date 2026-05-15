import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Icon, Icons } from '@/components/shared/Icon'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: dbUser } = await supabase
      .from('users')
      .select('workspace_id, workspaces(slug)')
      .eq('id', user.id)
      .single()

    if (dbUser?.workspaces) {
      const ws = dbUser.workspaces as { slug: string }
      redirect(`/${ws.slug}/dashboard`)
    } else {
      redirect('/signup')
    }
  }

  return (
    <div className="auth-page">
      <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 32 }}>
          <span className="brand-wordmark">Yuzuu</span>
        </div>

        <h1 style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16, color: 'var(--text-1)' }}>
          Your AI-native<br />B2B sales platform
        </h1>

        <p style={{ fontSize: 18, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 40, maxWidth: 420, margin: '0 auto 40px' }}>
          Replace your CRM with an AI that finds prospects, tracks signals, and writes your outreach — all in one place.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/signup"
            className="btn btn-primary"
            style={{ padding: '12px 28px', fontSize: 15, textDecoration: 'none' }}
          >
            <Icon d={Icons.zap} size={15} fill="currentColor" stroke="none" />
            Start free trial
          </Link>
          <Link
            href="/login"
            className="btn btn-secondary"
            style={{ padding: '12px 28px', fontSize: 15, textDecoration: 'none' }}
          >
            Sign in
          </Link>
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 20 }}>
          14-day free trial · No credit card required
        </p>
      </div>
    </div>
  )
}
