import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockRpc, mockTenantId, mockToast } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockTenantId: { value: 'tenant-1' as string | null },
  mockToast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: vi.fn(() => ({ tenantId: mockTenantId.value })),
}))

vi.mock('react-toastify', () => ({
  toast: mockToast,
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { useUpdateServiceSlot } from '../useServiceSlots'

const SLOT_BEFORE = {
  id: 'slot-cena',
  tenant_id: 'tenant-1',
  name: 'Cena',
  start_time: '19:00:00',
  end_time: '23:00:00',
  max_turns: 2,
  max_turns_resume: null,
  max_guests: null,
  display_order: 3,
  is_canonical: true,
  created_at: '',
  updated_at: '',
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdateServiceSlot — aggiunta coperti alla fascia oraria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('aggiunge i coperti massimi e salva senza errori', async () => {
    const slotAfter = { ...SLOT_BEFORE, max_guests: 80 }
    mockRpc.mockResolvedValue({ data: [slotAfter], error: null })

    const { result } = renderHook(() => useUpdateServiceSlot(), { wrapper: makeWrapper() })

    let returned: unknown
    await act(async () => {
      returned = await result.current.mutateAsync({ id: 'slot-cena', max_guests: 80 })
    })

    // Chiamata alla RPC con singolo parametro jsonb (firma univoca, immune a PGRST202).
    // Solo le chiavi presenti nel patch finiscono nel payload (semantica PATCH).
    expect(mockRpc).toHaveBeenCalledWith('update_service_slot', {
      payload: { id: 'slot-cena', tenant_id: 'tenant-1', max_guests: 80 },
    })

    // Il salvataggio è andato a buon fine: coperti persistiti, nessun errore
    expect((returned as typeof slotAfter).max_guests).toBe(80)
    expect(mockToast.success).toHaveBeenCalledWith('Fascia oraria aggiornata')
    expect(mockToast.error).not.toHaveBeenCalled()
    expect(result.current.isError).toBe(false)
  })

  it('non tocca gli altri campi quando aggiunge solo i coperti (semantica PATCH)', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...SLOT_BEFORE, max_guests: 50 }], error: null })

    const { result } = renderHook(() => useUpdateServiceSlot(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'slot-cena', max_guests: 50 })
    })

    const payload = mockRpc.mock.calls[0][1].payload
    // name/orari/turni assenti dal payload → la RPC li mantiene invariati (COALESCE)
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('start_time')
    expect(payload).not.toHaveProperty('end_time')
    expect(payload).not.toHaveProperty('max_turns')
    expect(payload.max_guests).toBe(50)
  })

  it('azzera il limite coperti: max_guests=null resta nel payload (chiave presente)', async () => {
    mockRpc.mockResolvedValue({ data: [{ ...SLOT_BEFORE, max_guests: null }], error: null })

    const { result } = renderHook(() => useUpdateServiceSlot(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'slot-cena', max_guests: null })
    })

    const payload = mockRpc.mock.calls[0][1].payload
    // Chiave max_guests presente con null = la RPC azzera il limite (non lo "mantiene")
    expect('max_guests' in payload).toBe(true)
    expect(payload.max_guests).toBeNull()
  })

  it('propaga l\'errore se la RPC fallisce e mostra il toast di errore', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RLS violation' } })

    const { result } = renderHook(() => useUpdateServiceSlot(), { wrapper: makeWrapper() })

    await expect(
      act(async () => {
        await result.current.mutateAsync({ id: 'slot-cena', max_guests: 80 })
      })
    ).rejects.toMatchObject({ message: 'RLS violation' })

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('RLS violation'))
    expect(mockToast.success).not.toHaveBeenCalled()
  })
})
