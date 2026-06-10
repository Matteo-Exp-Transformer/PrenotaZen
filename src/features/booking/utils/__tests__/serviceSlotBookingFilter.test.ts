import { describe, it, expect } from 'vitest'
import { bookingStartsInServiceSlot } from '../serviceSlotBookingFilter'
import type { BookingRequest } from '@/types/booking'

const PRANZO_START = '11:31:00'
const PRANZO_END = '15:30:00'
const NOTTURNA_START = '23:00:00'
const NOTTURNA_END = '04:00:00'

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

describe('bookingStartsInServiceSlot', () => {
  it('include prenotazione con inizio nel range Pranzo (confirmed_start)', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T12:00:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, PRANZO_START, PRANZO_END)).toBe(true)
  })

  it('esclude prenotazione con inizio dopo la fine Pranzo', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T15:31:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, PRANZO_START, PRANZO_END)).toBe(false)
  })

  it('include estremo fine fascia Pranzo (15:30)', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T15:30:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, PRANZO_START, PRANZO_END)).toBe(true)
  })

  it('include prenotazione notturna con inizio 23:30', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T23:30:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, NOTTURNA_START, NOTTURNA_END)).toBe(true)
  })

  it('include prenotazione notturna con inizio 02:00', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T02:00:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, NOTTURNA_START, NOTTURNA_END)).toBe(true)
  })

  it('esclude prenotazione di mezzogiorno dalla fascia Notturna', () => {
    const booking = makeBooking({
      confirmed_start: '2026-05-18T12:00:00+00:00',
    })
    expect(bookingStartsInServiceSlot(booking, NOTTURNA_START, NOTTURNA_END)).toBe(false)
  })

  it('esclude prenotazione senza orario di inizio', () => {
    const booking = makeBooking({})
    expect(bookingStartsInServiceSlot(booking, PRANZO_START, PRANZO_END)).toBe(false)
  })

  it('include prenotazione con solo desired_time in Pranzo', () => {
    const booking = makeBooking({ desired_time: '14:00' })
    expect(bookingStartsInServiceSlot(booking, PRANZO_START, PRANZO_END)).toBe(true)
  })
})
