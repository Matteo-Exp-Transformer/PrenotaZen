import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { TenantProvider, useTenantContext } from '../TenantContext'

// vi.hoisted garantisce che queste variabili esistano prima dell'hoisting di vi.mock.
const { mockSingle, mockFrom, mockRpc } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  return { mockSingle, mockFrom, mockRpc }
})

vi.mock('@/lib/supabasePublic', () => ({
  supabasePublic: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

// Dopo l'hardening 026, check_admin_email è esposta solo al ruolo
// `authenticated` e TenantContext la chiama via il client autenticato.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}))

function buildChain() {
  const chain: Record<string, unknown> = {}
  chain['select'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['single'] = mockSingle
  return chain
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TenantProvider>{children}</TenantProvider>
)

describe('TenantContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFrom.mockReturnValue(buildChain())
  })

  describe('setTenantFromSlug', () => {
    it('risolve tenantId e organizationName da uno slug valido', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'tenant-abc', name: 'Ristorante Test', slug: 'ristorante-test' },
        error: null,
      })

      const { result } = renderHook(() => useTenantContext(), { wrapper })

      await act(async () => {
        await result.current.setTenantFromSlug('ristorante-test')
      })

      expect(result.current.tenantId).toBe('tenant-abc')
      expect(result.current.organizationName).toBe('Ristorante Test')
      expect(result.current.tenantSlug).toBe('ristorante-test')
    })

    it('mantiene tenantId null se la slug non esiste nel DB', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'PGRST116: The result contains 0 rows' },
      })

      const { result } = renderHook(() => useTenantContext(), { wrapper })

      await act(async () => {
        await result.current.setTenantFromSlug('slug-inesistente')
      })

      expect(result.current.tenantId).toBeNull()
      expect(result.current.organizationName).toBeNull()
    })
  })

  describe('setTenantFromAdmin', () => {
    it('risolve tenantId dall\'email admin', async () => {
      // RPC check_admin_email restituisce slug, org_name, edition
      mockRpc.mockResolvedValueOnce({
        data: [{ tenant_id: 'tenant-xyz', slug: 'ristorante-test', org_name: 'Ristorante Test', edition: 'pro' }],
        error: null,
      })
      // seconda query: organizations.qr_menu_enabled
      mockSingle.mockResolvedValueOnce({ data: { qr_menu_enabled: false }, error: null })

      const { result } = renderHook(() => useTenantContext(), { wrapper })

      await act(async () => {
        await result.current.setTenantFromAdmin('admin@test.it')
      })

      expect(result.current.tenantId).toBe('tenant-xyz')
      expect(result.current.organizationName).toBe('Ristorante Test')
    })

    it('mantiene tenantId null se l\'admin non esiste', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null })

      const { result } = renderHook(() => useTenantContext(), { wrapper })

      await act(async () => {
        await result.current.setTenantFromAdmin('sconosciuto@test.it')
      })

      expect(result.current.tenantId).toBeNull()
    })
  })

  describe('clearTenant', () => {
    it('azzera tenantId, slug e organizationName dopo un set', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'tenant-abc', name: 'Ristorante Test', slug: 'ristorante-test' },
        error: null,
      })

      const { result } = renderHook(() => useTenantContext(), { wrapper })

      await act(async () => {
        await result.current.setTenantFromSlug('ristorante-test')
      })
      expect(result.current.tenantId).toBe('tenant-abc')

      act(() => {
        result.current.clearTenant()
      })

      expect(result.current.tenantId).toBeNull()
      expect(result.current.tenantSlug).toBeNull()
      expect(result.current.organizationName).toBeNull()
    })
  })
})
