import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockFrom, mockTenantId } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockTenantId: { value: 'tenant-1' as string | null },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
  handleSupabaseError: (e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
    return 'Errore'
  },
}))

vi.mock('@/lib/supabasePublic', () => ({
  supabasePublic: { from: mockFrom },
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: vi.fn(() => ({ tenantId: mockTenantId.value })),
}))

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const { mockSyncRename, mockSyncDelete } = vi.hoisted(() => ({
  mockSyncRename: vi.fn().mockResolvedValue(undefined),
  mockSyncDelete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/booking/services/syncMenuCategoryKeyRename', () => ({
  syncMenuCategoryKeyRename: mockSyncRename,
}))

vi.mock('@/features/booking/services/syncMenuCategoryKeyDelete', () => ({
  syncMenuCategoryKeyDelete: mockSyncDelete,
}))

vi.mock('@/lib/menuPhotoUpload', () => ({
  deleteMenuCategoryPhoto: vi.fn().mockResolvedValue(undefined),
}))

import {
  useMenuCategories,
  useCreateMenuCategory,
  useUpdateMenuCategory,
  useDeleteMenuCategory,
  useReorderMenuCategories,
} from '../useMenuCategories'

const CAT_LIST = [
  { id: 'cat-1', tenant_id: 'tenant-1', key: 'antipasti', label: 'Antipasti', sort_order: 1, created_at: '', updated_at: '' },
  { id: 'cat-2', tenant_id: 'tenant-1', key: 'primi', label: 'Primi', sort_order: 2, created_at: '', updated_at: '' },
]

function buildMutationChain(result: { data: unknown; error: null | { message: string; code?: string } }) {
  const chain: Record<string, unknown> = {}
  chain['insert'] = vi.fn(() => chain)
  chain['update'] = vi.fn(() => chain)
  chain['delete'] = vi.fn(() => chain)
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

describe('useMenuCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('query disabilitata (idle) se tenantId è null', () => {
    mockTenantId.value = null
    const { result } = renderHook(() => useMenuCategories(), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('restituisce le categorie filtrate per tenant', async () => {
    const chain: Record<string, unknown> = {}
    chain['select'] = vi.fn(() => chain)
    chain['eq'] = vi.fn(() => chain)
    // .order() chiamata 2 volte: la prima restituisce chain, la seconda la Promise
    let callCount = 0
    chain['order'] = vi.fn(() => {
      callCount++
      return callCount < 2 ? chain : Promise.resolve({ data: CAT_LIST, error: null })
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useMenuCategories(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].key).toBe('antipasti')
  })
})

describe('useCreateMenuCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('chiama supabase.insert con i dati corretti', async () => {
    const newCat = { id: 'cat-3', tenant_id: 'tenant-1', key: 'dolci', label: 'Dolci', sort_order: 3, created_at: '', updated_at: '' }
    const chain = buildMutationChain({ data: newCat, error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCreateMenuCategory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ key: 'dolci', label: 'Dolci', sort_order: 3 })
    })

    expect(mockFrom).toHaveBeenCalledWith('menu_categories')
    const insertArg = (chain['insert'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertArg.key).toBe('dolci')
    expect(insertArg.label).toBe('Dolci')
    expect(insertArg.tenant_id).toBe('tenant-1')
  })

  it('propaga errore di duplicato con messaggio leggibile', async () => {
    const chain = buildMutationChain({ data: null, error: { message: 'duplicate key', code: '23505' } })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useCreateMenuCategory(), { wrapper: makeWrapper() })

    await expect(
      act(async () => {
        await result.current.mutateAsync({ key: 'antipasti', label: 'Antipasti' })
      })
    ).rejects.toThrow('Esiste già una categoria con questo nome')
  })
})

describe('useUpdateMenuCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('chiama supabase.update su menu_categories con la label aggiornata', async () => {
    const updated = { ...CAT_LIST[0], label: 'Antipasti e stuzzichini' }
    const chain = buildMutationChain({ data: updated, error: null })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useUpdateMenuCategory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'cat-1',
        key: 'antipasti',
        previousKey: 'antipasti',
        label: 'Antipasti e stuzzichini',
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('menu_categories')
    const updateArg = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateArg.label).toBe('Antipasti e stuzzichini')
  })

  it('allinea Menù QR e form quando la chiave categoria cambia', async () => {
    const updated = { ...CAT_LIST[0], key: 'antipasti_freddi', label: 'Antipasti freddi' }
    const categoriesChain = buildMutationChain({ data: updated, error: null })
    const itemsChain: Record<string, unknown> = {}
    itemsChain['update'] = vi.fn(() => itemsChain)
    let itemsEqCalls = 0
    itemsChain['eq'] = vi.fn(() => {
      itemsEqCalls++
      return itemsEqCalls >= 2
        ? Promise.resolve({ data: null, error: null })
        : itemsChain
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'menu_categories') return categoriesChain
      if (table === 'menu_items') return itemsChain
      return categoriesChain
    })

    const { result } = renderHook(() => useUpdateMenuCategory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'cat-1',
        key: 'antipasti_freddi',
        previousKey: 'antipasti',
        label: 'Antipasti freddi',
      })
    })

    expect(mockSyncRename).toHaveBeenCalledWith('tenant-1', 'antipasti', 'antipasti_freddi')
  })
})

describe('useReorderMenuCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('riscrive sort_order sequenziale (0,10,20…) seguendo l\'ordine degli id', async () => {
    const chain: Record<string, unknown> = {}
    chain['update'] = vi.fn(() => chain)
    let eqCalls = 0
    chain['eq'] = vi.fn(() => {
      eqCalls++
      // .eq('id').eq('tenant_id') → la seconda eq di ogni update risolve la Promise
      return eqCalls % 2 === 0 ? Promise.resolve({ error: null }) : chain
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useReorderMenuCategories(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync(['cat-2', 'cat-1'])
    })

    expect(mockFrom).toHaveBeenCalledWith('menu_categories')
    const updateCalls = (chain['update'] as ReturnType<typeof vi.fn>).mock.calls
    expect(updateCalls[0][0].sort_order).toBe(0)
    expect(updateCalls[1][0].sort_order).toBe(10)

    // Primo id aggiornato = cat-2 (nuovo ordine)
    const eqIdCalls = (chain['eq'] as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === 'id',
    )
    expect(eqIdCalls[0][1]).toBe('cat-2')
    expect(eqIdCalls[1][1]).toBe('cat-1')
  })

  it('propaga errore se un update fallisce', async () => {
    const chain: Record<string, unknown> = {}
    chain['update'] = vi.fn(() => chain)
    let eqCalls = 0
    chain['eq'] = vi.fn(() => {
      eqCalls++
      return eqCalls % 2 === 0
        ? Promise.resolve({ error: { message: 'boom' } })
        : chain
    })
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useReorderMenuCategories(), { wrapper: makeWrapper() })

    await expect(
      act(async () => {
        await result.current.mutateAsync(['cat-1'])
      }),
    ).rejects.toThrow('boom')
  })
})

describe('useDeleteMenuCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTenantId.value = 'tenant-1'
  })

  it('allinea Menù QR e form dopo delete categoria', async () => {
    const itemsChain: Record<string, unknown> = {}
    itemsChain['delete'] = vi.fn(() => itemsChain)
    let itemsEqCalls = 0
    itemsChain['eq'] = vi.fn(() => {
      itemsEqCalls++
      return itemsEqCalls >= 2 ? Promise.resolve({ data: null, error: null }) : itemsChain
    })

    const categoriesChain: Record<string, unknown> = {}
    categoriesChain['delete'] = vi.fn(() => categoriesChain)
    let catEqCalls = 0
    categoriesChain['eq'] = vi.fn(() => {
      catEqCalls++
      return catEqCalls >= 2 ? Promise.resolve({ data: null, error: null }) : categoriesChain
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'menu_items') return itemsChain
      if (table === 'menu_categories') return categoriesChain
      return categoriesChain
    })

    const { result } = renderHook(() => useDeleteMenuCategory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'cat-1', categoryKey: 'antipasti' })
    })

    expect(mockSyncDelete).toHaveBeenCalledWith('tenant-1', 'antipasti')
  })
})
