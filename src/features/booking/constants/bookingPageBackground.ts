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

export const DEFAULT_BOOKING_FULL_PAGE_BACKGROUND: BookingFullPageBackgroundId = 'full-01'

export function isBookingFullPageBackgroundId(value: string): value is BookingFullPageBackgroundId {
  return (BOOKING_FULL_PAGE_BACKGROUND_IDS as readonly string[]).includes(value)
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

/** Tile PNG in `public/booking/tiles/` (nome file = id + `.png`). */
export const BOOKING_PAGE_TILE_IDS = [
  'tile-01',
  'tile-02',
  'tile-03',
  'tile-04',
  'tile-05',
  'tile-06',
  'tile-07',
  'tile-08',
  'tile-09',
  'tile-10',
  'tile-11',
  'tile-12',
  'tile-13',
  'tile-14',
  'tile-15',
  'tile-16',
  'tile-17',
  'tile-18',
  'tile-19',
  'tile-20',
  'tile-21',
] as const

export type BookingPageTileId = (typeof BOOKING_PAGE_TILE_IDS)[number]

/**
 * Tile «placeholder»: lo slot resta nella griglia per mantenere l'indice/posizione
 * (es. «Texture 11»), ma il file PNG non e piu in `public/booking/tiles/`.
 * In admin la card viene mostrata vuota e disabilitata.
 * Sulla pagina pubblica un eventuale valore salvato come placeholder ricade
 * su sfondo neutro (nessuna texture demo — vedi `parseBookingPageBackgroundFromDb`).
 */
export const BOOKING_PAGE_TILE_PLACEHOLDER_IDS: readonly BookingPageTileId[] = [
  'tile-04',
  'tile-11',
  'tile-16',
  'tile-18',
  'tile-19',
  'tile-20',
  'tile-21',
]

export function isBookingPageTilePlaceholder(value: string): boolean {
  return (BOOKING_PAGE_TILE_PLACEHOLDER_IDS as readonly string[]).includes(value)
}

/** Preset gradienti pagina Prenota: `previewCss` per miniature; `fullCss` per anteprima grande e pagina pubblica. */
export const prenotaGradientPresets = [
  {
    id: 'noce-classico',
    name: 'Noce classico',
    mood: 'Scuro, elegante, classico da ristorante tradizionale.',
    safe: 'molto sicuro',
    previewCss: 'linear-gradient(180deg, #2a1b12 0%, #5b3a25 55%, #8b6242 100%)',
    fullCss:
      'linear-gradient(180deg, #24170f 0%, #3a2417 22%, #5b3a25 58%, #8b6242 100%)',
  },
  {
    id: 'terracotta-viva',
    name: 'Terracotta viva',
    mood: 'Caldo, mediterraneo, più accogliente e solare.',
    safe: 'sicuro',
    previewCss: 'linear-gradient(135deg, #5a2f22 0%, #a65d3f 52%, #ddb18c 100%)',
    fullCss:
      'radial-gradient(circle at 78% 72%, rgba(255,214,182,0.18) 0%, transparent 28%), linear-gradient(135deg, #4c281d 0%, #8f4d35 38%, #b96d49 70%, #e0b48f 100%)',
  },
  {
    id: 'vino-velluto',
    name: 'Vino velluto',
    mood: 'Più raffinato, con tono borgogna smorzato.',
    safe: 'sicuro',
    previewCss: 'linear-gradient(135deg, #2d1718 0%, #6b3b40 55%, #b1908e 100%)',
    fullCss:
      'radial-gradient(circle at 25% 25%, rgba(245,220,210,0.22) 0%, transparent 22%), linear-gradient(135deg, #241314 0%, #4a292c 28%, #6c3f44 58%, #b79a94 100%)',
  },
  {
    id: 'oliva-mediterranea',
    name: 'Oliva mediterranea',
    mood: 'Rustico-chic, naturale, con richiami erbe/ulivo.',
    safe: 'sicuro',
    previewCss: 'linear-gradient(135deg, #2d261d 0%, #6b6444 50%, #c1b693 100%)',
    fullCss:
      'radial-gradient(circle at 18% 78%, rgba(153,150,101,0.28) 0%, transparent 20%), linear-gradient(135deg, #262016 0%, #4a402d 30%, #6f6848 58%, #c2b894 100%)',
  },
  {
    id: 'crema-bistrot',
    name: 'Crema bistrot',
    mood: 'Più chiaro, pulito, morbido, con look ospitale.',
    safe: 'medio',
    previewCss: 'linear-gradient(180deg, #8a6548 0%, #c69b74 52%, #ead5bf 100%)',
    fullCss:
      'radial-gradient(circle at 50% 15%, rgba(255,244,226,0.30) 0%, transparent 24%), linear-gradient(180deg, #7a583f 0%, #b1825b 42%, #d8b391 72%, #f0dfcd 100%)',
  },
  {
    id: 'fumo-e-rame',
    name: 'Fumo e rame',
    mood: 'Scuro, contemporaneo, da pub serale elegante.',
    safe: 'molto sicuro',
    previewCss: 'linear-gradient(135deg, #16110f 0%, #4a2f25 42%, #8c5a43 100%)',
    fullCss:
      'radial-gradient(circle at 72% 25%, rgba(194,126,89,0.22) 0%, transparent 22%), linear-gradient(135deg, #14100e 0%, #241917 22%, #4b3025 52%, #7f523d 100%)',
  },
  {
    id: 'pergamena-calda',
    name: 'Pergamena calda',
    mood: 'Chiaro e materico, più soft, quasi da menu elegante.',
    safe: 'medio',
    previewCss: 'linear-gradient(180deg, #b18a64 0%, #d9bf9f 55%, #f3eadf 100%)',
    fullCss:
      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.20) 0%, transparent 18%), linear-gradient(180deg, #9f7a58 0%, #c9a583 38%, #e1c8ad 68%, #f4ece3 100%)',
  },
  {
    id: 'ambra-serale',
    name: 'Ambra serale',
    mood: 'Caldo serale, tra whisky, legno e luce soffusa.',
    safe: 'molto sicuro',
    previewCss: 'linear-gradient(135deg, #24160f 0%, #6a3d20 48%, #c08a4e 100%)',
    fullCss:
      'radial-gradient(circle at 50% 85%, rgba(255,191,104,0.16) 0%, transparent 25%), linear-gradient(135deg, #20130d 0%, #3a2116 24%, #6a3d20 54%, #b67c42 82%, #d8b07c 100%)',
  },
  {
    id: 'cioccolato-moka',
    name: 'Cioccolato moka',
    mood: 'Molto scuro, premium, intenso ma accogliente.',
    safe: 'molto sicuro',
    previewCss: 'linear-gradient(180deg, #18100c 0%, #3b261b 50%, #6a4935 100%)',
    fullCss:
      'radial-gradient(circle at 80% 18%, rgba(150,110,84,0.18) 0%, transparent 18%), linear-gradient(180deg, #140d0a 0%, #231711 22%, #3c271c 52%, #674834 100%)',
  },
  {
    id: 'rame-rosato',
    name: 'Rame rosato',
    mood: 'Più morbido e moderno, con terracotta rosata.',
    safe: 'sicuro',
    previewCss: 'linear-gradient(135deg, #4a2621 0%, #8c5a4e 52%, #d6b0a0 100%)',
    fullCss:
      'radial-gradient(circle at 82% 20%, rgba(244,210,195,0.20) 0%, transparent 20%), linear-gradient(135deg, #40211d 0%, #6a4038 34%, #986456 62%, #d7b3a3 100%)',
  },
  {
    id: 'sabbia-e-oliva',
    name: 'Sabbia e oliva',
    mood: 'Naturale, luminoso ma non freddo, molto mediterraneo.',
    safe: 'medio',
    previewCss: 'linear-gradient(135deg, #5b4c36 0%, #a89b71 48%, #e8dcc1 100%)',
    fullCss:
      'radial-gradient(circle at 22% 72%, rgba(168,166,107,0.22) 0%, transparent 18%), linear-gradient(135deg, #4a3f2d 0%, #76684a 28%, #ada277 58%, #eadfc6 100%)',
  },
  {
    id: 'notte-bistrot',
    name: 'Notte bistrot',
    mood: 'Più drammatico, da locale serale con luci basse.',
    safe: 'molto sicuro',
    previewCss: 'linear-gradient(135deg, #120d0c 0%, #35201d 42%, #6f4438 100%)',
    fullCss:
      'radial-gradient(circle at 50% 18%, rgba(205,164,122,0.18) 0%, transparent 16%), linear-gradient(135deg, #100c0b 0%, #1c1413 18%, #392321 48%, #6d4337 100%)',
  },
] as const

/** Alias storico nel codice: stessi dati di `prenotaGradientPresets`. */
export const BOOKING_PAGE_GRADIENT_PRESETS = prenotaGradientPresets

export type BookingPageGradientPreset = (typeof prenotaGradientPresets)[number]
export type BookingPageGradientId = BookingPageGradientPreset['id']

export const BOOKING_PAGE_GRADIENT_IDS = prenotaGradientPresets.map((g) => g.id)

export type BookingPageBackgroundId = BookingFullPageBackgroundId | BookingPageTileId | BookingPageGradientId

/** Default: prima texture immagine. */
export const DEFAULT_BOOKING_PAGE_TILE: BookingPageTileId = 'tile-01'
export const DEFAULT_BOOKING_PAGE_BACKGROUND: BookingPageBackgroundId = DEFAULT_BOOKING_FULL_PAGE_BACKGROUND

/** First-paint neutro (crema) quando il tenant non ha configurato sfondo/striscia. */
export const BOOKING_PAGE_NEUTRAL_BACKGROUND_COLOR = '#faf7f1'

/** Radice tecnica sotto gradienti/tile già scelti dal tenant (non sfondo demo pubblico). */
export const BOOKING_PAGE_GRADIENT_ROOT_FALLBACK_COLOR = '#2d2013'

/** Solo anteprima admin se un id gradiente non ha CSS — non usato sulla pagina pubblica senza config tenant. */
const FALLBACK_GRADIENT =
  'linear-gradient(135deg, #2d2013 0%, #5a3923 45%, #8b5f3c 100%)'
/**
 * Versione cache degli asset tile pubblici.
 * Incrementa quando sostituisci i PNG con lo stesso nome (`tile-XX.png`).
 */
const BOOKING_PAGE_TILE_ASSETS_VERSION = '2026-05-07-1'

export function isBookingPageTileId(value: string): value is BookingPageTileId {
  return (BOOKING_PAGE_TILE_IDS as readonly string[]).includes(value)
}

export function isBookingPageGradientId(value: string): value is BookingPageGradientId {
  return (prenotaGradientPresets as readonly { id: string }[]).some((p) => p.id === value)
}

export function isBookingPageBackgroundId(value: string): value is BookingPageBackgroundId {
  return isBookingFullPageBackgroundId(value) || isBookingPageTileId(value) || isBookingPageGradientId(value)
}

export function parseBookingPageBackgroundFromDb(raw: unknown): BookingPageBackgroundId | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  const v = raw.trim().toLowerCase()
  if (!isBookingPageBackgroundId(v)) return null
  /**
   * Se il valore salvato e ora un placeholder (immagine spostata in
   * «Immagini da sistemare/»), evita un 404 sulla pagina pubblica — sfondo neutro.
   */
  if (isBookingPageTilePlaceholder(v)) return null
  return v as BookingPageBackgroundId
}

/** @deprecated Usa parseBookingPageBackgroundFromDb */
export function parseBookingPageTileFromDb(raw: unknown): BookingPageTileId {
  const bg = parseBookingPageBackgroundFromDb(raw)
  if (bg == null) return DEFAULT_BOOKING_PAGE_TILE
  return isBookingPageTileId(bg) ? bg : DEFAULT_BOOKING_PAGE_TILE
}

/** CSS a più strati per pagina pubblica e anteprima grande (`fullCss`). */
export function bookingPageGradientCss(id: BookingPageGradientId): string {
  const preset = prenotaGradientPresets.find((p) => p.id === id)
  return preset?.fullCss?.trim() ? preset.fullCss : FALLBACK_GRADIENT
}

/** CSS semplificato per miniature nella griglia admin (`previewCss`). */
export function bookingPageGradientPreviewCss(id: BookingPageGradientId): string {
  const preset = prenotaGradientPresets.find((p) => p.id === id)
  return preset?.previewCss?.trim() ? preset.previewCss : FALLBACK_GRADIENT
}

/** @deprecated Usa bookingPageGradientPreviewCss */
export function bookingPageGradientThumbCss(id: BookingPageGradientId): string {
  return bookingPageGradientPreviewCss(id)
}

export function bookingPageTilePublicHref(
  id: BookingPageTileId,
  viteBase: string,
  cacheBust?: string
): string {
  const baseHref = `${viteBase}booking/tiles/${id}.png`
  const effectiveCacheBust = cacheBust ?? BOOKING_PAGE_TILE_ASSETS_VERSION
  return `${baseHref}?v=${encodeURIComponent(effectiveCacheBust)}`
}
