import { describe, expect, it } from 'vitest'
import { buildOrderedCategoryEntries } from '../../utils/orderCategoryKeys'
import { isMenuItemVisibleForSelection } from '../../utils/bookingCapabilities'
import type { BookingType } from '@/types/booking'

/**
 * Riproduce la derivazione `categoryEntries` di MenuSelection con i dati reali del
 * tenant TEST: modalità `tavolo` + preset personalizzabile con 3 ingredienti
 * (antipasti/primi/secondi). Verifica che le card categoria NON spariscano.
 */
describe('MenuSelection categoryEntries (regressione card categorie)', () => {
  const dbCategories = [
    { key: 'antipasti', label: 'Antipasti', sort_order: 10 },
    { key: 'primi', label: 'Primi piatti', sort_order: 20 },
    { key: 'secondi', label: 'Secondi piatti', sort_order: 30 },
    { key: 'dolci', label: 'Dolci', sort_order: 40 },
    { key: 'bevande', label: 'Bevande', sort_order: 50 },
  ]

  // Replica della logica del useMemo `categoryEntries` (post-fix).
  function buildCategoryEntries(
    normalizedCategories: string[],
    categoryOrderKeys?: string[],
  ) {
    const catalogKeys = dbCategories.map((c) => c.key)
    const itemCategoryKeys = [...new Set(normalizedCategories)]
    const extraKeys = itemCategoryKeys.filter((k) => !catalogKeys.includes(k))
    const keys = [...catalogKeys, ...extraKeys]
    const categoriesForOrder = [
      ...dbCategories,
      ...extraKeys.map((key, index) => ({ key, label: key, sort_order: 1000 + index })),
    ]
    return buildOrderedCategoryEntries(categoriesForOrder, keys, categoryOrderKeys)
  }

  it('mostra le categorie del catalogo anche quando gli item coprono solo 3 categorie', () => {
    const entries = buildCategoryEntries(['antipasti', 'primi', 'secondi'], [
      'antipasti',
      'primi',
      'secondi',
    ])
    const keys = entries.map(([k]) => k)
    expect(keys).toContain('antipasti')
    expect(keys).toContain('primi')
    expect(keys).toContain('secondi')
    // Il catalogo resta presente: la griglia poi nasconde le vuote.
    expect(keys.length).toBeGreaterThanOrEqual(3)
  })

  it('non azzera le categorie quando normalizedMenuItems è vuoto (catalogo in caricamento)', () => {
    const entries = buildCategoryEntries([])
    expect(entries.map(([k]) => k)).toEqual([
      'antipasti',
      'primi',
      'secondi',
      'dolci',
      'bevande',
    ])
  })
})

/**
 * Verifica il filtro REALE `isMenuItemVisibleForSelection` (la stessa funzione importata da
 * MenuSelection.normalizedMenuItems): con un preset collegato mostra SOLO gli item del preset
 * per OGNI booking_type (LOCK Ingredienti preset custom). Senza preset, legacy per booking_type.
 */
describe('MenuSelection normalizedMenuItems (LOCK preset per ogni booking_type)', () => {
  interface RawItem {
    id: string
    category: string
    booking_types?: unknown
  }

  // Applica la funzione di produzione, replicando solo l'iterazione (non la logica).
  function filterItems(
    items: RawItem[],
    bookingType: BookingType | null,
    presetItemIds: string[],
    hiddenCategoryKeys: string[] = [],
    hiddenItemIds: string[] = [],
  ): RawItem[] {
    const activePresetItemIds = new Set(presetItemIds)
    const hiddenCategories = new Set(hiddenCategoryKeys)
    const hiddenItems = new Set(hiddenItemIds)
    return items.filter((item) =>
      isMenuItemVisibleForSelection({
        itemId: item.id,
        itemCategory: item.category,
        itemBookingTypes: item.booking_types,
        bookingType,
        activePresetItemIds,
        hiddenCategoryKeys: hiddenCategories,
        hiddenItemIds: hiddenItems,
      }),
    )
  }

  const catalog: RawItem[] = [
    { id: 'tllu', category: 'antipasti', booking_types: [] },
    { id: 'tommy', category: 'primi', booking_types: [] },
    { id: 'neo', category: 'secondi', booking_types: [] },
    { id: 'extra', category: 'dolci', booking_types: [] },
  ]

  it("tavolo + preset (3 item su 3): mostra SOLO i 3 item del preset, esclude quelli fuori preset", () => {
    const result = filterItems(catalog, 'tavolo', ['tllu', 'tommy', 'neo'])
    expect(result.map((i) => i.id)).toEqual(['tllu', 'tommy', 'neo'])
  })

  it('preset attivo: anche item con booking_types vuoto restano se nel preset', () => {
    const result = filterItems(catalog, 'tavolo', ['tllu'])
    expect(result.map((i) => i.id)).toEqual(['tllu'])
  })

  it('item nascosto nella card escluso anche se nel preset', () => {
    const result = filterItems(catalog, 'tavolo', ['tllu', 'tommy', 'neo'], [], ['tommy'])
    expect(result.map((i) => i.id)).toEqual(['tllu', 'neo'])
  })

  it('senza preset, tipo legacy (rinfresco): filtra per booking_types item', () => {
    const items: RawItem[] = [
      { id: 'a', category: 'antipasti', booking_types: ['rinfresco_laurea'] },
      { id: 'b', category: 'primi', booking_types: ['menu_prezzo_fisso'] },
    ]
    const result = filterItems(items, 'rinfresco_laurea', [])
    expect(result.map((i) => i.id)).toEqual(['a'])
  })

  it('senza preset, tipo non-menu (tavolo): comportamento legacy invariato (passa tutto)', () => {
    const result = filterItems(catalog, 'tavolo', [])
    expect(result.map((i) => i.id)).toEqual(['tllu', 'tommy', 'neo', 'extra'])
  })
})
