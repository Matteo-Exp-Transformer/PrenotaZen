import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input, Textarea, TimePicker24h } from '@/components/ui'
import type { BookingRequestInput, BookingType } from '@/types/booking'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import { useCreateAdminBooking } from '../hooks/useAdminBookingRequests'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { Send, Loader2, MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { MenuSelection } from './MenuSelection'
import { DietaryRestrictionsStructuredSection } from './DietaryRestrictionsStructuredSection'
import { useMenuItems } from '../hooks/useMenuItems'
import type { PresetMenuType } from '../constants/presetMenus'
import { BOOKING_PUBLIC_CLIENT_TEXT_LIMITS } from '../constants/bookingPrenotaTextLimits'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import { DEFAULT_BOOKING_FORM_CONFIG } from '../constants/bookingPublicFormConfig'
import { getModeLabelByType } from '../utils/bookingModeLabels'
import {
  applyPresetTypeToBookingFormPayload,
  computeMenuTotalsFromItems,
  isGuestComposableMenuSelection,
  presetSelectionStillMatchesStoredPreset,
} from '../utils/buildPresetMenuSelection'
import { shouldShowComposeMenuHeader } from '../constants/presetMenus'
import { useAcceptedBookings } from '../hooks/useBookingQueries'
import { useCapacityCheck } from '../hooks/useCapacityCheck'
import { CapacityWarningModal } from './CapacityWarningModal'
import { PastStartTimeWarningModal } from './PastStartTimeWarningModal'
import { isWallClockStartBeforeNow, trimTimeToHHmm } from '../utils/dateUtils'
import { logger } from '@/lib/logger'
import { useFeatures } from '@/hooks/useFeatures'
import { useFormValidationAttention } from '../hooks/useFormValidationAttention'
import {
  ADMIN_BOOKING_ERROR_FIELD_IDS,
  getFormFieldAttentionProps,
} from '../utils/formValidationAttention'


export type AdminBookingFormNavigationGuardHandle = {
  saveAll: () => Promise<void>
  discardAll: () => void
}

function buildEmptyAdminBookingFormState(initialDate?: string): BookingRequestInput {
  return {
    client_name: '',
    client_email: '',
    client_phone: '',
    booking_type: 'tavolo',
    desired_date: initialDate ?? '',
    desired_time: '',
    num_guests: 0,
    special_requests: '',
    menu_selection: { items: [] },
    dietary_restrictions: [],
    preset_menu: null,
    placement: '',
  }
}

export function isAdminBookingFormDirty(
  formData: BookingRequestInput,
  baseline: BookingRequestInput,
): boolean {
  return JSON.stringify(formData) !== JSON.stringify(baseline)
}

interface AdminBookingFormProps {
  onSubmit?: () => void
  /** Data (YYYY-MM-DD) precompilata, es. dalla scorciatoia "crea da giorno" del calendario. */
  initialDate?: string
  /** C-U2: segnala bozza aperta per guard cambio tab admin. */
  onDirtyChange?: (dirty: boolean) => void
  /** C-U2: Salva/Annulla invocati dal guard navigazione (tab dashboard). */
  navigationGuardRef?: React.MutableRefObject<AdminBookingFormNavigationGuardHandle | null>
}

const ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME =
  '!border-black/20 text-center !text-[18px] sm:!text-[16px] !font-medium text-warm-wood placeholder:text-warm-wood/50 rounded-[12px] focus:!border-warm-wood focus:!ring-2 focus:!ring-warm-wood/40'
export const AdminBookingForm: React.FC<AdminBookingFormProps> = ({
  onSubmit,
  initialDate,
  onDirtyChange,
  navigationGuardRef,
}) => {
  const features = useFeatures()
  const baselineRef = useRef(buildEmptyAdminBookingFormState(initialDate))
  const [formData, setFormData] = useState<BookingRequestInput>(() => baselineRef.current)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedPreset, setSelectedPreset] = useState<PresetMenuType>(null)
  const [showCapacityWarning, setShowCapacityWarning] = useState(false)
  const [capacityWarningOverride, setCapacityWarningOverride] = useState<{
    exceededBy: number
    slotName: string
    totalOccupied: number
    capacity: number
  } | null>(null)
  const [showPastStartWarning, setShowPastStartWarning] = useState(false)
  const [touchCrossBurst, setTouchCrossBurst] = useState(0)

  const { attentionFieldKey, clearAttentionField, focusFirstValidationIssue } =
    useFormValidationAttention({
      errorFieldIds: ADMIN_BOOKING_ERROR_FIELD_IDS,
    })

  const fieldAttention = (fieldKey: string) =>
    getFormFieldAttentionProps(fieldKey, attentionFieldKey, clearAttentionField)

  const navigationSaveResolveRef = useRef<(() => void) | null>(null)
  const navigationSaveRejectRef = useRef<((error: Error) => void) | null>(null)
  const navigationGuardSaveActiveRef = useRef(false)

  const clearNavigationSavePromise = useCallback(() => {
    navigationSaveResolveRef.current = null
    navigationSaveRejectRef.current = null
  }, [])

  const rejectNavigationSave = useCallback(
    (message = 'Salvataggio annullato') => {
      navigationSaveRejectRef.current?.(new Error(message))
      clearNavigationSavePromise()
    },
    [clearNavigationSavePromise],
  )

  const isDirty = useMemo(
    () => isAdminBookingFormDirty(formData, baselineRef.current),
    [formData],
  )

  useEffect(() => {
    onDirtyChange?.(isDirty)
    return () => {
      onDirtyChange?.(false)
    }
  }, [isDirty, onDirtyChange])

  const { mutate, isPending } = useCreateAdminBooking()
  const queryClient = useQueryClient()
  const { data: menuItems = [] } = useMenuItems()
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const bookingModes = useMemo(
    () => bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes,
    [bookingFormConfig],
  )
  const { data: staffPresetsDropdownVisible = true } = useRestaurantSetting('booking_staff_presets_visible')
  const { data: customStaffPresets = [] } = useRestaurantSetting('booking_custom_staff_presets')
  const { data: placementAreasSetting = [] } = useRestaurantSetting('booking_placement_areas', { authenticated: true })

  const normalizedPlacementAreas = useMemo(() => {
    if (!features.servizio) return []
    if (!Array.isArray(placementAreasSetting)) return []
    return placementAreasSetting
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)
  }, [features.servizio, placementAreasSetting])

  const { data: acceptedBookings = [] } = useAcceptedBookings()

  // Convert desired_time to startTime and endTime for capacity check
  // Default endTime is startTime + 3 hours (same as AcceptBookingModal)
  const getTimeRange = (desiredTime: string): { startTime: string; endTime: string } => {
    if (!desiredTime) return { startTime: '', endTime: '' }

    const [startHours, startMinutes] = desiredTime.split(':').map(Number)
    const normalizedStartMinutes = startMinutes === 0 || startMinutes === 30 ? startMinutes : 0
    const startTime = `${startHours.toString().padStart(2, '0')}:${normalizedStartMinutes.toString().padStart(2, '0')}`

    // Calculate end time (default +3 hours) with normalized minutes
    const endHours = (startHours + 3) % 24
    const endTime = `${endHours.toString().padStart(2, '0')}:${normalizedStartMinutes.toString().padStart(2, '0')}`

    return { startTime, endTime }
  }

  // Check capacity in real-time
  const timeRange = getTimeRange(formData.desired_time || '')
  const capacityCheck = useCapacityCheck({
    date: formData.desired_date || '',
    startTime: timeRange.startTime,
    endTime: timeRange.endTime,
    numGuests: formData.num_guests || 0,
    acceptedBookings,
  })

  // Reset num_guests to 0 when cleared - only allow numeric input
  const handleNumGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim()
    if (inputValue === '') {
      setFormData({ ...formData, num_guests: 0, menu_total_booking: 0 })
      setErrors({ ...errors, num_guests: '' })
      return
    }
    if (/^\d+$/.test(inputValue)) {
      // L10: cap a video — il numero ospiti non può superare il massimo consentito.
      const value = Math.min(parseInt(inputValue, 10), BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.numGuestsMax)
      if (!isNaN(value) && value >= 1) {
        const totalPerPerson = formData.menu_total_per_person || 0
        setFormData({ ...formData, num_guests: value, menu_total_booking: totalPerPerson * value })
        setErrors({ ...errors, num_guests: '' })
      } else if (value === 0) {
        setFormData({ ...formData, num_guests: 0, menu_total_booking: 0 })
        setErrors({ ...errors, num_guests: '' })
      }
    }
  }

  const handleNumGuestsKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only allow numbers
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      e.preventDefault()
    }
  }

  // Gestione selezione menu predefinito
  const handlePresetMenuChange = (presetType: PresetMenuType) => {
    setSelectedPreset(presetType)

    if (!presetType) {
      setFormData({
        ...formData,
        preset_menu: null,
        menu_selection: { items: [] },
        menu_total_per_person: 0,
        menu_total_booking: 0,
      })
      return
    }

    const resolved = applyPresetTypeToBookingFormPayload(presetType, menuItems, customStaffPresets)
    if (!resolved) {
      toast.error('Menù consigliato non disponibile. Aggiorna la pagina o scegli un altro menù.')
      setSelectedPreset(null)
      setFormData({
        ...formData,
        preset_menu: null,
        menu_selection: { items: [] },
        menu_total_per_person: 0,
        menu_total_booking: 0,
      })
      return
    }

    const { items } = resolved
    const numGuests = formData.num_guests || 0
    const { totalPerPerson, menu_total_booking } = computeMenuTotalsFromItems(items, numGuests)

    setFormData({
      ...formData,
      preset_menu: presetType,
      menu_selection: { items },
      menu_total_per_person: totalPerPerson,
      menu_total_booking,
    })
  }

  // Reset preset quando cambia booking_type
  useEffect(() => {
    if (!bookingTypeUsesMenuSelections(formData.booking_type)) {
      setSelectedPreset(null)
      setFormData(prev => ({
        ...prev,
        preset_menu: null
      }))
    }
  }, [formData.booking_type])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true
    let firstErrorKey: string | null = null

    // Name validation
    if (!formData.client_name.trim()) {
      newErrors.client_name = 'Nome obbligatorio'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_name'
    }

    // Email validation - optional but must be valid if provided
    if (formData.client_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.client_email)) {
      newErrors.client_email = 'Email non valida'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_email'
    }

    // Phone validation - required
    if (!formData.client_phone || !formData.client_phone.trim()) {
      newErrors.client_phone = 'Numero di telefono obbligatorio'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_phone'
    }

    // Date validation
    if (!formData.desired_date) {
      newErrors.desired_date = 'Data obbligatoria'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'desired_date'
    } else {
      const selectedDate = new Date(formData.desired_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate < today) {
        newErrors.desired_date = 'La data non può essere nel passato'
        isValid = false
        if (!firstErrorKey) firstErrorKey = 'desired_date'
      }
    }

    // Time validation - required
    if (!formData.desired_time) {
      newErrors.desired_time = 'Orario obbligatorio'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'desired_time'
    }

    // Num guests validation
    if (!formData.num_guests || formData.num_guests < 1) {
      newErrors.num_guests = 'Numero ospiti obbligatorio (min 1)'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'num_guests'
    }

    // Booking type validation
    if (!formData.booking_type) {
      newErrors.booking_type = 'Tipologia di prenotazione obbligatoria'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'booking_type'
    }

    // Menù personalizzabile: almeno un piatto scelto (menù a prezzo fisso / preset fisso: fuori scope).
    const guestComposableMenu =
      (selectedPreset != null &&
        isGuestComposableMenuSelection(selectedPreset, customStaffPresets)) ||
      (selectedPreset == null &&
        shouldShowComposeMenuHeader(null, undefined, formData.booking_type))
    if (
      guestComposableMenu &&
      (!formData.menu_selection || !formData.menu_selection.items || formData.menu_selection.items.length === 0)
    ) {
      newErrors.menu = 'Scegli almeno un piatto dal menù!'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'menu'
    }

    setErrors(newErrors)

    if (!isValid) {
      const errorCount = Object.keys(newErrors).length
      toast.error(
        `Compilazione non valida: ${errorCount} ${errorCount === 1 ? 'campo da correggere' : 'campi da correggere'}`,
        {
          position: 'top-center',
          autoClose: 4000,
        },
      )
      focusFirstValidationIssue(firstErrorKey)
    }

    return isValid
  }

  /** Dopo eventuale OK su orario passato: capienza → modale → creazione. */
  const continueSubmitAfterPastTimeCheck = () => {
    setCapacityWarningOverride(null)

    if (!capacityCheck.isAvailable) {
      if (capacityCheck.exceededSlots && capacityCheck.exceededSlots.length > 0) {
        setShowCapacityWarning(true)
        return
      }

      const affectedSlots = capacityCheck.slotsStatus.filter((slot) => {
        if (slot.capacity == null) return false
        const totalOccupied = slot.occupied + (formData.num_guests || 0)
        return totalOccupied > slot.capacity
      })

      if (affectedSlots.length > 0) {
        setCapacityWarningOverride(null)
        setShowCapacityWarning(true)
        return
      }
    }

    if (!capacityCheck.isAvailable) {
      logger.warn('⚠️ [AdminBookingForm] Capacity check failed but no slot details available, proceeding anyway')
      toast.warn(`⚠️ Attenzione: la capienza potrebbe essere superata. La prenotazione verrà comunque creata.`)
    }

    createBooking()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const startHHmm = trimTimeToHHmm(formData.desired_time || '')
    if (
      formData.desired_date &&
      startHHmm &&
      isWallClockStartBeforeNow(formData.desired_date, startHHmm)
    ) {
      setShowPastStartWarning(true)
      return
    }

    continueSubmitAfterPastTimeCheck()
  }

  const resetFormState = useCallback(() => {
    const empty = buildEmptyAdminBookingFormState(initialDate)
    baselineRef.current = empty
    setFormData(empty)
    setSelectedPreset(null)
    setErrors({})
    clearNavigationSavePromise()
  }, [initialDate, clearNavigationSavePromise])

  const createBooking = () => {
    const fromNavigationGuard = navigationGuardSaveActiveRef.current
    const payload: BookingRequestInput = {
      ...(features.servizio ? formData : { ...formData, placement: '' }),
      menu_promo_labels: null,
    }
    mutate(payload, {
      onSuccess: async () => {
        toast.success('Prenotazione creata con successo!')
        resetFormState()
        navigationGuardSaveActiveRef.current = false

        // Invalidate and refetch all booking-related queries
        // This will refresh the calendar automatically
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['bookings'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['bookings', 'pending'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['bookings', 'accepted'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['bookings', 'stats'], refetchType: 'all' }),
          queryClient.invalidateQueries({ queryKey: ['bookings', 'all'], refetchType: 'all' }),
        ])

        navigationSaveResolveRef.current?.()
        clearNavigationSavePromise()
        onSubmit?.()
      },
      onError: (error) => {
        logger.error('Error creating booking:', error)
        toast.error('Errore nella creazione della prenotazione')
        navigationGuardSaveActiveRef.current = false
        if (fromNavigationGuard) rejectNavigationSave('Creazione non riuscita')
      },
    })
  }

  const submitFromGuard = (): boolean => {
    if (!validate()) {
      navigationGuardSaveActiveRef.current = false
      rejectNavigationSave('Validazione non superata')
      return false
    }

    const startHHmm = trimTimeToHHmm(formData.desired_time || '')
    if (
      formData.desired_date &&
      startHHmm &&
      isWallClockStartBeforeNow(formData.desired_date, startHHmm)
    ) {
      setShowPastStartWarning(true)
      return true
    }

    continueSubmitAfterPastTimeCheck()
    return true
  }

  const submitFromGuardRef = useRef(submitFromGuard)
  submitFromGuardRef.current = submitFromGuard
  const resetFormStateRef = useRef(resetFormState)
  resetFormStateRef.current = resetFormState

  const cancelNavigationGuardSave = useCallback(() => {
    if (!navigationGuardSaveActiveRef.current) return
    navigationGuardSaveActiveRef.current = false
    rejectNavigationSave()
  }, [rejectNavigationSave])

  useEffect(() => {
    if (!navigationGuardRef) return
    navigationGuardRef.current = {
      saveAll: () =>
        new Promise<void>((resolve, reject) => {
          if (!isAdminBookingFormDirty(formData, baselineRef.current)) {
            resolve()
            return
          }
          navigationGuardSaveActiveRef.current = true
          navigationSaveResolveRef.current = resolve
          navigationSaveRejectRef.current = reject
          submitFromGuardRef.current()
        }),
      discardAll: () => {
        navigationGuardSaveActiveRef.current = false
        resetFormStateRef.current()
      },
    }
    return () => {
      navigationGuardRef.current = null
    }
  }, [navigationGuardRef, formData])

  return (
    <>
    <form noValidate onSubmit={handleSubmit} className="space-y-8">
      {/* Layout a 2 Colonne su schermi grandi */}
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {/* COLONNA SINISTRA: Dati Personali */}
        <div className="flex w-full flex-col items-center rounded-xl border shadow-sm px-3 py-4 md:px-5 md:py-5 admin-warm-surface box-border">
          <div className="space-y-6 w-full max-w-full md:w-[min(100%,max(33vw,18.75rem))] md:min-w-[min(100%,18.75rem)] mx-auto box-border">
          <h2 className="mb-4 border-b-2 border-warm-beige bg-white/50 px-4 py-3 pb-3 text-center text-xl min-[470px]:text-2xl md:text-3xl font-serif font-bold text-warm-wood shadow-sm backdrop-blur-sm rounded-2xl">
            Dati Personali
          </h2>

          {/* Nome */}
          <div
            id="client_name"
            className={cn('space-y-3', fieldAttention('client_name').className)}
            onPointerDown={fieldAttention('client_name').onPointerDown}
          >
            <Input
              value={formData.client_name}
              onChange={(e) => {
                setFormData({ ...formData, client_name: e.target.value })
                setErrors({ ...errors, client_name: '' })
              }}
              placeholder="Nome Completo *"
              required
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4 ${errors.client_name ? 'border-red-500!' : ''}`}
            />
            {errors.client_name && (
              <p className="text-sm text-red-500">{errors.client_name}</p>
            )}
          </div>

          {/* Email */}
          <div
            id="client_email"
            className={cn('space-y-3', fieldAttention('client_email').className)}
            onPointerDown={fieldAttention('client_email').onPointerDown}
          >
            <Input
              type="email"
              value={formData.client_email}
              onChange={(e) => {
                setFormData({ ...formData, client_email: e.target.value })
                setErrors({ ...errors, client_email: '' })
              }}
              placeholder="Email (Opzionale)"
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4 ${errors.client_email ? 'border-red-500!' : ''}`}
            />
            {errors.client_email && (
              <p className="text-sm text-red-500">{errors.client_email}</p>
            )}
          </div>

          {/* Telefono */}
          <div
            id="client_phone"
            className={cn('space-y-3', fieldAttention('client_phone').className)}
            onPointerDown={fieldAttention('client_phone').onPointerDown}
          >
            <Input
              type="tel"
              value={formData.client_phone}
              onChange={(e) => {
                setFormData({ ...formData, client_phone: e.target.value })
                setErrors({ ...errors, client_phone: '' })
              }}
              placeholder="Telefono *"
              required
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4 ${errors.client_phone ? 'border-red-500!' : ''}`}
            />
            {errors.client_phone && (
              <p className="text-sm text-red-500">{errors.client_phone}</p>
            )}
          </div>

          {/* Numero ospiti — stesso gruppo dei dati cliente, sotto il telefono */}
          <div
            id="num_guests"
            className={cn('space-y-3 pt-2', fieldAttention('num_guests').className)}
            onPointerDown={fieldAttention('num_guests').onPointerDown}
          >
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={formData.num_guests > 0 ? formData.num_guests.toString() : ''}
              onChange={handleNumGuestsChange}
              onKeyPress={handleNumGuestsKeyPress}
              required
              aria-label="Numero ospiti (obbligatorio)"
              placeholder="Numero Ospiti * (es: 15)"
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4 ${errors.num_guests ? 'border-red-500!' : ''}`}
            />
            {errors.num_guests && (
              <p className="text-sm text-red-500">{errors.num_guests}</p>
            )}
          </div>

          {/* Sempre visibile in admin (anche con "Prenota un tavolo"): in pubblico compare solo con menù */}
          <div className="w-full space-y-6 pt-4 border-t border-warm-beige/40">
            <DietaryRestrictionsStructuredSection
              omitSpecialRequestsSection
              restrictions={formData.dietary_restrictions || []}
              onRestrictionsChange={(restrictions) => {
                setFormData({
                  ...formData,
                  dietary_restrictions: restrictions
                })
              }}
              specialRequests={formData.special_requests || ''}
              onSpecialRequestsChange={(value) => {
                setFormData({ ...formData, special_requests: value })
              }}
            />
          </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Dettagli Prenotazione */}
        <div className="flex w-full flex-col items-center rounded-xl border shadow-sm px-3 py-4 md:px-5 md:py-5 admin-warm-surface box-border">
          <div className="space-y-6 w-full max-w-full md:w-[min(100%,max(33vw,18.75rem))] md:min-w-[min(100%,18.75rem)] mx-auto box-border">
          <h2 className="mb-4 border-b-2 border-warm-beige bg-white/50 px-4 py-3 pb-3 text-center text-xl min-[470px]:text-2xl md:text-3xl font-serif font-bold text-warm-wood shadow-sm backdrop-blur-sm rounded-2xl">
            Dettagli Prenotazione
          </h2>

          <div
            id="booking_type"
            className={cn('space-y-3', fieldAttention('booking_type').className)}
            onPointerDown={fieldAttention('booking_type').onPointerDown}
          >
            <label
              htmlFor="booking_type-control"
              className="inline-block text-base md:text-lg font-bold text-warm-wood bg-white/85 backdrop-blur-[1px] px-4 py-2 rounded-xl mb-2"
            >
              Tipologia di Prenotazione *
            </label>
            <select
              id="booking_type-control"
              value={formData.booking_type}
              onChange={(e) => {
                const booking_type = e.target.value as BookingType
                if (booking_type === 'tavolo') {
                  setSelectedPreset(null)
                  setFormData({
                    ...formData,
                    booking_type,
                    preset_menu: null,
                    menu_selection: { items: [] },
                    menu_total_per_person: undefined,
                    menu_total_booking: undefined,
                    dietary_restrictions: []
                  })
                } else {
                  setFormData({ ...formData, booking_type })
                }
                setErrors({ ...errors, booking_type: '' })
              }}
              required
              aria-required="true"
              className={cn(
                'block w-full h-14 rounded-full border border-black/20 shadow-sm transition-all px-4 text-base font-bold bg-white/85 backdrop-blur-[1px] text-black focus:border-warm-wood focus:outline-none',
                errors.booking_type && 'border-red-500!'
              )}
            >
              {bookingModes
                .filter((m) => m.enabled || m.booking_type === formData.booking_type)
                .map((m) => (
                  <option key={m.booking_type} value={m.booking_type}>
                    {getModeLabelByType(bookingModes, m.booking_type)}
                  </option>
                ))}
            </select>
            {errors.booking_type && (
              <p className="text-sm text-red-500">{errors.booking_type}</p>
            )}
          </div>

          <div
            id="desired_date"
            className={cn('space-y-3', fieldAttention('desired_date').className)}
            onPointerDown={fieldAttention('desired_date').onPointerDown}
          >
            <label
              htmlFor="desired_date-control"
              className="inline-block text-base md:text-lg font-bold text-warm-wood bg-white/85 backdrop-blur-[1px] px-4 py-2 rounded-xl mb-2"
            >
              Data *
            </label>
            <Input
              id="desired_date-control"
              type="date"
              value={formData.desired_date}
              onChange={(e) => {
                setFormData({ ...formData, desired_date: e.target.value })
                setErrors({ ...errors, desired_date: '' })
              }}
              required
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4 ${errors.desired_date ? 'border-red-500!' : ''}`}
            />
            {errors.desired_date && (
              <p className="text-sm text-red-500">{errors.desired_date}</p>
            )}
          </div>

          <div
            id="desired_time"
            className={cn('space-y-3', fieldAttention('desired_time').className)}
            onPointerDown={fieldAttention('desired_time').onPointerDown}
          >
            <label
              htmlFor="desired_time-control"
              className="inline-block text-base md:text-lg font-bold text-warm-wood bg-white/85 backdrop-blur-[1px] px-4 py-2 rounded-xl mb-2"
            >
              Ora *
            </label>
            <TimePicker24h
              id="desired_time-control"
              value={formData.desired_time || ''}
              onChange={(v) => {
                setFormData({ ...formData, desired_time: v })
                setErrors({ ...errors, desired_time: '' })
              }}
              required
              hasError={!!errors.desired_time}
              className={`${ADMIN_FROSTED_TEXT_INPUT_CLASS_NAME} bg-white/85 backdrop-blur-[1px] py-[10px] px-4`}
            />
            {errors.desired_time && (
              <p className="text-sm text-red-500">{errors.desired_time}</p>
            )}
          </div>

          {features.servizio && (
            <div className="space-y-3 pt-2">
              <label
                htmlFor="placement"
                className="inline-flex items-center gap-1.5 text-base md:text-lg font-bold text-warm-wood bg-white/85 backdrop-blur-[1px] px-4 py-2 rounded-xl mb-2"
              >
                <MapPin className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                Posizionamento
              </label>
              <Select
                value={formData.placement || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, placement: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger
                  id="placement"
                  className="w-full h-14 rounded-full border border-black/20 shadow-sm transition-all px-4 text-base font-bold bg-white/85 backdrop-blur-[1px] text-black focus:border-warm-wood focus:outline-none"
                >
                  <SelectValue placeholder="Seleziona sala (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna preferenza</SelectItem>
                  {normalizedPlacementAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <label
              htmlFor="special_requests_admin"
              className="block text-base md:text-lg text-warm-wood mb-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(1px)',
                padding: '8px 16px',
                borderRadius: '12px',
                display: 'inline-block',
                fontWeight: '700',
                marginBottom: '0.5rem'
              }}
            >
              Altre Richieste
            </label>
            <Textarea
              id="special_requests_admin"
              value={formData.special_requests || ''}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              rows={4}
              placeholder="Inserisci eventuali richieste particolari..."
              className="w-full rounded-2xl border shadow-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
              style={{
                borderColor: 'rgba(0,0,0,0.2)',
                padding: '16px',
                fontSize: '16px',
                fontWeight: '700',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(1px)',
                minHeight: '120px',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8B6914'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(0,0,0,0.2)'
              }}
            />
          </div>

        </div>
        </div>
      </div>

      {/* Menu Selection — Rinfresco di Laurea / menù a prezzo fisso */}
      {bookingTypeUsesMenuSelections(formData.booking_type) && (
        <div
          id="menu-section"
          className={cn(
            'space-y-6 rounded-xl border px-3 py-4 shadow-sm md:px-5 md:py-5 admin-warm-surface box-border',
            fieldAttention('menu').className,
          )}
          onPointerDown={fieldAttention('menu').onPointerDown}
        >
          <div className="w-full min-w-0 space-y-6">
            <MenuSelection
              selectedItems={formData.menu_selection?.items || []}
              numGuests={formData.num_guests || 0}
              bookingType={formData.booking_type}
              presetMenu={selectedPreset}
              staffPresetsDropdownVisible={staffPresetsDropdownVisible}
              customStaffPresets={customStaffPresets}
              onPresetMenuChange={handlePresetMenuChange}
              onMenuChange={({ items, totalPerPerson }) => {
                const numGuests = formData.num_guests || 0
                const currentPreset = selectedPreset
                let updatedPreset: PresetMenuType = currentPreset

                if (
                  currentPreset &&
                  !presetSelectionStillMatchesStoredPreset(currentPreset, items, customStaffPresets)
                ) {
                  updatedPreset = null
                  setSelectedPreset(null)
                }

                setFormData({
                  ...formData,
                  preset_menu: updatedPreset,
                  menu_selection: { items },
                  menu_total_per_person: totalPerPerson,
                  menu_total_booking: totalPerPerson * numGuests,
                })
                setErrors({ ...errors, menu: '' })
              }}
            />
            {errors.menu && (
              <p className="text-sm text-red-500">{errors.menu}</p>
            )}
          </div>
        </div>
      )}

      {/* Submit + nota campi obbligatori */}
      <div className="mt-8 flex w-full flex-col items-center gap-4 rounded-xl border px-4 py-5 shadow-sm md:px-6 admin-warm-surface box-border">
        <p className="w-full text-center text-xs font-medium text-slate-800 md:text-left">
          * I campi contrassegnati sono obbligatori.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="booking-cross-shine-btn group relative overflow-hidden px-12 md:px-20 py-7 text-xl md:text-2xl uppercase tracking-wide font-bold text-white rounded-full bg-green-600 hover:bg-green-700 shadow-2xl hover:shadow-[0_20px_40px_rgba(34,197,94,0.4)] hover:-translate-y-1 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-2xl w-full md:w-auto max-w-md md:max-w-2xl"
          onPointerDown={(e) => {
            if (isPending) return
            if (
              typeof window !== 'undefined' &&
              (e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches)
            ) {
              setTouchCrossBurst((v) => v + 1)
            }
          }}
        >
          <div className="booking-cross-shine-mount pointer-events-none absolute inset-0 z-[7] overflow-hidden rounded-[inherit]" aria-hidden>
            <div className="booking-cross-shine-beam booking-cross-shine-beam-desktop" />
            {touchCrossBurst > 0 ? (
              <div
                key={touchCrossBurst}
                className="booking-cross-shine-beam booking-cross-shine-touch-burst"
              />
            ) : null}
          </div>
          {/* Glow effect on hover (stesso pubblico BookingRequestForm) */}
          <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

          {/* Content */}
          <div className="relative z-10 flex items-center justify-center gap-3 whitespace-nowrap">
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-base md:text-lg">Creazione in corso...</span>
              </>
            ) : (
              <>
                <span className="text-xl md:text-2xl">Crea Prenotazione</span>
                <Send className="h-6 w-6 md:h-7 md:w-7 transition-transform duration-300 group-hover:translate-x-1" />
              </>
            )}
          </div>

          {/* Animated border glow — gradienti verdi come pagina prenota pubblica */}
          <div className="absolute inset-0 z-0 pointer-events-none rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="absolute inset-[-2px] rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-green-600 blur-sm"></div>
          </div>
        </button>
      </div>
    </form>

    <PastStartTimeWarningModal
      isOpen={showPastStartWarning}
      variant="new_booking"
      desiredDate={formData.desired_date}
      startTimeHHmm={trimTimeToHHmm(formData.desired_time || '')}
      onClose={() => {
        setShowPastStartWarning(false)
        cancelNavigationGuardSave()
      }}
      onCancel={() => {
        setShowPastStartWarning(false)
        cancelNavigationGuardSave()
      }}
      onConfirm={() => {
        setShowPastStartWarning(false)
        continueSubmitAfterPastTimeCheck()
      }}
    />

    {/* Capacity Warning Modal - Fuori dal form per evitare problemi di rendering */}
    {(() => {
      if (!showCapacityWarning) {
        return null
      }


      if (capacityWarningOverride) {
        return (
          <CapacityWarningModal
            isOpen={showCapacityWarning}
            onClose={() => {
              setShowCapacityWarning(false)
              setCapacityWarningOverride(null)
              cancelNavigationGuardSave()
            }}
            onConfirm={() => {
              setShowCapacityWarning(false)
              setCapacityWarningOverride(null)
              createBooking()
            }}
            onCancel={() => {
              setShowCapacityWarning(false)
              setCapacityWarningOverride(null)
              cancelNavigationGuardSave()
            }}
            exceededBy={capacityWarningOverride.exceededBy}
            slotName={capacityWarningOverride.slotName}
            totalOccupied={capacityWarningOverride.totalOccupied}
            capacity={capacityWarningOverride.capacity}
          />
        )
      }

      // Get exceeded slot info from capacityCheck or calculate it
      let exceededSlot = null

      if (capacityCheck.exceededSlots && capacityCheck.exceededSlots.length > 0) {
        exceededSlot = capacityCheck.exceededSlots[0]
      } else if (!capacityCheck.isAvailable && capacityCheck.slotsStatus) {
        // Calculate from slotsStatus as fallback
        const affectedSlot = capacityCheck.slotsStatus.find((slot) => {
          if (slot.capacity == null) return false
          const totalOccupied = slot.occupied + (formData.num_guests || 0)
          return totalOccupied > slot.capacity
        })

        if (affectedSlot && affectedSlot.capacity != null) {
          const totalOccupied = affectedSlot.occupied + (formData.num_guests || 0)
          const exceededBy = totalOccupied - affectedSlot.capacity
          const slotName =
            affectedSlot.slot === 'morning'
              ? 'mattina'
              : affectedSlot.slot === 'afternoon'
                ? 'pomeriggio'
                : affectedSlot.slot === 'evening'
                  ? 'sera'
                  : 'giornata'

          exceededSlot = {
            exceededBy,
            slotName,
            totalOccupied,
            capacity: affectedSlot.capacity
          }
        }
      }

      if (!exceededSlot) {
        return null
      }


      return (
        <CapacityWarningModal
          isOpen={showCapacityWarning}
          onClose={() => {
            setShowCapacityWarning(false)
            cancelNavigationGuardSave()
          }}
          onConfirm={() => {
            setShowCapacityWarning(false)
            createBooking()
          }}
          onCancel={() => {
            setShowCapacityWarning(false)
            cancelNavigationGuardSave()
          }}
          exceededBy={exceededSlot.exceededBy}
          slotName={exceededSlot.slotName}
          totalOccupied={exceededSlot.totalOccupied}
          capacity={exceededSlot.capacity}
        />
      )
    })()}
  </>
  )
}
