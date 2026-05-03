import Anthropic from '@anthropic-ai/sdk'
import type { Account, ICP } from '@/lib/types'

const MODEL = 'claude-sonnet-4-6'

interface ScoreResult {
  score: number
  reason: string
}

function extractJSON(text: string): string {
  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Strip leading/trailing whitespace
  return text.trim()
}

export async function scoreAccount(
  account: Partial<Account>,
  icp: ICP,
  apiKey?: string,
): Promise<ScoreResult> {
  const client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY!,
  })

  const prompt = `You are a B2B sales expert. Score this company as a fit for the ICP described.

ICP: ${icp.raw_description ?? icp.name}

Company:
- Name: ${account.name}
- Industry: ${account.industry ?? 'Unknown'}
- Size: ${account.employee_count ?? 'Unknown'} employees
- Location: ${account.location ?? 'Unknown'}
- Tech stack: ${account.technology_stack?.join(', ') || 'Unknown'}
- Funding: ${account.funding_stage ?? 'Unknown'}

Score 0-100 where:
- 90-100: Perfect fit, contact immediately
- 70-89: Strong fit, high priority
- 50-69: Moderate fit, worth pursuing
- Below 50: Weak fit

Return ONLY valid JSON:
{ "score": number, "reason": "2 sentence explanation of fit" }`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(extractJSON(text)) as ScoreResult
    return {
      score: Math.min(100, Math.max(0, Math.round(Number(parsed.score)))),
      reason: String(parsed.reason ?? ''),
    }
  } catch {
    throw new Error(`Failed to parse scoring response for account: ${account.name}`)
  }
}

export async function scoreAccountsBatch(
  accounts: Array<Partial<Account> & { id: string }>,
  icp: ICP,
  updateScore: (id: string, score: number, reason: string) => Promise<void>,
  onProgress?: (scored: number) => void,
  apiKey?: string,
): Promise<void> {
  const BATCH_SIZE = 10
  let scored = 0

  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (account) => {
        try {
          const result = await scoreAccount(account, icp, apiKey)
          await updateScore(account.id, result.score, result.reason)
        } catch (err) {
          console.error(`Scoring failed for account ${account.id}:`, err)
        } finally {
          scored++
          onProgress?.(scored)
        }
      }),
    )
  }
}
