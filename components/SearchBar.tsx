import React from 'react'
import { TextInput, StyleSheet, View } from 'react-native'

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
        placeholderTextColor="#444"
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
    borderColor: '#2A2A2A',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  input: {
    height: 44,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
})
