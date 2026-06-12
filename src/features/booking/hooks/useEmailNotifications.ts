import { sendAndLogEmail } from '@/lib/email'
import {
  getBookingAcceptedEmail,
  getBookingRejectedEmail,
  getBookingCancelledEmail,
} from '@/lib/emailTemplates'
import type { BookingRequest } from '@/types/booking'
import { logger } from '@/lib/logger'

/**
 * Send email when booking is accepted
 */
export const sendBookingAcceptedEmail = async (booking: BookingRequest): Promise<{ success: boolean }> => {
  try {
    if (!booking.client_email?.trim()) {
      return { success: false }
    }

    const { subject, html } = getBookingAcceptedEmail(booking)

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

    const { subject, html } = getBookingRejectedEmail(booking)

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

    const { subject, html } = getBookingCancelledEmail(booking)

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

