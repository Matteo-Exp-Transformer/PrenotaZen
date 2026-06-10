// @prenota-blindatura: server-config
// Copre: la LOCK «nessuna striscia si salva come stringa vuota '', mai NULL» del serializer
//        restaurantSettingRegistry.public_booking_strip_photo (colonna setting_value è NOT NULL).
//        Scrivere NULL è già stato un incident: questo test blinda il round-trip null → '' → null.

import { describe, expect, it } from 'vitest'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

const entry = restaurantSettingRegistry.public_booking_strip_photo

describe('public_booking_strip_photo — serializer LOCK (null mai in DB)', () => {
  it('null serializza come stringa vuota, NON null (colonna NOT NULL)', () => {
    const serialized = entry.serializeToDb(null)
    expect(serialized).toBe('')
    expect(serialized).not.toBeNull()
  })

  it('round-trip: null → serialize → parse torna null (nessuna striscia)', () => {
    const serialized = entry.serializeToDb(null)
    expect(entry.parseFromDb(serialized)).toBeNull()
  })

  it('una striscia valida viene preservata nel round-trip', () => {
    const serialized = entry.serializeToDb('strip-01')
    expect(serialized).toBe('strip-01')
    expect(entry.parseFromDb(serialized)).toBe('strip-01')
  })

  it('validate accetta null (nessuna striscia) e un id valido', () => {
    expect(entry.validate(null)).toBeNull()
    expect(entry.validate('strip-01')).toBeNull()
  })

  it('validate rifiuta un valore non valido', () => {
    expect(entry.validate('non-esiste')).not.toBeNull()
  })
})
