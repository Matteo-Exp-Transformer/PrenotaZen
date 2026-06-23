import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import type { BookingRequest, BookingType } from '@/types/booking'
import { toast } from 'react-toastify'
import {
  sendBookingAcceptedEmail,
  sendBookingRejectedEmail,
  areEmailNotificationsEnabled,
} from './useEmailNotifications'
import { ANALYTICS_QUERY_ROOT } from './useAnalytics'
import { HOME_STATS_QUERY_KEY } from './useHomeStats'
import { useTenantContext } from '@/contexts/TenantContext'
import { logger } from '@/lib/logger'
import { extractTimeFromISO } from '@/features/booking/utils/dateUtils'
import type { Json, TablesUpdate } from '@/types/database'

/**
 * Race guard: update con 0 righe (lo stato del record è cambiato sotto i piedi —
 * es. eliminata/gestita in un'altra scheda). Il valore è un messaggio leggibile:
 * se affiora in un banner (es. salvataggio dettagli) resta comprensibile.
 */
const BOOKING_ALREADY_HANDLED = 'Questa prenotazione non è più disponibile: aggiorna la pagina e riprova.'

async function invalidateAllBookingQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId: string | null | undefined,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId], refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId], refetchType: 'all' }),
  ])
}

interface AcceptBookingInput {
  bookingId: string
  confirmedStart: string
  confirmedEnd: string
  desiredTime?: string
  numGuests?: number
  internalNotes?: string
  durationSnapshot?: Pick<BookingRequest, 'duration_minutes' | 'duration_source' | 'duration_rule_version'>
}

interface RejectBookingInput {
  bookingId: string
  rejectionReason?: string
}

interface UpdateBookingInput {
  bookingId: string
  booking_type?: BookingType
  client_name?: string
  client_email?: string | null
  client_phone?: string | null
  confirmedStart: string
  confirmedEnd: string
  numGuests: number
  specialRequests?: string | null
  desiredTime?: string
  menu_selection?: BookingRequest['menu_selection'] | null
  menu_total_per_person?: number
  menu_total_booking?: number
  dietary_restrictions?: BookingRequest['dietary_restrictions'] | null
  preset_menu?: string
  menu?: string
  placement?: string | null
  adminNotes?: string | null
  durationSnapshot?: Pick<BookingRequest, 'duration_minutes' | 'duration_source' | 'duration_rule_version'>
}

// Mutation per accettare una prenotazione
export const useAcceptBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: AcceptBookingInput) => {
      // desired_time deve essere sempre presente: è l'ancora contro il round-trip timestamptz.
      // Se il chiamante non lo passa, lo deriviamo da confirmedStart (che è ancora nostro,
      // scritto con createBookingDateTime con offset +00:00 = cifre = orario locale).
      const resolvedDesiredTime = input.desiredTime ?? extractTimeFromISO(input.confirmedStart)
      const updateData: TablesUpdate<'booking_requests'> = {
        status: 'accepted',
        confirmed_start: input.confirmedStart,
        confirmed_end: input.confirmedEnd,
        num_guests: input.numGuests,
        updated_at: new Date().toISOString(),
        desired_time: resolvedDesiredTime || null,
        ...(input.durationSnapshot?.duration_minutes != null ? input.durationSnapshot : {}),
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .update(updateData)
        .eq('id', input.bookingId)
        .eq('tenant_id', tenantId!)
        .eq('status', 'pending')
        .select()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0] as unknown as BookingRequest
    },
    onSuccess: async (booking: BookingRequest) => {
      await invalidateAllBookingQueries(queryClient, tenantId)

      // Send email notification
      const emailEnabled = areEmailNotificationsEnabled()
      
      if (emailEnabled) {
        try {
          const result = await sendBookingAcceptedEmail(booking)
          if (!result.success) {
            toast.warn('Prenotazione accettata, ma email al cliente non inviata.')
          }
        } catch (error) {
          logger.warn('[useAcceptBooking] Email opzionale non inviata', error)
          toast.warn('Prenotazione accettata, ma email al cliente non inviata.')
        }
      } else {
      }
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn('Questa prenotazione è già stata gestita')
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      logger.error('[useAcceptBooking] mutation error', error)
    },
  })
}

// Mutation per rifiutare una prenotazione
export const useRejectBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: RejectBookingInput) => {
      const updateData: TablesUpdate<'booking_requests'> = {
        status: 'rejected',
        rejection_reason: input.rejectionReason || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .update(updateData)
        .eq('id', input.bookingId)
        .eq('tenant_id', tenantId!)
        .eq('status', 'pending')
        .select()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0] as unknown as BookingRequest
    },
    onSuccess: async (booking: BookingRequest) => {
      await invalidateAllBookingQueries(queryClient, tenantId)

      // Send email notification
      if (areEmailNotificationsEnabled()) {
        try {
          const result = await sendBookingRejectedEmail(booking)
          if (!result.success) {
            toast.warn('Prenotazione rifiutata, ma email al cliente non inviata.')
          }
        } catch (error) {
          logger.warn('[useRejectBooking] Email opzionale non inviata', error)
          toast.warn('Prenotazione rifiutata, ma email al cliente non inviata.')
        }
      }
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn('Questa prenotazione è già stata gestita')
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      logger.error('[useRejectBooking] mutation error', error)
    },
  })
}

// Mutation per aggiornare una prenotazione
export const useUpdateBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: UpdateBookingInput) => {
      const updateData: TablesUpdate<'booking_requests'> = {
        updated_at: new Date().toISOString(),
        confirmed_start: input.confirmedStart,
        confirmed_end: input.confirmedEnd,
        num_guests: input.numGuests,
        desired_time: input.desiredTime ?? extractTimeFromISO(input.confirmedStart) ?? null,
        ...(input.durationSnapshot?.duration_minutes != null ? input.durationSnapshot : {}),
      }

      // Update client information if provided
      if (input.client_name !== undefined) {
        updateData.client_name = input.client_name
      }
      if (input.client_email !== undefined) {
        // DB: client_email è NOT NULL (default ''). Non inviare mai null.
        const raw = input.client_email === null || input.client_email === undefined
          ? ''
          : String(input.client_email).trim()
        updateData.client_email = raw
      }
      if (input.client_phone !== undefined) {
        updateData.client_phone = input.client_phone || null
      }

      // Update booking type if provided
      if (input.booking_type !== undefined) {
        updateData.booking_type = input.booking_type
      }

      // Update special requests if provided
      if (input.specialRequests !== undefined) {
        updateData.special_requests = input.specialRequests || null
      }
      
      // Update menu fields if provided
      if (input.menu !== undefined) {
        updateData.menu = input.menu || null
      }
      if (input.menu_selection !== undefined) {
        updateData.menu_selection = input.menu_selection ? (input.menu_selection as unknown as Json) : null
      }
      if (input.menu_total_per_person !== undefined) {
        updateData.menu_total_per_person = input.menu_total_per_person || null
      }
      if (input.menu_total_booking !== undefined) {
        updateData.menu_total_booking = input.menu_total_booking || null
      }
      if (input.dietary_restrictions !== undefined) {
        updateData.dietary_restrictions = input.dietary_restrictions
          ? (input.dietary_restrictions as unknown as Json)
          : null
      }
      if (input.preset_menu !== undefined) {
        updateData.preset_menu = input.preset_menu || null
      }

      // Update placement if provided
      if (input.placement !== undefined) {
        updateData.placement = input.placement || null
      }

      // Update admin notes if provided
      if (input.adminNotes !== undefined) {
        updateData.admin_notes = input.adminNotes || null
      }

      // D6: guard di stato — non aggiornare silenziosamente una prenotazione
      // già eliminata (cambio stato sotto i piedi in un'altra scheda/sessione).
      const { data, error } = await supabase
        .from('booking_requests')
        .update(updateData)
        .eq('id', input.bookingId)
        .eq('tenant_id', tenantId!)
        .neq('status', 'deleted')
        .select()

      if (error) {
        logger.error('[useUpdateBooking] DB error', error)
        throw new Error(handleSupabaseError(error))
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0] as unknown as BookingRequest
    },
    onSuccess: async (data) => {
      
      // Aggiorna direttamente la cache con i dati aggiornati per tutte le query che potrebbero contenere questa prenotazione
      // Usa un approccio sicuro che gestisce diversi formati di dati nella cache
      queryClient.setQueriesData(
        { queryKey: ['bookings'] },
        (oldData: unknown) => {
          if (!oldData) return oldData
          // Verifica che oldData sia un array
          if (Array.isArray(oldData)) {
            return oldData.map((booking: BookingRequest) => 
              booking.id === data.id ? data : booking
            )
          }
          // Se non è un array, restituisci i dati originali (potrebbe essere un oggetto o altro formato)
          return oldData
        }
      )
      
      queryClient.setQueriesData(
        { queryKey: ['bookings', 'pending'] },
        (oldData: unknown) => {
          if (!oldData) return oldData
          if (Array.isArray(oldData)) {
            return oldData.map((booking: BookingRequest) => 
              booking.id === data.id ? data : booking
            )
          }
          return oldData
        }
      )
      
      queryClient.setQueriesData(
        { queryKey: ['bookings', 'accepted'] },
        (oldData: unknown) => {
          if (!oldData) return oldData
          if (Array.isArray(oldData)) {
            return oldData.map((booking: BookingRequest) => 
              booking.id === data.id ? data : booking
            )
          }
          return oldData
        }
      )
      
      // Invalida anche le query per forzare un refetch e assicurarsi che tutto sia sincronizzato
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'] })
      await queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId] })
      await queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId] })
      toast.success('Prenotazione aggiornata con successo!')
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn(BOOKING_ALREADY_HANDLED)
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      logger.error('[useUpdateBooking] mutation error', error)
      toast.error(error.message || 'Errore nell\'aggiornamento della prenotazione')
    },
  })
}

export type RestoreBookingInput =
  | string
  | {
      bookingId: string
      confirmedStart: string
      confirmedEnd: string
      desiredTime: string
    }

// Mutation per ripristinare una prenotazione eliminata
export const useRestoreBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: RestoreBookingInput) => {
      const bookingId = typeof input === 'string' ? input : input.bookingId
      const providedTimes = typeof input === 'string' ? null : input

      const updatePayload: TablesUpdate<'booking_requests'> = {
        status: 'accepted',
        cancellation_reason: null,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      }

      if (providedTimes) {
        updatePayload.confirmed_start = providedTimes.confirmedStart
        updatePayload.confirmed_end = providedTimes.confirmedEnd
        updatePayload.desired_time = providedTimes.desiredTime
      } else {
        const { data: bookingToRestore, error: fetchError } = await supabase
          .from('booking_requests')
          .select('id, confirmed_start, confirmed_end')
          .eq('id', bookingId)
          .eq('tenant_id', tenantId!)
          .single()

        if (fetchError) {
          throw new Error(handleSupabaseError(fetchError))
        }

        if (!bookingToRestore?.confirmed_start || !bookingToRestore?.confirmed_end) {
          throw new Error('Impossibile reinserire: mancano orario di inizio/fine confermati.')
        }
      }

      // D6: guard di stato — si reinserisce solo una prenotazione effettivamente
      // eliminata; se non è più 'deleted' (già reinserita altrove) → 0 righe.
      const { data, error } = await supabase
        .from('booking_requests')
        .update(updatePayload)
        .eq('id', bookingId)
        .eq('tenant_id', tenantId!)
        .eq('status', 'deleted')
        .select()

      if (error) {
        logger.error('[useRestoreBooking] DB error', error)
        throw new Error(handleSupabaseError(error))
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0] as unknown as BookingRequest
    },
    onSuccess: async () => {
      // Invalida tutte le queries per refresh automatico completo
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'] })
      await queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId] })
      await queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId] })
      toast.success('Prenotazione reinserita con successo!')
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn(BOOKING_ALREADY_HANDLED)
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      toast.error(error.message || 'Errore nel reinserimento della prenotazione')
    },
  })
}

/** Rifiutata → pending (sezione richieste in attesa), senza reinserimento in calendario. */
export const useRequeueRejectedBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const updateData: TablesUpdate<'booking_requests'> = {
          status: 'pending',
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        }

      const { data, error } = await supabase
        .from('booking_requests')
        .update(updateData)
        .eq('id', bookingId)
        .eq('tenant_id', tenantId!)
        .eq('status', 'rejected')
        .select()
        .single()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as unknown as BookingRequest
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId], refetchType: 'all' }),
      ])
      toast.success('Prenotazione riportata tra le richieste in attesa')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Impossibile riportare la prenotazione in attesa')
    },
  })
}

/** Segna una prenotazione come no-show. Visibile solo se status='accepted', confirmed_start < now, no_show=false. */
export const useMarkNoShow = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (bookingId: string) => {
      // D6: guard di stato — il no-show ha senso solo su una prenotazione 'accepted'.
      const { data, error } = await supabase
        .from('booking_requests')
        .update({ no_show: true, updated_at: new Date().toISOString() })
        .eq('id', bookingId)
        .eq('tenant_id', tenantId!)
        .eq('status', 'accepted')
        .select()

      if (error) {
        logger.error('[useMarkNoShow] DB error', error)
        throw new Error(error.message)
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0]
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId], refetchType: 'all' }),
      ])
      toast.success('Prenotazione segnata come no-show')
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn(BOOKING_ALREADY_HANDLED)
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      logger.error('[useMarkNoShow] mutation error', error)
      toast.error(error.message || 'Errore nel segnare come no-show')
    },
  })
}

// Mutation per cancellare una prenotazione
export const useCancelBooking = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ bookingId, cancellationReason }: { bookingId: string; cancellationReason?: string }) => {

      const updateData: TablesUpdate<'booking_requests'> = {
          status: 'deleted',
          cancellation_reason: cancellationReason || null,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

      // D6: guard di stato — non ri-eliminare una prenotazione già 'deleted'
      // (doppio click / azione concorrente in un'altra scheda).
      const { data, error } = await supabase
        .from('booking_requests')
        .update(updateData)
        .eq('id', bookingId)
        .eq('tenant_id', tenantId!)
        .neq('status', 'deleted')
        .select()

      if (error) {
        logger.error('[useCancelBooking] DB error', error)
        throw new Error(handleSupabaseError(error))
      }

      if (!data?.length) {
        throw new Error(BOOKING_ALREADY_HANDLED)
      }

      return data[0] as unknown as BookingRequest
    },
    onSuccess: async () => {
      // Invalida tutte le queries per refresh automatico completo
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
      await queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'] })
      await queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_ROOT, tenantId] })
      await queryClient.invalidateQueries({ queryKey: [HOME_STATS_QUERY_KEY, tenantId] })

      toast.success('Prenotazione cancellata con successo!')
    },
    onError: async (error: Error) => {
      if (error.message === BOOKING_ALREADY_HANDLED) {
        toast.warn(BOOKING_ALREADY_HANDLED)
        await invalidateAllBookingQueries(queryClient, tenantId)
        return
      }
      toast.error(error.message || 'Errore nella cancellazione della prenotazione')
    },
  })
}
