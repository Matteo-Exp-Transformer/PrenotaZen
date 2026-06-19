// @admin-blindatura: settings-time-slots
// Copre: cap per-fascia (slot_guest_capacities) — fonte autoritativa del limite per-fascia letta da
//        edge e badge (modello 18-06-26); vuoto/invalid/alto + interruttore globale slot_limit_enabled.

import { describe, expect, it } from 'vitest'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

const slotCapEntry = restaurantSettingRegistry.slot_guest_capacities
const slotLimitEnabledEntry = restaurantSettingRegistry.slot_limit_enabled

describe('settings-time-slots M4 — registry cap per-fascia + interruttore globale', () => {
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

  it('interruttore globale slot_limit_enabled: chiave separata, default false', () => {
    expect(slotLimitEnabledEntry.key).toBe('slot_limit_enabled')
    expect(slotCapEntry.key).toBe('slot_guest_capacities')
    // Il blocco pubblico per-fascia dipende dall'interruttore globale, non dai soli cap.
    expect(slotLimitEnabledEntry.parseFromDb(null)).toBe(false)
    expect(slotLimitEnabledEntry.parseFromDb(true)).toBe(true)
  })
})
