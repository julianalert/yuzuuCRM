'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { User } from '@/lib/types'

const UserContext = createContext<User | null>(null)

export function UserProvider({
  children,
  user,
}: {
  children: ReactNode
  user: User
}) {
  return (
    <UserContext.Provider value={user}>{children}</UserContext.Provider>
  )
}

export function useUserContext() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within the workspace layout')
  return ctx
}
