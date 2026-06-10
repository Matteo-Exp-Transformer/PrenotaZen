import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  PenLine,
  Tag,
  UtensilsCrossed,
  UserRound,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type { BookingRequest, BookingType } from '@/types/booking'
import { transformBookingsToCalendarEvents } from '../utils/bookingEventTransform'
import { BookingDetailsModal } from './BookingDetailsModal'
import { QuickTableAssignModal } from './QuickTableAssignModal'
import {
  extractDateFromISO,
  getAccurateStartTime,
  startTimeToMinutesSinceMidnight,
} from '../utils/dateUtils'
import { getResolvedMenuPriceDisplay } from '../utils/menuPricing'
import {
  getSlotLabel,
  parseHmToMinutes,
} from '../utils/bookingTimeSlots'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import { useServiceSlots, useDigestSlotConfigs, type SlotConfig } from '../hooks/useServiceSlots'
import { useTableAssignments, type BookingTableAssignment } from '../hooks/useTableAssignments'
import { useFeatures } from '@/hooks/useFeatures'
import { cn } from '@/lib/utils'

/** Sotto questa larghezza (inclusa), la vista FullCalendar predefinita è lista invece del mese */
const CALENDAR_DEFAULT_LIST_MAX_WIDTH_PX = 630
/** Nei blocchi evento: sotto questa larghezza mostra solo l’icona tipologia (il nome resta in title per hover/tooltip). */
const CALENDAR_EVENT_ICON_ONLY_MAX_WIDTH_PX = 500
/**
 * Vista mese: altezza minima cella giorno (px).
 * FullCalendar v6 con `height: 'auto'` non espone dayMinHeight; valore applicato via
 * `--booking-calendar-day-min-height` sul wrapper (vedi index.css).
 */
const CALENDAR_DAY_GRID_MONTH_MIN_HEIGHT_PX = 128
const CALENDAR_DAY_GRID_MONTH_MIN_HEIGHT_NARROW_PX = 112
/** Tab Calendario usa px-1 sul contenitore pagina: questo ripristina px-4 md:px-6 solo sulla card titolo. */
const CALENDAR_TITLE_SECTION_INSET_CLASS = 'mx-auto w-full max-w-7xl px-3 md:px-[1.125rem]'

/** Intestazione fascia digest — stile neutro allineato al resto dell'app. */
function DigestSlotHeader({ label }: { label: string }) {
  return (
    <h6 className="flex items-center justify-center rounded-xl border border-(--color-border) bg-primary-50 px-3 shadow-sm text-[19px]! font-semibold tracking-wide leading-snug text-primary-900" style={{ height: 56 }}>
      {label}
    </h6>
  )
}

type FullCalendarViewId = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'

function getDefaultCalendarViewForViewport(): FullCalendarViewId {
  if (typeof window === 'undefined') return 'dayGridMonth'
  return window.matchMedia(`(max-width: ${CALENDAR_DEFAULT_LIST_MAX_WIDTH_PX}px)`).matches
    ? 'listWeek'
    : 'dayGridMonth'
}

function getInitialCalendarNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${CALENDAR_DEFAULT_LIST_MAX_WIDTH_PX}px)`).matches
}

function getInitialCalendarEventIconOnly(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(max-width: ${CALENDAR_EVENT_ICON_ONLY_MAX_WIDTH_PX}px)`).matches
}

/** Icona lucide per la tipologia prenotazione (digest / card compatte). */
function DigestBookingTypeIcon({
  booking,
  className,
}: {
  booking: BookingRequest
  className?: string
}) {
  const features = useFeatures()
  const t = (booking.booking_type ?? 'tavolo') as BookingType
  const iconClass = cn('shrink-0', className)
  if (features.walkIn && booking.source === 'walk_in') {
    return <UserRound className={iconClass} aria-hidden />
  }
  if (t === 'rinfresco_laurea') {
    return <GraduationCap className={iconClass} aria-hidden />
  }
  if (t === 'menu_prezzo_fisso') {
    return <BookOpen className={iconClass} aria-hidden />
  }
  return <UtensilsCrossed className={iconClass} aria-hidden />
}

/** True se la prenotazione prevede menù / rinfresco (non “solo tavolo”). */
function digestBookingHasMenuContext(booking: BookingRequest): boolean {
  if (booking.menu?.trim()) return true
  if (bookingTypeUsesMenuSelections(booking.booking_type)) return true
  if (booking.preset_menu) return true
  if ((booking.menu_total_per_person ?? 0) > 0) return true
  return !!(booking.menu_selection?.items && booking.menu_selection.items.length > 0)
}

function DigestBookingListRow({
  booking,
  onOpen,
  showMenuPricing = false,
  compactGrid = false,
  unassigned = false,
  assigned = false,
  hasTurns = false,
  onDotClick,
}: {
  booking: BookingRequest
  onOpen: (b: BookingRequest) => void
  showMenuPricing?: boolean
  /** Card strette per griglia a 3 colonne (digest calendario). */
  compactGrid?: boolean
  /** Pro: prenotazione accettata senza tavolo assegnato. */
  unassigned?: boolean
  /** Pro: prenotazione con tavolo già assegnato. */
  assigned?: boolean
  /** Pro: mostrare il pallino di stato. */
  hasTurns?: boolean
  /** Pro: click sul pallino → apre modal assegnazione rapida. */
  onDotClick?: (booking: BookingRequest, e: React.MouseEvent) => void
}) {
  const menuPriceRow = showMenuPricing ? getResolvedMenuPriceDisplay(booking) : null
  const bookingTimeLabel =
    booking.desired_time || booking.confirmed_start ? getAccurateStartTime(booking) : null
  const hasMenuBookingContext = digestBookingHasMenuContext(booking)
  const hasSpecialNote = !!booking.special_requests?.trim()
  const [showNoteHint, setShowNoteHint] = useState(false)

  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className={cn(
        'relative min-h-0 w-full min-w-0 rounded-lg border text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        'bg-surface border-(--color-border) text-primary-900 shadow-sm',
        compactGrid ? 'flex w-full min-h-[2.938775rem] flex-col' : '',
      )}
    >
      <div
        className={`flex min-h-0 flex-col ${compactGrid ? 'overflow-visible items-stretch justify-center gap-0.5 px-2 py-1 text-center text-[16px] leading-tight sm:text-[18px]' : 'overflow-hidden flex-1 px-2 py-1.5 text-xs'}`}
      >
        {!compactGrid ? (
          <div className="mb-1 flex w-full items-center gap-1.5 truncate font-semibold leading-snug">
            <DigestBookingTypeIcon booking={booking} className="h-3 w-3 flex-shrink-0" />
            <span className="min-w-0 truncate">{booking.client_name}</span>
            {unassigned && (
              <span className="ml-auto shrink-0 rounded-md bg-(--color-status-pending)/15 px-1.5 py-0.5 text-[10px] font-semibold text-(--color-status-pending)">
                Da assegnare
              </span>
            )}
          </div>
        ) : (
          <div className="relative w-full min-h-[1.25rem]">
            <DigestBookingTypeIcon
              booking={booking}
              className="absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-90 sm:h-4 sm:w-4"
            />
            {unassigned && (
              <div className="mb-0.5 flex w-full items-center justify-center">
                <span className="rounded-md bg-(--color-status-pending)/15 px-1.5 py-0.5 text-[10px] font-semibold text-(--color-status-pending)">
                  Da assegnare
                </span>
              </div>
            )}
            <div className="flex w-full items-center justify-center text-center leading-tight">
              <span
                className={`block max-w-full truncate px-1 ${hasSpecialNote && !menuPriceRow ? 'pr-6' : ''}`}
              >
                <span>{booking.client_name}</span>
                <span className="font-normal opacity-90">
                  {' - '}
                  {booking.num_guests} osp.
                  {bookingTimeLabel && (
                    <>
                      {' - '}
                      <span className="font-medium">{bookingTimeLabel}</span>
                    </>
                  )}
                </span>
              </span>
            </div>
          </div>
        )}
        {!compactGrid ? (
          <div className="flex items-center gap-2 text-xs opacity-90 truncate">
            <span>{booking.num_guests} ospiti</span>
            {booking.menu && !hasMenuBookingContext && (
              <>
                <span>•</span>
                <span className="truncate">{booking.menu}</span>
              </>
            )}
            {(booking.desired_time || booking.confirmed_start) && (
              <>
                <span>•</span>
                <span>{getAccurateStartTime(booking)}</span>
              </>
            )}
          </div>
        ) : (
          <>
            {menuPriceRow && (
              <div className="relative w-full min-h-[1.25rem] opacity-90 text-[0.98em]">
                {hasSpecialNote ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNoteHint((prev) => !prev)
                    }}
                    onMouseEnter={() => setShowNoteHint(true)}
                    onMouseLeave={() => setShowNoteHint(false)}
                    onBlur={() => setShowNoteHint(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        setShowNoteHint((prev) => !prev)
                      }
                    }}
                    className="absolute left-0 top-1/2 z-10 inline-flex cursor-pointer -translate-y-1/2 text-slate-800/95"
                    style={{ left: 0 }}
                    aria-label="Questa prenotazione ha una nota salvata"
                  >
                    <PenLine className="h-3.5 w-3.5 opacity-90 sm:h-4 sm:w-4" />
                  </span>
                ) : (
                  <PenLine
                    className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-90 sm:h-4 sm:w-4"
                    style={{ left: 0 }}
                    aria-hidden
                  />
                )}
                <div className="flex w-full items-center justify-center text-center font-normal opacity-95">
                  <span className="block max-w-full truncate px-1">{menuPriceRow.prezzoMenuLabel}</span>
                </div>
              </div>
            )}
            {booking.menu && !hasMenuBookingContext && (
              <p className="line-clamp-2 w-full break-words text-center opacity-85 text-[0.98em]" title={booking.menu}>
                {booking.menu}
              </p>
            )}
          </>
        )}
        {menuPriceRow && !compactGrid && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/25 pt-1.5 text-xs font-semibold leading-snug opacity-95">
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <Tag className="h-3.5 w-3.5 flex-shrink-0 opacity-90" aria-hidden />
              <span className="truncate">{menuPriceRow.prezzoMenuLabel}</span>
            </span>
            {menuPriceRow.prezzoTotaleLabel && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <span className="opacity-75">·</span>
                <span className="truncate">Tot. {menuPriceRow.prezzoTotaleLabel}</span>
              </span>
            )}
          </div>
        )}
      </div>
      {hasSpecialNote && compactGrid && (
        <>
          {/* Pen + tooltip sulla riga prezzo se c’è prezzo menù; altrimenti solo angolo in alto a destra */}
          {!menuPriceRow && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                setShowNoteHint((prev) => !prev)
              }}
              onMouseEnter={() => setShowNoteHint(true)}
              onMouseLeave={() => setShowNoteHint(false)}
              onBlur={() => setShowNoteHint(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowNoteHint((prev) => !prev)
                }
              }}
              className="absolute top-1 z-20 cursor-pointer text-slate-800/95"
              style={{ right: 2, left: 'auto' }}
              aria-label="Questa prenotazione ha una nota salvata"
            >
              <PenLine className="h-3 w-3" />
            </span>
          )}
          {showNoteHint && (
            <div
              className="absolute z-[80] max-w-[min(calc(100vw-16px),20rem)] rounded-md bg-slate-900 px-2.5 py-1.5 text-white shadow-lg sm:max-w-none sm:whitespace-nowrap"
              style={
                menuPriceRow
                  ? {
                      left: 2,
                      bottom: 'calc(100% + 2px)',
                      fontSize: '0.875rem',
                      lineHeight: 1.35,
                      fontWeight: 500,
                    }
                  : {
                      right: 2,
                      bottom: 'calc(100% + 2px)',
                      fontSize: '0.875rem',
                      lineHeight: 1.35,
                      fontWeight: 500,
                    }
              }
              role="tooltip"
            >
              C&apos;è una nota salvata
            </div>
          )}
        </>
      )}
      {hasTurns && (
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDotClick?.(booking, e) }}
          aria-label={assigned ? 'Tavolo assegnato' : 'Assegna tavolo'}
          className={cn(
            'absolute top-1 right-1 h-2.5 w-2.5 rounded-full cursor-pointer z-10',
            assigned
              ? 'bg-(--color-status-accepted)'
              : 'bg-primary-300',
          )}
        />
      )}
    </button>
  )
}

/** Navigazione turni: freccia sx, count centrale, freccia dx */
function DigestTurnNav({
  turn,
  maxTurn,
  onPrev,
  onNext,
}: {
  turn: number
  maxTurn: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <button
        type="button"
        onClick={onPrev}
        disabled={turn <= 1}
        aria-label="Turno precedente"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--color-border) bg-surface text-primary-900 shadow-sm transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-16 text-center text-sm font-semibold text-primary-900 tabular-nums">
        Turno {turn} / {maxTurn}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={turn >= maxTurn}
        aria-label="Turno successivo"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--color-border) bg-surface text-primary-900 shadow-sm transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

interface BookingCalendarProps {
  bookings: BookingRequest[]
  initialDate?: string | null
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({ bookings, initialDate }) => {
  const features = useFeatures()
  const { data: digestSlots = [] } = useDigestSlotConfigs()
  const timeSlotsEnabledQuery = useRestaurantSetting('booking_time_slots_enabled')
  // In Pro le fasce sono sempre attive; in Classic rispetta il flag
  const timeSlotsEnabled = features.servizio ? true : (timeSlotsEnabledQuery.data ?? true)

  // Pro: service_slots e assignments per navigazione turni
  const { data: serviceSlots = [] } = useServiceSlots()
  const hasTurnsFeature = features.servizio && serviceSlots.length > 0

  const splitDigestBySlotConfigs = useCallback((digestBookings: BookingRequest[]): Record<string, BookingRequest[]> => {
    const bySlot: Record<string, BookingRequest[]> = {}
    for (const s of digestSlots) bySlot[s.id] = []
    for (const booking of digestBookings) {
      const startTime = getAccurateStartTime(booking)
      const startMin = parseHmToMinutes(startTime)
      let matched = false
      for (const s of digestSlots) {
        const sStart = parseHmToMinutes(s.start_time)
        const sEnd = parseHmToMinutes(s.end_time)
        const crossesMidnight = sEnd < sStart
        const inSlot = crossesMidnight
          ? startMin >= sStart || startMin < sEnd
          : startMin >= sStart && startMin < sEnd
        if (inSlot) {
          bySlot[s.id].push(booking)
          matched = true
          break
        }
      }
      if (!matched) {
        if (!bySlot['__unassigned__']) bySlot['__unassigned__'] = []
        bySlot['__unassigned__'].push(booking)
      }
    }
    return bySlot
  }, [digestSlots])

  const calendarRef = useRef<FullCalendar>(null)
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const currentDateLabel = format(new Date(), 'dd/MM/yy')
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return initialDate || new Date().toISOString().split('T')[0]
  })
  // Pro: navigazione turni nel digest — si resetta a 1 quando cambia data
  const [activeTurn, setActiveTurn] = useState(1)
  const { data: tableAssignments = [] } = useTableAssignments(selectedDate)
  const [currentView, setCurrentView] = useState<FullCalendarViewId>(getDefaultCalendarViewForViewport)
  const [isCalendarNarrowViewport, setIsCalendarNarrowViewport] =
    useState(getInitialCalendarNarrowViewport)
  const [isCalendarEventIconOnly, setIsCalendarEventIconOnly] =
    useState(getInitialCalendarEventIconOnly)

  useEffect(() => {
    const mql630 = window.matchMedia(`(max-width: ${CALENDAR_DEFAULT_LIST_MAX_WIDTH_PX}px)`)
    const mql500 = window.matchMedia(`(max-width: ${CALENDAR_EVENT_ICON_ONLY_MAX_WIDTH_PX}px)`)
    const sync = () => {
      setIsCalendarNarrowViewport(mql630.matches)
      setIsCalendarEventIconOnly(mql500.matches)
    }
    sync()
    mql630.addEventListener('change', sync)
    mql500.addEventListener('change', sync)
    return () => {
      mql630.removeEventListener('change', sync)
      mql500.removeEventListener('change', sync)
    }
  }, [])

  // Resetta il turno attivo quando cambia la data selezionata
  useEffect(() => {
    setActiveTurn(1)
  }, [selectedDate])

  // Aggiorna il selectedBooking quando i bookings cambiano (dopo modifica)
  useEffect(() => {
    if (selectedBooking && isModalOpen) {
      const updatedBooking = bookings.find(b => b.id === selectedBooking.id)
      if (updatedBooking) {
        // Aggiorna sempre selectedBooking quando viene trovato un booking aggiornato
        // Questo assicura che il modal mostri sempre i dati più recenti
        setSelectedBooking(updatedBooking)
      }
    }
  }, [bookings, isModalOpen])

  // Navigate to initialDate when it changes (from Archive)
  useEffect(() => {
    if (initialDate && calendarRef.current) {
      try {
        const calendarApi = calendarRef.current.getApi()
        const [year, month, day] = initialDate.split('-').map(Number)
        const targetDate = new Date(year, month - 1, day)
        calendarApi.gotoDate(targetDate)
        setSelectedDate(initialDate)
      } catch (error) {
        console.error('Error navigating to calendar date:', error)
      }
    }
  }, [initialDate])

  // I no-show restano nel DB per gli analytics ma non vengono mostrati nel calendario
  const visibleBookings = bookings.filter((b) => !b.no_show)
  const events = transformBookingsToCalendarEvents(visibleBookings)

  const handleEventClick = (clickInfo: any) => {
    const booking = clickInfo.event.extendedProps as BookingRequest
    
    if (!booking) {
      return
    }
    
    setSelectedBooking(booking)
    setIsModalOpen(true)
  }

  const handleDateClick = useCallback((clickInfo: any) => {
    const d = new Date(clickInfo.date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const date = `${year}-${month}-${day}`
    setSelectedDate(date)
  }, [])

  const selectedDateData = useMemo(() => {
    return { date: selectedDate }
  }, [selectedDate])

  const { selectedDayDigestBookings, digestWithMenu, digestTableOnly } = useMemo(() => {
    const sorted = bookings
      .filter((b) => b.status === 'accepted' && !b.no_show && b.confirmed_start && b.confirmed_end)
      .filter((b) => extractDateFromISO(b.confirmed_start!) === selectedDate)
      .sort((a, b) => {
        const ma = startTimeToMinutesSinceMidnight(getAccurateStartTime(a)) ?? 24 * 60
        const mb = startTimeToMinutesSinceMidnight(getAccurateStartTime(b)) ?? 24 * 60
        return ma - mb
      })
    return {
      selectedDayDigestBookings: sorted,
      digestWithMenu: sorted.filter(digestBookingHasMenuContext),
      digestTableOnly: sorted.filter((b) => !digestBookingHasMenuContext(b)),
    }
  }, [bookings, selectedDate])
  const digestWithMenuBySlot = useMemo(
    () => splitDigestBySlotConfigs(digestWithMenu),
    [digestWithMenu, digestSlots]
  )
  const digestTableOnlyBySlot = useMemo(
    () => splitDigestBySlotConfigs(digestTableOnly),
    [digestTableOnly, digestSlots]
  )
  const digestUnassignedWithMenu = useMemo(
    () => digestWithMenuBySlot['__unassigned__'] ?? [],
    [digestWithMenuBySlot]
  )
  const digestUnassignedTableOnly = useMemo(
    () => digestTableOnlyBySlot['__unassigned__'] ?? [],
    [digestTableOnlyBySlot]
  )

  // Pro: set di booking_id con almeno un assignment attivo per la data selezionata
  const assignedBookingIds = useMemo<Set<string>>(() => {
    if (!hasTurnsFeature) return new Set()
    const s = new Set<string>()
    for (const a of tableAssignments as BookingTableAssignment[]) {
      if (a.checked_out_at === null) s.add(a.booking_id)
    }
    return s
  }, [hasTurnsFeature, tableAssignments])

  // Pro: mappa booking_id → turn_number per la data selezionata
  const turnByBookingId = useMemo<Record<string, number>>(() => {
    if (!hasTurnsFeature) return {}
    const map: Record<string, number> = {}
    for (const a of tableAssignments as BookingTableAssignment[]) {
      // Usa il turn_number più basso (turno attivo) per ogni prenotazione
      if (map[a.booking_id] === undefined || a.turn_number < map[a.booking_id]) {
        map[a.booking_id] = a.turn_number
      }
    }
    return map
  }, [hasTurnsFeature, tableAssignments])

  // Turno massimo rilevato dagli assignments della data selezionata
  const maxTurnFromAssignments = useMemo(() => {
    if (!hasTurnsFeature || tableAssignments.length === 0) return 1
    return Math.max(...(tableAssignments as BookingTableAssignment[]).map((a) => a.turn_number))
  }, [hasTurnsFeature, tableAssignments])

  const maxTurn = Math.max(activeTurn, maxTurnFromAssignments)

  // Pro: booking selezionato per assegnazione/riassegnazione rapida tavolo dal pallino
  const [quickAssignBooking, setQuickAssignBooking] = useState<BookingRequest | null>(null)

  const handleDotClick = useCallback((booking: BookingRequest) => {
    if (hasTurnsFeature) {
      setQuickAssignBooking(booking)
    }
  }, [hasTurnsFeature])

  /** Filtra prenotazioni per turno attivo.
   *  - Con feature pro: mostra solo quelle assegnate al turno corrente.
   *    Le prenotazioni senza assignment (non ancora assegnate) appaiono al turno 1.
   *  - Senza feature pro: restituisce tutto invariato. */
  const filterByTurn = useCallback(
    (list: BookingRequest[]): BookingRequest[] => {
      if (!hasTurnsFeature) return list
      return list.filter((b) => {
        const t = turnByBookingId[b.id]
        // Prenotazione senza assignment → sempre turno 1
        return (t ?? 1) === activeTurn
      })
    },
    [hasTurnsFeature, turnByBookingId, activeTurn],
  )

  const openDigestBooking = (booking: BookingRequest) => {
    setSelectedBooking(booking)
    setIsModalOpen(true)
  }

  const config = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: currentView,
    headerToolbar: {
      left: '',
      center: 'title',
      right: 'prev,next',
    },
    height: 'auto',
    locale: 'it',
    firstDay: 1, // Monday
    views: {
      timeGridWeek: {
        dayHeaderFormat: isCalendarNarrowViewport
          ? { weekday: 'short' as const, day: 'numeric' as const }
          : { weekday: 'short' as const, day: '2-digit' as const, month: '2-digit' as const },
      },
      timeGridDay: {
        dayHeaderFormat: isCalendarNarrowViewport
          ? {
              weekday: 'short' as const,
              day: 'numeric' as const,
              month: 'short' as const,
            }
          : {
              weekday: 'long' as const,
              day: 'numeric' as const,
              month: 'long' as const,
              year: 'numeric' as const,
            },
      },
    },
    slotMinTime: '08:00:00',
    slotMaxTime: '24:00:00',
    /** Su mobile niente segmenti affiancati (evita scala a sinistra e sovrapposizioni) */
    slotEventOverlap: !isCalendarNarrowViewport,
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5, 6], // Monday - Saturday
      startTime: '08:00',
      endTime: '22:00',
    },
    eventClick: handleEventClick,
    dateClick: handleDateClick,
    eventDisplay: 'block',
    eventTextColor: '#000000',
    eventTimeFormat: {
      hour: '2-digit' as const,
      minute: '2-digit' as const,
    },
    // Mobile: max 3 eventi in cella + «···» se ce ne sono altri (click = come dateClick sul giorno)
    dayMaxEvents: isCalendarNarrowViewport ? 3 : false,
    ...(isCalendarNarrowViewport
      ? {
          moreLinkText: () => '···',
          moreLinkHint: (num: number) =>
            num === 1
              ? 'C’è un’altra prenotazione. Tocca per selezionare il giorno.'
              : `Ci sono altre ${num} prenotazioni. Tocca per selezionare il giorno.`,
          moreLinkClassNames: 'booking-calendar-more-dots',
          moreLinkClick: (info: { date: Date }) => {
            handleDateClick({ date: info.date })
            const t = calendarRef.current?.getApi()?.view.type
            return typeof t === 'string' ? t : 'dayGridMonth'
          },
        }
      : {}),
    // Highlight today and selected date with stable CSS classes
    dayCellClassNames: (arg: any) => {
      const d = new Date(arg.date)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const cellDateStr = `${year}-${month}-${day}`

      const today = new Date()
      const todayYear = today.getFullYear()
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0')
      const todayDay = String(today.getDate()).padStart(2, '0')
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`

      return [
        cellDateStr === todayStr ? 'calendar-day-today' : '',
        cellDateStr === selectedDate ? 'calendar-day-selected' : '',
      ].filter(Boolean)
    },
    // Custom event rendering per card eventi migliorate
    eventContent: (arg: any) => {
      const booking = arg.event.extendedProps as BookingRequest
      const viewType = arg.view?.type as string | undefined
      /** Solo vista mese: cella minuscola → solo icona sotto ~500px */
      const iconOnlyMonthCell = isCalendarEventIconOnly && viewType === 'dayGridMonth'
      const isTimeGridView = viewType === 'timeGridDay' || viewType === 'timeGridWeek'
      const bookingTimeLabel =
        booking.desired_time || booking.confirmed_start ? getAccurateStartTime(booking) : null

      if (isCalendarNarrowViewport) {
        if (isTimeGridView) {
          return (
            <div
              data-booking-calendar-timegrid-narrow="true"
              className="flex h-full min-h-0 w-full min-w-0 max-w-full cursor-pointer flex-col items-center gap-0.5 overflow-hidden rounded-md px-1 py-0.5 text-center text-[10px] leading-snug text-neutral-900 transition-opacity hover:opacity-90"
            >
              <div className="flex w-full min-w-0 justify-center">
                <div className="flex min-w-0 max-w-full items-center justify-center gap-1">
                  <DigestBookingTypeIcon booking={booking} className="h-3 w-3 shrink-0 text-neutral-900" />
                  <span className="min-w-0 truncate font-semibold text-neutral-950">
                    {booking.client_name}
                  </span>
                </div>
              </div>
              <div className="w-full min-w-0 truncate text-[11px] leading-snug text-neutral-800 tabular-nums">
                {booking.num_guests} ospiti
                {bookingTimeLabel ? ` · ${bookingTimeLabel}` : ''}
              </div>
            </div>
          )
        }

        if (iconOnlyMonthCell) {
          return (
            <div
              className="flex h-full min-h-[1.75rem] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg px-0.5 py-0.5 text-neutral-900 transition-opacity hover:opacity-90 [&>svg]:block"
              title={booking.client_name}
            >
              <DigestBookingTypeIcon
                booking={booking}
                className="h-3.5 w-3.5 shrink-0 text-neutral-900"
              />
            </div>
          )
        }
        return (
          <div className="flex cursor-pointer flex-col items-center gap-0.5 overflow-hidden rounded-lg px-1 py-1 text-center text-xs text-neutral-900 transition-opacity hover:opacity-90">
            <div className="flex w-full shrink-0 items-center justify-center [&>svg]:block">
              <DigestBookingTypeIcon
                booking={booking}
                className="h-3.5 w-3.5 shrink-0 text-neutral-900"
              />
            </div>
            <div className="w-full min-w-0 truncate font-semibold leading-tight text-neutral-950">
              {booking.client_name}
            </div>
          </div>
        )
      }

      return (
        <div className="cursor-pointer overflow-hidden rounded-lg px-2 py-1.5 text-xs text-neutral-900 transition-opacity hover:opacity-90">
          <div className="mb-1 flex items-center gap-1.5 truncate font-semibold text-neutral-950">
            <DigestBookingTypeIcon
              booking={booking}
              className="h-3 w-3 shrink-0 text-neutral-900"
            />
            <span className="truncate">{booking.client_name}</span>
          </div>

          <div className="flex items-center gap-2 truncate text-xs text-neutral-800">
            <span>{booking.num_guests} ospiti</span>
            {booking.menu && !digestBookingHasMenuContext(booking) && (
              <>
                <span>•</span>
                <span className="truncate">{booking.menu}</span>
              </>
            )}
            {(booking.desired_time || booking.confirmed_start) && (
              <>
                <span>•</span>
                <span>{getAccurateStartTime(booking)}</span>
              </>
            )}
          </div>
        </div>
      )
    },
  }

  const handleViewChange = (view: FullCalendarViewId) => {
    setCurrentView(view)
    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.changeView(view)
    }
  }

  const handleGoToToday = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayStr = `${year}-${month}-${day}`

    setSelectedDate(todayStr)

    const calendarApi = calendarRef.current?.getApi()
    if (calendarApi) {
      calendarApi.gotoDate(today)
    }
  }

  const viewButtonClass = (view: FullCalendarViewId) =>
    cn(
      'shrink-0 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-colors',
      // Stesso intervallo della card toolbar / FC (~537): evita scroll + “fascia” solo tra 423 e 537 px
      'max-[537px]:px-3 max-[537px]:py-1.5 max-[537px]:text-[13px] max-[537px]:leading-tight',
      currentView === view
        ? 'border-primary-200 bg-primary-50 text-primary-900 hover:border-primary-300 hover:bg-primary-100'
        : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-primary-900 hover:bg-[var(--color-muted)]'
    )

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className={CALENDAR_TITLE_SECTION_INSET_CLASS}>
            <div className="booking-calendar-title-section w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-sm max-[537px]:px-3 max-[537px]:py-3 sm:px-5 sm:py-4">
              {/* <640px: titolo a sinistra + icona; da 640px: titolo centrato, icona a destra */}
              <div
                className="relative flex w-full items-start justify-between gap-3 py-3 max-sm:items-start sm:items-center sm:justify-center"
                style={{ minHeight: 'calc(48px * 6 / 5 * 6 / 5)' }}
              >
                <h2 className="booking-calendar-page-title min-w-0 flex-1 pr-2 text-left font-serif font-bold text-primary-900 sm:w-full sm:flex-none sm:pr-14 sm:text-center md:pr-16">
                  Calendario Prenotazioni
                </h2>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-primary-700 bg-primary-600 shadow-lg max-[537px]:h-9 max-[537px]:w-9 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2"
                  aria-hidden
                >
                  <Calendar className="h-7 w-7 text-white max-[537px]:h-5 max-[537px]:w-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Pulsanti vista — sotto la barra titolo, stessi stili su tutte le larghezze */}
          <div className="flex w-full max-w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto pb-0.5">
            <button type="button" onClick={() => handleViewChange('dayGridMonth')} className={viewButtonClass('dayGridMonth')}>
              Mese
            </button>
            <button type="button" onClick={() => handleViewChange('timeGridWeek')} className={viewButtonClass('timeGridWeek')}>
              Settimana
            </button>
            <button type="button" onClick={() => handleViewChange('timeGridDay')} className={viewButtonClass('timeGridDay')}>
              Giorno
            </button>
            <button type="button" onClick={() => handleViewChange('listWeek')} className={viewButtonClass('listWeek')}>
              Lista
            </button>
          </div>

          <div
            className="booking-calendar-fc relative w-full max-w-none [&_.fc-event]:cursor-pointer"
            style={
              {
                '--booking-calendar-day-min-height': `${
                  isCalendarNarrowViewport
                    ? CALENDAR_DAY_GRID_MONTH_MIN_HEIGHT_NARROW_PX
                    : CALENDAR_DAY_GRID_MONTH_MIN_HEIGHT_PX
                }px`,
              } as React.CSSProperties
            }
          >
            <div className="absolute left-0 top-0 z-20 flex items-center gap-2 max-[537px]:gap-1.5">
              <button
                type="button"
                onClick={handleGoToToday}
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-xl border border-primary-200 bg-primary-50 text-sm font-medium leading-none text-primary-900 shadow-sm transition-colors',
                  'hover:border-primary-300 hover:bg-primary-100',
                  'focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2',
                  'h-10 min-h-10 min-w-[88px] px-3.5',
                  'max-[537px]:h-8 max-[537px]:min-h-8 max-[537px]:min-w-[4.75rem] max-[537px]:rounded-lg max-[537px]:px-2 max-[537px]:text-xs'
                )}
              >
                Oggi
              </button>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-primary-900 max-[537px]:text-xs sm:text-base">
                {currentDateLabel}
              </span>
            </div>
            <FullCalendar ref={calendarRef} {...config} events={events} />
          </div>
        </div>

        {/* Giornata selezionata: elenco prenotazioni e fasce */}
        <div>
          <div className="mb-8 w-full">
            <h4 className="text-center text-base font-semibold text-primary-900 mb-3 leading-snug">
              Prenotazioni del giorno:{' '}
              <span className="font-normal text-[var(--color-text-muted)]">
                {format(new Date(selectedDateData.date), 'EEEE, dd MMMM yyyy', { locale: it })} ={' '}
                {selectedDayDigestBookings.length}{' '}
                {selectedDayDigestBookings.length === 1 ? 'Prenotazione' : 'Prenotazioni'}
              </span>
            </h4>
            {selectedDayDigestBookings.length > 0 ? (
              <div className="space-y-8">
                {/* Navigazione turni — visibile solo in versione pro con service_slots configurati */}
                {hasTurnsFeature && (
                  <DigestTurnNav
                    turn={activeTurn}
                    maxTurn={maxTurn}
                    onPrev={() => setActiveTurn((t) => Math.max(1, t - 1))}
                    onNext={() => setActiveTurn((t) => Math.min(maxTurn, t + 1))}
                  />
                )}
                <section aria-labelledby="digest-with-menu-heading">
                  <div
                    id="digest-with-menu-heading"
                    className="admin-warm-surface mb-3 flex items-center justify-center rounded-xl border px-3 py-2 text-center shadow-sm"
                  >
                    <h5 className="!text-[19px] font-semibold tracking-wide text-primary-900">
                      Prenotazioni con menu
                    </h5>
                  </div>
                  {digestWithMenu.length > 0 ? (
                    <div className="rounded-xl border border-(--color-border) bg-surface/90 p-2 shadow-inner">
                      {!timeSlotsEnabled || digestSlots.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filterByTurn(digestWithMenu).map((booking) => (
                            <div key={booking.id} className="flex min-w-0 w-full flex-col">
                              <DigestBookingListRow
                                booking={booking}
                                onOpen={openDigestBooking}
                                showMenuPricing
                                compactGrid
                                unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                hasTurns={hasTurnsFeature}
                                onDotClick={handleDotClick}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="hidden min-[1390px]:grid grid-cols-3 gap-2">
                            {digestSlots.map((s: SlotConfig) => (
                              <DigestSlotHeader key={s.id} label={getSlotLabel(s)} />
                            ))}
                          </div>
                          <div className="mt-2 hidden min-[1390px]:grid grid-cols-3 gap-2 auto-rows-[minmax(0,auto)] items-start">
                              {digestSlots.map((s: SlotConfig) => (
                                <div key={s.id} className="grid min-w-0 w-full grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                                  {filterByTurn(digestWithMenuBySlot[s.id] ?? []).map((booking) => (
                                    <div key={booking.id} className="flex min-w-0 w-full flex-col">
                                      <DigestBookingListRow
                                        booking={booking}
                                        onOpen={openDigestBooking}
                                        showMenuPricing
                                        compactGrid
                                        unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                        assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                        hasTurns={hasTurnsFeature}
                                        onDotClick={handleDotClick}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                          <div className="min-[1390px]:hidden space-y-3">
                            {digestSlots.map((s: SlotConfig) => (
                              <div key={s.id} className="space-y-2">
                                <DigestSlotHeader label={getSlotLabel(s)} />
                                {filterByTurn(digestWithMenuBySlot[s.id] ?? []).map((booking) => (
                                  <div key={booking.id} className="flex min-w-0 w-full flex-col">
                                    <DigestBookingListRow
                                      booking={booking}
                                      onOpen={openDigestBooking}
                                      showMenuPricing
                                      compactGrid
                                      unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                      assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                      hasTurns={hasTurnsFeature}
                                      onDotClick={handleDotClick}
                                    />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-(--color-text-muted) italic py-6 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2)/80">
                      Nessuna prenotazione con menu per questa data.
                    </p>
                  )}
                </section>

                <div className="border-t-2 border-[var(--color-border)] pt-8 mt-2" aria-hidden />

                <section aria-labelledby="digest-table-only-heading">
                  <div
                    id="digest-table-only-heading"
                    className="admin-warm-surface mb-3 flex items-center justify-center rounded-xl border px-3 py-2 text-center shadow-sm"
                  >
                    <h5 className="!text-[19px] font-semibold tracking-wide text-primary-900">
                      Solo tavolo
                    </h5>
                  </div>
                  {digestTableOnly.length > 0 ? (
                    <div className="rounded-xl border border-(--color-border) bg-surface/90 p-2 shadow-inner">
                      {!timeSlotsEnabled || digestSlots.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filterByTurn(digestTableOnly).map((booking) => (
                            <div key={booking.id} className="flex min-w-0 w-full flex-col">
                              <DigestBookingListRow
                                booking={booking}
                                onOpen={openDigestBooking}
                                compactGrid
                                unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                hasTurns={hasTurnsFeature}
                                onDotClick={handleDotClick}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="hidden min-[1390px]:grid grid-cols-3 gap-2">
                            {digestSlots.map((s: SlotConfig) => (
                              <DigestSlotHeader key={s.id} label={getSlotLabel(s)} />
                            ))}
                          </div>
                          <div className="mt-2 hidden min-[1390px]:grid grid-cols-3 gap-2 auto-rows-[minmax(0,auto)] items-start">
                              {digestSlots.map((s: SlotConfig) => (
                                <div key={s.id} className="grid min-w-0 w-full grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                                  {filterByTurn(digestTableOnlyBySlot[s.id] ?? []).map((booking) => (
                                    <div key={booking.id} className="flex min-w-0 w-full flex-col">
                                      <DigestBookingListRow
                                        booking={booking}
                                        onOpen={openDigestBooking}
                                        compactGrid
                                        unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                        assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                        hasTurns={hasTurnsFeature}
                                        onDotClick={handleDotClick}
                                      />
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                          <div className="min-[1390px]:hidden space-y-3">
                            {digestSlots.map((s: SlotConfig) => (
                              <div key={s.id} className="space-y-2">
                                <DigestSlotHeader label={getSlotLabel(s)} />
                                {filterByTurn(digestTableOnlyBySlot[s.id] ?? []).map((booking) => (
                                  <div key={booking.id} className="flex min-w-0 w-full flex-col">
                                    <DigestBookingListRow
                                      booking={booking}
                                      onOpen={openDigestBooking}
                                      compactGrid
                                      unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                      assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                      hasTurns={hasTurnsFeature}
                                      onDotClick={handleDotClick}
                                    />
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-(--color-text-muted) italic py-6 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2)/80">
                      Nessuna prenotazione solo tavolo per questa data.
                    </p>
                  )}
                </section>

                {/* Sezione orfani: booking fuori da ogni fascia oraria configurata */}
                {timeSlotsEnabled && digestSlots.length > 0 && (digestUnassignedWithMenu.length > 0 || digestUnassignedTableOnly.length > 0) && (
                  <>
                    <div className="border-t-2 border-(--color-border) pt-8 mt-2" aria-hidden />
                    <section aria-labelledby="digest-unassigned-heading">
                      <div
                        id="digest-unassigned-heading"
                        className="admin-warm-surface mb-3 flex items-center justify-center rounded-xl border px-3 py-2 text-center shadow-sm"
                      >
                        <h5 className="text-[19px]! font-semibold tracking-wide text-primary-900">
                          Fuori fascia
                        </h5>
                      </div>
                      <div className="rounded-xl border border-(--color-border) bg-surface/90 p-2 shadow-inner">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filterByTurn([...digestUnassignedWithMenu, ...digestUnassignedTableOnly]).map((booking) => (
                            <div key={booking.id} className="flex min-w-0 w-full flex-col">
                              <DigestBookingListRow
                                booking={booking}
                                onOpen={openDigestBooking}
                                showMenuPricing={digestBookingHasMenuContext(booking)}
                                compactGrid
                                unassigned={hasTurnsFeature && !assignedBookingIds.has(booking.id)}
                                assigned={hasTurnsFeature && assignedBookingIds.has(booking.id)}
                                hasTurns={hasTurnsFeature}
                                onDotClick={handleDotClick}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-(--color-text-muted) italic py-4 rounded-xl border border-dashed border-(--color-border) bg-(--color-surface-2)/80">
                Nessuna prenotazione accettata per questa data.
              </p>
            )}
          </div>

        </div>
      </div>

      {/* Modal dettaglio prenotazione */}
      {selectedBooking && (
        <BookingDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedBooking(null)
          }}
          booking={selectedBooking}
        />
      )}

      {/* Modal assegnazione/riassegnazione rapida tavolo (Pro) */}
      {quickAssignBooking && (
        <QuickTableAssignModal
          booking={quickAssignBooking}
          date={selectedDate}
          mode={assignedBookingIds.has(quickAssignBooking.id) ? 'reassign' : 'assign'}
          tableAssignments={tableAssignments as BookingTableAssignment[]}
          onClose={() => setQuickAssignBooking(null)}
        />
      )}
    </>
  )
}

