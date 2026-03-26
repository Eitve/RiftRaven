export interface ChampionStat {
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
}

export interface AnalyticsBucket {
  total_games: number
  wins: number
  champion_stats: Record<string, ChampionStat>
  role_distribution: Record<string, number>
}

export function mergeAnalytics(
  existing: { total_games: number; wins: number; champion_stats: Record<string, ChampionStat>; role_distribution: Record<string, number> } | null,
  incoming: AnalyticsBucket,
): AnalyticsBucket {
  if (!existing) return incoming

  const champion_stats = { ...existing.champion_stats }
  for (const [cKey, stats] of Object.entries(incoming.champion_stats)) {
    if (champion_stats[cKey]) {
      champion_stats[cKey] = {
        games: champion_stats[cKey].games + stats.games,
        wins: champion_stats[cKey].wins + stats.wins,
        kills: champion_stats[cKey].kills + stats.kills,
        deaths: champion_stats[cKey].deaths + stats.deaths,
        assists: champion_stats[cKey].assists + stats.assists,
      }
    } else {
      champion_stats[cKey] = stats
    }
  }

  const role_distribution = { ...existing.role_distribution }
  for (const [role, count] of Object.entries(incoming.role_distribution)) {
    role_distribution[role] = (role_distribution[role] ?? 0) + count
  }

  return {
    total_games: existing.total_games + incoming.total_games,
    wins: existing.wins + incoming.wins,
    champion_stats,
    role_distribution,
  }
}
