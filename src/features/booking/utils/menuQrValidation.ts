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

  // 2 — Carosello: serve almeno una FOTO. I testi della slide (etichetta, titolo,
  // descrizione) sono FACOLTATIVI dal 03-09-26 (decisione Matteo): la pagina pubblica
  // salta i campi vuoti invece di mostrare fallback. Non reintrodurre il requisito
  // "etichetta + titolo compilati". Vedi docs/Menu-QR-Skill/MENU_QR_SKILL.md §3-§4.
  const slidesWithPhoto = carouselItems.filter((item) => !!item.image_url)
  if (slidesWithPhoto.length === 0) {
    return {
      ok: false,
      message: 'Il carosello è obbligatorio: aggiungi almeno una foto.',
    }
  }

  return { ok: true }
}

export function isMenuQrSettingsValid(input: Parameters<typeof validateMenuQrSettings>[0]): boolean {
  return validateMenuQrSettings(input).ok
}
