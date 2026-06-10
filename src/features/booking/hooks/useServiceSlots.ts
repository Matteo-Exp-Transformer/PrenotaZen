import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/contexts/TenantContext'
import { toast } from 'react-toastify'
import { logger } from '@/lib/logger'
import {
  slotCrossesMidnight,
  type SlotConfig,
} from '@/features/booking/utils/bookingTimeSlots'

export { slotCrossesMidnight }
export type { SlotConfig }

export interface ServiceSlot {
  id: string
  tenant_id: string
  name: string
  start_time: string
  end_time: string
  max_turns: number | null
  /** Turni da ripristinare dopo chiusura servizio (pulsante X). Migration 023. */
  max_turns_resume?: number | null
  max_guests: number | null
  display_order: number
  // is_canonical è managed dal DB (migration 016) — non incluso nei payload insert/update
  is_canonical: boolean
  created_at: string
  updated_at: string
}

/** Servizio chiuso manualmente: nessun turno/tavolo disponibile (equivale a max_turns = 0). */
export function isServiceSlotClosed(slot: Pick<ServiceSlot, 'max_turns'>): boolean {
  return slot.max_turns === 0
}

type ServiceSlotInsert = Omit<
  ServiceSlot,
  'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'is_canonical' | 'max_turns_resume'
> & { max_turns_resume?: number | null }
type ServiceSlotUpdate = Partial<Omit<ServiceSlot, 'is_canonical'>> & {
  id: string
  /** Se true, non mostra il toast generico "Fascia oraria aggiornata". */
  skipToast?: boolean
}

export const SERVICE_SLOTS_QUERY_KEY = 'service_slots'

export function useServiceSlots() {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [SERVICE_SLOTS_QUERY_KEY, tenantId],
    queryFn: async (): Promise<ServiceSlot[]> => {
      const { data, error } = await supabase
        .from('service_slots')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as ServiceSlot[]
    },
    enabled: !!tenantId,
  })
}

export function useCreateServiceSlot() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: ServiceSlotInsert) => {
      const { data, error } = await supabase
        .rpc('insert_service_slot', {
          p_tenant_id:     tenantId!,
          p_name:          input.name,
          p_start_time:    input.start_time,
          p_end_time:      input.end_time,
          p_max_turns:     input.max_turns as number,
          p_max_guests:    input.max_guests as number,
          p_display_order: input.display_order,
        })

      if (error) throw error
      return (data as ServiceSlot[])[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_SLOTS_QUERY_KEY, tenantId] })
      toast.success('Fascia oraria creata')
    },
    onError: (error: Error) => {
      logger.error('[useCreateServiceSlot] error', error)
      toast.error(error.message || 'Errore nella creazione della fascia')
    },
  })
}

export function useUpdateServiceSlot() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ id, skipToast: _skip, ...patch }: ServiceSlotUpdate) => {
      // RPC con singolo parametro jsonb: firma univoca, immune a PGRST202 (schema cache).
      // Semantica PATCH: solo le chiavi presenti vengono aggiornate. La chiave 'max_guests'
      // con valore null = azzeramento esplicito del limite (la presenza della chiave è l'intento).
      const payload: Record<string, string | number | null> = { id, tenant_id: tenantId! }
      if (patch.name !== undefined) payload.name = patch.name
      if (patch.start_time !== undefined) payload.start_time = patch.start_time
      if (patch.end_time !== undefined) payload.end_time = patch.end_time
      if (patch.max_turns !== undefined) payload.max_turns = patch.max_turns
      if ('max_turns_resume' in patch) payload.max_turns_resume = patch.max_turns_resume ?? null
      if ('max_guests' in patch) payload.max_guests = patch.max_guests ?? null
      if (patch.display_order !== undefined) payload.display_order = patch.display_order

      const { data, error } = await supabase.rpc('update_service_slot', { payload })

      if (error) throw error
      return (data as ServiceSlot[])[0]
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_SLOTS_QUERY_KEY, tenantId] })
      if (!variables.skipToast) toast.success('Fascia oraria aggiornata')
    },
    onError: (error: Error) => {
      logger.error('[useUpdateServiceSlot] error', error)
      toast.error(error.message || 'Errore nell\'aggiornamento della fascia')
    },
  })
}

export function useDeleteServiceSlot() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_slots')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId!)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_SLOTS_QUERY_KEY, tenantId] })
      toast.success('Fascia oraria eliminata')
    },
    onError: (error: Error) => {
      logger.error('[useDeleteServiceSlot] error', error)
      toast.error(error.message || 'Errore nell\'eliminazione della fascia')
    },
  })
}

/**
 * Tutte le service_slots del tenant come SlotConfig[], ordinate per display_order.
 * Fonte dati primaria per digest, capacity e Impostazioni in Classic.
 * Condivide la query di useServiceSlots — nessuna chiamata DB aggiuntiva.
 */
export function useDigestSlotConfigs(): {
  data: SlotConfig[]
  isLoading: boolean
  error: Error | null
} {
  const query = useServiceSlots()
  const configs: SlotConfig[] = (query.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    start_time: s.start_time.slice(0, 5),
    end_time: s.end_time.slice(0, 5),
    display_order: s.display_order,
    is_canonical: s.is_canonical,
    slot_color: null,
  }))
  return {
    data: configs,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  }
}

