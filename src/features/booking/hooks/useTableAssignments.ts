import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/contexts/TenantContext'
import { toast } from 'react-toastify'
import { logger } from '@/lib/logger'
import type { ServiceSlot } from '@/features/booking/hooks/useServiceSlots'
import {
  activeAssignedBookingIds,
  filterUnassignedBookingsForSlot,
} from '@/features/booking/utils/unassignedBookingsFilter'
import { hasWaitingNextTurnOnTable } from '@/features/booking/utils/tableCheckout'
import type { BookingRequest } from '@/types/booking'

export interface BookingTableAssignment {
  id: string
  tenant_id: string
  booking_id: string
  table_id: string
  service_slot_id: string
  turn_number: number
  checked_out_at: string | null
  date: string
  created_at: string
}

export const TABLE_ASSIGNMENTS_QUERY_KEY = 'table_assignments'

export type TableStatus = 'free' | 'assigned' | 'checked_out'

/** Calcola lo stato di un tavolo per slot+data dati gli assignment attivi */
export function getTableStatus(
  tableId: string,
  assignments: BookingTableAssignment[],
  selectedSlotId: string,
  selectedDate: string,
): TableStatus {
  const relevant = assignments.filter(
    (a) => a.table_id === tableId && a.service_slot_id === selectedSlotId && a.date === selectedDate,
  )

  if (relevant.length === 0) return 'free'

  const active = relevant.filter((a) => a.checked_out_at === null)
  if (active.length === 0) return 'checked_out'

  return 'assigned'
}

export function filterBookingsOnDate(bookings: BookingRequest[], date: string): BookingRequest[] {
  return bookings.filter((b) => {
    const d = b.confirmed_start
      ? b.confirmed_start.slice(0, 10)
      : b.desired_date?.slice(0, 10)
    return d === date
  })
}

/** Prenotazioni accettate per una data (lookup nome/orario sui tavoli assegnati). */
export function useAcceptedBookingsForDate(date: string) {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, date, 'accepted-bookings'],
    queryFn: async (): Promise<BookingRequest[]> => {
      const { data: bookings, error } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('status', 'accepted')

      if (error) throw error
      return filterBookingsOnDate(bookings as unknown as BookingRequest[], date)
    },
    enabled: !!tenantId && !!date,
  })
}

export function useTableAssignments(date: string) {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, date],
    queryFn: async (): Promise<BookingTableAssignment[]> => {
      const { data, error } = await supabase
        .from('booking_table_assignments')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('date', date)

      if (error) throw error
      return data as BookingTableAssignment[]
    },
    enabled: !!tenantId && !!date,
  })
}

/** Prenotazioni accettate per la data, non ancora assegnate ad alcun tavolo per lo slot */
export function useUnassignedBookings(
  date: string,
  slot: Pick<ServiceSlot, 'id' | 'start_time' | 'end_time'> | null,
) {
  const { tenantId } = useTenantContext()
  const slotId = slot?.id ?? ''

  return useQuery({
    queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, date, slotId, 'unassigned'],
    queryFn: async (): Promise<BookingRequest[]> => {
      const { data: bookings, error: bErr } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('status', 'accepted')

      if (bErr) throw bErr

      const onDate = filterBookingsOnDate(bookings as unknown as BookingRequest[], date)

      if (onDate.length === 0) return []

      // Rimuovi quelle già assegnate a un tavolo per questo slot (con checked_out_at = null)
      const { data: assigned, error: aErr } = await supabase
        .from('booking_table_assignments')
        .select('booking_id')
        .eq('tenant_id', tenantId!)
        .eq('date', date)
        .eq('service_slot_id', slotId)
        .is('checked_out_at', null)

      if (aErr) throw aErr

      return filterUnassignedBookingsForSlot(
        onDate,
        slot!.start_time,
        slot!.end_time,
        activeAssignedBookingIds(assigned ?? []),
      )
    },
    enabled: !!tenantId && !!date && !!slot?.id,
  })
}

interface AssignInput {
  bookingId: string
  tableId: string
  slotId: string
  date: string
  maxTurns: number | null
  existingAssignments: BookingTableAssignment[]
}

export function useAssignBookingToTable() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ bookingId, tableId, slotId, date, maxTurns, existingAssignments }: AssignInput) => {
      const forThisTable = existingAssignments.filter(
        (a) => a.table_id === tableId && a.service_slot_id === slotId && a.date === date,
      )
      const turnNumber = forThisTable.length > 0 ? Math.max(...forThisTable.map((a) => a.turn_number)) + 1 : 1

      if (maxTurns !== null && turnNumber > maxTurns) {
        throw new Error('Turni esauriti per questo tavolo in questa fascia.')
      }

      const { data, error } = await supabase
        .from('booking_table_assignments')
        .insert({
          tenant_id: tenantId!,
          booking_id: bookingId,
          table_id: tableId,
          service_slot_id: slotId,
          turn_number: turnNumber,
          date,
          checked_out_at: null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date] })
      queryClient.invalidateQueries({ queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date, vars.slotId, 'unassigned'] })
      toast.success('Prenotazione assegnata al tavolo')
    },
    onError: (error: Error) => {
      logger.error('[useAssignBookingToTable] error', error)
      toast.error(error.message || 'Errore nell\'assegnazione')
    },
  })
}

export function useCheckoutTable() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({
      tableId,
      slotId,
      date,
      assignments,
    }: {
      tableId: string
      slotId: string
      date: string
      assignments: BookingTableAssignment[]
    }) => {
      // Libera l'assignment attivo con turn_number più basso
      const active = assignments
        .filter(
          (a) =>
            a.table_id === tableId &&
            a.service_slot_id === slotId &&
            a.date === date &&
            a.checked_out_at === null,
        )
        .sort((a, b) => a.turn_number - b.turn_number)

      if (active.length === 0) throw new Error('Nessun assignment attivo da liberare.')

      const current = active[0]

      if (hasWaitingNextTurnOnTable(assignments, current)) {
        const { error } = await supabase
          .from('booking_table_assignments')
          .update({ checked_out_at: new Date().toISOString() })
          .eq('id', current.id)
          .eq('tenant_id', tenantId!)

        if (error) throw error
        return
      }

      const { error } = await supabase
        .from('booking_table_assignments')
        .delete()
        .eq('id', current.id)
        .eq('tenant_id', tenantId!)

      if (error) throw error
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date] }),
        queryClient.refetchQueries({
          queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date, vars.slotId, 'unassigned'],
        }),
      ])
      toast.success('Tavolo liberato')
    },
    onError: (error: Error) => {
      logger.error('[useCheckoutTable] error', error)
      toast.error(error.message || 'Errore nel liberare il tavolo')
    },
  })
}

interface ReleaseInput {
  bookingId: string
  slotId: string
  date: string
  assignments: BookingTableAssignment[]
}

export type ReleaseBlockedReason = 'waiting_next_turn'

/**
 * Libera l'assignment attivo di una specifica prenotazione (per riassegnazione rapida da Calendario).
 * Diverso da useCheckoutTable che opera per tavolo+slot.
 * Restituisce { blocked: ReleaseBlockedReason } se ci sono turni successivi in attesa sul tavolo
 * (comportamento provvisorio sicuro fino all'implementazione della logica permanenza, sessione futura).
 */
export function useReleaseBookingAssignment() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async ({ bookingId, slotId, date, assignments }: ReleaseInput): Promise<{ blocked: ReleaseBlockedReason } | null> => {
      const current = assignments.find(
        (a) =>
          a.booking_id === bookingId &&
          a.service_slot_id === slotId &&
          a.date === date &&
          a.checked_out_at === null,
      )

      if (!current) throw new Error('Nessun assignment attivo da liberare per questa prenotazione.')

      // Provvisorio: se sul tavolo c'è un turno successivo in attesa, blocca senza modificare DB
      if (hasWaitingNextTurnOnTable(assignments, current)) {
        return { blocked: 'waiting_next_turn' }
      }

      const { error } = await supabase
        .from('booking_table_assignments')
        .delete()
        .eq('id', current.id)
        .eq('tenant_id', tenantId!)

      if (error) throw error
      return null
    },
    onSuccess: async (result, vars) => {
      if (result?.blocked) return
      await Promise.all([
        queryClient.refetchQueries({ queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date] }),
        queryClient.refetchQueries({
          queryKey: [TABLE_ASSIGNMENTS_QUERY_KEY, tenantId, vars.date, vars.slotId, 'unassigned'],
        }),
      ])
    },
    onError: (error: Error) => {
      logger.error('[useReleaseBookingAssignment] error', error)
      toast.error(error.message || 'Errore nel liberare l\'assegnazione')
    },
  })
}
