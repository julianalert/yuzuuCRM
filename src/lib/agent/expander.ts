/**
 * expander.ts
 *
 * Runs opportunistically from the cron tick. For each workspace, if at
 * least 80% of its cells are exhausted/dead, we generate the next tier:
 *
 *   1. 5 more query variants per existing niche (gpt-4o-mini).
 *   2. The next tier of cities from the bundled top-cities lookup, if
 *      the workspace is country-scoped.
 *
 * If even after expansion no new cells got seeded, we set
 * `workspaces.tam_status = 'fully_scanned'` and the dashboard switches to
 * "we'll just be refreshing existing leads" mode.
 *
 * Cost: 0 Apify dollars, 1 gpt-4o-mini call per expanded workspace
 * (~$0.0005). Safe to run on every tick.
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { persistCells, radiusForAdminLevel } from './cell-planner'
import { topCitiesForCountry } from './geo-data/top-cities'
import type { Database } from '@/lib/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

const EXHAUSTION_THRESHOLD = 0.8

interface ExpansionInputs {
  niches: string[]
  existingQueries: string[]
  offer: string | null
}

interface ExpansionResult {
  newQueries: string[]
  reasoning: string
}

async function gptExpansion(input: ExpansionInputs): Promise<ExpansionResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { newQueries: [], reasoning: 'OPENAI_API_KEY missing' }
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const prompt = `An agency has been scanning Google Maps for these business types: ${input.existingQueries.join(', ')}.
Their target niches are: ${input.niches.join(', ')}.
Their offer: ${input.offer ?? 'Marketing services for local businesses.'}

Produce 5 ADDITIONAL distinct Google Maps search terms that:
1. Cover business types adjacent to the niches but NOT already in the existing list.
2. Are 1-3 words, lowercase, no quotes or punctuation.
3. Are realistically searchable on Google Maps.

Return ONLY valid JSON: { "queries": ["...", "..."], "reasoning": "<one sentence>" }`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 300,
  })
  const raw = res.choices[0]?.message?.content ?? '{}'
  let parsed: { queries?: string[]; reasoning?: string }
  try { parsed = JSON.parse(raw) } catch { return { newQueries: [], reasoning: 'parse failed' } }

  const seen = new Set(input.existingQueries.map((q) => q.toLowerCase()))
  const cleaned: string[] = []
  for (const q of parsed.queries ?? []) {
    const v = String(q).toLowerCase().trim()
    if (v && !seen.has(v) && v.length <= 40) {
      seen.add(v)
      cleaned.push(v)
    }
  }
  return { newQueries: cleaned, reasoning: parsed.reasoning ?? '' }
}

/**
 * Find workspaces where >=80% of cells are exhausted/dead and expand.
 * Limits to `maxWorkspaces` per invocation to keep ticks bounded.
 */
export async function runExpansionIfNeeded(maxWorkspaces: number): Promise<{ expanded: number }> {
  const supabase = createServiceClient()

  // Quick survey: any workspace with mostly-exhausted cells?
  const { data: stats } = await supabase
    .from('market_cells')
    .select('workspace_id, status')
    .limit(20000)  // bound; real systems would do this in SQL

  if (!stats || stats.length === 0) return { expanded: 0 }

  const counters: Record<string, { total: number; done: number }> = {}
  for (const row of stats) {
    const c = counters[row.workspace_id] ?? { total: 0, done: 0 }
    c.total++
    if (row.status === 'exhausted' || row.status === 'dead') c.done++
    counters[row.workspace_id] = c
  }

  const candidates = Object.entries(counters)
    .filter(([, c]) => c.total > 0 && c.done / c.total >= EXHAUSTION_THRESHOLD)
    .slice(0, maxWorkspaces)
    .map(([id]) => id)

  if (candidates.length === 0) return { expanded: 0 }

  let expanded = 0

  for (const workspaceId of candidates) {
    const { data: wsRaw } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()
    if (!wsRaw) continue
    const ws = wsRaw as Workspace

    if (ws.tam_status === 'fully_scanned' || ws.tam_status === 'expired') continue

    // Read existing queries for context
    const { data: existingCells } = await supabase
      .from('market_cells')
      .select('query, lat, lng, radius_km')
      .eq('workspace_id', workspaceId)

    const existingQueries = Array.from(new Set((existingCells ?? []).map((c) => c.query)))

    // 1. New queries
    const { newQueries } = await gptExpansion({
      niches: ws.icp_niches ?? [],
      existingQueries,
      offer: ws.offer_description,
    })

    let newCellsCount = 0

    if (newQueries.length > 0 && existingCells && existingCells.length > 0) {
      // Apply new queries to the existing tile set (lat/lng/radius).
      const tiles = new Map<string, { lat: number; lng: number; radius_km: number }>()
      for (const c of existingCells) {
        const key = `${c.lat},${c.lng},${c.radius_km}`
        if (!tiles.has(key)) tiles.set(key, {
          lat: Number(c.lat),
          lng: Number(c.lng),
          radius_km: Number(c.radius_km),
        })
      }
      const cells = [] as Array<{ query: string; lat: number; lng: number; radius_km: number; priority: number }>
      for (const q of newQueries) {
        for (const t of tiles.values()) {
          cells.push({ query: q, lat: t.lat, lng: t.lng, radius_km: t.radius_km, priority: 2 })
        }
      }
      newCellsCount += await persistCells(workspaceId, cells)
    }

    // 2. Next-tier cities (country-scoped only)
    const { data: geocode } = await supabase
      .from('geocode_cache')
      .select('country_code, admin_level')
      .eq('query', (ws.icp_city ?? '').trim().toLowerCase())
      .maybeSingle()

    if (geocode?.admin_level === 'country' && geocode.country_code) {
      const existingTilePts = new Set(
        (existingCells ?? []).map((c) => `${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`),
      )
      const tier2 = topCitiesForCountry(geocode.country_code, 30).slice(10)  // 11..30
      const allQueries = Array.from(new Set([
        ...existingQueries,
        ...newQueries,
      ]))
      const radius = radiusForAdminLevel('city')
      const cells = [] as Array<{ query: string; lat: number; lng: number; radius_km: number; priority: number }>
      for (const city of tier2) {
        const key = `${city.lat.toFixed(4)},${city.lng.toFixed(4)}`
        if (existingTilePts.has(key)) continue
        for (const q of allQueries) {
          cells.push({ query: q, lat: city.lat, lng: city.lng, radius_km: radius, priority: 2 })
        }
      }
      newCellsCount += await persistCells(workspaceId, cells)
    }

    if (newCellsCount === 0) {
      // Nothing more to scan — switch to refresh-only.
      await supabase
        .from('workspaces')
        .update({ tam_status: 'fully_scanned' })
        .eq('id', workspaceId)
      console.log(`[expander] ${workspaceId}: nothing to expand, TAM marked fully_scanned`)
    } else {
      expanded++
      console.log(`[expander] ${workspaceId}: seeded ${newCellsCount} new cell(s)`)
    }
  }

  return { expanded }
}
