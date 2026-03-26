import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SearchBar } from '../../components/SearchBar'
import { RegionPicker } from '../../components/RegionPicker'
import { PlayerCard } from '../../components/PlayerCard'
import { supabase } from '../../lib/supabase'
import { searchProfile } from '../../lib/api'
import { parseRiotId, validateGameName, validateTagLine } from '../../lib/validation'
import { DEFAULT_REGION } from '../../constants/regions'
import type { Region, SearchResult } from '../../types'

export default function SearchScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback(async (text: string, currentRegion: Region) => {
    if (!text.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setInFlight(true)
    setError(null)

    try {
      const parsed = parseRiotId(text.trim())
      const searchName = parsed ? parsed.gameName : text.trim()

      // 1. Local-first: query Supabase profiles table instantly
      const { data: local, error: dbErr } = await supabase
        .from('profiles')
        .select('player_id, game_name, tag_line, region, last_compiled_at')
        .ilike('game_name', `%${searchName}%`)
        .eq('region', currentRegion)
        .limit(10)

      if (dbErr) throw dbErr

      const localResults = (local ?? []) as SearchResult[]
      setResults(localResults)

      // 2. If Name#Tag entered and no exact local match → call search-profile Edge Function
      if (parsed && validateGameName(parsed.gameName) && validateTagLine(parsed.tagLine)) {
        const exactMatch = localResults.find(
          (r) =>
            r.game_name.toLowerCase() === parsed.gameName.toLowerCase() &&
            r.tag_line.toLowerCase() === parsed.tagLine.toLowerCase(),
        )

        if (!exactMatch) {
          const apiResults = await searchProfile(parsed.gameName, parsed.tagLine, currentRegion)
          setResults((prev) => {
            const merged = [...prev, ...apiResults]
            // Deduplicate by player_id
            return merged.filter(
              (r, i, arr) => arr.findIndex((x) => x.player_id === r.player_id) === i,
            )
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Try again.')
      setResults([])
    } finally {
      setLoading(false)
      setInFlight(false)
    }
  }, [])

  const handleQueryChange = (text: string) => {
    setQuery(text)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!text.trim()) {
      setResults([])
      setError(null)
      return
    }
    debounceTimer.current = setTimeout(() => performSearch(text, region), 300)
  }

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion)
    if (query.trim()) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => performSearch(query, newRegion), 300)
    }
  }

  const handleResultPress = (result: SearchResult) => {
    router.push({
      pathname: '/profile/[playerId]',
      params: {
        playerId: result.player_id,
        region: result.region,
        gameName: result.game_name,
        tagLine: result.tag_line,
      },
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inputRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar value={query} onChangeText={handleQueryChange} disabled={inFlight} />
        </View>
        <RegionPicker value={region} onChange={handleRegionChange} disabled={inFlight} />
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator style={styles.spinner} color="#C89B3C" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.player_id}
          renderItem={({ item }) => (
            <PlayerCard result={item} onPress={() => handleResultPress(item)} />
          )}
          ListEmptyComponent={
            query.trim() && !loading ? (
              <Text style={styles.empty}>No players found</Text>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 16, paddingHorizontal: 16 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBarWrapper: { flex: 1 },
  error: { color: '#E84057', marginBottom: 8, fontSize: 13 },
  spinner: { marginTop: 32 },
  empty: { color: '#444', textAlign: 'center', marginTop: 48, fontSize: 14 },
})
