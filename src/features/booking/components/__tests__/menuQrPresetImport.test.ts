import { describe, expect, it } from 'vitest'
import { computeImportFromPreset } from '../MenuQrModal'
import type { MenuItem } from '@/types/menu'

const item = (id: string, category: string): MenuItem =>
  ({
    id,
    category,
    name: 'Piatto',
    price: 10,
    sort_order: 0,
  }) as MenuItem

describe('computeImportFromPreset', () => {
  it('precompila le categorie che contengono item del preset e lascia visibili tutti gli ingredienti di quelle categorie', () => {
    const result = computeImportFromPreset(
      ['a1', 'p2', 'missing'],
      ['antipasti', 'primi', 'dolci'],
      {
        antipasti: [item('a1', 'antipasti'), item('a2', 'antipasti')],
        primi: [item('p1', 'primi'), item('p2', 'primi')],
        dolci: [item('d1', 'dolci')],
      },
    )

    expect(result).toEqual({
      categoryFilter: ['antipasti', 'primi'],
      hiddenItemIds: [],
    })
  })

  it('ignora categorie senza item del preset', () => {
    const result = computeImportFromPreset(['p1'], ['antipasti', 'primi'], {
      antipasti: [item('a1', 'antipasti')],
      primi: [item('p1', 'primi')],
    })

    expect(result).toEqual({
      categoryFilter: ['primi'],
      hiddenItemIds: [],
    })
  })
})
