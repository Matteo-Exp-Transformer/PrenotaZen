import type { BookingRequest } from './booking'

/** Origine riga `customers` nel DB. */
export type CustomerDbSource = 'manual' | 'synced'

/** Profilo unificato in UI: con prenotazioni → sempre `booking`. */
export type CustomerProfileSource = 'booking' | 'manual'

export interface CustomerProfile {
  email: string
  name: string
  phone?: string
  source: CustomerProfileSource
  /** Riga `customers` se presente (manuale o synced). */
  manual_id?: string
  customer_db_source?: CustomerDbSource
  notes?: string
  booking_count: number
  total_guests: number
  first_booking_date?: string
  last_booking_date?: string
  bookings: BookingRequest[]
  accepted_count: number
  pending_count: number
  cancelled_count: number
}
