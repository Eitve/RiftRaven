import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { REGIONS } from '../../constants/regions'

export default function ProfileScreen() {
  const { playerId, region, gameName, tagLine } = useLocalSearchParams<{
    playerId: string
    region: string
    gameName: string
    tagLine: string
  }>()

  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {gameName}
          <Text style={styles.tag}>#{tagLine}</Text>
        </Text>
        <Text style={styles.region}>{regionLabel}</Text>
        <Text style={styles.puuid} numberOfLines={1} ellipsizeMode="middle">
          {playerId}
        </Text>
      </View>

      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>Profile Data</Text>
        <Text style={styles.placeholderText}>
          Ranked info, match list, and refresh controls coming in Sprint 2.
        </Text>
      </View>

      {/* TODO Sprint 3: navigate to season stats screen */}
      <Pressable style={styles.statsButton} disabled>
        <Text style={styles.statsButtonText}>Season Statistics</Text>
        <Text style={styles.statsButtonSub}>Available in Sprint 3</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', padding: 16 },
  header: { marginBottom: 32 },
  name: { fontSize: 26, fontWeight: '700', color: '#fff' },
  tag: { color: '#555', fontWeight: '400' },
  region: { color: '#C89B3C', fontSize: 13, fontWeight: '600', marginTop: 4 },
  puuid: { color: '#2A2A2A', fontSize: 10, marginTop: 6 },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  placeholderTitle: { color: '#333', fontSize: 13, fontWeight: '600' },
  placeholderText: { color: '#2A2A2A', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  statsButton: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
    opacity: 0.4,
  },
  statsButtonText: { color: '#C89B3C', fontSize: 15, fontWeight: '600' },
  statsButtonSub: { color: '#555', fontSize: 11 },
})
