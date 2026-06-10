import { describe, expect, it } from 'vitest'
import {
  filterItemsForComposeCategory,
  resolveLockedPresetAllowedItemIds,
  selectionStatusLabel,
} from '../menuComposeVisibility'
import { customPresetStorageId } from '../../constants/presetMenus'
import type { MenuItem } from '@/types/menu'

const menuItems: MenuItem[] = [
  {
    id: 'a1',
    created_at: '',
    updated_at: '',
    name: 'Carpaccio',
    price: 22,
    category: 'antipasti',
    booking_types: ['menu_prezzo_fisso'],
    sort_order: 0,
  },
  {
    id: 'p1',
    created_at: '',
    updated_at: '',
    name: 'Risotto',
    price: 18,
    category: 'primi',
    booking_types: ['menu_prezzo_fisso'],
    sort_order: 0,
  },
  {
    id: 'x1',
    created_at: '',
    updated_at: '',
    name: 'Extra',
    price: 5,
    category: 'antipasti',
    booking_types: ['menu_prezzo_fisso'],
    sort_order: 1,
  },
]

describe('resolveLockedPresetAllowedItemIds', () => {
  it('returns null when no preset', () => {
    expect(resolveLockedPresetAllowedItemIds(null, menuItems, [])).toBeNull()
  })

  it('returns null when staff preset is not resolved yet (catalogo in caricamento)', () => {
    expect(
      resolveLockedPresetAllowedItemIds(customPresetStorageId('preset-uuid'), menuItems, []),
    ).toBeNull()
  })

  it('returns catalog item_ids for customizable staff preset (no pre-selection)', () => {
    const presetId = 'preset-uuid'
    expect(
      resolveLockedPresetAllowedItemIds(
        customPresetStorageId(presetId),
        menuItems,
        [
          {
            id: presetId,
            name: 'Laurea',
            item_ids: ['a1', 'p1'],
            booking_types: ['menu_prezzo_fisso'],
            is_fixed_menu: false,
          },
        ],
      ),
    ).toEqual(new Set(['a1', 'p1']))
  })

  it('returns item_ids set for fixed staff preset', () => {
    const presetId = 'preset-uuid'
    const allowed = resolveLockedPresetAllowedItemIds(
      customPresetStorageId(presetId),
      menuItems,
      [
        {
          id: presetId,
          name: 'Laurea',
          item_ids: ['a1', 'p1'],
          booking_types: ['menu_prezzo_fisso'],
          is_fixed_menu: true,
        },
      ],
    )
    expect(allowed).toEqual(new Set(['a1', 'p1']))
  })
})

describe('filterItemsForComposeCategory', () => {
  const items = [
    { id: 'a1', name: 'A', price: 1, category: 'antipasti', sort_order: 0 },
    { id: 'x1', name: 'X', price: 2, category: 'antipasti', sort_order: 1 },
  ]

  it('returns all items when allowed set is null', () => {
    expect(filterItemsForComposeCategory(items, null)).toHaveLength(2)
  })

  it('filters to allowed ids when locked', () => {
    expect(filterItemsForComposeCategory(items, new Set(['a1']))).toEqual([items[0]])
  })
})

describe('selectionStatusLabel', () => {
  it('returns generic hint with 1 selected', () => {
    expect(selectionStatusLabel('primi', 1)).toEqual({
      hint: 'Scegli le opzioni',
      status: '1 selezionata',
    })
  })

  it('returns generic hint with multiple selected', () => {
    expect(selectionStatusLabel('antipasti', 2)).toEqual({
      hint: 'Scegli le opzioni',
      status: '2 selezionate',
    })
  })
})
