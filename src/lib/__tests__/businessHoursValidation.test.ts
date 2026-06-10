import { describe, expect, it } from 'vitest'
import type { BusinessHourSlot } from '@/lib/businessHours'
import {
  sortBusinessHourSlots,
  validateBusinessHourSlots,
  validateBusinessHours,
} from '@/lib/businessHours'

function slots(...pairs: [string, string][]): BusinessHourSlot[] {
  return pairs.map(([open, close]) => ({ open, close }))
}

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
