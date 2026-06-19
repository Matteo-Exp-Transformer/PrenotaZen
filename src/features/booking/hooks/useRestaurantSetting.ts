import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import { supabasePublic } from '@/lib/supabasePublic'
import { useTenantContext } from '@/contexts/TenantContext'
import { toast } from 'react-toastify'
import {
  restaurantSettingRegistry,
  type RestaurantSettingKeyV1,
  type RestaurantSettingValueMap,
} from '@/features/booking/lib/restaurantSettingRegistry'
import type { Json, TablesInsert } from '@/types/database'

export function useRestaurantSetting<K extends RestaurantSettingKeyV1>(
  key: K,
  options?: { authenticated?: boolean },
) {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: ['restaurant_settings', key, tenantId],
    queryFn: async (): Promise<RestaurantSettingValueMap[K]> => {
      // Le chiavi solo-admin (es. app_theme, slot_limit_enabled) vanno lette dal
      // client autenticato: la policy RLS anon le nasconde (whitelist sole 11
      // chiavi pubbliche). Le pagine pubbliche restano su supabasePublic.
      const client = options?.authenticated ? supabase : supabasePublic
      const { data, error } = await client
        .from('restaurant_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId!)
        .eq('setting_key', key)
        .maybeSingle()

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return restaurantSettingRegistry[key].parseFromDb(data?.setting_value) as RestaurantSettingValueMap[K]
    },
    enabled: !!tenantId,
  })
}

export type UpsertRestaurantSettingItem = {
  key: RestaurantSettingKeyV1
  value: unknown
}

export type UpsertRestaurantSettingOptions = {
  /** Nessun toast successo/errore standard (autosave silenzioso). Gli errori restano senza toast se silent. */
  silent?: boolean
}

export type UpsertRestaurantSettingVariables = {
  items: UpsertRestaurantSettingItem[]
  options?: UpsertRestaurantSettingOptions
}

function normalizeUpsertInput(
  input: UpsertRestaurantSettingItem[] | UpsertRestaurantSettingVariables,
): UpsertRestaurantSettingVariables {
  if (Array.isArray(input)) {
    return { items: input }
  }
  return input
}

/**
 * Upsert una o più righe `restaurant_settings` (stesso tenant). Dopo il successo invalida
 * solo le query delle chiavi toccate (+ business_hours legacy se applicabile).
 */
export function useUpsertRestaurantSetting() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (
      input: UpsertRestaurantSettingItem[] | UpsertRestaurantSettingVariables,
    ) => {
      const { items, options } = normalizeUpsertInput(input)
      if (!tenantId) {
        throw new Error('Tenant non disponibile')
      }

      const rows: TablesInsert<'restaurant_settings'>[] = items.map(({ key, value }) => {
        const reg = restaurantSettingRegistry[key]
        const err = reg.validate(value)
        if (err) {
          throw new Error(`${key}: ${err}`)
        }
        return {
          tenant_id: tenantId,
          setting_key: key,
          setting_value: reg.serializeToDb(value as never) as Json,
        }
      })

      const { error } = await supabase.from('restaurant_settings').upsert(rows, {
        onConflict: 'tenant_id,setting_key',
      })

      if (error) {
        throw new Error(handleSupabaseError(error))
      }

      return { items, options }
    },
    onSuccess: ({ items, options }) => {
      const silent = options?.silent === true
      for (const { key, value } of items) {
        if (tenantId) {
          const reg = restaurantSettingRegistry[key]
          const parsed = reg.parseFromDb(reg.serializeToDb(value as never))
          queryClient.setQueryData(['restaurant_settings', key, tenantId], parsed)
        }
        queryClient.invalidateQueries({
          queryKey: ['restaurant_settings', key, tenantId],
          refetchType: 'active',
        })
      }
      if (items.some((i) => i.key === 'business_hours') && tenantId) {
        queryClient.invalidateQueries({
          queryKey: ['restaurant_settings', 'business_hours', tenantId],
          refetchType: 'active',
        })
      }
      if (!silent) {
        toast.success('Impostazioni salvate')
      }
    },
    onError: (error: Error, variables) => {
      const silent = normalizeUpsertInput(variables).options?.silent === true
      if (!silent) {
        toast.error(error.message || 'Errore nel salvataggio')
      }
    },
  })
}
