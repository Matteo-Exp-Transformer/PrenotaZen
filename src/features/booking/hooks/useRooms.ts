import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { TABLES_QUERY_KEY } from './useServizioTables'

export const ROOMS_QUERY_KEY = 'rooms'

export interface Room {
  id: string
  tenant_id: string
  name: string
  width: number
  height: number
  display_order: number
  created_at: string
  updated_at: string
}

export interface RoomInput {
  name: string
  width: number
  height: number
  display_order?: number
}

export function useRooms() {
  const { tenantId } = useTenantContext()

  return useQuery<Room[]>({
    queryKey: [ROOMS_QUERY_KEY, tenantId],
    enabled: Boolean(tenantId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        logger.error('[useRooms] useRooms', error)
        throw new Error(error.message)
      }

      return (data ?? []) as Room[]
    },
  })
}

export function useCreateRoom() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RoomInput) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { data, error } = await supabase
        .from('rooms')
        .insert({
          tenant_id: tenantId,
          name: input.name.trim(),
          width: input.width,
          height: input.height,
          display_order: input.display_order ?? 0,
        })
        .select('id')
        .single()

      if (error) {
        logger.error('[useRooms] useCreateRoom', error)
        throw new Error(error.message)
      }

      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROOMS_QUERY_KEY, tenantId] })
      toast.success('Sala aggiunta')
    },
    onError: (e: Error) => {
      logger.error('[useRooms] useCreateRoom onError', e)
      toast.error(e.message || 'Errore aggiunta sala')
    },
  })
}

export function useUpdateRoom() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RoomInput }) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { error } = await supabase
        .from('rooms')
        .update({
          name: input.name.trim(),
          width: input.width,
          height: input.height,
          display_order: input.display_order ?? 0,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('[useRooms] useUpdateRoom', error)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROOMS_QUERY_KEY, tenantId] })
      toast.success('Sala aggiornata')
    },
    onError: (e: Error) => {
      logger.error('[useRooms] useUpdateRoom onError', e)
      toast.error(e.message || 'Errore aggiornamento sala')
    },
  })
}

export function useDeleteRoom() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant mancante')

      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)

      if (error) {
        logger.error('[useRooms] useDeleteRoom', error)
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ROOMS_QUERY_KEY, tenantId] })
      // I tavoli con room_id = roomId diventano room_id = null (ON DELETE SET NULL)
      void queryClient.invalidateQueries({ queryKey: [TABLES_QUERY_KEY, tenantId] })
      toast.success('Sala eliminata')
    },
    onError: (e: Error) => {
      logger.error('[useRooms] useDeleteRoom onError', e)
      toast.error(e.message || 'Errore eliminazione sala')
    },
  })
}
