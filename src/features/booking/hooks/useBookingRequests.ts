import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import type { BookingRequest, BookingRequestInput } from '@/types/booking'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'

// Lock globale per prevenire chiamate multiple simultanee alla mutation
// Usa un lock atomico con ID univoco per prevenire race conditions
let mutationLockId: string | null = null
let mutationLockTimeout: NodeJS.Timeout | null = null
const MUTATION_LOCK_TIMEOUT = 10000 // 10 secondi

// Funzione atomica per acquisire il lock della mutation
const acquireMutationLock = (): string | null => {
  const now = Date.now()
  const lockId = `${now}-${Math.random().toString(36).substring(2, 9)}`
  
  // Se c'è già un lock valido, fallisci
  if (mutationLockId) {
    return null
  }
  
  // Acquisisci lock
  mutationLockId = lockId
  
  // Imposta timeout di sicurezza
  if (mutationLockTimeout) {
    clearTimeout(mutationLockTimeout)
  }
  mutationLockTimeout = setTimeout(() => {
    mutationLockId = null
    mutationLockTimeout = null
  }, MUTATION_LOCK_TIMEOUT)

  return lockId
}

const releaseMutationLock = (lockId: string | null) => {
  if (!lockId || mutationLockId !== lockId) {
    return
  }
  
  if (mutationLockTimeout) {
    clearTimeout(mutationLockTimeout)
    mutationLockTimeout = null
  }
  
  mutationLockId = null
}

// Hook for creating booking requests (public - needs to use ANON key)
export const useCreateBookingRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    // Disabilita retry per prevenire chiamate multiple automatiche
    retry: false,
    mutationFn: async (data: BookingRequestInput) => {
      // Traccia chiamata
      // ✅ Protezione atomica a livello di mutation
      const lockId = acquireMutationLock()

      if (!lockId) {
        throw new Error('Una richiesta è già in corso. Attendi qualche secondo.')
      }
      
      try {
        // ⚠️ CRITICO: Verifica lock PRIMA di inserire
        if (mutationLockId !== lockId) {
          console.error('❌ [useCreateBookingRequest] Lock perso! Lock ID non corrisponde:', {
            expected: lockId,
            current: mutationLockId,
          })
          throw new Error('Lock perso durante l\'inserimento - possibile doppio submit')
        }

        // Call Edge Function for tenant-aware booking creation
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
        const response = await fetch(`${supabaseUrl}/functions/v1/create-booking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            tenantSlug: data.tenantSlug,
            client_name: data.client_name,
            client_email: (data.client_email ?? '').trim(),
            client_phone: data.client_phone || null,
            desired_date: data.desired_date,
            desired_time: data.desired_time || null,
            num_guests: data.num_guests,
            special_requests: data.special_requests || null,
            booking_type: data.booking_type || 'tavolo',
            event_type: data.event_type || null,
            menu_selection: data.menu_selection || null,
            menu_total_per_person: data.menu_total_per_person || null,
            menu_total_booking: data.menu_total_booking || null,
            dietary_restrictions: data.dietary_restrictions || null,
            preset_menu: data.preset_menu || null,
            placement: data.placement || null,
            menu_promo_labels:
              Array.isArray(data.menu_promo_labels) && data.menu_promo_labels.length > 0
                ? data.menu_promo_labels
                : null,
          })
        })

        // Verifica lock DOPO l'insert per assicurarsi che non sia cambiato
        if (mutationLockId !== lockId) {
          console.error('❌ [useCreateBookingRequest] Lock cambiato durante INSERT!', {
            expected: lockId,
            current: mutationLockId,
          })
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Errore nell\'invio della richiesta')
        }

        const result = await response.json()

        // Rilascia lock immediatamente dopo successo
        releaseMutationLock(lockId)

        return result as BookingRequest
      } catch (error) {
        // Rilascia lock in caso di errore
        releaseMutationLock(lockId)
        throw error
      }
    },
    onSuccess: async () => {
      // Invalida le query per refresh automatico (non blocca se admin non è loggato)
      try {
        await queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'] })
        await queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'] })
      } catch (error) {
        // Non critico se fallisce (ad esempio se admin non è loggato)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'invio della richiesta')
    }
  })
}

// Hook for admin: fetch all booking requests
export const useBookingRequests = (status?: 'pending' | 'accepted' | 'rejected') => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['booking-requests', status, tenantId],
    queryFn: async () => {
      let query = (supabase
        .from('booking_requests') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as BookingRequest[]
    },
    enabled: !!tenantId,
  })
}

// Hook for admin: update booking status
export const useUpdateBookingStatus = () => {
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      confirmed_start,
      confirmed_end,
      rejection_reason
    }: {
      id: string
      status: 'accepted' | 'rejected'
      confirmed_start?: string
      confirmed_end?: string
      rejection_reason?: string
    }) => {
      const updateData: any = {
        status
      }

      if (confirmed_start) updateData.confirmed_start = confirmed_start
      if (confirmed_end) updateData.confirmed_end = confirmed_end
      if (rejection_reason) updateData.rejection_reason = rejection_reason

      const { data, error } = await (supabase
        .from('booking_requests') as any)
        .update(updateData as any)
        .eq('id', id)
        .eq('tenant_id', tenantId!)
        .select()
        .single()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as BookingRequest
    },
    onSuccess: () => {
      toast.success('Stato aggiornato con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiornamento')
    }
  })
}

