import { describe, it, expect } from 'vitest'
import { filterUnassignedBookingsForSlot, activeAssignedBookingIds } from '../unassignedBookingsFilter'
import type { BookingRequest } from '@/types/booking'

const PRANZO_START = '11:31:00'
const PRANZO_END = '15:30:00'

function makeBooking(overrides: Partial<BookingRequest>): BookingRequest {
  return {
    id: 'b1',
    created_at: '',
    updated_at: '',
    client_name: 'Test',
    client_email: 't@test.it',
    event_type: 'cena',
    desired_date: '2026-05-18',
    num_guests: 4,
    status: 'accepted',
    tenant_id: 'tenant-1',
    ...overrides,
  }
}

describe('filterUnassignedBookingsForSlot', () => {
  const inPranzo = makeBooking({ id: 'in-slot', confirmed_start: '2026-05-18T12:00:00+00:00' })
  const outOfSlot = makeBooking({ id: 'out-slot', confirmed_start: '2026-05-18T20:00:00+00:00' })

  it('include prenotazione in fascia non assegnata', () => {
    const result = filterUnassignedBookingsForSlot(
      [inPranzo, outOfSlot],
      PRANZO_START,
      PRANZO_END,
      new Set(),
    )
    expect(result.map((b) => b.id)).toEqual(['in-slot'])
  })

  it('esclude prenotazione con assignment attivo', () => {
    const result = filterUnassignedBookingsForSlot(
      [inPranzo],
      PRANZO_START,
      PRANZO_END,
      activeAssignedBookingIds([{ booking_id: 'in-slot' }]),
    )
    expect(result).toHaveLength(0)
  })

  it('include di nuovo prenotazione dopo checkout (nessun assignment attivo)', () => {
    const result = filterUnassignedBookingsForSlot(
      [inPranzo],
      PRANZO_START,
      PRANZO_END,
      activeAssignedBookingIds([]),
    )
    expect(result.map((b) => b.id)).toEqual(['in-slot'])
  })
})
