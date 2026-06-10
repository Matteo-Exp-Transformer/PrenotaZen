import { describe, expect, it } from 'vitest'
import { orderMenuCategoriesByFilter } from '../menuQrAppearance'
import type { MenuCategoryRecord } from '../../hooks/useMenuCategories'

const cat = (key: string, sort_order: number): MenuCategoryRecord =>
  ({
    id: key,
    key,
    label: key,
    description: null,
    sort_order,
    image_url: null,
  }) as MenuCategoryRecord

describe('orderMenuCategoriesByFilter', () => {
  const rows = [cat('antipasti', 1), cat('primi', 2), cat('dolci', 3)]

  it('legacy null: mantiene ordine query (sort_order)', () => {
    expect(orderMenuCategoriesByFilter(rows, null)).toEqual(rows)
  })

  it('array esplicito: ordina per sequenza category_filter', () => {
    expect(orderMenuCategoriesByFilter(rows, ['dolci', 'antipasti'])).toEqual([
      cat('dolci', 3),
      cat('antipasti', 1),
    ])
  })

  it('ignora chiavi nel filter assenti dal fetch', () => {
    expect(orderMenuCategoriesByFilter(rows, ['primi', 'mancante', 'antipasti'])).toEqual([
      cat('primi', 2),
      cat('antipasti', 1),
    ])
  })

  it('filter vuoto: nessun riordino (lista già vuota in homepage)', () => {
    expect(orderMenuCategoriesByFilter([], [])).toEqual([])
  })
})
