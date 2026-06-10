import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  createBookingDateTime,
  extractTimeFromISO,
  getAccurateStartTime,
  isWallClockStartBeforeNow,
  trimTimeToHHmm,
} from '../dateUtils'
import type { BookingRequest } from '@/types/booking'

/**
 * CONTRATTO ORARIO — previene il bug "+N ore" causato dal round-trip timestamptz.
 *
 * Regola invariante:
 *   L'orario inserito dall'utente (es. "20:15") deve comparire identico
 *   ovunque sia mostrato nell'app — pagina pubblica, dashboard admin, calendario, digest.
 *
 * Modello adottato:
 *   - createBookingDateTime salva l'orario come cifre letterali con offset +00:00
 *     (PostgreSQL lo tratta come istante UTC, ma extractTimeFromISO legge le cifre)
 *   - desired_time (campo TIME di Postgres) è l'ancora principale: non subisce
 *     conversioni di fuso al round-trip. È SEMPRE scritto al momento dell'accettazione.
 *   - getAccurateStartTime preferisce desired_time. Il fallback su confirmed_start
 *     funziona solo se l'offset è +00:00 (come scriviamo noi).
 *
 * Copertura:
 *   A) Scrittura — createBookingDateTime produce la stringa ISO corretta
 *   B) Lettura — getAccurateStartTime restituisce HH:mm corretto in tutti i casi normali
 *   C) Ciclo completo — dalla scelta dell'orario al display, nessuna distorsione
 *   D) Invariante di garanzia — desired_time è derivabile da confirmedStart prima del DB
 */

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeBooking(
  desiredTime: string | null,
  confirmedStart: string | null,
  confirmedEnd?: string | null
): BookingRequest {
  return {
    id: 'test-id',
    tenant_id: 'tenant-1',
    client_name: 'Test',
    client_email: '',
    client_phone: '',
    num_guests: 2,
    status: 'accepted',
    booking_source: 'admin',
    desired_date: '2026-05-14',
    desired_time: desiredTime,
    confirmed_start: confirmedStart,
    confirmed_end: confirmedEnd ?? null,
    notes: null,
    created_at: '',
  } as unknown as BookingRequest
}

// ---------------------------------------------------------------------------
// A) Scrittura — createBookingDateTime
// ---------------------------------------------------------------------------
describe('A) createBookingDateTime — scrittura (pagina pubblica e admin)', () => {
  it('conserva HH:mm esatti — caso serata standard', () => {
    const iso = createBookingDateTime('2026-05-14', '20:15')
    expect(extractTimeFromISO(iso)).toBe('20:15')
  })

  it('produce offset +00:00 (non Z) così le cifre restano leggibili dopo il round-trip', () => {
    const iso = createBookingDateTime('2026-05-14', '20:15')
    expect(iso).toMatch(/T20:15:00\+00:00$/)
  })

  it('conserva HH:mm — orario di pranzo', () => {
    const iso = createBookingDateTime('2026-05-14', '12:30')
    expect(extractTimeFromISO(iso)).toBe('12:30')
  })

  it('conserva HH:mm — mezzanotte esatta senza spostare il giorno', () => {
    const iso = createBookingDateTime('2026-05-14', '00:00')
    expect(extractTimeFromISO(iso)).toBe('00:00')
    expect(iso).toMatch(/^2026-05-14/)
  })

  it('gestisce attraversamento mezzanotte — fine sposta al giorno dopo, orario invariato', () => {
    const iso = createBookingDateTime('2026-05-14', '02:00', false, '22:00')
    expect(extractTimeFromISO(iso)).toBe('02:00')
    expect(iso).toMatch(/^2026-05-15/)
  })

  it('gestisce fine mese — 31 → 1 del mese successivo', () => {
    const iso = createBookingDateTime('2026-01-31', '02:00', false, '23:00')
    expect(extractTimeFromISO(iso)).toBe('02:00')
    expect(iso).toMatch(/^2026-02-01/)
  })
})

// ---------------------------------------------------------------------------
// B) Lettura — getAccurateStartTime
// ---------------------------------------------------------------------------
describe('B) getAccurateStartTime — lettura (dashboard admin e calendario)', () => {
  it('usa desired_time — formato HH:mm:ss restituito da Postgres', () => {
    const b = makeBooking('20:15:00', '2026-05-14T20:15:00+00:00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('usa desired_time — formato HH:mm', () => {
    const b = makeBooking('20:15', '2026-05-14T20:15:00+00:00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('usa desired_time anche se confirmed_start ha offset +02:00 (bug CEST prevenuto)', () => {
    // Simula: Postgres restituisce confirmed_start con offset del server (+02:00 CEST)
    // desired_time protegge dall'errore — deve vincere sempre
    const b = makeBooking('20:15:00', '2026-05-14T22:15:00+02:00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('usa desired_time anche se confirmed_start ha offset +01:00 (bug CET prevenuto)', () => {
    const b = makeBooking('20:15:00', '2026-05-14T21:15:00+01:00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('fallback su confirmed_start con offset +00:00 — cifre leggibili direttamente', () => {
    const b = makeBooking(null, '2026-05-14T20:15:00+00:00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('fallback su confirmed_start con separatore spazio (alcune versioni PostgREST)', () => {
    const b = makeBooking(null, '2026-05-14 20:15:00+00')
    expect(getAccurateStartTime(b)).toBe('20:15')
  })

  it('restituisce stringa vuota se entrambi i campi sono null', () => {
    const b = makeBooking(null, null)
    expect(getAccurateStartTime(b)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// C) Ciclo completo — dall'input utente al display
// ---------------------------------------------------------------------------
describe('C) Ciclo completo — input utente → DB → display', () => {
  it('flusso prenotazione pubblica: orario inserito dal cliente intatto dopo round-trip simulato', () => {
    // 1. Il cliente sceglie "20:15" sul form pubblico
    const inputOrario = '20:15'
    const inputData = '2026-05-14'

    // 2. createBookingDateTime scrive nel DB
    const confirmedStart = createBookingDateTime(inputData, inputOrario)

    // 3. desired_time è salvato direttamente come stringa (campo TIME)
    const desired_time = inputOrario

    // 4. Il record torna dal DB (simula la prenotazione accettata)
    const booking = makeBooking(desired_time, confirmedStart)

    // 5. Il display legge getAccurateStartTime — deve essere identico all'input
    expect(getAccurateStartTime(booking)).toBe(inputOrario)
  })

  it('flusso walk-in: orario now() intatto dopo round-trip simulato', () => {
    const ora = '21:30'
    const data = '2026-05-14'
    const confirmedStart = createBookingDateTime(data, ora)
    const booking = makeBooking(ora, confirmedStart)
    expect(getAccurateStartTime(booking)).toBe(ora)
  })

  it('flusso accettazione admin: desired_time derivato da confirmedStart prima del DB è identico all\'orario scelto', () => {
    // Simula cosa fa useAcceptBooking quando desiredTime non è passato esplicitamente:
    // lo deriva da confirmedStart (ancora nella nostra forma +00:00, prima del round-trip)
    const orarioScelto = '19:00'
    const confirmedStart = createBookingDateTime('2026-05-14', orarioScelto)

    // extractTimeFromISO su confirmedStart prima del round-trip → cifre corrette
    const desiredTimeDerived = extractTimeFromISO(confirmedStart)
    expect(desiredTimeDerived).toBe(orarioScelto)

    // Una volta salvato come desired_time, il display è garantito
    const booking = makeBooking(desiredTimeDerived, confirmedStart)
    expect(getAccurateStartTime(booking)).toBe(orarioScelto)
  })
})

// ---------------------------------------------------------------------------
// D) Invariante di garanzia — se questa si rompe, il bug torna
// ---------------------------------------------------------------------------
describe('D) Invariante — regole che non devono mai cambiare', () => {
  it('createBookingDateTime usa sempre +00:00, mai Z', () => {
    const cases = ['08:00', '12:30', '20:15', '23:59', '00:00']
    for (const time of cases) {
      const iso = createBookingDateTime('2026-05-14', time)
      expect(iso, `offset sbagliato per ${time}`).toMatch(/\+00:00$/)
      expect(iso, `usa Z invece di +00:00 per ${time}`).not.toMatch(/Z$/)
    }
  })

  it('extractTimeFromISO legge correttamente con offset +00:00 per tutti gli orari del giorno', () => {
    const orari = ['00:00', '06:00', '12:00', '18:00', '20:15', '23:59']
    for (const orario of orari) {
      const iso = createBookingDateTime('2026-05-14', orario)
      expect(extractTimeFromISO(iso), `fallisce per ${orario}`).toBe(orario)
    }
  })

  it('desired_time vince sempre su confirmed_start, qualunque sia il suo offset', () => {
    const desiredTime = '20:15'
    const offsetVarianti = [
      '2026-05-14T20:15:00+00:00',
      '2026-05-14T22:15:00+02:00',
      '2026-05-14T21:15:00+01:00',
      '2026-05-14T18:15:00-02:00',
    ]
    for (const confirmedStart of offsetVarianti) {
      const b = makeBooking(desiredTime, confirmedStart)
      expect(getAccurateStartTime(b), `fallisce con confirmed_start=${confirmedStart}`).toBe(desiredTime)
    }
  })
})

// ---------------------------------------------------------------------------
// E) Orario a muro vs "adesso" — alert accettazione / salvataggio
// ---------------------------------------------------------------------------
describe('E) isWallClockStartBeforeNow — confronto locale (fake timers)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stesso giorno: inizio prima di ora → true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 16, 0, 0))
    expect(isWallClockStartBeforeNow('2026-05-14', '14:00')).toBe(true)
  })

  it('stesso giorno: inizio dopo ora → false', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 16, 0, 0))
    expect(isWallClockStartBeforeNow('2026-05-14', '18:00')).toBe(false)
  })

  it('stesso giorno: stessa ora (minuto) → false', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 16, 0, 0))
    expect(isWallClockStartBeforeNow('2026-05-14', '16:00')).toBe(false)
  })

  it('stesso giorno: un millisecondo dopo l’orario di inizio → true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 16, 0, 0, 1))
    expect(isWallClockStartBeforeNow('2026-05-14', '16:00')).toBe(true)
  })

  it('giorno precedente → true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 10, 0, 0))
    expect(isWallClockStartBeforeNow('2026-05-13', '23:30')).toBe(true)
  })

  it('mezzanotte: inizio a 00:00 con ora attuale 00:30 → true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 0, 30, 0))
    expect(isWallClockStartBeforeNow('2026-05-14', '00:00')).toBe(true)
  })

  it('data non valida → false', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 12, 0, 0))
    expect(isWallClockStartBeforeNow('not-a-date', '12:00')).toBe(false)
  })

  it('ora non valida → false', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 14, 12, 0, 0))
    expect(isWallClockStartBeforeNow('2026-05-14', '99:00')).toBe(false)
  })

  it('trimTimeToHHmm accetta HH:mm:ss', () => {
    expect(trimTimeToHHmm('14:30:59')).toBe('14:30')
  })
})
