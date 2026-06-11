// @admin-blindatura: menu-magazzino-limits
// M3 Fase 1 — limiti duri 7/12/6/6 (solo nuovi inserimenti) + cap testo compose.

import { describe, expect, it } from 'vitest'
import { BOOKING_MENU_COMPOSE_TEXT_LIMITS } from '../bookingPrenotaTextLimits'
import {
  MENU_MAGAZZINO_HARD_LIMITS,
  canAddMenuCategory,
  canAddMenuProductAnywhere,
  canAddMenuProductToCategory,
  canAddMenuQrCode,
  canAddStaffPreset,
  countMenuProductsInCategory,
  getMenuCategoryLimitMessage,
  getMenuProductPerCategoryLimitMessage,
  getMenuQrCodeLimitMessage,
  getStaffPresetLimitMessage,
} from '../menuMagazzinoLimits'

describe('@admin-blindatura menu-magazzino-limits — soglie dure', () => {
  it('valori fissati: 7 categorie · 12 prodotti/categoria · 6 preset · 6 QR', () => {
    expect(MENU_MAGAZZINO_HARD_LIMITS.categories).toBe(7)
    expect(MENU_MAGAZZINO_HARD_LIMITS.productsPerCategory).toBe(12)
    expect(MENU_MAGAZZINO_HARD_LIMITS.staffPresets).toBe(6)
    expect(MENU_MAGAZZINO_HARD_LIMITS.qrCodes).toBe(6)
  })

  it('messaggi limite citano il numero massimo', () => {
    expect(getMenuCategoryLimitMessage()).toContain('7')
    expect(getMenuProductPerCategoryLimitMessage()).toContain('12')
    expect(getStaffPresetLimitMessage()).toContain('6')
    expect(getMenuQrCodeLimitMessage()).toContain('6')
  })
})

describe('@admin-blindatura menu-magazzino-limits — retroattività (solo +1 nuovo)', () => {
  it('categorie: sotto soglia ok, alla soglia blocca nuovo, oltre soglia non rompe esistente', () => {
    expect(canAddMenuCategory(6)).toBe(true)
    expect(canAddMenuCategory(7)).toBe(false)
    expect(canAddMenuCategory(10)).toBe(false)
  })

  it('prodotti/categoria: 11 ok, 12 blocca nuovo, 15 legacy ancora validi in lettura', () => {
    expect(canAddMenuProductToCategory(11)).toBe(true)
    expect(canAddMenuProductToCategory(12)).toBe(false)
    expect(canAddMenuProductToCategory(15)).toBe(false)
  })

  it('preset staff: 5 ok, 6 blocca', () => {
    expect(canAddStaffPreset(5)).toBe(true)
    expect(canAddStaffPreset(6)).toBe(false)
    expect(canAddStaffPreset(8)).toBe(false)
  })

  it('QR: 5 ok, 6 blocca', () => {
    expect(canAddMenuQrCode(5)).toBe(true)
    expect(canAddMenuQrCode(6)).toBe(false)
  })

  it('canAddMenuProductAnywhere: false se ogni categoria è piena', () => {
    const categories = [
      { key: 'antipasti', label: 'Antipasti' },
      { key: 'dolci', label: 'Dolci' },
    ]
    const fullItems = [
      ...Array.from({ length: 12 }, (_, i) => ({ category: 'antipasti', id: `a${i}` })),
      ...Array.from({ length: 12 }, (_, i) => ({ category: 'dolci', id: `d${i}` })),
    ]
    expect(canAddMenuProductAnywhere(fullItems, categories)).toBe(false)

    const oneSlot = [...fullItems.slice(0, 11), { category: 'antipasti', id: 'a11' }]
    expect(canAddMenuProductAnywhere(oneSlot, categories)).toBe(true)
  })
})

describe('@admin-blindatura menu-magazzino-limits — conteggio prodotti per categoria', () => {
  it('match su key e su label legacy', () => {
    const items = [
      { category: 'pizza' },
      { category: 'Pizza' },
      { category: 'birre' },
    ]
    expect(countMenuProductsInCategory(items, 'pizza', 'Pizza')).toBe(2)
    expect(countMenuProductsInCategory(items, 'birre', 'Birre')).toBe(1)
  })
})

describe('@admin-blindatura menu-magazzino-limits — cap testo compose (FU-030)', () => {
  it('allineati a BOOKING_MENU_COMPOSE_TEXT_LIMITS 24/24/79', () => {
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).toBe(79)
  })
})
