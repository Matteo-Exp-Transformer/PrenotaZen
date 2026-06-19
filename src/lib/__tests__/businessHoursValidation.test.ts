import { describe, expect, it } from 'vitest'
import type { BusinessHourSlot, BusinessHours } from '@/lib/businessHours'
import {
  getDefaultBusinessHours,
  hasAnyBusinessHoursConfigured,
  isValidBookingDateTime,
  sortBusinessHourSlots,
  validateBusinessHourSlots,
  validateBusinessHours,
} from '@/lib/businessHours'

function slots(...pairs: [string, string][]): BusinessHourSlot[] {
  return pairs.map(([open, close]) => ({ open, close }))
}

describe('getDefaultBusinessHours', () => {
  it('restituisce tutti i giorni chiusi (nessun orario demo)', () => {
    const hours = getDefaultBusinessHours()
    for (const day of [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ] as const) {
      expect(hours[day]).toBeNull()
    }
    expect(hasAnyBusinessHoursConfigured(hours)).toBe(false)
  })
})

describe('sortBusinessHourSlots', () => {
  it('ordina per orario di apertura', () => {
    const input = slots(['19:00', '23:00'], ['11:00', '15:00'])
    expect(sortBusinessHourSlots(input).map((s) => s.open)).toEqual(['11:00', '19:00'])
  })
})

describe('validateBusinessHourSlots', () => {
  it('singola fascia → nessun errore', () => {
    expect(validateBusinessHourSlots(slots(['11:00', '15:00']))).toBeNull()
  })

  it('11:00–15:00 + 14:00–20:00 → sovrapposizione', () => {
    expect(validateBusinessHourSlots(slots(['11:00', '15:00'], ['14:00', '20:00']))).toBe(
      'Due fasce di apertura si sovrappongono'
    )
  })

  it('11:00–15:00 + 19:00–23:00 → OK', () => {
    expect(validateBusinessHourSlots(slots(['11:00', '15:00'], ['19:00', '23:00']))).toBeNull()
  })

  it('19:00–01:00 + pranzo coerente → OK (mezzanotte)', () => {
    expect(validateBusinessHourSlots(slots(['19:00', '01:00'], ['11:00', '15:00']))).toBeNull()
  })

  it('19:00–01:00 + 20:00–22:00 → sovrapposizione notturna', () => {
    expect(validateBusinessHourSlots(slots(['19:00', '01:00'], ['20:00', '22:00']))).toBe(
      'Due fasce di apertura si sovrappongono'
    )
  })

  it('rileva overlap anche se inserite fuori ordine', () => {
    expect(validateBusinessHourSlots(slots(['14:00', '20:00'], ['11:00', '15:00']))).toBe(
      'Due fasce di apertura si sovrappongono'
    )
  })
})

describe('isValidBookingDateTime', () => {
  const sundayOvernight: BusinessHours = {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: [{ open: '17:30', close: '04:00' }],
  }

  const lunchOnly: BusinessHours = {
    monday: [{ open: '12:00', close: '15:00' }],
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  }

  it('accetta orario serale in fascia overnight (17:30→04:00)', () => {
    expect(isValidBookingDateTime('2026-06-21', '23:00', sundayOvernight)).toBe(true)
  })

  it('accetta orario dopo mezzanotte nella stessa fascia overnight', () => {
    expect(isValidBookingDateTime('2026-06-21', '03:00', sundayOvernight)).toBe(true)
  })

  it('rifiuta orario oltre la chiusura overnight', () => {
    expect(isValidBookingDateTime('2026-06-21', '05:00', sundayOvernight)).toBe(false)
  })

  it('fasce diurne normali invariate (12:00–15:00)', () => {
    expect(isValidBookingDateTime('2026-06-15', '12:30', lunchOnly)).toBe(true)
    expect(isValidBookingDateTime('2026-06-15', '15:00', lunchOnly)).toBe(true)
    expect(isValidBookingDateTime('2026-06-15', '11:30', lunchOnly)).toBe(false)
    expect(isValidBookingDateTime('2026-06-15', '15:30', lunchOnly)).toBe(false)
  })
})

describe('validateBusinessHours', () => {
  it('include il nome del giorno nel messaggio', () => {
    const hours = {
      monday: slots(['11:00', '15:00'], ['14:00', '20:00']),
      tuesday: null,
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null,
    }
    expect(validateBusinessHours(hours)).toBe(
      'Lunedì: Due fasce di apertura si sovrappongono'
    )
  })
})
