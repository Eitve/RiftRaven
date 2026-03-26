import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import Constants from 'expo-constants'

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Text style={styles.legal}>
          RiftRaven is not endorsed by Riot Games and does not reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing League of Legends.
          League of Legends and Riot Games are trademarks or registered trademarks of Riot Games,
          Inc. League of Legends © Riot Games, Inc.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { padding: 16 },
  section: { marginBottom: 32 },
  sectionTitle: {
    color: '#C89B3C',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  label: { color: '#ccc', fontSize: 15 },
  value: { color: '#666', fontSize: 15 },
  legal: { color: '#444', fontSize: 12, lineHeight: 19 },
})
