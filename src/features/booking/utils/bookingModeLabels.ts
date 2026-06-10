import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import type { BookingType } from '@/types/booking'

/**
 * Restituisce la label della modalità da mostrare nel riepilogo.
 * - Se la modalità esiste in DB e abilitata, vince la sua `label`.
 * - Altrimenti fallback statico in due varianti: long (sidebar desktop), short (sticky bar mobile).
 */
export function getModeLabelByType(
  modes: BookingMode[],
  bookingType: BookingType | undefined,
  variant: 'long' | 'short' = 'long',
): string {
  const mode = modes.find((m) => m.booking_type === bookingType && m.enabled)
  if (mode) return mode.label
  const longMap: Record<string, string> = {
    tavolo: 'Prenota un Tavolo',
    menu_prezzo_fisso: 'Menu a Prezzo Fisso',
    rinfresco_laurea: 'Rinfresco di Laurea',
  }
  const shortMap: Record<string, string> = {
    tavolo: 'Tavolo',
    menu_prezzo_fisso: 'Menu Fisso',
    rinfresco_laurea: 'Rinfresco',
  }
  const map = variant === 'short' ? shortMap : longMap
  return map[bookingType ?? ''] ?? (variant === 'short' ? '' : '—')
}
