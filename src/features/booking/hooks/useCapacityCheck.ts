import { useMemo } from 'react'
import type { BookingRequest, AvailabilityCheck } from '@/types/booking'
import { DEFAULT_SLOT_GUEST_CAPACITIES } from '@/features/booking/lib/restaurantSettingRegistry'
import { extractDateFromISO } from '../utils/dateUtils'
import { useRestaurantSetting } from './useRestaurantSetting'
import { parseHmToMinutes, slotRangesOverlap } from '../utils/bookingTimeSlots'
import { useDigestSlotConfigs, useServiceSlots, type SlotConfig } from './useServiceSlots'
import { useServiceSlotOverrides, resolveSlotOverride } from './useServiceSlotOverrides'
import { useFeatures } from '@/hooks/useFeatures'

interface UseCapacityCheckParams {
  date: string
  startTime: string
  endTime: string
  numGuests: number
  acceptedBookings: BookingRequest[]
  excludeBookingId?: string
}

function getSlotsOccupiedByTime(
  startTime: string,
  endTime: string,
  slots: SlotConfig[]
): string[] {
  const startMinutes = parseHmToMinutes(startTime)
  const endMinutes = parseHmToMinutes(endTime)
  const crossesMidnight = endMinutes < startMinutes

  return slots
    .filter((slot) => {
      const overlaps = crossesMidnight
        ? slotRangesOverlap(startTime, '23:59', slot.start_time, slot.end_time) ||
          slotRangesOverlap('00:00', endTime, slot.start_time, slot.end_time)
        : slotRangesOverlap(startTime, endTime, slot.start_time, slot.end_time)
      return overlaps
    })
    .map((s) => s.id)
}

export function useCapacityCheck(params: UseCapacityCheckParams): AvailabilityCheck {
  const { date, startTime, endTime, numGuests, acceptedBookings, excludeBookingId } = params
  const features = useFeatures()
  const { data: digestSlots } = useDigestSlotConfigs()
  const { data: serviceSlots = [] } = useServiceSlots()
  const { data: slotOverrides = [] } = useServiceSlotOverrides()
  const slotGuestCapacitiesQuery = useRestaurantSetting('slot_guest_capacities', {
    authenticated: true,
  })
  const timeSlotsEnabledQuery = useRestaurantSetting('booking_time_slots_enabled', {
    authenticated: true,
  })

  const legacySlotCapacities = slotGuestCapacitiesQuery.data ?? DEFAULT_SLOT_GUEST_CAPACITIES
  const slots = digestSlots ?? []
  // In Pro le fasce sono sempre attive; in Classic rispetta il flag
  const timeSlotsEnabled = features.servizio ? true : (timeSlotsEnabledQuery.data ?? true)

  return useMemo(() => {
    // Capacita per fascia: service_slots.max_guests > slot_guest_capacities (per slot.id o legacy key)
    const getSlotCap = (slot: SlotConfig): number | null => {
      const svcSlot = serviceSlots.find((s) => s.id === slot.id)
      if (date && svcSlot) {
        const ov = resolveSlotOverride(slotOverrides, slot.id, date)
        if (ov) return ov.max_guests
        if (svcSlot.max_guests != null) return svcSlot.max_guests
      } else if (svcSlot?.max_guests != null) {
        return svcSlot.max_guests
      }
      // Fallback a slot_guest_capacities: prima prova per id, poi per chiave legacy
      const byId = legacySlotCapacities[slot.id]
      if (byId !== undefined) return byId
      return null
    }

    // Prenotazioni del giorno (escluse quelle da escludere)
    const dayBookings = acceptedBookings.filter((booking) => {
      if (booking.id === excludeBookingId) return false
      if (booking.no_show) return false
      if (!booking.confirmed_start) return false
      return extractDateFromISO(booking.confirmed_start) === date
    })

    // Se data/ora/ospiti non ancora selezionati: ritorna disponibile con slot vuoti
    if (!date || !startTime || !endTime || numGuests === 0) {
      const slotsStatus = slots.map((slot) => ({
        slot: slot.id,
        capacity: getSlotCap(slot),
        occupied: 0,
        available: getSlotCap(slot),
      }))
      return { isAvailable: true, slotsStatus }
    }

    let isAvailable = true
    const errorMessages: string[] = []
    const exceededSlots: AvailabilityCheck['exceededSlots'] = []

    // Check per-fascia: solo se le fasce sono abilitate
    if (timeSlotsEnabled && slots.length > 0) {
      // Calcola occupazione per ogni fascia
      const occupied: Record<string, number> = {}
      for (const slot of slots) occupied[slot.id] = 0

      for (const booking of dayBookings) {
        if (!booking.confirmed_start || !booking.confirmed_end) continue
        const bStart = booking.confirmed_start.match(/T(\d{2}):(\d{2})/)
        const bEnd = booking.confirmed_end.match(/T(\d{2}):(\d{2})/)
        if (!bStart || !bEnd) continue
        const bStartStr = `${bStart[1]}:${bStart[2]}`
        const bEndStr = `${bEnd[1]}:${bEnd[2]}`
        for (const slotId of getSlotsOccupiedByTime(bStartStr, bEndStr, slots)) {
          if (slotId in occupied) occupied[slotId] += booking.num_guests ?? 0
        }
      }

      // Controlla se la nuova prenotazione eccede la capacita di una fascia
      const newBookingSlotIds = getSlotsOccupiedByTime(startTime, endTime, slots)
      for (const slotId of newBookingSlotIds) {
        const slot = slots.find((s) => s.id === slotId)
        if (!slot) continue
        const cap = getSlotCap(slot)
        if (cap == null) continue
        const occ = occupied[slotId] ?? 0
        const total = occ + numGuests
        if (total > cap) {
          isAvailable = false
          exceededSlots!.push({
            slot: slotId,
            slotName: slot.name,
            exceededBy: total - cap,
            totalOccupied: total,
            capacity: cap,
          })
        }
      }

      const slotsStatus = slots.map((slot) => {
        const cap = getSlotCap(slot)
        const occ = occupied[slot.id] ?? 0
        return {
          slot: slot.id,
          capacity: cap,
          occupied: occ,
          available: cap == null ? null : cap - occ,
        }
      })

      return {
        isAvailable,
        slotsStatus,
        errorMessage: errorMessages.length > 0 ? errorMessages.join('\n') : undefined,
        exceededSlots: exceededSlots!.length > 0 ? exceededSlots : undefined,
      }
    }

    // Fasce OFF: solo check giornaliero, slotsStatus vuoto
    return {
      isAvailable,
      slotsStatus: [],
      errorMessage: errorMessages.length > 0 ? errorMessages.join('\n') : undefined,
      exceededSlots: exceededSlots!.length > 0 ? exceededSlots : undefined,
    }
  }, [
    date,
    startTime,
    endTime,
    numGuests,
    acceptedBookings,
    excludeBookingId,
    slots,
    serviceSlots,
    slotOverrides,
    legacySlotCapacities,
    timeSlotsEnabled,
    features.servizio,
  ])
}
