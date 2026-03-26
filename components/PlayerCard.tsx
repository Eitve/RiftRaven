import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { theme } from '../constants/theme'
import { REGIONS } from '../constants/regions'
import type { SearchResult } from '../types'

interface Props {
  result: SearchResult
  onPress: () => void
}

export function PlayerCard({ result, onPress }: Props) {
  const regionLabel = REGIONS.find((r) => r.value === result.region)?.label ?? result.region

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {result.game_name}
          <Text style={styles.tag}>#{result.tag_line}</Text>
        </Text>
        <Text style={styles.meta}>{regionLabel}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  cardPressed: { backgroundColor: theme.separator },
  left: { flex: 1 },
  name: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  tag: { color: theme.textMuted, fontWeight: '400' },
  meta: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  chevron: { color: theme.textMuted, fontSize: 20, marginLeft: 8 },
})
