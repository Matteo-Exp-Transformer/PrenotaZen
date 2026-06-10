import { createClient, type AuthError } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variabili d\'ambiente Supabase mancanti. Controlla il file .env.local'
  )
}

/** Refresh token assente o non più valido (es. progetto/env cambiati, sessione revocata). */
export function isInvalidStoredRefreshTokenError(
  error: Pick<AuthError, 'message'> & Partial<Pick<AuthError, 'code'>> | null | undefined
): boolean {
  if (!error?.message) return false
  const msg = error.message.toLowerCase()
  const code = String(error.code ?? '').toLowerCase()
  return (
    code === 'refresh_token_not_found' ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found')
  )
}

/** Client autenticato — per operazioni admin (rispetta RLS) */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'pkce',
  },
  global: {
    headers: { 'X-Client-Info': 'booking-admin' },
  },
})

/** Evita loop di refresh su token corrotti lasciati in localStorage. */
void supabase.auth.getSession().then(async ({ error }) => {
  if (error && isInvalidStoredRefreshTokenError(error)) {
    await supabase.auth.signOut({ scope: 'local' })
  }
})

/** Helpers */
export function handleSupabaseError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message
  }
  return 'Si è verificato un errore. Riprova più tardi.'
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return null
  return user
}
