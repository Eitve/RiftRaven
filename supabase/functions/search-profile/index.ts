import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GAME_NAME_REGEX = /^[\p{L}\p{N} _.]{3,16}$/u
const TAG_LINE_REGEX = /^[A-Za-z0-9]{3,5}$/
const COOLDOWN_MS = 15 * 60 * 1000

function getRegionalRoute(platform: string): string {
  if (['NA1', 'BR1', 'LA1', 'LA2'].includes(platform)) return 'americas'
  if (['KR', 'JP1'].includes(platform)) return 'asia'
  if (['OC1', 'PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(platform)) return 'sea'
  return 'europe'
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return respond({ error: 'Method Not Allowed' }, 405)

  try {
    const { gameName, tagLine, region } = await req.json()

    // 1. Server-side input validation
    if (!GAME_NAME_REGEX.test(gameName)) {
      return respond({ error: 'Invalid game name: 3–16 chars, letters/digits/spaces/underscores/periods only' }, 400)
    }
    if (!TAG_LINE_REGEX.test(tagLine)) {
      return respond({ error: 'Invalid tagline: 3–5 alphanumeric characters only' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const riotKey = Deno.env.get('RIOT_API_KEY')
    if (!riotKey) return respond({ error: 'Riot API key not configured' }, 500)

    // 2. Resolve Riot ID → PUUID via Riot Account API
    const regional = getRegionalRoute(region)
    const accountRes = await fetch(
      `https://${regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: { 'X-Riot-Token': riotKey } },
    )

    if (accountRes.status === 404) return respond([], 200)
    if (!accountRes.ok) {
      const body = await accountRes.json().catch(() => ({})) as { status?: { message?: string } }
      throw new Error(`Riot API ${accountRes.status}: ${body?.status?.message ?? 'error'}`)
    }

    const account = await accountRes.json() as { puuid: string; gameName: string; tagLine: string }
    const playerId = account.puuid

    // 3. Check profiles table — return cache if still fresh
    const { data: profile } = await supabase
      .from('profiles')
      .select('player_id, game_name, tag_line, region, last_compiled_at')
      .eq('player_id', playerId)
      .single()

    if (profile?.last_compiled_at) {
      const age = Date.now() - new Date(profile.last_compiled_at).getTime()
      if (age < COOLDOWN_MS) {
        return respond([profile], 200)
      }
    }

    // 4. Cache miss or stale → invoke compile-profile and wait
    const { error: compileErr } = await supabase.functions.invoke('compile-profile', {
      body: { playerId, region, gameName: account.gameName, tagLine: account.tagLine },
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
    })

    if (compileErr) throw new Error(`Compilation failed: ${compileErr.message}`)

    // 5. Return freshly compiled profile
    const { data: fresh } = await supabase
      .from('profiles')
      .select('player_id, game_name, tag_line, region, last_compiled_at')
      .eq('player_id', playerId)
      .single()

    return respond(fresh ? [fresh] : [], 200)

  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
