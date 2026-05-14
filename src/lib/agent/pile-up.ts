/**
 * pile-up.ts
 *
 * Hot leads that the user never touched for 30+ days get auto-archived so
 * a long-tenured account never drowns in thousands of "hot" leads.
 *
 * "Touched" proxy: enrichment_status === 'done' implies the user opened
 * the row (enrichment is on-demand, paid by the user). So untouched = hot
 * + enrichment_status === 'none' + discovered_at older than 30 days.
 *
 * Soft-delete only (`archived_at`); user can view in the Backlog tab.
 */

import { createServiceClient } from '@/lib/supabase/server'

const ARCHIVE_AFTER_DAYS = 30

export async function archivePiledUpHotLeads(): Promise<{ archived: number }> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86_400_000).toISOString()

  const { data: candidates, error } = await supabase
    .from('leads')
    .select('id')
    .eq('relevance', 'hot')
    .eq('enrichment_status', 'none')
    .is('archived_at', null)
    .lt('discovered_at', cutoff)
    .limit(500)

  if (error) {
    console.error('[pile-up] query failed:', error)
    return { archived: 0 }
  }
  if (!candidates || candidates.length === 0) return { archived: 0 }

  const ids = candidates.map((c) => c.id)
  await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .in('id', ids)

  console.log(`[pile-up] archived ${ids.length} untouched hot leads`)
  return { archived: ids.length }
}
