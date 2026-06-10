// @prenota-blindatura: server-config
// Copre: i cap testo/numerici del CLIENT (BOOKING_PUBLIC_CLIENT_TEXT_LIMITS) restano allineati
//        ai valori ri-validati dall'edge function create-booking (difesa server). Se qualcuno
//        sfasa un limite client senza aggiornare l'edge (o viceversa), questo test fallisce.

import { describe, expect, it } from 'vitest'
import { BOOKING_PUBLIC_CLIENT_TEXT_LIMITS } from '../bookingPrenotaTextLimits'

/**
 * Contratto con `supabase/functions/create-booking/index.ts`.
 * L'edge è Deno e NON è importabile qui: replichiamo i valori che l'edge applica
 * (costante `BOOKING_PUBLIC_CLIENT_TEXT_LIMITS` dentro l'edge, marcata «Sync con ...»).
 * Aggiornare ENTRAMBI insieme quando un limite cambia.
 */
const EDGE_CLIENT_TEXT_LIMITS = {
  clientName: 65,
  clientEmail: 65,
  clientPhone: 30,
  dietaryText: 550,
  specialRequests: 550,
  numGuestsMax: 110,
} as const

describe('client ↔ edge create-booking — coerenza limiti', () => {
  it('ogni campo del client ha lo stesso cap dell edge', () => {
    expect(BOOKING_PUBLIC_CLIENT_TEXT_LIMITS).toStrictEqual(EDGE_CLIENT_TEXT_LIMITS)
  })

  it('le chiavi coperte dal client sono esattamente quelle ri-validate dall edge', () => {
    expect(Object.keys(BOOKING_PUBLIC_CLIENT_TEXT_LIMITS).sort()).toStrictEqual(
      Object.keys(EDGE_CLIENT_TEXT_LIMITS).sort(),
    )
  })
})
