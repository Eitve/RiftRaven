import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image,
} from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { theme } from '../../constants/theme'
import { fetchChampionMap, getChampionImageUrl, type ChampionMap } from '../../lib/champions'

const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: 'Ranked Solo',
  RANKED_FLEX_SR: 'Ranked Flex',
  NORMAL_DRAFT: 'Normal Draft',
  NORMAL_BLIND: 'Normal Blind',
  ARAM: 'ARAM',
  URF: 'URF',
  ONE_FOR_ALL: 'One for All',
  ULTIMATE_SPELLBOOK: 'Ultimate Spellbook',
}

interface ChampStat {
  games: number
  wins: number
  kills: number
  deaths: number
  assists: number
}

interface AnalyticsRow {
  season: string
  queue_type: string
  total_games: number
  wins: number
  champion_stats: Record<string, ChampStat>
  role_distribution: Record<string, number>
}

export default function SeasonStatsScreen() {
  const { playerId, gameName, tagLine } = useLocalSearchParams<{
    playerId: string
    gameName: string
    tagLine: string
  }>()

  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [championMap, setChampionMap] = useState<ChampionMap>({})
  const [ddVersion, setDdVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [{ data }, versionsRes] = await Promise.all([
        supabase
          .from('analytics_cache')
          .select('season, queue_type, total_games, wins, champion_stats, role_distribution')
          .eq('player_id', playerId)
          .order('season', { ascending: false }),
        fetch('https://ddragon.leagueoflegends.com/api/versions.json')
          .then((r) => r.json())
          .catch(() => null),
      ])
      setRows((data ?? []) as AnalyticsRow[])
      if (Array.isArray(versionsRes) && versionsRes[0]) {
        setDdVersion(versionsRes[0])
        fetchChampionMap(versionsRes[0]).then(setChampionMap).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }, [playerId])

  useEffect(() => { fetchData() }, [fetchData])

  // Group rows: season → queue rows
  const grouped = rows.reduce<Record<string, AnalyticsRow[]>>((acc, row) => {
    acc[row.season] ??= []
    acc[row.season].push(row)
    return acc
  }, {})
  const seasons = Object.keys(grouped).sort().reverse()

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
        {seasons.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No season data compiled yet.</Text>
          </View>
        )}

        {seasons.map((season) => (
          <View key={season}>
            <Text style={styles.seasonHeader}>{season}</Text>

            {grouped[season].map((row) => {
              const losses = row.total_games - row.wins
              const wr = Math.round((row.wins / Math.max(row.total_games, 1)) * 100)

              const topChamps = Object.entries(row.champion_stats)
                .map(([id, s]) => {
                  const info = championMap[id]
                  return { id, name: info?.name ?? `#${id}`, ddId: info?.id ?? null, ...s }
                })
                .sort((a, b) => b.games - a.games)
                .slice(0, 10)

              const totalRoleGames = Object.values(row.role_distribution).reduce((s, n) => s + n, 0)
              const roleRows = Object.entries(row.role_distribution).sort((a, b) => b[1] - a[1])

              return (
                <View key={row.queue_type} style={styles.queueBlock}>
                  <Text style={styles.queueLabel}>
                    {QUEUE_LABELS[row.queue_type] ?? row.queue_type}
                  </Text>

                  {/* Overview */}
                  <View style={styles.statsRow}>
                    <StatBox label="Games" value={String(row.total_games)} />
                    <StatBox label="Wins" value={String(row.wins)} />
                    <StatBox label="Losses" value={String(losses)} />
                    <StatBox label="Win Rate" value={`${wr}%`} highlight />
                  </View>

                  {/* Top Champions */}
                  {topChamps.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subTitle}>Top Champions</Text>
                      {topChamps.map((c, i) => {
                        const kda = ((c.kills + c.assists) / Math.max(c.deaths, 1)).toFixed(2)
                        const cwr = Math.round((c.wins / c.games) * 100)
                        return (
                          <View key={c.id} style={[styles.champRow, i > 0 && styles.champRowBorder]}>
                            <Text style={styles.champRank}>{i + 1}</Text>
                            {ddVersion && c.ddId ? (
                              <Image
                                source={{ uri: getChampionImageUrl(ddVersion, c.ddId) }}
                                style={styles.champIcon}
                              />
                            ) : (
                              <View style={[styles.champIcon, styles.champIconPlaceholder]} />
                            )}
                            <Text style={styles.champName} numberOfLines={1}>{c.name}</Text>
                            <Text style={styles.champGames}>{c.games}G</Text>
                            <Text style={[styles.champWR, cwr >= 50 && styles.champWRGood]}>{cwr}%</Text>
                            <Text style={styles.champKDA}>{kda} KDA</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}

                  {/* Role Distribution */}
                  {roleRows.length > 0 && (
                    <View style={styles.subSection}>
                      <Text style={styles.subTitle}>Roles</Text>
                      {roleRows.map(([role, count]) => {
                        const pct = Math.round((count / Math.max(totalRoleGames, 1)) * 100)
                        return (
                          <View key={role} style={styles.roleRow}>
                            <Text style={styles.roleLabel}>{role}</Text>
                            <View style={styles.roleBarBg}>
                              <View style={[styles.roleBar, { width: `${pct}%` }]} />
                            </View>
                            <Text style={styles.rolePct}>{pct}%</Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ))}
      </ScrollView>
    </>
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
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: theme.textMuted, fontSize: 14 },

  seasonHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 8,
    marginBottom: 10,
  },

  queueBlock: {
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 12,
  },
  queueLabel: {
    color: theme.accentDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: theme.textPrimary, fontSize: 18, fontWeight: '700' },
  statValueHighlight: { color: theme.accent },
  statLabel: { color: theme.textMuted, fontSize: 11, marginTop: 2 },

  subSection: { marginTop: 14 },
  subTitle: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  champRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 8 },
  champRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
  champRank: { color: theme.textMuted, fontSize: 12, width: 18, textAlign: 'center' },
  champIcon: { width: 28, height: 28, borderRadius: 4 },
  champIconPlaceholder: { backgroundColor: theme.border },
  champName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  champGames: { color: theme.textSecondary, fontSize: 13, width: 36, textAlign: 'right' },
  champWR: { color: theme.textSecondary, fontSize: 13, width: 40, textAlign: 'right' },
  champWRGood: { color: theme.success },
  champKDA: { color: theme.textMuted, fontSize: 12, width: 64, textAlign: 'right' },

  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  roleLabel: { color: theme.textSecondary, fontSize: 12, width: 80 },
  roleBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: theme.separator,
    borderRadius: 3,
    overflow: 'hidden',
  },
  roleBar: { height: 6, backgroundColor: theme.accent, borderRadius: 3 },
  rolePct: { color: theme.textMuted, fontSize: 12, width: 36, textAlign: 'right' },
})
