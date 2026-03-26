import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Region, SearchResult } from '../types'

const FAVORITES_KEY = 'riftraven_favorites'
const DEFAULT_REGION_KEY = 'riftraven_default_region'

export async function getFavorites(): Promise<SearchResult[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY)
  return raw ? (JSON.parse(raw) as SearchResult[]) : []
}

export async function addFavorite(profile: SearchResult): Promise<void> {
  const favorites = await getFavorites()
  if (favorites.some((f) => f.player_id === profile.player_id)) return
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites, profile]))
}

export async function removeFavorite(playerId: string): Promise<void> {
  const favorites = await getFavorites()
  await AsyncStorage.setItem(
    FAVORITES_KEY,
    JSON.stringify(favorites.filter((f) => f.player_id !== playerId)),
  )
}

export async function isFavorite(playerId: string): Promise<boolean> {
  const favorites = await getFavorites()
  return favorites.some((f) => f.player_id === playerId)
}

export async function getDefaultRegion(): Promise<Region | null> {
  const val = await AsyncStorage.getItem(DEFAULT_REGION_KEY)
  return val as Region | null
}

export async function setDefaultRegion(region: Region): Promise<void> {
  await AsyncStorage.setItem(DEFAULT_REGION_KEY, region)
}
