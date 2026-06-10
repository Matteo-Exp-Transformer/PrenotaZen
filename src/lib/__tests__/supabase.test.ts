import { describe, it, expect, vi } from 'vitest'

// Mocka createClient prima che supabase.ts lo esegua al caricamento del modulo.
// Previene chiamate di rete reali e l'accesso a window.localStorage.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  })),
}))

import {
  isInvalidStoredRefreshTokenError,
  handleSupabaseError,
  getCurrentUser,
} from '../supabase'

describe('isInvalidStoredRefreshTokenError', () => {
  it('restituisce false per null', () => {
    expect(isInvalidStoredRefreshTokenError(null)).toBe(false)
  })

  it('restituisce false per undefined', () => {
    expect(isInvalidStoredRefreshTokenError(undefined)).toBe(false)
  })

  it('restituisce false per errore generico di rete', () => {
    expect(isInvalidStoredRefreshTokenError({ message: 'Network error' })).toBe(false)
  })

  it('restituisce true per codice refresh_token_not_found', () => {
    expect(
      isInvalidStoredRefreshTokenError({ message: 'some error', code: 'refresh_token_not_found' })
    ).toBe(true)
  })

  it('restituisce true per messaggio "invalid refresh token"', () => {
    expect(
      isInvalidStoredRefreshTokenError({ message: 'Invalid Refresh Token' })
    ).toBe(true)
  })

  it('restituisce true per messaggio "refresh token not found"', () => {
    expect(
      isInvalidStoredRefreshTokenError({ message: 'Refresh token not found' })
    ).toBe(true)
  })
})

describe('handleSupabaseError', () => {
  it('restituisce il campo message se presente', () => {
    expect(handleSupabaseError({ message: 'Database connection failed' })).toBe(
      'Database connection failed'
    )
  })

  it('restituisce messaggio generico per stringa', () => {
    expect(handleSupabaseError('raw string')).toBe(
      'Si è verificato un errore. Riprova più tardi.'
    )
  })

  it('restituisce messaggio generico per null', () => {
    expect(handleSupabaseError(null)).toBe('Si è verificato un errore. Riprova più tardi.')
  })

  it('restituisce messaggio generico per numero', () => {
    expect(handleSupabaseError(500)).toBe('Si è verificato un errore. Riprova più tardi.')
  })
})

describe('getCurrentUser', () => {
  it('restituisce null quando non c\'è utente autenticato', async () => {
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })
})
