// @admin-blindatura: settings-time-slots
// Copre: cap per-fascia (slot_guest_capacities) distinto da daily_guest_limit; vuoto/invalid/alto

import { describe, expect, it } from 'vitest'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

const slotCapEntry = restaurantSettingRegistry.slot_guest_capacities
const dailyLimitEntry = restaurantSettingRegistry.daily_guest_limit

describe('settings-time-slots M4 — registry cap per-fascia vs limite giornaliero', () => {
  it('slot_guest_capacities: vuoto/null per fascia è valido (nessun tetto)', () => {
    expect(slotCapEntry.validate({})).toBeNull()
    expect(slotCapEntry.validate({ 'slot-1': null })).toBeNull()
    expect(slotCapEntry.parseFromDb(null)).toEqual({})
  })

  it('slot_guest_capacities: cap numerico valido nel round-trip', () => {
    const value = { 'slot-pranzo': 80, 'slot-cena': 120 }
    expect(slotCapEntry.validate(value)).toBeNull()
    const serialized = slotCapEntry.serializeToDb(value)
    expect(slotCapEntry.parseFromDb(serialized)).toEqual(value)
  })

  it('slot_guest_capacities: 0 e oltre 5000 non validi (cap per-fascia, non daily)', () => {
    expect(slotCapEntry.validate({ 'slot-1': 0 })).not.toBeNull()
    expect(slotCapEntry.validate({ 'slot-1': 5001 })).not.toBeNull()
  })

  it('daily_guest_limit resta chiave separata: 0 = nessun limite pubblico, non cap fascia', () => {
    expect(dailyLimitEntry.validate(0)).toBeNull()
    expect(slotCapEntry.validate({ 'slot-1': 0 })).not.toBeNull()
    expect(dailyLimitEntry.key).toBe('daily_guest_limit')
    expect(slotCapEntry.key).toBe('slot_guest_capacities')
  })
})
