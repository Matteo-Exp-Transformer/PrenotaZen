/**
 * Pannello ingredienti aperto in `BookingMenuCategoryCard`: max 3 righe tipo "con foto", poi scroll interno.
 *
 * Riga di riferimento (ingrediente con `image_url`, come in JSX):
 * - `py-2` sul label → 1rem padding verticale totale
 * - foto `aspect-4/3` (default) / `sm:aspect-3/2` → altezza ≈ (larghezza contenuto − 1rem) × rapporto
 * - stack `gap-2` tra foto e blocco testo → 0.5rem
 * - footer checkbox/prezzo `min-h-[44px]` → 44px
 * - divisori `h-px` tra righe (inset `px-3`), non gap globale sulla lista
 *
 * Larghezza contenuto foto ≈ larghezza card (`100cqw` con `@container` sull'article) meno `px-2` (1rem).
 * Ingredienti senza foto restano più bassi; il cap resta su 3 slot "pieni" per altezza uniforme.
 */
export const BOOKING_MENU_CATEGORY_PANEL_SCROLL_CLASS =
  'overflow-y-auto overscroll-y-contain max-h-[calc(3*(1rem+0.5rem+44px+(100cqw-1rem)*3/4)+2*1px)] sm:max-h-[calc(3*(1rem+0.5rem+44px+(100cqw-1rem)*2/3)+2*1px)]'

/** Card aperta in portal (`position: fixed`): stessa larghezza della card chiusa (shell), sopra form/riepilogo in scroll (`z-[160]`). Nessuna sticky bar mobile (rimossa 02-06-26). */
export const BOOKING_MENU_CATEGORY_EXPANDED_PORTAL_CLASS = 'fixed z-[160] shadow-xl'

/** True se l'elemento è interamente dentro il contenitore scroll orizzontale (tolleranza px). */
export function isElementFullyVisibleInHorizontalContainer(
  element: Element,
  container: Element,
  tolerancePx = 2,
): boolean {
  const elRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return (
    elRect.left >= containerRect.left - tolerancePx &&
    elRect.right <= containerRect.right + tolerancePx
  )
}
