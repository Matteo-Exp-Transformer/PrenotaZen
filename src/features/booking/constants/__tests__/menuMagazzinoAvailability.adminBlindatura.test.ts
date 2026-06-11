// @admin-blindatura: menu-magazzino-availability
// M3 Fase 2 — toggle disponibilità magazzino → filtro Prenota + QR; snapshot intatto.

import { describe, expect, it } from 'vitest'
import { isMenuItemVisibleForSelection } from '../../utils/bookingCapabilities'
import {
  filterMenuCategoriesForPublic,
  filterMenuItemsForPublic,
  filterMenuItemsForPublicQr,
  isMenuCategoryAvailable,
  isMenuItemAvailableInMagazzino,
} from '../menuMagazzinoLimits'
import type { SelectedMenuItem } from '@/types/menu'

const categories = [
  { key: 'antipasti', label: 'Antipasti', is_available: true },
  { key: 'pizza', label: 'Pizza', is_available: false },
  { key: 'dolci', label: 'Dolci', is_available: true },
] as const

const items = [
  { id: 'a1', name: 'Bruschetta', category: 'antipasti', price: 5, is_available: true },
  { id: 'p1', name: 'Margherita', category: 'pizza', price: 8, is_available: true },
  { id: 'd1', name: 'Tiramisù', category: 'dolci', price: 6, is_available: false },
  { id: 'd2', name: 'Gelato', category: 'dolci', price: 4, is_available: true },
] as const

describe('@admin-blindatura menu-magazzino-availability — default retroattivo', () => {
  it('is_available assente o true → disponibile', () => {
    expect(isMenuCategoryAvailable({})).toBe(true)
    expect(isMenuCategoryAvailable({ is_available: true })).toBe(true)
    expect(isMenuItemAvailableInMagazzino({ category: 'antipasti' }, new Map())).toBe(true)
  })
})

describe('@admin-blindatura menu-magazzino-availability — filtro pubblico', () => {
  it('categoria spenta → esclusa da filterMenuCategoriesForPublic', () => {
    const publicCats = filterMenuCategoriesForPublic([...categories])
    expect(publicCats.map((c) => c.key)).toEqual(['antipasti', 'dolci'])
  })

  it('item spento → nascosto; categoria on con altri item on resta visibile', () => {
    const publicItems = filterMenuItemsForPublic([...items], [...categories])
    expect(publicItems.map((i) => i.id)).toEqual(['a1', 'd2'])
    expect(publicItems.some((i) => i.category === 'dolci')).toBe(true)
  })

  it('categoria spenta → tutti gli item della categoria nascosti', () => {
    const publicItems = filterMenuItemsForPublic([...items], [...categories])
    expect(publicItems.some((i) => i.category === 'pizza')).toBe(false)
  })
})

describe('@admin-blindatura menu-magazzino-availability — preset Prenota', () => {
  it('item nel preset ma spento magazzino → non selezionabile', () => {
    const presetIds = ['d1', 'd2']
    const publicItems = filterMenuItemsForPublic([...items], [...categories])
    const visible = publicItems.filter((item) =>
      isMenuItemVisibleForSelection({
        itemId: item.id,
        itemCategory: item.category,
        bookingType: 'rinfresco_laurea',
        activePresetItemIds: new Set(presetIds),
        hiddenCategoryKeys: new Set(),
        hiddenItemIds: new Set(),
      }),
    )
    expect(visible.map((i) => i.id)).toEqual(['d2'])
  })
})

describe('@admin-blindatura menu-magazzino-availability — QR hidden per-QR', () => {
  it('item spento magazzino ma non in hiddenItemIds QR → comunque nascosto', () => {
    const qrVisible = filterMenuItemsForPublicQr(
      [{ id: 'd1', category: 'dolci', is_available: false }],
      [{ key: 'dolci', is_available: true }],
      [],
    )
    expect(qrVisible).toHaveLength(0)
  })

  it('hiddenItemIds QR si combina col magazzino: entrambi devono passare', () => {
    const qrVisible = filterMenuItemsForPublicQr(
      [{ id: 'd2', category: 'dolci', is_available: true }],
      [{ key: 'dolci', is_available: true }],
      ['d2'],
    )
    expect(qrVisible).toHaveLength(0)
  })
})

describe('@admin-blindatura menu-magazzino-availability — snapshot prenotazioni', () => {
  it('menu_selection congelato resta nome+prezzo anche se item spento dopo nel catalogo', () => {
    const snapshot: SelectedMenuItem[] = [
      {
        id: 'd1',
        name: 'Tiramisù',
        price: 6,
        category: 'dolci',
        totalPrice: 6,
      },
    ]
    const catalogAfterOff = [
      { id: 'd1', name: 'Tiramisù RINOMINATO', category: 'dolci', price: 99, is_available: false },
    ]
    expect(snapshot[0].name).toBe('Tiramisù')
    expect(snapshot[0].price).toBe(6)
    expect(filterMenuItemsForPublic(catalogAfterOff, [...categories])).toHaveLength(0)
  })
})

describe('@admin-blindatura menu-magazzino-availability — catalogo admin config (QR + card scorrevoli)', () => {
  it('filterMenuCategoriesForPublic + filterMenuItemsForPublic escludono categorie/ingredienti spenti', () => {
    const publicCategories = filterMenuCategoriesForPublic([...categories])
    expect(publicCategories.map((c) => c.key)).toEqual(['antipasti', 'dolci'])

    const publicItems = filterMenuItemsForPublic([...items], [...categories])
    expect(publicItems.map((i) => i.id)).toEqual(['a1', 'd2'])
  })
})
