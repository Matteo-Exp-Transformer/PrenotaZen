/**
 * Preset menù Rinfresco di Laurea
 *
 * L’elenco selezionabile in UI usa solo `booking_custom_staff_presets` (restaurant_settings).
 * Le definizioni `menu_1`…`menu_4` restano per compatibilità con prenotazioni già salvate in DB.
 */

import type { BookingType } from '@/types/booking'
import type { SubTab } from '@/features/booking/constants/bookingPublicFormConfig'
import { defaultModeCapabilities } from '@/features/booking/utils/bookingCapabilities'

export const CUSTOM_PRESET_PREFIX = 'custom:' as const

/** Legacy: mantenuto per compatibilità dati salvati; l'abbinamento UI avviene in Personalizza Form. */
export type StaffPresetBookingType = 'rinfresco_laurea' | 'menu_prezzo_fisso'

export const STAFF_PRESET_BOOKING_TYPE_VALUES: StaffPresetBookingType[] = [
  'rinfresco_laurea',
  'menu_prezzo_fisso',
]

export const STAFF_PRESET_DEFAULT_BOOKING_TYPES: StaffPresetBookingType[] = [
  ...STAFF_PRESET_BOOKING_TYPE_VALUES,
]

export const STAFF_PRESET_BOOKING_TYPE_OPTIONS: { value: StaffPresetBookingType; label: string }[] = [
  { value: 'rinfresco_laurea', label: 'Rinfresco di Laurea' },
  { value: 'menu_prezzo_fisso', label: 'Menu a prezzo fisso' },
]

export function normalizeStaffPresetBookingTypes(raw: unknown): StaffPresetBookingType[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...STAFF_PRESET_DEFAULT_BOOKING_TYPES]
  }
  const allowed = new Set<string>(STAFF_PRESET_BOOKING_TYPE_VALUES)
  const filtered = raw.filter(
    (t): t is StaffPresetBookingType => typeof t === 'string' && allowed.has(t),
  )
  return filtered.length > 0 ? filtered : [...STAFF_PRESET_DEFAULT_BOOKING_TYPES]
}

export function staffPresetBookingTypeLabelsJoined(types: StaffPresetBookingType[]): string {
  return types
    .map((t) => STAFF_PRESET_BOOKING_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t)
    .join(', ')
}

export type BuiltinPresetMenuType = 'menu_1' | 'menu_2' | 'menu_3' | 'menu_4'

/** Valore salvato in `preset_menu`: built-in menu_1…4 oppure chiave custom */
export type PresetMenuType = BuiltinPresetMenuType | `${typeof CUSTOM_PRESET_PREFIX}${string}` | null

export interface CustomStaffPreset {
  id: string
  name: string
  item_ids: string[]
  /** Legacy: non modificare da MenuPricesTab; l'uso nelle card Prenota è configurato da Personalizza Form. */
  booking_types: StaffPresetBookingType[]
  /** Testo sotto il nome sulle card Prenota (sottotab preset). */
  description?: string
  /** Prezzo consigliato a persona da usare come default quando il preset viene importato in Prenota. */
  price_per_person?: number
  /**
   * Se `false`, il cliente può modificare gli ingredienti dopo aver scelto il menù.
   * Omesso o `true` = menù fisso (default).
   */
  is_fixed_menu?: boolean
  /** Se `false`, il preset non compare nella pagina Prenota (default: visibile). */
  visible_on_booking?: boolean
}

export function isStaffPresetFixedMenu(p: CustomStaffPreset): boolean {
  return p.is_fixed_menu !== false
}

export function staffPresetDescriptionForCards(p: CustomStaffPreset): string | undefined {
  const d = p.description?.trim()
  return d || undefined
}

/** Descrizione card Prenota: override sottotab ha priorità, altrimenti descrizione del preset staff. */
export function enrichPresetSubTabsFromStaffPresets(
  subTabs: SubTab[],
  presets: CustomStaffPreset[],
): SubTab[] {
  return subTabs.map((tab) => {
    if (!tab.preset_id || tab.description?.trim()) return tab
    const preset = presets.find((p) => p.id === tab.preset_id)
    const desc = preset ? staffPresetDescriptionForCards(preset) : undefined
    return desc ? { ...tab, description: desc } : tab
  })
}

export function isStaffPresetVisibleOnBooking(p: CustomStaffPreset): boolean {
  return p.visible_on_booking !== false
}

/**
 * Preset selezionabile in pagina Prenota.
 *
 * La decisione segue la CAPACITÀ della tipologia («usa menù»), non il NOME (anti-pattern
 * «decidi per nome»). Qui è disponibile solo il `booking_type`, quindi si risolve il Livello C
 * (default per tipo): `rinfresco_laurea`/`menu_prezzo_fisso` → selezionabile; `tavolo`/assente →
 * no. Comportamento storico preservato. Se in futuro serve far selezionare il preset anche per
 * `tavolo` via capacità esplicita (Livello A/B), passare la `BookingMode` e usare `modeUsesMenu`.
 * La visibilità `visible_on_booking` resta sempre rispettata.
 */
export function isStaffPresetSelectableForBookingType(
  p: CustomStaffPreset,
  bookingType: BookingType | string | null | undefined,
): boolean {
  if (!isStaffPresetVisibleOnBooking(p)) return false
  return defaultModeCapabilities(bookingType as BookingType | null | undefined).uses_menu
}

export interface PresetMenu {
  id: BuiltinPresetMenuType
  label: string
  itemNames: string[] // Legacy: vuoto per non inventare ingredienti su tenant nuovi.
}

export const MENU_1: PresetMenu = {
  id: 'menu_1',
  label: 'Menù legacy 1',
  itemNames: [],
}

export const MENU_2: PresetMenu = {
  id: 'menu_2',
  label: 'Menù legacy 2',
  itemNames: [],
}

export const MENU_3: PresetMenu = {
  id: 'menu_3',
  label: 'Menù legacy 3',
  itemNames: [],
}

export const MENU_4: PresetMenu = {
  id: 'menu_4',
  label: 'Menù legacy 4',
  itemNames: [],
}

/**
 * Mappa di tutti i menu predefiniti staff (built-in)
 */
export const PRESET_MENUS: Record<BuiltinPresetMenuType, PresetMenu> = {
  menu_1: MENU_1,
  menu_2: MENU_2,
  menu_3: MENU_3,
  menu_4: MENU_4
}

export function isBuiltinPresetMenuType(v: string | null | undefined): v is BuiltinPresetMenuType {
  return v === 'menu_1' || v === 'menu_2' || v === 'menu_3' || v === 'menu_4'
}

export function isCustomPresetMenuType(v: string | null | undefined): v is `${typeof CUSTOM_PRESET_PREFIX}${string}` {
  return typeof v === 'string' && v.startsWith(CUSTOM_PRESET_PREFIX)
}

export function getCustomPresetUuid(v: string): string | null {
  if (!isCustomPresetMenuType(v)) return null
  return v.slice(CUSTOM_PRESET_PREFIX.length)
}

export function customPresetStorageId(uuid: string): `${typeof CUSTOM_PRESET_PREFIX}${string}` {
  return `${CUSTOM_PRESET_PREFIX}${uuid}`
}

/**
 * Helper per ottenere un preset menu built-in per tipo
 */
export const getPresetMenu = (type: PresetMenuType): PresetMenu | null => {
  if (!type || isCustomPresetMenuType(type)) return null
  return PRESET_MENUS[type] ?? null
}

/**
 * Label per UI (form, card, dettaglio)
 */
export const getPresetMenuLabel = (type: PresetMenuType, customPresets?: CustomStaffPreset[]): string => {
  if (!type) return 'Scegli un menu predefinito'
  if (isCustomPresetMenuType(type)) {
    const uuid = getCustomPresetUuid(type)
    const found = uuid ? customPresets?.find((p) => p.id === uuid) : undefined
    return found?.name ?? 'Menù consigliato personalizzato'
  }
  return getPresetMenu(type)?.label ?? 'Menu Sconosciuto'
}

export type PresetSubTabLabelOverride = { preset_id: string; custom_label: string }

/** Titolo card bianca sotto le sottotab: override sottotab, poi nome preset staff. */
export function resolvePresetDisplayTitle(
  presetMenu: PresetMenuType,
  customPresets?: CustomStaffPreset[],
  subTabOverrides?: PresetSubTabLabelOverride[],
): string | null {
  if (!presetMenu) return null
  if (isCustomPresetMenuType(presetMenu)) {
    const uuid = getCustomPresetUuid(presetMenu)
    const override =
      uuid && subTabOverrides?.find((o) => o.preset_id === uuid)?.custom_label?.trim()
    if (override) return override
  }
  return getPresetMenuLabel(presetMenu, customPresets)
}

/**
 * Intestazione «Crea il tuo menù» solo se il cliente può comporre gli ingredienti.
 * Con un preset staff conta `is_fixed_menu`. Senza preset (caso «componi da zero») dipende dalla
 * CAPACITÀ «usa menù» della tipologia (Livello C via `defaultModeCapabilities`), non dal NOME:
 * `rinfresco_laurea`/`menu_prezzo_fisso` → mostra l'header; `tavolo`/assente → no.
 */
export function shouldShowComposeMenuHeader(
  presetMenu: PresetMenuType,
  customPreset: CustomStaffPreset | undefined,
  bookingType?: BookingType | string | null,
): boolean {
  if (customPreset) {
    return customPreset.is_fixed_menu === false
  }
  if (presetMenu && isBuiltinPresetMenuType(presetMenu)) {
    return false
  }
  return !presetMenu && defaultModeCapabilities(bookingType as BookingType | null | undefined).uses_menu
}
