'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useUser } from '@/hooks/useUser'
import { Icon, Icons } from '@/components/shared/Icon'

const platformNav = [
  { id: 'dashboard',  label: 'Dashboard', icon: Icons.dashboard, badge: null,          comingSoon: false },
  { id: 'leads',      label: 'Leads',     icon: Icons.leads,     badge: null,          comingSoon: false },
  { id: 'signals',    label: 'Signals',   icon: Icons.signals,   badge: null,          comingSoon: false },
  { id: 'sequences',  label: 'Sequences', icon: Icons.sequences, badge: null,          comingSoon: true  },
  { id: 'pipeline',   label: 'Pipeline',  icon: Icons.pipeline,  badge: null,          comingSoon: false },
]

interface WorkspaceItem {
  id: string
  name: string
  slug: string
  offer_description: string | null
}

export function Sidebar() {
  const workspace = useWorkspace()
  const user = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const slug = workspace.slug

  const [open, setOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const footerRef = useRef<HTMLDivElement>(null)

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isActive = (id: string) =>
    pathname === `/${slug}/${id}` || pathname.startsWith(`/${slug}/${id}/`)

  const isSettingsActive = pathname.startsWith(`/${slug}/settings`)
  const isProfileActive = pathname.startsWith(`/${slug}/profile`)

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspaces')
      const json = await res.json()
      setWorkspaces(json.workspaces ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleToggle = () => {
    if (!open) fetchWorkspaces()
    setOpen((v) => !v)
  }

  const handleSwitch = async (target: WorkspaceItem) => {
    if (target.slug === slug || switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/workspace/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: target.id }),
      })
      const json = await res.json()
      if (json.destination) {
        setOpen(false)
        router.push(json.destination)
      }
    } finally {
      setSwitching(false)
    }
  }

  const handleCreate = async () => {
    if (switching) return
    setSwitching(true)
    try {
      const res = await fetch('/api/workspace/create', { method: 'POST' })
      const json = await res.json()
      if (json.slug) {
        setOpen(false)
        router.push(`/${json.slug}/onboarding`)
      }
    } finally {
      setSwitching(false)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const workspaceInitials = workspace.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-name">Yuzuu</span>
        {workspace.subscription_status === 'trialing' && (
          <span className="logo-badge">Trial</span>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Platform</div>
        {platformNav.map((n) =>
          n.comingSoon ? (
            <div
              key={n.id}
              className="nav-item"
              style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}
            >
              <Icon d={n.icon} size={15} />
              {n.label}
              <span style={{
                marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                letterSpacing: 0.4, textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 4,
                background: 'var(--border)', color: 'var(--text-3)',
              }}>
                Soon
              </span>
            </div>
          ) : (
            <Link
              key={n.id}
              href={`/${slug}/${n.id}`}
              className={`nav-item ${isActive(n.id) ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <Icon d={n.icon} size={15} />
              {n.label}
              {n.badge && <span className="nav-badge">{n.badge}</span>}
            </Link>
          )
        )}

        <div className="nav-section-label" style={{ marginTop: 8 }}>
          Workspace
        </div>
        <Link
          href={`/${slug}/profile`}
          className={`nav-item ${isProfileActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <Icon d={Icons.user} size={15} />
          Profile
        </Link>
        <Link
          href={`/${slug}/ask`}
          className={`nav-item ${isActive('ask') ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <Icon d={Icons.ask} size={15} />
          Ask AI
        </Link>
        <Link
          href={`/${slug}/settings`}
          className={`nav-item ${isSettingsActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <Icon d={Icons.settings} size={15} />
          Settings
        </Link>
      </nav>

      <div className="sidebar-footer" ref={footerRef} style={{ position: 'relative' }}>
        {open && (
          <div className="ws-switcher-popover">
            {loading ? (
              <div className="ws-switcher-loading">Loading…</div>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  className={`ws-switcher-item ${ws.slug === slug ? 'active' : ''}`}
                  onClick={() => handleSwitch(ws)}
                  disabled={switching}
                >
                  <span className="ws-switcher-avatar">
                    {(ws.name ?? '?').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="ws-switcher-name">{ws.name}</span>
                  {ws.slug === slug && (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--accent)' }}>
                      <path d="M2 6.5L5.5 10L11 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))
            )}
            <div className="ws-switcher-divider" />
            <button
              className="ws-switcher-item ws-switcher-create"
              onClick={handleCreate}
              disabled={switching}
            >
              <span className="ws-switcher-plus">＋</span>
              New workspace
            </button>
          </div>
        )}

        <div className="user-row" onClick={handleToggle} role="button" aria-haspopup="listbox" aria-expanded={open}>
          <div className="avatar" style={{ borderRadius: 6 }}>{workspaceInitials}</div>
          <div className="user-info">
            <div className="user-name">{workspace.name}</div>
            <div className="user-plan">{initials} · {workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)}</div>
          </div>
          <Icon d={Icons.chevronDown} size={13} style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </div>
      </div>
    </aside>
  )
}
