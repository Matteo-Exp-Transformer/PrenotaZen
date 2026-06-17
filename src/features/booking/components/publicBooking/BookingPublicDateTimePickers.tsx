import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimePicker24h } from '@/components/ui'
import {
  BOOKING_PUBLIC_CONTENT_WIDTH,
  BOOKING_PUBLIC_FIELD_BOX,
  BOOKING_PUBLIC_FIELD_INNER_INPUT,
  BOOKING_PUBLIC_FIELD_INNER_LABEL,
} from '@/features/booking/constants/bookingPublicFieldStyles'
import {
  BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
  BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
  shouldDismissBookingPublicAttention,
} from '@/features/booking/utils/bookingPublicFormAttention'
import { dateToIso } from '../../utils/bookingPublicDateHelpers'

const MONTHS = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
]

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/** Trigger compatto (icona + valore): non eredita w-full/flex-1 da BOOKING_PUBLIC_FIELD_INNER_INPUT. */
const BOOKING_PUBLIC_PICKER_TRIGGER_CLASS = cn(
  BOOKING_PUBLIC_FIELD_INNER_INPUT,
  'inline-flex w-auto shrink-0 flex-none items-center justify-start gap-2 text-left',
)

function parseIsoDate(value?: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function formatDisplayDate(value?: string): string {
  const date = parseIsoDate(value)
  if (!date) return 'Seleziona data'
  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDisplayTime(value?: string): string {
  return value?.trim() ? value : 'Seleziona ora'
}

function useDismissablePanel(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && ref.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-booking-picker-trigger="true"]')) return
      onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, onClose])

  return ref
}

function PickerPanel({
  open,
  title,
  onClose,
  children,
  alignRight = false,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  alignRight?: boolean
}) {
  const panelRef = useDismissablePanel(open, onClose)
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={title}
        className={cn(
          'fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-black/10 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:w-[min(24rem,calc(100vw-2rem))]',
          alignRight ? 'sm:right-0' : 'sm:left-0',
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-base font-bold text-warm-wood">{title}</p>
          <button
            type="button"
            aria-label="Chiudi"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-warm-wood hover:bg-warm-beige/50"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

export function BookingPublicDatePickerField({
  id,
  label,
  value,
  onChange,
  required,
  hasError = false,
  showAttention = false,
  onAttentionInteract,
}: {
  id: string
  label: string
  value?: string
  onChange: (value: string) => void
  required?: boolean
  hasError?: boolean
  showAttention?: boolean
  onAttentionInteract?: () => void
}) {
  const [open, setOpen] = useState(false)
  const today = useMemo(() => startOfToday(), [])
  const maxDate = useMemo(() => new Date(today.getFullYear() + 1, 11, 31), [today])
  const selectedDate = parseIsoDate(value)
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? today)

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate)
  }, [value])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstWeekdayOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const selectedIso = selectedDate ? dateToIso(selectedDate) : ''

  const canGoPrev = new Date(year, month, 1) > new Date(today.getFullYear(), today.getMonth(), 1)
  const canGoNext = new Date(year, month + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)

  const moveMonth = (delta: number) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const dismissAttentionIfUser = (event: React.PointerEvent | React.FocusEvent) => {
    if (showAttention && shouldDismissBookingPublicAttention(event)) {
      onAttentionInteract?.()
    }
  }

  return (
    <div
      id={id}
      data-booking-public-field-anchor
      className={cn(
        BOOKING_PUBLIC_CONTENT_WIDTH,
        BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
        'relative',
        showAttention && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
        showAttention && 'rounded-lg',
      )}
    >
      <div className={cn(BOOKING_PUBLIC_FIELD_BOX, hasError && 'border-red-500!')}>
        <label htmlFor={`${id}-control`} className={BOOKING_PUBLIC_FIELD_INNER_LABEL}>
          {label}
        </label>
        <div className="flex min-w-0 flex-1">
          <button
            id={`${id}-control`}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-required={required}
            data-booking-picker-trigger="true"
            className={BOOKING_PUBLIC_PICKER_TRIGGER_CLASS}
            onPointerDown={(event) => {
              dismissAttentionIfUser(event)
              setOpen((v) => !v)
            }}
            onFocus={dismissAttentionIfUser}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-warm-orange" aria-hidden />
            <span className="min-w-0 truncate">{formatDisplayDate(value)}</span>
          </button>
          <div className="min-w-0 flex-1 pointer-events-none" aria-hidden />
        </div>
      </div>

      <PickerPanel open={open} title="Scegli la data" onClose={() => setOpen(false)}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Mese precedente"
            disabled={!canGoPrev}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-warm-wood disabled:opacity-30 enabled:hover:bg-warm-beige/50"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <p className="text-center text-base font-bold capitalize text-warm-wood">
            {MONTHS[month]} {year}
          </p>
          <button
            type="button"
            aria-label="Mese successivo"
            disabled={!canGoNext}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-warm-wood disabled:opacity-30 enabled:hover:bg-warm-beige/50"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-1 text-xs font-bold text-warm-wood-dark/60">
              {day}
            </span>
          ))}
          {Array.from({ length: firstWeekdayOffset }).map((_, index) => (
            <span key={`blank-${index}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1
            const date = new Date(year, month, day)
            const iso = dateToIso(date)
            const disabled = date < today || date > maxDate
            const isSelected = iso === selectedIso
            return (
              <button
                key={iso}
                type="button"
                disabled={disabled}
                className={cn(
                  'min-h-10 rounded-lg text-sm font-bold transition-colors',
                  disabled && 'cursor-not-allowed text-warm-wood-dark/25',
                  !disabled && !isSelected && 'text-warm-wood hover:bg-warm-beige/60',
                  isSelected && 'bg-warm-orange text-white shadow-md',
                )}
                onClick={() => {
                  onChange(iso)
                  setOpen(false)
                }}
              >
                {day}
              </button>
            )
          })}
        </div>
      </PickerPanel>
    </div>
  )
}

export function BookingPublicTimePickerField({
  id,
  label,
  value,
  onChange,
  required,
  hasError = false,
  showAttention = false,
  onAttentionInteract,
  minTime: _minTime,
}: {
  id: string
  label: string
  value?: string
  onChange: (value: string) => void
  required?: boolean
  hasError?: boolean
  showAttention?: boolean
  onAttentionInteract?: () => void
  /** Ora minima selezionabile "HH:MM" — usata per bloccare ore passate quando la data è oggi */
  minTime?: string
}) {
  const [open, setOpen] = useState(false)

  const dismissAttentionIfUser = (event: React.PointerEvent | React.FocusEvent) => {
    if (showAttention && shouldDismissBookingPublicAttention(event)) {
      onAttentionInteract?.()
    }
  }

  return (
    <div
      id={id}
      data-booking-public-field-anchor
      className={cn(
        BOOKING_PUBLIC_CONTENT_WIDTH,
        BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
        'relative',
        showAttention && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
        showAttention && 'rounded-lg',
      )}
    >
      <div className={cn(BOOKING_PUBLIC_FIELD_BOX, hasError && 'border-red-500!')}>
        <label htmlFor={`${id}-control`} className={BOOKING_PUBLIC_FIELD_INNER_LABEL}>
          {label}
        </label>
        <div className="grid min-w-0 flex-1 grid-cols-2">
          <button
            id={`${id}-control`}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-required={required}
            data-booking-picker-trigger="true"
            className={cn(BOOKING_PUBLIC_PICKER_TRIGGER_CLASS, 'min-h-9 w-full sm:min-h-10')}
            onPointerDown={(event) => {
              dismissAttentionIfUser(event)
              setOpen((v) => !v)
            }}
            onFocus={dismissAttentionIfUser}
          >
            <Clock className="h-4 w-4 shrink-0 text-warm-orange" aria-hidden />
            <span className="min-w-0 truncate">{formatDisplayTime(value)}</span>
          </button>
          <div className="pointer-events-none" aria-hidden />
        </div>
      </div>

      <PickerPanel open={open} title="Scegli l'orario" onClose={() => setOpen(false)} alignRight>
        <TimePicker24h
          id={`${id}-picker`}
          value={value || ''}
          onChange={onChange}
          required={required}
          bookingForm
          className="min-h-[3.75rem] rounded-xl border border-slate-200 px-3 py-2"
        />
        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-warm-orange px-4 py-3 text-sm font-bold text-white shadow-sm"
          onClick={() => setOpen(false)}
        >
          Conferma orario
        </button>
      </PickerPanel>
    </div>
  )
}
