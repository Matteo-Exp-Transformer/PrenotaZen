/**
 * View model puro per il digest giornaliero delle prenotazioni.
 * Nessuna dipendenza React, nessun side-effect → unit-testabile.
 *
 * Fase 0 del plan clever-flute: estrarre la logica di raggruppamento
 * in un util puro prima di toccare la UI.
 */

import type { BookingRequest } from '@/types/booking'
import {
  getAccurateStartTime,
  startTimeToMinutesSinceMidnight,
} from './dateUtils'
import { getSlotLabel, parseHmToMinutes } from './bookingTimeSlots'
import type { SlotConfig } from './bookingTimeSlots'
import { digestBookingHasMenuContext, splitBookingsBySlotConfigs } from './digestBookingUtils'

// ---------------------------------------------------------------------------
// Tipi pubblici del view model
// ---------------------------------------------------------------------------

export type DayDigestSummary = {
  totalBookings: number
  totalGuests: number
  withMenuCount: number
  /** Valorizzato solo se isPro=true; altrimenti 0. Il componente lo nasconde in Classic. */
  pendingAssignments: number
  outOfSlotCount: number
}

export type DayHourGroup = {
  /** Es. "13:00" — ora piena di inizio blocco */
  hourLabel: string
  bookings: BookingRequest[]
}

export type DayServiceGroup = {
  /** ID della fascia (service_slots.id), null per il gruppo fuori-fascia */
  slotId: string | null
  /** Es. "Pranzo" */
  label: string
  /** Es. "11:31 - 15:30", null per il gruppo fuori-fascia */
  timeRange: string | null
  isOutOfSlot: boolean
  totalBookings: number
  totalGuests: number
  /** Numero di prenotazioni accettate senza tavolo assegnato (PRO only, 0 altrimenti) */
  pendingAssignments: number
  hourGroups: DayHourGroup[]
}

export type DayDigestModel = {
  summary: DayDigestSummary
  /** Gruppi ordinati per orario di inizio fascia */
  groups: DayServiceGroup[]
  /** null se non ci sono prenotazioni fuori fascia */
  outOfSlot: DayServiceGroup | null
}

// ---------------------------------------------------------------------------
// Opzioni builder
// ---------------------------------------------------------------------------

export type BuildDayDigestOptions = {
  /** Se true calcola pendingAssignments; se false restituisce sempre 0. */
  isPro: boolean
  /** Set di booking_id con tavolo assegnato (usato per calcolare pendingAssignments). */
  assignedBookingIds?: Set<string>
}

// ---------------------------------------------------------------------------
// Funzione pura principale
// ---------------------------------------------------------------------------

/**
 * Costruisce il DayDigestModel a partire dall'elenco di prenotazioni del giorno
 * e dalla configurazione delle fasce orarie.
 *
 * Precondizioni (gestite dal chiamante):
 * - `bookings` contiene solo prenotazioni accettate (!no_show) del giorno selezionato,
 *   già filtrate per data, già ordinate per orario o non ordinate (la funzione ordina internamente).
 * - `slotConfigs` è la lista ordinata delle fasce (useDigestSlotConfigs).
 */
export function buildDayDigestModel(
  bookings: BookingRequest[],
  slotConfigs: SlotConfig[],
  options: BuildDayDigestOptions,
): DayDigestModel {
  const { isPro, assignedBookingIds = new Set() } = options

  // Ordinamento stabile: per orario crescente, a parità per client_name
  const sorted = [...bookings].sort((a, b) => {
    const ma = startTimeToMinutesSinceMidnight(getAccurateStartTime(a)) ?? (24 * 60)
    const mb = startTimeToMinutesSinceMidnight(getAccurateStartTime(b)) ?? (24 * 60)
    if (ma !== mb) return ma - mb
    return (a.client_name ?? '').localeCompare(b.client_name ?? '', 'it')
  })

  // Partiziona le prenotazioni nelle fasce
  const bySlot = splitBookingsBySlotConfigs(sorted, slotConfigs)
  const outOfSlotBookings = bySlot['__unassigned__'] ?? []

  // Costruisce un DayServiceGroup per ogni fascia
  const groups: DayServiceGroup[] = slotConfigs.map((slot) => {
    const slotBookings = bySlot[slot.id] ?? []
    return _buildServiceGroup(slot, slotBookings, isPro, assignedBookingIds)
  })

  // Gruppo fuori-fascia (solo se ci sono prenotazioni non coperte)
  const outOfSlot: DayServiceGroup | null =
    outOfSlotBookings.length > 0
      ? _buildOutOfSlotGroup(outOfSlotBookings, isPro, assignedBookingIds)
      : null

  // Summary globale
  const withMenuCount = sorted.filter(digestBookingHasMenuContext).length
  const outOfSlotCount = outOfSlotBookings.length

  let pendingAssignments = 0
  if (isPro) {
    for (const b of sorted) {
      if (!assignedBookingIds.has(b.id)) pendingAssignments++
    }
  }

  const summary: DayDigestSummary = {
    totalBookings: sorted.length,
    totalGuests: sorted.reduce((acc, b) => acc + (b.num_guests ?? 0), 0),
    withMenuCount,
    pendingAssignments,
    outOfSlotCount,
  }

  return { summary, groups, outOfSlot }
}

// ---------------------------------------------------------------------------
// Funzioni interne
// ---------------------------------------------------------------------------

function _buildServiceGroup(
  slot: SlotConfig,
  bookings: BookingRequest[],
  isPro: boolean,
  assignedBookingIds: Set<string>,
): DayServiceGroup {
  const hourGroups = _buildHourGroups(bookings, slot.start_time)
  const totalGuests = bookings.reduce((acc, b) => acc + (b.num_guests ?? 0), 0)
  const pendingAssignments = isPro
    ? bookings.filter((b) => !assignedBookingIds.has(b.id)).length
    : 0

  return {
    slotId: slot.id,
    label: slot.name,
    timeRange: `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`,
    isOutOfSlot: false,
    totalBookings: bookings.length,
    totalGuests,
    pendingAssignments,
    hourGroups,
  }
}

function _buildOutOfSlotGroup(
  bookings: BookingRequest[],
  isPro: boolean,
  assignedBookingIds: Set<string>,
): DayServiceGroup {
  // Per il gruppo fuori-fascia, usiamo l'ora della prima prenotazione come ancora
  const firstStartTime =
    bookings.length > 0 ? getAccurateStartTime(bookings[0]) : '00:00'

  const hourGroups = _buildHourGroups(bookings, firstStartTime)
  const totalGuests = bookings.reduce((acc, b) => acc + (b.num_guests ?? 0), 0)
  const pendingAssignments = isPro
    ? bookings.filter((b) => !assignedBookingIds.has(b.id)).length
    : 0

  return {
    slotId: null,
    label: 'Fuori fascia',
    timeRange: null,
    isOutOfSlot: true,
    totalBookings: bookings.length,
    totalGuests,
    pendingAssignments,
    hourGroups,
  }
}

/**
 * Raggruppa prenotazioni in blocchi orari di 1 ora.
 *
 * Regola orario: il primo blocco di una fascia che inizia a orario non pieno
 * usa l'ora piena corrispondente (es. fascia 11:31 → primo blocco "11:00").
 * Le prenotazioni successive usano la loro ora piena reale.
 * Blocchi vuoti non vengono emessi.
 */
function _buildHourGroups(
  bookings: BookingRequest[],
  slotStartTime: string,
): DayHourGroup[] {
  if (bookings.length === 0) return []

  // Ora piena della fascia (non per-booking, ma per determinare l'ancora del primo blocco)
  const slotStartMin = parseHmToMinutes(slotStartTime)
  const slotAnchorHour = Math.floor(slotStartMin / 60)

  const grouped = new Map<string, BookingRequest[]>()

  for (const booking of bookings) {
    const startTime = getAccurateStartTime(booking)
    const bookingMin = parseHmToMinutes(startTime)
    const bookingHour = Math.floor(bookingMin / 60)

    // Se la prenotazione cade nell'ora piena della fascia (o nella prima ora),
    // usa l'ancora della fascia come label; altrimenti usa la sua ora piena.
    const effectiveHour =
      bookingHour === slotAnchorHour ? slotAnchorHour : bookingHour

    const label = `${String(effectiveHour).padStart(2, '0')}:00`
    if (!grouped.has(label)) grouped.set(label, [])
    grouped.get(label)!.push(booking)
  }

  // Ordina i blocchi orari per ora crescente
  return Array.from(grouped.entries())
    .sort(([a], [b]) => {
      const ha = parseInt(a, 10)
      const hb = parseInt(b, 10)
      return ha - hb
    })
    .map(([hourLabel, group]) => ({ hourLabel, bookings: group }))
}

/** Etichetta fascia completa (nome + orari) — wrapper su getSlotLabel per coerenza. */
export function getDayServiceGroupLabel(group: DayServiceGroup): string {
  if (group.isOutOfSlot) return group.label
  if (group.timeRange) return `${group.label} ${group.timeRange}`
  return group.label
}

/** Alias di getSlotLabel per il view model (riusa l'helper originale). */
export { getSlotLabel }
