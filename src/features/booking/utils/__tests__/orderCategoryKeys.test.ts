import { describe, expect, it } from 'vitest'
import { orderCategoryKeys } from '../orderCategoryKeys'

const DB_ORDER = new Map([
  ['antipasti', 0],
  ['primi', 10],
  ['secondi', 20],
  ['dolci', 30],
])

describe('orderCategoryKeys', () => {
  it('senza orderKeys ordina per sort_order DB', () => {
    expect(orderCategoryKeys(['dolci', 'primi', 'antipasti'], undefined, DB_ORDER)).toEqual([
      'antipasti',
      'primi',
      'dolci',
    ])
  })

  it('con orderKeys esplicito rispetta la sequenza poi appende mancanti', () => {
    expect(
      orderCategoryKeys(['antipasti', 'primi', 'secondi', 'dolci'], ['dolci', 'primi'], DB_ORDER),
    ).toEqual(['dolci', 'primi', 'antipasti', 'secondi'])
  })

  it('ignora chiavi in orderKeys non presenti in keys', () => {
    expect(orderCategoryKeys(['primi', 'dolci'], ['inesistente', 'dolci'], DB_ORDER)).toEqual([
      'dolci',
      'primi',
    ])
  })

  it('orderKeys vuoto fa fallback DB', () => {
    expect(orderCategoryKeys(['secondi', 'antipasti'], [], DB_ORDER)).toEqual([
      'antipasti',
      'secondi',
    ])
  })
})
