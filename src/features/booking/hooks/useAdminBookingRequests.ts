import { useMutation } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import type { BookingRequest, BookingRequestInput } from '@/types/booking'
import { toast } from 'react-toastify'
import { createBookingDateTime, calculateEndTimeFromStart } from '../utils/dateUtils'
import { buildFeatures } from '@/config/features'
import { logger } from '@/lib/logger'

// Hook for creating booking requests directly as ACCEPTED (admin only)
export const useCreateAdminBooking = () => {
  const { tenantId, edition } = useTenantContext()
  return useMutation({
    mutationFn: async (data: BookingRequestInput) => {
      if (!tenantId) {
        throw new Error('Tenant non disponibile: effettuare nuovamente il login')
      }

      const features = buildFeatures(edition)

      // Normalizza desired_time a formato HH:MM (rimuove secondi se presenti)
      const normalizedTime = data.desired_time 
        ? data.desired_time.split(':').slice(0, 2).join(':')
        : null
      
      const fallbackTime = '20:00'
      const startTime = normalizedTime || fallbackTime
      const endTime = calculateEndTimeFromStart(startTime)
      
      const confirmedStart = createBookingDateTime(data.desired_date, startTime, true)
      const confirmedEnd = createBookingDateTime(data.desired_date, endTime, false, startTime)
      
      const insertData = {
        tenant_id: tenantId,
        client_name: data.client_name,
        client_email: data.client_email,
        client_phone: data.client_phone || null,
        booking_type: data.booking_type,
        event_type: data.event_type,
        desired_date: data.desired_date,
        desired_time: normalizedTime,
        num_guests: data.num_guests,
        special_requests: data.special_requests || null,
        menu_selection: data.menu_selection || null,
        menu_total_per_person: data.menu_total_per_person || null,
        menu_total_booking: data.menu_total_booking || null,
        preset_menu: data.preset_menu || null,
        dietary_restrictions: data.dietary_restrictions || null,
        placement: features.servizio ? data.placement || null : null,
        menu_promo_labels:
          Array.isArray(data.menu_promo_labels) && data.menu_promo_labels.length > 0
            ? data.menu_promo_labels
            : null,
        booking_source: 'admin',
        status: 'accepted' as const,
        confirmed_start: confirmedStart,
        confirmed_end: confirmedEnd
      }


      // Use authenticated supabase client (admin only)
      const { data: result, error } = await (supabase
        .from('booking_requests') as any)
        .insert(insertData as any)
        .select()
        .single()


      if (error) {
        logger.error('❌ [useCreateAdminBooking] Error:', error)
        throw new Error(error.message)
      }

      return result as BookingRequest
    },
    onError: (error: Error) => {
      logger.error('Error creating admin booking:', error)
      toast.error('Errore nella creazione della prenotazione')
    }
  })
}

