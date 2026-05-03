'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Workspace } from '@/lib/types'

const WorkspaceContext = createContext<Workspace | null>(null)

export function WorkspaceProvider({
  children,
  workspace,
}: {
  children: ReactNode
  workspace: Workspace
}) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceContext() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within the workspace layout')
  return ctx
}
