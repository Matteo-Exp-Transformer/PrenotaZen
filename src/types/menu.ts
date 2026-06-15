// Type definitions for Menu Items

import type { BookingType } from './booking'
import type { MenuQrCategoryIconKey } from '@/features/public-menu/categoryIcons'

export type MenuCategory = string

/** Valori legacy ammessi per `menu_items.booking_types`; la UI ingredienti mantiene il campo vuoto. */
export const MENU_ITEM_BOOKING_TYPE_VALUES: BookingType[] = [
  'tavolo',
  'rinfresco_laurea',
  'menu_prezzo_fisso',
]

export function normalizeMenuItemBookingTypes(raw: unknown): BookingType[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...MENU_ITEM_BOOKING_TYPE_VALUES]
  }
  const allowed = new Set<string>(MENU_ITEM_BOOKING_TYPE_VALUES)
  const filtered = raw.filter((t): t is BookingType => typeof t === 'string' && allowed.has(t))
  return filtered.length > 0 ? filtered : [...MENU_ITEM_BOOKING_TYPE_VALUES]
}

export interface MenuItem {
  id: string
  created_at: string
  updated_at: string
  name: string
  category: MenuCategory
  price: number
  description?: string
  sort_order: number
  /** false = nascosto in Prenota e Menu QR (magazzino). Default true. */
  is_available?: boolean
  /** Campo legacy: non valorizzare dalla UI ingredienti. */
  booking_types?: BookingType[]
  /** URL pubblico foto piatto (Supabase Storage bucket menu-photos). Opzionale. */
  image_url?: string | null
}

export interface MenuItemInput {
  name: string
  category: MenuCategory
  price: number
  description?: string
  sort_order?: number
  is_available?: boolean
  booking_types?: BookingType[]
  image_url?: string | null
}

/** Tipo per i QR code del menu pubblico. */
export interface MenuQrCode {
  id: string
  tenant_id: string
  short_code: string
  name: string
  category_filter: string[] | null
  is_active: boolean
  sort_order: number
  theme_key: string
  carousel_items: CarouselItem[]
  category_images: Record<string, string>
  /** UUID ingredienti da non mostrare in questo Menù QR (occhio chiuso). */
  hidden_menu_item_ids: string[]
  /**
   * Override ordine piatti per categoria, per questo QR.
   * Format: { category_key: [item_uuid, ...] }
   * null o chiave assente = ordine magazzino (sort_order + name).
   */
  item_sort_overrides: Record<string, string[]> | null
  created_at: string
  updated_at: string
}

export interface MenuQrCodeInput {
  name: string
  category_filter?: string[] | null
  is_active?: boolean
  sort_order?: number
  theme_key?: string
  carousel_items?: CarouselItem[]
  category_images?: Record<string, string>
  hidden_menu_item_ids?: string[]
  item_sort_overrides?: Record<string, string[]> | null
}

export interface MenuQrcodeCategoryOverrideDraft {
  category_key: string
  title: string | null
  description: string | null
  /** Icona Phosphor per-QR quando manca foto in category_images. */
  icon?: string | null
}

/** Payload completo salvataggio modale Impostazione Menù QR. */
export interface MenuQrSettingsSavePayload {
  shortCode: string
  qrId: string | null
  /** Short code bozza usato in path Storage prima del primo insert. */
  draftShortCode?: string | null
  input: MenuQrCodeInput
  categoryOverrides: MenuQrcodeCategoryOverrideDraft[]
}

/** Icone slide carosello Prenota — catalogo unificato Menù QR. */
export type CarouselSlideIcon = MenuQrCategoryIconKey

export interface CarouselItem {
  image_url: string
  /** Riga piccola maiuscola sopra il titolo (editor Prenota: «Etichetta card») */
  eyebrow?: string
  /** Titolo slide */
  title?: string
  /** Testo breve sotto il titolo */
  description?: string
  /** Icona associata alla slide (solo carosello Prenota) */
  icon?: CarouselSlideIcon
  /** legacy: rimane per retrocompat lettura dati salvati */
  label?: string
  sort_order: number
}

export interface MenuHomepageConfig {
  id: string
  tenant_id: string
  carousel_items: CarouselItem[]
  category_images: Record<string, string>
  /** Chiave tema visivo (default: 'mediterranean_teal') */
  theme_key: string
  created_at: string
  updated_at: string
}

export interface MenuHomepageConfigInput {
  carousel_items: CarouselItem[]
  category_images: Record<string, string>
  theme_key?: string
}

/** Override titolo/descrizione per le card categoria nella homepage QR.
 *  Separato da menu_categories per non impattare la pagina Prenota. */
export interface MenuQrcodeCategoryOverride {
  id: string
  tenant_id: string
  menu_qr_code_id: string
  category_key: string
  title: string | null
  description: string | null
  icon: string | null
  created_at: string
  updated_at: string
}

export interface MenuQrcodeCategoryOverrideInput {
  menu_qr_code_id: string
  category_key: string
  title?: string | null
  description?: string | null
}

export interface SelectedMenuItem {
  id: string
  name: string
  price: number
  category: MenuCategory
  quantity?: number
  totalPrice?: number
}

// Dietary restriction types
export const DIETARY_RESTRICTIONS = [
  'No Lattosio',
  'Vegano',
  'Vegetariano',
  'No Glutine',
  'No Frutta secca',
  'Altro'
] as const

export type DietaryRestrictionType = typeof DIETARY_RESTRICTIONS[number]

















