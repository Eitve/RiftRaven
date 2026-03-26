export type Region =
  | 'EUW1'
  | 'NA1'
  | 'KR'
  | 'EUN1'
  | 'BR1'
  | 'LA1'
  | 'LA2'
  | 'OC1'
  | 'RU'
  | 'TR1'
  | 'JP1'
  | 'PH2'
  | 'SG2'
  | 'TH2'
  | 'TW2'
  | 'VN2'

export interface Profile {
  player_id: string
  game_name: string
  tag_line: string
  region: Region
  ranked_data: Record<string, unknown>
  last_compiled_at: string | null
  created_at: string
}

/** Subset returned by search — no ranked_data or created_at needed in lists */
export interface SearchResult {
  player_id: string
  game_name: string
  tag_line: string
  region: Region
  last_compiled_at: string | null
}

export interface Match {
  match_id: string
  player_id: string
  match_timestamp: string
  game_duration: number
  queue_type: string
  champion_id: number
  role: string
  win: boolean
  kills: number
  deaths: number
  assists: number
}

export interface MatchParticipant {
  match_id: string
  player_id: string
  game_name: string
  champion_id: number
  team: 100 | 200
  win: boolean
  kills: number
  deaths: number
  assists: number
}

export interface AnalyticsCache {
  player_id: string
  season: string
  queue_type: string
  total_games: number
  wins: number
  champion_stats: Record<string, unknown>
  role_distribution: Record<string, unknown>
  updated_at: string
}
