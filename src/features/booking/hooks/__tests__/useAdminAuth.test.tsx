import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// Crea mock condivisi prima dell'hoisting
const { mockSignInWithPassword, mockGetSession, mockSignOut, mockFrom, mockNavigate } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
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
    setTenantFromAdmin: vi.fn().mockResolvedValue(undefined),
    clearTenant: vi.fn(),
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <AdminAuthProvider>{children}</AdminAuthProvider>
  </MemoryRouter>
)

describe('useAdminAuth', () => {
  beforeEach(() => {
    // clearAllMocks mantiene le implementazioni dei vi.mock factories (useTenantContext etc.)
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('user è null all\'avvio senza sessione attiva', async () => {
    const { result } = renderHook(() => useAdminAuth(), { wrapper })

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

    const { result } = renderHook(() => useAdminAuth(), { wrapper })
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

    const { result } = renderHook(() => useAdminAuth(), { wrapper })
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

    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    await act(async () => { await result.current.login('admin@test.it', 'password123') })

    expect(result.current.user).not.toBeNull()

    await act(async () => { await result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
