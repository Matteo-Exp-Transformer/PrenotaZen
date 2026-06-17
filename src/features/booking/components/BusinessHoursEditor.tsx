import React, { useMemo, useState } from 'react'
import { ADMIN_WARM_BORDER } from '@/lib/adminWarmGradientSurface'
import { cn } from '@/lib/utils'
import {
  BUSINESS_HOURS_DAY_LABELS,
  getBusinessHoursDayErrors,
  type BusinessHours,
  type BusinessHourSlot,
} from '@/lib/businessHours'
import { Button } from '@/components/ui/Button'
import { TimePicker24h } from '@/components/ui'
import { Plus, Trash2 } from 'lucide-react'

const DAY_ORDER: (keyof BusinessHours)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const defaultSlot = (): BusinessHourSlot => ({ open: '11:00', close: '00:00' })

/**
 * Default «pranzo + cena» quando un giorno passa da chiuso/vuoto ad aperto per la prima volta
 * (intento Matteo 16-06-26, FIX 2): due fasce pronte all'uso invece di un solo slot generico.
 * Non si applica quando il giorno ha già fasce salvate — quel ramo resta intatto (vedi `addSlot`/`toggleClosed`).
 */
const defaultOpeningSlots = (): BusinessHourSlot[] => [
  { open: '06:30', close: '16:30' },
  { open: '17:30', close: '23:30' },
]

function isDayClosed(slots: BusinessHourSlot[] | null): boolean {
  return slots == null || slots.length === 0
}

export interface BusinessHoursEditorProps {
  value: BusinessHours
  onChange: (next: BusinessHours) => void
  disabled?: boolean
}

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const dayErrors = useMemo(() => getBusinessHoursDayErrors(value), [value])

  /** Slot mostrati (non editabili) quando il giorno è chiuso: non persistono nel valore salvato (`null`). */
  const [closedDaySnapshots, setClosedDaySnapshots] = useState<
    Partial<Record<keyof BusinessHours, BusinessHourSlot[]>>
  >({})

  const setDay = (day: keyof BusinessHours, slots: BusinessHourSlot[] | null) => {
    onChange({ ...value, [day]: slots })
  }

  const toggleClosed = (day: keyof BusinessHours, closed: boolean) => {
    if (closed) {
      const current = value[day]
      const snapshot =
        current && current.length > 0 ? current.map((s) => ({ ...s })) : [defaultSlot()]
      setClosedDaySnapshots((prev) => ({ ...prev, [day]: snapshot }))
      setDay(day, null)
    } else {
      const snap = closedDaySnapshots[day]
      setDay(day, snap && snap.length > 0 ? snap.map((s) => ({ ...s })) : defaultOpeningSlots())
      setClosedDaySnapshots((prev) => {
        const next = { ...prev }
        delete next[day]
        return next
      })
    }
  }

  const updateSlot = (
    day: keyof BusinessHours,
    index: number,
    patch: Partial<BusinessHourSlot>
  ) => {
    const slots = value[day]
    if (!slots || !slots[index]) return
    const next = slots.map((s, i) => (i === index ? { ...s, ...patch } : s))
    setDay(day, next)
  }

  const addSlot = (day: keyof BusinessHours) => {
    const existing = value[day]
    // Giorno senza fasce reali: popola pranzo+cena in un colpo (FIX 2), non un solo slot generico.
    if (!existing || existing.length === 0) {
      setDay(day, defaultOpeningSlots())
      return
    }
    // Giorno già con aperture esistenti: non sovrascrivere, aggiungi solo una fascia in più.
    setDay(day, [...existing, defaultSlot()])
  }

  const removeSlot = (day: keyof BusinessHours, index: number) => {
    const slots = value[day]
    if (!slots) return
    const next = slots.filter((_, i) => i !== index)
    setDay(day, next.length ? next : null)
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {DAY_ORDER.map((day) => {
        const slots = value[day]
        const closed = isDayClosed(slots)
        const rowSlots: BusinessHourSlot[] = closed
          ? closedDaySnapshots[day] ?? [defaultSlot()]
          : slots ?? [defaultSlot()]
        const dayError = closed ? null : dayErrors[day]

        return (
          <div
            key={day}
            className={cn(
              'w-full space-y-3 rounded-xl border bg-white/75 p-4 text-center shadow-md backdrop-blur-[2px]',
              dayError && 'border-red-300'
            )}
            style={dayError ? undefined : { borderColor: ADMIN_WARM_BORDER }}
          >
            <div className="flex w-full min-w-0 flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <strong className="min-w-0 flex-1 text-left text-lg font-extrabold text-slate-900 tracking-tight md:text-xl">
                {BUSINESS_HOURS_DAY_LABELS[day]}
              </strong>
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={closed}
                  disabled={disabled}
                  onChange={(e) => toggleClosed(day, e.target.checked)}
                  className="rounded-md border"
                  style={{ borderColor: ADMIN_WARM_BORDER }}
                />
                Chiuso
              </label>
            </div>

            {dayError ? (
              <div
                role="alert"
                className="mx-auto w-full max-w-md rounded-[1.25rem] border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 shadow-sm"
              >
                {dayError}
              </div>
            ) : null}

            <div
              className={cn(
                'flex flex-col items-center gap-3 transition-opacity duration-150',
                closed && 'pointer-events-none select-none opacity-[0.34] saturate-0'
              )}
            >
              {rowSlots.map((slot, index) => (
                <div
                  key={`${day}-${index}`}
                  className="flex flex-wrap items-end justify-center gap-3"
                >
                  <div className="space-y-1 text-center">
                    <span className="block text-xs font-medium text-slate-500">Apertura</span>
                    <TimePicker24h
                      value={slot.open}
                      onChange={(v) => updateSlot(day, index, { open: v })}
                      disabled={disabled || closed}
                      id={`${day}-open-${index}`}
                    />
                  </div>
                  <div className="space-y-1 text-center">
                    <span className="block text-xs font-medium text-slate-500">Chiusura</span>
                    <TimePicker24h
                      value={slot.close}
                      onChange={(v) => updateSlot(day, index, { close: v })}
                      disabled={disabled || closed}
                      id={`${day}-close-${index}`}
                    />
                  </div>
                  {rowSlots.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || closed}
                      onClick={() => removeSlot(day, index)}
                      className="text-red-600 hover:text-red-700"
                      aria-label="Rimuovi apertura"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex w-full min-w-0 justify-center self-stretch">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={disabled || closed}
                  onClick={() => addSlot(day)}
                  className={cn(
                    'gap-2 rounded-lg border-2 border-primary-700 bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-none transition-colors hover:bg-primary-500 hover:border-primary-600 hover:shadow-none focus:ring-primary-300'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi apertura
                </Button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
