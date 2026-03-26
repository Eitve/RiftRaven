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
    // Extract the actual error body from the Edge Function response
    const body = await (error as { context?: Response }).context
      ?.json()
      .catch(() => null)
    throw new Error(body?.error ?? error.message)
  }

  if (!data || !Array.isArray(data)) return []
  return data as SearchResult[]
}
