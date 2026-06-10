// @prenota-blindatura: flusso-dati
// Copre: LOCK Selezione preset pubblico e caricamento async (contratto: catalogo
//        vuoto → null/false, il gate "non disponibile" spetta al chiamante con il flag
//        di loading), LOCK Cancellazione preset staff (preset custom assente → null),
//        LOCK Ingredienti preset custom (item_ids del preset = fonte catalogo).
//
// Caccia: applyPresetTypeToBookingFormPayload / presetCatalogHasMenuItems sono funzioni
// PURE. Durante isLoading il catalogo arriva vuoto: questi test fissano che restituiscono
// "vuoto" (e che NON inventano voci), così sappiamo che il chiamante DEVE distinguere
// loading da preset-davvero-mancante.

import { describe, it, expect } from 'vitest'
import type { MenuItem } from '@/types/menu'
import {
  applyPresetTypeToBookingFormPayload,
  presetCatalogHasMenuItems,
  resolvePresetSelectedItems,
} from '../buildPresetMenuSelection'
import {
  customPresetStorageId,
  type CustomStaffPreset,
} from '../../constants/presetMenus'

const ITEM = (id: string, name: string, category: string, price: number): MenuItem =>
  ({ id, name, category, price } as unknown as MenuItem)

const MENU_ITEMS: MenuItem[] = [
  ITEM('i1', 'Antipasto', 'antipasti', 5),
  ITEM('i2', 'Primo', 'primi', 8),
  ITEM('i3', 'Dolce', 'dolci', 4),
]

const FIXED_PRESET: CustomStaffPreset = {
  id: 'uuid-fixed',
  name: 'Menu Fisso',
  item_ids: ['i1', 'i2'],
  booking_types: ['menu_prezzo_fisso'],
  price_per_person: 30,
}

const COMPOSABLE_PRESET: CustomStaffPreset = {
  id: 'uuid-comp',
  name: 'Menu Personalizzabile',
  item_ids: ['i1', 'i2', 'i3'],
  booking_types: ['rinfresco_laurea'],
  is_fixed_menu: false,
}

const FIXED_KEY = customPresetStorageId('uuid-fixed')
const COMP_KEY = customPresetStorageId('uuid-comp')

describe('caricamento async — catalogo vuoto NON è "preset mancante" (è loading)', () => {
  it('menuItems vuoto: il payload risolve a null (il chiamante deve gestire isLoading)', () => {
    const result = applyPresetTypeToBookingFormPayload(FIXED_KEY, [], [FIXED_PRESET])
    expect(result).toBeNull()
  })

  it('menuItems vuoto: presetCatalogHasMenuItems = false, non inventa voci', () => {
    expect(presetCatalogHasMenuItems(FIXED_KEY, [], [FIXED_PRESET])).toBe(false)
    expect(presetCatalogHasMenuItems(COMP_KEY, [], [COMPOSABLE_PRESET])).toBe(false)
  })

  it('quando il catalogo arriva, lo stesso preset risolve correttamente', () => {
    const result = applyPresetTypeToBookingFormPayload(FIXED_KEY, MENU_ITEMS, [FIXED_PRESET])
    expect(result).not.toBeNull()
    expect(result!.items.map((i) => i.id).sort()).toEqual(['i1', 'i2'])
    expect(result!.preset_menu).toBe(FIXED_KEY)
  })
})

describe('preset custom cancellato dopo il collegamento', () => {
  it('preset non più nella lista custom → resolvePresetSelectedItems null', () => {
    expect(resolvePresetSelectedItems(FIXED_KEY, MENU_ITEMS, [])).toBeNull()
  })

  it('preset custom assente → applyPreset null (no card fantasma)', () => {
    expect(applyPresetTypeToBookingFormPayload(FIXED_KEY, MENU_ITEMS, [])).toBeNull()
  })
})

describe('preset personalizzabile (is_fixed_menu=false)', () => {
  it('catalogo presente → payload con items vuoti (il cliente compone) ma preset_menu valorizzato', () => {
    const result = applyPresetTypeToBookingFormPayload(COMP_KEY, MENU_ITEMS, [COMPOSABLE_PRESET])
    expect(result).not.toBeNull()
    expect(result!.items).toEqual([])
    expect(result!.preset_menu).toBe(COMP_KEY)
  })

  it('card sottotab personalizzabile (subTabGuestComposable) → items vuoti anche se preset staff è fisso', () => {
    const result = applyPresetTypeToBookingFormPayload(FIXED_KEY, MENU_ITEMS, [FIXED_PRESET], {
      subTabGuestComposable: true,
    })
    expect(result).not.toBeNull()
    expect(result!.items).toEqual([])
    expect(result!.preset_menu).toBe(FIXED_KEY)
  })

  it('personalizzabile ma item_ids del preset non esistono più nel catalogo → null', () => {
    const orphanPreset: CustomStaffPreset = { ...COMPOSABLE_PRESET, item_ids: ['sparito-1'] }
    expect(applyPresetTypeToBookingFormPayload(COMP_KEY, MENU_ITEMS, [orphanPreset])).toBeNull()
  })
})

describe('LOCK Ingredienti preset custom — fonte catalogo = item_ids del preset', () => {
  it('risolve solo gli item_ids del preset, ignorando il resto del catalogo', () => {
    const items = resolvePresetSelectedItems(FIXED_KEY, MENU_ITEMS, [FIXED_PRESET])
    expect(items!.map((i) => i.id).sort()).toEqual(['i1', 'i2'])
    // i3 (dolce) NON è nel preset fisso → escluso
    expect(items!.some((i) => i.id === 'i3')).toBe(false)
  })

  it('un item_id del preset assente dal catalogo viene semplicemente saltato (no crash)', () => {
    const presetWithGhost: CustomStaffPreset = { ...FIXED_PRESET, item_ids: ['i1', 'ghost', 'i2'] }
    const items = resolvePresetSelectedItems(FIXED_KEY, MENU_ITEMS, [presetWithGhost])
    expect(items!.map((i) => i.id).sort()).toEqual(['i1', 'i2'])
  })
})
