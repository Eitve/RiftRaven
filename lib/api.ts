import { supabase } from './supabase'
import type { Region, SearchResult } from '../types'

export async function searchProfile(
  gameName: string,
  tagLine: string,
  region: Region,
): Promise<SearchResult[]> {
  const { data, error } = await supabase.functions.invoke('search-profile', {
    body: { gameName, tagLine, region },
  })

  if (error) {
    const body = await (error as { context?: Response }).context
      ?.json()
      .catch(() => null)
    throw new Error(body?.error ?? error.message)
  }

  if (!data || !Array.isArray(data)) return []
  return data as SearchResult[]
}

/**
 * Progressively backfills a player's full match history.
 * Calls backfill-history Edge Function in a loop with delays between batches.
 * Each invocation processes ~40 matches; the cursor is persisted server-side.
 */
export async function backfillHistory(
  playerId: string,
  region: string,
  onProgress?: (processed: number, hasMore: boolean) => void,
): Promise<void> {
  let hasMore = true
  while (hasMore) {
    const { data, error } = await supabase.functions.invoke('backfill-history', {
      body: { playerId, region },
    })

    if (error) {
      const body = await (error as { context?: Response }).context
        ?.json()
        .catch(() => null)
      throw new Error(body?.error ?? error.message)
    }

    hasMore = data?.hasMore ?? false
    onProgress?.(data?.processed ?? 0, hasMore)

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}
