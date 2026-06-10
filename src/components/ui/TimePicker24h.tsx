import React from 'react'
import { cn } from '@/lib/utils'

const pad = (n: number) => n.toString().padStart(2, '0')

export interface TimePicker24hProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  id?: string
  /** Valore "HH:mm" in 24 ore (valore inviato al form) */
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  hasError?: boolean
  hourAriaLabel?: string
  minuteAriaLabel?: string
  /** Densità ridotta + font mobile-first (es. griglia a 2 colonne nel form pubblico) */
  compact?: boolean
  /** Tipografia come card sottotab su /prenota */
  bookingForm?: boolean
  /** Dentro card con label interna: senza bordo esterno */
  bookingFormInset?: boolean
}

function splitParts(raw: string): { hour: number | null; minute: number | null } {
  const s = raw?.trim()
  if (!s) return { hour: null, minute: null }
  const parts = s.split(':').map((p) => p.trim())
  if (parts.length < 2) return { hour: null, minute: null }
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour: null, minute: null }
  return {
    hour: Math.min(23, Math.max(0, h)),
    minute: Math.min(59, Math.max(0, m)),
  }
}

export const TimePicker24h = React.forwardRef<HTMLDivElement, TimePicker24hProps>(
  (
    {
      id,
      value,
      onChange,
      required = false,
      disabled = false,
      hasError = false,
      hourAriaLabel = 'Ora (formato 24 ore)',
      minuteAriaLabel = 'Minuti',
      compact = false,
      bookingForm = false,
      bookingFormInset = false,
      className,
      style,
      ...divProps
    },
    ref
  ) => {
    // I due select sono sempre coerenti: o entrambi vuoti (nessun orario
    // scelto, mostrano il placeholder "––") o entrambi valorizzati. Niente
    // stato ibrido. Un valore parziale dal form viene trattato come vuoto.
    const { hour, minute } = splitParts(value)
    const hasValue = hour !== null && minute !== null
    const hourVal = hasValue ? pad(hour) : ''
    const minuteVal = hasValue ? pad(minute) : ''

    // Scegliere una delle due parti quando il campo è ancora vuoto fissa
    // l'altra a 00, così il form riceve subito un "HH:mm" valido.
    const emitHour = (h: number) => onChange(`${pad(h)}:${pad(minute ?? 0)}`)
    const emitMinute = (m: number) => onChange(`${pad(hour ?? 0)}:${pad(m)}`)
    const clear = () => onChange('')

    const selectBase = cn(
      'min-w-0 flex-1 cursor-pointer rounded-md border-0 bg-white py-2 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-75',
      bookingForm
        ? 'text-sm font-bold text-warm-wood sm:text-base'
        : compact
          ? 'font-medium text-slate-900 text-base sm:text-sm'
          : 'text-sm font-medium text-slate-900',
    )

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: '#ffffff',
          colorScheme: 'light',
          ...(style as React.CSSProperties | undefined),
        }}
        className={cn(
          '[color-scheme:light] isolate flex w-full items-center !bg-white text-slate-900',
          bookingFormInset ? 'min-h-0 gap-1.5 border-0 bg-transparent p-0 shadow-none' : 'shadow-sm',
          compact && !bookingFormInset
            ? cn(
                'min-h-[3rem] gap-2 rounded-2xl px-3 py-2',
                bookingForm ? 'text-sm font-bold text-warm-wood sm:text-base' : 'text-base sm:text-sm',
              )
            : !bookingFormInset && 'min-h-[3.5rem] gap-2 rounded-[1.25rem] px-4 py-3 text-sm',
          !bookingFormInset && (hasError ? 'border-2 !border-red-500' : 'border border-[rgba(0,0,0,0.2)]'),
          '[&_select]:!bg-white [&_select]:text-slate-900',
          'focus-within:outline-none',
          !bookingFormInset && !hasError && 'focus-within:border-[#8B6914]',
          hasError &&
            'focus-within:border-red-600 focus-within:!border-red-600 focus-within:ring-2 focus-within:ring-red-500/35',
          disabled && '!cursor-not-allowed',
          className
        )}
        {...divProps}
      >
        <select
          id={id}
          aria-label={hourAriaLabel}
          className={selectBase}
          value={hourVal}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            const v = e.target.value
            if (v === '') {
              clear()
              return
            }
            emitHour(parseInt(v, 10))
          }}
        >
          {/* Placeholder solo finché non c'è un orario: nei form con default
              (es. Prenota) non compare mai, evitando una voce morta. */}
          {!hasValue && <option value="">––</option>}
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
        <span
          className={cn(
            'select-none',
            bookingForm ? 'text-sm font-bold text-warm-wood/60 sm:text-base' : 'font-medium text-slate-400',
          )}
          aria-hidden="true"
        >
          :
        </span>
        <select
          id={id ? `${id}-minute` : undefined}
          aria-label={minuteAriaLabel}
          className={selectBase}
          value={minuteVal}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            const v = e.target.value
            if (v === '') {
              clear()
              return
            }
            emitMinute(parseInt(v, 10))
          }}
        >
          {!hasValue && <option value="">––</option>}
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={pad(i)}>
              {pad(i)}
            </option>
          ))}
        </select>
      </div>
    )
  }
)

TimePicker24h.displayName = 'TimePicker24h'
