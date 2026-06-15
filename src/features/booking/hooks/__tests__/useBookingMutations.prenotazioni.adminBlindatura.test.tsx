// @admin-blindatura: prenotazioni
// Copre: mutation accept/reject/cancel/restore/requeue/no-show — soft-delete, stati DB voluti.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

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

import {
  useAcceptBooking,
  useRejectBooking,
  useCancelBooking,
  useRestoreBooking,
  useRequeueRejectedBooking,
  useMarkNoShow,
} from '../useBookingMutations'
import { toast } from 'react-toastify'

function buildUpdateChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  chain['update'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['neq'] = vi.fn(() => chain)
  chain['select'] = vi.fn().mockResolvedValue(result)
  return chain
}

function buildUpdateSingleChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  chain['update'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['neq'] = vi.fn(() => chain)
  chain['select'] = vi.fn(() => chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

function buildSelectChain(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, unknown> = {}
  chain['select'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
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

describe('@admin-blindatura prenotazioni — useAcceptBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accept-da-card: scrive accepted + orari + desired_time', async () => {
    const chain = buildUpdateChain({
      data: [{ id: 'b1', status: 'accepted' }],
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T20:00:00+00:00',
        confirmedEnd: '2026-06-10T23:00:00+00:00',
        desiredTime: '20:00',
        numGuests: 6,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('accepted')
    expect(updateArg.confirmed_start).toBe('2026-06-10T20:00:00+00:00')
    expect(updateArg.confirmed_end).toBe('2026-06-10T23:00:00+00:00')
    expect(updateArg.desired_time).toBe('20:00')
    expect((chain['eq'] as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === 'status' && c[1] === 'pending')).toBe(true)
  })

  it('race: accept su record non più pending → no-op + toast warn', async () => {
    const chain = buildUpdateChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          bookingId: 'b1',
          confirmedStart: '2026-06-10T20:00:00+00:00',
          confirmedEnd: '2026-06-10T23:00:00+00:00',
          desiredTime: '20:00',
          numGuests: 6,
        }),
      ).rejects.toThrow(/non è più disponibile/)
    })

    expect(toast.warn).toHaveBeenCalledWith('Questa prenotazione è già stata gestita')
    expect(chain['update']).toHaveBeenCalled()
  })
})

describe('@admin-blindatura prenotazioni — useRejectBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rifiuta senza motivo → rejected, rejection_reason assente/null', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'rejected' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useRejectBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1' })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('rejected')
    expect((chain['eq'] as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === 'status' && c[1] === 'pending')).toBe(true)
  })

  it('race: reject su record non più pending → no-op + toast warn', async () => {
    const chain = buildUpdateChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useRejectBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await expect(result.current.mutateAsync({ bookingId: 'b1' })).rejects.toThrow(/non è più disponibile/)
    })

    expect(toast.warn).toHaveBeenCalledWith('Questa prenotazione è già stata gestita')
  })
})

describe('@admin-blindatura prenotazioni — useCancelBooking soft-delete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('elimina → deleted + cancelled_at + motivo (no hard-delete)', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'deleted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCancelBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        cancellationReason: 'Cliente ha disdetto',
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('deleted')
    expect(updateArg.cancellation_reason).toBe('Cliente ha disdetto')
    expect(updateArg.cancelled_at).toBeTruthy()
    expect(typeof updateArg.cancelled_at).toBe('string')
    // D6: guard di stato — non ri-eliminare una già 'deleted'.
    expect((chain['neq'] as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === 'status' && c[1] === 'deleted')).toBe(true)
  })

  it('D6 race: elimina su record già deleted → no-op + toast warn', async () => {
    const chain = buildUpdateChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCancelBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ bookingId: 'b1', cancellationReason: 'x' }),
      ).rejects.toThrow(/non è più disponibile/)
    })

    expect(toast.warn).toHaveBeenCalled()
  })
})

describe('@admin-blindatura prenotazioni — useRestoreBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reinserisci deleted → accepted se ha confirmed_start/end', async () => {
    const selectChain = buildSelectChain({
      data: {
        id: 'b1',
        confirmed_start: '2026-06-10T20:00:00+00:00',
        confirmed_end: '2026-06-10T23:00:00+00:00',
      },
      error: null,
    })
    const updateChain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain)

    const { result } = renderHook(() => useRestoreBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('b1')
    })

    const updateArg = (updateChain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('accepted')
    expect(updateArg.cancellation_reason).toBeNull()
    expect(updateArg.cancelled_at).toBeNull()
    // D6: guard di stato — si reinserisce solo una prenotazione 'deleted'.
    expect((updateChain['eq'] as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === 'status' && c[1] === 'deleted')).toBe(true)
  })

  it('reinserisci con orario fornito — scrive slot e salta fetch orari', async () => {
    const updateChain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValueOnce(updateChain)

    const { result } = renderHook(() => useRestoreBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T20:00:00+02:00',
        confirmedEnd: '2026-06-10T23:00:00+02:00',
        desiredTime: '20:00',
      })
    })

    expect(mockFrom).toHaveBeenCalledTimes(1)
    const updateArg = (updateChain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('accepted')
    expect(updateArg.confirmed_start).toBe('2026-06-10T20:00:00+02:00')
    expect(updateArg.confirmed_end).toBe('2026-06-10T23:00:00+02:00')
    expect(updateArg.desired_time).toBe('20:00')
    expect(updateArg.cancellation_reason).toBeNull()
    expect(updateArg.cancelled_at).toBeNull()
  })
})

describe('@admin-blindatura prenotazioni — useRequeueRejectedBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('riporta in attesa: rejected → pending, azzera rejection_reason', async () => {
    const chain = buildUpdateSingleChain({ data: { id: 'b1', status: 'pending' }, error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useRequeueRejectedBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('b1')
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.status).toBe('pending')
    expect(updateArg.rejection_reason).toBeNull()
  })
})

describe('@admin-blindatura prenotazioni — useMarkNoShow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no-show → no_show=true, riga resta in DB', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', no_show: true }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useMarkNoShow(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('b1')
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.no_show).toBe(true)
    // D6: guard di stato — no-show solo su 'accepted'.
    expect((chain['eq'] as ReturnType<typeof vi.fn>).mock.calls.some((c) => c[0] === 'status' && c[1] === 'accepted')).toBe(true)
  })
})

const LONG_TEXT = 'Z'.repeat(5000)

describe('@admin-blindatura prenotazioni — LIMIT mutation payload', () => {
  beforeEach(() => vi.clearAllMocks())

  it('L8: rifiuto con motivo lunghissimo — pass-through senza troncamento client', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'rejected' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useRejectBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', rejectionReason: LONG_TEXT })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.rejection_reason).toBe(LONG_TEXT)
    expect(updateArg.rejection_reason).toHaveLength(5000)
  })

  it('L9: cancellazione con motivo lunghissimo — pass-through a cancellation_reason', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'deleted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCancelBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b1', cancellationReason: LONG_TEXT })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.cancellation_reason).toBe(LONG_TEXT)
  })

  it('L10: accept num_guests 0 — scritto così com\'è (nessuna validazione hook)', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T20:00:00+00:00',
        confirmedEnd: '2026-06-10T23:00:00+00:00',
        desiredTime: '20:00',
        numGuests: 0,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.num_guests).toBe(0)
  })

  it('L11: accept num_guests negativo — pass-through (DB dovrebbe rifiutare)', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T20:00:00+00:00',
        confirmedEnd: '2026-06-10T23:00:00+00:00',
        numGuests: -99,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.num_guests).toBe(-99)
  })

  it('L12: accept num_guests enorme — pass-through', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T20:00:00+00:00',
        confirmedEnd: '2026-06-10T23:00:00+00:00',
        numGuests: 999_999,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.num_guests).toBe(999_999)
  })

  it('L13: accept mezzanotte — timestamp passati al DB', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2026-06-10T00:00:00+00:00',
        confirmedEnd: '2026-06-10T03:00:00+00:00',
        desiredTime: '00:00',
        numGuests: 2,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.confirmed_start).toBe('2026-06-10T00:00:00+00:00')
    expect(updateArg.desired_time).toBe('00:00')
  })

  it('L14: accept data passata — nessun blocco lato hook', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2010-01-01T20:00:00+00:00',
        confirmedEnd: '2010-01-01T23:00:00+00:00',
        numGuests: 4,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.confirmed_start).toBe('2010-01-01T20:00:00+00:00')
  })

  it('L15: accept data +10 anni — nessun blocco lato hook', async () => {
    const chain = buildUpdateChain({ data: [{ id: 'b1', status: 'accepted' }], error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useAcceptBooking(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'b1',
        confirmedStart: '2036-06-10T20:00:00+00:00',
        confirmedEnd: '2036-06-10T23:00:00+00:00',
        numGuests: 2,
      })
    })

    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.confirmed_start).toBe('2036-06-10T20:00:00+00:00')
  })
})
