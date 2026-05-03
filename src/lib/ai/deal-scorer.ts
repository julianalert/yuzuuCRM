import Anthropic from '@anthropic-ai/sdk'
import type { Deal, Account, Activity } from '@/lib/types'

export interface DealFactor {
  label: string
  status: 'positive' | 'neutral' | 'negative'
  detail: string
}

export interface DealScoreResult {
  score: number
  reason: string
  factors: DealFactor[]
}

function getDaysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function getActivitySummary(activities: Activity[]): string {
  if (activities.length === 0) return 'No activities recorded'
  const recent = activities.slice(0, 5)
  return recent.map(a => `${a.type} (${a.sentiment ?? 'neutral'}): ${a.subject ?? a.summary ?? 'no detail'}`).join('; ')
}

function getRecentSentiment(activities: Activity[]): string {
  const emailActivities = activities.filter(a => a.type === 'email' && a.sentiment)
  if (emailActivities.length === 0) return 'unknown'
  return emailActivities[0].sentiment ?? 'neutral'
}

export async function scoreDeal(
  deal: Deal,
  account: Account,
  activities: Activity[],
): Promise<DealScoreResult> {
  const daysSinceLastActivity = getDaysSince(deal.last_activity_at ?? account.last_activity_at)
  const activitySummary = getActivitySummary(activities)
  const recentSentiment = getRecentSentiment(activities)

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const prompt = `You are an expert B2B sales analyst. Assess the health of this deal.

Deal: ${deal.name}
Company: ${account.name}
Stage: ${deal.stage}
Value: ${deal.value ? `${deal.currency ?? 'USD'} ${deal.value}` : 'not set'}
Expected close: ${deal.close_date ?? 'not set'}
Days since last activity: ${daysSinceLastActivity === 999 ? 'never' : daysSinceLastActivity}
Total activities: ${activities.length}
Recent email sentiment: ${recentSentiment}
Activity summary: ${activitySummary}

Score 0-100 where:
- 80-100: Healthy, on track to close
- 60-79: Good but needs attention
- 40-59: At risk, action needed soon
- Below 40: Stalling, intervention required

Return ONLY valid JSON:
{
  "score": number,
  "reason": "2-3 sentence overall assessment",
  "factors": [
    { "label": "string", "status": "positive" | "neutral" | "negative", "detail": "string" }
  ]
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text) as DealScoreResult
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reason: parsed.reason,
      factors: parsed.factors ?? [],
    }
  } catch {
    console.error('[DealScorer] Failed to parse AI response:', text)
    return {
      score: 50,
      reason: 'Unable to assess deal health at this time.',
      factors: [],
    }
  }
}
