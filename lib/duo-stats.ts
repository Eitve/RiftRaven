import { supabase } from './supabase'

export interface DuoPartner {
  partner_id: string
  partner_name: string
  games_together: number
  wins_together: number
}

export interface FiveStackGroup {
  teammate_ids: string
  teammate_names: string
  games_together: number
  wins_together: number
}

export async function fetchDuoStats(
  playerId: string,
  seasonFilter?: string,
): Promise<DuoPartner[]> {
  const { data, error } = await supabase.rpc('get_duo_stats', {
    target_puuid: playerId,
    min_games: 2,
    season_filter: seasonFilter ?? null,
  })
  if (error) throw error
  return (data ?? []) as DuoPartner[]
}

export async function fetchFiveStackGroups(
  playerId: string,
  seasonFilter?: string,
): Promise<FiveStackGroup[]> {
  const { data, error } = await supabase.rpc('get_fivestack_groups', {
    target_puuid: playerId,
    min_games: 2,
    season_filter: seasonFilter ?? null,
  })
  if (error) throw error
  return (data ?? []) as FiveStackGroup[]
}
