import React from 'react'
import { TextInput, StyleSheet, View, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../constants/theme'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSubmit?: () => void
  disabled?: boolean
  loading?: boolean
}

export function SearchBar({ value, onChangeText, onSubmit, disabled, loading }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={16} color={theme.textMuted} style={styles.icon} />
      <TextInput
        style={[styles.input, disabled && styles.disabled]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder="Faker#T1"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        editable={!disabled}
        returnKeyType="search"
      />
      {loading && <ActivityIndicator size="small" color={theme.accent} style={styles.spinner} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  icon: { marginRight: 8 },
  input: {
    flex: 1,
    height: 46,
    color: theme.textPrimary,
    fontSize: 15,
  },
  spinner: { marginLeft: 8 },
  disabled: { opacity: 0.5 },
})
