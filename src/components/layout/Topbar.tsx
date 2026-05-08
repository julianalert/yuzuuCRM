'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useUser } from '@/hooks/useUser'
import { Icon, Icons } from '@/components/shared/Icon'

type PageConfig = [title: string, sep: string | null, sub: string | null]

const pageTitles: Record<string, PageConfig> = {
  dashboard: ['Yuzuu', null, null],
  leads:     ['Lead Finder', '/', 'Google Maps'],
  signals:   ['Signals', null, null],
  sequences: ['Sequences', '/', '3 active'],
  capture:   ['Activity Capture', '/', 'Auto-synced'],
  pipeline:  ['Pipeline', '/', '$278k open'],
  ask:       ['Ask AI', '/', 'AI Copilot'],
  settings:  ['Settings', null, null],
}

export function Topbar() {
  const workspace = useWorkspace()
  const user = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const slug = workspace.slug
  const segment = pathname.replace(`/${slug}/`, '').split('/')[0] || 'dashboard'
  const config: PageConfig = pageTitles[segment] ?? ['Yuzuu', null, null]
  const [title, sep, sub] = config

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      {sep && <span className="topbar-sep">/</span>}
      {sub && <span className="topbar-sub">{sub}</span>}
      <div className="topbar-right">
        {workspace.enrichment_credits !== undefined && (
          <a
            href={`/${slug}/settings/billing`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600,
              color: workspace.enrichment_credits <= 1 ? 'var(--red, #e5534b)' : 'var(--text-2)',
              background: 'var(--border)', borderRadius: 6,
              padding: '4px 10px', textDecoration: 'none',
            }}
            title="Enrichment credits remaining"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {workspace.enrichment_credits} {workspace.enrichment_credits === 1 ? 'credit' : 'credits'}
          </a>
        )}
        <button className="btn btn-ghost btn-icon">
          <Icon d={Icons.bell} size={16} />
        </button>

        <div ref={ref} style={{ position: 'relative' }}>
          <div
            className="avatar"
            style={{ width: 28, height: 28, fontSize: 11, cursor: 'pointer' }}
            onClick={() => setOpen((o) => !o)}
          >
            {initials}
          </div>

          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: 200, zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                  {user.full_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {workspace.name}
                </div>
              </div>
              <div style={{ padding: 6 }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: 6, fontSize: 13, color: 'var(--red, #e5534b)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--border)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
