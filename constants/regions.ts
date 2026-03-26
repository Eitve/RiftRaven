import type { Region } from '../types'

export interface RegionOption {
  label: string
  value: Region
}

export const REGIONS: RegionOption[] = [
  { label: 'EUW', value: 'EUW1' },
  { label: 'EUNE', value: 'EUN1' },
  { label: 'NA', value: 'NA1' },
  { label: 'KR', value: 'KR' },
  { label: 'JP', value: 'JP1' },
  { label: 'BR', value: 'BR1' },
  { label: 'LAN', value: 'LA1' },
  { label: 'LAS', value: 'LA2' },
  { label: 'OCE', value: 'OC1' },
  { label: 'RU', value: 'RU' },
  { label: 'TR', value: 'TR1' },
  { label: 'PH', value: 'PH2' },
  { label: 'SG', value: 'SG2' },
  { label: 'TH', value: 'TH2' },
  { label: 'TW', value: 'TW2' },
  { label: 'VN', value: 'VN2' },
]

export const DEFAULT_REGION: Region = 'EUW1'
