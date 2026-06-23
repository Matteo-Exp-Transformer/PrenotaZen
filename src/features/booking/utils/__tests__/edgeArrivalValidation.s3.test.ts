// @s3-blindatura: edge-arrival-validation
// Copre: step, cutoff, fuori fascia, durata, tardivo, overnight e confini.
import { describe, expect, it } from 'vitest'
import { validateArrivalRules, type ArrivalValidationInput } from '../../../../../supabase/functions/create-booking/arrivalValidation'

const base: ArrivalValidationInput = {
  desiredDate: '2026-06-24', desiredTime: '19:31', restaurantToday: '2026-06-23',
  restaurantNowMinutes: 12 * 60, slotStart: '19:31', slotEnd: '23:31',
  arrivalStepMinutes: 30, cutoffMinutes: 60, lateArrivalAllowed: false,
  minOrderTimeMinutes: 45, slotMinDuration: 60, durationMinutes: 120,
}

describe('create-booking arrival validation', () => {
  it('accetta step relativo a start non multiplo della mezzanotte', () => {
    expect(validateArrivalRules({ ...base, desiredTime: '20:01' })).toBeNull()
  })
  it('rifiuta step manipolato', () => {
    expect(validateArrivalRules({ ...base, desiredTime: '20:00' })).toBe('INVALID_ARRIVAL_STEP')
  })
  it('rifiuta cutoff e accetta il confine esatto', () => {
    const today = { ...base, desiredDate: '2026-06-23', restaurantNowMinutes: 18 * 60 + 32 }
    expect(validateArrivalRules(today)).toBe('CUTOFF_EXPIRED')
    expect(validateArrivalRules({ ...today, restaurantNowMinutes: 18 * 60 + 31 })).toBeNull()
  })
  it('rifiuta durata sotto minimo e arrivo che non entra', () => {
    expect(validateArrivalRules({ ...base, durationMinutes: 30 })).toBe('INVALID_DURATION')
    expect(validateArrivalRules({ ...base, desiredTime: '22:31', durationMinutes: 120 })).toBe('CUTOFF_EXPIRED')
  })
  it('tardivo usa il minimo ordine e gestisce overnight', () => {
    expect(validateArrivalRules({ ...base, slotStart: '22:00', slotEnd: '02:00',
      desiredTime: '01:00', durationMinutes: 180, lateArrivalAllowed: true })).toBeNull()
  })
  it('rifiuta fuori fascia e input malformato', () => {
    expect(validateArrivalRules({ ...base, desiredTime: '18:31' })).toBe('OUT_OF_SLOT')
    expect(validateArrivalRules({ ...base, desiredTime: 'xx' })).toBe('OUT_OF_SLOT')
  })
})
