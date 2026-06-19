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

export interface EmailTemplateOverrides {
  subject?: string
  intro?: string
  closing?: string
}

// ── Default testi cablati (esposti per placeholder UI e "Ripristina") ──────

export const DEFAULT_ACCEPTED_SUBJECT = 'Prenotazione confermata'
export const DEFAULT_ACCEPTED_INTRO = 'Siamo felici di confermare la tua prenotazione.'
export const DEFAULT_ACCEPTED_CLOSING =
  "Non vediamo l'ora di ospitarti.\nIn caso di necessità non esitare a contattarci."

export const DEFAULT_REJECTED_SUBJECT = 'Prenotazione non disponibile'
export const DEFAULT_REJECTED_INTRO =
  'Ci dispiace informarti che la tua richiesta di prenotazione non può essere confermata per la data richiesta.'
export const DEFAULT_REJECTED_CLOSING =
  "Ti invitiamo a scegliere un'altra data contattandoci direttamente.\n\nCi scusiamo per l'inconveniente."

// ─────────────────────────────────────────────────────────────────────────────

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

/** Converte \n in <br> per il rendering HTML. */
function nl2br(text: string): string {
  return text.replace(/\n/g, '<br>')
}

/**
 * Email template: Booking Accepted
 */
export const getBookingAcceptedEmail = (
  booking: BookingRequest,
  tenantInfo?: TenantInfo,
  summaryContext?: BookingEmailSummaryContext,
  overrides?: EmailTemplateOverrides,
) => {
  const subject = overrides?.subject?.trim() || DEFAULT_ACCEPTED_SUBJECT
  const introText = overrides?.intro?.trim() || DEFAULT_ACCEPTED_INTRO
  const closingText = overrides?.closing?.trim() || DEFAULT_ACCEPTED_CLOSING
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

        <p>${nl2br(introText)}</p>

        ${summaryBlock}

        <p>${nl2br(closingText)}</p>

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
  overrides?: EmailTemplateOverrides,
) => {
  const subject = overrides?.subject?.trim() || DEFAULT_REJECTED_SUBJECT
  const introText = overrides?.intro?.trim() || DEFAULT_REJECTED_INTRO
  const closingText = overrides?.closing?.trim() || DEFAULT_REJECTED_CLOSING
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

        <p>${nl2br(introText)}</p>

        ${summaryBlock}

        <p>${nl2br(closingText)}</p>

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

/**
 * Email template: Promo/offerte — testo libero, nessun riepilogo prenotazione.
 * Footer privacy fisso incluso.
 */
export const getPromoEmail = (
  { subject, body }: { subject: string; body: string },
  tenantInfo?: TenantInfo,
) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${BASE_STYLE}
        .header {
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .privacy-note {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Un messaggio per te</h1>
      </div>

      <div class="content">
        <p>${nl2br(body)}</p>

        <p>${buildSignature(tenantInfo)}</p>

        <p class="privacy-note">Hai ricevuto questa email perché sei nostro cliente.
          <a href="{{UNSUBSCRIBE_URL}}" style="color:#9ca3af;text-decoration:underline">Per non riceverne più, clicca qui</a>.</p>
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

// ── Campagne email ────────────────────────────────────────────────────────────

export const DEFAULT_CAMPAIGN_HEADING = 'Un messaggio per te'

export interface CampaignLink {
  label: string
  url: string
}

export interface CampaignEmailInput {
  subject: string
  body: string
  links: CampaignLink[]
  heading?: string
}

/** Valida che un URL sia solo http o https (scarta javascript:, data:, ecc.). */
export function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function autoLinkify(html: string): string {
  // Trasforma https?://... e www.... in <a href>. Opera sull'HTML già escaped.
  return html.replace(
    /(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)/g,
    (match, httpUrl, wwwUrl) => {
      const href = httpUrl ?? `https://${wwwUrl}`
      const display = escapeHtml(match)
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${display}</a>`
    },
  )
}

function buildCampaignLinksHtml(links: CampaignLink[]): string {
  const valid = links.filter((l) => l.label.trim() && isValidHttpUrl(l.url))
  if (valid.length === 0) return ''

  const buttons = valid
    .map(
      (l) =>
        `<a href="${l.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;margin:4px 4px 4px 0;">${escapeHtml(l.label)}</a>`,
    )
    .join(' ')

  return `<div style="margin:20px 0 16px;">${buttons}</div>`
}

/**
 * Email template: Campagna promo — corpo con escape + auto-link, pulsanti link strutturati,
 * footer privacy fisso. Nessun riepilogo prenotazione.
 */
export const getCampaignEmail = (
  { subject, body, links, heading }: CampaignEmailInput,
  tenantInfo?: TenantInfo,
) => {
  const escapedBody = escapeHtml(body)
  const bodyWithBr = nl2br(escapedBody)
  const bodyLinked = autoLinkify(bodyWithBr)
  const linksHtml = buildCampaignLinksHtml(links)
  const headingText = escapeHtml(heading?.trim() || DEFAULT_CAMPAIGN_HEADING)

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${BASE_STYLE}
        .header {
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .privacy-note {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${headingText}</h1>
      </div>

      <div class="content">
        <p>${bodyLinked}</p>

        ${linksHtml}

        <p>${buildSignature(tenantInfo)}</p>

        <p class="privacy-note">Hai ricevuto questa email perché sei nostro cliente.
          <a href="{{UNSUBSCRIBE_URL}}" style="color:#9ca3af;text-decoration:underline">Per non riceverne più, clicca qui</a>.</p>
      </div>

      <div class="footer">
        <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}
