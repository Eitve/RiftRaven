import { supabase } from './supabase'
import type { Region, SearchResult } from '../types'

/**
 * Calls the search-profile Edge Function.
 * Returns an array of matching SearchResult records (returns [] while function is a stub).
 */
export async function searchProfile(
  gameName: string,
  tagLine: string,
  region: Region,
): Promise<SearchResult[]> {
  const { data, error } = await supabase.functions.invoke('search-profile', {
    body: { gameName, tagLine, region },
  })

  if (error) throw new Error(error.message)
  if (!data || !Array.isArray(data)) return []

  return data as SearchResult[]
}
