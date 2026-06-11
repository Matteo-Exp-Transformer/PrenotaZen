import type { BookingRequest } from '@/types/booking'
import { extractDateFromISO } from './dateUtils'
import {
  isTimeInsideSlot,
  parseHmToMinutes,
  slotRangesOverlap,
  type SlotConfig,
} from './bookingTimeSlots'

// Tipi nuovi per N slot -------------------------------------------------------

export interface SlotCapacityEntry {
  slotId: string
  name: string
  capacity: number | null
  occupied: number
  available: number | null
}

export interface DailyCapacityV2 {
  date: string
  slots: SlotCapacityEntry[]
}

// Helper interni --------------------------------------------------------------

function extractTimeFromISO(isoString: string): string {
  const match = isoString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  if (match) return `${match[4]}:${match[5]}`
  return isoString.split('T')[1]?.substring(0, 5) ?? ''
}

// N-slot API (nuova) ----------------------------------------------------------

/**
 * Restituisce i `SlotConfig.id` occupati da una prenotazione (overlap con i range della fascia).
 * Una prenotazione occupa una fascia se il suo range si sovrappone al range della fascia.
 */
export function getSlotsOccupiedByBookingV2(
  start: string,
  end: string,
  slots: SlotConfig[]
): string[] {
  const startTime = extractTimeFromISO(start)
  const endTime = extractTimeFromISO(end)
  const startMinutes = parseHmToMinutes(startTime)
  const endMinutes = parseHmToMinutes(endTime)
  const bookingCrossesMidnight = endMinutes < startMinutes

  const result: string[] = []
  for (const slot of slots) {
    const overlaps = bookingCrossesMidnight
      ? slotRangesOverlap(startTime, '23:59', slot.start_time, slot.end_time) ||
        slotRangesOverlap('00:00', endTime, slot.start_time, slot.end_time)
      : slotRangesOverlap(startTime, endTime, slot.start_time, slot.end_time)
    if (overlaps) result.push(slot.id)
  }
  return result
}

/**
 * Ritorna l'id della fascia in cui cade l'orario di inizio della prenotazione.
 * Prende la prima fascia (per display_order) che contiene l'orario.
 * Se nessuna → fallback all'ultima fascia (comportamento legacy preservato).
 */
export function getStartSlotForBookingV2(start: string, slots: SlotConfig[]): string {
  if (slots.length === 0) return 'daily'
  const startTime = extractTimeFromISO(start)
  const sorted = [...slots].sort((a, b) => a.display_order - b.display_order)
  for (const slot of sorted) {
    if (isTimeInsideSlot(startTime, slot.start_time, slot.end_time)) return slot.id
  }
  return '__unassigned__'
}

/**
 * Calcola la capacity giornaliera per N fasce dinamiche.
 * `slotCapacities`: Record<slotId, number | null>
 */
export function calculateDailyCapacityV2(
  date: string,
  bookings: BookingRequest[],
  slots: SlotConfig[],
  slotCapacities: Record<string, number | null> = {}
): DailyCapacityV2 {
  const counters: Record<string, number> = {}
  for (const slot of slots) counters[slot.id] = 0

  const dayBookings = bookings.filter((b) => {
    if (!b.confirmed_start) return false
    return extractDateFromISO(b.confirmed_start) === date
  })

  for (const booking of dayBookings) {
    if (!booking.confirmed_start || !booking.confirmed_end) continue
    const occupied = getSlotsOccupiedByBookingV2(booking.confirmed_start, booking.confirmed_end, slots)
    for (const slotId of occupied) {
      if (slotId in counters) counters[slotId] += booking.num_guests ?? 0
    }
  }

  const entries: SlotCapacityEntry[] = slots.map((slot) => {
    const cap = slotCapacities[slot.id] ?? null
    const occ = counters[slot.id] ?? 0
    return {
      slotId: slot.id,
      name: slot.name,
      capacity: cap,
      occupied: occ,
      available: cap == null ? null : cap - occ,
    }
  })

  return { date, slots: entries }
}

/**
 * Somma i coperti per data (YYYY-MM-DD) per il badge «% riempimento» del calendario.
 * Stesso criterio del blocco pubblico giornaliero (edge create-booking) e del digest:
 * conta SOLO le prenotazioni accettate, NON no-show, con confirmed_start E confirmed_end
 * (stesso criterio di digest/eventi FC). Decisione Matteo 11-06-26: i no-show liberano il posto.
 */
export function sumGuestsByDate(bookings: BookingRequest[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const b of bookings) {
    if (b.status !== 'accepted' || b.no_show || !b.confirmed_start || !b.confirmed_end) continue
    const date = extractDateFromISO(b.confirmed_start)
    if (!date) continue
    acc[date] = (acc[date] ?? 0) + (b.num_guests ?? 0)
  }
  return acc
}

