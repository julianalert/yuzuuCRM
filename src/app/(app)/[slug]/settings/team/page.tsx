'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { SettingsLayout } from '@/components/layout/SettingsLayout'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useUser } from '@/hooks/useUser'
import { Icon, Icons } from '@/components/shared/Icon'
import { Modal } from '@/components/shared/Modal'
import { formatDistanceToNow } from 'date-fns'
import type { User, Invitation } from '@/lib/types'

type MemberWithRole = User

interface PendingInvite extends Invitation {
  users?: { full_name: string } | null
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="avatar">{initials}</div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors = {
    owner: 'var(--accent)',
    admin: 'var(--blue)',
    member: 'var(--border-2)',
  } as Record<string, string>
  const textColors = {
    owner: 'white',
    admin: 'white',
    member: 'var(--text-2)',
  } as Record<string, string>

  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: colors[role] ?? 'var(--border)',
      color: textColors[role] ?? 'var(--text-2)',
    }}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

export default function TeamPage() {
  const workspace = useWorkspace()
  const currentUser = useUser()
  const [members, setMembers] = useState<MemberWithRole[]>([])
  const [invitations, setInvitations] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [membersRes, invitesRes] = await Promise.all([
      fetch('/api/team/members'),
      fetch('/api/team/invite'),
    ])
    const membersData = await membersRes.json() as { members?: MemberWithRole[] }
    const invitesData = await invitesRes.json() as { invitations?: PendingInvite[] }
    setMembers(membersData.members ?? [])
    setInvitations(invitesData.invitations ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invitation')
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteModal(false)
      void fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  async function handleResendInvite(id: string) {
    try {
      await fetch(`/api/team/invite/${id}/resend`, { method: 'POST' })
      toast.success('Invitation resent')
    } catch {
      toast.error('Failed to resend invitation')
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await fetch(`/api/team/invite/${id}`, { method: 'DELETE' })
      setInvitations(prev => prev.filter(i => i.id !== id))
      toast.success('Invitation cancelled')
    } catch {
      toast.error('Failed to cancel invitation')
    }
  }

  async function handleChangeRole(memberId: string, role: 'admin' | 'member') {
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
      toast.success('Role updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/team/members/${memberId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove member')
      setMembers(prev => prev.filter(m => m.id !== memberId))
      setConfirmRemoveId(null)
      toast.success('Member removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingId(null)
    }
  }

  const isOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin'

  return (
    <SettingsLayout>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Team Members</span>
          {isOwnerOrAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowInviteModal(true)}>
              <Icon d={Icons.plus} size={13} /> Invite member
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : (
          <div style={{ padding: '0 20px' }}>
            {members.map((member) => (
              <div
                key={member.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}
              >
                <Avatar name={member.full_name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>
                    {member.full_name}
                    {member.id === currentUser?.id && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{member.email}</div>
                </div>
                <RoleBadge role={member.role} />

                {currentUser?.role === 'owner' && member.role !== 'owner' && member.id !== currentUser.id && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <select
                      className="form-input"
                      value={member.role}
                      onChange={e => void handleChangeRole(member.id, e.target.value as 'admin' | 'member')}
                      style={{ height: 30, padding: '0 8px', fontSize: 12, width: 90, cursor: 'pointer' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                    {confirmRemoveId === member.id ? (
                      <>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'var(--red)', color: 'white' }}
                          onClick={() => void handleRemoveMember(member.id)}
                          disabled={removingId === member.id}
                        >
                          Confirm
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemoveId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--red)' }}
                        onClick={() => setConfirmRemoveId(member.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {invitations.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Pending Invitations</span></div>
          <div style={{ padding: '0 20px' }}>
            {invitations.map(invite => (
              <div
                key={invite.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}
              >
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
                  }}
                >
                  ✉
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{invite.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Invited {formatDistanceToNow(new Date(invite.created_at), { addSuffix: true })}
                    {invite.expires_at && ` · expires ${formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true })}`}
                  </div>
                </div>
                <RoleBadge role={invite.role} />
                {isOwnerOrAdmin && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => void handleResendInvite(invite.id)}
                    >
                      Resend
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--red)' }}
                      onClick={() => void handleCancelInvite(invite.id)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)} maxWidth={440}>
          <div className="card-header">
            <span className="card-title">Invite team member</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowInviteModal(false)}>
              <Icon d={Icons.x} size={16} />
            </button>
          </div>
          <div className="card-body">
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">Email address *</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['member', 'admin'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteRole(r)}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
                        border: `2px solid ${inviteRole === r ? 'var(--accent)' : 'var(--border)'}`,
                        background: inviteRole === r ? 'var(--bg)' : 'var(--surface)',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {r === 'admin' ? 'Full access, can invite members' : 'Can view and edit data'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </SettingsLayout>
  )
}
