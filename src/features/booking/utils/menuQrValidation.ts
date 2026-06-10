import type { CarouselItem, MenuItem } from '@/types/menu'

export type MenuQrValidationResult = { ok: true } | { ok: false; message: string }

export function validateMenuQrSettings(input: {
  carouselItems: CarouselItem[]
  categoryFilter: string[]
  itemsByCategory: Record<string, MenuItem[]>
  hiddenItemIds: string[]
}): MenuQrValidationResult {
  const { carouselItems, categoryFilter, itemsByCategory, hiddenItemIds } = input

  // 1 — Categorie (priorità massima: mostrare prima questo se ci sono più errori)
  if (categoryFilter.length === 0) {
    return {
      ok: false,
      message: 'Seleziona almeno una categoria di prodotti visibili nel menù QR.',
    }
  }

  const hidden = new Set(hiddenItemIds)
  let visibleCount = 0
  for (const key of categoryFilter) {
    const items = itemsByCategory[key] ?? []
    visibleCount += items.filter((i) => !hidden.has(i.id)).length
  }

  if (visibleCount === 0) {
    return {
      ok: false,
      message:
        'Almeno una categoria selezionata deve avere almeno un ingrediente visibile per il cliente.',
    }
  }

  // 2 — Carosello
  if (carouselItems.length === 0) {
    return {
      ok: false,
      message:
        'Il carosello è obbligatorio: aggiungi almeno una foto con etichetta e titolo compilati.',
    }
  }

  for (const item of carouselItems) {
    const hasAny =
      !!item.image_url || !!item.eyebrow?.trim() || !!item.title?.trim() || !!item.description?.trim()
    const isComplete = !!item.image_url && !!item.eyebrow?.trim() && !!item.title?.trim()
    if (hasAny && !isComplete) {
      return {
        ok: false,
        message:
          'Ogni foto del carosello deve avere etichetta e titolo compilati, oppure rimuovi la slide incompleta.',
      }
    }
  }

  const completeSlides = carouselItems.filter(
    (item) => item.image_url && item.eyebrow?.trim() && item.title?.trim(),
  )
  if (completeSlides.length === 0) {
    return {
      ok: false,
      message:
        'Il carosello è obbligatorio: aggiungi almeno una foto con etichetta e titolo compilati.',
    }
  }

  return { ok: true }
}

export function isMenuQrSettingsValid(input: Parameters<typeof validateMenuQrSettings>[0]): boolean {
  return validateMenuQrSettings(input).ok
}
