import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import type { BookingType } from '@/types/booking'
import { getModeLabelByType } from './bookingModeLabels'

interface BookingLike {
  booking_type?: string | null
}

/** @deprecated Alias storico — la UI admin usa `getModeLabelByType` con `booking_modes`. */
const BOOKING_TYPE_LABELS: Record<string, string> = {
  rinfresco_laurea: 'Rinfresco di Laurea',
  menu_prezzo_fisso: 'Menu a prezzo fisso',
  tavolo: 'Prenota un Tavolo',
}

export const getBookingEventTypeLabel = (
  booking?: BookingLike | null,
  modes: BookingMode[] = [],
): string | null => {
  if (!booking?.booking_type) return null

  const label = getModeLabelByType(modes, booking.booking_type as BookingType)
  if (label && label !== '—') return label

  // Ultimo livello: tipi legacy non in config (raro).
  return BOOKING_TYPE_LABELS[booking.booking_type] ?? null
}

export const BOOKING_TYPE_EVENT_LABELS = BOOKING_TYPE_LABELS
