// Email client using Resend API
// https://resend.com/docs/api-reference
// 
// Note: Email sending is handled via Supabase Edge Function
// Environment variables are configured in Supabase Secrets, not used directly in this file

interface SendEmailOptions {
  tenantId: string
  to: string | string[] // Support both single email and array (max 50 recipients)
  subject: string
  html: string
  bookingId?: string
  emailType?: string
}

interface EmailLog {
  tenant_id: string
  booking_id?: string
  email_type: string
  recipient_email: string
  status: 'sent' | 'failed' | 'pending'
  provider_response?: Record<string, any>
  error_message?: string
}

/**
 * Send email using Resend API
 */
export const sendEmail = async (options: SendEmailOptions): Promise<{ success: boolean; error?: string }> => {
  try {

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL not configured')
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-email`

    const payload = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      bookingId: options.bookingId,
      emailType: options.emailType || 'manual',
    }


    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify(payload),
    })

    const text = await response.text()
    let data: Record<string, unknown> = {}
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        data = { error: text.slice(0, 200) }
      }
    }

    if (!response.ok) {
      const errMsg =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        `HTTP ${response.status}`
      if (import.meta.env.DEV) {
        console.warn('[Email] Edge send-email:', errMsg)
      }
      return { success: false, error: errMsg }
    }

    if (data.error) {
      const err = String(data.error)
      if (import.meta.env.DEV) {
        console.warn('[Email] Provider error:', err)
      }
      return { success: false, error: err }
    }

    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (import.meta.env.DEV) {
      console.warn('[Email] send-email non raggiungibile (funzione assente o rete):', msg)
    }
    return { success: false, error: msg }
  }
}

/**
 * Log email to database
 */
export const logEmailToDatabase = async (log: EmailLog): Promise<void> => {
  try {
    const { supabase } = await import('./supabase')

    const logData = {
      tenant_id: log.tenant_id,
      booking_id: log.booking_id || null,
      email_type: log.email_type,
      recipient_email: log.recipient_email,
      status: log.status,
      provider_response: log.provider_response || null,
      error_message: log.error_message || null,
    }


    const { error } = await supabase.from('email_logs').insert(logData as any)

    if (error) {
      console.error('❌ [logEmailToDatabase] Error:', error)
    }
  } catch (error) {
    console.error('❌ [logEmailToDatabase] Exception:', error)
  }
}

/**
 * Send and log email
 */
export const sendAndLogEmail = async (
  options: SendEmailOptions,
  emailType: string
): Promise<{ success: boolean; error?: string }> => {

  // For logging, if to is an array, join with comma or use first email
  const recipientEmail = Array.isArray(options.to) ? options.to.join(', ') : options.to
  
  const log: EmailLog = {
    tenant_id: options.tenantId,
    booking_id: options.bookingId,
    email_type: emailType,
    recipient_email: recipientEmail,
    status: 'pending',
  }

  const emailOptions = {
    tenantId: options.tenantId,
    to: options.to,
    subject: options.subject,
    html: options.html,
    bookingId: options.bookingId,
  }
  
  // Set emailType for Edge Function
  const result = await sendEmail({ ...emailOptions, emailType })

  if (result.success) {
    log.status = 'sent'
    log.provider_response = { success: true }
  } else {
    log.status = 'failed'
    log.error_message = result.error
    if (import.meta.env.DEV) {
      console.warn('[sendAndLogEmail] invio non riuscito:', result.error)
    }
  }

  await logEmailToDatabase(log)

  return result
}

