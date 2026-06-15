// Email templates for booking notifications

import type { BookingRequest } from '@/types/booking'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const EVENT_TYPE_LABELS: Record<string, string> = {
  drink_caraffe: 'Drink/Caraffe',
  drink_rinfresco_leggero: 'Drink/Caraffe + rinfresco leggero',
  drink_rinfresco_completo: 'Drink/Caraffe + rinfresco completo',
  drink_rinfresco_completo_primo: 'Drink/Caraffe + rinfresco completo + primo piatto',
  menu_pranzo_cena: 'Menu Pranzo / Menù Cena',
}

const formatDateTime = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd MMMM yyyy alle ore HH:mm', { locale: it })
  } catch {
    return dateStr
  }
}

const formatDateOnly = (dateStr: string) => {
  try {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: it })
  } catch {
    return dateStr
  }
}

export interface TenantInfo {
  name?: string
  phone?: string
  email?: string
}

const BASE_STYLE = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }
  .content {
    background: #f9fafb;
    padding: 30px;
    border: 1px solid #e5e7eb;
  }
  .info-box {
    background: white;
    padding: 20px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .footer {
    text-align: center;
    padding: 20px;
    color: #666;
    font-size: 14px;
  }
  .contacts {
    margin-top: 8px;
    font-size: 14px;
    color: #555;
  }
`

/** Blocco firma — "Lo staff" + nome tenant + contatti opzionali. */
function buildSignature(tenantInfo?: TenantInfo): string {
  const name = tenantInfo?.name?.trim()
  const phone = tenantInfo?.phone?.trim()
  const email = tenantInfo?.email?.trim()

  const contactLines: string[] = []
  if (phone) contactLines.push(`📞 ${phone}`)
  if (email) contactLines.push(`✉️ ${email}`)

  const tenantLine = name ? `<br><strong>${name}</strong>` : ''
  const contactBlock =
    contactLines.length > 0
      ? `<div class="contacts">${contactLines.join('&nbsp;&nbsp;|&nbsp;&nbsp;')}</div>`
      : ''

  return `<strong>Lo staff</strong>${tenantLine}${contactBlock}`
}

/**
 * Email template: Booking Accepted
 */
export const getBookingAcceptedEmail = (booking: BookingRequest, tenantInfo?: TenantInfo) => {
  const eventDate = booking.confirmed_start
    ? formatDateTime(booking.confirmed_start)
    : formatDateOnly(booking.desired_date)

  const subject = 'Prenotazione confermata'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${BASE_STYLE}
        .header {
          background: linear-gradient(135deg, #8B0000 0%, #A52A2A 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .success-badge {
          background: #10b981;
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          display: inline-block;
          margin: 20px 0;
          font-weight: bold;
        }
        .info-box {
          background: white;
          border-left: 4px solid #8B0000;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-row {
          display: flex;
          margin: 10px 0;
        }
        .info-label {
          font-weight: bold;
          width: 150px;
          color: #666;
        }
        .info-value {
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Prenotazione</h1>
        <p>La tua prenotazione è stata confermata!</p>
      </div>

      <div class="content">
        <center>
          <div class="success-badge">✅ PRENOTAZIONE CONFERMATA</div>
        </center>

        <p>Ciao <strong>${booking.client_name}</strong>,</p>

        <p>Siamo felici di confermare la tua prenotazione.</p>

        <div class="info-box">
          <div class="info-row">
            <span class="info-label">📅 Data & Ora:</span>
            <span class="info-value"><strong>${eventDate}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">🎉 Tipo Evento:</span>
            <span class="info-value"><strong>${EVENT_TYPE_LABELS[booking.event_type || 'drink_caraffe']}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">👥 Numero Ospiti:</span>
            <span class="info-value"><strong>${booking.num_guests}</strong></span>
          </div>
        </div>

        ${booking.special_requests ? `<p><strong>📝 Note:</strong> ${booking.special_requests}</p>` : ''}

        <p>Non vediamo l'ora di ospitarti.<br>In caso di necessità non esitare a contattarci.</p>

        <p>A presto,<br>${buildSignature(tenantInfo)}</p>
      </div>

      <div class="footer">
        <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}

/**
 * Email template: Booking Rejected
 */
export const getBookingRejectedEmail = (booking: BookingRequest, tenantInfo?: TenantInfo) => {
  const subject = 'Prenotazione non disponibile'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${BASE_STYLE}
        .header {
          background: linear-gradient(135deg, #DC143C 0%, #FF6B6B 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .info-box {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Prenotazione</h1>
        <p>Prenotazione non disponibile</p>
      </div>

      <div class="content">
        <p>Ciao <strong>${booking.client_name}</strong>,</p>

        <p>Ci dispiace informarti che la tua richiesta di prenotazione non può essere confermata per la data richiesta.</p>

        <div class="info-box">
          <p><strong>Richiesta per:</strong></p>
          <p>📅 ${formatDateOnly(booking.desired_date)}</p>
          <p>🎉 ${EVENT_TYPE_LABELS[booking.event_type || 'drink_caraffe']}</p>
          <p>👥 ${booking.num_guests} ospiti</p>
        </div>

        <p>Ti invitiamo a scegliere un'altra data contattandoci direttamente.</p>

        <p>Ci scusiamo per l'inconveniente.</p>

        <p>Cordiali saluti,<br>${buildSignature(tenantInfo)}</p>
      </div>

      <div class="footer">
        <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}

/**
 * Email template: Booking Cancelled
 */
export const getBookingCancelledEmail = (booking: BookingRequest, tenantInfo?: TenantInfo) => {
  const eventDate = booking.confirmed_start
    ? formatDateTime(booking.confirmed_start)
    : formatDateOnly(booking.desired_date)

  const subject = 'Prenotazione cancellata'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${BASE_STYLE}
        .header {
          background: linear-gradient(135deg, #991B1B 0%, #DC143C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .info-box {
          border-left: 4px solid #991B1B;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Prenotazione</h1>
        <p>Prenotazione Cancellata</p>
      </div>

      <div class="content">
        <p>Ciao <strong>${booking.client_name}</strong>,</p>

        <p>Ti informiamo che la tua prenotazione è stata cancellata.</p>

        <div class="info-box">
          <p><strong>📅 Prenotazione:</strong> ${eventDate}</p>
          <p><strong>🎉 Evento:</strong> ${EVENT_TYPE_LABELS[booking.event_type || 'drink_caraffe']}</p>
          <p><strong>👥 Ospiti:</strong> ${booking.num_guests}</p>
        </div>

        <p>Se desideri riprogrammare o hai domande, non esitare a contattarci.</p>

        <p>Cordiali saluti,<br>${buildSignature(tenantInfo)}</p>
      </div>

      <div class="footer">
        <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}

/** @deprecated Alias — usare getBookingAcceptedEmail. */
export const getBookingConfirmationEmail = getBookingAcceptedEmail
