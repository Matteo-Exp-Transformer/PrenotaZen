// @admin-blindatura: settings-business-hours
// Copre: tutti chiusi → nessuna sezione Orari pubblica; overlap blocca admin; pubblico safe

import { describe, expect, it } from 'vitest'
import {
  getDefaultBusinessHours,
  hasAnyBusinessHoursConfigured,
  parseBusinessHours,
  validateBusinessHours,
} from '@/lib/businessHours'

describe('settings-business-hours M4', () => {
  it('tutti i giorni chiusi/non configurati → hasAnyBusinessHoursConfigured false', () => {
    const empty = getDefaultBusinessHours()
    expect(hasAnyBusinessHoursConfigured(empty)).toBe(false)
  })

  it('almeno un giorno con fascia → hasAnyBusinessHoursConfigured true', () => {
    const hours = getDefaultBusinessHours()
    hours.monday = [{ open: '12:00', close: '15:00' }]
    expect(hasAnyBusinessHoursConfigured(hours)).toBe(true)
  })

  it('overlap fasce → validateBusinessHours blocca admin', () => {
    const hours = getDefaultBusinessHours()
    hours.monday = [
      { open: '12:00', close: '15:00' },
      { open: '14:00', close: '18:00' },
    ]
    expect(validateBusinessHours(hours)).not.toBeNull()
  })

  it('pubblico: parse invalido → null (no crash)', () => {
    expect(parseBusinessHours(null)).toBeNull()
    expect(parseBusinessHours('not-an-object')).toBeNull()
    expect(parseBusinessHours({ monday: 'not-an-array' })).toBeNull()
  })
})
