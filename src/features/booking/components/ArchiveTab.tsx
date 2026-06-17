import React, { useState } from 'react'
import { useAllBookings } from '../hooks/useBookingQueries'
import { useRestoreBooking, useRequeueRejectedBooking } from '../hooks/useBookingMutations'
import { BookingDangerActionModal } from './BookingDangerActionModal'
import { RestoreBookingTimeModal } from './RestoreBookingTimeModal'
import type { BookingRequest } from '@/types/booking'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Calendar,
  CalendarClock,
  Clock,
  Users,
  Mail,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  User,
  UtensilsCrossed,
  Wine,
  PartyPopper,
  GraduationCap,
  Archive,
  CheckCircle,
  XCircle,
  Trash2,
  RotateCcw,
  BookOpen,
} from 'lucide-react'
import { extractTimeFromISO } from '../utils/dateUtils'
import { DEFAULT_BOOKING_FORM_CONFIG } from '../constants/bookingPublicFormConfig'
import { getBookingEventTypeLabel } from '../utils/eventTypeLabels'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

const AFTER_COLON = '\u2002'

export type ArchiveFilter = 'all' | 'accepted' | 'rejected' | 'deleted'
export type SortOrder = 'created_at' | 'booking_date'

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType }> = {
  cena: { icon: UtensilsCrossed },
  aperitivo: { icon: Wine },
  evento: { icon: PartyPopper },
  laurea: { icon: GraduationCap },
}

/** Digest: solo booking_type con icona dedicata; tavolo → come prima (event_type / posate). */
const BOOKING_TYPE_DIGEST_ICON: Record<string, React.ElementType> = {
  menu_prezzo_fisso: BookOpen,
  rinfresco_laurea: GraduationCap,
}

const STATUS_LABELS: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'Pendente', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  accepted: { label: 'Accettata', bgColor: 'bg-green-100', textColor: 'text-green-800' },
  rejected: { label: 'Rifiutata', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  /** Stesso linguaggio cromatico di «Rifiutata» (digest + badge). */
  deleted: { label: 'Rimossa', bgColor: 'bg-red-100', textColor: 'text-red-800' },
}

interface ArchiveBookingCardProps {
  booking: any
  onViewInCalendar?: (date: string) => void
  onRestore?: (booking: BookingRequest) => void
  onRequeueToPending?: (bookingId: string) => void
}

/** Strip tipo evento sopra card archivio — tema ice (coerente digest calendario). */
const DIGEST_MENU_HEADING_GRADIENT_BG =
  'border border-primary-200/90 bg-gradient-to-r from-primary-50 via-white to-primary-50/40'


const ArchiveBookingCard: React.FC<ArchiveBookingCardProps> = ({
  booking,
  onViewInCalendar,
  onRestore,
  onRequeueToPending,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const bookingModes =
    bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: it })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return 'Non specificato'
    return timeStr.split(':').slice(0, 2).join(':')
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Non disponibile'
    try {
      return format(new Date(dateStr), 'd MMM yyyy, HH:mm', { locale: it })
    } catch {
      return dateStr
    }
  }

  const formatRequestSubmittedAt = (dateStr?: string) => {
    if (!dateStr) return 'Non disponibile'
    try {
      return format(new Date(dateStr), 'd MMMM yyyy, HH:mm', { locale: it })
    } catch {
      return dateStr
    }
  }


  const eventTypeLabel = getBookingEventTypeLabel(booking, bookingModes)
  // Usa eventConfig solo se event_type è valido, altrimenti usa valori di default
  const eventConfig = booking.event_type && EVENT_TYPE_CONFIG[booking.event_type] 
    ? EVENT_TYPE_CONFIG[booking.event_type] 
    : null
  const EventIcon = eventConfig?.icon || UtensilsCrossed
  const DigestIcon =
    (booking.booking_type && BOOKING_TYPE_DIGEST_ICON[booking.booking_type]) || EventIcon
  const statusConfig = STATUS_LABELS[booking.status] || STATUS_LABELS.pending

  const displayDate = booking.confirmed_start || booking.desired_date
  // ✅ FIX: Per prenotazioni accettate, usa confirmed_start invece di desired_time
  // Questo preserva l'orario esatto inserito dall'utente senza conversioni timezone
  const displayTime = booking.confirmed_start
    ? extractTimeFromISO(booking.confirmed_start)
    : booking.desired_time || 'Non specificato'

  const showDigestStrip = Boolean(eventTypeLabel)

  const deletedDigest = booking.status === 'deleted'
  const digestBodyText = deletedDigest ? 'text-red-800' : 'text-primary-900'
  const digestBodyIcon = deletedDigest ? 'text-red-700' : 'text-primary-500'
  const digestSecondaryText = deletedDigest ? 'text-red-800' : 'text-gray-700'

  const phoneDigestRow = booking.client_phone ? (
    <div className="flex items-center gap-2">
      <Phone className={cn('h-4 w-4 shrink-0', digestBodyIcon)} />
      <span className={cn('min-w-0 break-words text-base font-semibold', digestBodyText)}>
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
          className={cn('booking-request-collapse-header', !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl')}
        >
          <div
            className={cn(
              'booking-request-collapse-header-gradient bg-gradient-to-br from-primary-50/90 via-white to-[var(--color-surface-2)]',
              !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl'
            )}
          >
      {/* Header Collapsible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'booking-request-digest-trigger relative z-0 w-full cursor-pointer border-0 bg-transparent p-6 text-left outline-none ring-0',
          'transition-colors duration-[220ms] hover:bg-[var(--color-surface-2)]/85 active:scale-[0.995]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          !isExpanded ? 'rounded-2xl' : 'rounded-t-2xl'
        )}
      >
              <div className="relative w-full min-w-0">
                <div className="pointer-events-none absolute right-0 top-0 z-10 flex flex-col items-end gap-2">
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

                <div className="flex w-full min-w-0 flex-col gap-3">
                  <div className="flex min-w-0 w-full items-start gap-4 pr-29">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-[var(--color-bg)] shadow-md',
                        deletedDigest ? 'border-red-200/90' : 'border-primary-200'
                      )}
                    >
                      <DigestIcon className={cn('h-4 w-4', digestBodyIcon)} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-3 min-[659px]:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <User className={cn('h-4 w-4 shrink-0', digestBodyIcon)} />
                            <span className={cn('min-w-0 break-words text-base font-semibold', digestBodyText)}>
                              {booking.client_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className={cn('h-4 w-4 shrink-0', digestBodyIcon)} />
                            <span className={cn('text-base font-semibold', digestBodyText)}>
                              {formatDate(displayDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className={cn('h-4 w-4 shrink-0', digestBodyIcon)} />
                            <span className={cn('text-base font-semibold', digestBodyText)}>
                              {formatTime(displayTime)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className={cn('h-4 w-4 shrink-0', digestBodyIcon)} />
                            <span className={cn('text-base font-semibold', digestBodyText)}>
                              {booking.num_guests} ospiti
                            </span>
                          </div>
                          {phoneDigestRow ? (
                            <div className="min-[659px]:hidden">{phoneDigestRow}</div>
                          ) : null}
                        </div>

                        <div
                          className={cn(
                            'min-w-0 space-y-3',
                            /* Mobile: recupera inset digest (icona+gutter) + stessa fascia del pr-29 della row, così email/note larghi come Ricevuta */
                            'max-[599px]:-ml-12 max-[599px]:w-[calc(100%+3rem+7.25rem)]',
                          )}
                        >
                          {phoneDigestRow ? (
                            <div className="hidden min-[659px]:block">{phoneDigestRow}</div>
                          ) : null}
                          <div className="flex min-w-0 w-full items-start gap-2">
                            <Mail className={cn('mt-0.5 h-4 w-4 shrink-0', digestBodyIcon)} />
                            <span
                              className={cn(
                                'line-clamp-2 max-[599px]:line-clamp-none min-w-0 flex-1 break-words text-sm italic',
                                digestSecondaryText
                              )}
                            >
                              {booking.client_email}
                            </span>
                          </div>
                          {booking.special_requests && (
                            <div className="flex min-w-0 w-full items-start gap-2">
                              <MessageSquare className={cn('mt-0.5 h-4 w-4 shrink-0', digestBodyIcon)} />
                              <span
                                className={cn(
                                  'line-clamp-2 max-[599px]:line-clamp-none min-w-0 flex-1 text-sm italic',
                                  digestSecondaryText
                                )}
                              >
                                {booking.special_requests}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {booking.created_at && (
                    <div className="flex min-w-0 w-full items-start gap-2">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden />
                      <div className="min-w-0 flex-1 basis-0 text-sm leading-normal break-normal text-gray-600">
                        <span className="font-medium text-gray-500">Ricevuta il :{AFTER_COLON}</span>
                        <span className="text-gray-600">{formatRequestSubmittedAt(booking.created_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
      </button>
          </div>
        </div>

      {/* Contenuto Espandibile */}
      {isExpanded && (
        <div className="animate-slideDown rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-6">
          {/* Dati Organizzati - Responsive: 1 colonna su mobile, 2 su desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 md:gap-y-3">
            {/* Nome */}
            <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
              <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Nome:</span>
              <span className="text-sm md:text-base font-semibold text-primary-900 break-words">{booking.client_name}</span>
            </div>

            {/* Email */}
            <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
              <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Email:</span>
              <span className="text-sm md:text-base font-semibold text-primary-900 break-all">{booking.client_email}</span>
            </div>

            {/* Telefono */}
            {booking.client_phone && (
              <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
                <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Telefono:</span>
                <span className="text-sm md:text-base font-semibold text-primary-900">{booking.client_phone}</span>
              </div>
            )}

            {/* Data */}
            <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
              <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Data:</span>
              <span className="text-sm md:text-base font-semibold text-primary-900">{formatDate(displayDate)}</span>
            </div>

            {/* Orario */}
            <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
              <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Orario:</span>
              <span className="text-sm md:text-base font-semibold text-primary-900">{formatTime(displayTime)}</span>
            </div>

            {/* Pax */}
            <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">
              <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Pax:</span>
              <span className="text-sm md:text-base font-semibold text-primary-900">{booking.num_guests}</span>
            </div>

                        {/* Tipo - Mostra solo se esiste un valore valido */}
            {eventTypeLabel && (
              <div className="flex flex-row items-start gap-3 py-1.5 md:py-2">  
                <span className="text-xs text-gray-500 w-24 md:w-28 font-medium uppercase tracking-wide flex-shrink-0">Tipo:</span>
                <span className="text-sm md:text-base font-semibold text-primary-900">{eventTypeLabel}</span>
              </div>
            )}

          </div>

          {/* Note Richieste Speciali - Fuori dalla griglia */}
          {booking.special_requests && (
            <div className="pt-4 md:pt-6 mt-4 md:mt-6 border-t border-[var(--color-border)]">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2 md:mb-3">Richieste Speciali</p>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed break-words">
                {booking.special_requests}
              </p>
            </div>
          )}

          {/* Motivo rifiuto se presente */}
          {booking.rejection_reason && (
            <div className="pt-4 md:pt-6 mt-4 md:mt-6 border-t border-red-300/30">
              <p className="text-xs text-red-600 uppercase tracking-wide font-semibold mb-2 md:mb-3">Motivo Rifiuto</p>
              <p className="text-sm md:text-base text-red-700 leading-relaxed break-words">
                {booking.rejection_reason}
              </p>
            </div>
          )}

          {/* Motivo cancellazione se presente */}
          {booking.status === 'deleted' && booking.cancellation_reason && (
            <div className="pt-4 md:pt-6 mt-4 md:mt-6 border-t border-gray-300/30">
              <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-2 md:mb-3">Motivo Eliminazione</p>
              <p className="text-sm md:text-base text-gray-700 leading-relaxed break-words">
                {booking.cancellation_reason}
              </p>
            </div>
          )}

          {/* Data cancellazione se presente */}
          {booking.status === 'deleted' && booking.cancelled_at && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 italic">
                Eliminata il: {formatDateTime(booking.cancelled_at)}
              </p>
            </div>
          )}

          {/* Pulsante Reinserisci — eliminate: torna accepted in calendario (con orari salvati o inseriti al volo) */}
          {booking.status === 'deleted' && onRestore && (
            <div className="flex flex-col gap-2 pt-3 md:pt-4 border-t border-[var(--color-border)] mt-4 md:mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore(booking)
                }}
                style={{ backgroundColor: '#0891b2', color: 'white' }}
                className="flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 hover:bg-cyan-700 font-bold text-sm md:text-lg shadow-xl rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                <span>Reinserisci</span>
              </button>
            </div>
          )}

          {/* Rifiutata → pending (richieste in attesa), stesso look del Reinserisci */}
          {booking.status === 'rejected' && onRequeueToPending && (
            <div className="flex gap-2 md:gap-4 pt-3 md:pt-4 border-t border-[var(--color-border)] mt-4 md:mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRequeueToPending(booking.id)
                }}
                style={{ backgroundColor: '#0891b2', color: 'white' }}
                className="flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 hover:bg-cyan-700 font-bold text-sm md:text-lg shadow-xl rounded-xl transition-all"
              >
                <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                <span>Riporta in attesa</span>
              </button>
            </div>
          )}

          {/* Pulsante Visualizza nel Calendario - Solo per prenotazioni accettate */}
          {booking.status === 'accepted' && booking.confirmed_start && onViewInCalendar && (() => {
            // Estrai data da confirmed_start senza conversioni timezone
            const dateMatch = booking.confirmed_start.match(/(\d{4})-(\d{2})-(\d{2})/)
            const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null

            if (!dateStr) return null

            return (
              <div className="flex gap-2 md:gap-4 pt-3 md:pt-4 border-t border-[var(--color-border)] mt-4 md:mt-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewInCalendar(dateStr)
                  }}
                  style={{ backgroundColor: '#059669', color: 'white' }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-4 hover:bg-green-700 font-bold text-sm md:text-lg shadow-xl rounded-xl transition-all"
                >
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Visualizza nel Calendario</span>
                  <span className="sm:hidden">Calendario</span>
                </button>
              </div>
            )
          })()}
        </div>
      )}
      </div>
    </div>
  )
}

export interface ArchiveFiltersCardProps {
  filter: ArchiveFilter
  sortOrder: SortOrder
  onFilterChange: (filter: ArchiveFilter) => void
  onSortOrderChange: (sortOrder: SortOrder) => void
}

/** Filtri archivio: riutilizzabile nella fascia sticky della dashboard e nel tab. */
export const ArchiveFiltersCard: React.FC<ArchiveFiltersCardProps> = ({
  filter,
  sortOrder,
  onFilterChange,
  onSortOrderChange,
}) => (
  <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
    <div className="border-0 shadow-none outline-none">
      <label
        className="admin-warm-surface mb-2 flex min-h-10 w-full items-center justify-center rounded-lg border-2 border-solid border-[var(--color-border)] px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-primary-900 shadow-none outline-none"
      >
        Filtra per Status
      </label>

      <div className="grid grid-cols-2 gap-2 border-0 shadow-none outline-none min-[506px]:flex min-[506px]:flex-row">
        {(['all', 'accepted', 'rejected', 'deleted'] as ArchiveFilter[]).map((f) => (
          <button
            type="button"
            key={f}
            data-filter={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              'archive-tab-filter-btn admin-nav-item relative flex min-h-9 w-full min-[506px]:flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-900 transition-all duration-150 cursor-pointer',
              filter === f
                ? 'admin-nav-tab-active border-solid shadow-none'
                : 'border border-solid',
            )}
          >
            {f === 'all' && (
              <Archive className={cn('h-3.5 w-3.5 shrink-0', filter === f ? 'text-primary-900' : 'text-slate-800')} />
            )}
            {f === 'accepted' && (
              <CheckCircle className={cn('h-3.5 w-3.5 shrink-0', filter === f ? 'text-primary-900' : 'text-slate-800')} />
            )}
            {f === 'rejected' && (
              <XCircle className={cn('h-3.5 w-3.5 shrink-0', filter === f ? 'text-primary-900' : 'text-slate-800')} />
            )}
            {f === 'deleted' && (
              <Trash2 className={cn('h-3.5 w-3.5 shrink-0', filter === f ? 'text-primary-900' : 'text-slate-800')} />
            )}
            {f === 'all' ? 'Tutte' : f === 'accepted' ? 'Accettate' : f === 'rejected' ? 'Rifiutate' : 'Rimosse'}
          </button>
        ))}
      </div>
    </div>

    <div className="border-0 shadow-none outline-none">
      <label
        className="admin-warm-surface mb-2 flex min-h-10 w-full items-center justify-center rounded-lg border-2 border-solid border-[var(--color-border)] px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-primary-900 shadow-none outline-none"
      >
        Ordina per
      </label>

      <div className="grid grid-cols-2 gap-2 border-0 shadow-none outline-none min-[506px]:flex min-[506px]:flex-row">
        {([
          { value: 'booking_date' as SortOrder, label: 'Data Prenotazione', icon: Calendar },
          { value: 'created_at' as SortOrder, label: 'Data Creazione', icon: Clock },
        ]).map((option) => {
          const Icon = option.icon
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => onSortOrderChange(option.value)}
              className={cn(
                'archive-tab-filter-btn admin-nav-item relative flex min-h-9 w-full min-[506px]:flex-1 items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-900 transition-all duration-150 cursor-pointer',
                sortOrder === option.value
                  ? 'admin-nav-tab-active border-solid shadow-none'
                  : 'border border-solid',
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  sortOrder === option.value ? 'text-primary-900' : 'text-slate-800',
                )}
              />
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  </div>
)

interface ArchiveTabProps {
  onViewInCalendar?: (date: string) => void
  filter: ArchiveFilter
  sortOrder: SortOrder
}

export const ArchiveTab: React.FC<ArchiveTabProps> = ({ onViewInCalendar, filter, sortOrder }) => {
  const { data: allBookings, isLoading, error } = useAllBookings()
  const restoreBooking = useRestoreBooking()
  const requeueRejectedBooking = useRequeueRejectedBooking()
  const [pendingArchiveAction, setPendingArchiveAction] = useState<
    { type: 'restore' | 'requeue'; bookingId: string } | null
  >(null)
  const [restoreTimeBooking, setRestoreTimeBooking] = useState<BookingRequest | null>(null)

  const handleRestore = (booking: BookingRequest) => {
    if (booking.confirmed_start && booking.confirmed_end) {
      setPendingArchiveAction({ type: 'restore', bookingId: booking.id })
      return
    }
    setRestoreTimeBooking(booking)
  }

  const handleRequeueToPending = (bookingId: string) => {
    setPendingArchiveAction({ type: 'requeue', bookingId })
  }

  const confirmArchiveAction = async () => {
    if (!pendingArchiveAction) return
    const { type, bookingId } = pendingArchiveAction
    try {
      if (type === 'restore') {
        await restoreBooking.mutateAsync(bookingId)
      } else {
        await requeueRejectedBooking.mutateAsync(bookingId)
      }
      setPendingArchiveAction(null)
    } catch (err) {
      logger.error('Error applying archive action:', err)
    }
  }

  const confirmRestoreWithTime = async (data: {
    confirmedStart: string
    confirmedEnd: string
    desiredTime: string
  }) => {
    if (!restoreTimeBooking) return
    try {
      await restoreBooking.mutateAsync({
        bookingId: restoreTimeBooking.id,
        confirmedStart: data.confirmedStart,
        confirmedEnd: data.confirmedEnd,
        desiredTime: data.desiredTime,
      })
      setRestoreTimeBooking(null)
    } catch (err) {
      logger.error('Error restoring booking with time:', err)
    }
  }

  const archiveConfirmLoading =
    pendingArchiveAction?.type === 'restore'
      ? restoreBooking.isPending
      : pendingArchiveAction?.type === 'requeue'
        ? requeueRejectedBooking.isPending
        : false

  const filteredBookings = React.useMemo(() => {
    if (!allBookings) return []

    let filtered = []
    switch (filter) {
      case 'accepted':
        filtered = allBookings.filter((b) => b.status === 'accepted')
        break
      case 'rejected':
        filtered = allBookings.filter((b) => b.status === 'rejected')
        break
      case 'deleted':
        filtered = allBookings.filter((b) => b.status === 'deleted')
        break
      default:
        filtered = allBookings
    }

    // Ordina in base al tipo di ordinamento selezionato
    return filtered.sort((a, b) => {
      if (sortOrder === 'created_at') {
        // Ordina per data/ora di creazione (più recente in alto)
        const dateA = a.created_at ? new Date(a.created_at) : null
        const dateB = b.created_at ? new Date(b.created_at) : null
        
        if (!dateA && !dateB) return 0
        if (!dateA) return 1  // Metti quelle senza data in fondo
        if (!dateB) return -1
        
        // Confronta i timestamp completi (decrescente: più recente prima)
        return dateB.getTime() - dateA.getTime()
      } else {
        // Ordina per data della prenotazione (più recente in alto)
        const dateA = a.confirmed_start || a.desired_date
        const dateB = b.confirmed_start || b.desired_date
        
        if (!dateA && !dateB) return 0
        if (!dateA) return 1  // Metti quelle senza data in fondo
        if (!dateB) return -1
        
        // Confronta le date (decrescente: più recente prima)
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      }
    })
  }, [allBookings, filter, sortOrder])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento archivio...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-medium">Errore nel caricamento dell'archivio</p>
        <p className="text-red-600 text-sm mt-2">{String(error)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Results */}
      <div>
        <div className="mb-4 text-right">
          <p className="inline-block text-sm font-bold text-indigo-900 bg-indigo-50 rounded-lg px-4 py-2">
            📊 Mostrando {filteredBookings.length} prenotazioni
          </p>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg p-12 text-center border-2 border-purple-100">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-title-card font-bold text-indigo-900 mb-2">
              Nessuna prenotazione {filter !== 'all' && `con status "${filter}"`}
            </h3>
            <p className="text-gray-600 font-medium">
              {filter === 'all'
                ? 'Nessuna prenotazione presente nell\'archivio.'
                : 'Prova a cambiare il filtro.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-[30px]">
            {filteredBookings.map((booking) => {
              return (
                <ArchiveBookingCard
                  key={booking.id}
                  booking={booking}
                  onViewInCalendar={onViewInCalendar}
                  onRestore={handleRestore}
                  onRequeueToPending={handleRequeueToPending}
                />
              )
            })}
          </div>
        )}
      </div>

      <BookingDangerActionModal
        isOpen={pendingArchiveAction?.type === 'restore'}
        onClose={() => setPendingArchiveAction(null)}
        onConfirm={() => void confirmArchiveAction()}
        title="Reinserisci prenotazione"
        message="Sei sicuro di voler reinserire questa prenotazione nel calendario?"
        detail="La prenotazione tornerà visibile tra le confermate con gli orari già salvati."
        confirmLabel={archiveConfirmLoading ? 'Reinserimento…' : 'Reinserisci'}
        variant="warning"
        isLoading={archiveConfirmLoading}
      />
      <RestoreBookingTimeModal
        isOpen={restoreTimeBooking !== null}
        onClose={() => setRestoreTimeBooking(null)}
        booking={restoreTimeBooking}
        onConfirm={(data) => void confirmRestoreWithTime(data)}
        isLoading={restoreBooking.isPending}
      />
      <BookingDangerActionModal
        isOpen={pendingArchiveAction?.type === 'requeue'}
        onClose={() => setPendingArchiveAction(null)}
        onConfirm={() => void confirmArchiveAction()}
        title="Riporta in attesa"
        message="Riportare questa prenotazione tra le richieste in attesa?"
        detail="Il motivo di rifiuto verrà azzerato e la richiesta comparirà di nuovo in Prenotazioni."
        confirmLabel={archiveConfirmLoading ? 'Salvataggio…' : 'Riporta in attesa'}
        variant="warning"
        isLoading={archiveConfirmLoading}
      />
    </div>
  )
}

