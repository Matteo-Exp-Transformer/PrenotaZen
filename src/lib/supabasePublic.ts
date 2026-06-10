import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variabili d\'ambiente Supabase mancanti.')
}

/** Client pubblico — per operazioni anonime (form prenotazione, lettura slug) */
export const supabasePublic = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'sb-public-no-session',
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  },
  global: {
    headers: { 'X-Client-Info': 'booking-public' },
  },
})
