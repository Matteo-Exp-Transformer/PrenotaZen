import type { BookingRequest } from '@/types/booking'
import type { CalendarEvent } from '@/types/booking'

import { BOOKING_SLOT_TIME_DEFAULTS } from '../constants/capacity'
import { extractDateFromISO, getAccurateStartTime, getAccurateEndTime } from './dateUtils'

// Colori in base alla fascia oraria (delicati e leggibili)
const TIME_SLOT_COLORS = {
  morning: { bg: '#10B981', border: '#059669', text: '#000000' },           // Verde: 10:00-14:30
  afternoon: { bg: '#FDE047', border: '#FACC15', text: '#000000' },          // Giallo: 14:31-18:30
  evening: { bg: '#93C5FD', border: '#60A5FA', text: '#000000' },           // Azzurro: 18:31-23:30
}

/**
 * Determina il colore in base alla fascia oraria di inizio
 * Uses the same boundaries as capacity config for consistency:
 * - Morning: 10:00 - 14:30
 * - Afternoon: 14:31 - 18:30
 * - Evening: 18:31 - 23:30
 */
function getTimeSlotColor(startDate: Date): { bg: string; border: string; text: string } {
  const hour = startDate.getHours()
  const minute = startDate.getMinutes()
  const totalMinutes = hour * 60 + minute
  
  // Parse capacity config boundaries
  const [morningStartHour, morningStartMin] = BOOKING_SLOT_TIME_DEFAULTS.MORNING_START.split(':').map(Number)
  const [morningEndHour, morningEndMin] = BOOKING_SLOT_TIME_DEFAULTS.MORNING_END.split(':').map(Number)
  const [afternoonStartHour, afternoonStartMin] = BOOKING_SLOT_TIME_DEFAULTS.AFTERNOON_START.split(':').map(Number)
  const [afternoonEndHour, afternoonEndMin] = BOOKING_SLOT_TIME_DEFAULTS.AFTERNOON_END.split(':').map(Number)
  const [eveningStartHour, eveningStartMin] = BOOKING_SLOT_TIME_DEFAULTS.EVENING_START.split(':').map(Number)
  const [eveningEndHour, eveningEndMin] = BOOKING_SLOT_TIME_DEFAULTS.EVENING_END.split(':').map(Number)
  
  const morningStart = morningStartHour * 60 + morningStartMin  // 10:00 = 600
  const morningEnd = morningEndHour * 60 + morningEndMin         // 14:30 = 870
  const afternoonStart = afternoonStartHour * 60 + afternoonStartMin  // 14:31 = 871
  const afternoonEnd = afternoonEndHour * 60 + afternoonEndMin    // 18:30 = 1110
  const eveningStart = eveningStartHour * 60 + eveningStartMin    // 18:31 = 1111
  const eveningEnd = eveningEndHour * 60 + eveningEndMin         // 23:30 = 1410
  
  if (totalMinutes >= morningStart && totalMinutes <= morningEnd) {
    return TIME_SLOT_COLORS.morning
  } else if (totalMinutes >= afternoonStart && totalMinutes <= afternoonEnd) {
    return TIME_SLOT_COLORS.afternoon
  } else if (totalMinutes >= eveningStart && totalMinutes <= eveningEnd) {
    return TIME_SLOT_COLORS.evening
  } else {
    // Default to evening if outside all ranges
    return TIME_SLOT_COLORS.evening
  }
}

export const transformBookingToCalendarEvent = (
  booking: BookingRequest
): CalendarEvent => {
  // Usa helper centralizzati per evitare shift timezone
  const startTimeStr = getAccurateStartTime(booking)
  const endTimeStr = getAccurateEndTime(booking)
  const dateStr = booking.confirmed_start ? extractDateFromISO(booking.confirmed_start) : ''

  let startDate: Date
  let endDate: Date

  // Costruisci Date objects usando desired_time per accuratezza
  if (startTimeStr && endTimeStr && dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number)
    const [startHour, startMinute] = startTimeStr.split(':').map(Number)
    const [endHour, endMinute] = endTimeStr.split(':').map(Number)

    // Crea date con orari estratti direttamente (no timezone conversion)
    startDate = new Date(year, month - 1, day, startHour, startMinute, 0)

    // Crea endDate sullo stesso giorno e spostalo al giorno dopo se attraversa mezzanotte.
    // NOTE: usare setDate evita bug a fine mese/anno (es. 31 -> 1 del mese successivo).
    endDate = new Date(year, month - 1, day, endHour, endMinute, 0)
    if (
      endHour < startHour ||
      (endHour === startHour && endMinute <= startMinute)
    ) {
      endDate.setDate(endDate.getDate() + 1)
    }
  } else {
    // Fallback al vecchio metodo se mancano i campi
    const startStr = booking.confirmed_start!
    const endStr = booking.confirmed_end!

    const startMatch = startStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    const endMatch = endStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)

    if (startMatch && endMatch) {
      const [, year, month, day, hour, minute, second] = startMatch
      startDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      )

      const [, endYear, endMonth, endDay, endHour, endMinute, endSecond] = endMatch
      endDate = new Date(
        parseInt(endYear),
        parseInt(endMonth) - 1,
        parseInt(endDay),
        parseInt(endHour),
        parseInt(endMinute),
        parseInt(endSecond)
      )
    } else {
      startDate = new Date(startStr)
      endDate = new Date(endStr)
    }
  }

  const color = getTimeSlotColor(startDate)

  // Ensure event ends before midnight of the same day to prevent overflow.
  // IMPORTANT: confronta la data in locale (non UTC) per evitare bug di timezone con toISOString().
  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()
  
  // If the event is multi-day, clamp it to end at 23:59:59 of the start day
  let eventEnd = endDate
  if (!sameDay) {
    eventEnd = new Date(startDate)
    eventEnd.setHours(23, 59, 59, 999)
  }

  // Aggiungi icona per distinguere l'origine della prenotazione
  const sourceIcon = booking.booking_source === 'admin' ? '👤 ' : '📞 '
  
  const event: CalendarEvent = {
    id: booking.id,
    title: `${sourceIcon}${booking.client_name} - ${booking.num_guests} ospiti`,
    start: startDate,
    end: eventEnd,
    allDay: false,
    backgroundColor: color.bg,
    borderColor: color.border,
    extendedProps: booking,
  }
  
  if (color.text) {
    event.textColor = color.text
  }
  
  return event
}

export const transformBookingsToCalendarEvents = (
  bookings: BookingRequest[]
): CalendarEvent[] => {
  return bookings
    .filter((b) => b.status === 'accepted' && b.confirmed_start && b.confirmed_end)
    .map(transformBookingToCalendarEvent)
}

