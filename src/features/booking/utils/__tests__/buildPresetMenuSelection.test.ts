import { describe, expect, it } from 'vitest'
import type { SelectedMenuItem } from '@/types/menu'
import { computeMenuTotalsWithPresetPrice } from '../buildPresetMenuSelection'

const selectedItems: SelectedMenuItem[] = [
  {
    id: 'starter-1',
    name: 'Antipasto',
    price: 2,
    category: 'antipasti',
  },
  {
    id: 'main-1',
    name: 'Secondo',
    price: 5,
    category: 'secondi',
  },
]

describe('computeMenuTotalsWithPresetPrice', () => {
  it('uses the preset price per person instead of summing selected dishes', () => {
    expect(computeMenuTotalsWithPresetPrice(selectedItems, 3, 8)).toEqual({
      totalPerPerson: 8,
      menu_total_booking: 24,
    })
  })

  it('falls back to selected dish totals when preset price is not set', () => {
    expect(computeMenuTotalsWithPresetPrice(selectedItems, 3, undefined)).toEqual({
      totalPerPerson: 7,
      menu_total_booking: 21,
    })
  })
})
