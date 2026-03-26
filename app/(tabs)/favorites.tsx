import React, { useState, useCallback } from 'react'
import { View, FlatList, Text, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { PlayerCard } from '../../components/PlayerCard'
import { getFavorites } from '../../lib/storage'
import { theme } from '../../constants/theme'
import type { SearchResult } from '../../types'

export default function FavoritesScreen() {
  const router = useRouter()
  const [favorites, setFavorites] = useState<SearchResult[]>([])

  // Reload favorites whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      getFavorites().then(setFavorites)
    }, []),
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(f) => f.player_id}
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
          <Text style={styles.empty}>
            No favorites saved yet.{'\n'}Search for a player and save them here.
          </Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  empty: {
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 80,
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 32,
  },
})
