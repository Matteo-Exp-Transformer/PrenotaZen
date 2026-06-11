// @admin-blindatura: calendario
// Copre: il conteggio coperti per giorno che alimenta la % riempimento del calendario.
//        Decisioni Matteo 11-06-26: conta SOLO le accettate; i no-show LIBERANO il posto (esclusi);
//        le pending non occupano; serve l'orario confermato. Stesso criterio del blocco pubblico,
//        così calendario e pagina pubblica contano la stessa cosa.

import { describe, expect, it } from 'vitest'
import { sumGuestsByDate } from '../capacityCalculator'
import type { BookingRequest } from '@/types/booking'

function booking(partial: Partial<BookingRequest>): BookingRequest {
  return {
    id: Math.random().toString(36).slice(2),
    status: 'accepted',
    no_show: false,
    num_guests: 2,
    confirmed_start: '2026-06-12T20:00:00+00:00',
    confirmed_end: '2026-06-12T23:00:00+00:00',
    desired_date: '2026-06-12',
    client_name: 'Test',
    ...partial,
  } as BookingRequest
}

describe('sumGuestsByDate — conteggio coperti per giorno (admin-blindatura calendario)', () => {
  it('somma i coperti delle accettate per data', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', num_guests: 4 }),
      booking({ confirmed_start: '2026-06-12T13:00:00+00:00', num_guests: 2 }),
      booking({ confirmed_start: '2026-06-13T20:00:00+00:00', num_guests: 3 }),
    ])
    expect(result['2026-06-12']).toBe(6)
    expect(result['2026-06-13']).toBe(3)
  })

  it('ESCLUDE i no-show: liberano il posto, non occupano coperti', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', num_guests: 4 }),
      booking({ confirmed_start: '2026-06-12T20:30:00+00:00', num_guests: 5, no_show: true }),
    ])
    expect(result['2026-06-12']).toBe(4) // il no-show da 5 non conta
  })

  it('ESCLUDE le pending: non occupano finché non accettate', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', num_guests: 4 }),
      booking({ status: 'pending', num_guests: 8 }),
    ])
    expect(result['2026-06-12']).toBe(4)
  })

  it('ESCLUDE rejected e deleted', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', num_guests: 4 }),
      booking({ status: 'rejected', num_guests: 10 }),
      booking({ status: 'deleted', num_guests: 10 }),
    ])
    expect(result['2026-06-12']).toBe(4)
  })

  it('ignora le accettate senza confirmed_start (orario non confermato)', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: null as unknown as string, num_guests: 6 }),
    ])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('ESCLUDE accepted con confirmed_start ma senza confirmed_end (legacy) — allineato a digest/eventi', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', confirmed_end: null as unknown as string, num_guests: 8 }),
      booking({ confirmed_start: '2026-06-12T13:00:00+00:00', num_guests: 4 }),
    ])
    expect(result['2026-06-12']).toBe(4)
  })

  it('tratta num_guests mancante come 0', () => {
    const result = sumGuestsByDate([
      booking({ confirmed_start: '2026-06-12T20:00:00+00:00', num_guests: undefined as unknown as number }),
    ])
    expect(result['2026-06-12']).toBe(0)
  })

  it('lista vuota → oggetto vuoto', () => {
    expect(sumGuestsByDate([])).toEqual({})
  })
})
