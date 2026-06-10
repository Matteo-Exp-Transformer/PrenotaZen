import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

/**
 * Server MSW: intercetta le chiamate HTTP di Supabase rimaste fuori dai vi.mock().
 * I test unit usano vi.mock() per mockare il client; MSW è il safety net.
 */
export const server = setupServer(
  http.get('https://test.supabase.co/auth/v1/user', () =>
    HttpResponse.json({ id: null, aud: 'authenticated' })
  ),
  http.post('https://test.supabase.co/auth/v1/token', () =>
    HttpResponse.json({ access_token: 'mock-token', token_type: 'bearer' })
  ),
  http.get('https://test.supabase.co/rest/v1/:table', () =>
    HttpResponse.json([])
  ),
  http.post('https://test.supabase.co/rest/v1/:table', () =>
    HttpResponse.json({})
  ),
  http.patch('https://test.supabase.co/rest/v1/:table', () =>
    HttpResponse.json({})
  ),
  http.delete('https://test.supabase.co/rest/v1/:table', () =>
    HttpResponse.json({})
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
