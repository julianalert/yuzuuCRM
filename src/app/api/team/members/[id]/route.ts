import { NextResponse } from 'next/server'
import { requireAuth, errorResponse, UnauthorizedError } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspace } = await requireAuth()
    const { id } = await params

    const { role } = await req.json() as { role: 'admin' | 'member' }

    // Only owner can change roles
    if (user.role !== 'owner') {
      throw new UnauthorizedError('Only the workspace owner can change member roles')
    }

    // Can't demote yourself
    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ user: data })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workspace } = await requireAuth()
    const { id } = await params

    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new UnauthorizedError('Only admins and owners can remove members')
    }

    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from the workspace' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Reassign their deals to the owner
    const { data: owner } = await supabase
      .from('users')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('role', 'owner')
      .single()

    if (owner) {
      await supabase
        .from('deals')
        .update({ owner_id: owner.id })
        .eq('owner_id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
    }

    // Remove from workspace (delete user row — auth.users cascade will handle auth side)
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspace.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}
