'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useUser } from '@/hooks/useUser'
import { Icon, Icons } from '@/components/shared/Icon'

const nav = [
  { id: 'dashboard', label: 'Dashboard',       icon: Icons.dashboard, badge: null },
  { id: 'tam',       label: 'Build TAM',        icon: Icons.tam,       badge: null },
  { id: 'signals',   label: 'Signals',          icon: Icons.signals,   badge: 5   },
  { id: 'sequences', label: 'Sequences',        icon: Icons.sequences, badge: null },
  { id: 'capture',   label: 'Activity Capture', icon: Icons.capture,   badge: null },
  { id: 'pipeline',  label: 'Pipeline',         icon: Icons.pipeline,  badge: null },
  { id: 'ask',       label: 'Ask AI',           icon: Icons.ask,       badge: null },
] as const

export function Sidebar() {
  const workspace = useWorkspace()
  const user = useUser()
  const pathname = usePathname()
  const slug = workspace.slug

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isActive = (id: string) =>
    pathname === `/${slug}/${id}` || pathname.startsWith(`/${slug}/${id}/`)

  const isSettingsActive = pathname.startsWith(`/${slug}/settings`)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">RE</div>
        <span className="logo-name">Yuzuu</span>
        {workspace.subscription_status === 'trialing' && (
          <span className="logo-badge">Trial</span>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Platform</div>
        {nav.map((n) => (
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
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>
          Workspace
        </div>
        <Link
          href={`/${slug}/settings`}
          className={`nav-item ${isSettingsActive ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          <Icon d={Icons.settings} size={15} />
          Settings
        </Link>
      </nav>

      <div className="sidebar-footer">
        <div className="user-row">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user.full_name}</div>
            <div className="user-plan">{workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)} Plan</div>
          </div>
          <Icon d={Icons.chevronDown} size={13} style={{ color: 'var(--text-3)' }} />
        </div>
      </div>
    </aside>
  )
}
