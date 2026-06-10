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

/**
 * Email template: Booking Accepted
 */
export const getBookingAcceptedEmail = (booking: BookingRequest) => {
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
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #8B0000 0%, #A52A2A 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
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
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: #8B0000;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
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

        ${booking.special_requests ? `
        <p><strong>📝 Note:</strong> ${booking.special_requests}</p>
        ` : ''}

        <p>Non vediamo l'ora di ospitarti.</p>

        <p>In caso di necessità, contatta lo staff.</p>

        <p>A presto,<br><strong>Lo staff</strong></p>
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
export const getBookingRejectedEmail = (booking: BookingRequest) => {
  const subject = 'Prenotazione non disponibile'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #DC143C 0%, #FF6B6B 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
        }
        .warning-box {
          background: #FEF3C7;
          border-left: 4px solid #F59E0B;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-box {
          background: white;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
          border: 1px solid #e5e7eb;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 14px;
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

        <div class="warning-box">
          <p><strong>⚠️ Motivo:</strong></p>
          <p>${booking.rejection_reason || 'Sala già completamente prenotata in quella data.'}</p>
        </div>

        <div class="info-box">
          <p><strong>Richiesta per:</strong></p>
          <p>📅 ${formatDateOnly(booking.desired_date)}</p>
          <p>🎉 ${EVENT_TYPE_LABELS[booking.event_type || 'drink_caraffe']}</p>
          <p>👥 ${booking.num_guests} ospiti</p>
        </div>

        <p>Ti invitiamo a scegliere un'altra data contattandoci direttamente.</p>

        <p>Ci scusiamo per l'inconveniente.</p>

        <p>Cordiali saluti,<br><strong>Lo staff</strong></p>
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
export const getBookingCancelledEmail = (booking: BookingRequest) => {
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
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #991B1B 0%, #DC143C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
        }
        .info-box {
          background: white;
          border-left: 4px solid #991B1B;
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

        ${booking.cancellation_reason ? `
        <p><strong>📝 Motivo:</strong> ${booking.cancellation_reason}</p>
        ` : ''}

        <p>Se desideri riprogrammare o hai domande, contattaci.</p>

        <p>Cordiali saluti,<br><strong>Lo staff</strong></p>
      </div>

      <div class="footer">
        <p>Questa è un'email automatica, non rispondere a questo messaggio.</p>
      </div>
    </body>
    </html>
  `

  return { subject, html }
}
