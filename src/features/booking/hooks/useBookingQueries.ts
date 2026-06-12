import { useQuery } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import type { BookingRequest } from '@/types/booking'
import { useTenantContext } from '@/contexts/TenantContext'
import { logger } from '@/lib/logger'

// Hook per prenotazioni pending
export const usePendingBookings = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['bookings', 'pending', tenantId],
    queryFn: async () => {

      // Use authenticated supabase client (respects RLS policies)
      const { data, error } = await (supabase
        .from('booking_requests') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })


      if (error) {
        logger.error('❌ [usePendingBookings] Error:', error)
        throw new Error(handleSupabaseError(error))
      }

      return data as BookingRequest[]
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Refetch ogni 30s
  })
}

// Hook per prenotazioni accettate (per calendario)
export const useAcceptedBookings = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['bookings', 'accepted', tenantId],
    queryFn: async () => {

      // Show ALL accepted bookings (past, present, and future)
      // For a restaurant calendar, we want to show historical data too
      // ✅ IMPORTANTE: Selezioniamo tutti i campi incluso desired_time per preservare l'orario originale
      const { data, error } = await (supabase
        .from('booking_requests') as any)
        .select('*') // Include tutti i campi incluso desired_time
        .eq('tenant_id', tenantId)
        .eq('status', 'accepted')
        .order('confirmed_start', { ascending: true })

      if (error) {
        logger.error('❌ [useAcceptedBookings] Error:', error)
        throw new Error(handleSupabaseError(error))
      }

      return data as BookingRequest[]
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refetch ogni minuto
  })
}

// Hook per archivio (tutte le prenotazioni)
export const useAllBookings = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['bookings', 'all', tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('booking_requests') as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return data as BookingRequest[]
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  })
}

// Hook per statistiche
export const useBookingStats = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['bookings', 'stats', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {

      // Use authenticated supabase client - fetch confirmed_start for accepted bookings
      const { data: allBookings, error } = await (supabase
        .from('booking_requests') as any)
        .select('id, status, confirmed_start')
        .eq('tenant_id', tenantId)


      if (error) {
        logger.error('❌ [useBookingStats] Error:', error)
        throw new Error(handleSupabaseError(error))
      }

      // Calculate stats
      const now = new Date()
      
      // Calculate start and end of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      startOfMonth.setHours(0, 0, 0, 0)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      endOfMonth.setHours(23, 59, 59, 999)
      
      // Calculate start of week (Monday)
      const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Adjust for Monday = 0
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - daysToMonday)
      startOfWeek.setHours(0, 0, 0, 0)
      
      // Calculate end of week (Sunday)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      // Calculate start and end of today
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      
      // Filter bookings based on confirmed_start date for accepted bookings
      // Use confirmed_start for accepted bookings to show when bookings actually happen
      const acceptedBookings = allBookings?.filter((b: any) => b.status === 'accepted') || []
      
      // Helper to extract date from ISO string to avoid timezone issues
      const getBookingDate = (confirmedStart: string | null): Date | null => {
        if (!confirmedStart) return null
        // Extract date directly from ISO string to avoid timezone conversion
        const dateMatch = confirmedStart.match(/(\d{4})-(\d{2})-(\d{2})/)
        if (!dateMatch) return null
        
        // Create date in local timezone using the extracted date components
        const year = parseInt(dateMatch[1])
        const month = parseInt(dateMatch[2]) - 1 // JS months are 0-indexed
        const day = parseInt(dateMatch[3])
        
        return new Date(year, month, day)
      }
      
      const stats = {
        pending: allBookings?.filter((b: any) => b.status === 'pending').length || 0,
        accepted: acceptedBookings.length,
        rejected: allBookings?.filter((b: any) => b.status === 'rejected').length || 0,
        total: allBookings?.length || 0,
        totalMonth: acceptedBookings.filter((b: any) => {
          const bookingDate = getBookingDate(b.confirmed_start)
          if (!bookingDate) return false
          return bookingDate >= startOfMonth && bookingDate <= endOfMonth
        }).length,
        totalWeek: acceptedBookings.filter((b: any) => {
          const bookingDate = getBookingDate(b.confirmed_start)
          if (!bookingDate) return false
          return bookingDate >= startOfWeek && bookingDate <= endOfWeek
        }).length,
        totalDay: acceptedBookings.filter((b: any) => {
          const bookingDate = getBookingDate(b.confirmed_start)
          if (!bookingDate) return false
          return bookingDate >= startOfDay && bookingDate <= endOfDay
        }).length,
      }

      return stats
    },
    refetchInterval: 30000,
  })
}

