import { describe, expect, it } from 'vitest'
import {
  BOOKING_LEGACY_ICON_TO_MENU_QR_KEY,
  defaultIconKeyForCategory,
  getMenuQrCategoryIconOption,
  MENU_QR_CATEGORY_ICON_OPTIONS,
  MENU_QR_LUCIDE_ICON_OPTIONS,
  MENU_QR_PHOSPHOR_ICON_OPTIONS,
  MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
  resolveBookingStoredIconKey,
  resolveMenuQrCategoryIconKey,
} from '../categoryIcons'

describe('categoryIcons', () => {
  it('espone 12 Phosphor + 8 Lucide (20 totali)', () => {
    expect(MENU_QR_PHOSPHOR_ICON_OPTIONS).toHaveLength(12)
    expect(MENU_QR_LUCIDE_ICON_OPTIONS).toHaveLength(8)
    expect(MENU_QR_CATEGORY_ICON_OPTIONS).toHaveLength(20)
    const values = MENU_QR_CATEGORY_ICON_OPTIONS.map((o) => o.value)
    expect(new Set(values).size).toBe(20)
    expect(values).not.toContain('lucide_soup')
    expect(values).not.toContain('lucide_egg_fried')
  })

  it('default senza foto: lucide_salad per categoria sconosciuta', () => {
    expect(defaultIconKeyForCategory('categoria_xyz')).toBeNull()
    expect(resolveMenuQrCategoryIconKey(null, 'categoria_xyz')).toBe('lucide_salad')
    expect(MENU_QR_DEFAULT_CATEGORY_ICON_KEY).toBe('lucide_salad')
  })

  it('mapping noto per category_key (Phosphor)', () => {
    expect(defaultIconKeyForCategory('pizza')).toBe('pizza_slice')
    expect(resolveMenuQrCategoryIconKey(null, 'pizza')).toBe('pizza_slice')
  })

  it('override salvato ha priorità su mapping', () => {
    expect(resolveMenuQrCategoryIconKey('fish', 'pizza')).toBe('fish')
    expect(resolveMenuQrCategoryIconKey('lucide_salad', 'pizza')).toBe('lucide_salad')
  })

  it('risolve chiavi lucide_* nel preset', () => {
    expect(getMenuQrCategoryIconOption('lucide_chef_hat').family).toBe('lucide')
    expect(getMenuQrCategoryIconOption('lucide_tea').label).toBe('Tè')
  })

  it('ignora icon key fuori preset e usa mapping o default', () => {
    expect(resolveMenuQrCategoryIconKey('not_a_real_icon', 'birre')).toBe('beer')
    expect(resolveMenuQrCategoryIconKey('legacy_emoji', undefined)).toBe(
      MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
    )
  })

  it('fallback per chiavi Lucide rimosse dal picker', () => {
    expect(resolveMenuQrCategoryIconKey('lucide_soup', 'zuppe')).toBe('cooking_pot')
    expect(resolveMenuQrCategoryIconKey('lucide_egg_fried', undefined)).toBe('fork_knife')
  })
})

describe('BOOKING_LEGACY_ICON_TO_MENU_QR_KEY / resolveBookingStoredIconKey', () => {
  it('mappa chiavi legacy Prenota al catalogo QR', () => {
    expect(BOOKING_LEGACY_ICON_TO_MENU_QR_KEY.utensils).toBe('fork_knife')
    expect(BOOKING_LEGACY_ICON_TO_MENU_QR_KEY['chef-hat']).toBe('lucide_chef_hat')
    expect(BOOKING_LEGACY_ICON_TO_MENU_QR_KEY.cloche).toBe('bowl_food')
    expect(BOOKING_LEGACY_ICON_TO_MENU_QR_KEY.star).toBe(MENU_QR_DEFAULT_CATEGORY_ICON_KEY)
  })

  it('pass-through per chiavi già nel catalogo', () => {
    expect(resolveBookingStoredIconKey('lucide_salad')).toBe('lucide_salad')
    expect(resolveBookingStoredIconKey('pizza_slice')).toBe('pizza_slice')
  })

  it('migrate-on-read da legacy senza riscrivere chiavi nuove', () => {
    expect(resolveBookingStoredIconKey('wine')).toBe('martini')
    expect(resolveBookingStoredIconKey('bowl-steam')).toBe('cooking_pot')
    expect(resolveBookingStoredIconKey('unknown_xyz')).toBe(MENU_QR_DEFAULT_CATEGORY_ICON_KEY)
  })
})
