import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { addFavorite, removeFavorite, isFavorite } from '../../lib/storage'
import { REGIONS } from '../../constants/regions'
import { theme } from '../../constants/theme'
import type { Region } from '../../types'


interface RankedEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

interface ProfileData {
  ranked_data: RankedEntry[] | null
  last_compiled_at: string | null
}

interface AnalyticsRow {
  queue_type: string
  total_games: number
  wins: number
  champion_stats: Record<string, { games: number; wins: number; kills: number; deaths: number; assists: number }>
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatRank(entry: RankedEntry): string {
  const tierCased = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(entry.tier)) return tierCased
  return `${tierCased} ${entry.rank}`
}

export default function ProfileScreen() {
  const { playerId, region, gameName, tagLine } = useLocalSearchParams<{
    playerId: string
    region: string
    gameName: string
    tagLine: string
  }>()

  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([])
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear()
      const [{ data: p }, { data: a }, fav] = await Promise.all([
        supabase
          .from('profiles')
          .select('ranked_data, last_compiled_at')
          .eq('player_id', playerId)
          .single(),
        supabase
          .from('analytics_cache')
          .select('queue_type, total_games, wins, champion_stats')
          .eq('player_id', playerId)
          .eq('season', `S${currentYear}`),
        isFavorite(playerId),
      ])
      setProfile(p as ProfileData | null)
      setAnalytics((a ?? []) as AnalyticsRow[])
      setFavorited(fav)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const { error: fnErr } = await supabase.functions.invoke('search-profile', {
        body: { gameName, tagLine, region },
      })
      if (fnErr) {
        const body = await (fnErr as { context?: Response }).context?.json().catch(() => null)
        throw new Error(body?.error ?? fnErr.message)
      }
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const toggleFavorite = async () => {
    if (favorited) {
      await removeFavorite(playerId)
    } else {
      await addFavorite({
        player_id: playerId,
        game_name: gameName,
        tag_line: tagLine,
        region: region as Region,
        last_compiled_at: profile?.last_compiled_at ?? null,
      })
    }
    setFavorited(!favorited)
  }

  const canRefresh = true

  const rankedData = Array.isArray(profile?.ranked_data) ? profile.ranked_data : []
  const soloEntry = rankedData.find((e) => e.queueType === 'RANKED_SOLO_5x5')
  const flexEntry = rankedData.find((e) => e.queueType === 'RANKED_FLEX_SR')
  const soloAnalytics = analytics.find((a) => a.queue_type === 'RANKED_SOLO_5x5')

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title: `${gameName}#${tagLine}` }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>
            {gameName}<Text style={styles.tag}>#{tagLine}</Text>
          </Text>
          <View style={styles.regionBadge}>
            <Text style={styles.regionBadgeText}>{regionLabel}</Text>
          </View>
        </View>

        {/* Ranked Cards */}
        <View style={styles.rankedRow}>
          <RankedCard label="Solo / Duo" entry={soloEntry} />
          <RankedCard label="Flex" entry={flexEntry} />
        </View>

        {/* Season Stats */}
        {soloAnalytics && soloAnalytics.total_games > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              S{new Date().getFullYear()} Ranked Solo
            </Text>
            <View style={styles.statsRow}>
              <StatBox label="Games" value={String(soloAnalytics.total_games)} />
              <StatBox label="Wins" value={String(soloAnalytics.wins)} />
              <StatBox
                label="Losses"
                value={String(soloAnalytics.total_games - soloAnalytics.wins)}
              />
              <StatBox
                label="Win Rate"
                value={`${Math.round((soloAnalytics.wins / soloAnalytics.total_games) * 100)}%`}
                highlight
              />
            </View>
          </View>
        )}

        {/* Not compiled yet */}
        {!profile?.last_compiled_at && (
          <View style={styles.uncompiled}>
            <Text style={styles.uncompiledTitle}>No data yet</Text>
            <Text style={styles.uncompiledSub}>
              Press Refresh to compile this profile.
            </Text>
          </View>
        )}

        {error !== null && <Text style={styles.error}>{error}</Text>}

        {/* Actions */}
        <View style={styles.actions}>
          {profile?.last_compiled_at && (
            <Text style={styles.lastUpdated}>
              Updated {formatTimeAgo(profile.last_compiled_at)}
            </Text>
          )}

          <Pressable
            style={[styles.refreshButton, (!canRefresh || refreshing) && styles.buttonDisabled]}
            onPress={handleRefresh}
            disabled={!canRefresh || refreshing}
          >
            {refreshing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.refreshButtonText}>
                  Refresh
                </Text>}
          </Pressable>

          <Pressable
            style={[styles.favoriteButton, favorited && styles.favoriteButtonActive]}
            onPress={toggleFavorite}
          >
            <Text style={[styles.favoriteButtonText, favorited && styles.favoriteButtonTextActive]}>
              {favorited ? '★ Saved' : '☆ Save'}
            </Text>
          </Pressable>
        </View>

        {/* Season Statistics placeholder */}
        <Pressable style={styles.statsLink} disabled>
          <Text style={styles.statsLinkText}>Season Statistics</Text>
          <Text style={styles.statsLinkSub}>Coming in Sprint 3</Text>
        </Pressable>

      </ScrollView>
    </>
  )
}

function RankedCard({ label, entry }: { label: string; entry?: RankedEntry }) {
  const wr = entry
    ? Math.round((entry.wins / Math.max(entry.wins + entry.losses, 1)) * 100)
    : 0
  return (
    <View style={styles.rankedCard}>
      <Text style={styles.rankedLabel}>{label}</Text>
      {entry ? (
        <>
          <Text style={styles.rankedTier}>{formatRank(entry)}</Text>
          <Text style={styles.rankedLP}>{entry.leaguePoints} LP</Text>
          <Text style={styles.rankedRecord}>{entry.wins}W {entry.losses}L</Text>
          <Text style={styles.rankedWR}>{wr}% WR</Text>
        </>
      ) : (
        <Text style={styles.unranked}>Unranked</Text>
      )}
    </View>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },

  header: { marginBottom: 20 },
  name: { fontSize: 26, fontWeight: '700', color: theme.textPrimary },
  tag: { color: theme.textMuted, fontWeight: '400' },
  regionBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#FEF9EC',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  regionBadgeText: { color: theme.accentDark, fontSize: 12, fontWeight: '600' },

  rankedRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  rankedCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 3,
  },
  rankedLabel: {
    color: theme.accentDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rankedTier: { color: theme.textPrimary, fontSize: 16, fontWeight: '700' },
  rankedLP: { color: theme.textSecondary, fontSize: 13 },
  rankedRecord: { color: theme.textSecondary, fontSize: 12 },
  rankedWR: { color: theme.accent, fontSize: 12, fontWeight: '600' },
  unranked: { color: theme.textMuted, fontSize: 14, marginTop: 6 },

  section: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.accentDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.textPrimary, fontSize: 18, fontWeight: '700' },
  statValueHighlight: { color: theme.accent },
  statLabel: { color: theme.textMuted, fontSize: 11, marginTop: 2 },

  uncompiled: { alignItems: 'center', paddingVertical: 40 },
  uncompiledTitle: { color: theme.textSecondary, fontSize: 15, fontWeight: '600', marginBottom: 6 },
  uncompiledSub: { color: theme.textMuted, fontSize: 13 },

  error: { color: theme.error, fontSize: 13, marginBottom: 12 },

  actions: { gap: 10, marginBottom: 20 },
  lastUpdated: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  refreshButton: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.4 },

  favoriteButton: {
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  favoriteButtonActive: { borderColor: theme.accent, backgroundColor: '#FEF9EC' },
  favoriteButtonText: { color: theme.textSecondary, fontWeight: '600', fontSize: 15 },
  favoriteButtonTextActive: { color: theme.accentDark },

  statsLink: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    opacity: 0.5,
  },
  statsLinkText: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },
  statsLinkSub: { color: theme.textMuted, fontSize: 11 },
})
