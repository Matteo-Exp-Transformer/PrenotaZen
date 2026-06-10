import { useQuery } from '@tanstack/react-query'
import { format, startOfDay } from 'date-fns'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { getShiftRanges, type ShiftFilter } from '@/features/booking/utils/shifts'

export interface BriefingBooking {
  id: string
  client_name: string
  num_guests: number
  confirmed_start: string
  special_requests: string | null
  table_name: string | null
  room_name: string | null
}

export interface ShiftBriefingData {
  bookings: BriefingBooking[]
  totalBookings: number
  totalCovers: number
  date: string
  shiftLabel: string
}

export function useShiftBriefing(shift: ShiftFilter = 'all', businessHoursRaw?: unknown) {
  const { tenantId } = useTenantContext()

  return useQuery<ShiftBriefingData>({
    queryKey: ['shift-briefing', tenantId, shift] as const,
    enabled: Boolean(tenantId),
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
      const todayStart = startOfDay(new Date()).toISOString()
      const todayEnd = new Date(startOfDay(new Date()).getTime() + 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('booking_requests')
        .select('id, client_name, num_guests, confirmed_start, special_requests')
        .eq('tenant_id', tenantId)
        .eq('status', 'accepted')
        .eq('no_show', false)
        .gte('confirmed_start', todayStart)
        .lt('confirmed_start', todayEnd)
        .order('confirmed_start', { ascending: true })

      if (error) {
        logger.error('[useShiftBriefing] booking_requests', error)
        throw new Error(error.message)
      }

      const shiftRanges = getShiftRanges(businessHoursRaw)
      const shiftLabels: Record<ShiftFilter, string> = {
        all: 'Giornata completa',
        lunch: 'Pranzo',
        dinner: 'Cena',
      }

      const raw = (data ?? []) as {
        id: string
        client_name: string
        num_guests: number | null
        confirmed_start: string
        special_requests: string | null
      }[]

      const filtered = raw.filter((row) => {
        if (shift === 'all') return true
        const hour = new Date(row.confirmed_start).getHours()
        if (shift === 'lunch') {
          return hour >= shiftRanges.lunch.startHour && hour < shiftRanges.lunch.endHour
        }
        return hour >= shiftRanges.dinner.startHour && hour < shiftRanges.dinner.endHour
      })

      const bookings: BriefingBooking[] = filtered.map((row) => ({
        id: row.id,
        client_name: row.client_name,
        num_guests: row.num_guests ?? 0,
        confirmed_start: row.confirmed_start,
        special_requests: row.special_requests,
        table_name: null, // TODO: join con tables in fase futura
        room_name: null,
      }))

      return {
        bookings,
        totalBookings: bookings.length,
        totalCovers: bookings.reduce((s, b) => s + b.num_guests, 0),
        date: today,
        shiftLabel: shiftLabels[shift],
      }
    },
  })
}
