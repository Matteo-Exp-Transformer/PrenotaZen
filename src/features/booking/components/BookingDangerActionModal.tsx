import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BookingDangerActionVariant = 'danger' | 'warning'

export type BookingDangerActionReasonField = {
  id: string
  label: string
  placeholder: string
  optional?: boolean
}

export type BookingDangerActionModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason?: string) => void
  title: string
  subtitle?: string
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  variant?: BookingDangerActionVariant
  reasonField?: BookingDangerActionReasonField
  isLoading?: boolean
  zIndex?: number
}

const variantStyles: Record<
  BookingDangerActionVariant,
  { iconBg: string; confirmBg: string; confirmHover: string; ring: string }
> = {
  danger: {
    iconBg: 'bg-red-100',
    confirmBg: 'bg-red-600',
    confirmHover: 'hover:bg-red-700',
    ring: 'focus:ring-red-500',
  },
  warning: {
    iconBg: 'bg-amber-100',
    confirmBg: 'bg-amber-600',
    confirmHover: 'hover:bg-amber-700',
    ring: 'focus:ring-amber-500',
  },
}

export const BookingDangerActionModal: React.FC<BookingDangerActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  detail,
  confirmLabel,
  cancelLabel = 'Annulla',
  variant = 'danger',
  reasonField,
  isLoading = false,
  zIndex = 60,
}) => {
  const fallbackReasonId = useId()
  const reasonId = reasonField?.id ?? fallbackReasonId
  const [reason, setReason] = useState('')
  const styles = variantStyles[variant]
  // Guard sincrono contro il doppio click: isLoading dal chiamante arriva async dopo il
  // primo click, lasciando una finestra in cui un secondo click lancia onConfirm due volte (U4).
  const confirmInFlightRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      setReason('')
      return
    }
    // Salva il valore corrente invece di forzare 'unset' in cleanup: questo modale può
    // aprirsi SOPRA un drawer (BookingDetailsModal) che ha già bloccato lo scroll a 'hidden'.
    // Ripristinare 'unset' sbloccherebbe la pagina sotto mentre il drawer è ancora aperto (U5).
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmInFlightRef.current = false
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (confirmInFlightRef.current || isLoading) return
    confirmInFlightRef.current = true
    onConfirm(reasonField ? reason : undefined)
  }

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-danger-action-title"
    >
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={() => !isLoading && onClose()}
        aria-hidden
      />
      <div
        className="relative z-[1] mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-4 border-b-2 border-[var(--color-border)] pb-4">
          <div
            className={cn(
              'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full shadow-md',
              styles.iconBg,
            )}
          >
            <span className="text-2xl" aria-hidden>
              ⚠️
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="booking-danger-action-title" className="text-xl font-bold text-primary-900">
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-[var(--color-text)]">{message}</p>
          {detail ? <p className="text-sm text-[var(--color-text-muted)]">{detail}</p> : null}
        </div>

        {reasonField ? (
          <div className="mb-6">
            <label htmlFor={reasonId} className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
              {reasonField.label}{' '}
              {reasonField.optional !== false ? (
                <span className="font-normal text-[var(--color-text-muted)]">(facoltativa)</span>
              ) : null}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonField.placeholder}
              className={cn(
                'min-h-[100px] w-full resize-y rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 transition-all focus:outline-none focus:ring-2',
                styles.ring,
              )}
              rows={4}
              disabled={isLoading}
            />
          </div>
        ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t-2 border-[var(--color-border)] p-5 pt-4 sm:flex-row sm:gap-4 sm:px-8 sm:pb-8">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              'flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-6 py-4 text-lg font-bold text-white transition-colors disabled:opacity-50',
              styles.confirmBg,
              styles.confirmHover,
            )}
          >
            {variant === 'danger' ? <Trash2 className="h-5 w-5" aria-hidden /> : null}
            {isLoading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
