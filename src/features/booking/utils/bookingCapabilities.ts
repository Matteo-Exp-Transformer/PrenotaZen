/**
 * Capacità di una tipologia di prenotazione (capability-driven, runtime, nessuna migrazione DB).
 *
 * Il comportamento (mostra menù sì/no, intolleranze sì/no) NON dipende dal NOME della tipologia
 * (`booking_type`) ma da CAPACITÀ risolte a cascata:
 *  - Livello A (esplicito): `BookingMode.capabilities` impostate dall'admin (Fase 3).
 *  - Livello B (derivato dai dati, solo pubblico): card `display:'cards'` + `preset_id` risolto.
 *  - Livello C (default per tipo): riproduce il comportamento storico.
 *
 * Funzioni pure: nessun React, hook o fetch. Test in utils/__tests__/bookingCapabilities.test.ts.
 */

import type { BookingType } from '@/types/booking'
import { normalizeMenuItemBookingTypes } from '@/types/menu'

export interface BookingModeCapabilities {
  uses_menu?: boolean
  uses_dietary?: boolean
}

/** Minimo necessario per risolvere le capability senza dipendere dall'intero tipo BookingMode. */
interface ModeLike {
  booking_type?: BookingType | null
  capabilities?: BookingModeCapabilities
}

/**
 * Livello C — default per tipo = comportamento ATTUALE.
 * `tavolo` → niente menù; `rinfresco_laurea` / `menu_prezzo_fisso` → menù + intolleranze.
 */
export function defaultModeCapabilities(
  bookingType: BookingType | null | undefined,
): Required<BookingModeCapabilities> {
  const usesMenu = bookingType === 'rinfresco_laurea' || bookingType === 'menu_prezzo_fisso'
  return { uses_menu: usesMenu, uses_dietary: usesMenu }
}

/** Risoluzione A→C per "usa menù". */
export function modeUsesMenu(mode: ModeLike | null | undefined): boolean {
  if (typeof mode?.capabilities?.uses_menu === 'boolean') return mode.capabilities.uses_menu
  return defaultModeCapabilities(mode?.booking_type).uses_menu
}

/** Risoluzione A→C per "usa intolleranze/restrizioni alimentari". */
export function modeUsesDietary(mode: ModeLike | null | undefined): boolean {
  if (typeof mode?.capabilities?.uses_dietary === 'boolean') return mode.capabilities.uses_dietary
  return defaultModeCapabilities(mode?.booking_type).uses_dietary
}

/**
 * Parse difensivo delle capabilities da dati grezzi (DB/JSON). Accetta solo i booleani noti;
 * input mancante o malformato → `undefined` (→ fallback Livello C, comportamento invariato).
 * Usato sia dal normalizer sia da `parseFromDb` per rispettare la LOCK Parser/normalizer accoppiati.
 */
export function parseModeCapabilities(raw: unknown): BookingModeCapabilities | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const c = raw as Record<string, unknown>
  const out: BookingModeCapabilities = {}
  if (typeof c.uses_menu === 'boolean') out.uses_menu = c.uses_menu
  if (typeof c.uses_dietary === 'boolean') out.uses_dietary = c.uses_dietary
  return Object.keys(out).length ? out : undefined
}

/**
 * Predicato di visibilità di un ingrediente nella griglia di selezione (pagina Prenota).
 * Fonte unica testabile del `.filter` di `MenuSelection.normalizedMenuItems`.
 *
 * Ordine (NON riordinare — è l'invariante LOCK):
 *  1. item/categoria nascosti nella card → escluso
 *  2. item appartenente al preset attivo → incluso (LOCK Ingredienti preset custom)
 *  3. esiste un preset attivo (size>0) → escludi tutto il resto (solo item del preset)
 *  4. nessun preset: comportamento legacy per booking_type (Livello C via shim)
 */
export function isMenuItemVisibleForSelection(params: {
  itemId: string
  itemCategory: string
  itemBookingTypes?: unknown
  bookingType: BookingType | null | undefined
  activePresetItemIds: ReadonlySet<string>
  hiddenCategoryKeys: ReadonlySet<string>
  hiddenItemIds: ReadonlySet<string>
}): boolean {
  const {
    itemId,
    itemCategory,
    itemBookingTypes,
    bookingType,
    activePresetItemIds,
    hiddenCategoryKeys,
    hiddenItemIds,
  } = params
  if (hiddenCategoryKeys.has(itemCategory) || hiddenItemIds.has(itemId)) return false
  if (activePresetItemIds.has(itemId)) return true
  if (activePresetItemIds.size > 0) return false
  if (!modeUsesMenu({ booking_type: bookingType })) return true
  const types = normalizeMenuItemBookingTypes(itemBookingTypes)
  return bookingType ? types.includes(bookingType) : true
}

/**
 * Livello B (solo pubblico) — la card attiva mostra il menù se è una card scorrevole
 * con preset collegato e risolto. È la capability già calcolata oggi dal gate pubblico.
 */
export function activeSubTabShowsMenu(
  subTab: { display?: string; preset_id?: string; label?: string } | null | undefined,
  linkedPreset: unknown,
): boolean {
  if (!subTab || subTab.display !== 'cards') return false
  if (subTab.preset_id && linkedPreset) return true
  // Card manuale (senza preset): blocco titolo/descrizione in MenuSelection, senza griglia.
  if (!subTab.preset_id && subTab.label?.trim()) return true
  return false
}
