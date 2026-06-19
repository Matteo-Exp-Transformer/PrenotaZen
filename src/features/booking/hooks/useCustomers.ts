import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { normalizeCustomerEmail } from '@/lib/customerEmail'
import type { BookingRequest } from '@/types/booking'
import type { CustomerProfile, CustomerDbSource } from '@/types/customer'
import { logger } from '@/lib/logger'

export type CustomerDateFilter = 'all' | 'week' | 'month' | 'year'

export const CRM_QUERY_KEY = 'crm-customer-profiles'

function rowToBookingRequest(row: Record<string, unknown>): BookingRequest {
  return row as unknown as BookingRequest
}

export function mergeProfiles(
  bookingRows: Record<string, unknown>[],
  customerRows: {
    id: string
    name: string
    email: string
    phone: string | null
    notes: string | null
    source: string
    marketing_consent: boolean
  }[],
): CustomerProfile[] {
  const byEmail = new Map<string, BookingRequest[]>()

  for (const raw of bookingRows) {
    const b = rowToBookingRequest(raw)
    const key = normalizeCustomerEmail(b.client_email)
    if (!key) continue
    const arr = byEmail.get(key) ?? []
    arr.push(b)
    byEmail.set(key, arr)
  }

  for (const [, list] of byEmail) {
    list.sort((a, b) => {
      const cmp = b.desired_date.localeCompare(a.desired_date)
      if (cmp !== 0) return cmp
      return b.updated_at.localeCompare(a.updated_at)
    })
  }

  const customerByEmail = new Map<
    string,
    {
      id: string
      name: string
      email: string
      phone: string | null
      notes: string | null
      source: CustomerDbSource
      marketing_consent: boolean
    }
  >()
  for (const c of customerRows) {
    const key = normalizeCustomerEmail(c.email)
    if (!key) continue
    customerByEmail.set(key, {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      source: c.source === 'synced' ? 'synced' : 'manual',
      marketing_consent: c.marketing_consent === true,
    })
  }

  const emails = new Set([...byEmail.keys(), ...customerByEmail.keys()])
  const out: CustomerProfile[] = []

  for (const email of emails) {
    const bookings = byEmail.get(email) ?? []
    const cust = customerByEmail.get(email)

    const latest = bookings[0]
    const nameFromBookings = latest?.client_name ?? cust?.name ?? ''
    const phoneFromBookings =
      latest?.client_phone !== undefined && latest?.client_phone !== null && latest.client_phone !== ''
        ? latest.client_phone
        : undefined
    const phone = bookings.length > 0 ? phoneFromBookings : cust?.phone ?? undefined

    const dates = bookings.map((b) => b.desired_date).filter(Boolean)
    const first_booking_date = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : undefined
    const last_booking_date = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined

    let total_guests = 0
    let accepted_count = 0
    let pending_count = 0
    let cancelled_count = 0
    for (const b of bookings) {
      total_guests += b.num_guests ?? 0
      if (b.status === 'accepted') accepted_count += 1
      else if (b.status === 'pending') pending_count += 1
      if (b.cancelled_at) cancelled_count += 1
    }

    const source: CustomerProfile['source'] = bookings.length > 0 ? 'booking' : 'manual'

    const marketing_consent =
      cust !== undefined
        ? cust.marketing_consent === true
        : bookings.some((b) => b.marketing_consent === true)

    out.push({
      email,
      name: bookings.length > 0 ? nameFromBookings : cust?.name ?? '',
      phone,
      source,
      manual_id: cust?.id,
      customer_db_source: cust?.source,
      notes: cust?.notes ?? undefined,
      booking_count: bookings.length,
      total_guests,
      first_booking_date,
      last_booking_date,
      bookings,
      accepted_count,
      pending_count,
      cancelled_count,
      marketing_consent,
    })
  }

  out.sort((a, b) => (b.last_booking_date ?? '').localeCompare(a.last_booking_date ?? ''))
  return out
}

function cutoffForDateFilter(filter: CustomerDateFilter): string | null {
  if (filter === 'all') return null
  const d = new Date()
  if (filter === 'week') d.setDate(d.getDate() - 7)
  if (filter === 'month') d.setDate(d.getDate() - 30)
  if (filter === 'year') d.setFullYear(d.getFullYear() - 1)
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useCustomers() {
  const { tenantId } = useTenantContext()
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<CustomerDateFilter>('all')

  const query = useQuery({
    queryKey: [CRM_QUERY_KEY, tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant mancante')

      const [bookingsRes, customersRes] = await Promise.all([
        supabase
          .from('booking_requests')
          .select('id, client_email, client_name, client_phone, desired_date, updated_at, status, num_guests, cancelled_at, booking_type, event_type, marketing_consent')
          .eq('tenant_id', tenantId)
          .neq('status', 'deleted'),
        supabase.from('customers').select('id,name,email,phone,notes,source,marketing_consent').eq('tenant_id', tenantId),
      ])

      if (bookingsRes.error) {
        logger.error('[useCustomers] booking_requests', bookingsRes.error)
        throw new Error(bookingsRes.error.message)
      }
      if (customersRes.error) {
        logger.error('[useCustomers] customers', customersRes.error)
        throw new Error(customersRes.error.message)
      }

      const bookingRows = (bookingsRes.data ?? []) as Record<string, unknown>[]
      const customerRows = (customersRes.data ?? []) as {
        id: string
        name: string
        email: string
        phone: string | null
        notes: string | null
        source: string
        marketing_consent: boolean
      }[]

      return mergeProfiles(bookingRows, customerRows)
    },
  })

  const customers = useMemo(() => {
    const merged = query.data ?? []
    const q = searchQuery.trim().toLowerCase()
    const cutoff = cutoffForDateFilter(dateFilter)

    return merged.filter((p) => {
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.phone?.toLowerCase().includes(q) ?? false)
        if (!hit) return false
      }
      if (cutoff && p.last_booking_date) {
        if (p.last_booking_date < cutoff) return false
      }
      if (cutoff && !p.last_booking_date) {
        return false
      }
      return true
    })
  }, [query.data, searchQuery, dateFilter])

  return {
    customers,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    refetch: query.refetch,
    queryKey: [CRM_QUERY_KEY, tenantId] as const,
  }
}
