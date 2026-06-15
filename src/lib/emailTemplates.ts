// Email templates for booking notifications

import type { BookingRequest } from '@/types/booking'
import {
  buildBookingEmailSummaryHtml,
  type BookingEmailSummaryContext,
} from '@/features/booking/utils/buildBookingEmailSummary'

export interface TenantInfo {
  name?: string
  phone?: string
  email?: string
}

export type { BookingEmailSummaryContext }

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

const SUMMARY_BOX_STYLE = `
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
          gap: 8px;
        }
        .info-label {
          font-weight: bold;
          min-width: 120px;
          color: #666;
        }
        .info-value {
          color: #333;
          flex: 1;
        }
        .info-value.strike {
          text-decoration: line-through;
          color: #9ca3af;
        }
        .info-value.total-booking {
          color: #c2410c;
        }
        .summary-block {
          margin: 14px 0;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .summary-heading {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6b7280;
          margin: 0 0 8px;
        }
        .summary-list {
          margin: 0;
          padding-left: 18px;
        }
        .summary-list.menu-list {
          list-style: none;
          padding-left: 0;
        }
        .menu-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 6px 0;
          font-size: 14px;
        }
        .menu-item .cat {
          color: #6b7280;
        }
        .menu-price {
          color: #4b5563;
          font-weight: 600;
          white-space: nowrap;
        }
        .total-line {
          margin: 12px 0 4px;
        }
        .promo-chips {
          margin: 0;
          font-weight: 600;
          color: #374151;
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

function buildSummaryBlock(
  booking: BookingRequest,
  summaryContext: BookingEmailSummaryContext | undefined,
  timing: 'accepted' | 'rejected',
): string {
  if (timing === 'rejected') {
    return ''
  }

  const html = buildBookingEmailSummaryHtml(booking, summaryContext, timing)
  if (html) return html

  const fallbackRows: string[] = []
  if (booking.client_name) {
    fallbackRows.push(`
          <div class="info-row">
            <span class="info-label">Nome:</span>
            <span class="info-value"><strong>${booking.client_name}</strong></span>
          </div>`)
  }
  if (booking.num_guests > 0) {
    fallbackRows.push(`
          <div class="info-row">
            <span class="info-label">Ospiti:</span>
            <span class="info-value"><strong>${booking.num_guests}</strong></span>
          </div>`)
  }
  return fallbackRows.length > 0 ? `<div class="info-box">${fallbackRows.join('')}</div>` : ''
}

/**
 * Email template: Booking Accepted
 */
export const getBookingAcceptedEmail = (
  booking: BookingRequest,
  tenantInfo?: TenantInfo,
  summaryContext?: BookingEmailSummaryContext,
) => {
  const subject = 'Prenotazione confermata'
  const summaryBlock = buildSummaryBlock(booking, summaryContext, 'accepted')

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
        ${SUMMARY_BOX_STYLE}
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

        ${summaryBlock}

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
export const getBookingRejectedEmail = (
  booking: BookingRequest,
  tenantInfo?: TenantInfo,
  summaryContext?: BookingEmailSummaryContext,
) => {
  const subject = 'Prenotazione non disponibile'
  const summaryBlock = buildSummaryBlock(booking, summaryContext, 'rejected')

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
        ${SUMMARY_BOX_STYLE}
        .info-box {
          border: 1px solid #e5e7eb;
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

        ${summaryBlock}

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
 * Email template: Booking Cancelled (non inviata in produzione — allineato al builder riepilogo)
 */
export const getBookingCancelledEmail = (
  booking: BookingRequest,
  tenantInfo?: TenantInfo,
  summaryContext?: BookingEmailSummaryContext,
) => {
  const subject = 'Prenotazione cancellata'
  const summaryBlock = buildSummaryBlock(booking, summaryContext, 'accepted')

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
        ${SUMMARY_BOX_STYLE}
        .info-box {
          border-left: 4px solid #991B1B;
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

        ${summaryBlock}

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
