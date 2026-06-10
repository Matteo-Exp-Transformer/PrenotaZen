import { describe, expect, it } from 'vitest'
import {
  applyCategoryImageUrlRewritesForRename,
  deleteCategoryKeyFromQrRow,
  renameCategoryKeyInQrRow,
  rewriteQrCategoryImageUrlForKeyRename,
} from '../menuQrCategoryKeySync'

const TENANT = 'tenant-1'
const SEGMENT = 'qr-abc'
const BASE = 'https://example.supabase.co/storage/v1/object/public/menu-photos'

describe('renameCategoryKeyInQrRow', () => {
  it('non modifica se chiavi uguali', () => {
    const row = {
      category_filter: ['primi'],
      category_images: { primi: 'https://x/a.webp' },
    }
    const result = renameCategoryKeyInQrRow('primi', 'primi', row)
    expect(result.changed).toBe(false)
    expect(result.category_filter).toEqual(['primi'])
  })

  it('sostituisce chiave in category_filter', () => {
    const result = renameCategoryKeyInQrRow('primi', 'secondi_piatti', {
      category_filter: ['antipasti', 'primi'],
      category_images: {},
    })
    expect(result.changed).toBe(true)
    expect(result.category_filter).toEqual(['antipasti', 'secondi_piatti'])
  })

  it('lascia category_filter null invariato', () => {
    const result = renameCategoryKeyInQrRow('primi', 'secondi_piatti', {
      category_filter: null,
      category_images: {},
    })
    expect(result.changed).toBe(false)
    expect(result.category_filter).toBeNull()
  })

  it('sposta URL in category_images senza sovrascrivere newKey esistente', () => {
    const result = renameCategoryKeyInQrRow('primi', 'secondi_piatti', {
      category_filter: [],
      category_images: {
        primi: 'https://old/primi.webp',
        secondi_piatti: 'https://keep/existing.webp',
      },
    })
    expect(result.changed).toBe(true)
    expect(result.category_images.primi).toBeUndefined()
    expect(result.category_images.secondi_piatti).toBe('https://keep/existing.webp')
    expect(result.shouldCopyStoragePhoto).toBe(true)
  })

  it('sposta thumb da previousKey a newKey se newKey assente', () => {
    const result = renameCategoryKeyInQrRow('primi', 'secondi_piatti', {
      category_filter: null,
      category_images: { primi: 'https://old/primi.webp' },
    })
    expect(result.category_images).toEqual({ secondi_piatti: 'https://old/primi.webp' })
  })
})

describe('deleteCategoryKeyFromQrRow', () => {
  it('rimuove chiave da category_filter e category_images', () => {
    const result = deleteCategoryKeyFromQrRow('primi', {
      category_filter: ['antipasti', 'primi'],
      category_images: { primi: 'https://x/primi.webp', dolci: 'https://x/dolci.webp' },
    })
    expect(result.changed).toBe(true)
    expect(result.category_filter).toEqual(['antipasti'])
    expect(result.category_images).toEqual({ dolci: 'https://x/dolci.webp' })
    expect(result.shouldRemoveStoragePhoto).toBe(true)
  })

  it('lascia category_filter null invariato (legacy tutte le categorie)', () => {
    const result = deleteCategoryKeyFromQrRow('primi', {
      category_filter: null,
      category_images: {},
    })
    expect(result.changed).toBe(false)
    expect(result.category_filter).toBeNull()
  })

  it('non segna changed se la chiave non è presente', () => {
    const row = {
      category_filter: ['dolci'],
      category_images: {},
    }
    const result = deleteCategoryKeyFromQrRow('primi', row)
    expect(result.changed).toBe(false)
    expect(result.category_filter).toEqual(['dolci'])
  })
})

describe('rewriteQrCategoryImageUrlForKeyRename', () => {
  it('riscrivi path canonico cat/{key}.webp', () => {
    const oldUrl = `${BASE}/${TENANT}/qr/${SEGMENT}/cat/primi.webp`
    const next = rewriteQrCategoryImageUrlForKeyRename(
      oldUrl,
      TENANT,
      SEGMENT,
      'primi',
      'secondi_piatti',
      (path) => `${BASE}/${path}`,
    )
    expect(next).toBe(`${BASE}/${TENANT}/qr/${SEGMENT}/cat/secondi_piatti.webp`)
  })

  it('lascia URL esterni invariati', () => {
    const url = 'https://cdn.example.com/photo.jpg'
    expect(
      rewriteQrCategoryImageUrlForKeyRename(url, TENANT, SEGMENT, 'primi', 'secondi', (p) => p),
    ).toBe(url)
  })
})

describe('applyCategoryImageUrlRewritesForRename', () => {
  it('riscrivi solo la entry con newKey', () => {
    const images = {
      secondi_piatti: `${BASE}/${TENANT}/qr/${SEGMENT}/cat/primi.webp`,
      dolci: `${BASE}/${TENANT}/qr/${SEGMENT}/cat/dolci.webp`,
    }
    const out = applyCategoryImageUrlRewritesForRename(
      images,
      TENANT,
      SEGMENT,
      'primi',
      'secondi_piatti',
      (path) => `${BASE}/${path}`,
    )
    expect(out.secondi_piatti).toContain('secondi_piatti.webp')
    expect(out.dolci).toBe(images.dolci)
  })
})
