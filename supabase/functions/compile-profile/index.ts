import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cap matches per compile to stay within Riot dev key rate limits (100 req / 2 min)
const MATCH_FETCH_LIMIT = 20

const QUEUE_NAMES: Record<number, string> = {
  420: 'RANKED_SOLO_5x5',
  440: 'RANKED_FLEX_SR',
  400: 'NORMAL_DRAFT',
  430: 'NORMAL_BLIND',
  450: 'ARAM',
  900: 'URF',
  1020: 'ONE_FOR_ALL',
  1400: 'ULTIMATE_SPELLBOOK',
}

interface ChampionStat {
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
}

interface AnalyticsBucket {
  total_games: number
  wins: number
  champion_stats: Record<string, ChampionStat>
  role_distribution: Record<string, number>
}

function getRegionalRoute(platform: string): string {
  if (['NA1', 'BR1', 'LA1', 'LA2'].includes(platform)) return 'americas'
  if (['KR', 'JP1'].includes(platform)) return 'asia'
  if (['OC1', 'PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(platform)) return 'sea'
  return 'europe'
}

/** Fetch with automatic 429 retry */
async function riotFetch(url: string, apiKey: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } })
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 2)
    await delay(retryAfter * 1000)
    return riotFetch(url, apiKey)
  }
  return res
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { playerId, region, gameName, tagLine } = await req.json() as {
      playerId: string
      region: string
      gameName: string
      tagLine: string
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const riotKey = Deno.env.get('RIOT_API_KEY')!
    const regional = getRegionalRoute(region)

    // TODO Sprint 4: acquire PostgreSQL advisory lock via pg_try_advisory_xact_lock(hashtext(playerId))
    // to prevent duplicate concurrent compilation for the same profile.

    // Get last_compiled_at for incremental fetch (only matches newer than this)
    const { data: existing } = await supabase
      .from('profiles')
      .select('last_compiled_at')
      .eq('player_id', playerId)
      .single()

    const startTime = existing?.last_compiled_at
      ? Math.floor(new Date(existing.last_compiled_at).getTime() / 1000)
      : undefined

    // 1. Fetch match IDs (incremental from startTime)
    const matchListUrl = new URL(
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${playerId}/ids`,
    )
    matchListUrl.searchParams.set('count', String(MATCH_FETCH_LIMIT))
    if (startTime) matchListUrl.searchParams.set('startTime', String(startTime))

    const matchListRes = await riotFetch(matchListUrl.toString(), riotKey)
    if (!matchListRes.ok) {
      throw new Error(`Match list fetch failed: ${matchListRes.status}`)
    }
    const matchIds = await matchListRes.json() as string[]

    if (matchIds.length === 0) {
      // No new matches — refresh ranked + summoner data + timestamp
      const platform = region.toLowerCase()
      const [rankedRes, summonerRes] = await Promise.all([
        riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${playerId}`, riotKey),
        riotFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${playerId}`, riotKey),
      ])
      const rankedData = rankedRes.ok ? await rankedRes.json() : []
      const summoner = summonerRes.ok
        ? await summonerRes.json() as { profileIconId: number; summonerLevel: number }
        : null
      await supabase.from('profiles').upsert({
        player_id: playerId,
        game_name: gameName,
        tag_line: tagLine,
        region,
        ranked_data: rankedData,
        profile_icon_id: summoner?.profileIconId ?? null,
        summoner_level: summoner?.summonerLevel ?? null,
        last_compiled_at: new Date().toISOString(),
      })
      return respond({ status: 'ok', newMatches: 0 })
    }

    // 2. Fetch each match + accumulate analytics
    const analyticsMap: Record<string, Record<string, AnalyticsBucket>> = {}
    const newMatches: unknown[] = []
    const newParticipants: unknown[] = []

    for (const matchId of matchIds) {
      const matchRes = await riotFetch(
        `https://${regional}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        riotKey,
      )
      if (!matchRes.ok) continue

      const matchData = await matchRes.json() as {
        info: {
          gameStartTimestamp: number
          gameDuration: number
          queueId: number
          participants: Array<{
            puuid: string
            riotIdGameName: string
            riotIdTagline: string
            championId: number
            teamId: number
            teamPosition: string
            win: boolean
            kills: number
            deaths: number
            assists: number
          }>
        }
      }

      const { info } = matchData
      const queueType = QUEUE_NAMES[info.queueId] ?? `QUEUE_${info.queueId}`
      const season = `S${new Date(info.gameStartTimestamp).getFullYear()}`
      const matchTimestamp = new Date(info.gameStartTimestamp).toISOString()

      const me = info.participants.find((p) => p.puuid === playerId)
      if (!me) continue

      newMatches.push({
        match_id: matchId,
        player_id: playerId,
        match_timestamp: matchTimestamp,
        game_duration: info.gameDuration,
        queue_type: queueType,
        champion_id: me.championId,
        role: me.teamPosition || 'UNKNOWN',
        win: me.win,
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
      })

      for (const p of info.participants) {
        newParticipants.push({
          match_id: matchId,
          player_id: p.puuid,
          game_name: p.riotIdGameName ?? '',
          champion_id: p.championId,
          team: p.teamId,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
        })
      }

      // Accumulate into analytics buckets
      analyticsMap[season] ??= {}
      analyticsMap[season][queueType] ??= {
        total_games: 0, wins: 0, champion_stats: {}, role_distribution: {},
      }

      const bucket = analyticsMap[season][queueType]
      bucket.total_games++
      if (me.win) bucket.wins++

      const cKey = String(me.championId)
      bucket.champion_stats[cKey] ??= { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 }
      bucket.champion_stats[cKey].games++
      if (me.win) bucket.champion_stats[cKey].wins++
      bucket.champion_stats[cKey].kills += me.kills
      bucket.champion_stats[cKey].deaths += me.deaths
      bucket.champion_stats[cKey].assists += me.assists

      const role = me.teamPosition || 'UNKNOWN'
      bucket.role_distribution[role] = (bucket.role_distribution[role] ?? 0) + 1

      // Throttle to respect rate limits (20 req/s dev key)
      await delay(60)
    }

    // 3. Persist matches + participants
    if (newMatches.length > 0) {
      await supabase.from('matches').upsert(newMatches, { onConflict: 'match_id,player_id' })
    }
    if (newParticipants.length > 0) {
      await supabase.from('match_participants').upsert(newParticipants, { onConflict: 'match_id,player_id' })
    }

    // 4. Merge new analytics into existing analytics_cache
    for (const [season, queues] of Object.entries(analyticsMap)) {
      for (const [queueType, newStats] of Object.entries(queues)) {
        const { data: cached } = await supabase
          .from('analytics_cache')
          .select('total_games, wins, champion_stats, role_distribution')
          .eq('player_id', playerId)
          .eq('season', season)
          .eq('queue_type', queueType)
          .single()

        const merged = mergeAnalytics(cached, newStats)

        await supabase.from('analytics_cache').upsert({
          player_id: playerId,
          season,
          queue_type: queueType,
          ...merged,
          updated_at: new Date().toISOString(),
        })
      }
    }

    // 5. Fetch ranked data + summoner info in parallel (platform routing: euw1, na1, kr, etc.)
    const platform = region.toLowerCase()
    const [rankedRes, summonerRes] = await Promise.all([
      riotFetch(`https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${playerId}`, riotKey),
      riotFetch(`https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${playerId}`, riotKey),
    ])
    const rankedData = rankedRes.ok ? await rankedRes.json() : []
    const summoner = summonerRes.ok
      ? await summonerRes.json() as { profileIconId: number; summonerLevel: number }
      : null

    // 6. Update profile with ranked + summoner data + timestamp
    await supabase.from('profiles').upsert({
      player_id: playerId,
      game_name: gameName,
      tag_line: tagLine,
      region,
      ranked_data: rankedData,
      profile_icon_id: summoner?.profileIconId ?? null,
      summoner_level: summoner?.summonerLevel ?? null,
      last_compiled_at: new Date().toISOString(),
    })

    return respond({ status: 'ok', newMatches: newMatches.length })

  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

function mergeAnalytics(
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
