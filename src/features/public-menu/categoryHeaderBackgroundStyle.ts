import type { CSSProperties } from 'react'

/** Fascia PNG header tema QR — stesso crop di `PublicMenuCategoryPage` (100% auto, top). */
export function categoryHeaderBackgroundStyle(
  headerImage: string | null,
  fallbackBg: string,
): CSSProperties {
  if (headerImage) {
    return {
      backgroundImage: `url(${headerImage})`,
      backgroundSize: '100% auto',
      backgroundPosition: 'center top',
      backgroundRepeat: 'no-repeat',
      backgroundColor: fallbackBg,
    }
  }
  return { backgroundColor: fallbackBg }
}

/** Fascia header su card categoria senza foto (<1025) — riempie tutta la cella 70% (cover). */
export function categoryCardNoPhotoBackgroundStyle(
  headerImage: string | null,
  fallbackBg: string,
): CSSProperties {
  if (headerImage) {
    return {
      backgroundImage: `url(${headerImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: fallbackBg,
    }
  }
  return { backgroundColor: fallbackBg }
}
