import React from 'react'
import { TextInput, StyleSheet, View } from 'react-native'
import { theme } from '../constants/theme'

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSubmit?: () => void
  disabled?: boolean
}

export function SearchBar({ value, onChangeText, onSubmit, disabled }: Props) {
  return (
    <View style={styles.container}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    color: theme.textPrimary,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
})
