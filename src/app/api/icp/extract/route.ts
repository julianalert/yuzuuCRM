import { requireAuth, errorResponse } from '@/lib/api-auth'
import { extractICP } from '@/lib/ai/icp-extractor'

export async function POST(request: Request) {
  try {
    await requireAuth()
    const { description } = (await request.json()) as { description: string }

    if (!description || description.trim().length < 20) {
      return Response.json({ error: 'Description must be at least 20 characters.' }, { status: 400 })
    }

    // Only extract params — don't save to DB yet.
    // The ICP record is created when the user starts the build in /api/tam/build.
    const params = await extractICP(description)

    return Response.json({ params })
  } catch (err) {
    return errorResponse(err)
  }
}
