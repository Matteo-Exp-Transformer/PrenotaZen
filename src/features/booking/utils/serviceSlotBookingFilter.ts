import type { BookingRequest } from '@/types/booking'
import { getAccurateStartTime, trimTimeToHHmm } from '@/features/booking/utils/dateUtils'
import { isTimeInsideSlot } from '@/features/booking/utils/bookingTimeSlots'

/** True se l'ora di inizio della prenotazione cade nella fascia servizio (inclusi estremi). */
export function bookingStartsInServiceSlot(
  booking: BookingRequest,
  slotStart: string,
  slotEnd: string,
): boolean {
  const startTime = getAccurateStartTime(booking)
  if (!startTime) return false

  return isTimeInsideSlot(
    trimTimeToHHmm(startTime),
    trimTimeToHHmm(slotStart),
    trimTimeToHHmm(slotEnd),
  )
}
