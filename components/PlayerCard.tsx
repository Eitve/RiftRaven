import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { SearchResult } from '../types'
import { REGIONS } from '../constants/regions'

interface Props {
  result: SearchResult
  onPress: () => void
}

export function PlayerCard({ result, onPress }: Props) {
  const regionLabel = REGIONS.find((r) => r.value === result.region)?.label ?? result.region
  const cached = result.last_compiled_at !== null

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
        <Text style={styles.meta}>
          {regionLabel}
          {cached ? ' · cached' : ' · not compiled yet'}
        </Text>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  cardPressed: {
    backgroundColor: '#111',
  },
  left: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  tag: {
    color: '#666',
    fontWeight: '400',
  },
  meta: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: '#444',
    fontSize: 20,
    marginLeft: 8,
  },
})
