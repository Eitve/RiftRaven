import React, { useState } from 'react'
import {
  View, Text, Pressable, Modal, FlatList, StyleSheet, SafeAreaView,
} from 'react-native'
import { REGIONS } from '../constants/regions'
import { theme } from '../constants/theme'
import type { Region } from '../types'

interface Props {
  value: Region
  onChange: (region: Region) => void
  disabled?: boolean
}

export function RegionPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const selected = REGIONS.find((r) => r.value === value)

  return (
    <>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => !disabled && setOpen(true)}
      >
        <Text style={styles.triggerText}>{selected?.label ?? value}</Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.sheetTitle}>Select Region</Text>
          <FlatList
            data={REGIONS}
            keyExtractor={(r) => r.value}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item.value === value && styles.optionSelected]}
                onPress={() => { onChange(item.value); setOpen(false) }}
              >
                <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerText: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  caret: { color: theme.textMuted, fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    maxHeight: '60%',
  },
  sheetTitle: {
    color: theme.accentDark,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.separator,
  },
  optionSelected: { backgroundColor: theme.accentBg },
  optionText: { color: theme.textSecondary, fontSize: 15 },
  optionTextSelected: { color: theme.accentDark, fontWeight: '600' },
})
