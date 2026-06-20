import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BookingRequest } from '@/types/booking'
import type { DayServiceGroup } from '@/features/booking/utils/dayDigestModel'
import { DayServiceGroupCard } from '../DayServiceGroupCard'

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    servizio: false,
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

function booking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: partial.id ?? 'booking-1',
    status: 'accepted',
    no_show: false,
    num_guests: partial.num_guests ?? 4,
    client_name: partial.client_name ?? 'Mario Rossi',
    client_email: 'mario@test.it',
    confirmed_start: partial.confirmed_start ?? '2026-06-20T12:30:00+00:00',
    confirmed_end: partial.confirmed_end ?? '2026-06-20T14:00:00+00:00',
    desired_date: partial.desired_date ?? '2026-06-20',
    desired_time: partial.desired_time ?? '12:30',
    booking_type: 'tavolo',
    tenant_id: 'tenant-1',
    created_at: '2026-06-01T10:00:00Z',
    ...partial,
  } as BookingRequest
}

function group(overrides: Partial<DayServiceGroup> = {}): DayServiceGroup {
  const bookings = overrides.hourGroups?.flatMap((hourGroup) => hourGroup.bookings) ?? [
    booking({ id: 'booking-1', client_name: 'Cliente Pranzo', num_guests: 78 }),
  ]

  return {
    slotId: 'slot-pranzo',
    label: 'Pranzo',
    timeRange: '11:31 - 15:30',
    isOutOfSlot: false,
    totalBookings: bookings.length,
    totalGuests: bookings.reduce((sum, item) => sum + (item.num_guests ?? 0), 0),
    pendingAssignments: 1,
    hourGroups: [{ hourLabel: '12:00', bookings }],
    ...overrides,
  }
}

function renderCard(
  dayGroup: DayServiceGroup,
  options: { isPro?: boolean; capacity?: number | null } = {},
) {
  return render(
    <DayServiceGroupCard
      group={dayGroup}
      isPro={options.isPro ?? true}
      assignedBookingIds={new Set()}
      filterByTurn={(list) => list}
      occupancyCapacity={options.capacity ?? null}
      onOpenBooking={vi.fn()}
    />,
  )
}

describe('DayServiceGroupCard', () => {
  it('mostra il tasso di riempimento della singola fascia sui coperti della fascia', () => {
    renderCard(group(), { capacity: 100 })

    expect(screen.getByText('Pranzo')).toBeInTheDocument()
    expect(screen.getByText('11:31 - 15:30')).toBeInTheDocument()
    expect(screen.getByText('% occupazione')).toBeInTheDocument()
    expect(screen.getByText('78%')).toBeInTheDocument()
    expect(screen.getByText('Prenotazioni')).toBeInTheDocument()
    expect(screen.getByText('Coperti')).toBeInTheDocument()
    expect(screen.getByText('Da assegnare')).toBeInTheDocument()
  })

  it('resta neutra quando la fascia non ha cap configurato', () => {
    renderCard(group(), { capacity: null })

    expect(screen.getByText('% occupazione')).toBeInTheDocument()
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('in Classic non mostra la metrica Pro da assegnare', () => {
    renderCard(group(), { isPro: false, capacity: 100 })

    expect(screen.queryByText('Da assegnare')).not.toBeInTheDocument()
  })

  it('apre la card e continua a mostrare le prenotazioni della fascia', async () => {
    const user = userEvent.setup()
    renderCard(group(), { capacity: 100 })

    expect(screen.queryByText('Cliente Pranzo')).not.toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /pranzo/i }))
    })

    expect(screen.getByText('Cliente Pranzo')).toBeInTheDocument()
  })
})
