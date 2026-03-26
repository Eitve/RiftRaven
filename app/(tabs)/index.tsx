import React, { useState, useCallback } from 'react'
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

  const performSearch = useCallback(async (text: string, currentRegion: Region) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const parsed = parseRiotId(trimmed)
      const searchName = parsed ? parsed.gameName : trimmed

      // 1. Local-first: query profiles table instantly
      const { data: local, error: dbErr } = await supabase
        .from('profiles')
        .select('player_id, game_name, tag_line, region, last_compiled_at')
        .ilike('game_name', `%${searchName}%`)
        .eq('region', currentRegion)
        .limit(10)

      if (dbErr) throw dbErr

      const localResults = (local ?? []) as SearchResult[]
      setResults(localResults)

      // 2. If Name#Tag entered and no exact local match → call Edge Function
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
    }
  }, [])

  const handleSearch = () => performSearch(query, region)

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
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={handleSearch}
          />
        </View>
        <RegionPicker value={region} onChange={setRegion} disabled={loading} />
      </View>

      <Pressable
        style={[styles.searchButton, loading && styles.searchButtonDisabled]}
        onPress={handleSearch}
        disabled={loading || !query.trim()}
      >
        {loading
          ? <ActivityIndicator color="#0A0A0A" size="small" />
          : <Text style={styles.searchButtonText}>Search</Text>
        }
      </Pressable>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(r) => r.player_id}
        renderItem={({ item }) => (
          <PlayerCard result={item} onPress={() => handleResultPress(item)} />
        )}
        ListEmptyComponent={
          !loading && results.length === 0 && query.trim() ? (
            <Text style={styles.empty}>No players found</Text>
          ) : null
        }
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 16, paddingHorizontal: 16 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchBarWrapper: { flex: 1 },
  searchButton: {
    backgroundColor: '#C89B3C',
    borderRadius: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  searchButtonDisabled: { opacity: 0.5 },
  searchButtonText: { color: '#0A0A0A', fontWeight: '700', fontSize: 15 },
  error: { color: '#E84057', marginBottom: 8, fontSize: 13 },
  list: { flex: 1 },
  empty: { color: '#444', textAlign: 'center', marginTop: 48, fontSize: 14 },
})
