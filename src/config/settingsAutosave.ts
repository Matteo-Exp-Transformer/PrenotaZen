import type { RestaurantSettingKeyV1 } from '@/features/booking/lib/restaurantSettingRegistry'

/**
 * Autosave impostazioni admin: ON in dev se `VITE_SETTINGS_AUTOSAVE` non è `false`;
 * in build produzione commerciale OFF salvo `VITE_SETTINGS_AUTOSAVE=true`.
 * FU-004: prod senza autosave → campi testo solo dal footer.
 */
export const SETTINGS_AUTOSAVE_ENABLED =
  import.meta.env.DEV
    ? import.meta.env.VITE_SETTINGS_AUTOSAVE !== 'false'
    : import.meta.env.VITE_SETTINGS_AUTOSAVE === 'true'

/** Chiavi `restaurant_settings` salvate in autosave (testo semplice). */
export const SETTINGS_AUTOSAVE_RESTAURANT_KEYS = [
  'restaurant_name',
  'contact_email',
  'contact_phone',
  'contact_address',
] as const satisfies readonly RestaurantSettingKeyV1[]

/** Campi in `booking_public_form_config` (solo titolo/descrizione pagina). */
export const SETTINGS_AUTOSAVE_BOOKING_HEADER_FIELDS = ['page_title', 'page_description'] as const

export type SettingsAutosaveBookingHeaderField =
  (typeof SETTINGS_AUTOSAVE_BOOKING_HEADER_FIELDS)[number]
