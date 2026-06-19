// @admin-blindatura: calendario
// Copre: useCapacityCheck esclude no-show dall'occupazione per-fascia (C-D3).

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { BookingRequest } from '@/types/booking'

const featuresState = vi.hoisted(() => ({ servizio: false }))
const digestSlots = vi.hoisted(() => [
  { id: 'slot-1', name: 'Cena', start_time: '19:00', end_time: '23:00', display_order: 1 },
])
const restaurantSettings = vi.hoisted(() => ({
  slot_guest_capacities: { 'slot-1': 10 } as Record<string, number | null>,
  booking_time_slots_enabled: true,
}))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({ servizio: featuresState.servizio }),
}))

vi.mock('../useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettings[key as keyof typeof restaurantSettings] ?? null,
  }),
}))

vi.mock('../useServiceSlots', () => ({
  useDigestSlotConfigs: () => ({ data: digestSlots }),
  useServiceSlots: () => ({ data: [] }),
}))

vi.mock('../useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  resolveSlotOverride: vi.fn(),
}))

import { useCapacityCheck } from '../useCapacityCheck'

function acceptedBooking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: partial.id ?? 'booking-1',
    status: 'accepted',
    no_show: false,
    num_guests: 6,
    confirmed_start: '2026-06-12T20:00:00+00:00',
    confirmed_end: '2026-06-12T23:00:00+00:00',
    ...partial,
  } as BookingRequest
}

describe('useCapacityCheck — no-show esclusi da occupazione (admin-blindatura calendario)', () => {
  beforeEach(() => {
    featuresState.servizio = false
    restaurantSettings.booking_time_slots_enabled = true
    restaurantSettings.slot_guest_capacities = { 'slot-1': 10 }
  })

  it('non conta i no-show nell occupazione per-fascia', () => {
    const { result } = renderHook(() =>
      useCapacityCheck({
        date: '2026-06-12',
        startTime: '20:00',
        endTime: '23:00',
        numGuests: 4,
        acceptedBookings: [
          acceptedBooking({ num_guests: 6 }),
          acceptedBooking({ id: 'noshow', num_guests: 8, no_show: true }),
        ],
      }),
    )

    const slot = result.current.slotsStatus.find((s) => s.slot === 'slot-1')
    expect(slot?.occupied).toBe(6)
    expect(result.current.isAvailable).toBe(true)
  })

  it('segnala sforo quando solo prenotazioni visibili superano il cap', () => {
    const { result } = renderHook(() =>
      useCapacityCheck({
        date: '2026-06-12',
        startTime: '20:00',
        endTime: '23:00',
        numGuests: 5,
        acceptedBookings: [
          acceptedBooking({ num_guests: 6 }),
          acceptedBooking({ id: 'noshow', num_guests: 20, no_show: true }),
        ],
      }),
    )

    expect(result.current.isAvailable).toBe(false)
    expect(result.current.exceededSlots?.[0]?.exceededBy).toBe(1)
  })

  it('fasce disattivate (Classic): nessun sforo per-fascia anche con cap impostato', () => {
    restaurantSettings.booking_time_slots_enabled = false
    const { result } = renderHook(() =>
      useCapacityCheck({
        date: '2026-06-12',
        startTime: '20:00',
        endTime: '23:00',
        numGuests: 50,
        acceptedBookings: [acceptedBooking({ num_guests: 6 })],
      }),
    )

    expect(result.current.isAvailable).toBe(true)
    expect(result.current.exceededSlots).toBeUndefined()
    expect(result.current.slotsStatus).toEqual([])
  })
})
