import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { REGIONS } from '../constants/regions'
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
        accessibilityLabel={`Region: ${selected?.label ?? value}. Tap to change.`}
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
                style={[
                  styles.option,
                  item.value === value && styles.optionSelected,
                ]}
                onPress={() => {
                  onChange(item.value)
                  setOpen(false)
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    item.value === value && styles.optionTextSelected,
                  ]}
                >
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
    borderColor: '#2A2A2A',
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  triggerDisabled: {
    opacity: 0.5,
  },
  triggerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  caret: {
    color: '#666',
    fontSize: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    maxHeight: '60%',
  },
  sheetTitle: {
    color: '#C89B3C',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2A2A2A',
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1A1A1A',
  },
  optionSelected: {
    backgroundColor: '#1C1A12',
  },
  optionText: {
    color: '#aaa',
    fontSize: 15,
  },
  optionTextSelected: {
    color: '#C89B3C',
    fontWeight: '600',
  },
})
