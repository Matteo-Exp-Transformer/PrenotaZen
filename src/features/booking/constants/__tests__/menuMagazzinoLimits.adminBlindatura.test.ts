// @admin-blindatura: menu-magazzino-limits
// Limiti duri restanti: 6 preset · 6 QR. Tetti 7 categorie / 12 prodotti/categoria rimossi.

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
  getMenuQrCodeLimitMessage,
  getMenuMagazzinoSavePropagationMessage,
  getStaffPresetLimitMessage,
} from '../menuMagazzinoLimits'

describe('@admin-blindatura menu-magazzino-limits — soglie dure', () => {
  it('valori fissati: 6 preset · 6 QR; niente tetto categorie né prodotti/categoria', () => {
    expect(MENU_MAGAZZINO_HARD_LIMITS.staffPresets).toBe(6)
    expect(MENU_MAGAZZINO_HARD_LIMITS.qrCodes).toBe(6)
    expect('categories' in MENU_MAGAZZINO_HARD_LIMITS).toBe(false)
    expect('productsPerCategory' in MENU_MAGAZZINO_HARD_LIMITS).toBe(false)
  })

  it('messaggi limite citano solo preset e QR', () => {
    expect(getStaffPresetLimitMessage()).toContain('6')
    expect(getMenuQrCodeLimitMessage()).toContain('6')
  })
})

describe('@admin-blindatura menu-magazzino-limits — retroattività (solo +1 nuovo)', () => {
  it('categorie: nessun tetto — 7, 8 e 10 restano aggiungibili', () => {
    expect(canAddMenuCategory(6)).toBe(true)
    expect(canAddMenuCategory(7)).toBe(true)
    expect(canAddMenuCategory(10)).toBe(true)
  })

  it('prodotti/categoria: nessun tetto — 12 e 13 restano aggiungibili', () => {
    expect(canAddMenuProductToCategory(11)).toBe(true)
    expect(canAddMenuProductToCategory(12)).toBe(true)
    expect(canAddMenuProductToCategory(13)).toBe(true)
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

  it('canAddMenuProductAnywhere: true anche oltre 12 prodotti per categoria', () => {
    const categories = [
      { key: 'antipasti', label: 'Antipasti' },
      { key: 'dolci', label: 'Dolci' },
    ]
    const fullItems = [
      ...Array.from({ length: 12 }, (_, i) => ({ category: 'antipasti', id: `a${i}` })),
      ...Array.from({ length: 12 }, (_, i) => ({ category: 'dolci', id: `d${i}` })),
    ]
    expect(canAddMenuProductAnywhere(fullItems, categories)).toBe(true)
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

describe('@admin-blindatura menu-magazzino-limits — avviso propagazione save (edition-aware)', () => {
  it('Classic senza QR: cita solo Pagina Prenota + snapshot', () => {
    const message = getMenuMagazzinoSavePropagationMessage(false)
    expect(message).toContain('Pagina Prenota')
    expect(message).not.toContain('Menu QR')
    expect(message).toContain('prenotazioni già inviate')
  })

  it('tenant con qrMenu: cita Pagina Prenota e Menu QR + snapshot', () => {
    const message = getMenuMagazzinoSavePropagationMessage(true)
    expect(message).toContain('Pagina Prenota')
    expect(message).toContain('Menu QR')
    expect(message).toContain('prenotazioni già inviate')
  })
})

describe('@admin-blindatura menu-magazzino-limits — cap testo compose (FU-030)', () => {
  it('categoria 24/79, piatto 42/110', () => {
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryDescription).toBe(79)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName).toBe(42)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).toBe(110)
  })
})
