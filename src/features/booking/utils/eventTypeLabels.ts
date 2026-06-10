const BOOKING_TYPE_LABELS: Record<string, string> = {
  rinfresco_laurea: 'Rinfresco di Laurea',
  menu_prezzo_fisso: 'Menu a prezzo fisso',
  tavolo: 'Prenota un Tavolo'
}

interface BookingLike {
  booking_type?: string | null
}

export const getBookingEventTypeLabel = (booking?: BookingLike | null): string | null => {
  if (!booking) return null

  if (booking.booking_type && BOOKING_TYPE_LABELS[booking.booking_type]) {
    return BOOKING_TYPE_LABELS[booking.booking_type]
  }

  return null
}

export const BOOKING_TYPE_EVENT_LABELS = BOOKING_TYPE_LABELS

