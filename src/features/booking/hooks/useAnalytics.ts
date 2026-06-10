import { useQuery } from '@tanstack/react-query'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  addWeeks,
  addMonths,
  addYears,
} from 'date-fns'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getShiftRanges, type ShiftFilter } from '@/features/booking/utils/shifts'
import { parseBusinessHours, getDayOfWeek } from '@/lib/businessHours'

export type DateRange = 'week' | 'month' | 'year'
export type { ShiftFilter }

export interface AnalyticsKpi {
  totalBookings: number
  totalCovers: number
  confirmationRate: number
  avgPartySize: number
  noShowRate: number
  bookedBy: { source: string; count: number; percentage: number }[]
}

export interface AnalyticsTrendPoint {
  date: string
  bookings: number
  covers: number
}

export interface AnalyticsData {
  kpi: AnalyticsKpi
  trend: AnalyticsTrendPoint[]
  hasData: boolean
}

export interface KpiDelta {
  value: number
  direction: 'up' | 'down' | 'neutral'
  label: string
}

export const ANALYTICS_QUERY_ROOT = 'analytics'

export const ANALYTICS_QUERY_KEY = (tenantId: string, range: DateRange, shift: ShiftFilter, offset: number) =>
  [ANALYTICS_QUERY_ROOT, tenantId, range, shift, offset] as const

type AnalyticsRow = {
  status: string
  num_guests: number | null
  created_at: string
  confirmed_start: string | null
  desired_date: string | null
  no_show: boolean
  source: string
}

/**
 * Restituisce i bounds del periodo indicato dall'offset (0=corrente, -1=precedente, +1=successivo, ecc.).
 * - week  → lunedì–domenica (ISO: firstDay=1)
 * - month → primo–ultimo giorno del mese
 * - year  → 1 gennaio–31 dicembre
 */
export function getPeriodBounds(
  range: DateRange,
  offset = 0,
): { startStr: string; endStr: string; startDay: Date; endDay: Date } {
  const now = new Date()
  let startDay: Date
  let endDay: Date

  if (range === 'week') {
    const base = startOfWeek(now, { weekStartsOn: 1 })
    startDay = startOfWeek(addWeeks(base, offset), { weekStartsOn: 1 })
    endDay = endOfWeek(startDay, { weekStartsOn: 1 })
  } else if (range === 'month') {
    const base = startOfMonth(now)
    startDay = startOfMonth(addMonths(base, offset))
    endDay = endOfMonth(startDay)
  } else {
    const base = startOfYear(now)
    startDay = startOfYear(addYears(base, offset))
    endDay = endOfYear(startDay)
  }

  return {
    startDay,
    endDay,
    startStr: format(startDay, 'yyyy-MM-dd'),
    endStr: format(endDay, 'yyyy-MM-dd'),
  }
}

/**
 * Etichetta leggibile del periodo (usata nel navigator di AnalyticsPage).
 * - week  → "Sett. 21 mag – 27 mag" oppure "Settimana corrente"
 * - month → "Maggio 2026" oppure "Mese corrente"
 * - year  → "2026" oppure "Anno corrente"
 */
export function getPeriodLabel(range: DateRange, offset: number): string {
  const { startDay, endDay } = getPeriodBounds(range, offset)
  if (range === 'week') {
    const s = format(startDay, 'd MMM', { locale: undefined })
    const e = format(endDay, 'd MMM', { locale: undefined })
    return `${s} – ${e}`
  }
  if (range === 'month') {
    return format(startDay, 'MMMM yyyy', { locale: undefined })
  }
  return format(startDay, 'yyyy')
}

function getCurrentPeriodBounds(range: DateRange, offset = 0) {
  return getPeriodBounds(range, offset)
}

function getPreviousPeriodBounds(range: DateRange, offset = 0) {
  return getPeriodBounds(range, offset - 1)
}

/**
 * Restituisce la data effettiva della prenotazione per i KPI.
 * Usiamo confirmed_start (data reale confermata) se disponibile, altrimenti
 * desired_date (intenzione del cliente), altrimenti created_at come fallback.
 */
function bookingDate(r: AnalyticsRow): string {
  const raw = r.confirmed_start ?? r.desired_date ?? r.created_at
  return format(parseISO(raw), 'yyyy-MM-dd')
}

function computeAnalytics(
  rows: AnalyticsRow[],
  startStr: string,
  endStr: string,
  startDay: Date,
  endDay: Date,
  shift: ShiftFilter,
  businessHoursRaw: unknown,
): AnalyticsData {
  const shiftRanges = getShiftRanges(businessHoursRaw)

  const active = rows.filter((r) => r.status !== 'deleted')
  const inWindow = active.filter((r) => {
    const day = bookingDate(r)
    if (day < startStr || day > endStr) return false

    if (shift !== 'all') {
      // Senza confirmed_start non possiamo classificare il turno: escludiamo la prenotazione
      if (!r.confirmed_start) return false
      const hour = new Date(r.confirmed_start).getHours()
      if (shift === 'lunch') {
        if (hour < shiftRanges.lunch.startHour || hour >= shiftRanges.lunch.endHour) return false
      } else if (shift === 'dinner') {
        if (hour < shiftRanges.dinner.startHour || hour >= shiftRanges.dinner.endHour) return false
      }
    }

    return true
  })

  let totalCovers = 0
  let acceptedCount = 0
  let noShowCount = 0
  const sourceMap = new Map<string, number>()

  for (const r of inWindow) {
    totalCovers += r.num_guests ?? 0
    if (r.status === 'accepted') {
      acceptedCount += 1
      if (r.no_show) noShowCount += 1
    }
    const src = r.source || 'public_form'
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1)
  }

  const totalBookings = inWindow.length
  const confirmationRate =
    totalBookings > 0 ? Math.round((100 * acceptedCount) / totalBookings) : 0
  const avgPartySize =
    acceptedCount > 0 ? Math.round((totalCovers / acceptedCount) * 10) / 10 : 0
  const noShowRate =
    acceptedCount > 0 ? Math.round((100 * noShowCount) / acceptedCount) : 0

  const bookedBy = Array.from(sourceMap.entries())
    .map(([source, count]) => ({
      source,
      count,
      percentage: totalBookings > 0 ? Math.round((100 * count) / totalBookings) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const byDay = new Map<string, { bookings: number; covers: number }>()
  for (const r of inWindow) {
    const day = bookingDate(r)
    const prev = byDay.get(day) ?? { bookings: 0, covers: 0 }
    prev.bookings += 1
    prev.covers += r.num_guests ?? 0
    byDay.set(day, prev)
  }

  // Per year il trend è mensile (troppi giorni per un grafico giornaliero)
  const trend: AnalyticsTrendPoint[] = eachDayOfInterval({ start: startDay, end: endDay }).map((d) => {
    const date = format(d, 'yyyy-MM-dd')
    const agg = byDay.get(date)
    return { date, bookings: agg?.bookings ?? 0, covers: agg?.covers ?? 0 }
  })

  return {
    kpi: { totalBookings, totalCovers, confirmationRate, avgPartySize, noShowRate, bookedBy },
    trend,
    hasData: totalBookings > 0,
  }
}

/**
 * Calcola il tasso di occupazione come percentuale di coperti rispetto alla capacità totale del periodo.
 * Denominatore: posti × giorni aperti nel periodo (esclude i giorni in cui il locale è chiuso).
 * Se business_hours non è disponibile, usa tutti i giorni come fallback.
 */
export function computeOccupancyRate(
  totalCovers: number,
  totalSeats: number,
  range: DateRange,
  businessHoursRaw?: unknown,
  offset = 0,
): number | null {
  if (totalSeats <= 0) return null
  const { startDay, endDay } = getPeriodBounds(range, offset)

  const days = eachDayOfInterval({ start: startDay, end: endDay })
  const businessHours = parseBusinessHours(businessHoursRaw)

  const openDays = businessHours
    ? days.filter((d) => {
        const dayName = getDayOfWeek(format(d, 'yyyy-MM-dd'))
        const slots = businessHours[dayName]
        return slots != null && slots.length > 0
      }).length
    : days.length

  const maxCovers = totalSeats * openDays
  return maxCovers > 0 ? Math.round((totalCovers / maxCovers) * 100) : null
}

export function useAnalytics(range: DateRange, shift: ShiftFilter = 'all', businessHoursRaw?: unknown, offset = 0) {
  const { tenantId } = useTenantContext()

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEY(tenantId ?? '', range, shift, offset),
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { startDay, startStr, endStr, endDay } = getCurrentPeriodBounds(range, offset)

      const res = await supabase
        .from('booking_requests')
        .select('status, num_guests, created_at, confirmed_start, desired_date, no_show, source')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay(startDay).toISOString())
        .lte('created_at', endDay.toISOString())

      if (res.error) {
        logger.error('[useAnalytics] booking_requests', res.error)
        throw new Error(res.error.message)
      }

      const rows = (res.data ?? []) as AnalyticsRow[]
      return computeAnalytics(rows, startStr, endStr, startDay, endDay, shift, businessHoursRaw)
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  }
}

/**
 * Calcola gli stessi KPI sul periodo precedente per il delta.
 * Periodo precedente: settimana/mese/anno precedente rispetto al corrente.
 */
export function useAnalyticsComparison(
  range: DateRange,
  shift: ShiftFilter = 'all',
  businessHoursRaw?: unknown,
  offset = 0,
) {
  const { tenantId } = useTenantContext()

  const query = useQuery({
    queryKey: [ANALYTICS_QUERY_ROOT, tenantId, range, shift, offset, 'comparison'] as const,
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { startDay, startStr, endStr, endDay } = getPreviousPeriodBounds(range, offset)

      const res = await supabase
        .from('booking_requests')
        .select('status, num_guests, created_at, confirmed_start, desired_date, no_show, source')
        .eq('tenant_id', tenantId)
        .gte('created_at', startOfDay(startDay).toISOString())
        .lte('created_at', endDay.toISOString())

      if (res.error) {
        logger.error('[useAnalyticsComparison] booking_requests', res.error)
        throw new Error(res.error.message)
      }

      const rows = (res.data ?? []) as AnalyticsRow[]
      return computeAnalytics(rows, startStr, endStr, startDay, endDay, shift, businessHoursRaw)
    },
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
  }
}

/**
 * Calcola il delta tra periodo corrente e precedente per un KPI numerico.
 * Restituisce null se il periodo precedente è zero (evita divisione per zero).
 */
export function computeKpiDelta(current: number, previous: number): KpiDelta | null {
  if (previous === 0) return null
  const diff = current - previous
  const pct = Math.round((Math.abs(diff) / previous) * 100)
  return {
    value: pct,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
    label: `${pct}% vs periodo prec.`,
  }
}
