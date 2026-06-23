import { BOOKING_DURATION_MIN } from '../constants/bookingDurationLimits'

export interface ResolveBookingDurationInput {
  /** Gradino 1 — sovrascrittura manuale admin sulla singola prenotazione (assoluto). */
  override_admin_minutes?: number
  /** Gradino 2 — SubTab.duration (la card scelta dal cliente). */
  card_duration?: number
  /** Gradino 2b — CustomStaffPreset.default_duration (eredità se card non ha durata). */
  preset_default_duration?: number
  /** Gradino 3 — BookingMode.default_duration (tipologia). */
  booking_mode_default_duration?: number
  /** Gradino 4 — super-admin console (futuro, Classic L2-lite). Per ora sempre undefined. */
  restaurant_default_duration?: number
  /** Pavimento: service_slots.min_duration. Applicato al risultato, non come concorrente dei livelli. */
  slot_min_duration?: number
}

export type DurationSource =
  | 'admin_override'
  | 'card'
  | 'preset'
  | 'booking_mode'
  | 'restaurant_default'

export interface ResolvedDuration {
  duration_minutes: number
  source: DurationSource
  rule_version: 1
}

/**
 * Risolve la durata della prenotazione applicando la gerarchia D35.
 * Ritorna undefined se nessun livello ha durata → permanenza OFF (D42).
 *
 * Gerarchia (primo non-undefined vince):
 *   override_admin_minutes > card_duration > preset_default_duration
 *   > booking_mode_default_duration > restaurant_default_duration
 *
 * Pavimento applicato al risultato (non concorrente):
 *   floor = MAX(slot_min_duration ?? 0, BOOKING_DURATION_MIN)
 *   result = MAX(resolved, floor)
 *
 * Invariante D35: card vince sulla tipologia anche se più corta (la gerarchia è deterministica,
 * non usa MAX tra livelli).
 */
export function resolveBookingDuration(
  input: ResolveBookingDurationInput,
): ResolvedDuration | undefined {
  let resolved: number | undefined
  let source: DurationSource | undefined

  if (input.override_admin_minutes !== undefined) {
    resolved = input.override_admin_minutes
    source = 'admin_override'
  } else if (input.card_duration !== undefined) {
    resolved = input.card_duration
    source = 'card'
  } else if (input.preset_default_duration !== undefined) {
    resolved = input.preset_default_duration
    source = 'preset'
  } else if (input.booking_mode_default_duration !== undefined) {
    resolved = input.booking_mode_default_duration
    source = 'booking_mode'
  } else if (input.restaurant_default_duration !== undefined) {
    resolved = input.restaurant_default_duration
    source = 'restaurant_default'
  }

  if (resolved === undefined || source === undefined) {
    return undefined
  }

  const floor = Math.max(input.slot_min_duration ?? 0, BOOKING_DURATION_MIN)
  const duration_minutes = Math.max(resolved, floor)

  return { duration_minutes, source, rule_version: 1 }
}
