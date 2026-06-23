import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabasePublic } from '@/lib/supabasePublic'
import { logger } from '@/lib/logger'
import {
  deriveArrivalTimes,
  type ArrivalTime,
} from '@/features/booking/utils/bookingTimeSlots'

export interface SlotArrivalGroup {
  slot_id: string
  slot_name: string
  start_time: string
  end_time: string
  arrival_step_minutes: number
  /** Slot di arrivo con flag isValid (cutoff + durata + capacità) */
  times: ArrivalTime[]
}

export interface UseArrivalSlotsResult {
  /** true se ci sono fasce canonical con booking_time_slots_enabled=true */
  hasSlots: boolean
  slots: SlotArrivalGroup[]
  isLoading: boolean
  error: Error | null
}

interface UseArrivalSlotsOptions {
  tenantSlug: string
  /** Data selezionata (YYYY-MM-DD) */
  date: string | null
  /** Durata della card/tipologia selezionata (minuti, 0 = senza vincolo) */
  cardDurationMinutes?: number
  numGuests?: number
}

function zonedNow(timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  }
}

export function useArrivalSlots({
  tenantSlug,
  date,
  cardDurationMinutes = 0,
  numGuests = 1,
}: UseArrivalSlotsOptions): UseArrivalSlotsResult {

  // Step 1: configurazione fasce pubblica (SECURITY DEFINER, anon safe)
  const configQuery = useQuery({
    queryKey: ['public_slot_config', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabasePublic
        .rpc('get_public_slot_config', { p_slug: tenantSlug })
      if (error) throw error
      return data ?? []
    },
    enabled: !!tenantSlug,
    staleTime: 5 * 60 * 1000,
  })

  const rawSlots = configQuery.data ?? []
  const hasSlots = rawSlots.length > 0

  // Step 2: se slot_limit_enabled, recupera tempi disponibili per capacità
  const slotLimitEnabled = hasSlots && rawSlots[0].slot_limit_enabled

  const capacityQuery = useQuery({
    queryKey: ['arrival_times_capacity', tenantSlug, date, cardDurationMinutes, numGuests],
    queryFn: async () => {
      if (!date) return []
      const { data, error } = await supabasePublic
        .rpc('get_available_arrival_times', {
          p_slug: tenantSlug,
          p_date: date,
          p_card_duration: cardDurationMinutes,
          p_num_guests: Math.max(1, numGuests),
        })
      if (error) throw error
      return data ?? []
    },
    enabled: !!tenantSlug && !!date && slotLimitEnabled,
    staleTime: 30 * 1000,
  })

  // Mappa per-slot: slot_id → Set<time> (tempi con capacità libera)
  const capacityMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (slotLimitEnabled && capacityQuery.data) {
      for (const row of capacityQuery.data) map.set(row.slot_id, new Set(row.available_times))
    }
    return map
  }, [capacityQuery.data, slotLimitEnabled])

  const timezone = rawSlots[0]?.timezone || 'Europe/Rome'
  const now = zonedNow(timezone)
  const isToday = !!date && date === now.date

  const slots: SlotArrivalGroup[] = useMemo(() => rawSlots.map((s) => {
    const allTimes = deriveArrivalTimes(
      {
        slot_start: s.start_time,
        slot_end: s.end_time,
        arrival_step_minutes: s.arrival_step_minutes,
        card_duration_minutes: cardDurationMinutes || undefined,
        slot_min_duration: s.min_duration ?? undefined,
        cutoff_minutes: s.cutoff_minutes,
        late_arrival_allowed: s.late_arrival_allowed,
        min_order_time_minutes: s.min_order_time_minutes,
      },
      now.minutes,
      isToday,
    )

    let times: ArrivalTime[]
    if (slotLimitEnabled) {
      const available = capacityMap.get(s.slot_id)
      if (!available) {
        // Slot pieno o dati non ancora caricati
        times = allTimes.map((t) => ({ ...t, isValid: false }))
      } else {
        times = allTimes.map((t) => ({
          ...t,
          isValid: t.isValid && available.has(t.time),
        }))
      }
    } else {
      times = allTimes
    }

    logger.debug('[useArrivalSlots]', {
      slot: s.slot_name,
      date,
      total: allTimes.length,
      valid: times.filter((t) => t.isValid).length,
    })

    return {
      slot_id: s.slot_id,
      slot_name: s.slot_name,
      start_time: s.start_time,
      end_time: s.end_time,
      arrival_step_minutes: s.arrival_step_minutes,
      times,
    }
  }), [cardDurationMinutes, capacityMap, date, isToday, now.minutes, rawSlots, slotLimitEnabled])

  const isLoading =
    configQuery.isLoading || (slotLimitEnabled && capacityQuery.isLoading)

  const error =
    (configQuery.error as Error | null) ??
    (slotLimitEnabled ? (capacityQuery.error as Error | null) : null)

  return { hasSlots, slots, isLoading, error }
}
