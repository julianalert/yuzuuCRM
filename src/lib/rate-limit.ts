/**
 * rate-limit.ts
 *
 * Best-effort in-memory token-bucket. Resets across cold starts, which
 * is fine for our threat model (public report links).
 *
 * Each key (token + ip) gets `capacity` requests per `windowMs`.
 */

type Bucket = { count: number; resetAt: number }

const BUCKETS = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, capacity: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  let bucket = BUCKETS.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    BUCKETS.set(key, bucket)
  }
  bucket.count += 1
  const remaining = Math.max(0, capacity - bucket.count)
  return { ok: bucket.count <= capacity, remaining, resetAt: bucket.resetAt }
}

/** Throw out stale buckets opportunistically so the Map doesn't grow forever. */
export function gcBuckets() {
  const now = Date.now()
  for (const [k, b] of BUCKETS) {
    if (b.resetAt <= now) BUCKETS.delete(k)
  }
}
