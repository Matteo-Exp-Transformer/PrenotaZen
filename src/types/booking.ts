// Type definitions for booking system
import type { SelectedMenuItem } from './menu'
import type { PresetMenuType } from '../features/booking/constants/presetMenus'

export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'deleted'

/** Tipologia prenotazione: tavolo senza menu; le altre due condividono selezione menu e intolleranze. */
export type BookingType = 'tavolo' | 'rinfresco_laurea' | 'menu_prezzo_fisso'
export type EventType = 'cena' | 'aperitivo' | 'evento' | 'laurea' | 'drink_caraffe' | 'drink_rinfresco_leggero' | 'drink_rinfresco_completo' | 'drink_rinfresco_completo_primo' | 'menu_pranzo_cena'

export interface DietaryRestriction {
  restriction: string
  guest_count: number
  notes?: string
}

export interface BookingRequest {
  id: string
  created_at: string
  updated_at: string

  // Client information
  client_name: string
  client_email: string
  client_phone?: string

  // Booking details
  event_type: EventType
  desired_date: string
  desired_time?: string
  num_guests: number
  special_requests?: string
  menu?: string

  // Extended properties for Rinfresco di Laurea / menu a prezzo fisso
  booking_type?: BookingType
  menu_selection?: {
    items: SelectedMenuItem[]
  }
  dietary_restrictions?: DietaryRestriction[]
  preset_menu?: PresetMenuType
  menu_total_per_person?: number
  menu_total_booking?: number
  /** Nomi promo menù attive al momento della prenotazione (solo admin). */
  menu_promo_labels?: string[] | null
  placement?: string

  // Status management
  status: BookingStatus
  confirmed_start?: string
  confirmed_end?: string
  rejection_reason?: string

  // Cancellation tracking
  cancellation_reason?: string
  cancelled_at?: string
  cancelled_by?: string

  // Booking source tracking
  booking_source?: 'public' | 'admin'
  source?: 'public_form' | 'manual' | 'walk_in' | 'phone' | 'google'

  // No-show tracking (migrazione 009)
  no_show?: boolean

  // Note interne admin (migrazione 056) — visibili solo dal modal dettaglio admin
  admin_notes?: string | null

  // Multi-tenant
  tenant_id: string

  /** Consenso a ricevere comunicazioni promozionali via email (art. 6.1.a GDPR). */
  marketing_consent?: boolean

  /** Consenso esplicito art. 9 GDPR per dati alimentari (allergie/intolleranze). */
  dietary_data_consent?: boolean
  dietary_off_platform_notice?: boolean
  dietary_data_consent_at?: string | null
}

export interface BookingRequestInput {
  client_name: string
  client_email: string
  client_phone?: string
  event_type?: EventType
  desired_date: string
  desired_time?: string
  num_guests: number
  special_requests?: string
  // Extended properties for Rinfresco di Laurea / menu a prezzo fisso
  booking_type?: BookingType
  menu_selection?: {
    items: SelectedMenuItem[]
  }
  dietary_restrictions?: DietaryRestriction[]
  preset_menu?: PresetMenuType
  menu_total_per_person?: number
  menu_total_booking?: number
  menu_promo_labels?: string[] | null
  placement?: string
  booking_source?: 'public' | 'admin'
  /** Consenso a ricevere comunicazioni promozionali via email (art. 6.1.a GDPR). Facoltativo, default false. */
  marketing_consent?: boolean

  /** Consenso esplicito art. 9 GDPR per dati alimentari (allergie/intolleranze). */
  dietary_data_consent?: boolean
  dietary_off_platform_notice?: boolean
  dietary_data_consent_at?: string | null

  // Multi-tenant
  tenant_id?: string
  tenantSlug?: string
}

export interface AdminUser {
  id: string
  email: string
  tenant_id?: string
  name?: string
  created_at: string
  updated_at: string
}

export interface EmailLog {
  id: string
  booking_id: string
  tenant_id?: string
  email_type: string
  recipient_email: string
  sent_at: string
  status: 'sent' | 'failed' | 'pending'
  provider_response?: Record<string, any>
  error_message?: string
}

export interface RestaurantSetting {
  id: string
  setting_key: string
  tenant_id?: string
  setting_value: Record<string, any>
  updated_at: string
}

// Calendar event type (for FullCalendar integration)
export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  backgroundColor: string
  borderColor: string
  textColor?: string
  extendedProps: BookingRequest
}

// Form validation types
export interface BookingFormErrors {
  client_name?: string
  client_email?: string
  client_phone?: string
  event_type?: string
  desired_date?: string
  desired_time?: string
  num_guests?: string
  special_requests?: string
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Capacity management types

/** Identificatore di fascia: service_slots.id (UUID) oppure 'daily' per il check giornaliero. */
export type TimeSlot = string

export interface TimeSlotCapacity {
  slot: TimeSlot
  /** null = nessun tetto configurato per questa fascia */
  capacity: number | null
  occupied: number
  /** null quando non c'e cap (`capacity === null`) */
  available: number | null
}

/** Capacity giornaliera per N fasce dinamiche. */
export interface DailyCapacity {
  date: string
  slots: TimeSlotCapacity[]
}

/** @deprecated Compat getter per consumer legacy. Rimuovere allo Step 9. */
export function dailyCapacityBySlotName(
  cap: DailyCapacity,
  slotName: 'morning' | 'afternoon' | 'evening'
): TimeSlotCapacity | undefined {
  return cap.slots.find((s) => s.slot === slotName)
}

export interface AvailabilityCheck {
  isAvailable: boolean
  slotsStatus: TimeSlotCapacity[]
  errorMessage?: string
  exceededSlots?: Array<{
    slot: TimeSlot
    slotName: string
    exceededBy: number
    totalOccupied: number
    capacity: number
  }>
}
