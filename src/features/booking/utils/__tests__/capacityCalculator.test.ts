import { describe, it, expect } from 'vitest'
import {
  getStartSlotForBookingV2,
  getSlotsOccupiedByBookingV2,
  calculateDailyCapacityV2,
} from '../capacityCalculator'
import type { SlotConfig } from '../bookingTimeSlots'
import type { BookingRequest } from '@/types/booking'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function slot(
  id: string,
  start_time: string,
  end_time: string,
  display_order: number,
  name = id
): SlotConfig {
  return { id, name, start_time, end_time, display_order, is_canonical: true }
}

const pranzo = slot('pranzo', '12:00', '15:00', 1)
const cena = slot('cena', '19:00', '23:00', 2)
const notturna = slot('notturna', '22:00', '03:00', 4) // cross-midnight

function iso(time: string, date = '2024-01-15'): string {
  return `${date}T${time}:00`
}

function booking(
  id: string,
  confirmed_start: string,
  confirmed_end: string,
  num_guests = 2
): BookingRequest {
  return {
    id,
    confirmed_start,
    confirmed_end,
    num_guests,
    status: 'accepted',
  } as unknown as BookingRequest
}

// ---------------------------------------------------------------------------
// getStartSlotForBookingV2
// ---------------------------------------------------------------------------

describe('getStartSlotForBookingV2', () => {
  it('0 fasce → daily', () => {
    expect(getStartSlotForBookingV2(iso('12:30'), [])).toBe('daily')
  })

  it('orario dentro pranzo → id pranzo', () => {
    expect(getStartSlotForBookingV2(iso('12:30'), [pranzo, cena])).toBe('pranzo')
  })

  it('orario dentro cena → id cena', () => {
    expect(getStartSlotForBookingV2(iso('20:00'), [pranzo, cena])).toBe('cena')
  })

  it('orario in fascia notturna cross-midnight → id notturna', () => {
    // 23:30 è dentro notturna (22:00–03:00)
    expect(getStartSlotForBookingV2(iso('23:30'), [pranzo, notturna])).toBe('notturna')
    // 01:00 è dentro notturna (cross-midnight)
    expect(getStartSlotForBookingV2(iso('01:00'), [pranzo, notturna])).toBe('notturna')
  })

  it('orario fuori da ogni fascia → __unassigned__', () => {
    // 16:00 non è in pranzo (12-15) né in cena (19-23)
    expect(getStartSlotForBookingV2(iso('16:00'), [pranzo, cena])).toBe('__unassigned__')
  })

  it('2 fasce sovrapposte per display_order → prende la prima', () => {
    const a = slot('a', '12:00', '15:00', 1)
    const b = slot('b', '12:00', '15:00', 2) // stesso range, ordine 2
    expect(getStartSlotForBookingV2(iso('13:00'), [b, a])).toBe('a')
  })
})

// ---------------------------------------------------------------------------
// getSlotsOccupiedByBookingV2
// ---------------------------------------------------------------------------

describe('getSlotsOccupiedByBookingV2', () => {
  it('booking che tocca una sola fascia', () => {
    const result = getSlotsOccupiedByBookingV2(iso('12:30'), iso('13:30'), [pranzo, cena])
    expect(result).toEqual(['pranzo'])
  })

  it('booking che attraversa 2 fasce', () => {
    // 14:30–20:00 sovrappone pranzo (12-15) e cena (19-23)
    const result = getSlotsOccupiedByBookingV2(iso('14:30'), iso('20:00'), [pranzo, cena])
    expect(result).toContain('pranzo')
    expect(result).toContain('cena')
  })

  it('booking notturno cross-midnight sovrappone notturna', () => {
    // booking 22:30–01:00, notturna 22:00–03:00
    const result = getSlotsOccupiedByBookingV2(iso('22:30'), iso('01:00'), [pranzo, notturna])
    expect(result).toContain('notturna')
    expect(result).not.toContain('pranzo')
  })

  it('booking fuori da ogni fascia → array vuoto', () => {
    // 16:00–17:00, nessuna fascia la copre (pranzo 12-15, cena 19-23)
    const result = getSlotsOccupiedByBookingV2(iso('16:00'), iso('17:00'), [pranzo, cena])
    expect(result).toEqual([])
  })

  it('0 fasce → array vuoto', () => {
    expect(getSlotsOccupiedByBookingV2(iso('12:30'), iso('13:30'), [])).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// calculateDailyCapacityV2
// ---------------------------------------------------------------------------

describe('calculateDailyCapacityV2', () => {
  const DATE = '2024-01-15'

  it('somma corretta degli ospiti per slot', () => {
    const bookings = [
      booking('b1', iso('12:30'), iso('14:00'), 3),
      booking('b2', iso('20:00'), iso('21:00'), 2),
    ]
    const caps = { pranzo: 20, cena: 30 }
    const result = calculateDailyCapacityV2(DATE, bookings, [pranzo, cena], caps)
    const pr = result.slots.find((s) => s.slotId === 'pranzo')!
    const ce = result.slots.find((s) => s.slotId === 'cena')!
    expect(pr.occupied).toBe(3)
    expect(pr.available).toBe(17)
    expect(ce.occupied).toBe(2)
    expect(ce.available).toBe(28)
  })

  it('slotCapacities parziale: slot senza capacity → null', () => {
    const bookings = [booking('b1', iso('12:30'), iso('14:00'), 5)]
    const result = calculateDailyCapacityV2(DATE, bookings, [pranzo, cena], { pranzo: 10 })
    const ce = result.slots.find((s) => s.slotId === 'cena')!
    expect(ce.capacity).toBeNull()
    expect(ce.available).toBeNull()
  })

  it('capacity null (illimitato) → occupied conta, available null', () => {
    const bookings = [booking('b1', iso('20:00'), iso('21:00'), 8)]
    const result = calculateDailyCapacityV2(DATE, bookings, [cena], {})
    const ce = result.slots[0]
    expect(ce.occupied).toBe(8)
    expect(ce.available).toBeNull()
  })

  it('booking orfano non conta in nessuno slot per-fascia', () => {
    // booking alle 16:00 non è in pranzo né in cena
    const bookings = [booking('b1', iso('16:00'), iso('17:00'), 4)]
    const result = calculateDailyCapacityV2(DATE, bookings, [pranzo, cena], { pranzo: 20, cena: 30 })
    const pr = result.slots.find((s) => s.slotId === 'pranzo')!
    const ce = result.slots.find((s) => s.slotId === 'cena')!
    expect(pr.occupied).toBe(0)
    expect(ce.occupied).toBe(0)
  })
})
