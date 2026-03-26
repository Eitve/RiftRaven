export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const QUEUE_NAMES: Record<number, string> = {
  420: 'RANKED_SOLO_5x5',
  440: 'RANKED_FLEX_SR',
  400: 'NORMAL_DRAFT',
  430: 'NORMAL_BLIND',
  450: 'ARAM',
  900: 'URF',
  1020: 'ONE_FOR_ALL',
  1400: 'ULTIMATE_SPELLBOOK',
}

export function getRegionalRoute(platform: string): string {
  if (['NA1', 'BR1', 'LA1', 'LA2'].includes(platform)) return 'americas'
  if (['KR', 'JP1'].includes(platform)) return 'asia'
  if (['OC1', 'PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(platform)) return 'sea'
  return 'europe'
}

/** Fetch with automatic 429 retry */
export async function riotFetch(url: string, apiKey: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'X-Riot-Token': apiKey } })
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 2)
    await delay(retryAfter * 1000)
    return riotFetch(url, apiKey)
  }
  return res
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
