import { describe, expect, it } from 'vitest'
import { validateMenuQrSettings } from '../menuQrValidation'
import type { CarouselItem, MenuItem } from '@/types/menu'

const slide = (partial: Partial<CarouselItem>): CarouselItem => ({
  image_url: 'https://example.com/a.webp',
  eyebrow: 'Etichetta',
  title: 'Titolo',
  sort_order: 0,
  ...partial,
})

const item = (id: string, category: string): MenuItem =>
  ({
    id,
    category,
    name: 'Piatto',
    price: 10,
    sort_order: 0,
  }) as MenuItem

describe('validateMenuQrSettings', () => {
  it('rifiuta salvataggio senza carosello completo', () => {
    const result = validateMenuQrSettings({
      carouselItems: [],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result.ok).toBe(false)
  })

  it('rifiuta zero categorie selezionate', () => {
    const result = validateMenuQrSettings({
      carouselItems: [slide({})],
      categoryFilter: [],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result.ok).toBe(false)
  })

  it('rifiuta categorie senza ingredienti visibili', () => {
    const result = validateMenuQrSettings({
      carouselItems: [slide({})],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: ['1'],
    })
    expect(result.ok).toBe(false)
  })

  it('priorità errore: categorie prima del carosello', () => {
    const result = validateMenuQrSettings({
      carouselItems: [],
      categoryFilter: [],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('categoria')
    }
  })

  it('accetta configurazione minima valida', () => {
    const result = validateMenuQrSettings({
      carouselItems: [slide({})],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result).toEqual({ ok: true })
  })
})
