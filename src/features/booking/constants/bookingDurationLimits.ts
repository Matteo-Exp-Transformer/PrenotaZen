/** Durata prenotazione (minuti) — limiti condivisi da parser, normalizer, schema Zod e UI. */
export const BOOKING_DURATION_MIN = 30
export const BOOKING_DURATION_MAX = 360

/**
 * Clamp difensivo: ritorna il valore se è un intero finito in [MIN, MAX], altrimenti undefined.
 * Non arrotonda — il valore libero del campo "Altro" viene conservato tal quale (solo clamp).
 */
export function parseBookingDuration(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const int = Math.trunc(value)
  if (int < BOOKING_DURATION_MIN || int > BOOKING_DURATION_MAX) return undefined
  return int
}

/** Clamp al salvataggio: se il valore è presente ma fuori range → undefined (non scrivere). */
export function clampBookingDuration(value: number | undefined): number | undefined {
  if (value == null) return undefined
  const int = Math.trunc(value)
  if (int < BOOKING_DURATION_MIN || int > BOOKING_DURATION_MAX) return undefined
  return int
}
