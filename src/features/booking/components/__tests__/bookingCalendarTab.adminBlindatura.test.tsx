// @admin-blindatura: calendario
// Copre: BookingCalendarTab — pulsante Riprova su errore useAcceptedBookings (C-U4).

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockInvalidateQueries = vi.fn()
const acceptedBookingsState = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-test' }),
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => acceptedBookingsState,
}))

vi.mock('../BookingCalendar', () => ({
  BookingCalendar: () => <div data-testid="booking-calendar" />,
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

import { BookingCalendarTab } from '../BookingCalendarTab'

function renderTab() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingCalendarTab />
    </QueryClientProvider>,
  )
}

describe('BookingCalendarTab — errore caricamento (admin-blindatura calendario)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    acceptedBookingsState.data = undefined
    acceptedBookingsState.isLoading = false
    acceptedBookingsState.error = new Error('Rete non disponibile')
  })

  it('mostra Riprova e invalida la query accepted al click', async () => {
    const user = userEvent.setup()
    renderTab()

    expect(screen.getByText(/errore nel caricamento del calendario/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /riprova/i }))

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['bookings', 'accepted', 'tenant-test'],
    })
  })
})
