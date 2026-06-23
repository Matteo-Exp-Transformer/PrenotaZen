import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export const TABLES_QUERY_KEY = 'servizio-tables'

export interface RestaurantTable {
  id: string
  tenant_id: string
  name: string
  capacity: number
  placement: string
  active: boolean
  room_id: string | null
  position_x: number
  position_y: number
  shape: 'round' | 'square' | 'rect'
  created_at: string
  updated_at: string
}

export interface TableInput {
  name: string
  capacity: number
  placement: string
  room_id: string
  position_x?: number
  position_y?: number
  shape?: 'round' | 'square' | 'rect'
}

export function useTables() {
  const { tenantId } = useTenantContext()

  return useQuery<RestaurantTable[]>({
    queryKey: [TABLES_QUERY_KEY, tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { data, error } = await supabase.from('tables')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('placement', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        logger.error('[useServizioTables] useTables', error)
        throw new Error(error.message)
      }

      return (data ?? []) as RestaurantTable[]
    },
  })
}

export function useCreateTable() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: TableInput) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { data, error } = await supabase.from('tables')
        .insert({
          tenant_id: tenantId,
          name: input.name.trim(),
          capacity: input.capacity,
          placement: input.placement,
          room_id: input.room_id,
        })
        .select('id')
        .single()

      if (error) {
        logger.error('[useServizioTables] useCreateTable', error)
        throw new Error(error.message)
      }

      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TABLES_QUERY_KEY, tenantId] })
      toast.success('Tavolo aggiunto')
    },
    onError: (e: Error) => {
      logger.error('[useServizioTables] useCreateTable onError', e)
      toast.error(e.message || 'Errore aggiunta tavolo')
    },
  })
}

export function useUpdateTable() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TableInput }) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { error } = await supabase.from('tables')
        .update({
          name: input.name.trim(),
          capacity: input.capacity,
          placement: input.placement,
          room_id: input.room_id,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('[useServizioTables] useUpdateTable', error)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TABLES_QUERY_KEY, tenantId] })
      toast.success('Tavolo aggiornato')
    },
    onError: (e: Error) => {
      logger.error('[useServizioTables] useUpdateTable onError', e)
      toast.error(e.message || 'Errore aggiornamento tavolo')
    },
  })
}

export function useDeleteTable() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { error } = await supabase.from('tables')
        .update({ active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('[useServizioTables] useDeleteTable', error)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TABLES_QUERY_KEY, tenantId] })
      toast.success('Tavolo rimosso')
    },
    onError: (e: Error) => {
      logger.error('[useServizioTables] useDeleteTable onError', e)
      toast.error(e.message || 'Errore rimozione tavolo')
    },
  })
}

/**
 * Aggiorna la posizione di un tavolo nella mappa con debounce 300ms.
 * Il debounce è gestito con un ref al timer per evitare re-render inutili.
 * Non mostra toast: il drag è un'operazione frequente e silenziosa.
 */
export function useUpdateTablePosition() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation({
    mutationFn: async ({ id, x, y }: { id: string; x: number; y: number }) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { error } = await supabase.from('tables')
        .update({ position_x: x, position_y: y })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('[useServizioTables] useUpdateTablePosition', error)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TABLES_QUERY_KEY, tenantId] })
    },
    onError: (e: Error) => {
      logger.error('[useServizioTables] useUpdateTablePosition onError', e)
      toast.error(e.message || 'Errore salvataggio posizione tavolo')
    },
  })

  function debouncedUpdate(id: string, x: number, y: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      mutation.mutate({ id, x, y })
    }, 300)
  }

  return { debouncedUpdate, isPending: mutation.isPending }
}
