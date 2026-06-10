import { useQuery } from '@tanstack/react-query'
import { supabasePublic } from '@/lib/supabasePublic'
import { parseBusinessHours, type BusinessHours } from '@/lib/businessHours'
import { useTenantContext } from '@/contexts/TenantContext'

/**
 * Hook to fetch business hours from restaurant_settings
 * Uses public client (anon key) for access
 * Returns null if settings are unavailable: the public page must not invent hours.
 */
export const useBusinessHours = () => {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['restaurant_settings', 'business_hours', tenantId],
    queryFn: async (): Promise<BusinessHours | null> => {

      const { data, error } = await (supabasePublic
        .from('restaurant_settings') as any)
        .select('setting_value')
        .eq('setting_key', 'business_hours')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) {
        return null
      }

      if (!data || !(data as any).setting_value) {
        return null
      }

      // Parse and validate structure
      const parsed = parseBusinessHours((data as any).setting_value)

      if (!parsed) {
        return null
      }

      return parsed
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (hours don't change often)
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  })
}

