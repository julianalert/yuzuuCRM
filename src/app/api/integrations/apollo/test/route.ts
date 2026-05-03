import { requireAuth, errorResponse } from '@/lib/api-auth'
import { ApolloClient, ApolloAuthError } from '@/lib/apollo/client'

export async function GET(_request: Request) {
  try {
    const { workspace } = await requireAuth()

    const apiKey = workspace.apollo_api_key ?? process.env.APOLLO_API_KEY ?? ''

    if (!apiKey) {
      return Response.json({ valid: false, plan: '', error: 'No API key configured' })
    }

    const client = new ApolloClient(apiKey)
    const result = await client.testConnection()
    return Response.json(result)
  } catch (err) {
    if (err instanceof ApolloAuthError) {
      return Response.json({ valid: false, plan: '', error: 'Invalid API key' })
    }
    return errorResponse(err)
  }
}
