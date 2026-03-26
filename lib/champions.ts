export interface ChampionInfo {
  name: string
  id: string // Data Dragon image key (e.g. "MonkeyKing" for Wukong)
}

export type ChampionMap = Record<string, ChampionInfo>

export async function fetchChampionMap(version: string): Promise<ChampionMap> {
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  )
  const json = (await res.json()) as {
    data: Record<string, { key: string; name: string; id: string }>
  }
  const map: ChampionMap = {}
  for (const champ of Object.values(json.data)) {
    map[champ.key] = { name: champ.name, id: champ.id }
  }
  return map
}

export function getChampionImageUrl(version: string, championDdId: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championDdId}.png`
}
