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
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{result.game_name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>
          {result.game_name}<Text style={styles.tag}>#{result.tag_line}</Text>
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
    padding: 14,
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  cardPressed: { opacity: 0.65 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: theme.accent, fontSize: 17, fontWeight: '700' },
  left: { flex: 1 },
  name: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  tag: { color: theme.textMuted, fontWeight: '400' },
  meta: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
  chevron: { color: theme.textMuted, fontSize: 22, marginLeft: 8 },
})
