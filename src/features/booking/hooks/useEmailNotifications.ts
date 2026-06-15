import { sendAndLogEmail } from '@/lib/email'
import {
  getBookingAcceptedEmail,
  getBookingRejectedEmail,
  getBookingCancelledEmail,
  type TenantInfo,
} from '@/lib/emailTemplates'
import type { BookingRequest } from '@/types/booking'
import { logger } from '@/lib/logger'

/**
 * Recupera nome ristorante e contatti dal tenant per personalizzare la firma email.
 * Fallisce silenziosamente — l'email viene inviata anche senza dati di contatto.
 */
async function fetchTenantInfo(tenantId: string): Promise<TenantInfo> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase
      .from('restaurant_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', tenantId)
      .in('setting_key', ['restaurant_name', 'contact_phone', 'contact_email'])

    const map: Record<string, string> = {}
    for (const row of data ?? []) {
      const v = row.setting_value
      if (typeof v === 'string' && v.trim()) {
        map[row.setting_key] = v.trim()
      }
    }

    return {
      name: map['restaurant_name'],
      phone: map['contact_phone'],
      email: map['contact_email'],
    }
  } catch {
    return {}
  }
}

/**
 * Send email when booking is accepted
 */
export const sendBookingAcceptedEmail = async (booking: BookingRequest): Promise<{ success: boolean }> => {
  try {
    if (!booking.client_email?.trim()) {
      return { success: false }
    }

    const tenantInfo = await fetchTenantInfo(booking.tenant_id)
    const { subject, html } = getBookingAcceptedEmail(booking, tenantInfo)

    const result = await sendAndLogEmail(
      {
        tenantId: booking.tenant_id,
        to: booking.client_email,
        subject,
        html,
        bookingId: booking.id,
      },
      'booking_accepted'
    )

    return { success: result.success }
  } catch (error) {
    logger.error('[Email] Error sending accepted email:', error)
    return { success: false }
  }
}

/**
 * Send email when booking is rejected
 */
export const sendBookingRejectedEmail = async (booking: BookingRequest): Promise<{ success: boolean }> => {
  try {
    if (!booking.client_email?.trim()) {
      return { success: false }
    }

    const tenantInfo = await fetchTenantInfo(booking.tenant_id)
    const { subject, html } = getBookingRejectedEmail(booking, tenantInfo)

    const result = await sendAndLogEmail(
      {
        tenantId: booking.tenant_id,
        to: booking.client_email,
        subject,
        html,
        bookingId: booking.id,
      },
      'booking_rejected'
    )

    return { success: result.success }
  } catch (error) {
    logger.error('[Email] Error sending rejected email:', error)
    return { success: false }
  }
}

/**
 * Send email when booking is cancelled
 */
export const sendBookingCancelledEmail = async (booking: BookingRequest): Promise<{ success: boolean }> => {
  try {
    if (!booking.client_email?.trim()) {
      return { success: false }
    }

    const tenantInfo = await fetchTenantInfo(booking.tenant_id)
    const { subject, html } = getBookingCancelledEmail(booking, tenantInfo)

    const result = await sendAndLogEmail(
      {
        tenantId: booking.tenant_id,
        to: booking.client_email,
        subject,
        html,
        bookingId: booking.id,
      },
      'booking_cancelled'
    )

    return { success: result.success }
  } catch (error) {
    logger.error('[Email] Error sending cancelled email:', error)
    return { success: false }
  }
}

/**
 * Abilita chiamate alla Edge `send-email` dal browser (accetta/rifiuta/test).
 * Default: **false** — senza Edge deployata si ottiene "Failed to fetch" e rumore in console.
 * Imposta `VITE_ENABLE_SEND_EMAIL=true` in `.env.local` quando `send-email` è deployata e configurata.
 */
export const areEmailNotificationsEnabled = (): boolean => {
  return import.meta.env.VITE_ENABLE_SEND_EMAIL === 'true'
}
