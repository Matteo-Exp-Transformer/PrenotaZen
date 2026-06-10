import type { BookingRequest } from '@/types/booking'
import { bookingStartsInServiceSlot } from '@/features/booking/utils/serviceSlotBookingFilter'

/** Id prenotazioni con assignment attivo (checked_out_at null) per slot+data. */
export function activeAssignedBookingIds(
  rows: { booking_id: string }[],
): Set<string> {
  return new Set(rows.map((r) => r.booking_id))
}

/** Prenotazioni accettate del giorno nella fascia, escluse quelle ancora assegnate a un tavolo. */
export function filterUnassignedBookingsForSlot(
  bookings: BookingRequest[],
  slotStart: string,
  slotEnd: string,
  assignedActiveIds: Set<string>,
): BookingRequest[] {
  const inSlot = bookings.filter((b) =>
    bookingStartsInServiceSlot(b, slotStart, slotEnd),
  )
  return inSlot.filter((b) => !assignedActiveIds.has(b.id))
}
