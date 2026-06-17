import type { PublicBookingSurface } from './bookingPublicFieldStyles'
import { resolvePublicBookingSurface } from './bookingPublicFieldStyles'

/**
 * Foto della striscia laterale sinistra nella pagina Prenota.
 * File in `public/asset/strip/` con nome `strip-NN.png`.
 * Per aggiungere foto: aggiungere l'ID qui e mettere il file nella cartella.
 */
export const BOOKING_STRIP_PHOTO_IDS = [
  'strip-01',
  'strip-02',
  'strip-03',
  'strip-04',
  'strip-05',
  'strip-06',
] as const

/**
 * Mappa estensione file per ciascun preset.
 * `strip-01..03` sono PNG (vecchio set "seconda prova"); `strip-04..06` sono WebP HD (1440×4320).
 * Quando aggiungi nuove foto, registra qui l'estensione corretta.
 */
const STRIP_PHOTO_EXTENSIONS: Record<string, 'png' | 'webp'> = {
  'strip-01': 'png',
  'strip-02': 'png',
  'strip-03': 'png',
  'strip-04': 'webp',
  'strip-05': 'webp',
  'strip-06': 'webp',
}

export type BookingStripPhotoId = (typeof BOOKING_STRIP_PHOTO_IDS)[number]

export const DEFAULT_BOOKING_STRIP_PHOTO: BookingStripPhotoId = 'strip-01'

export function isBookingStripPhotoId(value: string): value is BookingStripPhotoId {
  return (BOOKING_STRIP_PHOTO_IDS as readonly string[]).includes(value)
}

export function parseBookingStripPhotoFromDb(raw: unknown): BookingStripPhotoId | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const v = raw.trim().toLowerCase()
  return isBookingStripPhotoId(v) ? (v as BookingStripPhotoId) : null
}

/**
 * URL pubblico della foto striscia.
 * `base` = `import.meta.env.BASE_URL` (Vite).
 * I file hanno spazi nel nome originale; usiamo encodeURIComponent per sicurezza.
 */
export function bookingStripPhotoPublicHref(id: BookingStripPhotoId, base: string): string {
  const ext = STRIP_PHOTO_EXTENSIONS[id] ?? 'png'
  return `${base}asset/strip/${id}.${ext}`
}

/** Tutte le URL in ordine, pronte per lo scroll verticale della striscia. */
export function allBookingStripPhotoHrefs(base: string): string[] {
  return BOOKING_STRIP_PHOTO_IDS.map((id) => bookingStripPhotoPublicHref(id, base))
}

/**
 * Foto a pagina intera nella pagina Prenota.
 * File in `public/asset/sfondo intero/` con nome `full-NN-(landscape|portrait).webp`.
 * Set sfondo3 (31-05-26): landscape 1672×941, portrait 941×1672 — da
 * `immagini di prova/sfondo 3/` (a→01, b→02, c→03, e→04; `.png` landscape, `mobile` portrait).
 */
export const BOOKING_FULL_PAGE_BACKGROUND_IDS = [
  'full-01',
  'full-02',
  'full-03',
  'full-04',
] as const

export type BookingFullPageBackgroundId = (typeof BOOKING_FULL_PAGE_BACKGROUND_IDS)[number]

/** Alias prodotto: sfondo pagina = solo preset full-page (D-M2: niente gradienti/tile). */
export type BookingPageBackgroundId = BookingFullPageBackgroundId

export const DEFAULT_BOOKING_FULL_PAGE_BACKGROUND: BookingFullPageBackgroundId = 'full-01'
export const DEFAULT_BOOKING_PAGE_BACKGROUND: BookingPageBackgroundId = DEFAULT_BOOKING_FULL_PAGE_BACKGROUND

export function isBookingFullPageBackgroundId(value: string): value is BookingFullPageBackgroundId {
  return (BOOKING_FULL_PAGE_BACKGROUND_IDS as readonly string[]).includes(value)
}

export function isBookingPageBackgroundId(value: string): value is BookingPageBackgroundId {
  return isBookingFullPageBackgroundId(value)
}

/**
 * Valori legacy gradiente/tile in DB → null (migrate-on-read: pubblico usa crema neutra).
 * Solo `full-01`…`full-04` sono ammessi come sfondo tenant.
 */
export function parseBookingPageBackgroundFromDb(raw: unknown): BookingPageBackgroundId | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const v = raw.trim().toLowerCase()
  return isBookingFullPageBackgroundId(v) ? v : null
}

/**
 * URL pubblico della foto a pagina intera.
 * Restituisce per default la variante landscape; passare `orientation: 'portrait'`
 * per la versione 9:16 servita su viewport mobile portrait (<768px).
 * File in `public/asset/sfondo intero/full-NN-(landscape|portrait).webp`.
 */
export function bookingFullPageBackgroundPublicHref(
  id: BookingFullPageBackgroundId,
  base: string,
  orientation: 'landscape' | 'portrait' = 'landscape',
): string {
  return `${base}asset/${encodeURIComponent('sfondo intero')}/${id}-${orientation}.webp`
}

/** Crema tecnica: striscia-mode, assenza scelta decorativa, primo paint full-page. */
export const BOOKING_PAGE_NEUTRAL_BACKGROUND_COLOR = '#faf7f1'

/** Modalità layout pubblico dopo XOR striscia / full-page / neutro (D-M2). */
export type PublicBookingPageLayoutMode = 'strip' | 'full-page' | 'neutral'

/**
 * Contratto unico pagina Prenota: un solo resolver da valori registry (post parseFromDb).
 * Evita catene di booleani (`showPhotoStrip`, `isFullPagePhoto`) sparse nel JSX.
 */
export interface PublicBookingPageLayout {
  mode: PublicBookingPageLayoutMode
  surface: PublicBookingSurface
  stripPhotoId: BookingStripPhotoId | null
  fullPagePhotoId: BookingFullPageBackgroundId | null
  rootBackgroundColor: typeof BOOKING_PAGE_NEUTRAL_BACKGROUND_COLOR
}

export function resolvePublicBookingPageLayout(query: {
  pageBackground: BookingPageBackgroundId | null
  stripPhotoId: BookingStripPhotoId | null
}): PublicBookingPageLayout {
  const stripPhotoId = query.stripPhotoId
  const showPhotoStrip = stripPhotoId != null
  const fullPagePhotoId =
    !showPhotoStrip &&
    query.pageBackground != null &&
    isBookingFullPageBackgroundId(query.pageBackground)
      ? query.pageBackground
      : null
  const isFullPagePhoto = fullPagePhotoId != null
  const surface = resolvePublicBookingSurface({ showPhotoStrip, isFullPagePhoto })
  const mode: PublicBookingPageLayoutMode = showPhotoStrip
    ? 'strip'
    : isFullPagePhoto
      ? 'full-page'
      : 'neutral'

  return {
    mode,
    surface,
    stripPhotoId: showPhotoStrip ? stripPhotoId : null,
    fullPagePhotoId,
    rootBackgroundColor: BOOKING_PAGE_NEUTRAL_BACKGROUND_COLOR,
  }
}

/** Stato editor admin Impostazioni — default full-01 solo anteprima, non equivale a DB null. */
export type AdminBookingBackgroundEditorState = {
  mode: 'strip' | 'full'
  stripPhoto: BookingStripPhotoId | null
  pageBackground: BookingPageBackgroundId
}

export function hydrateAdminBookingBackgroundEditor(query: {
  stripPhotoId: BookingStripPhotoId | null
  pageBackground: BookingPageBackgroundId | null
}): AdminBookingBackgroundEditorState {
  if (query.stripPhotoId != null) {
    return {
      mode: 'strip',
      stripPhoto: query.stripPhotoId,
      pageBackground: query.pageBackground ?? DEFAULT_BOOKING_FULL_PAGE_BACKGROUND,
    }
  }
  return {
    mode: 'full',
    stripPhoto: null,
    pageBackground: query.pageBackground ?? DEFAULT_BOOKING_FULL_PAGE_BACKGROUND,
  }
}

export function isAdminBookingBackgroundDirty(
  saved: { stripPhotoId: BookingStripPhotoId | null; pageBackground: BookingPageBackgroundId | null },
  editor: Pick<AdminBookingBackgroundEditorState, 'stripPhoto' | 'pageBackground'>,
): boolean {
  return (
    editor.stripPhoto !== saved.stripPhotoId ||
    editor.pageBackground !== (saved.pageBackground ?? DEFAULT_BOOKING_FULL_PAGE_BACKGROUND)
  )
}
