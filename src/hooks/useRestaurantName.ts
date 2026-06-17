import { useQuery } from '@tanstack/react-query'
import {
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
  clampBookingText,
} from '@/features/booking/constants/bookingPrenotaTextLimits'
import { supabasePublic } from '@/lib/supabasePublic'
import { useTenantContext } from '@/contexts/TenantContext'

/**
 * Legge `restaurant_name` da restaurant_settings (anon) per il tenant corrente.
 * Nessun fallback inventato: se assente/vuoto restituisce null (Pagina Prenota senza titolo finto).
 * L'admin shell usa fallback locali (`organizationName`, testo di sistema) dove serve.
 */
export const useRestaurantName = (): string | null => {
  const { tenantId } = useTenantContext()

  const { data } = useQuery({
    queryKey: ['restaurant_settings', 'restaurant_name', tenantId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabasePublic
        .from('restaurant_settings')
        .select('setting_value')
        .eq('setting_key', 'restaurant_name')
        .eq('tenant_id', tenantId!)
        .maybeSingle()

      if (error || !data) return null

      const raw = data.setting_value
      const max = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        return trimmed ? clampBookingText(trimmed, max) : null
      }
      if (typeof raw === 'number' || typeof raw === 'boolean') {
        const s = String(raw).trim()
        return s ? clampBookingText(s, max) : null
      }
      return null
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })

  return data && data.length > 0 ? data : null
}
