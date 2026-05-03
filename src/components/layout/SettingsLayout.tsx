'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useWorkspace } from '@/hooks/useWorkspace'
import { Icon, Icons } from '@/components/shared/Icon'
import type { ReactNode } from 'react'

const tabs = [
  { id: 'team',         label: 'Team',         icon: Icons.team,         href: (s: string) => `/${s}/settings/team`         },
  { id: 'billing',      label: 'Billing',      icon: Icons.billing,      href: (s: string) => `/${s}/settings/billing`      },
  { id: 'integrations', label: 'Integrations', icon: Icons.integrations, href: (s: string) => `/${s}/settings/integrations` },
]

export function SettingsLayout({ children }: { children: ReactNode }) {
  const workspace = useWorkspace()
  const pathname = usePathname()

  return (
    <div className="page-enter settings-layout">
      <div className="settings-nav">
        {tabs.map((t) => {
          const href = t.href(workspace.slug)
          const isActive = pathname.startsWith(href)

          return (
            <Link
              key={t.id}
              href={href}
              className={`settings-nav-item ${isActive ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <Icon d={t.icon} size={14} />
              {t.label}
            </Link>
          )
        })}
      </div>
      <div className="settings-content">{children}</div>
    </div>
  )
}
