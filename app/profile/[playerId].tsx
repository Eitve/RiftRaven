import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image,
} from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { backfillHistory } from '../../lib/api'
import { addFavorite, removeFavorite, isFavorite } from '../../lib/storage'
import { REGIONS } from '../../constants/regions'
import { theme } from '../../constants/theme'
import { fetchChampionMap, getChampionImageUrl, type ChampionMap } from '../../lib/champions'
import { MatchRow } from '../../components/MatchRow'
import { fetchDuoStats, fetchFiveStackGroups, type DuoPartner, type FiveStackGroup } from '../../lib/duo-stats'
import type { Region, Match } from '../../types'


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
  profile_icon_id: number | null
  summoner_level: number | null
  history_complete: boolean | null
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
  const router = useRouter()
  const { playerId, region, gameName, tagLine } = useLocalSearchParams<{
    playerId: string
    region: string
    gameName: string
    tagLine: string
  }>()

  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region

  const [ddVersion, setDdVersion] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsRow[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [championMap, setChampionMap] = useState<ChampionMap>({})
  const [duoPartners, setDuoPartners] = useState<DuoPartner[]>([])
  const [fiveStacks, setFiveStacks] = useState<FiveStackGroup[]>([])
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const backfillRef = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear()
      const [{ data: p }, { data: a }, { data: m }, fav, versionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('ranked_data, last_compiled_at, profile_icon_id, summoner_level, history_complete')
          .eq('player_id', playerId)
          .single(),
        supabase
          .from('analytics_cache')
          .select('queue_type, total_games, wins, champion_stats')
          .eq('player_id', playerId)
          .eq('season', `S${currentYear}`),
        supabase
          .from('matches')
          .select('*')
          .eq('player_id', playerId)
          .order('match_timestamp', { ascending: false })
          .limit(20),
        isFavorite(playerId),
        fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json()).catch(() => null),
      ])
      setProfile(p as ProfileData | null)
      setAnalytics((a ?? []) as AnalyticsRow[])
      setMatches((m ?? []) as Match[])
      setFavorited(fav)
      if (Array.isArray(versionsRes) && versionsRes[0]) {
        setDdVersion(versionsRes[0])
        fetchChampionMap(versionsRes[0]).then(setChampionMap).catch(() => {})
      }
      // Fetch duo + five-stack stats (non-blocking)
      fetchDuoStats(playerId).then(setDuoPartners).catch(() => {})
      fetchFiveStackGroups(playerId).then(setFiveStacks).catch(() => {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [playerId])

  const startBackfill = useCallback(() => {
    if (backfillRef.current) return
    backfillRef.current = true
    setBackfilling(true)
    backfillHistory(playerId, region, (processed, hasMore) => {
      if (processed > 0) fetchData()
    })
      .catch(() => {})
      .finally(() => {
        backfillRef.current = false
        setBackfilling(false)
      })
  }, [playerId, region, fetchData])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-resume backfill on mount if history is incomplete
  useEffect(() => {
    if (profile && profile.last_compiled_at && profile.history_complete === false) {
      startBackfill()
    }
  }, [profile?.history_complete, profile?.last_compiled_at, startBackfill])

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshStatus('Compiling profile...')
    setError(null)
    try {
      const { error: fnErr } = await supabase.functions.invoke('compile-profile', {
        body: { playerId, region, gameName, tagLine },
      })
      if (fnErr) {
        const body = await (fnErr as { context?: Response }).context?.json().catch(() => null)
        throw new Error(body?.error ?? fnErr.message)
      }
      setRefreshStatus('Loading data...')
      await fetchData()
      startBackfill()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
      setRefreshStatus(null)
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

  const COOLDOWN_MS = 15 * 60 * 1000
  const lastCompiledMs = profile?.last_compiled_at
    ? new Date(profile.last_compiled_at).getTime()
    : 0
  const elapsed = Date.now() - lastCompiledMs
  const canRefresh = !profile?.last_compiled_at || elapsed >= COOLDOWN_MS
  const cooldownRemaining = canRefresh
    ? null
    : `${Math.ceil((COOLDOWN_MS - elapsed) / 60000)}m`

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
          {ddVersion && profile?.profile_icon_id ? (
            <Image
              source={{ uri: `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${profile.profile_icon_id}.png` }}
              style={styles.profileIcon}
            />
          ) : (
            <View style={[styles.profileIcon, styles.profileIconPlaceholder]} />
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.name}>
              {gameName}<Text style={styles.tag}>#{tagLine}</Text>
            </Text>
            <View style={styles.headerMeta}>
              <View style={styles.regionBadge}>
                <Text style={styles.regionBadgeText}>{regionLabel}</Text>
              </View>
              {profile?.summoner_level != null && (
                <Text style={styles.level}>Lv. {profile.summoner_level}</Text>
              )}
            </View>
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

        {/* Recent Matches */}
        {matches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Recent Matches
              {backfilling && (
                <Text style={styles.backfillHint}> · loading history...</Text>
              )}
            </Text>
            {matches.map((m) => {
              const champ = championMap[String(m.champion_id)]
              return (
                <MatchRow
                  key={m.match_id}
                  match={m}
                  championName={champ?.name ?? `#${m.champion_id}`}
                  championImageUrl={
                    ddVersion && champ
                      ? getChampionImageUrl(ddVersion, champ.id)
                      : null
                  }
                />
              )
            })}
          </View>
        )}

        {/* Frequent Teammates */}
        {duoPartners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Frequent Teammates</Text>
            {duoPartners.map((p) => {
              const wr = Math.round((p.wins_together / Math.max(p.games_together, 1)) * 100)
              return (
                <Pressable
                  key={p.partner_id}
                  style={styles.duoRow}
                  onPress={() => router.push({
                    pathname: '/profile/[playerId]',
                    params: {
                      playerId: p.partner_id,
                      region,
                      gameName: p.partner_name,
                      tagLine: '',
                    },
                  })}
                >
                  <Text style={styles.duoName} numberOfLines={1}>{p.partner_name}</Text>
                  <Text style={styles.duoGames}>{p.games_together} games</Text>
                  <Text style={[styles.duoWR, wr >= 50 && styles.duoWRGood]}>{wr}% WR</Text>
                </Pressable>
              )
            })}
          </View>
        )}

        {/* Likely Premade Groups (five-stacks) */}
        {fiveStacks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Likely Premade Groups</Text>
            {fiveStacks.map((group, i) => {
              const names = group.teammate_names.split(',')
              const wr = Math.round((group.wins_together / Math.max(group.games_together, 1)) * 100)
              return (
                <View key={i} style={styles.stackRow}>
                  <Text style={styles.stackNames} numberOfLines={2}>
                    {names.join(', ')}
                  </Text>
                  <Text style={styles.duoGames}>{group.games_together} games</Text>
                  <Text style={[styles.duoWR, wr >= 50 && styles.duoWRGood]}>{wr}% WR</Text>
                </View>
              )
            })}
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
            {refreshing ? (
              <View style={styles.refreshingRow}>
                <ActivityIndicator color="#fff" size="small" />
                {refreshStatus && <Text style={styles.refreshStatusText}>{refreshStatus}</Text>}
              </View>
            ) : (
              <Text style={styles.refreshButtonText}>
                {canRefresh ? 'Refresh' : `Refresh (${cooldownRemaining})`}
              </Text>
            )}
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

        {/* Season Statistics */}
        <Pressable
          style={styles.statsLink}
          onPress={() => router.push({
            pathname: '/season/[playerId]',
            params: { playerId, gameName, tagLine, region },
          })}
        >
          <Text style={styles.statsLinkText}>Season Statistics →</Text>
        </Pressable>

      </ScrollView>
    </>
  )
}

const TIER_COLORS: Record<string, string> = {
  IRON: '#8D8589', BRONZE: '#A6724B', SILVER: '#80989D', GOLD: '#C89B3C',
  PLATINUM: '#0BC4B4', EMERALD: '#1E7F4E', DIAMOND: '#576BCE',
  MASTER: '#9D48E0', GRANDMASTER: '#D4402C', CHALLENGER: '#F4C874',
}

function RankedCard({ label, entry }: { label: string; entry?: RankedEntry }) {
  const [imgFailed, setImgFailed] = useState(false)
  const wr = entry
    ? Math.round((entry.wins / Math.max(entry.wins + entry.losses, 1)) * 100)
    : 0
  const tierLower = entry?.tier.toLowerCase()
  // Community Dragon hosts ranked mini-crests publicly
  const emblemUri = tierLower
    ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${tierLower}.png`
    : null
  const tierColor = entry ? (TIER_COLORS[entry.tier] ?? theme.textMuted) : theme.textMuted

  return (
    <View style={styles.rankedCard}>
      <Text style={styles.rankedLabel}>{label}</Text>
      {entry ? (
        <>
          {emblemUri && !imgFailed ? (
            <Image
              source={{ uri: emblemUri }}
              style={styles.emblem}
              resizeMode="contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={[styles.emblemFallback, { backgroundColor: tierColor }]}>
              <Text style={styles.emblemFallbackText}>{entry.tier.slice(0, 2)}</Text>
            </View>
          )}
          <Text style={[styles.rankedTier, { color: tierColor }]}>{formatRank(entry)}</Text>
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

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  profileIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: theme.accent },
  profileIconPlaceholder: { backgroundColor: theme.border },
  headerInfo: { flex: 1 },
  name: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  tag: { color: theme.textMuted, fontWeight: '400' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  regionBadge: {
    backgroundColor: theme.accentBg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  regionBadgeText: { color: theme.accentDark, fontSize: 12, fontWeight: '600' },
  level: { color: theme.textSecondary, fontSize: 12 },

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
  emblem: { width: 64, height: 64, alignSelf: 'center', marginVertical: 4 },
  emblemFallback: {
    width: 56, height: 56, borderRadius: 28, alignSelf: 'center',
    marginVertical: 6, alignItems: 'center', justifyContent: 'center',
  },
  emblemFallbackText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  rankedTier: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  rankedLP: { color: theme.textSecondary, fontSize: 13, textAlign: 'center' },
  rankedRecord: { color: theme.textSecondary, fontSize: 12, textAlign: 'center' },
  rankedWR: { color: theme.accent, fontSize: 12, fontWeight: '600', textAlign: 'center' },
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
  backfillHint: { color: theme.textMuted, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.textPrimary, fontSize: 18, fontWeight: '700' },
  statValueHighlight: { color: theme.accent },
  statLabel: { color: theme.textMuted, fontSize: 11, marginTop: 2 },

  duoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
    gap: 8,
  },
  duoName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  duoGames: { color: theme.textSecondary, fontSize: 13, width: 70, textAlign: 'right' },
  duoWR: { color: theme.textSecondary, fontSize: 13, width: 50, textAlign: 'right' },
  duoWRGood: { color: theme.success },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
    gap: 8,
  },
  stackNames: { color: theme.textPrimary, fontSize: 12, flex: 1 },

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
  refreshingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshStatusText: { color: '#fff', fontSize: 13, fontWeight: '500' },
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
  favoriteButtonActive: { borderColor: theme.accent, backgroundColor: theme.accentBg },
  favoriteButtonText: { color: theme.textSecondary, fontWeight: '600', fontSize: 15 },
  favoriteButtonTextActive: { color: theme.accentDark },

  statsLink: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 16,
    alignItems: 'center',
  },
  statsLinkText: { color: theme.accent, fontSize: 14, fontWeight: '600' },
})
