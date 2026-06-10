import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// clearAllMocks preserva le implementazioni; resetAllMocks le azzera (romperebbe useTenantContext mock)
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
  handleSupabaseError: (e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
    return 'Errore'
  },
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: vi.fn(() => ({ tenantId: 'tenant-1' })),
}))

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../useEmailNotifications', () => ({
  areEmailNotificationsEnabled: vi.fn(() => false),
  sendBookingAcceptedEmail: vi.fn(),
  sendBookingRejectedEmail: vi.fn(),
}))

import { useAcceptBooking, useRejectBooking, useCancelBooking } from '../useBookingMutations'

function buildUpdateChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  chain['update'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['select'] = vi.fn().mockResolvedValue(result)
  return chain
}

function buildUpdateSingleChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  chain['update'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['select'] = vi.fn(() => chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const BOOKING_BASE = {
  id: 'booking-1',
  status: 'accepted',
  confirmed_start: '2026-05-10T12:00:00',
  confirmed_end: '2026-05-10T14:00:00',
  client_email: 'ospite@test.it',
  client_name: 'Mario Rossi',
  num_guests: 4,
}

describe('useAcceptBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chiama supabase.update con status accepted', async () => {
    const chain = buildUpdateChain({ data: [BOOKING_BASE], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'booking-1',
        confirmedStart: '2026-05-10T12:00:00',
        confirmedEnd: '2026-05-10T14:00:00',
        numGuests: 4,
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('booking_requests')
    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('accepted')
  })

  it('propaga l\'errore se il DB rifiuta l\'aggiornamento', async () => {
    const chain = buildUpdateChain({ data: null, error: { message: 'RLS violation' } })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          bookingId: 'booking-1',
          confirmedStart: '2026-05-10T12:00:00',
          confirmedEnd: '2026-05-10T14:00:00',
        })
      })
    ).rejects.toThrow('RLS violation')
  })
})

describe('useRejectBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chiama supabase.update con status rejected e motivo', async () => {
    const chain = buildUpdateChain({ data: [{ ...BOOKING_BASE, status: 'rejected' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useRejectBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', rejectionReason: 'Locale chiuso' })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('rejected')
    expect(updateArg.rejection_reason).toBe('Locale chiuso')
  })
})

describe('useCancelBooking — soft-delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chiama supabase.update con status deleted', async () => {
    const chain = buildUpdateSingleChain({ data: { ...BOOKING_BASE, status: 'deleted' }, error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCancelBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-1', cancellationReason: 'Cliente disdetto' })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('deleted')
    expect(updateArg.cancellation_reason).toBe('Cliente disdetto')
  })
})
