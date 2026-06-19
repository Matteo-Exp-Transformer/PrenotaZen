// @admin-blindatura: settings-registry
// Copre: nome obbligatorio, contatti opzionali, cap 45/65/30/120, interruttori limiti per-fascia/orario

import { describe, expect, it } from 'vitest'
import {
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
} from '../../constants/bookingPrenotaTextLimits'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

describe('settings-registry M4 — anagrafica e limiti', () => {
  const name = restaurantSettingRegistry.restaurant_name
  const email = restaurantSettingRegistry.contact_email
  const phone = restaurantSettingRegistry.contact_phone
  const address = restaurantSettingRegistry.contact_address
  const slotLimitEnabled = restaurantSettingRegistry.slot_limit_enabled
  const rejectOutOfSlot = restaurantSettingRegistry.booking_reject_out_of_slot

  it('cap costanti allineati M4 (45/65/30/120)', () => {
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName).toBe(45)
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactEmail).toBe(65)
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactPhone).toBe(30)
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactAddress).toBe(120)
  })

  it('restaurant_name: vuoto rifiutato, max 45', () => {
    expect(name.validate('')).not.toBeNull()
    expect(name.validate('   ')).not.toBeNull()
    expect(name.validate('Locale')).toBeNull()
    expect(name.validate('x'.repeat(45))).toBeNull()
    expect(name.validate('x'.repeat(46))).not.toBeNull()
  })

  it('contatti opzionali: vuoto OK', () => {
    expect(email.validate('')).toBeNull()
    expect(phone.validate('')).toBeNull()
    expect(address.validate('')).toBeNull()
    expect(email.validate(null)).toBeNull()
  })

  it('contatti: rispettano cap registry', () => {
    const email65 = `${'a'.repeat(60)}@b.it`
    expect(email65.length).toBe(65)
    expect(email.validate(email65)).toBeNull()
    expect(email.validate(`${'a'.repeat(61)}@b.it`)).not.toBeNull()
    expect(phone.validate('+39 333 12345678901234567890123')).not.toBeNull()
    expect(phone.validate('+39 333 1234567')).toBeNull()
    expect(address.validate('x'.repeat(120))).toBeNull()
    expect(address.validate('x'.repeat(121))).not.toBeNull()
  })

  it('interruttori limiti per-fascia/orario: default false, boolean', () => {
    expect(slotLimitEnabled.parseFromDb(null)).toBe(false)
    expect(rejectOutOfSlot.parseFromDb(null)).toBe(false)
    expect(slotLimitEnabled.parseFromDb(true)).toBe(true)
    expect(rejectOutOfSlot.parseFromDb('true')).toBe(true)
    expect(slotLimitEnabled.validate(true)).toBeNull()
    expect(rejectOutOfSlot.validate('nope')).not.toBeNull()
  })
})
