// @admin-blindatura: calendario
// Copre: difesa in profondità — no-show esclusi da transformBookingsToCalendarEvents (C-D4).

import { describe, expect, it } from 'vitest'
import { transformBookingsToCalendarEvents } from '../bookingEventTransform'
import type { BookingRequest } from '@/types/booking'

function booking(partial: Partial<BookingRequest>): BookingRequest {
  return {
    id: 'b-1',
    status: 'accepted',
    no_show: false,
    num_guests: 2,
    client_name: 'Test',
    confirmed_start: '2026-06-12T20:00:00+00:00',
    confirmed_end: '2026-06-12T23:00:00+00:00',
    desired_date: '2026-06-12',
    ...partial,
  } as BookingRequest
}

describe('transformBookingsToCalendarEvents — filtri calendario (admin-blindatura)', () => {
  it('esclude no-show anche se passati direttamente alla utility', () => {
    const events = transformBookingsToCalendarEvents([
      booking({ id: 'visible' }),
      booking({ id: 'noshow', no_show: true }),
    ])
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('visible')
  })

  it('esclude accepted senza confirmed_end', () => {
    const events = transformBookingsToCalendarEvents([
      booking({ confirmed_end: null as unknown as string }),
    ])
    expect(events).toHaveLength(0)
  })
})
