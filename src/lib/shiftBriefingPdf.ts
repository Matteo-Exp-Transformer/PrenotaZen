import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'
import type { BriefingBooking } from '@/features/booking/hooks/useShiftBriefing'

/**
 * Genera un PDF briefing turno formato A4.
 * Titolo + data/turno + tabella prenotazioni + footer pagina.
 * Il file viene scaricato automaticamente via doc.save().
 */
export function generateBriefingPdf(
  bookings: BriefingBooking[],
  shiftLabel: string,
  date: string,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14

  // Titolo
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Briefing Pre-Turno', marginX, 20)

  // Data + turno
  const dateLabel = format(parseISO(date), 'EEEE d MMMM yyyy', { locale: it })
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`${dateLabel} — ${shiftLabel}`, marginX, 30)

  // Linea separatrice
  doc.setDrawColor(200)
  doc.line(marginX, 34, pageWidth - marginX, 34)

  // Tabella prenotazioni
  autoTable(doc, {
    startY: 38,
    margin: { left: marginX, right: marginX },
    head: [['Orario', 'Cliente', 'Coperti', 'Note']],
    body: bookings.map((b) => [
      format(new Date(b.confirmed_start), 'HH:mm'),
      b.client_name,
      String(b.num_guests),
      b.special_requests ?? '',
    ]),
    headStyles: {
      fillColor: [79, 70, 229], // primary-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 248, 255] },
    foot: [
      [
        '',
        `Totale: ${bookings.length} prenotazioni`,
        `${bookings.reduce((s, b) => s + b.num_guests, 0)} coperti`,
        '',
      ],
    ],
    footStyles: { fontStyle: 'bold', fillColor: [240, 240, 255] },
  })

  // Footer pagine
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    )
  }

  doc.save(`briefing-${date}-${shiftLabel.toLowerCase().replace(/\s+/g, '-')}.pdf`)
  return doc
}
