import { sendAndLogEmail } from '@/lib/email'
import {
  getBookingAcceptedEmail,
  getBookingRejectedEmail,
  getBookingCancelledEmail,
  type BookingEmailSummaryContext,
  type TenantInfo,
} from '@/lib/emailTemplates'
import type { BookingRequest } from '@/types/booking'
import { logger } from '@/lib/logger'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'

interface TenantEmailBundle {
  tenantInfo: TenantInfo
  summaryContext: BookingEmailSummaryContext
}

/**
 * Recupera nome ristorante, contatti e contesto riepilogo (config Prenota + preset + categorie).
 * Fallisce parzialmente — l'email usa solo campi booking certi se manca il contesto.
 */
async function fetchTenantEmailBundle(tenantId: string): Promise<TenantEmailBundle> {
  const empty: TenantEmailBundle = {
    tenantInfo: {},
    summaryContext: { modes: [], customStaffPresets: [], menuCategories: [] },
  }

  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', tenantId)
      .in('setting_key', [
        'restaurant_name',
        'contact_phone',
        'contact_email',
        'booking_public_form_config',
        'booking_custom_staff_presets',
      ])

    const map: Record<string, unknown> = {}
    for (const row of settings ?? []) {
      map[row.setting_key] = row.setting_value
    }

    const tenantInfo: TenantInfo = {
      name: typeof map.restaurant_name === 'string' ? map.restaurant_name.trim() : undefined,
      phone: typeof map.contact_phone === 'string' ? map.contact_phone.trim() : undefined,
      email: typeof map.contact_email === 'string' ? map.contact_email.trim() : undefined,
    }

    const formConfig = restaurantSettingRegistry.booking_public_form_config.parseFromDb(
      map.booking_public_form_config,
    )
    const presetsRaw = map.booking_custom_staff_presets
    const customStaffPresets = Array.isArray(presetsRaw)
      ? (presetsRaw as CustomStaffPreset[])
      : []

    const { data: categories } = await supabase
      .from('menu_categories')
      .select('key, label, sort_order')
      .eq('tenant_id', tenantId)
      .order('sort_order')

    return {
      tenantInfo,
      summaryContext: {
        modes: formConfig?.booking_modes ?? [],
        customStaffPresets,
        menuCategories: (categories ?? []).map((c) => ({
          key: c.key,
          label: c.label,
          sort_order: c.sort_order,
        })),
      },
    }
  } catch (error) {
    logger.warn('[Email] Impossibile caricare contesto tenant per riepilogo:', error)
    return empty
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

    const { tenantInfo, summaryContext } = await fetchTenantEmailBundle(booking.tenant_id)
    const { subject, html } = getBookingAcceptedEmail(booking, tenantInfo, summaryContext)

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

    const { tenantInfo, summaryContext } = await fetchTenantEmailBundle(booking.tenant_id)
    const { subject, html } = getBookingRejectedEmail(booking, tenantInfo, summaryContext)

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

    const { tenantInfo, summaryContext } = await fetchTenantEmailBundle(booking.tenant_id)
    const { subject, html } = getBookingCancelledEmail(booking, tenantInfo, summaryContext)

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
