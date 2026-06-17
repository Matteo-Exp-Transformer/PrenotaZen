import { describe, expect, it } from 'vitest'
import { applyQrItemSortOverride, parseItemSortOverrides } from '../menuQrAppearance'

type Item = { id: string; name: string }

const item = (id: string): Item => ({ id, name: id })

describe('parseItemSortOverrides', () => {
  it('restituisce null per JSONB malformato o non oggetto', () => {
    expect(parseItemSortOverrides(null)).toBeNull()
    expect(parseItemSortOverrides(['x'])).toBeNull()
    expect(parseItemSortOverrides({})).toBeNull()
  })

  it('filtra valori non stringa dentro gli array', () => {
    expect(parseItemSortOverrides({ primi: ['b', '', 42 as never], dolci: 'nope' })).toEqual({
      primi: ['b'],
    })
  })
})

describe('applyQrItemSortOverride', () => {
  it("lascia invariato l'ordine quando override assente o vuoto", () => {
    const items = [item('a'), item('b'), item('c')]
    expect(applyQrItemSortOverride(items, null)).toBe(items)
    expect(applyQrItemSortOverride(items, [])).toBe(items)
  })

  it("porta gli item esplicitati in testa e conserva l'ordine residuo", () => {
    const items = [item('c'), item('a'), item('b'), item('d')]

    expect(applyQrItemSortOverride(items, ['b', 'd'])).toEqual([
      item('b'),
      item('d'),
      item('c'),
      item('a'),
    ])
  })
})
