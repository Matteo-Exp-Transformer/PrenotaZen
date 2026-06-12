import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Crea mock condivisi prima dell'hoisting
const {
  mockSignInWithPassword,
  mockGetSession,
  mockSignOut,
  mockFrom,
  mockNavigate,
  mockSetTenantFromAdmin,
  mockClearTenant,
} = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockSetTenantFromAdmin: vi.fn(),
  mockClearTenant: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    from: mockFrom,
  },
  handleSupabaseError: (e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
    return 'Si è verificato un errore. Riprova più tardi.'
  },
  isInvalidStoredRefreshTokenError: vi.fn(() => false),
}))

// TenantContext mockato: evita le chiamate a supabasePublic
vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: vi.fn(() => ({
    setTenantFromAdmin: mockSetTenantFromAdmin,
    clearTenant: mockClearTenant,
  })),
  TenantProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { AdminAuthProvider } from '@/contexts/AdminAuthContext'
import { useAdminAuth } from '../useAdminAuth'

function buildChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  chain['select'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['single'] = vi.fn().mockResolvedValue(result)
  return chain
}

const createWrapper = (initialPath = '/') => ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <AdminAuthProvider>{children}</AdminAuthProvider>
  </MemoryRouter>
)

function mockStoredAdminSession() {
  mockGetSession.mockResolvedValueOnce({
    data: {
      session: {
        user: { id: 'user-1', email: 'admin@test.it' },
      },
    },
    error: null,
  })
  mockFrom.mockReturnValueOnce(
    buildChain({ data: { name: 'Admin Test', tenant_id: 'tenant-1' }, error: null })
  )
  mockFrom.mockReturnValueOnce(
    buildChain({ data: { is_active: true }, error: null })
  )
}

describe('useAdminAuth', () => {
  beforeEach(() => {
    // clearAllMocks mantiene le implementazioni dei vi.mock factories (useTenantContext etc.)
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockSetTenantFromAdmin.mockResolvedValue(undefined)
  })

  it('user è null all\'avvio senza sessione attiva', async () => {
    const { result } = renderHook(() => useAdminAuth(), { wrapper: createWrapper() })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('login OK con credenziali corrette', async () => {
    const authUser = { id: 'user-1', email: 'admin@test.it' }

    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: authUser, session: { access_token: 'tok' } },
      error: null,
    })
    // from('admin_users')
    mockFrom.mockReturnValueOnce(
      buildChain({ data: { name: 'Admin Test', tenant_id: 'tenant-1' }, error: null })
    )
    // from('organizations') — subscription check
    mockFrom.mockReturnValueOnce(
      buildChain({ data: { is_active: true }, error: null })
    )

    const { result } = renderHook(() => useAdminAuth(), { wrapper: createWrapper() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    let loginResult!: { success: boolean; error?: string }
    await act(async () => {
      loginResult = await result.current.login('admin@test.it', 'password123')
    })

    expect(loginResult.success).toBe(true)
    expect(result.current.user?.email).toBe('admin@test.it')
  })

  it('login fallisce con password errata', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    const { result } = renderHook(() => useAdminAuth(), { wrapper: createWrapper() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

    let loginResult!: { success: boolean; error?: string }
    await act(async () => {
      loginResult = await result.current.login('admin@test.it', 'password-sbagliata')
    })

    expect(loginResult.success).toBe(false)
    expect(loginResult.error).toBe('Invalid login credentials')
    expect(result.current.user).toBeNull()
  })

  it('logout pulisce lo stato utente e naviga a /login', async () => {
    // Setup: simula un utente loggato
    const authUser = { id: 'user-1', email: 'admin@test.it' }
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: authUser, session: { access_token: 'tok' } },
      error: null,
    })
    mockFrom.mockReturnValueOnce(
      buildChain({ data: { name: 'Admin Test', tenant_id: 'tenant-1' }, error: null })
    )
    mockFrom.mockReturnValueOnce(
      buildChain({ data: { is_active: true }, error: null })
    )

    const { result } = renderHook(() => useAdminAuth(), { wrapper: createWrapper() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { await result.current.login('admin@test.it', 'password123') })

    expect(result.current.user).not.toBeNull()

    await act(async () => { await result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('restore sessione admin su /admin chiama setTenantFromAdmin', async () => {
    mockStoredAdminSession()

    const { result } = renderHook(() => useAdminAuth(), { wrapper: createWrapper('/admin') })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockSetTenantFromAdmin).toHaveBeenCalledWith('admin@test.it')
    expect(result.current.user?.email).toBe('admin@test.it')
  })

  it('restore sessione admin su /prenota/:slug non chiama setTenantFromAdmin', async () => {
    mockStoredAdminSession()

    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper('/prenota/some-slug'),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockSetTenantFromAdmin).not.toHaveBeenCalled()
    expect(result.current.user?.email).toBe('admin@test.it')
  })

  it('restore sessione admin su /menu/:slug non chiama setTenantFromAdmin', async () => {
    mockStoredAdminSession()

    const { result } = renderHook(() => useAdminAuth(), {
      wrapper: createWrapper('/menu/some-slug'),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockSetTenantFromAdmin).not.toHaveBeenCalled()
    expect(result.current.user?.email).toBe('admin@test.it')
  })
})
