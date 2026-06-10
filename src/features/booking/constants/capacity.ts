/**
 * Solo confini orari predefiniti (colori calendario + DEFAULT_BOOKING_TIME_SLOTS).
 * La capienza coperti per fascia non ha più valori finti in codice: è in `restaurant_settings.slot_guest_capacities` (null = nessun tetto).
 */
export const BOOKING_SLOT_TIME_DEFAULTS = {
  MORNING_START: '10:00',
  MORNING_END: '14:30',
  AFTERNOON_START: '14:31',
  AFTERNOON_END: '18:30',
  EVENING_START: '18:31',
  EVENING_END: '23:30',
} as const 