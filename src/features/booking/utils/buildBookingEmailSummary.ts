/**
 * Riepilogo email accetta/rifiuta — stesse regole di visibilità di BookingSummarySidebar.
 * Funzioni pure: nessun React/fetch.
 */

import type { BookingRequest } from '@/types/booking'
import {
  getShowOfferDetailsInSummary,
  getSubTabPricePerPerson,
  resolveCarouselSummaryDisplay,
  type BookingMode,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import {
  getCustomPresetUuid,
  type CustomStaffPreset,
} from '@/features/booking/constants/presetMenus'
import { resolveSubTabView, type ResolvedSubTab } from '@/features/booking/services/bookingFormResolver'
import { activeSubTabShowsMenu, modeUsesMenu } from '@/features/booking/utils/bookingCapabilities'
import { getModeLabelByType } from '@/features/booking/utils/bookingModeLabels'
import { dietaryRestrictionsToText } from '@/features/booking/utils/dietaryRestrictionsText'
import { extractTimeFromISO } from '@/features/booking/utils/dateUtils'
import {
  buildCategorySortOrderMap,
  orderCategoryKeys,
} from '@/features/booking/utils/orderCategoryKeys'
import type { SelectedMenuItem } from '@/types/menu'

export interface MenuCategoryLabel {
  key: string
  label: string
  sort_order?: number
}

export interface BookingEmailSummaryContext {
  modes: BookingMode[]
  customStaffPresets: CustomStaffPreset[]
  menuCategories: MenuCategoryLabel[]
}

export type EmailSummaryTiming = 'accepted' | 'rejected'

export interface EmailSummaryRow {
  label: string
  value: string
}

export interface EmailSummaryMenuItem {
  categoryLabel?: string
  name: string
  price?: string
}

export interface EmailSummarySection {
  kind:
    | 'row'
    | 'opzione_menu'
    | 'offerta_carosello_titles'
    | 'offerta_carosello_price'
    | 'menu_items'
    | 'totals'
    | 'intolleranze'
    | 'note'
  label?: string
  value?: string
  items?: EmailSummaryMenuItem[]
  titles?: string[]
  totalPerPersonLine?: string
  totalBookingLabel?: string
  totalBookingValue?: string
}

function formatDateSidebar(dateStr?: string | null): string | null {
  if (!dateStr?.trim()) return null
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount?: number | null): string | null {
  if (amount == null || amount <= 0) return null
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Prefisso auto-iniettato al submit per card senza preset: `[Label]` o `[Label - €12/p]`. */
export function parseSubTabPrefixFromSpecialRequests(
  specialRequests?: string | null,
): { label: string; rawPrefix: string } | null {
  if (!specialRequests?.trim()) return null
  const match = specialRequests.trim().match(/^(\[[^\]]+(?: - €[\d.,]+\/p)?\])\s*/)
  if (!match) return null
  const rawPrefix = match[1]
  const inner = rawPrefix.slice(1, -1)
  const label = inner.replace(/ - €[\d.,]+\/p$/, '').trim()
  return label ? { label, rawPrefix } : null
}

/** Rimuove il prefisso sottotab da note cliente (evita duplicato con «Opzione menu»). */
export function stripSubTabAutoPrefix(
  specialRequests: string | undefined | null,
  subTabLabel?: string,
): string {
  if (!specialRequests?.trim()) return ''
  let text = specialRequests.trim()
  const parsed = parseSubTabPrefixFromSpecialRequests(text)
  if (parsed) {
    text = text.slice(parsed.rawPrefix.length).trim()
  }
  if (subTabLabel?.trim()) {
    const plain = `[${subTabLabel.trim()}]`
    if (text.startsWith(plain)) {
      text = text.slice(plain.length).trim()
    }
  }
  return text
}

function resolveModeSubTabs(
  mode: BookingMode | undefined,
  customStaffPresets: CustomStaffPreset[],
): ResolvedSubTab[] {
  if (!mode?.sub_tabs?.length) return []
  return mode.sub_tabs.map((tab) => resolveSubTabView(tab, customStaffPresets))
}

/**
 * Euristica sottotab da booking salvato (activeSubTabId non è in DB):
 * 1. Carosello → unica sottotab carousel della modalità
 * 2. preset_menu custom:uuid → match preset_id
 * 3. Prefisso `[Label]` in special_requests → match label risolta
 * 4. Una sola sottotab nella modalità → quella
 * 5. Ambiguo → null (mostra solo dati certi del booking)
 */
export function resolveSubTabFromBooking(
  booking: Pick<BookingRequest, 'booking_type' | 'preset_menu' | 'special_requests'>,
  mode: BookingMode | undefined,
  customStaffPresets: CustomStaffPreset[],
): ResolvedSubTab | null {
  const resolvedSubTabs = resolveModeSubTabs(mode, customStaffPresets)
  if (!mode || resolvedSubTabs.length === 0) return null

  if (mode.sub_tabs_presentation === 'carousel') {
    return resolvedSubTabs.find((t) => t.display === 'carousel') ?? null
  }

  if (booking.preset_menu) {
    const uuid = getCustomPresetUuid(booking.preset_menu)
    if (uuid) {
      const matches = resolvedSubTabs.filter((t) => t.preset_id === uuid)
      if (matches.length === 1) return matches[0]
    }
  }

  const prefix = parseSubTabPrefixFromSpecialRequests(booking.special_requests)
  if (prefix?.label) {
    const normalized = prefix.label.toLowerCase()
    const byLabel = resolvedSubTabs.filter((t) => t.label.trim().toLowerCase() === normalized)
    if (byLabel.length === 1) return byLabel[0]
  }

  if (resolvedSubTabs.length === 1) return resolvedSubTabs[0]

  return null
}

function sortMenuItems(
  items: SelectedMenuItem[],
  menuCategories: MenuCategoryLabel[],
  categoryOrderKeys?: string[],
): SelectedMenuItem[] {
  const keys = [...new Set(items.map((item) => item.category))]
  const sortOrderMap = buildCategorySortOrderMap(
    menuCategories.map((c) => ({ key: c.key, sort_order: c.sort_order ?? 999 })),
  )
  const orderedKeys = orderCategoryKeys(keys, categoryOrderKeys, sortOrderMap)
  const rank = new Map(orderedKeys.map((key, index) => [key, index]))

  return [...items].sort((a, b) => {
    const orderA = rank.get(a.category) ?? 999
    const orderB = rank.get(b.category) ?? 999
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name, 'it')
  })
}

function resolveDateAndTime(
  booking: BookingRequest,
  timing: EmailSummaryTiming,
): { date: string | null; time: string | null } {
  if (timing === 'accepted' && booking.confirmed_start) {
    const isoDate = booking.confirmed_start.slice(0, 10)
    return {
      date: formatDateSidebar(isoDate),
      time: extractTimeFromISO(booking.confirmed_start) || booking.desired_time || null,
    }
  }
  return {
    date: formatDateSidebar(booking.desired_date),
    time: booking.desired_time?.trim() || null,
  }
}

export function buildBookingEmailSummarySections(
  booking: BookingRequest,
  context: BookingEmailSummaryContext | undefined,
  timing: EmailSummaryTiming,
): EmailSummarySection[] {
  // Email rifiuto: nessun riepilogo dettagliato (solo copy nel template).
  if (timing === 'rejected') {
    return []
  }

  const modes = context?.modes ?? []
  const customStaffPresets = context?.customStaffPresets ?? []
  const menuCategories = context?.menuCategories ?? []

  const mode = modes.find((m) => m.booking_type === booking.booking_type && m.enabled)
  const activeSubTab = resolveSubTabFromBooking(booking, mode, customStaffPresets)
  const rawSubTab =
    activeSubTab && mode?.sub_tabs
      ? (mode.sub_tabs.find((t) => t.id === activeSubTab.id) ?? null)
      : null
  const subTabForCarousel = (rawSubTab ?? activeSubTab) as SubTab | null

  const linkedPreset =
    activeSubTab?.preset_id != null
      ? customStaffPresets.find((p) => p.id === activeSubTab.preset_id) ?? null
      : null

  const hasMenu = activeSubTab
    ? activeSubTabShowsMenu(activeSubTab, linkedPreset)
    : modeUsesMenu(mode ?? { booking_type: booking.booking_type })

  const items = booking.menu_selection?.items ?? []
  const totalPerPerson = booking.menu_total_per_person ?? 0
  const totalBooking = booking.menu_total_booking ?? 0
  const presetPricePerPerson = getSubTabPricePerPerson(subTabForCarousel)
  const hasPresetPrice = presetPricePerPerson != null
  const showIngredientPrices = presetPricePerPerson == null
  const isCarouselSummary = activeSubTab?.display === 'carousel'
  const showMenuPrices = hasPresetPrice || totalPerPerson > 0
  const showTotals = showMenuPrices && totalPerPerson > 0 && (hasMenu || isCarouselSummary)

  const carouselSummaryDisplay = isCarouselSummary
    ? resolveCarouselSummaryDisplay(subTabForCarousel)
    : null

  const subTabLabel = activeSubTab?.label?.trim() ?? ''
  const showCarouselOfferDetails =
    isCarouselSummary && getShowOfferDetailsInSummary(subTabForCarousel)
  const showTipoRow = isCarouselSummary ? showCarouselOfferDetails && subTabLabel.length > 0 : true
  const tipoValue = isCarouselSummary
    ? subTabLabel
    : getModeLabelByType(modes, booking.booking_type)
  const showOpzioneMenu =
    activeSubTab &&
    (isCarouselSummary
      ? showCarouselOfferDetails && subTabLabel.length > 0
      : subTabLabel.length > 0 ||
        (activeSubTab.price_per_person != null && activeSubTab.price_per_person > 0))

  const sections: EmailSummarySection[] = []
  const { date, time } = resolveDateAndTime(booking, timing)

  if (date) sections.push({ kind: 'row', label: 'Data', value: date })
  if (time) sections.push({ kind: 'row', label: 'Orario', value: time })
  if (booking.num_guests > 0) {
    sections.push({
      kind: 'row',
      label: 'Ospiti',
      value: `${booking.num_guests} persone`,
    })
  }

  if (showTipoRow && tipoValue && tipoValue !== '—') {
    sections.push({ kind: 'row', label: 'Tipo', value: tipoValue })
  }

  if (showOpzioneMenu && activeSubTab && subTabLabel) {
    sections.push({ kind: 'opzione_menu', label: 'Opzione menu', value: subTabLabel })
  }

  if (carouselSummaryDisplay) {
    if (carouselSummaryDisplay.kind === 'titles') {
      sections.push({
        kind: 'offerta_carosello_titles',
        label: 'Offerta selezionata',
        titles: carouselSummaryDisplay.titles,
      })
    } else {
      const priceLine = formatCurrency(carouselSummaryDisplay.amount)
      if (priceLine) {
        sections.push({
          kind: 'offerta_carosello_price',
          value: `${priceLine}/persona`,
        })
      }
    }
  }

  if (hasMenu && items.length > 0) {
    const categoryLabelByKey = new Map(menuCategories.map((c) => [c.key, c.label]))
    const sorted = sortMenuItems(items, menuCategories, activeSubTab?.category_order_keys)
    const menuItems: EmailSummaryMenuItem[] = sorted.map((item) => {
      const row: EmailSummaryMenuItem = { name: item.name }
      const catLabel = categoryLabelByKey.get(item.category)
      if (catLabel) row.categoryLabel = catLabel
      if (showMenuPrices && showIngredientPrices && item.price > 0) {
        row.price = formatCurrency(item.price) ?? undefined
      }
      return row
    })
    sections.push({ kind: 'menu_items', label: 'Il tuo menu', items: menuItems })
  }

  if (showTotals) {
    const perPersonFormatted = formatCurrency(totalPerPerson)
    if (perPersonFormatted) {
      sections.push({
        kind: 'totals',
        totalPerPersonLine:
          hasPresetPrice && booking.num_guests > 0
            ? `${perPersonFormatted} x ${booking.num_guests} ospiti`
            : perPersonFormatted,
        totalBookingLabel: booking.num_guests > 0 ? 'Totale' : undefined,
        totalBookingValue:
          booking.num_guests > 0 ? formatCurrency(totalBooking) ?? undefined : undefined,
      })
    }
  }

  const dietaryText = dietaryRestrictionsToText(booking.dietary_restrictions)
  if (dietaryText.trim()) {
    sections.push({ kind: 'intolleranze', label: 'Intolleranze', value: dietaryText })
  }

  const clientNotes = stripSubTabAutoPrefix(booking.special_requests, subTabLabel)
  if (clientNotes) {
    sections.push({ kind: 'note', label: 'Note', value: clientNotes })
  }

  return sections
}

export function buildBookingEmailSummaryHtml(
  booking: BookingRequest,
  context: BookingEmailSummaryContext | undefined,
  timing: EmailSummaryTiming,
): string {
  const sections = buildBookingEmailSummarySections(booking, context, timing)
  if (sections.length === 0) {
    return ''
  }

  const parts: string[] = []

  for (const section of sections) {
    switch (section.kind) {
      case 'row':
      case 'opzione_menu':
      case 'intolleranze':
      case 'note':
        if (section.label && section.value) {
          parts.push(`
          <div class="info-row">
            <span class="info-label">${escapeHtml(section.label)}:</span>
            <span class="info-value"><strong>${escapeHtml(section.value)}</strong></span>
          </div>`)
        }
        break
      case 'offerta_carosello_titles':
        if (section.titles?.length) {
          parts.push(`
          <div class="summary-block">
            <p class="summary-heading">${escapeHtml(section.label ?? 'Offerta selezionata')}</p>
            <ul class="summary-list">
              ${section.titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
            </ul>
          </div>`)
        }
        break
      case 'offerta_carosello_price':
        if (section.value) {
          parts.push(`
          <div class="info-row">
            <span class="info-value"><strong>${escapeHtml(section.value)}</strong></span>
          </div>`)
        }
        break
      case 'menu_items':
        if (section.items?.length) {
          parts.push(`
          <div class="summary-block">
            <p class="summary-heading">${escapeHtml(section.label ?? 'Il tuo menu')}</p>
            <ul class="summary-list menu-list">
              ${section.items
                .map((item) => {
                  const name = item.categoryLabel
                    ? `<span class="cat">${escapeHtml(item.categoryLabel)}: </span>${escapeHtml(item.name)}`
                    : escapeHtml(item.name)
                  const price = item.price
                    ? `<span class="menu-price">${escapeHtml(item.price)}</span>`
                    : ''
                  return `<li class="menu-item">${name}${price}</li>`
                })
                .join('')}
            </ul>
          </div>`)
        }
        break
      case 'totals':
        if (section.totalPerPersonLine) {
          parts.push(`<p class="total-line"><strong>${escapeHtml(section.totalPerPersonLine)}</strong></p>`)
        }
        if (section.totalBookingLabel && section.totalBookingValue) {
          parts.push(`
          <div class="info-row">
            <span class="info-label">${escapeHtml(section.totalBookingLabel)}</span>
            <span class="info-value total-booking"><strong>${escapeHtml(section.totalBookingValue)}</strong></span>
          </div>`)
        }
        break
      default:
        break
    }
  }

  return `<div class="info-box">${parts.join('')}</div>`
}
