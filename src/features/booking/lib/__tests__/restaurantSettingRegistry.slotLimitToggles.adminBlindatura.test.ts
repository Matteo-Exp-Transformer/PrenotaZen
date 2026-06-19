// @admin-blindatura: calendario
// Copre: i due interruttori del nuovo modello limiti coperti (decisione Matteo 18-06-26, sostituisce il
//        vecchio daily_guest_limit). `slot_limit_enabled` = interruttore globale dei limiti coperti
//        per-fascia; `booking_reject_out_of_slot` = vincolo orario (rifiuta gli orari fuori da ogni
//        fascia). Entrambi default false (nessun blocco), boolean, round-trip stabile.

import { describe, expect, it } from 'vitest'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

const toggles = ['slot_limit_enabled', 'booking_reject_out_of_slot'] as const

describe('interruttori limiti per-fascia / orario — default OFF (admin-blindatura calendario)', () => {
  for (const key of toggles) {
    const entry = restaurantSettingRegistry[key]

    describe(key, () => {
      it('assente/null dal DB → false (nessun blocco di default)', () => {
        expect(entry.parseFromDb(null)).toBe(false)
        expect(entry.parseFromDb(undefined)).toBe(false)
      })

      it('legge boolean e stringhe "true"/"false" dal DB', () => {
        expect(entry.parseFromDb(true)).toBe(true)
        expect(entry.parseFromDb('true')).toBe(true)
        expect(entry.parseFromDb(false)).toBe(false)
        expect(entry.parseFromDb('false')).toBe(false)
      })

      it('valore sporco → torna al default false', () => {
        expect(entry.parseFromDb('boh')).toBe(false)
        expect(entry.parseFromDb(3)).toBe(false)
      })

      it('round-trip boolean stabile', () => {
        expect(entry.parseFromDb(entry.serializeToDb(true))).toBe(true)
        expect(entry.parseFromDb(entry.serializeToDb(false))).toBe(false)
      })

      it('validate accetta solo boolean', () => {
        expect(entry.validate(true)).toBeNull()
        expect(entry.validate(false)).toBeNull()
        expect(entry.validate('true')).not.toBeNull()
        expect(entry.validate(1)).not.toBeNull()
      })
    })
  }
})
