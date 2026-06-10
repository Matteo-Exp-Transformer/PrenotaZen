import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, useEffect } from 'react'
import { addHours, format, startOfDay } from 'date-fns'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { extractTimeFromISO, trimTimeToHHmm } from '@/features/booking/utils/dateUtils'

export const HOME_STATS_QUERY_KEY = 'home-stats'

interface HomeStatsRow {
  id: string
  status: string
  source: string | null
  num_guests: number | null
  desired_date: string
  desired_time: string | null
  confirmed_start: string | null
  confirmed_end: string | null
  client_name: string
}

export interface HomeStatValues {
  /** Prenotazioni con evento oggi (pending + accepted). */
  totalToday: number
  /** Somma `num_guests` per le accepted con `confirmed_start` di oggi. */
  confirmedCoversToday: number
  /** Pending con `desired_date` oggi. */
  pendingToday: number
}

export interface UpcomingBooking {
  id: string
  client_name: string
  num_guests: number
  /** Inizio confermato come Date locale, già parsato. Usato solo per ordinamento e confronto temporale. */
  start: Date
  /** Orario da mostrare in UI — estratto da desired_time o dalle cifre letterali dell'ISO (+00:00). */
  start_time: string
}

export interface HomeStatsData {
  stats: HomeStatValues
  upcoming: UpcomingBooking[]
  rawRows: HomeStatsRow[]
}

const EMPTY_STATS: HomeStatValues = {
  totalToday: 0,
  confirmedCoversToday: 0,
  pendingToday: 0,
}

/** Estrae 'YYYY-MM-DD' dalla parte data di una ISO string senza convertire fuso. */
function extractDateFromIso(iso: string): string | null {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** Data evento: `confirmed_start` per accepted, `desired_date` per pending. */
function eventDateFor(row: HomeStatsRow): string | null {
  if (row.status === 'accepted' && row.confirmed_start) {
    return extractDateFromIso(row.confirmed_start)
  }
  if (row.status === 'pending') {
    return row.desired_date
  }
  return null
}

/**
 * Costruisce un Date locale (wall clock) dalle cifre letterali dell'ISO string,
 * ignorando l'offset. Necessario perché confirmedStart è salvato con +00:00 ma
 * le cifre rappresentano l'orario a muro inserito dall'utente (non UTC reale).
 * Usare `new Date(isoString)` convertirebbe al fuso locale e sposterebbe il confronto.
 */
function wallClockDateFromISO(iso: string): Date | null {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Calcola upcoming dalla lista grezza con il `now` passato — chiamabile anche da un tick locale. */
export function computeUpcoming(rows: HomeStatsRow[], now: Date): UpcomingBooking[] {
  const upcomingCutoff = addHours(now, 3)
  // I walk-in rimangono visibili anche se l'orario è già passato, fino a 5 minuti dopo l'inizio.
  const walkInPastCutoff = new Date(now.getTime() - 5 * 60 * 1000)
  const result: UpcomingBooking[] = []

  for (const row of rows) {
    if (row.status !== 'accepted' || !row.confirmed_start) continue
    const start = wallClockDateFromISO(row.confirmed_start)
    if (!start || start > upcomingCutoff) continue

    const isWalkIn = row.source === 'walk_in'
    const lowerBound = isWalkIn ? walkInPastCutoff : now
    if (start < lowerBound) continue

    result.push({
      id: row.id,
      client_name: row.client_name,
      num_guests: row.num_guests ?? 0,
      start,
      start_time: row.desired_time
        ? trimTimeToHHmm(row.desired_time)
        : extractTimeFromISO(row.confirmed_start),
    })
  }

  result.sort((a, b) => a.start.getTime() - b.start.getTime())
  return result
}

export function computeHomeStats(rows: HomeStatsRow[], now: Date): HomeStatsData {
  const today = format(startOfDay(now), 'yyyy-MM-dd')

  let totalToday = 0
  let confirmedCoversToday = 0
  let pendingToday = 0

  for (const row of rows) {
    const eventDate = eventDateFor(row)
    if (eventDate === today) {
      if (row.status === 'pending') {
        pendingToday += 1
        totalToday += 1
      } else if (row.status === 'accepted') {
        totalToday += 1
        confirmedCoversToday += row.num_guests ?? 0
      }
    }
  }

  return {
    stats: { totalToday, confirmedCoversToday, pendingToday },
    upcoming: computeUpcoming(rows, now),
    rawRows: rows,
  }
}

export function useHomeStats() {
  const { tenantId } = useTenantContext()

  // Tick ogni 60s per ricalcolare upcoming senza refetch al DB
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const query = useQuery({
    queryKey: [HOME_STATS_QUERY_KEY, tenantId],
    enabled: Boolean(tenantId),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const todayStartIso = startOfDay(new Date()).toISOString()

      const res = await supabase
        .from('booking_requests')
        .select(
          'id, status, source, num_guests, desired_date, desired_time, confirmed_start, confirmed_end, client_name',
        )
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'accepted'])
        // Limita al solo giorno corrente: pending per desired_date, accepted per confirmed_start
        .or(`desired_date.gte.${today},confirmed_start.gte.${todayStartIso}`)

      if (res.error) {
        logger.error('[useHomeStats] booking_requests', res.error)
        throw new Error(res.error.message)
      }

      return (res.data ?? []) as HomeStatsRow[]
    },
  })

  const rawRows = query.data ?? []

  const stats = useMemo(() => {
    if (!rawRows.length) return EMPTY_STATS
    return computeHomeStats(rawRows, now).stats
  }, [rawRows, now])

  const upcoming = useMemo(() => computeUpcoming(rawRows, now), [rawRows, now])

  return {
    stats,
    upcoming,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}
