import { defaultModeCapabilities } from './bookingCapabilities'

/**
 * @deprecated Usare `modeUsesMenu(mode)` da `bookingCapabilities.ts` quando si ha la `BookingMode`.
 * Shim mantenuto per i call-site storici che dispongono solo del `booking_type` (prenotazioni
 * salvate, calendario, card richiesta). Delega al Livello C → semantica identica a prima.
 */
export function bookingTypeUsesMenuSelections(bookingType: string | null | undefined): boolean {
  return defaultModeCapabilities(bookingType as never).uses_menu
}
