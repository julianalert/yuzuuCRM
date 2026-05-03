import { requireAuth, errorResponse } from '@/lib/api-auth'
import { createServiceClient } from '@/lib/supabase/server'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export async function POST(request: Request) {
  try {
    const { workspace } = await requireAuth()
    const { name } = (await request.json()) as { name: string }

    if (!name || name.trim().length < 1) {
      return Response.json({ error: 'Name is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const baseSlug = toSlug(name.trim()) || `workspace-${Date.now().toString(36)}`

    // Find a unique slug
    let slug = baseSlug
    for (let i = 1; i <= 20; i++) {
      const { data: existing } = await serviceClient
        .from('workspaces')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (!existing || existing.id === workspace.id) break
      slug = `${baseSlug}-${i}`
    }

    const { error } = await serviceClient
      .from('workspaces')
      .update({ name: name.trim(), slug })
      .eq('id', workspace.id)

    if (error) throw error

    return Response.json({ slug, name: name.trim() })
  } catch (err) {
    return errorResponse(err)
  }
}
