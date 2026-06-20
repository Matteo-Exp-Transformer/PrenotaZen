/**
 * Attenzione visiva e scroll su errori — Pagina Prenota (form pubblico).
 *
 * Replica su altri form: leggi `docs/per-ui-design-skill/FORM_VALIDATION_ATTENTION_PATTERN.md`.
 * Orchestrazione: `BookingRequestForm.focusFirstValidationIssue`.
 * CSS pulse: `index.css` → `.booking-public-field-attention`.
 */
import type { SyntheticEvent } from 'react'

/** Evento sincrono: chiude tutte le `BookingMenuCategoryCard` aperte (submit con errori). */
export const BOOKING_MENU_COMPOSE_COLLAPSE_EVENT = 'booking-menu-compose-collapse'

export function dispatchBookingMenuComposeCollapse(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(BOOKING_MENU_COMPOSE_COLLAPSE_EVENT))
}

/** Solo interazioni utente reali — ignora focus programmatico post-scroll. */
export function shouldDismissBookingPublicAttention(event: Event | SyntheticEvent): boolean {
  if ('nativeEvent' in event && event.nativeEvent instanceof Event) {
    return event.nativeEvent.isTrusted
  }
  if ('isTrusted' in event) {
    return (event as Event).isTrusted
  }
  return true
}

/** Mappa chiavi errore validate() → id DOM del controllo o sezione. */
export const BOOKING_PUBLIC_ERROR_FIELD_IDS: Record<string, string> = {
  client_name: 'client_name',
  client_email: 'client_email',
  client_phone: 'client_phone',
  desired_date: 'desired_date',
  desired_time: 'desired_time',
  num_guests: 'num_guests',
  booking_type: 'booking-sub-tabs-section',
  menu: 'menu-section',
  privacyAccepted: 'privacy-consent-dietary',
  dietaryConsent: 'dietary-consent-section',
  dietary: 'dietary-notes',
  special_requests: 'special_requests',
}

/** Riserva spazio sopra/sotto per sticky bar mobile (~140px) e header. */
export const BOOKING_PUBLIC_FIELD_SCROLL_MARGIN = 'scroll-mt-24 scroll-mb-36 min-[1256px]:scroll-mt-16 min-[1256px]:scroll-mb-8'

export const BOOKING_PUBLIC_FIELD_ATTENTION_CLASS = 'booking-public-field-attention'

export function resolveBookingPublicErrorElementId(errorKey: string): string | null {
  let fieldId = BOOKING_PUBLIC_ERROR_FIELD_IDS[errorKey]
  if (!fieldId) return null
  if (errorKey === 'menu' && !document.getElementById(fieldId)) {
    fieldId = 'booking-sub-tabs-section'
  }
  return fieldId
}

/**
 * Scroll al campo/sezione errore: centrato se possibile, altrimenti completamente visibile
 * con margine per sticky bar mobile.
 */
export function scrollToBookingPublicError(errorKey: string): void {
  const fieldId = resolveBookingPublicErrorElementId(errorKey)
  if (!fieldId) return

  const element = document.getElementById(fieldId)
  if (!element) return

  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
}
