/**
 * Utility condivise per il digest giornaliero.
 * Estratte da BookingCalendar.tsx per consentire il riuso nel view model puro
 * e impedire duplicazioni logiche.
 */

import type { BookingRequest } from '@/types/booking'
import { bookingTypeUsesMenuSelections } from './bookingTypeMenu'
import { getAccurateStartTime } from './dateUtils'
import { parseHmToMinutes } from './bookingTimeSlots'
import type { SlotConfig } from './bookingTimeSlots'

export type { SlotConfig }

/**
 * True se la prenotazione prevede menù / rinfresco (non "solo tavolo").
 * Estratta da BookingCalendar.tsx (era inline prima del refactor Fase 0).
 */
export function digestBookingHasMenuContext(booking: BookingRequest): boolean {
  if (booking.menu?.trim()) return true
  if (bookingTypeUsesMenuSelections(booking.booking_type)) return true
  if (booking.preset_menu) return true
  if ((booking.menu_total_per_person ?? 0) > 0) return true
  return !!(booking.menu_selection?.items && booking.menu_selection.items.length > 0)
}

/**
 * Verifica se l'orario in minuti rientra in una fascia.
 * Gestisce l'attraversamento della mezzanotte (end_time < start_time).
 * Estratta dalla vecchia logica inline di partizionamento fasce in BookingCalendar.tsx.
 */
export function isBookingInSlot(
  startMin: number,
  slotStartMin: number,
  slotEndMin: number,
): boolean {
  const crossesMidnight = slotEndMin < slotStartMin
  return crossesMidnight
    ? startMin >= slotStartMin || startMin < slotEndMin
    : startMin >= slotStartMin && startMin < slotEndMin
}

/**
 * Assegna ogni prenotazione alla prima fascia che la contiene, oppure a '__unassigned__'.
 * Stessa regola del vecchio partizionamento inline di BookingCalendar.tsx, ma funzione pura
 * (nessuna dipendenza React / closure).
 */
export function splitBookingsBySlotConfigs(
  bookings: BookingRequest[],
  slots: SlotConfig[],
): Record<string, BookingRequest[]> {
  const bySlot: Record<string, BookingRequest[]> = {}
  for (const s of slots) bySlot[s.id] = []

  for (const booking of bookings) {
    const startTime = getAccurateStartTime(booking)
    const startMin = parseHmToMinutes(startTime)
    let matched = false

    for (const s of slots) {
      const sStart = parseHmToMinutes(s.start_time)
      const sEnd = parseHmToMinutes(s.end_time)
      if (isBookingInSlot(startMin, sStart, sEnd)) {
        bySlot[s.id].push(booking)
        matched = true
        break
      }
    }

    if (!matched) {
      if (!bySlot['__unassigned__']) bySlot['__unassigned__'] = []
      bySlot['__unassigned__'].push(booking)
    }
  }

  return bySlot
}
