/**
 * FU-025 — colonna contenuto Menu QR (homepage + dettaglio categoria).
 * Centrata oltre 1024px viewport; card non si allargano su monitor larghi.
 */
export const PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS =
  'mx-auto flex w-full max-w-[1024px] flex-1 flex-col'

/** Padding-bottom pagina categoria: altezza barra pill (`h-14`) + safe-area iOS. */
export const PUBLIC_MENU_CATEGORY_MAIN_BOTTOM_PAD_CLASS =
  'pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
