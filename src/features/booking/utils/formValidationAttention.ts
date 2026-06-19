/**
 * Utility condivise per scroll + attenzione visiva su errori form (admin e pubblico).
 * Pattern: `docs/per-ui-design-skill/FORM_VALIDATION_ATTENTION_PATTERN.md`
 */
import type { PointerEvent, SyntheticEvent } from 'react'
import {
  BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
  shouldDismissBookingPublicAttention,
} from './bookingPublicFormAttention'

export { BOOKING_PUBLIC_FIELD_ATTENTION_CLASS, shouldDismissBookingPublicAttention }

export function runAfterTripleAnimationFrame(callback: () => void): void {
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback)
    })
  })
}

export function resolveFormErrorElementId(
  errorKey: string,
  errorFieldIds: Record<string, string>,
): string | null {
  return errorFieldIds[errorKey] ?? null
}

export function scrollToFormValidationError(
  errorKey: string,
  errorFieldIds: Record<string, string>,
  resolveId?: (key: string) => string | null,
): void {
  const fieldId = resolveId
    ? resolveId(errorKey)
    : resolveFormErrorElementId(errorKey, errorFieldIds)
  if (!fieldId) return

  const element = document.getElementById(fieldId)
  if (!element) return

  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
}

export function getFormFieldAttentionProps(
  fieldKey: string,
  attentionFieldKey: string | null,
  onClearAttention: () => void,
): {
  className?: string
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void
} {
  const showAttention = attentionFieldKey === fieldKey
  if (!showAttention) return {}

  return {
    className: BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
    onPointerDown: (event) => {
      if (shouldDismissBookingPublicAttention(event)) onClearAttention()
    },
  }
}

export type FormValidationAttentionDismissEvent = Event | SyntheticEvent

/** Mappa errori validate() → id DOM — form prenotazione admin (calendario / drawer). */
export const ADMIN_BOOKING_ERROR_FIELD_IDS: Record<string, string> = {
  client_name: 'client_name',
  client_email: 'client_email',
  client_phone: 'client_phone',
  num_guests: 'num_guests',
  booking_type: 'booking_type',
  desired_date: 'desired_date',
  desired_time: 'desired_time',
  menu: 'menu-section',
}
