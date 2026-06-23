// @s3-blindatura: arrivi-hook-rpc
// Copre: gate slot_limit_enabled, capacità piena, nessuna lettura anon di setting private.

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArrivalSlots } from '../useArrivalSlots'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabasePublic', () => ({ supabasePublic: { rpc } }))
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), error: vi.fn() } }))

const baseSlot = {
  slot_id: 'slot-1', slot_name: 'Pranzo', start_time: '11:31', end_time: '13:31',
  arrival_step_minutes: 30, min_duration: null, cutoff_minutes: 60,
  late_arrival_allowed: false, min_order_time_minutes: 45, timezone: 'Europe/Rome',
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
}

describe('useArrivalSlots — S3', () => {
  beforeEach(() => rpc.mockReset())

  it('limite spento: usa solo la RPC config e mostra tutti gli step validi', async () => {
    rpc.mockResolvedValueOnce({ data: [{ ...baseSlot, slot_limit_enabled: false }], error: null })
    const { result } = renderHook(() => useArrivalSlots({
      tenantSlug: 'da-tommaso', date: '2099-06-24', cardDurationMinutes: 60, numGuests: 4,
    }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('get_public_slot_config', { p_slug: 'da-tommaso' })
    expect(result.current.slots[0].times.filter((time) => time.isValid).map((time) => time.time))
      .toEqual(['11:31', '12:01', '12:31'])
  })

  it('limite acceso: chiama la RPC capacità e nasconde una fascia piena', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ ...baseSlot, slot_limit_enabled: true }], error: null })
      .mockResolvedValueOnce({ data: [{ slot_id: 'slot-1', slot_name: 'Pranzo', available_times: [] }], error: null })
    const { result } = renderHook(() => useArrivalSlots({
      tenantSlug: 'da-tommaso', date: '2099-06-24', cardDurationMinutes: 60, numGuests: 4,
    }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(rpc).toHaveBeenCalledWith('get_available_arrival_times', {
      p_slug: 'da-tommaso', p_date: '2099-06-24', p_card_duration: 60, p_num_guests: 4,
    })
    expect(result.current.slots[0].times.some((time) => time.isValid)).toBe(false)
    expect(rpc.mock.calls.every(([name]) => name !== 'from')).toBe(true)
  })
})
