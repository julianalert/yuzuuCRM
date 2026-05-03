import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

export interface ICPParams {
  industries: string[]
  employee_ranges: string[]
  locations: string[]
  technologies: string[]
  funding_stages: string[]
  keywords: string[]
}

function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}

export async function extractICP(description: string): Promise<ICPParams> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are a B2B sales expert. Extract structured ICP parameters from this description.
Return ONLY valid JSON, no markdown, no preamble.

Description: "${description}"

Return this exact structure:
{
  "industries": [],
  "employee_ranges": [],
  "locations": [],
  "technologies": [],
  "funding_stages": [],
  "keywords": []
}

Rules:
- industries: e.g. ["SaaS", "B2B Software", "Fintech"]
- employee_ranges: Apollo format only, e.g. ["51,200", "201,500", "501,1000"]
- locations: country or city names, e.g. ["France", "United Kingdom", "Paris"]
- technologies: software tools, e.g. ["Salesforce", "HubSpot", "Slack"]
- funding_stages: e.g. ["Series A", "Series B", "Seed"]
- keywords: intent signals, e.g. ["hiring sales reps", "revenue growth", "digital transformation"]`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const parsed = JSON.parse(extractJSON(text)) as ICPParams
    return {
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
      employee_ranges: Array.isArray(parsed.employee_ranges) ? parsed.employee_ranges : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      technologies: Array.isArray(parsed.technologies) ? parsed.technologies : [],
      funding_stages: Array.isArray(parsed.funding_stages) ? parsed.funding_stages : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    }
  } catch {
    throw new Error('Failed to parse ICP extraction response from Claude')
  }
}
