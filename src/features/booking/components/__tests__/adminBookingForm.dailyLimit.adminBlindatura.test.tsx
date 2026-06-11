// @admin-blindatura: calendario
// Copre: FU-REV-CAL-3 — avviso sforo giornaliero su AdminBookingForm (non bloccante).

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { BookingRequest } from '@/types/booking'

const mutateSpy = vi.fn()
const restaurantSettings = vi.hoisted(() => ({
  daily_guest_limit: 24 as number | null,
  booking_staff_presets_visible: true,
  booking_custom_staff_presets: [] as string[],
  booking_placement_areas: ['Sala A'],
  slot_guest_capacities: {} as Record<string, number | null>,
  booking_time_slots_enabled: false,
}))

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

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettings[key as keyof typeof restaurantSettings] ?? null,
    isLoading: false,
  }),
}))

vi.mock('../../hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))

vi.mock('../../hooks/useServiceSlots', () => ({
  useDigestSlotConfigs: () => ({ data: [] }),
  useServiceSlots: () => ({ data: [] }),
}))

vi.mock('../../hooks/useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  resolveSlotOverride: vi.fn(),
}))

vi.mock('../../hooks/useAdminBookingRequests', () => ({
  useCreateAdminBooking: () => ({ mutate: mutateSpy, isPending: false }),
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => ({
    data: [
      {
        id: 'existing',
        status: 'accepted',
        no_show: false,
        num_guests: 22,
        confirmed_start: '2026-06-12T20:00:00+00:00',
        confirmed_end: '2026-06-12T23:00:00+00:00',
      } as BookingRequest,
    ],
  }),
}))

import { AdminBookingForm } from '../AdminBookingForm'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function setupMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('@admin-blindatura calendario — AdminBookingForm avviso limite giornaliero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMatchMedia()
    restaurantSettings.daily_guest_limit = 24
    restaurantSettings.booking_time_slots_enabled = false
  })

  it('mostra CapacityWarningModal su sforo giornaliero ma consente submit', async () => {
    const user = userEvent.setup()
    render(<AdminBookingForm initialDate="2026-06-12" />, { wrapper })

    await user.type(screen.getByPlaceholderText(/nome completo/i), 'Nuovo Cliente')
    await user.type(screen.getByPlaceholderText(/telefono/i), '3331234567')

    const guestsInput = screen.getByLabelText(/numero ospiti/i)
    await user.clear(guestsInput)
    await user.type(guestsInput, '4')

    await user.selectOptions(screen.getByLabelText(/ora \(formato 24 ore\)/i), '20')
    await user.selectOptions(screen.getByLabelText(/minuti/i), '00')

    await user.click(screen.getByRole('button', { name: /crea prenotazione/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /attenzione: capacità superata/i })).toBeInTheDocument()
    })

    expect(mutateSpy).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /procedi comunque/i }))

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalled()
    })
  })
})
