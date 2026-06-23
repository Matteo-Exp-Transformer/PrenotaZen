import { describe, it, expect } from 'vitest'
import { resolveBookingDuration } from '../resolveBookingDuration'
import { BOOKING_DURATION_MIN } from '../../constants/bookingDurationLimits'

describe('resolveBookingDuration', () => {
  describe('gerarchia livelli', () => {
    it('override admin vince sempre, anche se card ha durata più lunga', () => {
      const result = resolveBookingDuration({
        override_admin_minutes: 45,
        card_duration: 120,
        booking_mode_default_duration: 90,
      })
      expect(result).toEqual({ duration_minutes: 45, source: 'admin_override', rule_version: 1 })
    })

    it('card vince sulla tipologia anche se più corta (D35)', () => {
      const result = resolveBookingDuration({
        card_duration: 30,
        booking_mode_default_duration: 120,
      })
      expect(result).toEqual({ duration_minutes: 30, source: 'card', rule_version: 1 })
    })

    it('card senza durata + tipologia → usa tipologia (gradino 3)', () => {
      const result = resolveBookingDuration({
        booking_mode_default_duration: 90,
      })
      expect(result).toEqual({ duration_minutes: 90, source: 'booking_mode', rule_version: 1 })
    })

    it('preset eredita se card non ha durata (gradino 2b)', () => {
      const result = resolveBookingDuration({
        preset_default_duration: 60,
        booking_mode_default_duration: 90,
      })
      expect(result).toEqual({ duration_minutes: 60, source: 'preset', rule_version: 1 })
    })

    it('card vince sul preset', () => {
      const result = resolveBookingDuration({
        card_duration: 45,
        preset_default_duration: 60,
        booking_mode_default_duration: 90,
      })
      expect(result).toEqual({ duration_minutes: 45, source: 'card', rule_version: 1 })
    })

    it('restaurant_default_duration come fallback finale quando tutto il resto è undefined', () => {
      const result = resolveBookingDuration({
        restaurant_default_duration: 75,
      })
      expect(result).toEqual({ duration_minutes: 75, source: 'restaurant_default', rule_version: 1 })
    })

    it('override vince su tutti i livelli incluso restaurant_default', () => {
      const result = resolveBookingDuration({
        override_admin_minutes: 40,
        card_duration: 60,
        preset_default_duration: 80,
        booking_mode_default_duration: 100,
        restaurant_default_duration: 120,
      })
      expect(result).toEqual({ duration_minutes: 40, source: 'admin_override', rule_version: 1 })
    })
  })

  describe('nessuna durata → undefined (permanenza OFF, D42)', () => {
    it('ritorna undefined se nessun livello ha durata', () => {
      expect(resolveBookingDuration({})).toBeUndefined()
    })

    it('ritorna undefined ignorando slot_min_duration (non è un livello)', () => {
      expect(resolveBookingDuration({ slot_min_duration: 60 })).toBeUndefined()
    })
  })

  describe('pavimento fascia (slot_min_duration)', () => {
    it('pavimento slot eleva il risultato se risolto è sotto', () => {
      const result = resolveBookingDuration({
        card_duration: 30,
        slot_min_duration: 60,
      })
      expect(result?.duration_minutes).toBe(60)
      expect(result?.source).toBe('card')
    })

    it('pavimento BOOKING_DURATION_MIN = 30 applicato anche senza slot_min_duration', () => {
      const result = resolveBookingDuration({
        booking_mode_default_duration: 10,
      })
      expect(result?.duration_minutes).toBe(BOOKING_DURATION_MIN)
      expect(result?.source).toBe('booking_mode')
    })

    it('floor = MAX(slot_min_duration, BOOKING_DURATION_MIN) — vince il più alto', () => {
      const result = resolveBookingDuration({
        booking_mode_default_duration: 20,
        slot_min_duration: 45,
      })
      expect(result?.duration_minutes).toBe(45)
    })

    it('pavimento non si applica se il risultato è già sopra', () => {
      const result = resolveBookingDuration({
        card_duration: 120,
        slot_min_duration: 60,
      })
      expect(result?.duration_minutes).toBe(120)
    })

    it('BOOKING_DURATION_MIN applicato quando slot_min_duration è 0', () => {
      const result = resolveBookingDuration({
        booking_mode_default_duration: 10,
        slot_min_duration: 0,
      })
      expect(result?.duration_minutes).toBe(BOOKING_DURATION_MIN)
    })
  })

  describe('invariante D35 — card più corta della tipologia vince sempre', () => {
    it('D35: card 30 min vince su tipologia 180 min', () => {
      const result = resolveBookingDuration({
        card_duration: 30,
        booking_mode_default_duration: 180,
      })
      expect(result?.source).toBe('card')
      expect(result?.duration_minutes).toBe(30)
    })

    it('D35: card 30 min vince su tipologia 180 min anche con pavimento slot 0', () => {
      const result = resolveBookingDuration({
        card_duration: 30,
        booking_mode_default_duration: 180,
        slot_min_duration: 0,
      })
      expect(result?.source).toBe('card')
      expect(result?.duration_minutes).toBe(BOOKING_DURATION_MIN)
    })
  })

  describe('rule_version', () => {
    it('rule_version è sempre 1', () => {
      const result = resolveBookingDuration({ booking_mode_default_duration: 60 })
      expect(result?.rule_version).toBe(1)
    })
  })
})
