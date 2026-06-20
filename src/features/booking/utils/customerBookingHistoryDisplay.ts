import type { BookingRequest } from '@/types/booking'
import {
  resolveCarouselSummaryDisplay,
  type BookingMode,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'
import { getModeLabelByType } from '@/features/booking/utils/bookingModeLabels'
import { resolveSubTabFromBooking } from '@/features/booking/utils/buildBookingEmailSummary'
import { dietaryRestrictionsToText } from '@/features/booking/utils/dietaryRestrictionsText'
import { formatItalianDateDisplay } from '@/features/booking/utils/formatItalianDateDisplay'

export const DIETARY_NO_CONSENT_MESSAGE =
  'Il cliente non ha autorizzato il salvataggio dei dati presso la piattaforma.'

export function sortBookingsByCreatedAtDesc(bookings: BookingRequest[]): BookingRequest[] {
  return [...bookings].sort((a, b) => {
    const cmp = (b.created_at ?? '').localeCompare(a.created_at ?? '')
    if (cmp !== 0) return cmp
    return b.id.localeCompare(a.id)
  })
}

export function hasDietaryRestrictionsFilled(
  booking: Pick<BookingRequest, 'dietary_restrictions'>,
): boolean {
  return dietaryRestrictionsToText(booking.dietary_restrictions).trim().length > 0
}

export function resolveBookingTypeLabel(
  booking: Pick<BookingRequest, 'booking_type' | 'event_type'>,
  modes: BookingMode[],
): string {
  if (booking.booking_type) {
    const label = getModeLabelByType(modes, booking.booking_type)
    if (label && label !== '—') return label
    return booking.booking_type.replace(/_/g, ' ')
  }
  if (booking.event_type) return booking.event_type.replace(/_/g, ' ')
  return '—'
}

/** Label card carosello — solo se euristica non ambigua (resolveSubTabFromBooking). */
export function resolveCarouselCardLabel(
  booking: Pick<BookingRequest, 'booking_type' | 'preset_menu' | 'special_requests'>,
  modes: BookingMode[],
  customStaffPresets: CustomStaffPreset[],
): string | null {
  const mode = modes.find((m) => m.booking_type === booking.booking_type && m.enabled)
  const activeSubTab = resolveSubTabFromBooking(booking, mode, customStaffPresets)
  if (!activeSubTab || activeSubTab.display !== 'carousel') return null

  const rawSubTab = mode?.sub_tabs?.find((t) => t.id === activeSubTab.id) ?? null
  const subTabForCarousel = (rawSubTab ?? activeSubTab) as SubTab
  const carouselDisplay = resolveCarouselSummaryDisplay(subTabForCarousel)

  if (carouselDisplay?.kind === 'titles' && carouselDisplay.titles.length > 0) {
    return carouselDisplay.titles.join(' · ')
  }

  const label = activeSubTab.label?.trim()
  return label || null
}

export function formatBookingAmount(amount?: number | null): string | null {
  if (amount == null || amount <= 0) return null
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export interface CustomerBookingHistoryRow {
  id: string
  bookingTypeLabel: string
  carouselCardLabel: string | null
  numGuests: number
  createdAtLabel: string
  desiredDateLabel: string
  amountLabel: string | null
  hasDietary: boolean
  dietaryConsent: boolean
  dietaryText: string
}

export function buildCustomerBookingHistoryRow(
  booking: BookingRequest,
  modes: BookingMode[],
  customStaffPresets: CustomStaffPreset[],
): CustomerBookingHistoryRow {
  return {
    id: booking.id,
    bookingTypeLabel: resolveBookingTypeLabel(booking, modes),
    carouselCardLabel: resolveCarouselCardLabel(booking, modes, customStaffPresets),
    numGuests: booking.num_guests ?? 0,
    createdAtLabel: formatItalianDateDisplay(booking.created_at),
    desiredDateLabel: formatItalianDateDisplay(booking.desired_date),
    amountLabel: formatBookingAmount(booking.menu_total_booking),
    hasDietary: hasDietaryRestrictionsFilled(booking) || booking.dietary_off_platform_notice === true,
    dietaryConsent: booking.dietary_data_consent === true,
    dietaryText: dietaryRestrictionsToText(booking.dietary_restrictions),
  }
}
