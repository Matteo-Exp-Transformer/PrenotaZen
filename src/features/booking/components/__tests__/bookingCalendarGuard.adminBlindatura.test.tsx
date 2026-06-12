// @admin-blindatura: calendario
// C-U2 — guard cambio tab admin con modale calendario dirty (pattern UnsavedChangesContext).

import '@testing-library/jest-dom/vitest'
import React, { useEffect } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BookingRequest } from '@/types/booking'
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const { featuresState, restaurantSettings } = vi.hoisted(() => ({
  featuresState: { servizio: false },
  restaurantSettings: {
    daily_guest_limit: null as number | null,
    booking_time_slots_enabled: true,
  },
}))

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef(function MockFullCalendar() {
    return <div data-testid="mock-fullcalendar" />
  }),
}))
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/list', () => ({ default: {} }))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    servizio: featuresState.servizio,
    noShow: false,
    sidebar: false,
    home: false,
    crm: false,
    analytics: false,
    walkIn: false,
    tableAssignments: false,
    qrMenu: false,
  }),
}))

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettings[key as keyof typeof restaurantSettings] ?? null,
    isLoading: false,
  }),
}))

vi.mock('../../hooks/useServiceSlots', () => ({
  useServiceSlots: () => ({ data: [] }),
  useDigestSlotConfigs: () => ({ data: [] }),
}))

vi.mock('../../hooks/useTableAssignments', () => ({
  useTableAssignments: () => ({ data: [] }),
}))

vi.mock('../QuickTableAssignModal', () => ({
  QuickTableAssignModal: () => null,
}))

vi.mock('../BookingDetailsModal', () => ({
  BookingDetailsModal: ({
    isOpen,
    onClose,
    onEditDirtyChange,
  }: {
    isOpen: boolean
    onClose: () => void
    onEditDirtyChange?: (dirty: boolean) => void
  }) => {
    useEffect(() => {
      onEditDirtyChange?.(isOpen)
    }, [isOpen, onEditDirtyChange])
    if (!isOpen) return null
    return (
      <div data-testid="booking-details-modal-stub">
        <button type="button" onClick={onClose}>
          Chiudi modale
        </button>
      </div>
    )
  },
}))

vi.mock('../AdminBookingForm', () => ({
  AdminBookingForm: ({
    onDirtyChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void
  }) => {
    useEffect(() => {
      onDirtyChange?.(true)
    }, [onDirtyChange])
    return <div data-testid="admin-booking-form-stub" />
  },
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => ({ data: [], isSuccess: true, isFetching: false }),
}))

import { BookingCalendar } from '../BookingCalendar'

function acceptedBooking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: partial.id ?? 'booking-guard-1',
    status: 'accepted',
    no_show: false,
    num_guests: 4,
    client_name: partial.client_name ?? 'Mario Rossi',
    client_email: 'mario@test.it',
    confirmed_start: partial.confirmed_start ?? '2026-06-12T20:00:00+00:00',
    confirmed_end: partial.confirmed_end ?? '2026-06-12T23:00:00+00:00',
    desired_date: partial.desired_date ?? '2026-06-12',
    booking_type: 'tavolo',
    tenant_id: 'tenant-1',
    created_at: '2026-06-01T10:00:00Z',
    ...partial,
  } as BookingRequest
}

function setupMatchMedia(desktop = true) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !desktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function GuardProbe() {
  const { confirmNavigation } = useUnsavedChangesGuard()
  return (
    <button type="button" onClick={() => void confirmNavigation()}>
      Cambia tab
    </button>
  )
}

function renderCalendarWithGuard(bookings: BookingRequest[] = [acceptedBooking()]) {
  return render(
    <UnsavedChangesProvider>
      <BookingCalendar bookings={bookings} initialDate="2026-06-12" />
      <GuardProbe />
    </UnsavedChangesProvider>,
  )
}

describe('BookingCalendar — guard tab switch C-U2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMatchMedia(true)
  })

  it('senza modifiche dirty il cambio tab non apre il guard', async () => {
    const user = userEvent.setup()
    renderCalendarWithGuard()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })

    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('dopo chiusura modale con guard tab aperto il dialog stale sparisce', async () => {
    const user = userEvent.setup()
    renderCalendarWithGuard()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /mario rossi/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })
    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeVisible()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /chiudi modale/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('dopo chiusura modale dirty la navigazione non apre il guard', async () => {
    const user = userEvent.setup()
    renderCalendarWithGuard()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /mario rossi/i }))
    })
    expect(screen.getByTestId('booking-details-modal-stub')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /chiudi modale/i }))
    })
    expect(screen.queryByTestId('booking-details-modal-stub')).not.toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })

    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('con dettaglio in edit dirty mostra Salva / Annulla / Resta qui', async () => {
    const user = userEvent.setup()
    renderCalendarWithGuard()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /mario rossi/i }))
    })
    expect(screen.getByTestId('booking-details-modal-stub')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeVisible()
    expect(screen.getByText(/dettaglio prenotazione/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /resta qui/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /salva e continua/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /annulla e continua/i })).toBeVisible()
  })
})
