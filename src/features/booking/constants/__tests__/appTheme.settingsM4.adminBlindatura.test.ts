// @admin-blindatura: settings-theme
// Copre: parse/validate app_theme, ID sconosciuto → default, isolamento da Prenota/Menu QR

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_THEME_IDS,
  DEFAULT_APP_THEME,
  isAppThemeId,
  parseAppThemeFromDb,
} from '../appTheme'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'

const repoRoot = process.cwd()

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('settings-theme M4 — helper e registry app_theme', () => {
  const theme = restaurantSettingRegistry.app_theme

  it('isAppThemeId accetta solo ID noti (case-insensitive)', () => {
    for (const id of APP_THEME_IDS) {
      expect(isAppThemeId(id)).toBe(true)
      expect(isAppThemeId(id.toUpperCase())).toBe(true)
    }
    expect(isAppThemeId('classic-warm')).toBe(false)
    expect(isAppThemeId('')).toBe(false)
    expect(isAppThemeId(null)).toBe(false)
  })

  it('parseAppThemeFromDb: sconosciuto/null/vuoto → DEFAULT_APP_THEME', () => {
    expect(parseAppThemeFromDb(null)).toBe(DEFAULT_APP_THEME)
    expect(parseAppThemeFromDb(undefined)).toBe(DEFAULT_APP_THEME)
    expect(parseAppThemeFromDb('')).toBe(DEFAULT_APP_THEME)
    expect(parseAppThemeFromDb('   ')).toBe(DEFAULT_APP_THEME)
    expect(parseAppThemeFromDb('tema-inventato')).toBe(DEFAULT_APP_THEME)
    expect(parseAppThemeFromDb('CLASSIC-WARM')).toBe(DEFAULT_APP_THEME)
  })

  it('parseAppThemeFromDb: ID valido normalizzato', () => {
    expect(parseAppThemeFromDb('theme-2')).toBe('theme-2')
    expect(parseAppThemeFromDb('  WARM-SAND-PRO  ')).toBe('warm-sand-pro')
  })

  it('registry validate rifiuta ID sconosciuto, accetta noti', () => {
    expect(theme.validate('midnight-blue')).toBeNull()
    expect(theme.validate('warm-sand-pro')).toBeNull()
    expect(theme.validate('legacy-theme')).not.toBeNull()
    expect(theme.validate(42)).not.toBeNull()
  })

  it('registry serializeToDb normalizza lowercase', () => {
    expect(theme.serializeToDb('theme-2')).toBe('theme-2')
    expect(theme.parseFromDb(theme.serializeToDb('pearl-blue-minimal'))).toBe('pearl-blue-minimal')
  })

  it('Prenota pubblico e Menu QR non leggono app_theme', () => {
    const prenota = readRepoFile('src/pages/BookingRequestPage.tsx')
    const menuQr = readRepoFile('src/pages/PublicMenuPage.tsx')
    const menuCategory = readRepoFile('src/pages/PublicMenuCategoryPage.tsx')

    for (const [label, source] of [
      ['BookingRequestPage', prenota],
      ['PublicMenuPage', menuQr],
      ['PublicMenuCategoryPage', menuCategory],
    ] as const) {
      expect(source, label).not.toMatch(/app_theme/)
      expect(source, label).not.toMatch(/data-admin-theme/)
      expect(source, label).not.toMatch(/APP_THEME/)
    }
  })
})
