import React, { useState } from 'react'
import type { BookingRequest } from '@/types/booking'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Calendar,
  Clock,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  UtensilsCrossed,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Wine,
  PartyPopper,
  GraduationCap,
  CalendarClock,
  BookOpen,
  Tag,
} from 'lucide-react'
import { DEFAULT_BOOKING_FORM_CONFIG } from '../constants/bookingPublicFormConfig'
import { getBookingEventTypeLabel } from '../utils/eventTypeLabels'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import { getPresetMenuLabel } from '../constants/presetMenus'
import type { PresetMenuType } from '../constants/presetMenus'
import { getMenuPriceDisplayFromBooking, getResolvedMenuPriceDisplay } from '../utils/menuPricing'
import { formatBookingDateTime } from '../utils/formatDateTime'
import { cn } from '@/lib/utils'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import {
  resolveMenuPromoLabelsForBooking,
} from '../constants/menuPromo'
import {
  formatDietaryGuestCountLabel,
  shouldShowDietaryGuestCount,
} from '../utils/dietaryRestrictionsText'
import {
  stripSubTabAutoPrefix,
} from '../utils/buildBookingEmailSummary'

interface BookingRequestCardProps {
  booking: BookingRequest
  onAccept: (booking: BookingRequest) => void
  onReject: (booking: BookingRequest) => void
  acceptDisabled?: boolean
  rejectDisabled?: boolean
}

/** Badge digest allineato ad ArchiveTab / ArchiveBookingCard */
const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'Pendente', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  accepted: { label: 'Accettata', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  rejected: { label: 'Rifiutata', bgColor: 'bg-red-100', textColor: 'text-red-800' },
}


/** Stesso tema ice delle card archivio / digest calendario. */
const DIGEST_MENU_HEADING_GRADIENT_BG =
  'border border-primary-200/90 bg-gradient-to-r from-primary-50 via-white to-primary-50/40'

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof UtensilsCrossed }> = {
  cena: { icon: UtensilsCrossed },
  aperitivo: { icon: Wine },
  evento: { icon: PartyPopper },
  laurea: { icon: GraduationCap },
}

/** menu_prezzo_fisso → libro aperto; tavolo → icona da event_type (come prima). */
const BOOKING_TYPE_DIGEST_ICON: Record<string, React.ElementType> = {
  menu_prezzo_fisso: BookOpen,
  rinfresco_laurea: GraduationCap,
}

/** Spazio dopo «:» (EN SPACE ≈ metà di EM) */
const AFTER_COLON = '\u2002'

export const BookingRequestCard: React.FC<BookingRequestCardProps> = ({
  booking,
  onAccept,
  onReject,
  acceptDisabled = false,
  rejectDisabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const bookingModes =
    bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes
  const { data: customStaffPresets = [] } = useRestaurantSetting('booking_custom_staff_presets')
  const { data: menuPromos = [] } = useRestaurantSetting('booking_menu_promos')

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: it })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'Non specificato'
    // Rimuovi i secondi se presenti (formato HH:MM:SS -> HH:MM)
    return timeStr.split(':').slice(0, 2).join(':')
  }

  const eventTypeLabel = getBookingEventTypeLabel(booking, bookingModes)
  const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending
  const menuPriceDisplay = getMenuPriceDisplayFromBooking(booking)
  const digestMenuPrice =
    bookingTypeUsesMenuSelections(booking.booking_type) ? getResolvedMenuPriceDisplay(booking) : null
  const creationDateLabel = formatBookingDateTime(booking.created_at)

  const formatRequestSubmittedAt = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      return format(new Date(dateStr), 'd MMMM yyyy, HH:mm', { locale: it })
    } catch {
      return String(dateStr)
    }
  }

  const eventConfig =
    booking.event_type && EVENT_TYPE_CONFIG[booking.event_type] ? EVENT_TYPE_CONFIG[booking.event_type] : null
  const EventIcon = eventConfig?.icon ?? UtensilsCrossed
  const DigestIcon =
    (booking.booking_type && BOOKING_TYPE_DIGEST_ICON[booking.booking_type]) ?? EventIcon

  const showDigestStrip = Boolean(eventTypeLabel)
  const menuPromoLabels = resolveMenuPromoLabelsForBooking(booking, menuPromos)

  const cleanedSpecialRequests = stripSubTabAutoPrefix(booking.special_requests)

  const phoneDigestRow = booking.client_phone ? (
    <div className="flex items-center gap-2">
      <Phone className="h-4 w-4 shrink-0 text-primary-500" />
      <span className="min-w-0 break-words text-base font-semibold text-primary-900">
        {booking.client_phone}
      </span>
    </div>
  ) : null

  return (
    <div className="relative">
      {showDigestStrip && (
        <div className="mb-2">
          <span
            className={`inline-block max-w-full whitespace-normal px-4 py-2 text-xs font-semibold shadow-none transition-all duration-300 ${DIGEST_MENU_HEADING_GRADIENT_BG}`}
          >
            <span className="block text-sm font-semibold text-primary-900">{eventTypeLabel}</span>
          </span>
        </div>
      )}

      <div className="booking-request-card-shell overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <div
          className={cn(
            'booking-request-collapse-header',
            !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl',
          )}
        >
          <div
            className={cn(
              'booking-request-collapse-header-gradient bg-gradient-to-br from-primary-50/90 via-white to-[var(--color-surface-2)]',
              !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl',
            )}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'booking-request-digest-trigger relative z-0 w-full cursor-pointer border-0 bg-transparent p-6 text-left outline-none ring-0',
                'transition-colors duration-[220ms] hover:bg-[var(--color-surface-2)]/85 active:scale-[0.995]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl',
              )}
            >
              <div className="w-full min-w-0">
                <div className="flex w-full min-w-0 flex-col gap-3">
                  {/* Riga 1: icona tipologia + badge + chevron in-flow */}
                  <div className="flex w-full items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary-200 bg-[var(--color-bg)] shadow-md">
                      <DigestIcon className="h-4 w-4 text-primary-500" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1" />
                    <span
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                    >
                      {statusConfig.label}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-6 w-6 text-primary-700" aria-hidden />
                    ) : (
                      <ChevronDown className="h-6 w-6 text-primary-700" aria-hidden />
                    )}
                  </div>

                  {/* Righe dati: larghezza piena, nessun affiancamento con icona */}
                  <div className="min-w-0 w-full text-left">
                    <div className="grid grid-cols-1 gap-x-6 gap-y-3 min-[659px]:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <User className="h-4 w-4 shrink-0 text-primary-500" />
                          <span className="min-w-0 break-words text-sm font-semibold text-primary-900 sm:text-base">
                            {booking.client_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 shrink-0 text-primary-500" />
                          <span className="text-sm font-semibold text-primary-900 sm:text-base">
                            {formatDate(booking.desired_date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0 text-primary-500" />
                          <span className="text-sm font-semibold text-primary-900 sm:text-base">
                            {formatTime(booking.desired_time)}
                          </span>
                        </div>
                        {menuPromoLabels.length > 0 && (
                          <div className="flex min-w-0 w-full items-start gap-2">
                            <Tag className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden />
                            <span className="min-w-0 flex-1 break-words text-sm italic leading-snug text-gray-700">
                              Promo visualizzate da cliente :{' '}
                              {menuPromoLabels.join(', ')}
                            </span>
                          </div>
                        )}
                        {phoneDigestRow ? <div className="min-[659px]:hidden">{phoneDigestRow}</div> : null}
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div className="hidden min-[659px]:flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-primary-500" />
                          <span className="text-sm font-semibold text-primary-900 sm:text-base">
                            {booking.num_guests} ospiti
                          </span>
                        </div>
                        {phoneDigestRow ? (
                          <div className="hidden min-[659px]:block">{phoneDigestRow}</div>
                        ) : null}
                        {cleanedSpecialRequests && (
                          <div className="flex min-w-0 w-full items-start gap-2">
                            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                            <span className="line-clamp-2 min-w-0 flex-1 text-sm italic text-gray-700">
                              {cleanedSpecialRequests}
                            </span>
                          </div>
                        )}
                        {digestMenuPrice && (
                          <div className="flex min-w-0 w-full items-start gap-2">
                            <UtensilsCrossed className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden />
                            <span className="min-w-0 flex-1 break-words text-sm italic leading-snug text-gray-700">
                              Menù :{AFTER_COLON}
                              {digestMenuPrice.prezzoMenuLabel}
                            </span>
                          </div>
                        )}
                        <div className="flex min-w-0 w-full items-start gap-2">
                          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                          <span className="line-clamp-2 min-w-0 flex-1 break-words text-sm italic text-gray-700">
                            {booking.client_email}
                          </span>
                        </div>
                        <div className="flex min-[659px]:hidden items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-primary-500" />
                          <span className="text-sm font-semibold text-primary-900 sm:text-base">
                            {booking.num_guests} ospiti
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>


                  {booking.created_at && (
                    <div className="flex min-w-0 w-full items-start gap-2">
                      <CalendarClock
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary-500"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 basis-0 text-sm leading-normal break-normal text-gray-600">
                        <span className="font-medium text-gray-500">
                          Ricevuta il :{AFTER_COLON}
                        </span>
                        <span className="text-gray-600">{formatRequestSubmittedAt(booking.created_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

      {isExpanded && (
        <div className="booking-request-expanded-panel rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all duration-300 ease-in-out md:p-6">
          {!booking.created_at && creationDateLabel && (
            <p className="pb-3 text-[1em] leading-normal">
              <span className="font-medium text-gray-500">Richiesta di prenotazione effettuata il :</span>
              {AFTER_COLON}
              <span className="font-medium text-gray-900">{creationDateLabel}</span>
            </p>
          )}

          {/* Menu Info - Solo per Rinfresco di Laurea */}
          {bookingTypeUsesMenuSelections(booking.booking_type) && booking.menu_selection && (
            <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
              <p className="mb-3 text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">Menu Selezionato</p>
              
              {/* Mostra Menu Predefinito se presente */}
              {booking.preset_menu && (
                <div className="mb-3 rounded-lg border border-primary-200 bg-primary-50 p-2">
                  <p className="font-semibold text-primary-800">
                    📋 Menu Predefinito:{AFTER_COLON}
                    {getPresetMenuLabel(booking.preset_menu as PresetMenuType, customStaffPresets)}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                {menuPriceDisplay && (
                  <>
                    <p className="font-bold text-primary-900">
                      <span className="text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">
                        Prezzo Menù:
                      </span>
                      {AFTER_COLON}
                      <span className="text-primary-900">
                        {menuPriceDisplay.prezzoMenuLabel}
                        {menuPriceDisplay.breakdownLabel && (
                          <span className="text-gray-600 ml-2">{menuPriceDisplay.breakdownLabel}</span>
                        )}
                      </span>
                    </p>
                    {menuPriceDisplay.prezzoTotaleLabel && (
                      <p className="font-bold text-primary-900">
                        <span className="text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">
                          Prezzo Totale:
                        </span>
                        {AFTER_COLON}
                        <span className="text-primary-900">{menuPriceDisplay.prezzoTotaleLabel}</span>
                      </p>
                    )}
                  </>
                )}
                {Array.isArray(booking.menu_selection?.items) && booking.menu_selection.items.length > 0 && (
                  <div className="text-gray-700">
                    <p className="mb-1 font-semibold">Prodotti:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {booking.menu_selection.items.map((item: any, idx: number) => {
                        const quantityLabel = item.quantity ? ` - ${item.quantity} Kg` : ''
                        const priceValue =
                          typeof item.totalPrice === 'number' && item.totalPrice > 0
                            ? item.totalPrice
                            : item.price

                        return (
                          <li key={idx}>
                            {item.name}
                            {quantityLabel}
                            {' - €'}
                            {priceValue?.toFixed ? priceValue.toFixed(2) : Number(priceValue || 0).toFixed(2)}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intolleranze — con consenso esplicito art. 9 GDPR */}
          {booking.dietary_data_consent === true && Array.isArray(booking.dietary_restrictions) && booking.dietary_restrictions.length > 0 && (
            <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">Intolleranze Alimentari</p>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[0.72em] font-bold text-green-700">Consenso esplicito</span>
              </div>
              <div className="space-y-2">
                {booking.dietary_restrictions.map((restriction: any, idx: number) => (
                  <p key={idx} className="text-gray-700">
                    <span className="font-semibold">
                      {restriction.restriction === 'Altro' && restriction.notes
                        ? restriction.notes
                        : restriction.restriction}
                    </span>
                    {shouldShowDietaryGuestCount(restriction) && (
                      <>
                        {' — '}
                        {formatDietaryGuestCountLabel(restriction.guest_count)}
                      </>
                    )}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Intolleranze — cliente non ha autorizzato trattamento dati art. 9 */}
          {booking.dietary_off_platform_notice === true && (
            <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">Intolleranze Alimentari</p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[0.72em] font-bold text-red-700">Consenso non fornito</span>
              </div>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ Il cliente ha intolleranze o allergie alimentari, ma non ha autorizzato il trattamento dei dati. contattare il cliente per maggiori info
              </p>
            </div>
          )}

          {/* Promo visibili al cliente al momento della richiesta */}
          {menuPromoLabels.length > 0 && (
            <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
              <p className="mb-3 text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">
                Promo visualizzate da cliente
              </p>
              <p className="text-gray-700">{menuPromoLabels.join(', ')}</p>
            </div>
          )}

          {/* Note Richieste Speciali - Fuori dalla griglia */}
          {cleanedSpecialRequests && (
            <div className="pt-6 mt-6 border-t border-[var(--color-border)]">
              <p className="mb-3 text-[0.82em] font-semibold tracking-wide text-gray-500 uppercase">Richieste Speciali</p>
              <p className="leading-snug text-gray-700">
                {cleanedSpecialRequests}
              </p>
            </div>
          )}

          {/* Azioni con Bottoni Moderni */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => onAccept(booking)}
              disabled={acceptDisabled}
              className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[1em] font-medium text-white shadow-sm transition-all duration-200 active:scale-95 bg-[var(--color-success)] hover:bg-[#059669] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle className="h-6 w-6" />
              {acceptDisabled ? 'Accettazione…' : 'Accetta Prenotazione'}
            </button>
            <button
              type="button"
              onClick={() => onReject(booking)}
              disabled={rejectDisabled}
              className="booking-request-reject-booking-btn flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-[1em] font-semibold shadow-sm transition-colors duration-200 active:scale-[0.98] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <XCircle className="h-6 w-6" />
              Rifiuta
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}






