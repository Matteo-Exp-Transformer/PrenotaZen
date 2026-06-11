// @admin-blindatura: prenotazioni
// Copre: pulsante No-show visibile dopo orario di INIZIO (a muro), non dopo la fine.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BookingRequest } from '@/types/booking'

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    noShow: true,
    servizio: true,
    sidebar: true,
    home: false,
    crm: false,
    analytics: false,
    walkIn: false,
    tableAssignments: true,
    qrMenu: false,
  }),
}))

vi.mock('../../hooks/useBookingMutations', () => ({
  useUpdateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkNoShow: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => ({ data: [], isSuccess: true, isFetching: false }),
}))

vi.mock('../../hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: null }),
}))

vi.mock('../../hooks/useServiceSlots', () => ({
  useDigestSlotConfigs: () => ({ data: [] }),
  useServiceSlots: () => ({ data: [] }),
}))

vi.mock('../../hooks/useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  resolveSlotOverride: vi.fn(),
}))

vi.mock('../DetailsTab', () => ({
  DetailsTab: () => <div data-testid="details-tab-stub" />,
}))
vi.mock('../MenuTab', () => ({ MenuTab: () => null }))
vi.mock('../DietaryTab', () => ({ DietaryTab: () => null }))
vi.mock('../CapacityWarningModal', () => ({ CapacityWarningModal: () => null }))
vi.mock('../PastStartTimeWarningModal', () => ({ PastStartTimeWarningModal: () => null }))
vi.mock('../BookingDangerActionModal', () => ({ BookingDangerActionModal: () => null }))

import { BookingDetailsModal } from '../BookingDetailsModal'

function acceptedBooking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'b-1',
    status: 'accepted',
    no_show: false,
    client_name: 'Mario Rossi',
    client_email: 'mario@test.it',
    num_guests: 4,
    booking_type: 'tavolo',
    tenant_id: 'tenant-1',
    created_at: '2026-06-01T10:00:00Z',
    confirmed_start: '2026-06-12T20:00:00+00:00',
    confirmed_end: '2026-06-12T23:00:00+00:00',
    desired_date: '2026-06-12',
    ...partial,
  } as BookingRequest
}

describe('BookingDetailsModal — No-show dopo inizio (admin-blindatura prenotazioni)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 12, 20, 30, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra No-show quando l orario di inizio è passato anche se la fine non lo è ancora', () => {
    render(
      <BookingDetailsModal
        isOpen
        onClose={() => undefined}
        booking={acceptedBooking()}
      />,
    )

    expect(screen.getByRole('button', { name: /^no-show$/i })).toBeInTheDocument()
  })

  it('nasconde No-show prima dell orario di inizio (non attende la fine)', () => {
    vi.setSystemTime(new Date(2026, 5, 12, 19, 45, 0))

    render(
      <BookingDetailsModal
        isOpen
        onClose={() => undefined}
        booking={acceptedBooking()}
      />,
    )

    expect(screen.queryByRole('button', { name: /^no-show$/i })).not.toBeInTheDocument()
  })
})
