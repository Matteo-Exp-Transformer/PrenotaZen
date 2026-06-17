import { z } from 'zod'
import type { Json } from '@/types/database'
import type { BusinessHours, BusinessHourSlot } from '@/lib/businessHours'
import { getDefaultBusinessHours, parseBusinessHours } from '@/lib/businessHours'
import {
  type BookingPageBackgroundId,
  isBookingPageBackgroundId,
  parseBookingPageBackgroundFromDb,
  type BookingStripPhotoId,
  isBookingStripPhotoId,
  parseBookingStripPhotoFromDb,
} from '@/features/booking/constants/bookingPageBackground'
import {
  type AppThemeId,
  isAppThemeId,
  parseAppThemeFromDb,
} from '@/features/booking/constants/appTheme'
import {
  normalizeStaffPresetBookingTypes,
  type CustomStaffPreset,
} from '@/features/booking/constants/presetMenus'
import {
  migrateMenuPromosFromLegacy,
  normalizeMenuPromosList,
  validateMenuPromoUniqueness,
  type MenuPromo,
} from '@/features/booking/constants/menuPromo'
import {
  type BookingPublicFormConfig,
  type SubTab,
  type SubTabOverride,
  DEFAULT_BOOKING_FORM_CONFIG,
  hasUsableBookingModesInRaw,
  migrateOverridesToSubTabs,
  normalizeBookingPublicFormConfig,
  parseBookingHeaderStylesFromUnknown,
  parseSubTabFromUnknown,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { resolveBookingStoredIconKey } from '@/features/public-menu/categoryIcons'
import { parseModeCapabilities } from '@/features/booking/utils/bookingCapabilities'
import {
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
  clampBookingText,
} from '@/features/booking/constants/bookingPrenotaTextLimits'

const DEFAULT_BOOKING_WINDOW_DAYS = 60

export const RESTAURANT_SETTING_KEYS_V1 = [
  'restaurant_name',
  'timezone',
  'booking_window_days',
  'daily_guest_limit',
  /** Capienza massima coperti per fascia (Record<slotId, number|null>); null = nessun limite. */
  'slot_guest_capacities',
  'business_hours',
  'contact_email',
  'contact_phone',
  'contact_address',
  'public_booking_page_background',
  /** Foto della striscia verticale sinistra nella pagina Prenota (strip-01 … strip-06). */
  'public_booking_strip_photo',
  /** Mostra nel form pubblico il menu a tendina "menu consigliati" (built-in + personalizzati) */
  'booking_staff_presets_visible',
  /** Menu predefiniti creati dall'admin (nome + lista id voci) */
  'booking_custom_staff_presets',
  /** Promo testuali menù (banner pagina Prenota), con tipologie di prenotazione */
  'booking_menu_promos',
  /** Elenco aree di posizionamento prenotazioni (es. Sala A, Sala B, Deorr) */
  'booking_placement_areas',
  /** Tema visivo dashboard admin (solo /admin); non influenza la pagina pubblica Prenota */
  'app_theme',
  /** Numero massimo coperti accettati in un singolo walk-in (default 20) */
  'walk_in_max_guests',
  /** Classic: abilita/disabilita raggruppamento digest per fasce orarie (default true). In Pro ignorato -- sempre ON. */
  'booking_time_slots_enabled',
  /** Configurazione UI pagina pubblica /prenota: titolo, descrizione, modalità di prenotazione visibili. */
  'booking_public_form_config',
] as const

export type RestaurantSettingKeyV1 = (typeof RESTAURANT_SETTING_KEYS_V1)[number]

const timeHm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa il formato HH:mm')

const businessHourSlotSchema = z.object({
  open: timeHm,
  close: timeHm,
})

const daySlotsSchema = z.union([z.null(), z.array(businessHourSlotSchema)])

export const businessHoursSettingSchema = z
  .object({
    monday: daySlotsSchema.optional(),
    tuesday: daySlotsSchema.optional(),
    wednesday: daySlotsSchema.optional(),
    thursday: daySlotsSchema.optional(),
    friday: daySlotsSchema.optional(),
    saturday: daySlotsSchema.optional(),
    sunday: daySlotsSchema.optional(),
  })
  .transform(
    (raw): BusinessHours => ({
      monday: raw.monday ?? null,
      tuesday: raw.tuesday ?? null,
      wednesday: raw.wednesday ?? null,
      thursday: raw.thursday ?? null,
      friday: raw.friday ?? null,
      saturday: raw.saturday ?? null,
      sunday: raw.sunday ?? null,
    })
  )

const restaurantNameMax = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName
const contactEmailMax = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactEmail
const contactPhoneMax = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactPhone
const contactAddressMax = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactAddress
const restaurantNameSchema = z
  .string()
  .trim()
  .min(1, 'Il nome e obbligatorio')
  .max(restaurantNameMax, `Massimo ${restaurantNameMax} caratteri`)
const timezoneSchema = z.string().trim().min(1, 'Il fuso orario e obbligatorio').max(80)
const DEFAULT_TIMEZONE = 'Europe/Rome'
const optionalEmailSchema = z.string().trim().max(contactEmailMax, `Massimo ${contactEmailMax} caratteri`).email('Email non valida')
const optionalPhoneSchema = z.string().trim().min(3, 'Telefono non valido').max(contactPhoneMax, `Massimo ${contactPhoneMax} caratteri`)
const optionalAddressSchema = z.string().trim().max(contactAddressMax, `Massimo ${contactAddressMax} caratteri`)
const bookingWindowDaysSchema = z.coerce
  .number()
  .int('Deve essere un intero')
  .min(1, 'Minimo 1 giorno')
  .max(365, 'Massimo 365 giorni')
const dailyGuestLimitSchema = z.coerce
  .number()
  .int('Deve essere un intero')
  .min(0, 'Non può essere negativo') // 0 = nessun limite (gestito come "illimitato")
  .max(1000, 'Massimo 1000 ospiti')

const optionalSlotCapSchema = z.union([
  z.coerce.number().int().min(1, 'Minimo 1').max(5000, 'Massimo 5000'),
  z.null(),
])

/**
 * Capienze per-fascia: chiave = service_slots.id (UUID).
 * Formato legacy {morning,afternoon,evening} convertito in-app al primo salvataggio.
 */
export type SlotGuestCapacities = Record<string, number | null>

/**
 * Schema Zod per il nuovo formato Record<uuid, number|null>.
 * Accetta qualsiasi chiave stringa con valore number|null.
 */
const slotGuestCapacitiesSchemaV2 = z.record(z.string(), optionalSlotCapSchema.nullable())

export const DEFAULT_SLOT_GUEST_CAPACITIES: SlotGuestCapacities = {}

/**
 * Parse da DB: supporta sia il nuovo formato Record<uuid, number|null>
 * sia il legacy {morning, afternoon, evening}.
 * Il formato legacy viene preservato as-is (la conversione a UUID avviene
 * al primo salvataggio dall'UI Settings, quando sono disponibili i slot ids).
 */
function parseSlotGuestCapacitiesFromDb(raw: unknown): SlotGuestCapacities {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const obj = raw as Record<string, unknown>
  // Formato legacy: {morning:N, afternoon:N, evening:N} -- preservato as-is
  const legacyKeys = ['morning', 'afternoon', 'evening']
  const hasLegacyKeys = legacyKeys.some((k) => k in obj)
  if (hasLegacyKeys) {
    const out: SlotGuestCapacities = {}
    for (const k of legacyKeys) {
      const v = obj[k]
      if (v == null) { out[k] = null; continue }
      const n = typeof v === 'number' ? v : parseInt(String(v), 10)
      out[k] = Number.isNaN(n) ? null : n
    }
    return out
  }
  // Nuovo formato Record<uuid, number|null>
  const parsed = slotGuestCapacitiesSchemaV2.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

/** Valore JSON salvato su `restaurant_settings.setting_value` quando non c'e limite giornaliero (la colonna e NOT NULL). */
export const DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE = -1

function parseJsonScalarString(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw)
  return ''
}

function parseBookingWindowDaysFromDb(raw: unknown): number {
  if (raw == null) return DEFAULT_BOOKING_WINDOW_DAYS
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw)
    return n >= 1 && n <= 365 ? n : DEFAULT_BOOKING_WINDOW_DAYS
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw.trim(), 10)
    if (!Number.isNaN(n) && n >= 1 && n <= 365) return n
  }
  return DEFAULT_BOOKING_WINDOW_DAYS
}

export { parseBookingWindowDaysFromDb }

/**
 * `daily_guest_limit` puo essere assente/`null` per indicare «nessun limite».
 * Restituisce `null` quando il valore non e impostato o non e un numero valido,
 * cosi l'app sa che non deve applicare alcun cap giornaliero.
 */
function parseDailyGuestLimitFromDb(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // -1 (sentinella) e 0 significano entrambi «nessun limite».
    if (raw === DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE || raw <= 0) return null
    return raw
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return null
    const n = parseInt(trimmed, 10)
    if (!Number.isNaN(n)) {
      if (n === DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE || n <= 0) return null
      return n
    }
  }
  return null
}

function parseBusinessHoursFromDb(raw: unknown): BusinessHours {
  const parsed = parseBusinessHours(raw)
  if (parsed) return parsed
  const zh = businessHoursSettingSchema.safeParse(raw)
  if (zh.success) return zh.data
  return getDefaultBusinessHours()
}

const bookingTypeForStaffPresetSchema = z.enum(['rinfresco_laurea', 'menu_prezzo_fisso'])

const customStaffPresetRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  item_ids: z.array(z.string().uuid()).max(160),
  booking_types: z.array(bookingTypeForStaffPresetSchema).min(1).max(2).optional(),
  description: z.string().trim().max(80).optional(),
  price_per_person: z.number().min(0).max(10000).optional(),
  is_fixed_menu: z.boolean().optional(),
  visible_on_booking: z.boolean().optional(),
})

const bookingCustomStaffPresetsSchema = z.array(customStaffPresetRowSchema).max(40)

function parseBookingStaffPresetsVisibleFromDb(raw: unknown): boolean {
  if (raw == null) return true
  if (typeof raw === 'boolean') return raw
  if (raw === 'false' || raw === false) return false
  if (raw === 'true' || raw === true) return true
  return true
}

function parseBookingCustomStaffPresetsFromDb(raw: unknown): CustomStaffPreset[] {
  const parsed = bookingCustomStaffPresetsSchema.safeParse(raw)
  if (!parsed.success) return []
  return parsed.data.map((row) => ({
    id: row.id,
    name: row.name,
    item_ids: row.item_ids,
    booking_types: normalizeStaffPresetBookingTypes(row.booking_types),
    ...(row.description?.trim() ? { description: row.description.trim() } : {}),
    ...(row.price_per_person != null && row.price_per_person > 0 ? { price_per_person: row.price_per_person } : {}),
    ...(row.is_fixed_menu === false ? { is_fixed_menu: false as const } : {}),
    ...(row.visible_on_booking === false ? { visible_on_booking: false as const } : {}),
  }))
}

const bookingTypeForPromoSchema = z.enum(['tavolo', 'rinfresco_laurea', 'menu_prezzo_fisso'])

const menuPromoSubTabRefSchema = z.object({
  mode_id: z.string().min(1),
  sub_tab_id: z.string().uuid(),
})

const menuPromoRowInputSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(500),
  placement: z.enum(['none', 'booking_type', 'sub_tab']).optional(),
  booking_type: bookingTypeForPromoSchema.optional(),
  booking_types: z.array(bookingTypeForPromoSchema).optional(),
  sub_tab_ref: menuPromoSubTabRefSchema.optional(),
  sub_tab_refs: z.array(menuPromoSubTabRefSchema).optional(),
  visible_on_booking: z.boolean().optional(),
})

const menuPromoRowSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(500),
  placement: z.enum(['none', 'booking_type', 'sub_tab']),
  booking_types: z.array(bookingTypeForPromoSchema).min(1).max(3).optional(),
  sub_tab_refs: z.array(menuPromoSubTabRefSchema).min(1).max(24).optional(),
  visible_on_booking: z.boolean().optional(),
})

const bookingMenuPromosInputSchema = z.array(menuPromoRowInputSchema).max(24)
const bookingMenuPromosSchema = z.array(menuPromoRowSchema).max(24)

function parseBookingMenuPromosFromDb(raw: unknown): MenuPromo[] {
  const parsed = bookingMenuPromosInputSchema.safeParse(raw)
  if (!parsed.success) return []
  return migrateMenuPromosFromLegacy(parsed.data)
}

function serializeMenuPromosToDb(value: MenuPromo[]): unknown {
  return normalizeMenuPromosList(value).map((row) => {
    const base = {
      id: row.id,
      label: row.label ?? '',
      message: row.message,
      placement: row.placement,
      ...(row.visible_on_booking === false ? { visible_on_booking: false as const } : {}),
    }
    if (row.placement === 'booking_type' && row.booking_types?.length) {
      return { ...base, booking_types: row.booking_types }
    }
    if (row.placement === 'sub_tab' && row.sub_tab_refs?.length) {
      return { ...base, sub_tab_refs: row.sub_tab_refs }
    }
    return base
  })
}
const placementAreaLabelSchema = z.string().trim().min(1).max(40)
const bookingPlacementAreasSchema = z.array(placementAreaLabelSchema).min(1).max(30)

function parseBookingPlacementAreasFromDb(raw: unknown): string[] {
  const parsed = bookingPlacementAreasSchema.safeParse(raw)
  if (!parsed.success) return []
  return parsed.data.filter((item, index, arr) => arr.indexOf(item) === index)
}

export type RestaurantSettingValueMap = {
  restaurant_name: string
  timezone: string
  booking_window_days: number
  daily_guest_limit: number | null
  slot_guest_capacities: SlotGuestCapacities
  business_hours: BusinessHours
  contact_email: string
  contact_phone: string
  contact_address: string
  public_booking_page_background: BookingPageBackgroundId | null
  public_booking_strip_photo: BookingStripPhotoId | null
  booking_staff_presets_visible: boolean
  booking_custom_staff_presets: CustomStaffPreset[]
  booking_menu_promos: MenuPromo[]
  booking_placement_areas: string[]
  app_theme: AppThemeId
  walk_in_max_guests: number
  /** Classic: abilita raggruppamento digest per fasce. Pro: ignorato (sempre true). Default true per retro-compatibilita. */
  booking_time_slots_enabled: boolean
  /** Configurazione UI pagina pubblica /prenota: titolo, descrizione e modalità di prenotazione. */
  booking_public_form_config: BookingPublicFormConfig | null
}

export interface RestaurantSettingRegistryEntry<K extends RestaurantSettingKeyV1> {
  key: K
  parseFromDb(raw: unknown): RestaurantSettingValueMap[K]
  serializeToDb(value: RestaurantSettingValueMap[K]): Json
  validate(value: unknown): string | null
}

export const restaurantSettingRegistry: {
  [K in RestaurantSettingKeyV1]: RestaurantSettingRegistryEntry<K>
} = {
  restaurant_name: {
    key: 'restaurant_name',
    parseFromDb: (raw) =>
      clampBookingText(parseJsonScalarString(raw).trim(), restaurantNameMax),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      const r = restaurantNameSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  timezone: {
    key: 'timezone',
    parseFromDb: (raw) => {
      const v = parseJsonScalarString(raw).trim()
      return v || DEFAULT_TIMEZONE
    },
    serializeToDb: (value) => (String(value).trim() || DEFAULT_TIMEZONE) as Json,
    validate: (value) => {
      const r = timezoneSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  booking_window_days: {
    /** Chiave orfana (solo admin): nessun consumer UI/pubblico. Non implementare senza nuova decisione Matteo. */
    key: 'booking_window_days',
    parseFromDb: (raw) => parseBookingWindowDaysFromDb(raw),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      const r = bookingWindowDaysSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  daily_guest_limit: {
    key: 'daily_guest_limit',
    parseFromDb: (raw) => parseDailyGuestLimitFromDb(raw),
    serializeToDb: (value) => {
      // La colonna DB e NOT NULL: usiamo -1 come sentinella per «nessun limite».
      // null e 0 (e valori non positivi) significano «nessun limite».
      if (value == null || (typeof value === 'number' && value <= 0)) {
        return DAILY_GUEST_LIMIT_UNLIMITED_DB_VALUE as unknown as Json
      }
      return value as Json
    },
    validate: (value) => {
      // Campo opzionale: vuoto/null = nessun limite, sempre valido
      if (value == null || value === '') return null
      const r = dailyGuestLimitSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  slot_guest_capacities: {
    key: 'slot_guest_capacities',
    parseFromDb: (raw) => parseSlotGuestCapacitiesFromDb(raw),
    serializeToDb: (value) => value as unknown as Json,
    validate: (value) => {
      const r = slotGuestCapacitiesSchemaV2.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Capienze fascia non valide'
    },
  },
  business_hours: {
    key: 'business_hours',
    parseFromDb: (raw) => parseBusinessHoursFromDb(raw),
    serializeToDb: (value) => {
      const v = value as BusinessHours
      const out: Record<string, BusinessHourSlot[] | null> = {}
      const days: (keyof BusinessHours)[] = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ]
      for (const d of days) {
        const slots = v[d]
        out[d] = slots && slots.length > 0 ? slots : null
      }
      return out as Json
    },
    validate: (value) => {
      const r = businessHoursSettingSchema.safeParse(value)
      if (!r.success) return r.error.issues[0]?.message ?? 'Orari non validi'
      const parsed = parseBusinessHours(r.data)
      return parsed ? null : 'Struttura orari non valida'
    },
  },
  contact_email: {
    key: 'contact_email',
    parseFromDb: (raw) =>
      clampBookingText(parseJsonScalarString(raw), contactEmailMax),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      if (!value || String(value).trim() === '') return null
      const r = optionalEmailSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  contact_phone: {
    key: 'contact_phone',
    parseFromDb: (raw) =>
      clampBookingText(parseJsonScalarString(raw), contactPhoneMax),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      if (!value || String(value).trim() === '') return null
      const r = optionalPhoneSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  contact_address: {
    key: 'contact_address',
    parseFromDb: (raw) =>
      clampBookingText(parseJsonScalarString(raw), contactAddressMax),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      if (!value || String(value).trim() === '') return null
      const r = optionalAddressSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Valore non valido'
    },
  },
  public_booking_page_background: {
    key: 'public_booking_page_background',
    parseFromDb: (raw) => parseBookingPageBackgroundFromDb(raw),
    serializeToDb: (value) => String(value).trim().toLowerCase() as Json,
    validate: (value) => {
      if (typeof value !== 'string') return 'Seleziona uno sfondo valido'
      const normalized = value.trim().toLowerCase()
      if (isBookingPageBackgroundId(normalized)) return null
      return 'Sfondo pagina non valido'
    },
  },
  public_booking_strip_photo: {
    key: 'public_booking_strip_photo',
    parseFromDb: (raw) => parseBookingStripPhotoFromDb(raw),
    // La colonna `setting_value` è NOT NULL: "nessuna striscia" si scrive come stringa vuota,
    // letta poi come null da parseBookingStripPhotoFromDb.
    serializeToDb: (value) => (value == null ? '' : String(value)) as Json,
    validate: (value) => {
      if (value == null) return null
      if (typeof value === 'string' && isBookingStripPhotoId(value)) return null
      return 'Foto striscia non valida'
    },
  },
  booking_staff_presets_visible: {
    key: 'booking_staff_presets_visible',
    parseFromDb: (raw) => parseBookingStaffPresetsVisibleFromDb(raw),
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      return typeof value === 'boolean' ? null : 'Valore non valido'
    },
  },
  booking_custom_staff_presets: {
    key: 'booking_custom_staff_presets',
    parseFromDb: (raw) => parseBookingCustomStaffPresetsFromDb(raw),
    serializeToDb: (value) => value as unknown as Json,
    validate: (value) => {
      const r = bookingCustomStaffPresetsSchema.safeParse(value)
      return r.success ? null : r.error.issues[0]?.message ?? 'Menu preselezionati non validi'
    },
  },
  booking_menu_promos: {
    key: 'booking_menu_promos',
    parseFromDb: (raw) => parseBookingMenuPromosFromDb(raw),
    serializeToDb: (value) => serializeMenuPromosToDb(value as MenuPromo[]) as unknown as Json,
    validate: (value) => {
      const normalized = normalizeMenuPromosList(value as MenuPromo[])
      const r = bookingMenuPromosSchema.safeParse(normalized)
      if (!r.success) return r.error.issues[0]?.message ?? 'Promo menu non valide'
      const uniqueness = validateMenuPromoUniqueness(normalized)
      return uniqueness.ok ? null : uniqueness.message
    },
  },
  booking_placement_areas: {
    key: 'booking_placement_areas',
    parseFromDb: (raw) => parseBookingPlacementAreasFromDb(raw),
    serializeToDb: (value) => value as unknown as Json,
    validate: (value) => {
      const r = bookingPlacementAreasSchema.safeParse(value)
      if (!r.success) return r.error.issues[0]?.message ?? 'Aree di posizionamento non valide'
      const unique = r.data.filter((item, index, arr) => arr.indexOf(item) === index)
      return unique.length === r.data.length ? null : 'Le aree di posizionamento devono essere univoche'
    },
  },
  /** Valori ammessi: `APP_THEME_IDS` in `constants/appTheme.ts` (+ token CSS `data-admin-theme` in `index.css`). */
  app_theme: {
    key: 'app_theme',
    parseFromDb: (raw) => parseAppThemeFromDb(raw),
    serializeToDb: (value) => String(value).trim().toLowerCase() as Json,
    validate: (value) => {
      if (typeof value !== 'string') return 'Seleziona un tema valido'
      const normalized = value.trim().toLowerCase()
      if (isAppThemeId(normalized)) return null
      return 'Tema app non valido'
    },
  },
  walk_in_max_guests: {
    key: 'walk_in_max_guests',
    parseFromDb: (raw) => {
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw
      if (typeof raw === 'string') {
        const n = parseInt(raw, 10)
        if (!Number.isNaN(n) && n >= 0) return n
      }
      return 20
    },
    serializeToDb: (value) => value as Json,
    validate: (value) => {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0 || n > 500) return 'Deve essere un intero tra 0 e 500'
      return null
    },
  },
  booking_time_slots_enabled: {
    key: 'booking_time_slots_enabled',
    parseFromDb: (raw) => {
      if (raw == null) return true
      if (raw === false || raw === 'false') return false
      if (raw === true || raw === 'true') return true
      return true
    },
    serializeToDb: (value) => value as Json,
    validate: (value) => (typeof value === 'boolean' ? null : 'Valore non valido'),
  },
  booking_public_form_config: {
    key: 'booking_public_form_config',
    parseFromDb: (raw): BookingPublicFormConfig | null => {
      if (!hasUsableBookingModesInRaw(raw)) {
        return null
      }
      const obj = raw as Record<string, unknown>
      const modes = Array.isArray(obj.booking_modes) ? obj.booking_modes : []
      return normalizeBookingPublicFormConfig({
        page_title: typeof obj.page_title === 'string' ? obj.page_title : DEFAULT_BOOKING_FORM_CONFIG.page_title,
        page_description:
          typeof obj.page_description === 'string'
            ? obj.page_description
            : DEFAULT_BOOKING_FORM_CONFIG.page_description,
        header_styles: parseBookingHeaderStylesFromUnknown(obj.header_styles),
        booking_modes: modes.map((m: unknown, i: number) => {
          const dm = DEFAULT_BOOKING_FORM_CONFIG.booking_modes[i] ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes[0]
          if (!m || typeof m !== 'object' || Array.isArray(m)) return dm
          const mode = m as Record<string, unknown>
          return {
            id: typeof mode.id === 'string' ? mode.id : dm.id,
            booking_type: (mode.booking_type as BookingPublicFormConfig['booking_modes'][number]['booking_type']) ?? dm.booking_type,
            enabled: typeof mode.enabled === 'boolean' ? mode.enabled : dm.enabled,
            label: typeof mode.label === 'string' ? mode.label : dm.label,
            description: typeof mode.description === 'string' ? mode.description : dm.description,
            icon: resolveBookingStoredIconKey(
              typeof mode.icon === 'string' ? mode.icon : undefined,
              resolveBookingStoredIconKey(dm.icon),
            ),
            sub_tabs_enabled: typeof mode.sub_tabs_enabled === 'boolean' ? mode.sub_tabs_enabled : dm.sub_tabs_enabled,
            sub_tabs_presentation: (() => {
              const raw = mode.sub_tabs_presentation
              if (raw === 'cards' || raw === 'carousel') return raw
              // Migrazione legacy: calcola dalla maggioranza di sub_tabs[].display
              const tabs: unknown[] = Array.isArray(mode.sub_tabs) ? mode.sub_tabs : []
              if (tabs.length === 0) return null
              let cardsCount = 0
              let carouselCount = 0
              for (const t of tabs) {
                if (t && typeof t === 'object' && !Array.isArray(t)) {
                  const display = (t as Record<string, unknown>).display
                  if (display === 'carousel') carouselCount++
                  else cardsCount++
                }
              }
              if (carouselCount === 0 && cardsCount === 0) return null
              return carouselCount > cardsCount ? 'carousel' : 'cards'
            })(),
            sub_tabs: (() => {
              const parsed: SubTab[] = Array.isArray(mode.sub_tabs)
                ? mode.sub_tabs.map(parseSubTabFromUnknown).filter((t): t is SubTab => t != null)
                : []
              if (parsed.length > 0) return parsed
              const overrides: SubTabOverride[] = Array.isArray(mode.sub_tabs_overrides)
                ? mode.sub_tabs_overrides
                    .filter(
                      (o): o is SubTabOverride =>
                        !!o &&
                        typeof o === 'object' &&
                        !Array.isArray(o) &&
                        typeof (o as SubTabOverride).preset_id === 'string' &&
                        typeof (o as SubTabOverride).custom_label === 'string',
                    )
                    .map((o) => ({
                      preset_id: (o as SubTabOverride).preset_id,
                      custom_label: (o as SubTabOverride).custom_label,
                    }))
                : []
              return overrides.length > 0 ? migrateOverridesToSubTabs(overrides) : []
            })(),
            sub_tabs_overrides: Array.isArray(mode.sub_tabs_overrides)
              ? mode.sub_tabs_overrides
                  .filter(
                    (o): o is SubTabOverride =>
                      !!o &&
                      typeof o === 'object' &&
                      !Array.isArray(o) &&
                      typeof (o as SubTabOverride).preset_id === 'string' &&
                      typeof (o as SubTabOverride).custom_label === 'string',
                  )
                  .map((o) => ({
                    preset_id: (o as SubTabOverride).preset_id,
                    custom_label: (o as SubTabOverride).custom_label,
                  }))
              : undefined,
            // Capabilities (Livello A): parse difensivo. Config legacy senza capabilities →
            // undefined → fallback Livello C → invariato. LOCK Parser/normalizer accoppiati.
            ...(() => {
              const capabilities = parseModeCapabilities(mode.capabilities)
              return capabilities ? { capabilities } : {}
            })(),
          }
        }),
      })
    },
    serializeToDb: (value) => value as unknown as Json,
    validate: (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Configurazione form non valida'
      const cfg = value as BookingPublicFormConfig
      if (!Array.isArray(cfg.booking_modes) || cfg.booking_modes.length === 0) {
        return 'Deve esserci almeno una modalità di prenotazione'
      }
      return null
    },
  },
}
