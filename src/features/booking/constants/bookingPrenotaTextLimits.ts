import type { BookingHeaderTextTarget } from './bookingPublicFormConfig'

/** Limiti testi slide carosello Prenota (editor + normalizer + migration 040). */
export const BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS = {
  eyebrow: 19,
  title: 18,
  description: 38,
} as const

/** Campi cliente — cap generoso, solo sistema (UI silenziosa + edge create-booking). */
export const BOOKING_PUBLIC_CLIENT_TEXT_LIMITS = {
  clientName: 65,
  clientEmail: 65,
  clientPhone: 30,
  dietaryText: 550,
  specialRequests: 550,
  numGuestsMax: 110,
} as const

/** Copy ristoratore su Pagina Prenota — contatore admin. */
export const BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS = {
  /** Nome locale (Anagrafica + h1 Pagina Prenota). */
  restaurantName: 45,
  /** Contatti anagrafica (Impostazioni → footer Prenota). */
  contactEmail: 65,
  contactPhone: 30,
  contactAddress: 120,
  pageTitle: 50,
  pageDescription: 120,
  modeLabel: 40,
  modeDescription: 61,
  subTabLabel: 24,
  subTabDescription: 79,
  subTabCoursesLabel: 12,
  promoTitle: 60,
  promoMessage: 200,
} as const

/**
 * Tab Menu compose (Pagina Prenota) — cap anti-rottura mobile (prova FU-030 Fase 1).
 * Allineati a sottotab card: label/nome 24, descrizione 79.
 */
export const BOOKING_MENU_COMPOSE_TEXT_LIMITS = {
  categoryLabel: BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
  itemName: BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
  itemDescription: BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription,
} as const

export const BOOKING_HEADER_FONT_SIZE_MIN = 8

/** Tetto fontSize (px) per target header — descrizione resta sotto titolo/nome. */
export const BOOKING_HEADER_FONT_SIZE_MAX_BY_TARGET: Record<BookingHeaderTextTarget, number> = {
  restaurant_name: 38,
  page_title: 38,
  page_description: 28,
}

/** Legacy globale (nome + titolo); preferire BOOKING_HEADER_FONT_SIZE_MAX_BY_TARGET. */
export const BOOKING_HEADER_FONT_SIZE_MAX = 38

export const BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE = 'Testo troppo lungo'

export function clampBookingText(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max)
}

export function clampBookingTextOptional(
  value: string | undefined | null,
  max: number,
): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

export function isWithinBookingTextLimit(value: string, max: number): boolean {
  return value.length <= max
}

export function getBookingHeaderFontSizeMax(target: BookingHeaderTextTarget): number {
  return BOOKING_HEADER_FONT_SIZE_MAX_BY_TARGET[target]
}

export function normalizeBookingHeaderFontSizeForTarget(
  value: unknown,
  target: BookingHeaderTextTarget,
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') return fallback
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  const rounded = Math.round(num)
  const max = getBookingHeaderFontSizeMax(target)
  return Math.min(max, Math.max(BOOKING_HEADER_FONT_SIZE_MIN, rounded))
}

/** Lunghezza testo intolleranze come serializzato in submit (restriction + notes). */
export function getDietaryRestrictionsTextLength(
  restrictions: ReadonlyArray<{ restriction?: string; notes?: string }> | null | undefined,
): number {
  if (!restrictions?.length) return 0
  return restrictions.reduce((sum, r) => {
    const restriction = r.restriction?.trim() ?? ''
    const notes = r.notes?.trim() ?? ''
    return sum + restriction.length + notes.length
  }, 0)
}
