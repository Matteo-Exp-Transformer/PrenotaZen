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
  it('rifiuta salvataggio senza nemmeno una foto nel carosello', () => {
    const result = validateMenuQrSettings({
      carouselItems: [],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('foto')
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

  // Testi slide facoltativi (decisione Matteo 03-09-26): basta la foto.
  it('accetta una slide con solo la foto (etichetta, titolo e descrizione vuoti)', () => {
    const result = validateMenuQrSettings({
      carouselItems: [slide({ eyebrow: undefined, title: undefined, description: undefined })],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result).toEqual({ ok: true })
  })

  it('accetta un carosello dove solo alcune slide hanno i testi', () => {
    const result = validateMenuQrSettings({
      carouselItems: [
        slide({ image_url: 'https://example.com/a.webp' }),
        slide({
          image_url: 'https://example.com/b.webp',
          eyebrow: undefined,
          title: undefined,
          sort_order: 1,
        }),
        slide({
          image_url: 'https://example.com/c.webp',
          eyebrow: undefined,
          title: undefined,
          description: 'Solo descrizione',
          sort_order: 2,
        }),
      ],
      categoryFilter: ['antipasti'],
      itemsByCategory: { antipasti: [item('1', 'antipasti')] },
      hiddenItemIds: [],
    })
    expect(result).toEqual({ ok: true })
  })
})
