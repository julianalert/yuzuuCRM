import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { requireAuth, errorResponse } from '@/lib/api-auth'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function extractTextFromHtml(html: string): string {
  // Pull out the most useful metadata for Claude
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const descMatch =
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
  const ogDescMatch =
    html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i)
  const ogTitleMatch =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i)

  // Strip tags and grab first meaningful paragraph
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyText = bodyMatch
    ? bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1500)
    : ''

  const parts = [
    titleMatch ? `Title: ${titleMatch[1].trim()}` : '',
    ogTitleMatch ? `OG Title: ${ogTitleMatch[1].trim()}` : '',
    descMatch ? `Meta description: ${descMatch[1].trim()}` : '',
    ogDescMatch ? `OG description: ${ogDescMatch[1].trim()}` : '',
    bodyText ? `Body text (excerpt): ${bodyText}` : '',
  ].filter(Boolean)

  return parts.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const { websiteUrl } = await req.json()

    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return Response.json({ error: 'websiteUrl is required' }, { status: 400 })
    }

    // Normalise URL
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`

    let pageText = ''
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Yuzuu/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      const html = await res.text()
      pageText = extractTextFromHtml(html)
    } catch {
      // If fetch fails, proceed with URL alone — Claude can still infer
      pageText = `Website URL: ${url} (could not fetch content)`
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `You are analysing a business website to extract their core service offer.

Website data:
${pageText}

Return ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "offerDescription": "1-2 sentence description of what this business sells/offers, written in the first person as if the business owner is describing their own offer (e.g. 'We help restaurants get more bookings through...')",
  "brandSummary": "Short one-line label for the business type/category (e.g. 'Web design agency', 'SEO consultant', 'Accounting firm')"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 400,
    })

    const raw = (response.choices[0]?.message?.content ?? '{}').trim()
    const parsed = JSON.parse(raw)

    return Response.json({
      offerDescription: parsed.offerDescription ?? '',
      brandSummary: parsed.brandSummary ?? '',
    })
  } catch (err) {
    return errorResponse(err)
  }
}
