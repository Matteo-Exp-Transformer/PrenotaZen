import type { BookingType } from '@/types/booking'
import type { CarouselItem } from '@/types/menu'
import { parseModeCapabilities, type BookingModeCapabilities } from '../utils/bookingCapabilities'
import {
  MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
  resolveBookingStoredIconKey,
  type MenuQrCategoryIconKey,
} from '@/features/public-menu/categoryIcons'
import {
  BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS,
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
  clampBookingText,
  clampBookingTextOptional,
  normalizeBookingHeaderFontSizeForTarget,
} from './bookingPrenotaTextLimits'

export {
  BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS,
  BOOKING_HEADER_FONT_SIZE_MIN,
} from './bookingPrenotaTextLimits'

function clampCarouselSlideText(
  value: string | undefined,
  max: number,
): string | undefined {
  if (!value?.trim()) return undefined
  const trimmed = value.trim()
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

export function normalizeCarouselSlideItem(item: CarouselItem, sortOrder: number): CarouselItem {
  return {
    ...item,
    eyebrow: clampCarouselSlideText(item.eyebrow, BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.eyebrow),
    title: clampCarouselSlideText(item.title, BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.title),
    description: clampCarouselSlideText(
      item.description,
      BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.description,
    ),
    sort_order: typeof item.sort_order === 'number' ? item.sort_order : sortOrder,
  }
}

function carouselHasVisiblePhoto(items: CarouselItem[] | undefined): boolean {
  return (items ?? []).some((item) => item.image_url?.trim())
}

function cardHasMinimumContent(label: string): boolean {
  return Boolean(label.trim())
}

function normalizeSubTabsPresentation(
  presentation: BookingMode['sub_tabs_presentation'],
  subTabs: SubTab[],
): BookingMode['sub_tabs_presentation'] {
  if (subTabs.length === 0) return null
  if (presentation === 'cards' || presentation === 'carousel') {
    return subTabs.some((tab) => tab.display === presentation) ? presentation : null
  }
  const cardsCount = subTabs.filter((tab) => tab.display === 'cards').length
  const carouselCount = subTabs.filter((tab) => tab.display === 'carousel').length
  if (carouselCount === 0 && cardsCount === 0) return null
  return carouselCount > cardsCount ? 'carousel' : 'cards'
}

/** Icone card scorrevoli / carosello Prenota — stesso namespace del Menù QR. */
export type SubTabIcon = MenuQrCategoryIconKey

/** Icone tipologie prenotazione — stesso namespace del Menù QR. */
export type BookingModeIcon = MenuQrCategoryIconKey

export const BOOKING_HEADER_FONT_OPTIONS = [
  {
    id: 'playfair',
    label: 'Playfair Display',
    fontFamily: '"Playfair Display", Georgia, serif',
  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    fontFamily: '"Libre Baskerville", Georgia, serif',
  },
  {
    id: 'cinzel',
    label: 'Cinzel',
    fontFamily: '"Cinzel", Georgia, serif',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    fontFamily: '"Montserrat", Inter, system-ui, sans-serif',
  },
  {
    id: 'lora',
    label: 'Lora',
    fontFamily: '"Lora", Georgia, serif',
  },
  {
    id: 'raleway',
    label: 'Raleway',
    fontFamily: '"Raleway", Inter, system-ui, sans-serif',
  },
  {
    id: 'dm-serif-display',
    label: 'DM Serif Display',
    fontFamily: '"DM Serif Display", Georgia, serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    fontFamily: '"Merriweather", Georgia, serif',
  },
  {
    id: 'poppins',
    label: 'Poppins',
    fontFamily: '"Poppins", Inter, system-ui, sans-serif',
  },
  {
    id: 'lobster',
    label: 'Lobster',
    fontFamily: '"Lobster", cursive',
  },
  {
    id: 'pacifico',
    label: 'Pacifico',
    fontFamily: '"Pacifico", cursive',
  },
  {
    id: 'great-vibes',
    label: 'Great Vibes',
    fontFamily: '"Great Vibes", cursive',
  },
  {
    id: 'dancing-script',
    label: 'Dancing Script',
    fontFamily: '"Dancing Script", cursive',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    fontFamily: '"Mistral", "Brush Script MT", "Segoe Script", cursive',
  },
] as const

export type BookingHeaderFontId = (typeof BOOKING_HEADER_FONT_OPTIONS)[number]['id']

/** Id font salvati in DB prima del rename Thirsty → Dancing Script. */
const BOOKING_HEADER_LEGACY_FONT_ID_MAP: Record<string, BookingHeaderFontId> = {
  'thirsty-script': 'dancing-script',
}

export type BookingHeaderTextTarget = 'restaurant_name' | 'page_title' | 'page_description'

export type BookingHeaderFontWeight = 'normal' | 'bold'
export type BookingHeaderTextDecoration = 'none' | 'underline'

export interface BookingHeaderTextStyle {
  font: BookingHeaderFontId
  color: string
  /** Dimensione testo intestazione Prenota (px), 8–38 inclusi. */
  fontSize: number
  fontWeight: BookingHeaderFontWeight
  textDecoration: BookingHeaderTextDecoration
  textAlign?: 'left' | 'center' | 'right'
}

export type BookingHeaderStyles = Record<BookingHeaderTextTarget, BookingHeaderTextStyle>

/** Legacy alias — preferire getBookingHeaderFontSizeMax(target) da bookingPrenotaTextLimits. */
export const BOOKING_HEADER_FONT_SIZE_MAX = 38

/** Default px per target quando `fontSize` assente o non valido (migrate-on-read, FU-023). */
export const DEFAULT_BOOKING_HEADER_FONT_SIZE_PX: Record<BookingHeaderTextTarget, number> = {
  restaurant_name: 34,
  page_title: 30,
  page_description: 16,
}

export function defaultBookingHeaderFontWeight(
  target: BookingHeaderTextTarget,
): BookingHeaderFontWeight {
  return target === 'page_description' ? 'normal' : 'bold'
}

export function normalizeBookingHeaderFontWeight(
  value: unknown,
  target: BookingHeaderTextTarget,
): BookingHeaderFontWeight {
  if (value === 'normal' || value === 'bold') return value
  return defaultBookingHeaderFontWeight(target)
}

export function normalizeBookingHeaderTextDecoration(value: unknown): BookingHeaderTextDecoration {
  return value === 'underline' ? 'underline' : 'none'
}

export const DEFAULT_BOOKING_HEADER_STYLES: BookingHeaderStyles = {
  restaurant_name: {
    font: 'playfair',
    color: '#6b4226',
    fontSize: DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.restaurant_name,
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center',
  },
  page_title: {
    font: 'playfair',
    color: '#6b4226',
    fontSize: DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.page_title,
    fontWeight: 'bold',
    textDecoration: 'none',
    textAlign: 'center',
  },
  page_description: {
    font: 'montserrat',
    color: '#4a2d19',
    fontSize: DEFAULT_BOOKING_HEADER_FONT_SIZE_PX.page_description,
    fontWeight: 'normal',
    textDecoration: 'none',
    textAlign: 'center',
  },
}

const BOOKING_HEADER_FONT_IDS = BOOKING_HEADER_FONT_OPTIONS.map((font) => font.id)
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function isBookingHeaderFontId(value: unknown): value is BookingHeaderFontId {
  return typeof value === 'string' && BOOKING_HEADER_FONT_IDS.includes(value as BookingHeaderFontId)
}

export function resolveBookingHeaderFontId(
  value: unknown,
  fallback: BookingHeaderFontId,
): BookingHeaderFontId {
  if (typeof value === 'string') {
    const legacy = BOOKING_HEADER_LEGACY_FONT_ID_MAP[value]
    if (legacy) return legacy
    if (isBookingHeaderFontId(value)) return value
  }
  return fallback
}

export function getBookingHeaderFontFamily(font: BookingHeaderFontId): string {
  return BOOKING_HEADER_FONT_OPTIONS.find((option) => option.id === font)?.fontFamily
    ?? BOOKING_HEADER_FONT_OPTIONS[0].fontFamily
}

export function normalizeBookingHeaderFontSize(
  value: unknown,
  target: BookingHeaderTextTarget,
): number {
  const fallback = DEFAULT_BOOKING_HEADER_FONT_SIZE_PX[target]
  return normalizeBookingHeaderFontSizeForTarget(value, target, fallback)
}

export function getBookingHeaderTextStyle(
  target: BookingHeaderTextTarget,
  headerStyles: BookingHeaderStyles,
): {
  fontFamily: string
  color: string
  fontSize: string
  fontWeight: number
  textDecoration: BookingHeaderTextDecoration
  lineHeight: number
  textAlign: 'left' | 'center' | 'right'
} {
  const style = headerStyles[target] ?? DEFAULT_BOOKING_HEADER_STYLES[target]
  const fallback = DEFAULT_BOOKING_HEADER_STYLES[target]
  const fontSizePx = normalizeBookingHeaderFontSize(style.fontSize, target)
  const fontWeight = normalizeBookingHeaderFontWeight(style.fontWeight, target)
  const textDecoration = normalizeBookingHeaderTextDecoration(style.textDecoration)
  return {
    fontFamily: getBookingHeaderFontFamily(style.font),
    color: style.color,
    fontSize: `${fontSizePx}px`,
    fontWeight: fontWeight === 'bold' ? 700 : 400,
    textDecoration,
    lineHeight: target === 'page_description' ? 1.42 : 1.15,
    textAlign: style.textAlign ?? fallback.textAlign ?? 'center',
  }
}

export function normalizeBookingHeaderColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim()) ? value.trim() : fallback
}

export function parseBookingHeaderStylesFromUnknown(raw: unknown): BookingHeaderStyles {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_BOOKING_HEADER_STYLES
  const obj = raw as Record<string, unknown>
  const targets: BookingHeaderTextTarget[] = ['restaurant_name', 'page_title', 'page_description']

  return targets.reduce<BookingHeaderStyles>((acc, target) => {
    const fallback = DEFAULT_BOOKING_HEADER_STYLES[target]
    const row = obj[target]
    const value = row && typeof row === 'object' && !Array.isArray(row)
      ? (row as Record<string, unknown>)
      : {}
    acc[target] = {
      font: resolveBookingHeaderFontId(value.font, fallback.font),
      color: normalizeBookingHeaderColor(value.color, fallback.color),
      fontSize: normalizeBookingHeaderFontSize(value.fontSize, target),
      fontWeight: normalizeBookingHeaderFontWeight(value.fontWeight, target),
      textDecoration: normalizeBookingHeaderTextDecoration(value.textDecoration),
      textAlign:
        value.textAlign === 'left' || value.textAlign === 'center' || value.textAlign === 'right'
          ? value.textAlign
          : fallback.textAlign ?? 'center',
    }
    return acc
  }, { ...DEFAULT_BOOKING_HEADER_STYLES })
}

/**
 * Campi della card Prenota che possono essere personalizzati dal ristoratore
 * sovrascrivendo il preset collegato. La bandierina booleana indica:
 * `true` = personalizzato dal ristoratore (resta anche se il preset cambia)
 * `false`/`undefined` = ereditato dal preset (segue il preset live)
 */
export type SubTabOverridableField =
  | 'label'
  | 'description'
  | 'price_per_person'
  | 'hidden_item_ids'
  | 'hidden_category_keys'
  | 'category_order_keys'

export type SubTabFieldOverrides = Partial<Record<SubTabOverridableField, boolean>>

export interface SubTab {
  id: string
  display: 'cards' | 'carousel'
  label: string
  icon?: SubTabIcon
  preset_id?: string
  price_per_person?: number
  /** Omesso o true = ingredienti bloccati; false = cliente puo modificarli e non ha prezzo fisso. */
  is_fixed_menu?: boolean
  description?: string
  courses_label?: string
  hidden_category_keys?: string[]
  hidden_item_ids?: string[]
  /** Ordine card categorie in Pagina Prenota (solo sub-tab con preset). */
  category_order_keys?: string[]
  carousel_items?: CarouselItem[]
  /**
   * Carosello: se `false`, il riepilogo Prenota nasconde il nome carosello (`label`) nelle righe
   * «Tipo» e «Opzione menu» e non elenca i titoli slide in «Offerta selezionata». Il prezzo a
   * persona resta visibile solo se `price_per_person` > 0 (regola indipendente). Omesso o `true`
   * = nome carosello + titoli slide visibili nel riepilogo.
   */
  show_offer_details_in_summary?: boolean
  /**
   * Tracking personalizzazioni vs preset.
   * Vedi `bookingFormResolver.ts` per il comportamento «aggiorna solo se non personalizzato».
   */
  field_overrides?: SubTabFieldOverrides
}

/**
 * Prezzo fisso €/persona della sottotab, se applicabile.
 * `undefined` = menù personalizzabile (somma ingredienti); numero = prezzo fisso opzione.
 */
export function getSubTabPricePerPerson(subTab: SubTab | null | undefined): number | undefined {
  if (!subTab || subTab.is_fixed_menu === false) return undefined
  return subTab.price_per_person != null && subTab.price_per_person > 0
    ? subTab.price_per_person
    : undefined
}

/**
 * Carosello Prenota: nome carosello + titoli slide nel riepilogo laterale (default true se assente).
 * Non governa il prezzo a persona (visibile solo se `price_per_person` > 0).
 */
export function getShowOfferDetailsInSummary(tab: SubTab | null | undefined): boolean {
  return tab?.show_offer_details_in_summary !== false
}

/** Titoli slide carosello (solo item con `image_url`). Con `photoFallback` aggiunge `Foto N` se manca title/eyebrow. */
export function getCarouselSlideTitles(
  tab: SubTab | null | undefined,
  options?: { photoFallback?: boolean },
): string[] {
  if (tab?.display !== 'carousel') return []
  const usePhotoFallback = options?.photoFallback !== false
  return (tab.carousel_items ?? [])
    .filter((item) => item.image_url?.trim())
    .map((item, idx) => {
      const explicit = item.title?.trim() || item.eyebrow?.trim()
      if (explicit) return explicit
      return usePhotoFallback ? `Foto ${idx + 1}` : ''
    })
    .filter((title) => title.length > 0)
}

export function formatCarouselPricePerPersonLine(amount: number): string {
  const formatted = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(
    amount,
  )
  return `${formatted}/persona`
}

export type CarouselSummaryDisplay =
  | { kind: 'titles'; titles: string[] }
  | { kind: 'price'; amount: number }

/** Cosa mostrare in riepilogo/sticky carosello (titoli lista o solo prezzo). */
export function resolveCarouselSummaryDisplay(
  tab: SubTab | null | undefined,
): CarouselSummaryDisplay | null {
  if (tab?.display !== 'carousel') return null
  const showDetails = getShowOfferDetailsInSummary(tab)
  const explicitTitles = getCarouselSlideTitles(tab, { photoFallback: false })
  const price =
    tab.price_per_person != null && tab.price_per_person > 0 ? tab.price_per_person : null

  if (showDetails && explicitTitles.length > 0) {
    return { kind: 'titles', titles: explicitTitles }
  }
  if (price != null) return { kind: 'price', amount: price }
  return null
}

/** Una riga di testo per mini-pannello sticky (primo title/eyebrow o prezzo; senza label). */
export function getCarouselStickyMiniPanelLine(tab: SubTab | null | undefined): string | null {
  if (tab?.display !== 'carousel') return null
  const showDetails = getShowOfferDetailsInSummary(tab)
  const explicitTitles = getCarouselSlideTitles(tab, { photoFallback: false })
  const price =
    tab.price_per_person != null && tab.price_per_person > 0 ? tab.price_per_person : null

  if (showDetails && explicitTitles.length > 0) return explicitTitles[0]
  if (price != null) return formatCarouselPricePerPersonLine(price)
  return null
}

/** @deprecated Usare `sub_tabs[]` con type preset. Mantenuto per migrazione runtime da DB. */
export interface SubTabOverride {
  preset_id: string
  custom_label: string
}

export interface BookingMode {
  id: string
  booking_type: BookingType
  enabled: boolean
  label: string
  description: string
  icon: BookingModeIcon
  sub_tabs_enabled: boolean
  /**
   * XOR presentazione sottotab per questa modalità.
   * null = non ancora scelto (prima sottotab non ancora salvata).
   * Calcolato dalla maggioranza di sub_tabs[].display al primo parse di dati legacy.
   */
  sub_tabs_presentation: 'cards' | 'carousel' | null
  sub_tabs: SubTab[]
  /** @deprecated Migrato a runtime in `sub_tabs` se vuoto. */
  sub_tabs_overrides?: SubTabOverride[]
  /**
   * Capacità esplicite della tipologia (Livello A). Assente → fallback per tipo (Livello C).
   * Vedi `utils/bookingCapabilities.ts`. Scritto solo dal pannello admin (Fase 3).
   */
  capabilities?: BookingModeCapabilities
}

export interface BookingPublicFormConfig {
  page_title: string
  page_description: string
  header_styles: BookingHeaderStyles
  booking_modes: BookingMode[]
}

function parseBookingIconOptional(value: unknown): SubTabIcon | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  return resolveBookingStoredIconKey(value.trim())
}

function parseBookingIconRequired(
  value: unknown,
  fallback: MenuQrCategoryIconKey,
): MenuQrCategoryIconKey {
  if (typeof value !== 'string' || !value.trim()) return fallback
  return resolveBookingStoredIconKey(value.trim(), fallback)
}

/** Migra testi legacy da livello sottotab alla prima slide; il carosello mantiene label e prezzo separati. */
export function migrateLegacyCarouselSubTab(tab: SubTab): SubTab {
  if (tab.display !== 'carousel') return tab

  const items = tab.carousel_items ?? []
  if (items.length === 0) {
    return {
      ...tab,
      price_per_person: tab.price_per_person,
      description: undefined,
    }
  }

  const migratedItems: CarouselItem[] = items.map((item, idx) => {
    const base =
      idx === 0
        ? {
            ...item,
            eyebrow: item.eyebrow?.trim() || undefined,
            title: item.title?.trim() || undefined,
            description: item.description?.trim() || tab.description?.trim() || undefined,
            icon: item.icon ?? tab.icon,
          }
        : item
    return normalizeCarouselSlideItem(base, typeof base.sort_order === 'number' ? base.sort_order : idx)
  })

  return {
    ...tab,
    description: undefined,
    price_per_person: tab.price_per_person,
    icon: undefined,
    carousel_items: migratedItems,
  }
}

export function parseSubTabFromUnknown(raw: unknown): SubTab | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const legacyType = o.type === 'preset' || o.type === 'manual' ? o.type : null
  const display =
    o.display === 'carousel' || o.sub_tabs_display === 'carousel'
      ? 'carousel'
      : ('cards' as const)
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  if (!id) return null
  if (!label && display === 'carousel') return null

  const icon = parseBookingIconOptional(o.icon)

  let price_per_person: number | undefined
  if (typeof o.price_per_person === 'number' && o.price_per_person >= 0) {
    price_per_person = o.price_per_person
  }

  const description = typeof o.description === 'string' ? o.description.trim() : undefined
  const courses_label = typeof o.courses_label === 'string' ? o.courses_label.trim() : undefined
  const hidden_category_keys = Array.isArray(o.hidden_category_keys)
    ? o.hidden_category_keys.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : undefined
  const hidden_item_ids = Array.isArray(o.hidden_item_ids)
    ? o.hidden_item_ids.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : undefined
  const category_order_keys = Array.isArray(o.category_order_keys)
    ? o.category_order_keys
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : undefined
  const carousel_items = Array.isArray(o.carousel_items)
    ? o.carousel_items
        .filter((v): v is CarouselItem => {
          if (!v || typeof v !== 'object' || Array.isArray(v)) return false
          const item = v as Partial<CarouselItem>
          return typeof item.image_url === 'string' && item.image_url.trim().length > 0
        })
        .map((v, idx) =>
          normalizeCarouselSlideItem(
            {
              image_url: v.image_url,
              eyebrow: typeof v.eyebrow === 'string' && v.eyebrow.trim() ? v.eyebrow.trim() : undefined,
              title: typeof v.title === 'string' && v.title.trim() ? v.title.trim() : undefined,
              description:
                typeof v.description === 'string' && v.description.trim()
                  ? v.description.trim()
                  : undefined,
              icon: parseBookingIconOptional((v as Partial<CarouselItem>).icon),
              sort_order: typeof v.sort_order === 'number' ? v.sort_order : idx,
            },
            idx,
          ),
        )
    : undefined

  if (display === 'carousel' && !carouselHasVisiblePhoto(carousel_items)) return null

  const preset_id =
    legacyType !== 'manual' && typeof o.preset_id === 'string' && o.preset_id.trim()
      ? o.preset_id.trim()
      : undefined

  if (display === 'cards' && !cardHasMinimumContent(label)) return null

  const field_overrides = parseFieldOverridesFromUnknown(o.field_overrides)

  const show_offer_details_in_summary =
    typeof o.show_offer_details_in_summary === 'boolean'
      ? o.show_offer_details_in_summary
      : undefined

  const parsed: SubTab = {
    id,
    display,
    label,
    icon,
    preset_id,
    price_per_person,
    is_fixed_menu: typeof o.is_fixed_menu === 'boolean' ? o.is_fixed_menu : undefined,
    description: display === 'carousel' ? undefined : description,
    courses_label: display === 'carousel' ? undefined : courses_label,
    hidden_category_keys,
    hidden_item_ids,
    category_order_keys,
    carousel_items,
    show_offer_details_in_summary:
      display === 'carousel' ? show_offer_details_in_summary : undefined,
    field_overrides,
  }

  return display === 'carousel' ? migrateLegacyCarouselSubTab(parsed) : parsed
}

const OVERRIDABLE_FIELDS: SubTabOverridableField[] = [
  'label',
  'description',
  'price_per_person',
  'hidden_item_ids',
  'hidden_category_keys',
  'category_order_keys',
]

function parseFieldOverridesFromUnknown(raw: unknown): SubTabFieldOverrides | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const obj = raw as Record<string, unknown>
  const result: SubTabFieldOverrides = {}
  let hasAny = false
  for (const key of OVERRIDABLE_FIELDS) {
    if (typeof obj[key] === 'boolean') {
      result[key] = obj[key] as boolean
      hasAny = true
    }
  }
  return hasAny ? result : undefined
}

export function migrateOverridesToSubTabs(overrides: SubTabOverride[]): SubTab[] {
  return overrides
    .filter((o) => o.preset_id && o.custom_label.trim())
    .map((o) => ({
      id: `legacy-${o.preset_id}`,
      display: 'cards' as const,
      label: o.custom_label.trim(),
      preset_id: o.preset_id,
    }))
}

/**
 * Allinea `sub_tabs[].label` (Etichetta card) con `sub_tabs_overrides` legacy:
 * se la label salvata coincide ancora col nome del preset staff ma esiste un override
 * con etichetta personalizzata, usa l'override per la pagina Prenota.
 */
export function applyLegacySubTabLabelOverrides(
  subTabs: SubTab[],
  legacyOverrides: SubTabOverride[] | undefined,
  staffPresets: { id: string; name: string }[],
): SubTab[] {
  if (!legacyOverrides?.length) return subTabs
  return subTabs.map((tab) => {
    if (!tab.preset_id) return tab
    const override = legacyOverrides.find((o) => o.preset_id === tab.preset_id)
    const custom = override?.custom_label?.trim()
    if (!custom) return tab
    const label = tab.label?.trim() ?? ''
    const presetName = staffPresets.find((p) => p.id === tab.preset_id)?.name?.trim()
    if (!label) return { ...tab, label: custom }
    if (presetName && label === presetName && custom !== label) {
      return { ...tab, label: custom }
    }
    return tab
  })
}

export const DEFAULT_BOOKING_FORM_CONFIG: BookingPublicFormConfig = {
  page_title: 'Configura la pagina Prenota',
  page_description:
    'Compila titolo, descrizione e tipologie prima di pubblicare il form.',
  header_styles: DEFAULT_BOOKING_HEADER_STYLES,
  booking_modes: [
    {
      id: 'tavolo',
      booking_type: 'tavolo',
      enabled: false,
      label: 'Compila nome tipologia',
      description: 'Compila la descrizione mostrata al cliente.',
      icon: 'fork_knife',
      sub_tabs_enabled: false,
      sub_tabs_presentation: null,
      sub_tabs: [],
    },
    {
      id: 'menu_prezzo_fisso',
      booking_type: 'menu_prezzo_fisso',
      enabled: false,
      label: 'Compila nome tipologia',
      description: 'Compila la descrizione mostrata al cliente.',
      icon: 'bowl_food',
      sub_tabs_enabled: false,
      sub_tabs_presentation: null,
      sub_tabs: [],
    },
    {
      id: 'rinfresco_laurea',
      booking_type: 'rinfresco_laurea',
      enabled: false,
      label: 'Compila nome tipologia',
      description: 'Compila la descrizione mostrata al cliente.',
      icon: 'lucide_chef_hat',
      sub_tabs_enabled: false,
      sub_tabs_presentation: null,
      sub_tabs: [],
    },
  ],
}

/** Trim solo al salvataggio — mai in onChange, altrimenti la barra spaziatrice non funziona mentre si digita. */
export function normalizeBookingPublicFormConfig(
  config: BookingPublicFormConfig,
): BookingPublicFormConfig {
  const L = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS
  return {
    page_title: clampBookingText(config.page_title.trim(), L.pageTitle),
    page_description: clampBookingText(config.page_description.trim(), L.pageDescription),
    header_styles: parseBookingHeaderStylesFromUnknown(config.header_styles),
    booking_modes: config.booking_modes.map((mode) => {
      const subTabs = (mode.sub_tabs ?? [])
        .map((tab): SubTab | null => {
        const display: SubTab['display'] = tab.display === 'carousel' ? 'carousel' : 'cards'
        const isPersonalizzabileCard = display === 'cards' && tab.is_fixed_menu === false
        const base: SubTab = {
          ...tab,
          display,
          icon: tab.icon ? parseBookingIconOptional(tab.icon) : undefined,
          label: clampBookingText(tab.label.trim(), L.subTabLabel),
          is_fixed_menu: isPersonalizzabileCard ? false : undefined,
          price_per_person: isPersonalizzabileCard ? undefined : tab.price_per_person,
          hidden_category_keys: tab.hidden_category_keys?.filter((v) => v.trim()) ?? undefined,
          hidden_item_ids: tab.hidden_item_ids?.filter((v) => v.trim()) ?? undefined,
          category_order_keys: tab.category_order_keys?.filter((v) => v.trim()) ?? undefined,
          carousel_items: tab.carousel_items,
          courses_label:
            display === 'cards' && tab.courses_label?.trim()
              ? clampBookingTextOptional(tab.courses_label, L.subTabCoursesLabel)
              : undefined,
          field_overrides: tab.field_overrides,
        }
        if (display === 'carousel') {
          const normalizedCarousel = migrateLegacyCarouselSubTab({
            ...base,
            description: undefined,
            icon: undefined,
            show_offer_details_in_summary:
              tab.show_offer_details_in_summary === false ? false : undefined,
            carousel_items: base.carousel_items?.map((item, idx) => {
              const normalized = normalizeCarouselSlideItem(
                item,
                typeof item.sort_order === 'number' ? item.sort_order : idx,
              )
              return {
                ...normalized,
                icon: normalized.icon
                  ? parseBookingIconOptional(normalized.icon)
                  : undefined,
              }
            }),
          })
          return carouselHasVisiblePhoto(normalizedCarousel.carousel_items)
            ? normalizedCarousel
            : null
        }
        if (!cardHasMinimumContent(base.label)) return null
        return {
          ...base,
          description: tab.description?.trim()
            ? clampBookingTextOptional(tab.description, L.subTabDescription)
            : undefined,
        }
      })
        .filter((tab): tab is SubTab => tab != null)
      // capabilities (Livello A): preserva solo se presenti e valide; mai scrivere default
      // (assente → fallback Livello C → comportamento invariato). LOCK Parser/normalizer accoppiati.
      // `capabilities` raw escluso dallo spread per scartare valori malformati passati dall'admin.
      const { capabilities: rawCapabilities, ...modeRest } = mode
      const capabilities = parseModeCapabilities(rawCapabilities)
      return {
        ...modeRest,
        label: clampBookingText(mode.label.trim(), L.modeLabel),
        description: clampBookingText(mode.description.trim(), L.modeDescription),
        icon: parseBookingIconRequired(mode.icon, MENU_QR_DEFAULT_CATEGORY_ICON_KEY),
        sub_tabs_presentation: normalizeSubTabsPresentation(mode.sub_tabs_presentation, subTabs),
        sub_tabs: subTabs,
        ...(capabilities ? { capabilities } : {}),
      }
    }),
  }
}
