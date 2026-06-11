// @admin-blindatura: calendario
// Copre: il limite coperti GIORNALIERO (esterno). Decisione Matteo 11-06-26: `0` e vuoto = «nessun
//        limite», NON un limite di 0 coperti. Bug bloccante corretto: prima `0` veniva rifiutato dallo
//        schema (min 1) e faceva fallire il salvataggio dell'INTERA pagina Impostazioni. Questo test
//        blinda il round-trip e la validazione perché il bug non torni.

import { describe, expect, it } from 'vitest'
import {
  restaurantSettingRegistry,
  DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE,
} from '../restaurantSettingRegistry'

const entry = restaurantSettingRegistry.daily_guest_limit

describe('daily_guest_limit — 0/vuoto = nessun limite (admin-blindatura calendario)', () => {
  it('null serializza nella sentinella DB (-1), mai null (colonna NOT NULL)', () => {
    const serialized = entry.serializeToDb(null)
    expect(serialized).toBe(DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE)
    expect(serialized).not.toBeNull()
  })

  it('0 = nessun limite → serializza nella sentinella (-1), non 0', () => {
    // Il cuore del fix: 0 NON deve essere un limite di 0 coperti.
    expect(entry.serializeToDb(0)).toBe(DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE)
  })

  it('round-trip: 0 → serialize → parse torna null (nessun limite)', () => {
    const serialized = entry.serializeToDb(0)
    expect(entry.parseFromDb(serialized)).toBeNull()
  })

  it('round-trip: null → serialize → parse torna null', () => {
    const serialized = entry.serializeToDb(null)
    expect(entry.parseFromDb(serialized)).toBeNull()
  })

  it('la sentinella -1 dal DB viene letta come null (nessun limite)', () => {
    expect(entry.parseFromDb(DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE)).toBeNull()
  })

  it('un limite valido (24) viene preservato nel round-trip', () => {
    const serialized = entry.serializeToDb(24)
    expect(serialized).toBe(24)
    expect(entry.parseFromDb(serialized)).toBe(24)
  })

  it('validate accetta 0 (nessun limite), vuoto, null e un numero valido — NON deve mai bloccare il Salva su 0', () => {
    expect(entry.validate(0)).toBeNull()
    expect(entry.validate('')).toBeNull()
    expect(entry.validate(null)).toBeNull()
    expect(entry.validate(24)).toBeNull()
  })

  it('validate rifiuta valori fuori range (negativi, oltre 1000)', () => {
    expect(entry.validate(-5)).not.toBeNull()
    expect(entry.validate(1001)).not.toBeNull()
  })

  it('parse robusto su input sporchi dal DB (stringhe, NaN) → null', () => {
    expect(entry.parseFromDb('abc')).toBeNull()
    expect(entry.parseFromDb('')).toBeNull()
    expect(entry.parseFromDb(undefined as unknown as null)).toBeNull()
  })
})
