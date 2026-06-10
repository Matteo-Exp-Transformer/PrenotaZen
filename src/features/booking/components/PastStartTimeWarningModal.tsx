import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

export type PastStartTimeWarningVariant = 'accept_pending' | 'edit_booking' | 'new_booking'

const VARIANT_SECOND_LINE: Record<PastStartTimeWarningVariant, string> = {
  accept_pending:
    'Puoi comunque procedere per accettare la richiesta (es. recupero ritardi o correzione manuale).',
  edit_booking:
    'Puoi comunque procedere per salvare le modifiche (es. recupero ritardi o correzione manuale).',
  new_booking:
    'Puoi comunque procedere per creare la prenotazione (es. recupero ritardi o correzione manuale).',
}

export interface PastStartTimeWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel: () => void
  /** YYYY-MM-DD */
  desiredDate: string
  /** HH:mm (secondi opzionali ignorati dal testo mostrato) */
  startTimeHHmm: string
  /** Testo del secondo paragrafo aderente al flusso (default: accettazione richiesta in attesa). */
  variant?: PastStartTimeWarningVariant
}

function parseWallParts(desiredDate: string, startTimeHHmm: string): { y: number; m: number; d: number; h: number; min: number } | null {
  const dm = desiredDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!dm) return null
  const y = Number(dm[1])
  const m = Number(dm[2])
  const d = Number(dm[3])
  const tm = String(startTimeHHmm ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!tm) return null
  const h = Number(tm[1])
  const min = Number(tm[2])
  if (![y, m, d, h, min].every(Number.isFinite)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { y, m, d, h, min }
}

export const PastStartTimeWarningModal: React.FC<PastStartTimeWarningModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  desiredDate,
  startTimeHHmm,
  variant = 'accept_pending',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen || !document.body) {
    return null
  }

  const parts = parseWallParts(desiredDate, startTimeHHmm)
  let bookingStartLabel = `${desiredDate} ${startTimeHHmm}`
  if (parts) {
    try {
      const startDate = new Date(parts.y, parts.m - 1, parts.d)
      const timeLabel = `${String(parts.h).padStart(2, '0')}:${String(parts.min).padStart(2, '0')}`
      bookingStartLabel = `${format(startDate, 'd MMMM yyyy', { locale: it })} alle ${timeLabel}`
    } catch {
      /* keep fallback */
    }
  }

  const nowLabel = format(new Date(), "d MMMM yyyy 'alle' HH:mm", { locale: it })

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="past-start-warning-title"
      onClick={handleOverlayClick}
    >
      <div className="absolute inset-0 bg-black/50 transition-opacity" aria-hidden="true" />

      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl border-2 border-[var(--color-border)]',
          'bg-[var(--color-surface)] shadow-xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4 sm:p-6">
          <h2 id="past-start-warning-title" className="text-title-modal font-semibold text-(--color-text)">
            Orario già trascorso
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-1 shrink-0" aria-label="Chiudi">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="space-y-4 p-4 sm:p-6">
          <div
            className={cn(
              'flex gap-3 rounded-lg border p-4 shadow-sm',
              'border-[var(--color-border)] bg-[var(--color-bg)]',
            )}
          >
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-amber-500"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-2 text-sm text-[var(--color-text)]">
              <p>
                La prenotazione è impostata per <strong className="font-semibold">{bookingStartLabel}</strong>, che è
                precedente all&apos;ora attuale ({nowLabel}).
              </p>
              <p className="text-[var(--color-text-muted)]">{VARIANT_SECOND_LINE[variant]}</p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="min-h-[44px] w-full sm:min-h-0 sm:flex-1"
              onClick={() => {
                onCancel()
                onClose()
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="primary"
              className="min-h-[44px] w-full sm:min-h-0 sm:flex-1"
              onClick={() => {
                onConfirm()
              }}
            >
              Procedi comunque
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  try {
    return createPortal(modalContent, document.body)
  } catch (e) {
    logger.error('[PastStartTimeWarningModal] portal', e)
    return modalContent
  }
}
