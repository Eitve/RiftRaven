import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, FlatList, Text, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SearchBar } from '../../components/SearchBar'
import { RegionPicker } from '../../components/RegionPicker'
import { PlayerCard } from '../../components/PlayerCard'
import { supabase } from '../../lib/supabase'
import { searchProfile } from '../../lib/api'
import { parseRiotId, validateGameName, validateTagLine } from '../../lib/validation'
import { DEFAULT_REGION } from '../../constants/regions'
import { theme } from '../../constants/theme'
import type { Region, SearchResult } from '../../types'

export default function SearchScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback(async (text: string, currentRegion: Region) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const parsed = parseRiotId(trimmed)
      const searchName = parsed ? parsed.gameName : trimmed

      const { data: local, error: dbErr } = await supabase
        .from('profiles')
        .select('player_id, game_name, tag_line, region, last_compiled_at')
        .ilike('game_name', `%${searchName}%`)
        .eq('region', currentRegion)
        .limit(10)

      if (dbErr) throw dbErr

      const localResults = (local ?? []) as SearchResult[]
      setResults(localResults)

      if (parsed && validateGameName(parsed.gameName) && parsed.tagLine.length >= 2) {
        const exactMatch = localResults.find(
          (r) =>
            r.game_name.toLowerCase() === parsed.gameName.toLowerCase() &&
            r.tag_line.toLowerCase() === parsed.tagLine.toLowerCase(),
        )
        if (!exactMatch) {
          const apiResults = await searchProfile(parsed.gameName, parsed.tagLine, currentRegion)
          setResults((prev) => {
            const merged = [...prev, ...apiResults]
            return merged.filter((r, i, arr) => arr.findIndex((x) => x.player_id === r.player_id) === i)
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

  const scheduleSearch = useCallback((text: string, currentRegion: Region) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => performSearch(text, currentRegion), 1000)
  }, [performSearch])

  const handleQueryChange = (text: string) => {
    setQuery(text)
    scheduleSearch(text, region)
  }

  const handleRegionChange = (r: Region) => {
    setRegion(r)
    scheduleSearch(query, r)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>RiftRaven</Text>
        <Text style={styles.subtitle}>League of Legends Player Search</Text>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={query}
            onChangeText={handleQueryChange}
            onSubmit={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              performSearch(query, region)
            }}
            loading={loading}
          />
        </View>
        <RegionPicker value={region} onChange={handleRegionChange} disabled={loading} />
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={results}
        keyExtractor={(r) => r.player_id}
        renderItem={({ item }) => (
          <PlayerCard
            result={item}
            onPress={() =>
              router.push({
                pathname: '/profile/[playerId]',
                params: {
                  playerId: item.player_id,
                  region: item.region,
                  gameName: item.game_name,
                  tagLine: item.tag_line,
                },
              })
            }
          />
        )}
        ListEmptyComponent={
          !loading && query.trim()
            ? <Text style={styles.empty}>No players found</Text>
            : !query.trim()
            ? <Text style={styles.hint}>Type a summoner name to search{'\n'}e.g. Faker#T1</Text>
            : null
        }
        keyboardShouldPersistTaps="handled"
        style={styles.list}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, paddingTop: 20, paddingHorizontal: 16 },
  header: { marginBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: theme.accent, letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: theme.textMuted, marginTop: 3 },
  inputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchBarWrapper: { flex: 1 },
  error: { color: theme.error, marginBottom: 8, fontSize: 13 },
  list: { flex: 1 },
  empty: { color: theme.textMuted, textAlign: 'center', marginTop: 48, fontSize: 14 },
  hint: { color: theme.textMuted, textAlign: 'center', marginTop: 64, fontSize: 14, lineHeight: 22 },
})
