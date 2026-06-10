import type { FC } from 'react'
import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Loader2, Printer, Download } from 'lucide-react'
import { Modal, Button } from '@/components/ui'
import { ShiftToggle } from '@/features/booking/components/analytics/ShiftToggle'
import { useShiftBriefing } from '@/features/booking/hooks/useShiftBriefing'
import { generateBriefingPdf } from '@/lib/shiftBriefingPdf'
import type { ShiftFilter } from '@/features/booking/hooks/useAnalytics'

interface ShiftBriefingModalProps {
  isOpen: boolean
  onClose: () => void
  businessHoursRaw?: unknown
}

export const ShiftBriefingModal: FC<ShiftBriefingModalProps> = ({
  isOpen,
  onClose,
  businessHoursRaw,
}) => {
  const [shift, setShift] = useState<ShiftFilter>('all')
  const { data, isLoading } = useShiftBriefing(shift, businessHoursRaw)

  function handlePrint() {
    window.print()
  }

  function handleDownloadPdf() {
    if (!data) return
    generateBriefingPdf(data.bookings, data.shiftLabel, data.date)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Briefing pre-turno" size="lg">
      <div className="space-y-4">
        {/* Selettore turno */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-(--color-text-muted)">Turno:</span>
          <ShiftToggle value={shift} onChange={setShift} />
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" aria-hidden />
          </div>
        ) : data && data.bookings.length > 0 ? (
          <>
            {/* Header briefing */}
            <div className="print-area rounded-xl border border-(--color-border) bg-surface p-4">
              <h2 className="text-title-section font-bold text-primary-900">
                {format(new Date(data.date), 'EEEE d MMMM yyyy', { locale: it })} — {data.shiftLabel}
              </h2>

              {/* Tabella prenotazioni */}
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-(--color-border) text-sm">
                  <thead className="bg-primary-50 text-primary-900">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Orario</th>
                      <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                      <th className="px-3 py-2 text-left font-semibold">Coperti</th>
                      <th className="px-3 py-2 text-left font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border)">
                    {data.bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-primary-50/50">
                        <td className="px-3 py-2 tabular-nums font-medium text-primary-900">
                          {format(new Date(b.confirmed_start), 'HH:mm')}
                        </td>
                        <td className="px-3 py-2 font-medium text-primary-900">{b.client_name}</td>
                        <td className="px-3 py-2 text-(--color-text)">{b.num_guests}</td>
                        <td className="px-3 py-2 text-(--color-text-muted) max-w-xs truncate">
                          {b.special_requests ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-(--color-border) font-semibold">
                      <td className="px-3 py-2 text-primary-900" colSpan={2}>
                        Totale
                      </td>
                      <td className="px-3 py-2 text-primary-900">{data.totalCovers} coperti</td>
                      <td className="px-3 py-2 text-(--color-text-muted)">{data.totalBookings} prenotazioni</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Azioni */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4" aria-hidden />
                Stampa
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4" aria-hidden />
                Scarica PDF
              </Button>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-(--color-border) bg-surface px-4 py-10 text-center text-sm text-(--color-text-muted)">
            Nessuna prenotazione confermata per questo turno oggi.
          </p>
        )}
      </div>
    </Modal>
  )
}
