import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { theme } from '../constants/theme'

const QUEUE_LABELS: Record<string, string> = {
  RANKED_SOLO_5x5: 'Solo/Duo',
  RANKED_FLEX_SR: 'Flex',
  NORMAL_DRAFT: 'Draft',
  NORMAL_BLIND: 'Blind',
  ARAM: 'ARAM',
  URF: 'URF',
  ONE_FOR_ALL: 'OFA',
  ULTIMATE_SPELLBOOK: 'Spellbook',
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface MatchRowProps {
  match: {
    match_id: string
    win: boolean
    kills: number
    deaths: number
    assists: number
    champion_id: number
    queue_type: string
    game_duration: number
    match_timestamp: string
  }
  championName: string
  championImageUrl: string | null
}

export function MatchRow({ match, championName, championImageUrl }: MatchRowProps) {
  const kda = `${match.kills}/${match.deaths}/${match.assists}`
  const kdaRatio = ((match.kills + match.assists) / Math.max(match.deaths, 1)).toFixed(1)
  const queueLabel = QUEUE_LABELS[match.queue_type] ?? match.queue_type

  return (
    <View style={[styles.row, match.win ? styles.rowWin : styles.rowLoss]}>
      {championImageUrl ? (
        <Image source={{ uri: championImageUrl }} style={styles.champIcon} />
      ) : (
        <View style={[styles.champIcon, styles.champIconPlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.champName} numberOfLines={1}>{championName}</Text>
        <Text style={styles.meta}>{queueLabel} · {formatDuration(match.game_duration)}</Text>
      </View>
      <View style={styles.kdaCol}>
        <Text style={styles.kda}>{kda}</Text>
        <Text style={styles.kdaRatio}>{kdaRatio} KDA</Text>
      </View>
      <View style={styles.rightCol}>
        <Text style={[styles.result, match.win ? styles.resultWin : styles.resultLoss]}>
          {match.win ? 'W' : 'L'}
        </Text>
        <Text style={styles.timeAgo}>{formatTimeAgo(match.match_timestamp)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  rowWin: { borderLeftColor: theme.success },
  rowLoss: { borderLeftColor: theme.error },
  champIcon: { width: 36, height: 36, borderRadius: 6 },
  champIconPlaceholder: { backgroundColor: theme.border },
  info: { flex: 1 },
  champName: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  meta: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  kdaCol: { alignItems: 'center', width: 70 },
  kda: { color: theme.textPrimary, fontSize: 13, fontWeight: '600' },
  kdaRatio: { color: theme.textMuted, fontSize: 11 },
  rightCol: { alignItems: 'center', width: 40 },
  result: { fontSize: 14, fontWeight: '800' },
  resultWin: { color: theme.success },
  resultLoss: { color: theme.error },
  timeAgo: { color: theme.textMuted, fontSize: 10, marginTop: 2 },
})
