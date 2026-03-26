import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, QUEUE_NAMES, getRegionalRoute, riotFetch, delay, respond } from '../_shared/riot-utils.ts'
import { mergeAnalytics, type AnalyticsBucket } from '../_shared/analytics.ts'

// ~40 match details per invocation at 1200ms = 48s — fits within 60s Edge Function timeout
const BATCH_SIZE = 40

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { playerId, region } = await req.json() as {
      playerId: string
      region: string
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const riotKey = Deno.env.get('RIOT_API_KEY')!
    const regional = getRegionalRoute(region)

    // Read backfill state
    const { data: profile } = await supabase
      .from('profiles')
      .select('history_cursor, history_complete, last_compiled_at')
      .eq('player_id', playerId)
      .single()

    if (!profile) {
      return respond({ error: 'Profile not found. Compile profile first.' }, 404)
    }

    if (profile.history_complete) {
      return respond({ processed: 0, hasMore: false })
    }

    // If no cursor yet, derive it from the oldest match we already have
    let cursor = profile.history_cursor as number | null
    if (cursor === null) {
      const { data: oldestMatch } = await supabase
        .from('matches')
        .select('match_timestamp')
        .eq('player_id', playerId)
        .order('match_timestamp', { ascending: true })
        .limit(1)
        .single()

      if (!oldestMatch) {
        return respond({ error: 'No matches found. Compile profile first.' }, 400)
      }
      cursor = Math.floor(new Date(oldestMatch.match_timestamp).getTime() / 1000)
    }

    // Fetch match IDs BEFORE the cursor (going backward in time)
    const matchListUrl = new URL(
      `https://${regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${playerId}/ids`,
    )
    matchListUrl.searchParams.set('endTime', String(cursor))
    matchListUrl.searchParams.set('count', '100')

    const matchListRes = await riotFetch(matchListUrl.toString(), riotKey)
    if (!matchListRes.ok) {
      throw new Error(`Match list fetch failed: ${matchListRes.status}`)
    }
    const matchIds = await matchListRes.json() as string[]

    // No more matches — backfill complete
    if (matchIds.length === 0) {
      await supabase
        .from('profiles')
        .update({ history_complete: true })
        .eq('player_id', playerId)
      return respond({ processed: 0, hasMore: false })
    }

    // Process up to BATCH_SIZE matches (stay within Edge Function timeout)
    const toProcess = matchIds.slice(0, BATCH_SIZE)
    const analyticsMap: Record<string, Record<string, AnalyticsBucket>> = {}
    const newMatches: unknown[] = []
    const newParticipants: unknown[] = []
    let oldestTimestamp = cursor

    for (const matchId of toProcess) {
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
      const matchEpoch = Math.floor(info.gameStartTimestamp / 1000)

      if (matchEpoch < oldestTimestamp) {
        oldestTimestamp = matchEpoch
      }

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
          role: p.teamPosition || 'UNKNOWN',
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
        })
      }

      // Accumulate analytics
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

      await delay(1200)
    }

    // Persist matches + participants
    if (newMatches.length > 0) {
      await supabase.from('matches').upsert(newMatches, { onConflict: 'match_id,player_id' })
    }
    if (newParticipants.length > 0) {
      await supabase.from('match_participants').upsert(newParticipants, { onConflict: 'match_id,player_id' })
    }

    // Merge analytics into cache
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

    // Update cursor — if we got fewer match IDs than requested, we've reached the end
    const hasMore = matchIds.length === 100
    await supabase
      .from('profiles')
      .update({
        history_cursor: oldestTimestamp,
        history_complete: !hasMore,
      })
      .eq('player_id', playerId)

    return respond({
      processed: newMatches.length,
      hasMore,
      cursor: oldestTimestamp,
    })

  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

