import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { format } from 'date-fns'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { createBookingDateTime } from '@/features/booking/utils/dateUtils'
import { ANALYTICS_QUERY_ROOT } from './useAnalytics'
import { HOME_STATS_QUERY_KEY } from './useHomeStats'

export interface WalkInInput {
  client_name?: string
  num_guests: number
  table_id?: string | null
  placement?: string
}

/**
 * Crea una prenotazione walk-in: status accepted, source walk_in,
 * confirmed_start / confirmed_end con orario locale “a muro” (stesso schema di
 * `createBookingDateTime` per il resto dell’admin — evita `toISOString()` UTC che
 * sposta l’ora in calendario). desired_time allineato per digest / getAccurateStartTime.
 * Non invia email, non applica rate-limit. Admin-only — client `supabase` autenticato.
 */
export function useWalkInMutation() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: WalkInInput) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const now = new Date()
      const desiredDate = format(now, 'yyyy-MM-dd')
      const desiredTime = format(now, 'HH:mm')
      const confirmedStart = createBookingDateTime(desiredDate, desiredTime)

      const endAt = new Date(now.getTime() + 90 * 60 * 1000)
      const endDate = format(endAt, 'yyyy-MM-dd')
      const endTime = format(endAt, 'HH:mm')
      const confirmedEnd = createBookingDateTime(endDate, endTime, false, desiredTime)

      const { data, error } = await supabase
        .from('booking_requests')
        .insert({
          tenant_id: tenantId,
          client_name: input.client_name?.trim() || 'Walk-in',
          client_email: '',
          num_guests: input.num_guests,
          desired_date: desiredDate,
          desired_time: desiredTime,
          status: 'accepted',
          booking_type: 'walk_in',
          source: 'walk_in',
          confirmed_start: confirmedStart,
          confirmed_end: confirmedEnd,
          ...(input.placement ? { placement: input.placement } : {}),
        })
        .select('id')
        .single()

      if (error) {
        logger.error('[useWalkInMutation] DB error', error)
        throw new Error(error.message)
      }

      return data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId], refetchType: 'all' }),
      ])
      toast.success('Walk-in aggiunto')
    },
    onError: (e: Error) => {
      logger.error('[useWalkInMutation] mutation error', e)
      toast.error(e.message || 'Errore aggiunta walk-in')
    },
  })
}
