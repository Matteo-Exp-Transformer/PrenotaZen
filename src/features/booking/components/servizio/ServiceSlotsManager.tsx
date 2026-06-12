import type { FC, FormEvent, ReactNode } from 'react'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Plus, Pencil, Trash2, AlertCircle, Clock, Users, CalendarClock, ChevronDown, X, RotateCcw } from 'lucide-react'
import { Modal, Button, Input, TimePicker24h } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'
import { toast } from 'react-toastify'
import {
  useServiceSlots,
  useCreateServiceSlot,
  useUpdateServiceSlot,
  useDeleteServiceSlot,
  isServiceSlotClosed,
  type ServiceSlot,
} from '@/features/booking/hooks/useServiceSlots'
import { OVERNIGHT_TIME_END_HINT } from '@/features/booking/utils/bookingTimeSlots'
import {
  useServiceSlotOverrides,
  useCreateServiceSlotOverride,
  useDeleteServiceSlotOverride,
  resolveScopeDateRange,
  resolveSlotOverride,
  todayLocalISODate,
  hasActiveOverride,
  getActiveOverrides,
  classifyOverrideScope,
  findActiveOverrideOfScope,
  type OverrideScope,
  type ServiceSlotOverride,
} from '@/features/booking/hooks/useServiceSlotOverrides'
import { useBusinessHours } from '@/hooks/useBusinessHours'
import { DiscardChangesConfirmModal } from '@/features/booking/components/settings/SettingsSaveUi'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const SLOT_MODAL_UNSAVED_SOURCE_ID = 'servizio-slot-modal'

function serializeSlotDraft(input: {
  name: string
  startTime: string
  endTime: string
  maxTurnsStr: string
  maxGuestsStr: string
  scope: OverrideScope
  customDays: Set<string>
}): string {
  return JSON.stringify({
    name: input.name.trim(),
    startTime: input.startTime,
    endTime: input.endTime,
    maxTurnsStr: input.maxTurnsStr,
    maxGuestsStr: input.maxGuestsStr,
    scope: input.scope,
    customDays: [...input.customDays].sort(),
  })
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function maxTurnsLabel(maxTurns: number | null): string {
  if (maxTurns === null) return 'Illimitata'
  return `${maxTurns} ${maxTurns === 1 ? 'turno' : 'turni'}`
}

function maxTurnsBadgeClass(maxTurns: number | null): string {
  if (maxTurns === null) return 'bg-emerald-100 text-emerald-800'
  return 'bg-blue-100 text-blue-800'
}

function slotClosedRowClass(closed: boolean): string {
  return closed ? 'opacity-55 saturate-[0.85]' : ''
}

const SCOPE_OPTIONS: { value: OverrideScope; label: string }[] = [
  { value: 'forever', label: 'Sempre' },
  { value: 'today', label: 'Solo oggi' },
  { value: 'week', label: 'Questa settimana' },
  { value: 'month', label: 'Fino a fine mese' },
  { value: 'custom', label: 'Scegli i giorni' },
]

function scopeLabel(scope: OverrideScope): string {
  return SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? 'Sempre'
}

/** YYYY-MM-DD → GG/MM/AAAA per i messaggi all'utente. */
function formatItalianDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/** YYYY-MM-DD → «Ven 22/05/2026» (giorno settimana + data, locale). */
function formatItalianDateWithWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay()
  const weekday = WEEKDAY_LABELS[jsDay === 0 ? 6 : jsDay - 1]
  return `${weekday} ${formatItalianDate(iso)}`
}
const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

/** YYYY-MM-DD locale di una Date, senza shift UTC. */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Mini calendario a selezione multipla di giorni singoli (anche non
 * consecutivi). Le date passate (prima di oggi) non sono selezionabili:
 * un override nel passato non avrebbe effetto.
 */
const MultiDayPicker: FC<{
  selected: Set<string>
  onToggle: (iso: string) => void
  disabled?: boolean
}> = ({ selected, onToggle, disabled }) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const todayIso = toLocalISODate(new Date())
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // getDay(): 0=domenica → portiamo a 0=lunedì per la griglia.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toLocalISODate(new Date(year, month, d)))
  }

  return (
    <div className="rounded-xl border border-(--color-border) bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mese precedente"
          disabled={disabled}
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
        >
          ‹
        </Button>
        <span className="text-sm font-semibold text-primary-900">
          {MONTH_LABELS[month]} {year}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mese successivo"
          disabled={disabled}
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
        >
          ›
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} className="py-1 text-xs font-medium text-(--color-text-muted)">
            {w}
          </span>
        ))}
        {cells.map((iso, idx) => {
          if (iso === null) return <span key={`e${idx}`} />
          const isPast = iso < todayIso
          const isSelected = selected.has(iso)
          const dayNum = Number(iso.slice(8, 10))
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled || isPast}
              onClick={() => onToggle(iso)}
              className={`rounded-lg py-1.5 text-sm transition-colors ${
                isPast
                  ? 'cursor-not-allowed text-(--color-text-muted) opacity-40'
                  : isSelected
                    ? 'bg-primary-600 font-semibold text-white'
                    : 'text-primary-900 hover:bg-primary-50'
              }`}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Verifica se uno slot (start_time, end_time) ricade negli orari di apertura per almeno un giorno */
function isSlotOutsideBusinessHours(
  startTime: string,
  businessHours: ReturnType<typeof useBusinessHours>['data'],
): boolean {
  if (!businessHours) return false

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

  const startInAnyOpenDay = days.some((day) => {
    const slots = businessHours[day]
    if (!slots || slots.length === 0) return false
    return slots.some((slot) => {
      const [sh, sm] = startTime.split(':').map(Number)
      const [oh, om] = slot.open.split(':').map(Number)
      const [ch, cm] = slot.close.split(':').map(Number)
      const startMin = sh * 60 + sm
      const openMin = oh * 60 + om
      let closeMin = ch * 60 + cm
      if (closeMin === 0) closeMin = 1440
      if (closeMin < openMin) closeMin += 1440
      return startMin >= openMin && startMin < closeMin
    })
  })

  return !startInAnyOpenDay
}

/** Pulsante icona + «?» per aprire il pannello di aiuto (chiusura con ✕ nel pannello). */
const FormInfoToggle: FC<{
  open: boolean
  onToggle: () => void
  icon: LucideIcon
  ariaLabel: string
}> = ({ open, onToggle, icon: Icon, ariaLabel }) => (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault()
      onToggle()
    }}
    aria-expanded={open}
    aria-label={`Mostra spiegazione: ${ariaLabel}`}
    title="Mostra spiegazione"
    className={cn(
      'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
      'bg-primary-100 text-primary-900 hover:bg-primary-200',
    )}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
    <span className="text-xs font-bold leading-none" aria-hidden>
      ?
    </span>
  </button>
)

/** Casella aiuto blu con ✕ per chiudere. */
const FormInfoPanel: FC<{ onClose: () => void; children: ReactNode }> = ({ onClose, children }) => (
  <div className="relative rounded-lg border border-blue-200 bg-blue-50 py-2.5 pl-3 pr-8 text-sm text-blue-800">
    {children}
    <button
      type="button"
      onClick={onClose}
      aria-label="Chiudi spiegazione"
      title="Chiudi spiegazione"
      className={cn(
        'absolute right-1 top-1.5 inline-flex rounded p-0.5 text-blue-800/75 transition-colors',
        'hover:bg-blue-100 hover:text-blue-900',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60',
      )}
    >
      <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </button>
  </div>
)

// ─────────────────────────────────────────────
// Modal CRUD
// ─────────────────────────────────────────────

interface SlotModalProps {
  isOpen: boolean
  onClose: () => void
  initial: ServiceSlot | null
}

const SlotModal: FC<SlotModalProps> = ({ isOpen, onClose, initial }) => {
  const isEdit = Boolean(initial)
  const { data: businessHours } = useBusinessHours()

  const [name, setName] = useState(initial?.name ?? '')
  const [startTime, setStartTime] = useState(initial?.start_time ?? '12:00')
  const [endTime, setEndTime] = useState(initial?.end_time ?? '15:00')
  const [maxTurnsStr, setMaxTurnsStr] = useState(
    initial?.max_turns === null ? '' : String(initial?.max_turns ?? ''),
  )
  const [maxGuestsStr, setMaxGuestsStr] = useState(
    initial?.max_guests == null ? '' : String(initial.max_guests),
  )
  const [validationError, setValidationError] = useState<string | null>(null)
  const [scope, setScope] = useState<OverrideScope>('forever')
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false)
  const [saveTypeInfoOpen, setSaveTypeInfoOpen] = useState(false)
  const [maxGuestsInfoOpen, setMaxGuestsInfoOpen] = useState(false)
  const [customDays, setCustomDays] = useState<Set<string>>(new Set())
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const baselineRef = useRef('')
  const formRef = useRef<HTMLFormElement>(null)
  const scopeMenuRef = useRef<HTMLDivElement>(null)

  const {
    registerUnsavedSource,
    registerUnsavedHandlers,
    clearUnsavedSource,
  } = useUnsavedChangesGuard()

  useEffect(() => {
    if (isOpen) {
      const nextName = initial?.name ?? ''
      const nextStart = initial?.start_time?.slice(0, 5) ?? '12:00'
      const nextEnd = initial?.end_time?.slice(0, 5) ?? '15:00'
      let nextMaxTurns = ''
      if (initial?.max_turns === 0) {
        nextMaxTurns = initial.max_turns_resume == null ? '' : String(initial.max_turns_resume)
      } else if (initial?.max_turns !== null && initial?.max_turns !== undefined) {
        nextMaxTurns = String(initial.max_turns)
      }
      const nextMaxGuests = initial?.max_guests == null ? '' : String(initial.max_guests)
      setName(nextName)
      setStartTime(nextStart)
      setEndTime(nextEnd)
      setMaxTurnsStr(nextMaxTurns)
      setMaxGuestsStr(nextMaxGuests)
      setValidationError(null)
      setScope('forever')
      setScopeMenuOpen(false)
      setSaveTypeInfoOpen(false)
      setMaxGuestsInfoOpen(false)
      setCustomDays(new Set())
      setDiscardConfirmOpen(false)
      baselineRef.current = serializeSlotDraft({
        name: nextName,
        startTime: nextStart,
        endTime: nextEnd,
        maxTurnsStr: nextMaxTurns,
        maxGuestsStr: nextMaxGuests,
        scope: 'forever',
        customDays: new Set(),
      })
    }
  }, [isOpen, initial])

  // Chiude il menu "Quando?" cliccando fuori.
  useEffect(() => {
    if (!scopeMenuOpen) return
    function onDocClick(e: MouseEvent) {
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(e.target as Node)) {
        setScopeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [scopeMenuOpen])

  const create = useCreateServiceSlot()
  const update = useUpdateServiceSlot()
  const createOverride = useCreateServiceSlotOverride()
  const { data: overrides = [] } = useServiceSlotOverrides()
  const isPending = create.isPending || update.isPending || createOverride.isPending

  const isDirty = useMemo(
    () =>
      serializeSlotDraft({
        name,
        startTime,
        endTime,
        maxTurnsStr,
        maxGuestsStr,
        scope,
        customDays,
      }) !== baselineRef.current,
    [customDays, endTime, maxGuestsStr, maxTurnsStr, name, scope, startTime],
  )

  const confirmDiscardClose = useCallback(() => {
    setDiscardConfirmOpen(false)
    clearUnsavedSource(SLOT_MODAL_UNSAVED_SOURCE_ID)
    onClose()
  }, [clearUnsavedSource, onClose])

  const requestClose = useCallback(() => {
    if (isPending) return
    if (isDirty) {
      setDiscardConfirmOpen(true)
      return
    }
    onClose()
  }, [isDirty, isPending, onClose])

  useEffect(() => {
    if (!isOpen || !isDirty) {
      clearUnsavedSource(SLOT_MODAL_UNSAVED_SOURCE_ID)
      return
    }
    registerUnsavedSource(
      SLOT_MODAL_UNSAVED_SOURCE_ID,
      isEdit ? 'Modifica fascia oraria' : 'Nuova fascia oraria',
      true,
    )
    return () => clearUnsavedSource(SLOT_MODAL_UNSAVED_SOURCE_ID)
  }, [clearUnsavedSource, isDirty, isEdit, isOpen, registerUnsavedSource])

  useEffect(() => {
    if (!isOpen || !isDirty) {
      registerUnsavedHandlers(SLOT_MODAL_UNSAVED_SOURCE_ID, null)
      return
    }
    registerUnsavedHandlers(SLOT_MODAL_UNSAVED_SOURCE_ID, {
      saveAll: () => {
        formRef.current?.requestSubmit()
      },
      discardAll: confirmDiscardClose,
    })
    return () => registerUnsavedHandlers(SLOT_MODAL_UNSAVED_SOURCE_ID, null)
  }, [confirmDiscardClose, isDirty, isOpen, registerUnsavedHandlers])

  // Override già attivo su questa fascia (solo in modifica): serve per l'alert ①.
  const existingActiveOverride =
    isEdit && initial ? hasActiveOverride(overrides, initial.id) : null

  // Intervallo che avrà l'override in base allo scope scelto (null = "Per sempre").
  const scopeRange = resolveScopeDateRange(scope)

  const showOutsideAlert =
    name !== '' &&
    startTime !== '' &&
    isSlotOutsideBusinessHours(startTime, businessHours)

  const crossesMidnight = startTime && endTime && endTime < startTime

  function validate(): string | null {
    if (!name.trim()) return 'Il nome della fascia è obbligatorio.'
    if (!startTime) return "L'orario di inizio è obbligatorio."
    if (!endTime) return "L'orario di fine è obbligatorio."
    if (maxTurnsStr !== '' && (isNaN(Number(maxTurnsStr)) || Number(maxTurnsStr) < 1))
      return 'I turni massimi devono essere un numero ≥ 1 (vuoto = illimitato).'
    if (maxGuestsStr !== '' && (isNaN(Number(maxGuestsStr)) || Number(maxGuestsStr) < 1))
      return 'I coperti massimi devono essere un numero ≥ 1 (vuoto = nessun limite).'
    // Un override agisce solo su limiti turni/coperti di una fascia esistente.
    if (scope !== 'forever' && !isEdit)
      return 'La modifica a tempo si applica a una fascia esistente: crea prima la fascia, poi impostala con "Quando?".'
    if (scope === 'custom' && customDays.size === 0)
      return 'Seleziona almeno un giorno nel calendario per la modifica a tempo.'
    // Un solo override per tipo a intervallo (Solo oggi / Questa settimana /
    // Fino a fine mese): se ne esiste già uno attivo dello stesso tipo, blocca.
    if (isEdit && initial && scope !== 'forever' && scope !== 'custom') {
      const dup = findActiveOverrideOfScope(overrides, initial.id, scope)
      if (dup)
        return `Esiste già una modifica a tempo «${scopeLabel(scope)}» attiva su questa fascia ` +
          `(fino al ${formatItalianDate(dup.date_to)}). Eliminala prima dalla card della fascia, ` +
          `oppure scegli un periodo diverso.`
    }
    // "Scegli i giorni": blocca i singoli giorni già coperti da un override
    // attivo di 1 giorno (stesso tipo) — gli intervalli restano permessi.
    if (isEdit && initial && scope === 'custom' && customDays.size > 0) {
      const active = getActiveOverrides(overrides, initial.id)
      const clash = [...customDays].filter((d) =>
        active.some((o) => o.date_from === d && o.date_to === d),
      )
      if (clash.length > 0)
        return `Hai già una modifica a tempo per ${clash.length === 1 ? 'il giorno' : 'i giorni'} ` +
          `${clash.sort().map(formatItalianDate).join(', ')}. Eliminala prima dalla card della fascia, ` +
          `oppure deseleziona ${clash.length === 1 ? 'quel giorno' : 'quei giorni'}.`
    }
    return null
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setValidationError(err); return }
    setValidationError(null)

    const maxTurns = maxTurnsStr === '' ? null : Number(maxTurnsStr)
    // Salvataggio form = impostazioni base aperte (non chiusura servizio).
    const maxTurnsResume =
      isEdit && initial?.max_turns === 0 ? null : initial?.max_turns_resume ?? null
    const maxGuests = maxGuestsStr === '' ? null : Number(maxGuestsStr)

    // ── Modifica a tempo: giorni scelti a mano ───────────────────
    // Ogni giorno selezionato = un override di 1 giorno (date_from = date_to).
    if (scope === 'custom' && isEdit && initial && customDays.size > 0) {
      const days = [...customDays].sort()
      Promise.all(
        days.map((d) =>
          createOverride.mutateAsync({
            service_slot_id: initial.id,
            date_from: d,
            date_to: d,
            max_turns: maxTurns,
            max_guests: maxGuests,
          }),
        ),
      )
        .then(() => {
          toast.success(
            `Modifica a "${initial.name}" attiva su ${days.length} ` +
              `giorn${days.length === 1 ? 'o' : 'i'} selezionati. ` +
              `Negli altri giorni la fascia resta ai valori base.`,
          )
          onClose()
        })
        .catch(() => {
          // Il toast d'errore è già gestito da useCreateServiceSlotOverride.onError.
        })
      return
    }

    // ── Modifica a tempo: intervallo (oggi / settimana / mese) ────
    if (scope !== 'forever' && scopeRange && isEdit && initial) {
      createOverride.mutate(
        {
          service_slot_id: initial.id,
          date_from: scopeRange.date_from,
          date_to: scopeRange.date_to,
          max_turns: maxTurns,
          max_guests: maxGuests,
        },
        {
          onSuccess: () => {
            toast.success(
              `Modifica a "${initial.name}" attiva dal ${formatItalianDate(scopeRange.date_from)} ` +
                `al ${formatItalianDate(scopeRange.date_to)}. Poi la fascia torna ai valori base.`,
            )
            onClose()
          },
        },
      )
      return
    }

    // ── Modifica permanente (valore base) ────────────────────────
    const payload = {
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      max_turns: maxTurns,
      max_turns_resume: maxTurnsResume,
      max_guests: maxGuests,
      display_order: initial?.display_order ?? 0,
    }

    const guestsChanged = payload.max_guests !== (initial?.max_guests ?? null)

    const handleSuccess = () => {
      if (!isEdit) {
        toast.success(`Fascia «${payload.name}» aggiunta.`)
      } else if (guestsChanged && payload.max_guests != null) {
        toast.success(`Coperti massimi di «${payload.name}» impostati a ${payload.max_guests}.`)
      } else if (guestsChanged && payload.max_guests == null) {
        toast.success(`Coperti massimi di «${payload.name}» rimossi.`)
      } else {
        toast.success(`Impostazioni base di «${payload.name}» aggiornate.`)
      }
      onClose()
    }

    if (isEdit && initial) {
      update.mutate({ id: initial.id, ...payload }, { onSuccess: handleSuccess })
    } else {
      create.mutate(payload, { onSuccess: handleSuccess })
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={isEdit ? 'Modifica fascia oraria' : 'Nuova fascia oraria'}
        size="sm"
        closeOnOverlayClick={!isPending}
        closeOnEscape={!isPending}
      >
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="slot-name" className="block text-sm font-medium text-primary-900">
            Nome fascia
          </label>
          <Input
            id="slot-name"
            type="text"
            placeholder="Es. Pranzo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="slot-start" className="block text-sm font-medium text-primary-900">
              Inizio
            </label>
            <TimePicker24h
              id="slot-start"
              value={startTime}
              onChange={(v) => setStartTime(v)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="slot-end" className="block text-sm font-medium text-primary-900">
              Fine
            </label>
            <TimePicker24h
              id="slot-end"
              value={endTime}
              onChange={(v) => setEndTime(v)}
              disabled={isPending}
            />
          </div>
        </div>

        {crossesMidnight && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {OVERNIGHT_TIME_END_HINT}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="slot-maxturns" className="block text-sm font-medium text-primary-900">
            Turni massimi per tavolo
          </label>
          <Input
            id="slot-maxturns"
            type="number"
            min={1}
            step={1}
            placeholder="Illimitato"
            value={maxTurnsStr}
            onChange={(e) => setMaxTurnsStr(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-(--color-text-muted)">
            Lascia vuoto = illimitato
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="slot-maxguests"
            className="inline-flex max-w-full flex-wrap items-center gap-x-1 text-sm font-medium text-primary-900"
          >
            Coperti massimi per{' '}
            <span className="inline-flex flex-wrap items-center gap-1.5">
              fascia
              <FormInfoToggle
                open={maxGuestsInfoOpen}
                onToggle={() => setMaxGuestsInfoOpen((o) => !o)}
                icon={Users}
                ariaLabel="cosa succede impostando i coperti massimi per fascia"
              />
            </span>
          </label>
          <Input
            id="slot-maxguests"
            type="number"
            min={1}
            step={1}
            placeholder="Nessun limite"
            value={maxGuestsStr}
            onChange={(e) => setMaxGuestsStr(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-(--color-text-muted)">
            Lascia vuoto = nessun limite
          </p>
          {maxGuestsInfoOpen && (
            <FormInfoPanel onClose={() => setMaxGuestsInfoOpen(false)}>
              I coperti massimi sono un riferimento per te: quando vengono superati la fascia
              segnala che è piena (semaforo/avviso), ma non blocca né rifiuta nulla. Decidi tu
              caso per caso se accettare le prenotazioni in attesa.
            </FormInfoPanel>
          )}
        </div>

        {isEdit && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="inline-flex max-w-full flex-wrap items-center gap-x-1 text-sm font-medium text-primary-900">
                {scope === 'forever' ? (
                  <>
                    Tipo di{' '}
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      salvataggio
                      <FormInfoToggle
                        open={saveTypeInfoOpen}
                        onToggle={() => setSaveTypeInfoOpen((o) => !o)}
                        icon={Clock}
                        ariaLabel="come impostare una scadenza alle modifiche con un altro tipo di salvataggio"
                      />
                    </span>
                  </>
                ) : (
                  'Durata della modifica'
                )}
              </span>
              <div className="relative" ref={scopeMenuRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className="border border-primary-600 shadow-none"
                  onClick={() => setScopeMenuOpen((o) => !o)}
                >
                  <CalendarClock className="h-4 w-4" aria-hidden />
                  {scopeLabel(scope)}
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
                {scopeMenuOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-xl border border-(--color-border) bg-white shadow-lg">
                    {SCOPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-primary-50 ${
                          opt.value === scope
                            ? 'bg-primary-50 font-semibold text-primary-900'
                            : 'text-primary-800'
                        }`}
                        onClick={() => {
                          setScope(opt.value)
                          setScopeMenuOpen(false)
                          if (opt.value !== 'forever') setSaveTypeInfoOpen(false)
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {scope === 'forever' && saveTypeInfoOpen && (
              <FormInfoPanel onClose={() => setSaveTypeInfoOpen(false)}>
                Imposta una scadenza delle modifiche, selezionando un tipo di salvataggio.
              </FormInfoPanel>
            )}

            {/* Calendario per la scelta manuale dei giorni */}
            {scope === 'custom' && (
              <MultiDayPicker
                selected={customDays}
                disabled={isPending}
                onToggle={(iso) =>
                  setCustomDays((prev) => {
                    const next = new Set(prev)
                    if (next.has(iso)) next.delete(iso)
                    else next.add(iso)
                    return next
                  })
                }
              />
            )}

            {/* Alert ② — come si comporterà l'override scelto (intervallo) */}
            {scope !== 'forever' && scope !== 'custom' && scopeRange && (
              <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Questa modifica varrà <strong>solo</strong> per la fascia{' '}
                  «{initial?.name}» dal <strong>{formatItalianDate(scopeRange.date_from)}</strong>{' '}
                  al <strong>{formatItalianDate(scopeRange.date_to)}</strong>
                  {scope === 'week' && (
                    <>
                      {' '}(fino a <strong>domenica {formatItalianDate(scopeRange.date_to)}</strong>,
                      fine di questa settimana — non 7 giorni esatti)
                    </>
                  )}
                  . Dal giorno successivo la fascia tornerà automaticamente ai valori base.
                </span>
              </div>
            )}

            {/* Alert ② — variante giorni scelti a mano */}
            {scope === 'custom' && customDays.size > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Questa modifica varrà <strong>solo</strong> per la fascia{' '}
                  «{initial?.name}» nei{' '}
                  <strong>{customDays.size} giorn{customDays.size === 1 ? 'o' : 'i'}</strong>{' '}
                  selezionati: {[...customDays].sort().map(formatItalianDate).join(', ')}.{' '}
                  Negli altri giorni la fascia resta ai valori base.
                </span>
              </div>
            )}

            {/* Alert ① — esiste già un override attivo su questa fascia */}
            {scope !== 'forever' && existingActiveOverride && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  Questa fascia ha già una modifica a tempo attiva fino al{' '}
                  <strong>{formatItalianDate(existingActiveOverride.date_to)}</strong>.{' '}
                  Per i giorni in comune varrà quella con l'intervallo più corto.
                </span>
              </div>
            )}
          </div>
        )}

        {showOutsideAlert && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Questa fascia è fuori dall'orario di apertura comunicato ai clienti.
            </span>
          </div>
        )}

        {validationError && (
          <p className="text-sm text-red-600" role="alert">
            {validationError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={isPending}>
            Annulla
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isPending}>
            {isPending ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Aggiungi'}
          </Button>
        </div>
      </form>
      </Modal>

      <DiscardChangesConfirmModal
        isOpen={discardConfirmOpen}
        onStay={() => setDiscardConfirmOpen(false)}
        onDiscard={confirmDiscardClose}
      />
    </>
  )
}

// ─────────────────────────────────────────────
// Riga fascia
// ─────────────────────────────────────────────

/** Etichetta del tipo di override come appare nel menu "Quando?". */
const OVERRIDE_SCOPE_LABEL: Record<Exclude<OverrideScope, 'forever'>, string> = {
  today: 'Solo oggi',
  week: 'Questa settimana',
  month: 'Fino a fine mese',
  custom: 'Giorni scelti a mano',
}

function overrideTurnsDisplayValue(maxTurns: number | null): string {
  if (maxTurns === null) return 'Illimitata'
  if (maxTurns === 0) return 'Chiusa'
  return String(maxTurns)
}

function overrideGuestsDisplayValue(maxGuests: number | null): string {
  return maxGuests == null ? 'nessun limite' : String(maxGuests)
}

/**
 * Badge verde: modifica a tempo che vale OGGI per questa fascia
 * (regola "vince il più specifico"). Solo override temporanei, non "Per sempre".
 */
const ActiveTodayBadge: FC = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-800 sm:gap-1.5 sm:px-2 sm:py-0.5"
    aria-label="Modifica a tempo attiva oggi"
    title="Modifica a tempo attiva oggi"
  >
    <span
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 sm:h-2 sm:w-2"
      aria-hidden
    />
    <span className="hidden text-xs font-medium sm:inline">Attiva oggi</span>
  </span>
)

/**
 * Override attivi di una fascia, raggruppati per tipo (Solo oggi / Questa
 * settimana / Fino a fine mese / Giorni scelti a mano). Ogni voce è
 * eliminabile: alla rimozione la fascia torna ai valori base per quei giorni.
 */
const OverrideList: FC<{
  overrides: ServiceSlotOverride[]
  activeTodayId: string | null
  onRemove: (id: string) => void
  isRemoving: boolean
}> = ({ overrides, activeTodayId, onRemove, isRemoving }) => {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const groups = new Map<Exclude<OverrideScope, 'forever'>, ServiceSlotOverride[]>()
  for (const o of overrides) {
    const scope = classifyOverrideScope(o)
    const list = groups.get(scope) ?? []
    list.push(o)
    groups.set(scope, list)
  }
  const order: Exclude<OverrideScope, 'forever'>[] = ['today', 'week', 'month', 'custom']

  return (
    <div className="space-y-4 px-4 py-4">
      {order
        .filter((scope) => groups.has(scope))
        .map((scope) => (
          <div key={scope} className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {OVERRIDE_SCOPE_LABEL[scope]}
            </p>
            <ul className="space-y-1.5">
              {groups.get(scope)!.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900"
                >
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    {o.id === activeTodayId && <ActiveTodayBadge />}
                    <span>
                      {o.date_from === o.date_to ? (
                        <strong>{formatItalianDateWithWeekday(o.date_from)}</strong>
                      ) : (
                        <>
                          dal <strong>{formatItalianDateWithWeekday(o.date_from)}</strong> al{' '}
                          <strong>{formatItalianDateWithWeekday(o.date_to)}</strong>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-violet-700">
                      Turni: {overrideTurnsDisplayValue(o.max_turns)}
                      {' · '}
                      Coperti: {overrideGuestsDisplayValue(o.max_guests)}
                    </span>
                  </span>
                  {confirmId === o.id ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-red-600">Eliminare?</span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={isRemoving}
                        onClick={() => { onRemove(o.id); setConfirmId(null) }}
                      >
                        Sì
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmId(null)}
                      >
                        No
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Elimina questa modifica a tempo"
                      onClick={() => setConfirmId(o.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  )
}

interface SlotRowProps {
  slot: ServiceSlot
  onEdit: (slot: ServiceSlot) => void
  onDelete: (id: string) => void
  onToggleClosed: (slot: ServiceSlot) => void
  isDeleting: boolean
  isTogglingClosed: boolean
  activeOverrides: ServiceSlotOverride[]
  onRemoveOverride: (id: string) => void
  isRemovingOverride: boolean
}

/** Badge coperti/turni + azioni modifica/elimina fascia. Condiviso tra riga semplice e card. */
const SlotControls: FC<{
  slot: ServiceSlot
  onEdit: (slot: ServiceSlot) => void
  onDelete: (id: string) => void
  onToggleClosed: (slot: ServiceSlot) => void
  isDeleting: boolean
  isTogglingClosed: boolean
}> = ({ slot, onEdit, onDelete, onToggleClosed, isDeleting, isTogglingClosed }) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const closed = isServiceSlotClosed(slot)
  const busy = isDeleting || isTogglingClosed
  return (
    <div className="flex shrink-0 items-center gap-2">
      {slot.max_guests != null && !closed && (
        <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          {slot.max_guests} cop.
        </span>
      )}
      {closed ? (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          Servizio chiuso
        </span>
      ) : (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${maxTurnsBadgeClass(slot.max_turns)}`}>
          {maxTurnsLabel(slot.max_turns)}
        </span>
      )}

      {confirmDelete ? (
        <>
          <span className="text-xs text-red-600">Eliminare?</span>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => { onDelete(slot.id); setConfirmDelete(false) }}
          >
            Sì
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(false)}
          >
            No
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant={closed ? 'outline' : 'ghost'}
            size="icon"
            aria-label={closed ? `Riapri servizio ${slot.name}` : `Chiudi servizio ${slot.name}`}
            disabled={busy}
            onClick={() => onToggleClosed(slot)}
            className={closed ? 'border-red-200 bg-red-50' : undefined}
          >
            {closed ? (
              <RotateCcw className="h-4 w-4 text-red-600" aria-hidden />
            ) : (
              <X className="h-4 w-4 text-red-500" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Modifica ${slot.name}`}
            disabled={busy}
            onClick={() => onEdit(slot)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Elimina ${slot.name}`}
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </>
      )}
    </div>
  )
}

const SlotRow: FC<SlotRowProps> = ({
  slot,
  onEdit,
  onDelete,
  onToggleClosed,
  isDeleting,
  isTogglingClosed,
  activeOverrides,
  onRemoveOverride,
  isRemovingOverride,
}) => {
  const closed = isServiceSlotClosed(slot)
  const timeLabel = `${slot.start_time.slice(0, 5)} → ${slot.end_time.slice(0, 5)}`

  // Senza modifiche a tempo: riga semplice, identica a prima.
  if (activeOverrides.length === 0) {
    return (
      <div
        className={`flex items-center justify-between rounded-xl border border-(--color-border) bg-surface px-4 py-3 shadow-sm transition-opacity ${slotClosedRowClass(closed)}`}
      >
        <div>
          <p className="font-semibold text-primary-900">{slot.name}</p>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">{timeLabel}</p>
        </div>
        <SlotControls
          slot={slot}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleClosed={onToggleClosed}
          isDeleting={isDeleting}
          isTogglingClosed={isTogglingClosed}
        />
      </div>
    )
  }

  // Con modifiche a tempo: card espandibile che le elenca e permette di eliminarle.
  // Override che vince OGGI per questa fascia (regola "vince il più specifico").
  // null = ha modifiche in calendario ma nessuna copre la data di oggi.
  const todayWinner = resolveSlotOverride(activeOverrides, slot.id, todayLocalISODate())

  return (
    <CollapsibleCard
      className={slotClosedRowClass(closed)}
      defaultExpanded={false}
      title={slot.name}
      headerClassName="relative bg-gray-50 hover:bg-gray-100 border-b border-gray-200"
      subtitle={
        <span className="flex w-full min-w-0 flex-col gap-1">
          <span className="text-sm text-(--color-text-muted)">{timeLabel}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-violet-700">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
              {activeOverrides.length}{' '}
              {activeOverrides.length === 1 ? 'Modifica a tempo' : 'Modifiche a tempo'}
            </span>
            {todayWinner !== null && (
              <span className="sm:hidden">
                <ActiveTodayBadge />
              </span>
            )}
          </span>
        </span>
      }
      actions={
        <>
          {todayWinner !== null && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] hidden -translate-x-1/2 -translate-y-1/2 sm:block">
              <ActiveTodayBadge />
            </div>
          )}
          <SlotControls
            slot={slot}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleClosed={onToggleClosed}
            isDeleting={isDeleting}
            isTogglingClosed={isTogglingClosed}
          />
        </>
      }
    >
      <OverrideList
        overrides={activeOverrides}
        activeTodayId={todayWinner?.id ?? null}
        onRemove={onRemoveOverride}
        isRemoving={isRemovingOverride}
      />
    </CollapsibleCard>
  )
}

// ─────────────────────────────────────────────
// Componente principale
// ─────────────────────────────────────────────

export const ServiceSlotsManager: FC = () => {
  const { data: slots = [], isLoading, error } = useServiceSlots()
  const { data: overrides = [] } = useServiceSlotOverrides()
  const deleteSlot = useDeleteServiceSlot()
  const deleteOverride = useDeleteServiceSlotOverride()
  const updateSlot = useUpdateServiceSlot()
  const [togglingClosedId, setTogglingClosedId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceSlot | null>(null)

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(slot: ServiceSlot) {
    setEditing(slot)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  function handleToggleServiceClosed(slot: ServiceSlot) {
    const closed = isServiceSlotClosed(slot)
    setTogglingClosedId(slot.id)
    updateSlot.mutate(
      closed
        ? {
            id: slot.id,
            max_turns: slot.max_turns_resume ?? null,
            max_turns_resume: null,
            skipToast: true,
          }
        : {
            id: slot.id,
            max_turns: 0,
            max_turns_resume: slot.max_turns,
            skipToast: true,
          },
      {
        onSuccess: () => {
          toast.success(
            closed
              ? `Servizio «${slot.name}» riaperto.`
              : `Servizio «${slot.name}» chiuso: nessun tavolo disponibile in questa fascia.`,
          )
        },
        onSettled: () => setTogglingClosedId(null),
      },
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-title-card font-semibold text-primary-900">Fasce orarie</h2>
          <p className="mt-0.5 text-body text-(--color-text-muted)">
            Organizza i turni in sala per il servizio al cliente.
          </p>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Aggiungi fascia
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          Impossibile caricare le fasce orarie.
        </div>
      )}

      {isLoading && !error && (
        <div className="flex h-24 items-center justify-center rounded-xl border border-(--color-border) bg-surface">
          <span className="text-sm text-(--color-text-muted)">Caricamento…</span>
        </div>
      )}

      {!isLoading && !error && slots.length === 0 && (
        <div className="rounded-xl border border-dashed border-(--color-border) bg-surface px-6 py-8 text-center">
          <p className="font-semibold text-primary-900">Nessuna fascia configurata.</p>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Aggiungi la prima fascia oraria con il pulsante in alto.
          </p>
        </div>
      )}

      {!isLoading && !error && slots.length > 0 && (
        <div className="space-y-2">
          {slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onEdit={openEdit}
              onDelete={(id) => deleteSlot.mutate(id)}
              onToggleClosed={handleToggleServiceClosed}
              isDeleting={deleteSlot.isPending}
              isTogglingClosed={togglingClosedId === slot.id && updateSlot.isPending}
              activeOverrides={getActiveOverrides(overrides, slot.id)}
              onRemoveOverride={(id) => deleteOverride.mutate(id)}
              isRemovingOverride={deleteOverride.isPending}
            />
          ))}
        </div>
      )}

      <SlotModal isOpen={modalOpen} onClose={closeModal} initial={editing} />
    </div>
  )
}
