import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { normalizeClientName, normalizeCustomerEmail } from '@/lib/customerEmail'
import { logger } from '@/lib/logger'
import { toast } from 'react-toastify'
import { CRM_QUERY_KEY } from './useCustomers'

export interface CreateCustomerInput {
  name: string
  email: string
  phone?: string
  notes?: string
}

export interface UpdateCustomerInput {
  /** Riga `customers`; null se profilo solo da booking (crea/aggiorna synced). */
  customerRowId: string | null
  previousEmail: string
  /** Nome identità rubrica al momento dell'apertura form (raggruppa patch booking). */
  previousName: string
  name: string
  email: string
  phone?: string | null
  notes?: string | null
}

type BookingEmailNameRow = { id: string; client_email: string; client_name: string }

export function matchesCustomerIdentity(
  clientEmail: string,
  clientName: string,
  emailKey: string,
  nameKey: string,
): boolean {
  return (
    normalizeCustomerEmail(clientEmail) === emailKey &&
    normalizeClientName(clientName) === nameKey
  )
}

export function filterBookingIdsByIdentity(
  rows: BookingEmailNameRow[],
  emailKey: string,
  nameKey: string,
): string[] {
  return rows
    .filter((r) => matchesCustomerIdentity(r.client_email, r.client_name, emailKey, nameKey))
    .map((r) => r.id)
}

async function fetchActiveBookingEmailNameRows(tenantId: string): Promise<BookingEmailNameRow[]> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('id,client_email,client_name')
    .eq('tenant_id', tenantId)
    .neq('status', 'deleted')

  if (error) throw new Error(error.message)
  return data ?? []
}

async function bookingIdsMatchingIdentity(
  tenantId: string,
  emailKey: string,
  nameKey: string,
): Promise<string[]> {
  const rows = await fetchActiveBookingEmailNameRows(tenantId)
  return filterBookingIdsByIdentity(rows, emailKey, nameKey)
}

async function hasActiveBookingsForEmail(tenantId: string, emailKey: string): Promise<boolean> {
  const rows = await fetchActiveBookingEmailNameRows(tenantId)
  return rows.some((r) => normalizeCustomerEmail(r.client_email) === emailKey)
}

export function useCreateCustomer() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      if (!tenantId) throw new Error('Tenant mancante')
      const email = normalizeCustomerEmail(input.email)
      if (!email) throw new Error('Email non valida')

      const { data, error } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name: input.name.trim(),
          email,
          phone: input.phone?.trim() || null,
          notes: input.notes?.trim() || null,
          source: 'manual',
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY, tenantId] })
      toast.success('Cliente creato')
    },
    onError: (e: Error) => {
      logger.error('[useCreateCustomer]', e)
      toast.error(e.message || 'Errore creazione cliente')
    },
  })
}

export function useUpdateCustomer() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateCustomerInput) => {
      if (!tenantId) throw new Error('Tenant mancante')
      const nextEmail = normalizeCustomerEmail(input.email)
      if (!nextEmail) throw new Error('Email non valida')
      const prevKey = normalizeCustomerEmail(input.previousEmail)
      if (!prevKey) throw new Error('Email precedente non valida')
      const prevNameKey = normalizeClientName(input.previousName)

      let rowId = input.customerRowId

      if (!rowId) {
        const { data: existing, error: selErr } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', prevKey)
          .maybeSingle()

        if (selErr) throw new Error(selErr.message)
        rowId = existing?.id ?? null
      }

      if (!rowId) {
        const { data: inserted, error: insErr } = await supabase
          .from('customers')
          .insert({
            tenant_id: tenantId,
            name: input.name.trim(),
            email: prevKey,
            phone: input.phone?.trim() || null,
            notes: input.notes?.trim() || null,
            source: 'synced',
          })
          .select('id')
          .single()

        if (insErr) throw new Error(insErr.message)
        rowId = inserted.id
      }

      const { error: updErr } = await supabase
        .from('customers')
        .update({
          name: input.name.trim(),
          email: nextEmail,
          phone: input.phone?.trim() || null,
          notes: input.notes?.trim() || null,
        })
        .eq('id', rowId)
        .eq('tenant_id', tenantId)

      if (updErr) {
        const msg =
          updErr.code === '23505'
            ? 'Email già registrata per un altro cliente'
            : updErr.message
        throw new Error(msg)
      }

      const identityIds = await bookingIdsMatchingIdentity(tenantId, prevKey, prevNameKey)
      if (identityIds.length > 0) {
        const patch: {
          client_email: string
          client_name: string
          client_phone: string | null
        } = {
          client_email: nextEmail,
          client_name: input.name.trim(),
          client_phone: input.phone?.trim() || null,
        }

        const { error: patchErr } = await supabase
          .from('booking_requests')
          .update(patch)
          .in('id', identityIds)

        if (patchErr) throw new Error(patchErr.message)
      }

      return { id: rowId }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY, tenantId] })
      void queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'], refetchType: 'all' })
      toast.success('Cliente aggiornato')
    },
    onError: (e: Error) => {
      logger.error('[useUpdateCustomer]', e)
      toast.error(e.message || 'Errore aggiornamento cliente')
    },
  })
}

export interface DeleteCustomerInput {
  /** Riga `customers` da rimuovere (manual o synced). Null se profilo solo da booking. */
  customerRowId: string | null
  /** Email del cliente (qualsiasi casing — verrà normalizzata). */
  email: string
  /** Nome identità rubrica da eliminare (raggruppa soft-delete booking). */
  clientName: string
  /** UUID dell'admin che effettua l'azione (per audit `cancelled_by` — campo UUID nel DB). */
  adminId?: string | null
}

export interface DeleteCustomerResult {
  bookingsArchived: number
  customerRowDeleted: boolean
}

/**
 * Eliminazione identità rubrica (email + nome):
 *  - soft-delete solo le prenotazioni attive con quella coppia email+nome
 *  - la riga `customers` si elimina solo se non restano prenotazioni attive per quell'email
 */
export function useDeleteCustomer() {
  const { tenantId } = useTenantContext()
  const queryClient = useQueryClient()

  return useMutation<DeleteCustomerResult, Error, DeleteCustomerInput>({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error('Tenant mancante')
      const emailKey = normalizeCustomerEmail(input.email)
      if (!emailKey) throw new Error('Email non valida')
      const nameKey = normalizeClientName(input.clientName)

      const bookingIds = await bookingIdsMatchingIdentity(tenantId, emailKey, nameKey)

      if (bookingIds.length > 0) {
        const nowIso = new Date().toISOString()
        const { error: archiveErr } = await supabase
          .from('booking_requests')
          .update({
            status: 'deleted',
            cancelled_at: nowIso,
            cancelled_by: input.adminId ?? null,
            cancellation_reason: 'customer_deleted',
          })
          .in('id', bookingIds)

        if (archiveErr) throw new Error(archiveErr.message)
      }

      let customerRowDeleted = false
      const emailStillHasBookings = await hasActiveBookingsForEmail(tenantId, emailKey)
      if (input.customerRowId && !emailStillHasBookings) {
        const { error: delErr } = await supabase
          .from('customers')
          .delete()
          .eq('id', input.customerRowId)
          .eq('tenant_id', tenantId)

        if (delErr) throw new Error(delErr.message)
        customerRowDeleted = true
      }

      return { bookingsArchived: bookingIds.length, customerRowDeleted }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY, tenantId] })
      void queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' })
      void queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'], refetchType: 'all' })

      if (result.bookingsArchived > 0) {
        toast.success(
          `Cliente eliminato · ${result.bookingsArchived} prenotazion${result.bookingsArchived === 1 ? 'e' : 'i'} archiviat${result.bookingsArchived === 1 ? 'a' : 'e'}`,
        )
      } else {
        toast.success('Cliente eliminato')
      }
    },
    onError: (e: Error) => {
      logger.error('[useDeleteCustomer]', e)
      toast.error(e.message || 'Errore eliminazione cliente')
    },
  })
}
