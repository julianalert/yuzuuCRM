/**
 * cell-planner.ts
 *
 * Replaces define-search.ts.
 *
 * Generates the initial set of `market_cells` for a workspace by:
 *   1. Geocoding `icp_city` (cached in `geocode_cache`).
 *   2. Tiling the geocoded bounding box with overlapping circles of a
 *      density-appropriate radius.
 *   3. Expanding niches into 3–5 GMB search queries (via gpt-4o-mini).
 *   4. Cross-producting cells = queries × tiles.
 *
 * If the geocode resolves to country-level, we don't try to tile the whole
 * country — we use the bundled top-cities lookup (Tier 1 metros) instead,
 * with the expander promoting Tier 2 later.
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import {
  inferCountryFromLatLng,
  timezoneForCountry,
  topCitiesForCountry,
  type TopCity,
} from './geo-data/top-cities'

// ── Types ────────────────────────────────────────────────────────────────────

export interface SeededCell {
  query: string
  lat: number
  lng: number
  radius_km: number
  priority: number
}

export interface PlanResult {
  cells: SeededCell[]
  geocode: {
    lat: number
    lng: number
    country_code: string | null
    admin_level: 'city' | 'region' | 'country' | 'other'
    timezone: string
  } | null
  reasoning: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
  addresstype?: string
  address?: {
    country_code?: string
    country?: string
    state?: string
    city?: string
    town?: string
    village?: string
  }
  boundingbox?: [string, string, string, string]  // [south, north, west, east]
}

// ── Geocoding (cached) ───────────────────────────────────────────────────────

const NOMINATIM_USER_AGENT = 'YuzuuCRM/1.0 (intent-engine; contact@yuzuu.app)'

async function geocodeCached(rawQuery: string) {
  const supabase = createServiceClient()
  const query = rawQuery.trim().toLowerCase()
  if (!query) return null

  // 1. Cache hit?
  const { data: cached } = await supabase
    .from('geocode_cache')
    .select('*')
    .eq('query', query)
    .maybeSingle()

  if (cached && cached.lat != null && cached.lng != null) {
    return {
      lat: Number(cached.lat),
      lng: Number(cached.lng),
      country_code: cached.country_code,
      admin_level: (cached.admin_level ?? 'other') as 'city' | 'region' | 'country' | 'other',
      bbox: {
        north: cached.bbox_north != null ? Number(cached.bbox_north) : null,
        south: cached.bbox_south != null ? Number(cached.bbox_south) : null,
        east:  cached.bbox_east  != null ? Number(cached.bbox_east)  : null,
        west:  cached.bbox_west  != null ? Number(cached.bbox_west)  : null,
      },
    }
  }

  // 2. Hit Nominatim
  let nominatim: NominatimResult | null = null
  try {
    const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
      q: rawQuery,
      format: 'jsonv2',
      limit: '1',
      addressdetails: '1',
    }).toString()
    const res = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const items = await res.json() as NominatimResult[]
      nominatim = items[0] ?? null
    } else {
      console.warn(`[cell-planner] Nominatim returned ${res.status} for "${rawQuery}"`)
    }
  } catch (err) {
    console.warn('[cell-planner] Nominatim fetch failed:', err)
  }

  if (!nominatim) {
    // Cache the miss with nulls so we don't hammer Nominatim on retry.
    await supabase.from('geocode_cache').upsert({
      query,
      lat: null, lng: null,
      admin_level: null,
      country_code: null,
      raw: null,
    })
    return null
  }

  const lat = Number(nominatim.lat)
  const lng = Number(nominatim.lon)
  const country_code = nominatim.address?.country_code?.toUpperCase()
                       ?? inferCountryFromLatLng(lat, lng)

  // Map nominatim category to our admin_level enum.
  const adminLevel: 'city' | 'region' | 'country' | 'other' =
    nominatim.addresstype === 'country' || nominatim.type === 'country' ? 'country'
    : nominatim.addresstype === 'state' || nominatim.addresstype === 'region' ? 'region'
    : nominatim.addresstype === 'city' || nominatim.addresstype === 'town' ||
      nominatim.addresstype === 'village' || nominatim.type === 'administrative' ? 'city'
    : 'other'

  let bbox = { north: null as number | null, south: null as number | null,
               east:  null as number | null, west:  null as number | null }
  if (nominatim.boundingbox && nominatim.boundingbox.length === 4) {
    const [s, n, w, e] = nominatim.boundingbox.map(Number)
    bbox = { south: s, north: n, west: w, east: e }
  }

  await supabase.from('geocode_cache').upsert({
    query,
    lat,
    lng,
    admin_level: adminLevel,
    country_code: country_code ?? null,
    bbox_north: bbox.north,
    bbox_south: bbox.south,
    bbox_east:  bbox.east,
    bbox_west:  bbox.west,
    raw: nominatim as unknown as Json,
  })

  return { lat, lng, country_code: country_code ?? null, admin_level: adminLevel, bbox }
}

// ── Tiling ───────────────────────────────────────────────────────────────────

/**
 * Tile a bounding box with a hex grid of circles (radius_km).
 *
 * Hex packing: each row is offset by `radius * sqrt(3)/2` so circles cover
 * the plane with controlled overlap. We use slightly smaller spacing than
 * radius to ensure no gaps.
 *
 * Returns at most `maxTiles` points (centers).
 */
function hexTile(
  bbox: { north: number; south: number; east: number; west: number },
  radiusKm: number,
  maxTiles: number,
): Array<{ lat: number; lng: number }> {
  const KM_PER_DEG_LAT = 111
  const dLat = (radiusKm * 1.5) / KM_PER_DEG_LAT  // vertical spacing

  const tiles: Array<{ lat: number; lng: number }> = []

  let row = 0
  for (let lat = bbox.south; lat <= bbox.north; lat += dLat) {
    const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
    if (kmPerDegLng <= 0) continue
    const dLng = (radiusKm * Math.sqrt(3)) / kmPerDegLng
    const offset = row % 2 === 0 ? 0 : dLng / 2
    for (let lng = bbox.west + offset; lng <= bbox.east; lng += dLng) {
      tiles.push({ lat: roundCoord(lat), lng: roundCoord(lng) })
      if (tiles.length >= maxTiles) return tiles
    }
    row++
  }
  return tiles
}

function roundCoord(n: number) {
  // 6 decimal places ~ 11cm precision. Plenty, and keeps the DB unique
  // constraint deterministic.
  return Math.round(n * 1_000_000) / 1_000_000
}

/**
 * Returns the radius_km we should use for cells in a given admin level.
 * - city/town: 3 km circles → covers ~28 km² per tile.
 * - region:    8 km circles → ~200 km².
 * - country:   not tiled directly — we use top-cities instead.
 * - other:     fallback to 5 km.
 */
export function radiusForAdminLevel(level: 'city' | 'region' | 'country' | 'other'): number {
  switch (level) {
    case 'city':   return 3
    case 'region': return 8
    case 'country':return 5   // used only when we fall back to per-city tiling
    default:       return 5
  }
}

// ── Query expansion (gpt-4o-mini) ────────────────────────────────────────────

interface ExpandResult {
  queries: string[]
  reasoning: string
}

export async function expandNichesToQueries(
  niches: string[],
  offerDescription: string | null,
  options: { perNiche: number } = { perNiche: 4 },
): Promise<ExpandResult> {
  if (niches.length === 0) {
    return { queries: ['local business'], reasoning: 'No niches provided; default catch-all.' }
  }

  // Cheap heuristic fallback if no OpenAI key (used in tests + emergencies).
  if (!process.env.OPENAI_API_KEY) {
    return {
      queries: niches.flatMap((n) => [n.toLowerCase()]),
      reasoning: 'OPENAI_API_KEY missing; using raw niches as queries.',
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Translate this agency's target niches into concrete Google Maps search queries.

Niches: ${niches.join(', ')}
Agency offer: ${offerDescription ?? 'Marketing services for local businesses.'}

Rules:
1. For each niche, output ${options.perNiche} DISTINCT, searchable Google Maps business types. Distinct = no overlap. Example: for "Restaurants & Cafés" prefer ["restaurant","cafe","bistro","brasserie"] not ["restaurant","restaurants","chinese restaurant","cafe"].
2. Use English unless the niche is clearly tied to a non-English market (e.g. French "brasserie" is fine).
3. Lowercase, no punctuation, no quotes.
4. Each query must be 1-3 words.

Return ONLY valid JSON: { "queries": ["...", "..."], "reasoning": "<one sentence>" }`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 600,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: ExpandResult
  try {
    parsed = JSON.parse(raw) as ExpandResult
  } catch {
    return { queries: niches.map((n) => n.toLowerCase()), reasoning: 'JSON parse failed; fell back to raw niches.' }
  }

  // Dedup + sanity
  const seen = new Set<string>()
  const cleaned: string[] = []
  for (const q of parsed.queries ?? []) {
    const v = String(q).toLowerCase().trim()
    if (v && v.length <= 40 && !seen.has(v)) {
      seen.add(v)
      cleaned.push(v)
    }
  }
  if (cleaned.length === 0) {
    return { queries: niches.map((n) => n.toLowerCase()), reasoning: 'GPT returned empty; fell back to raw niches.' }
  }
  return { queries: cleaned, reasoning: parsed.reasoning ?? '' }
}

// ── Top-level planner ────────────────────────────────────────────────────────

export interface PlanInput {
  icpCity: string | null
  icpNiches: string[] | null
  icpServices: string[] | null
  offerDescription: string | null
}

export async function planInitialCells(input: PlanInput): Promise<PlanResult> {
  const niches = input.icpNiches ?? []
  const city = input.icpCity ?? ''

  if (!city.trim() || niches.length === 0) {
    return { cells: [], geocode: null, reasoning: 'Missing icp_city or icp_niches.' }
  }

  const geocode = await geocodeCached(city)
  if (!geocode || geocode.lat == null || geocode.lng == null) {
    return { cells: [], geocode: null, reasoning: `Could not geocode "${city}".` }
  }

  const { queries } = await expandNichesToQueries(niches, input.offerDescription)
  if (queries.length === 0) {
    return { cells: [], geocode: null, reasoning: 'No queries generated.' }
  }

  const tiles: Array<{ lat: number; lng: number; priority: number }> = []

  if (geocode.admin_level === 'country' && geocode.country_code) {
    // Don't tile the whole country. Use Tier 1 metros only.
    const metros: readonly TopCity[] = topCitiesForCountry(geocode.country_code, 10)
    for (const m of metros) tiles.push({ lat: m.lat, lng: m.lng, priority: 1 })
    // If we don't have data for this country, fall through to bbox tiling
    // as a last resort.
    if (metros.length === 0 && geocode.bbox.north != null) {
      const bbox = geocode.bbox as { north: number; south: number; east: number; west: number }
      for (const t of hexTile(bbox, 25, 80)) tiles.push({ ...t, priority: 2 })
    }
  } else if (geocode.bbox.north != null && geocode.bbox.south != null &&
             geocode.bbox.east  != null && geocode.bbox.west  != null) {
    const radius = radiusForAdminLevel(geocode.admin_level)
    const bbox = geocode.bbox as { north: number; south: number; east: number; west: number }
    // Hard cap to avoid runaway region-sized targets in v1.
    const maxTiles = geocode.admin_level === 'region' ? 40 : 30
    const tilePts = hexTile(bbox, radius, maxTiles)
    for (const t of tilePts) tiles.push({ ...t, priority: 1 })
  } else {
    // Single point fallback.
    tiles.push({ lat: geocode.lat, lng: geocode.lng, priority: 1 })
  }

  const radius = geocode.admin_level === 'country' ? 5 : radiusForAdminLevel(geocode.admin_level)

  const cells: SeededCell[] = []
  for (const q of queries) {
    for (const t of tiles) {
      cells.push({ query: q, lat: t.lat, lng: t.lng, radius_km: radius, priority: t.priority })
    }
  }

  return {
    cells,
    geocode: {
      lat: geocode.lat,
      lng: geocode.lng,
      country_code: geocode.country_code,
      admin_level: geocode.admin_level,
      timezone: timezoneForCountry(geocode.country_code),
    },
    reasoning: `Geocoded "${city}" → ${geocode.admin_level} (${geocode.country_code ?? '??'}); ${tiles.length} tile(s) × ${queries.length} query(ies) = ${cells.length} cell(s).`,
  }
}

/**
 * Idempotent: inserts SeededCell rows for a workspace, ignoring duplicates
 * via the unique (workspace_id, query, lat, lng, radius_km) index.
 */
export async function persistCells(workspaceId: string, cells: SeededCell[]): Promise<number> {
  if (cells.length === 0) return 0
  const supabase = createServiceClient()
  const rows = cells.map((c) => ({
    workspace_id: workspaceId,
    query: c.query,
    lat: c.lat,
    lng: c.lng,
    radius_km: c.radius_km,
    priority: c.priority,
    status: 'pending' as const,
  }))

  // Upsert with onConflict on the unique index. We don't update existing
  // cells — ICP-change demotion is handled separately.
  const { data, error } = await supabase
    .from('market_cells')
    .upsert(rows, { onConflict: 'workspace_id,query,lat,lng,radius_km', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('[cell-planner] persistCells failed:', error)
    throw error
  }
  return data?.length ?? 0
}
