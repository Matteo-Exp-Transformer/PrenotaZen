import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Store, Loader2, Eye, Clock, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { TimePicker24h } from '@/components/ui/TimePicker24h'
import { useTenantContext } from '@/contexts/TenantContext'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
import type { BusinessHours } from '@/lib/businessHours'
import { getDefaultBusinessHours, validateBusinessHours } from '@/lib/businessHours'
import { cn, stripDirectionalFormattingChars } from '@/lib/utils'
import { ADMIN_WARM_BORDER } from '@/lib/adminWarmGradientSurface'
import { BusinessHoursEditor } from './BusinessHoursEditor'
import { toast } from 'react-toastify'
import {
  useRestaurantSetting,
  useUpsertRestaurantSetting,
} from '@/features/booking/hooks/useRestaurantSetting'
import { useFeatures } from '@/hooks/useFeatures'
import {
  OVERNIGHT_TIME_END_HINT,
  slotCrossesMidnight,
  slotRangesOverlap,
} from '@/features/booking/utils/bookingTimeSlots'
import {
  useServiceSlots,
  useUpdateServiceSlot,
  useCreateServiceSlot,
  useDeleteServiceSlot,
  SERVICE_SLOTS_QUERY_KEY,
  type SlotConfig,
} from '@/features/booking/hooks/useServiceSlots'
import {
  BOOKING_FULL_PAGE_BACKGROUND_IDS,
  DEFAULT_BOOKING_PAGE_BACKGROUND,
  DEFAULT_BOOKING_FULL_PAGE_BACKGROUND,
  DEFAULT_BOOKING_STRIP_PHOTO,
  BOOKING_STRIP_PHOTO_IDS,
  bookingFullPageBackgroundPublicHref,
  bookingStripPhotoPublicHref,
  hydrateAdminBookingBackgroundEditor,
  isAdminBookingBackgroundDirty,
  type BookingPageBackgroundId,
  type BookingStripPhotoId,
} from '@/features/booking/constants/bookingPageBackground'
import {
  APP_THEME_OPTIONS,
  DEFAULT_APP_THEME,
  type AppThemeId,
} from '@/features/booking/constants/appTheme'
import { BookingFormConfigPanel, type BookingFormConfigPanelHandle } from './settings/BookingFormConfigPanel'
import { SETTINGS_AUTOSAVE_ENABLED } from '@/config/settingsAutosave'
import { useDebouncedSettingsAutosave } from '@/features/booking/hooks/useDebouncedSettingsAutosave'
import {
  FieldAutosaveIndicator,
  PublicDataSaveConfirmModal,
  SettingsSaveFooter,
} from './settings/SettingsSaveUi'
import { BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS, clampBookingText } from '@/features/booking/constants/bookingPrenotaTextLimits'
import { useFormValidationAttention } from '@/features/booking/hooks/useFormValidationAttention'
import { getFormFieldAttentionProps } from '@/features/booking/utils/formValidationAttention'

/** Mappa errorKey → id DOM per scroll+pulse al primo errore del Salva (FIX 4, 16-06-26). Ordine di
 *  priorità = ordine visivo top-down della pagina: nome locale → orari → fasce. */
const SETTINGS_ERROR_FIELD_IDS: Record<string, string> = {
  restaurant_name: 'settings-error-restaurant-name',
  business_hours: 'settings-error-business-hours',
  time_slots: 'settings-error-time-slots',
}

const RESTAURANT_NAME_MAX_LENGTH = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName
const CONTACT_EMAIL_MAX_LENGTH = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactEmail
const CONTACT_PHONE_MAX_LENGTH = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactPhone
const CONTACT_ADDRESS_MAX_LENGTH = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.contactAddress
const SLOT_NAME_MAX_LENGTH = 40
const TEMP_SLOT_ID_PREFIX = 'temp-'
const isTempSlotId = (id: string) => id.startsWith(TEMP_SLOT_ID_PREFIX)

type EditingSlot = {
  id: string
  name: string
  start_time: string
  end_time: string
  display_order: number
}

type SettingsValidationIssue = {
  key: keyof typeof SETTINGS_ERROR_FIELD_IDS
  message: string
}

function validateEditingSlots(slots: EditingSlot[]): string | null {
  const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
  for (const s of slots) {
    if (!HH_MM.test(s.start_time) || !HH_MM.test(s.end_time)) {
      return `Fascia "${s.name}": orari nel formato HH:mm richiesti`
    }
    if (s.start_time === s.end_time) {
      return `Fascia "${s.name}": inizio e fine coincidono`
    }
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotRangesOverlap(slots[i].start_time, slots[i].end_time, slots[j].start_time, slots[j].end_time)) {
        return `Le fasce "${slots[i].name}" e "${slots[j].name}" si sovrappongono`
      }
    }
  }
  return null
}

const restaurantSettingsIntroCardClass =
  'admin-warm-surface w-full max-w-2xl mx-auto space-y-3 rounded-xl border p-4 md:p-5 shadow-md text-center flex flex-col items-center gap-2 sm:flex-row sm:justify-center'

const previewPickFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 sm:focus-visible:ring-offset-2'

const previewPickEyeButtonClass =
  'absolute left-1/2 top-1/2 z-[10] flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-black/50 text-white opacity-0 shadow-md transition-opacity duration-200 sm:min-h-[3rem] sm:min-w-[3rem] [@media(hover:hover)]:group-hover:opacity-100 max-sm:opacity-100 max-sm:bg-black/45 [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:bg-black/45'

const previewPickHoverScaleClass =
  'h-full w-full transition-transform duration-300 ease-out [@media(hover:hover)]:group-hover:scale-105'

type PublicSlotLimitTogglesProps = {
  variant: 'classic' | 'pro'
  slotLimitEnabled: boolean
  rejectOutOfSlot: boolean
  disabled: boolean
  onSlotLimitChange: (checked: boolean) => void
  onRejectOutOfSlotChange: (checked: boolean) => void
}

const REJECT_OUT_OF_SLOT_HELP: Record<PublicSlotLimitTogglesProps['variant'], string> = {
  classic:
    'Se attivo, le richieste di prenotazione verranno accettate solo se rientrano negli orari delle fasce orarie configurate nella sezione Imposta Fasce Orarie in Impostazioni.',
  pro:
    'Se attivo, le richieste di prenotazione verranno accettate solo se rientrano negli orari delle fasce orarie configurate nella sezione Servizio.',
}

/** Interruttori vincoli verso la pagina pubblica (Classic + Pro). */
const PublicSlotLimitToggles: React.FC<PublicSlotLimitTogglesProps> = ({
  variant,
  slotLimitEnabled,
  rejectOutOfSlot,
  disabled,
  onSlotLimitChange,
  onRejectOutOfSlotChange,
}) => (
  <div className="mx-auto w-full max-w-md space-y-2.5 rounded-xl border border-slate-200 bg-white/70 p-3.5 text-left shadow-sm">
    <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={slotLimitEnabled}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        onChange={(e) => onSlotLimitChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">Attiva limiti coperti per fascia oraria</span>
        <span className="block text-xs leading-relaxed text-slate-500">
          Quando raggiungi la massima capienza di coperti in una fascia oraria, non verranno accettate
          nuove richieste di prenotazioni.
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">
          Se lasciato spento, i clienti potranno prenotare anche se sei al completo in quella fascia oraria.
        </span>
      </span>
    </label>
    <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={rejectOutOfSlot}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        onChange={(e) => onRejectOutOfSlotChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">Rifiuta richieste fuori dalle fasce orarie</span>
        <span className="block text-xs leading-relaxed text-slate-500">
          {REJECT_OUT_OF_SLOT_HELP[variant]}
        </span>
      </span>
    </label>
  </div>
)

type SettingsPreviewPickCardProps = {
  label: string
  mutedLabel?: boolean
  selected: boolean
  disabled: boolean
  pickButtonClass: (selected: boolean) => string
  onPick: () => void
  aspectClass?: string
  pickEntity?: string
  modalConfirmLabel?: string
  modalDescription?: string
  previewSrc?: string
  previewModalSrc?: string
  preview?: React.ReactNode
  modalPreview?: React.ReactNode
}

const SettingsPreviewPickCard: React.FC<SettingsPreviewPickCardProps> = ({
  label,
  mutedLabel = false,
  selected,
  disabled,
  pickButtonClass,
  onPick,
  aspectClass = 'aspect-[5/3]',
  pickEntity = 'elemento',
  modalConfirmLabel,
  modalDescription = 'Anteprima a schermo intero. Puoi applicare la scelta dalla finestra o chiudere e selezionarne un altro.',
  previewSrc,
  previewModalSrc,
  preview,
  modalPreview,
}) => {
  const [imgFailed, setImgFailed] = useState(false)
  const [modalImgFailed, setModalImgFailed] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const usesImage = Boolean(previewSrc)
  const canEnlarge = usesImage ? !imgFailed : Boolean(preview)

  useEffect(() => {
    if (previewOpen) setModalImgFailed(false)
  }, [previewOpen])

  const confirmLabel = modalConfirmLabel ?? `Usa questo ${pickEntity}`

  return (
    <>
      <div className={cn(pickButtonClass(selected), 'group')}>
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-md border border-slate-200/80 bg-slate-100',
            aspectClass,
          )}
        >
          {usesImage ? (
            imgFailed ? (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 to-slate-200 px-2 text-center text-[0.625rem] font-semibold leading-snug text-slate-500 sm:text-[11px]">
                Anteprima in arrivo
              </div>
            ) : (
              <img
                src={previewSrc}
                alt=""
                className={cn(previewPickHoverScaleClass, 'object-cover')}
                loading="lazy"
                onError={() => setImgFailed(true)}
              />
            )
          ) : (
            <div className={previewPickHoverScaleClass}>{preview}</div>
          )}

          {canEnlarge && (
            <div
              className="pointer-events-none absolute inset-0 z-[5] bg-black/35 opacity-0 transition-opacity duration-200 [@media(hover:hover)]:group-hover:opacity-100"
              aria-hidden
            />
          )}

          <button
            type="button"
            disabled={disabled}
            className={cn(
              'absolute inset-0 z-[1] cursor-pointer border-0 bg-transparent p-0',
              previewPickFocusRingClass,
              disabled && 'cursor-not-allowed',
            )}
            aria-label={`Seleziona ${pickEntity} usando anteprima: ${label}`}
            onClick={onPick}
          />

          {canEnlarge && (
            <button
              type="button"
              disabled={disabled}
              className={cn(previewPickEyeButtonClass, previewPickFocusRingClass, disabled && 'cursor-not-allowed opacity-40')}
              aria-haspopup="dialog"
              aria-expanded={previewOpen}
              aria-label={`Ingrandisci anteprima: ${label}`}
              onClick={(e) => {
                e.stopPropagation()
                setPreviewOpen(true)
              }}
            >
              <Eye
                className="size-3 shrink-0 sm:size-5 [@media(pointer:coarse)]:size-3"
                strokeWidth={2}
                aria-hidden
              />
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={disabled}
          className={cn(
            'line-clamp-2 min-h-[1.5em] w-full cursor-pointer border-0 bg-transparent px-px text-center text-[0.625rem] leading-snug sm:text-[11px]',
            mutedLabel ? 'font-medium text-slate-400' : 'font-semibold text-slate-700',
            previewPickFocusRingClass,
            disabled && 'cursor-not-allowed opacity-65',
          )}
          aria-label={`Seleziona ${pickEntity}: ${label}`}
          onClick={onPick}
        >
          {label}
        </button>
      </div>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={label}
        size="2xl"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{modalDescription}</p>
          <div className="flex justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {usesImage ? (
              modalImgFailed ? (
                <div className="flex min-h-[12rem] w-full items-center justify-center px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  Anteprima non disponibile
                </div>
              ) : (
                <img
                  src={previewModalSrc ?? previewSrc}
                  alt=""
                  className="max-h-[min(78vh,880px)] w-full object-contain"
                  loading="eager"
                  onError={() => setModalImgFailed(true)}
                />
              )
            ) : (
              modalPreview
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Chiudi
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={disabled}
              onClick={() => {
                onPick()
                setPreviewOpen(false)
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export function RestaurantSettingsIntro() {
  return (
    <div className={restaurantSettingsIntroCardClass}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-primary-700 bg-primary-600 shadow-lg">
        <Store className="h-7 w-7 text-white" />
      </div>
      <div className="min-w-0 text-center">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Impostazioni locale</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Modifica i dati visualizzati nella pagina Prenotazioni e nel Calendario.
        </p>
      </div>
    </div>
  )
}

export const RestaurantSettingsTab: React.FC = () => {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()
  const { registerUnsavedSource, registerUnsavedHandlers, clearUnsavedSource, confirmNavigation } =
    useUnsavedChangesGuard()
  const features = useFeatures()

  const nameQuery = useRestaurantSetting('restaurant_name')
  const slotGuestCapacitiesQuery = useRestaurantSetting('slot_guest_capacities', {
    authenticated: true,
  })
  const timeSlotsEnabledQuery = useRestaurantSetting('booking_time_slots_enabled', {
    authenticated: true,
  })
  const slotLimitEnabledQuery = useRestaurantSetting('slot_limit_enabled', {
    authenticated: true,
  })
  const rejectOutOfSlotQuery = useRestaurantSetting('booking_reject_out_of_slot', {
    authenticated: true,
  })
  const serviceSlotsQuery = useServiceSlots()
  const updateServiceSlot = useUpdateServiceSlot()
  const createServiceSlot = useCreateServiceSlot()
  const deleteServiceSlot = useDeleteServiceSlot()
  const hoursQuery = useRestaurantSetting('business_hours')
  const contactEmailQuery = useRestaurantSetting('contact_email')
  const contactPhoneQuery = useRestaurantSetting('contact_phone')
  const contactAddressQuery = useRestaurantSetting('contact_address')
  const publicBookingPageBgQuery = useRestaurantSetting('public_booking_page_background')
  const stripPhotoQuery = useRestaurantSetting('public_booking_strip_photo')
  const appThemeQuery = useRestaurantSetting('app_theme', { authenticated: true })
  const upsert = useUpsertRestaurantSetting()
  const { attentionFieldKey, clearAttentionField, focusFirstValidationIssue } =
    useFormValidationAttention({ errorFieldIds: SETTINGS_ERROR_FIELD_IDS })

  const [publicSaveConfirmOpen, setPublicSaveConfirmOpen] = useState(false)
  const formConfigPanelRef = useRef<BookingFormConfigPanelHandle>(null)
  const [formPanelDirty, setFormPanelDirty] = useState(false)
  const formPanelDirtyRef = useRef(false)
  formPanelDirtyRef.current = formPanelDirty
  const [anagraficaDirty, setAnagraficaDirty] = useState(false)
  const [hoursDirty, setHoursDirty] = useState(false)
  const [themeDirty, setThemeDirty] = useState(false)
  const [slotsDirty, setSlotsDirty] = useState(false)
  const anagraficaFooterDirty = SETTINGS_AUTOSAVE_ENABLED ? false : anagraficaDirty
  const dirty = anagraficaFooterDirty || hoursDirty || themeDirty || slotsDirty
  const combinedDirty = dirty || formPanelDirty
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const combinedSaveInFlightRef = useRef(false)
  const bookingBgDirtyRef = useRef(false)
  const [restaurantName, setRestaurantName] = useState('')
  const [slotCapacities, setSlotCapacities] = useState<Record<string, number | ''>>({})
  const [editingSlots, setEditingSlots] = useState<EditingSlot[]>([])
  /** Snapshot degli id delle fasce caricate dal DB al primo hydrate. Serve a rilevare le fasce
   *  rimosse dall'utente: id presenti qui ma assenti in editingSlots al Salva → DELETE su DB. */
  const [initialSlotIds, setInitialSlotIds] = useState<string[]>([])
  const [deleteConfirmSlot, setDeleteConfirmSlot] = useState<EditingSlot | null>(null)
  const tempSlotCounterRef = useRef(0)
  const [timeSlotsEnabled, setTimeSlotsEnabled] = useState(true)
  const [timeSlotsHelpOpen, setTimeSlotsHelpOpen] = useState(false)
  // Interruttore globale limiti coperti per-fascia: ON = blocca la pagina pubblica quando la fascia è
  // piena; OFF/non configurato = nessun blocco (i valori per fascia restano inerti). Default false.
  const [slotLimitEnabled, setSlotLimitEnabled] = useState(false)
  // Vincolo orario: ON = la pagina pubblica rifiuta gli orari fuori da ogni fascia. Default false.
  const [rejectOutOfSlot, setRejectOutOfSlot] = useState(false)
  const [slotValidationError, setSlotValidationError] = useState<string | null>(null)
  const [businessHours, setBusinessHours] = useState<BusinessHours>(() => getDefaultBusinessHours())
  const businessHoursValidationError = validateBusinessHours(businessHours)
  const combinedSaveDisabled = upsert.isPending || !tenantId
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [bookingPageBackground, setBookingPageBackground] =
    useState<BookingPageBackgroundId>(DEFAULT_BOOKING_PAGE_BACKGROUND)
  const [bookingBgMode, setBookingBgMode] = useState<'strip' | 'full'>('strip')
  const [stripPhoto, setStripPhoto] = useState<BookingStripPhotoId | null>(null)
  const [appTheme, setAppTheme] = useState<AppThemeId>(DEFAULT_APP_THEME)
  const [settingsTab, setSettingsTab] = useState<'anagrafica' | 'form'>('anagrafica')

  const hydratedRef = useRef(false)

  const normalizeAnagraficaName = useCallback(
    (v: string) => stripDirectionalFormattingChars(v).slice(0, RESTAURANT_NAME_MAX_LENGTH),
    [],
  )

  const anagraficaAutosave = useDebouncedSettingsAutosave({
    enabled: SETTINGS_AUTOSAVE_ENABLED,
    tenantId,
    fields: {
      restaurant_name: {
        value: restaurantName,
        baseline: normalizeAnagraficaName(String(nameQuery.data ?? '')),
        normalize: normalizeAnagraficaName,
      },
      contact_email: {
        value: contactEmail,
        baseline: stripDirectionalFormattingChars(contactEmailQuery.data ?? ''),
        normalize: stripDirectionalFormattingChars,
      },
      contact_phone: {
        value: contactPhone,
        baseline: stripDirectionalFormattingChars(contactPhoneQuery.data ?? ''),
        normalize: stripDirectionalFormattingChars,
      },
      contact_address: {
        value: contactAddress,
        baseline: stripDirectionalFormattingChars(contactAddressQuery.data ?? ''),
        normalize: stripDirectionalFormattingChars,
      },
    },
    onSave: async (keys) => {
      if (!tenantId) return
      const items: { key: 'restaurant_name' | 'contact_email' | 'contact_phone' | 'contact_address'; value: string }[] =
        []
      if (keys.includes('restaurant_name')) {
        const safeName = normalizeAnagraficaName(restaurantName)
        setRestaurantName(safeName)
        items.push({ key: 'restaurant_name', value: safeName })
      }
      if (keys.includes('contact_email')) {
        const safeEmail = stripDirectionalFormattingChars(contactEmail)
        setContactEmail(safeEmail)
        items.push({ key: 'contact_email', value: safeEmail })
      }
      if (keys.includes('contact_phone')) {
        const safePhone = stripDirectionalFormattingChars(contactPhone)
        setContactPhone(safePhone)
        items.push({ key: 'contact_phone', value: safePhone })
      }
      if (keys.includes('contact_address')) {
        const safeAddress = stripDirectionalFormattingChars(contactAddress)
        setContactAddress(safeAddress)
        items.push({ key: 'contact_address', value: safeAddress })
      }
      if (items.length === 0) return
      await upsert.mutateAsync({ items, options: { silent: true } })
      if (!SETTINGS_AUTOSAVE_ENABLED) {
        setAnagraficaDirty(false)
      }
    },
  })

  useEffect(() => {
    hydratedRef.current = false
    setAnagraficaDirty(false)
    setHoursDirty(false)
    setThemeDirty(false)
    setSlotsDirty(false)
    clearUnsavedSource('restaurant-settings')
  }, [tenantId, clearUnsavedSource])

  useEffect(() => {
    registerUnsavedSource('restaurant-settings', 'Impostazioni locale', combinedDirty)
    return () => {
      if (!dirtyRef.current && !formPanelDirtyRef.current) clearUnsavedSource('restaurant-settings')
    }
  }, [clearUnsavedSource, combinedDirty, registerUnsavedSource])

  const savedBookingPageBackground = publicBookingPageBgQuery.data ?? null
  const savedStripPhoto = stripPhotoQuery.data ?? null
  const bookingBgDirty = isAdminBookingBackgroundDirty(
    { stripPhotoId: savedStripPhoto, pageBackground: savedBookingPageBackground },
    { stripPhoto, pageBackground: bookingPageBackground },
  )
  bookingBgDirtyRef.current = bookingBgDirty

  const allSuccess =
    nameQuery.isSuccess &&
    slotGuestCapacitiesQuery.isSuccess &&
    timeSlotsEnabledQuery.isSuccess &&
    slotLimitEnabledQuery.isSuccess &&
    rejectOutOfSlotQuery.isSuccess &&
    serviceSlotsQuery.isSuccess &&
    hoursQuery.isSuccess &&
    contactEmailQuery.isSuccess &&
    contactPhoneQuery.isSuccess &&
    contactAddressQuery.isSuccess &&
    publicBookingPageBgQuery.isSuccess &&
    stripPhotoQuery.isSuccess &&
    appThemeQuery.isSuccess

  useEffect(() => {
    if (!allSuccess || hydratedRef.current) return
    setRestaurantName(
      stripDirectionalFormattingChars(String(nameQuery.data ?? '')).slice(0, RESTAURANT_NAME_MAX_LENGTH)
    )
    const sg = slotGuestCapacitiesQuery.data ?? {}
    const caps: Record<string, number | ''> = {}
    for (const [k, v] of Object.entries(sg)) {
      caps[k] = v == null ? '' : (v as number)
    }
    setSlotCapacities(caps)
    setTimeSlotsEnabled(timeSlotsEnabledQuery.data ?? true)
    setSlotLimitEnabled(slotLimitEnabledQuery.data ?? false)
    setRejectOutOfSlot(rejectOutOfSlotQuery.data ?? false)
    const slots = (serviceSlotsQuery.data ?? [])
      .slice()
      .sort((a: SlotConfig, b: SlotConfig) => a.display_order - b.display_order)
    // Postgres TIME ritorna 'HH:mm:ss'; il form e validateEditingSlots usano 'HH:mm'.
    setEditingSlots(slots.map((s: SlotConfig) => ({
      id: s.id,
      name: s.name,
      start_time: s.start_time.slice(0, 5),
      end_time: s.end_time.slice(0, 5),
      display_order: s.display_order,
    })))
    setInitialSlotIds(slots.map((s: SlotConfig) => s.id))
    setBusinessHours(hoursQuery.data ?? getDefaultBusinessHours())
    setContactEmail(
      clampBookingText(stripDirectionalFormattingChars(contactEmailQuery.data ?? ''), CONTACT_EMAIL_MAX_LENGTH),
    )
    setContactPhone(
      clampBookingText(stripDirectionalFormattingChars(contactPhoneQuery.data ?? ''), CONTACT_PHONE_MAX_LENGTH),
    )
    setContactAddress(
      clampBookingText(stripDirectionalFormattingChars(contactAddressQuery.data ?? ''), CONTACT_ADDRESS_MAX_LENGTH),
    )
    const bgEditor = hydrateAdminBookingBackgroundEditor({
      stripPhotoId: stripPhotoQuery.data ?? null,
      pageBackground: publicBookingPageBgQuery.data ?? null,
    })
    setBookingPageBackground(bgEditor.pageBackground)
    setStripPhoto(bgEditor.stripPhoto)
    setBookingBgMode(bgEditor.mode)
    setAppTheme(appThemeQuery.data ?? DEFAULT_APP_THEME)
    hydratedRef.current = true
  }, [
    allSuccess,
    nameQuery.data,
    slotGuestCapacitiesQuery.data,
    timeSlotsEnabledQuery.data,
    slotLimitEnabledQuery.data,
    rejectOutOfSlotQuery.data,
    serviceSlotsQuery.data,
    hoursQuery.data,
    contactEmailQuery.data,
    contactPhoneQuery.data,
    contactAddressQuery.data,
    publicBookingPageBgQuery.data,
    stripPhotoQuery.data,
    appThemeQuery.data,
  ])

  const loading =
    nameQuery.isPending ||
    slotGuestCapacitiesQuery.isPending ||
    timeSlotsEnabledQuery.isPending ||
    slotLimitEnabledQuery.isPending ||
    rejectOutOfSlotQuery.isPending ||
    serviceSlotsQuery.isPending ||
    hoursQuery.isPending ||
    contactEmailQuery.isPending ||
    contactPhoneQuery.isPending ||
    contactAddressQuery.isPending ||
    publicBookingPageBgQuery.isPending ||
    stripPhotoQuery.isPending ||
    appThemeQuery.isPending

  const loadError =
    nameQuery.error ||
    slotGuestCapacitiesQuery.error ||
    timeSlotsEnabledQuery.error ||
    serviceSlotsQuery.error ||
    hoursQuery.error ||
    contactEmailQuery.error ||
    contactPhoneQuery.error ||
    contactAddressQuery.error ||
    publicBookingPageBgQuery.error ||
    stripPhotoQuery.error ||
    appThemeQuery.error

  const clearAllSectionDirty = () => {
    setAnagraficaDirty(false)
    setHoursDirty(false)
    setThemeDirty(false)
    setSlotsDirty(false)
  }

  const hydrateAnagraficaFromQueries = () => {
    setRestaurantName(
      stripDirectionalFormattingChars(String(nameQuery.data ?? '')).slice(0, RESTAURANT_NAME_MAX_LENGTH),
    )
    setContactEmail(
      clampBookingText(stripDirectionalFormattingChars(contactEmailQuery.data ?? ''), CONTACT_EMAIL_MAX_LENGTH),
    )
    setContactPhone(
      clampBookingText(stripDirectionalFormattingChars(contactPhoneQuery.data ?? ''), CONTACT_PHONE_MAX_LENGTH),
    )
    setContactAddress(
      clampBookingText(stripDirectionalFormattingChars(contactAddressQuery.data ?? ''), CONTACT_ADDRESS_MAX_LENGTH),
    )
  }

  const hydrateHoursFromQueries = () => {
    setBusinessHours(hoursQuery.data ?? getDefaultBusinessHours())
  }

  const hydrateThemeFromQueries = () => {
    setAppTheme(appThemeQuery.data ?? DEFAULT_APP_THEME)
  }

  const hydrateSlotsFromQueries = () => {
    const sg = slotGuestCapacitiesQuery.data ?? {}
    const caps: Record<string, number | ''> = {}
    for (const [k, v] of Object.entries(sg)) {
      caps[k] = v == null ? '' : (v as number)
    }
    setSlotCapacities(caps)
    setTimeSlotsEnabled(timeSlotsEnabledQuery.data ?? true)
    setSlotLimitEnabled(slotLimitEnabledQuery.data ?? false)
    setRejectOutOfSlot(rejectOutOfSlotQuery.data ?? false)
    const slots = (serviceSlotsQuery.data ?? [])
      .slice()
      .sort((a: SlotConfig, b: SlotConfig) => a.display_order - b.display_order)
    setEditingSlots(
      slots.map((s: SlotConfig) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
        display_order: s.display_order,
      })),
    )
    setInitialSlotIds(slots.map((s: SlotConfig) => s.id))
    setSlotValidationError(null)
  }

  const hydrateLocalSettingsFromQueries = () => {
    hydrateAnagraficaFromQueries()
    hydrateSlotsFromQueries()
    hydrateHoursFromQueries()
    const bgEditor = hydrateAdminBookingBackgroundEditor({
      stripPhotoId: stripPhotoQuery.data ?? null,
      pageBackground: publicBookingPageBgQuery.data ?? null,
    })
    setBookingPageBackground(bgEditor.pageBackground)
    setStripPhoto(bgEditor.stripPhoto)
    setBookingBgMode(bgEditor.mode)
    hydrateThemeFromQueries()
  }

  const handleCancelChanges = () => {
    anagraficaAutosave.cancelPending()
    hydrateLocalSettingsFromQueries()
    clearAllSectionDirty()
  }

  const handleCombinedDiscard = () => {
    handleCancelChanges()
    formConfigPanelRef.current?.discardAll()
  }

  const handleCombinedSave = async () => {
    if (combinedSaveInFlightRef.current || upsert.isPending) {
      throw new Error('Combined save already in progress')
    }
    combinedSaveInFlightRef.current = true
    try {
      if (dirtyRef.current) {
        const settingsSaved = await handleSave()
        if (!settingsSaved) throw new Error('Settings validation failed')
      }
      await formConfigPanelRef.current?.saveAll()
    } finally {
      combinedSaveInFlightRef.current = false
    }
  }

  const refetchRestaurantSettings = async () => {
    await queryClient.refetchQueries({ queryKey: ['restaurant_settings'], type: 'active' })
  }

  const persistServiceSlots = async (): Promise<Record<string, string>> => {
    const createdSlotIdMap: Record<string, string> = {}
    if (features.servizio) return createdSlotIdMap

    const currentIds = new Set(editingSlots.map((s) => s.id))
    const toDelete = initialSlotIds.filter((id) => !currentIds.has(id))
    if (toDelete.length > 0) {
      await Promise.all(toDelete.map((id) => deleteServiceSlot.mutateAsync(id)))
    }

    const orderedSlots = editingSlots.map((s, idx) => ({ ...s, display_order: idx }))
    for (const s of orderedSlots) {
      const safeSlotName =
        stripDirectionalFormattingChars(s.name).trim().slice(0, SLOT_NAME_MAX_LENGTH) || 'Fascia'
      if (isTempSlotId(s.id)) {
        const created = await createServiceSlot.mutateAsync({
          name: safeSlotName,
          start_time: s.start_time,
          end_time: s.end_time,
          max_turns: null,
          max_guests: null,
          display_order: s.display_order,
        })
        createdSlotIdMap[s.id] = created.id
      } else {
        await updateServiceSlot.mutateAsync({
          id: s.id,
          name: safeSlotName,
          start_time: s.start_time,
          end_time: s.end_time,
          display_order: s.display_order,
          skipToast: true,
        })
      }
    }
    await queryClient.invalidateQueries({ queryKey: [SERVICE_SLOTS_QUERY_KEY] })
    return createdSlotIdMap
  }

  const buildSlotCapacitiesPayload = (createdSlotIdMap: Record<string, string>) => {
    const slotCapValue: Record<string, number | null> = {}
    for (const [k, v] of Object.entries(slotCapacities)) {
      const targetId = createdSlotIdMap[k] ?? k
      const stillExists = editingSlots.some((s) => s.id === k || createdSlotIdMap[s.id] === targetId)
      if (!stillExists) continue
      slotCapValue[targetId] = v === '' ? null : (v as number)
    }
    return slotCapValue
  }

  const refreshSlotsStateAfterSave = async (createdSlotIdMap: Record<string, string>) => {
    const refreshedSlots = (await serviceSlotsQuery.refetch()).data ?? []
    const orderedRefreshed = [...refreshedSlots].sort(
      (a: SlotConfig, b: SlotConfig) => a.display_order - b.display_order,
    )
    setEditingSlots(
      orderedRefreshed.map((s: SlotConfig) => ({
        id: s.id,
        name: s.name,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5),
        display_order: s.display_order,
      })),
    )
    setInitialSlotIds(orderedRefreshed.map((s: SlotConfig) => s.id))
    setSlotCapacities((prev) => {
      const next: Record<string, number | ''> = {}
      for (const [k, v] of Object.entries(prev)) {
        const targetId = createdSlotIdMap[k] ?? k
        if (orderedRefreshed.some((s: SlotConfig) => s.id === targetId)) {
          next[targetId] = v
        }
      }
      return next
    })
  }

  const handleSaveBookingBackgroundOnly = async () => {
    if (!tenantId) return
    await upsert.mutateAsync([
      { key: 'public_booking_page_background', value: bookingPageBackground },
      { key: 'public_booking_strip_photo', value: stripPhoto },
    ])
    await queryClient.refetchQueries({ queryKey: ['restaurant_settings'], type: 'active' })
  }

  const handleCancelBookingBackgroundOnly = () => {
    const bgEditor = hydrateAdminBookingBackgroundEditor({
      stripPhotoId: savedStripPhoto,
      pageBackground: savedBookingPageBackground,
    })
    setBookingPageBackground(bgEditor.pageBackground)
    setStripPhoto(bgEditor.stripPhoto)
    setBookingBgMode(bgEditor.mode)
  }

  const handleRestaurantNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!SETTINGS_AUTOSAVE_ENABLED) setAnagraficaDirty(true)
    const next = normalizeAnagraficaName(event.target.value)
    setRestaurantName(next)
    anagraficaAutosave.notifyFieldChange('restaurant_name')
  }

  // ---- Gestione fasce orarie (solo Classic) ----------------------------------
  const handleAddSlot = () => {
    setSlotsDirty(true)
    const nextOrder = editingSlots.length === 0
      ? 0
      : Math.max(...editingSlots.map((s) => s.display_order)) + 1
    const baseName = 'Nuova fascia'
    const existingNames = new Set(editingSlots.map((s) => s.name))
    let candidateName = baseName
    let counter = 2
    while (existingNames.has(candidateName)) {
      candidateName = `${baseName} ${counter}`
      counter += 1
    }
    tempSlotCounterRef.current += 1
    const tempId = `${TEMP_SLOT_ID_PREFIX}${tempSlotCounterRef.current}-${Date.now()}`
    setEditingSlots((prev) => [
      ...prev,
      { id: tempId, name: candidateName, start_time: '12:00', end_time: '14:00', display_order: nextOrder },
    ])
  }

  const handleSlotNameChange = (slotId: string, raw: string) => {
    setSlotsDirty(true)
    const safe = stripDirectionalFormattingChars(raw).slice(0, SLOT_NAME_MAX_LENGTH)
    setEditingSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, name: safe } : s)))
  }

  /** Riordino manuale fasce (FIX 3, 16-06-26): frecce Su/Giù, come ordine categorie Menu QR — niente
   *  drag&drop riusabile in app. display_order persistito riassegnato come index al Salva da
   *  `persistServiceSlots()`; le capienze restano agganciate perché indicizzate per `id`, non per
   *  posizione. */
  const moveSlotUp = (idx: number) => {
    if (idx <= 0) return
    setSlotsDirty(true)
    setEditingSlots((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveSlotDown = (idx: number) => {
    setSlotsDirty(true)
    setEditingSlots((prev) => {
      if (idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  const handleRequestRemoveSlot = (slot: EditingSlot) => {
    setDeleteConfirmSlot(slot)
  }

  const handleConfirmRemoveSlot = () => {
    if (!deleteConfirmSlot) return
    setSlotsDirty(true)
    const removedId = deleteConfirmSlot.id
    setEditingSlots((prev) => prev.filter((s) => s.id !== removedId))
    // Pulisce anche la capacity associata se presente
    setSlotCapacities((prev) => {
      if (!(removedId in prev)) return prev
      const next = { ...prev }
      delete next[removedId]
      return next
    })
    setDeleteConfirmSlot(null)
  }

  const getSettingsValidationIssue = (): SettingsValidationIssue | null => {
    // FIX 4 (16-06-26): priorità = ordine visivo top-down della pagina (nome → orari → fasce), non
    // ordine dei controlli — scroll+pulse devono portare l'utente al PRIMO campo che vede, non al
    // primo controllo che fallisce nel codice.
    if (!restaurantName.trim()) {
      return { key: 'restaurant_name', message: 'Il nome del ristorante è obbligatorio' }
    }
    if (businessHoursValidationError) {
      return { key: 'business_hours', message: businessHoursValidationError }
    }
    if (!features.servizio && timeSlotsEnabled) {
      const slotsValidationError = validateEditingSlots(editingSlots)
      if (slotsValidationError) return { key: 'time_slots', message: slotsValidationError }
    }
    return null
  }

  const reportSettingsValidationIssue = (issue: SettingsValidationIssue) => {
    if (issue.key === 'time_slots') {
      setSlotValidationError(issue.message)
    }
    toast.error(issue.message)
    focusFirstValidationIssue(issue.key)
  }

  const handleFooterSaveClick = () => {
    if (dirtyRef.current) {
      const validationIssue = getSettingsValidationIssue()
      if (validationIssue) {
        reportSettingsValidationIssue(validationIssue)
        return
      }
    }
    setPublicSaveConfirmOpen(true)
  }

  const handleSave = async (): Promise<boolean> => {
    const validationIssue = getSettingsValidationIssue()
    if (validationIssue) {
      reportSettingsValidationIssue(validationIssue)
      return false
    }
    setSlotValidationError(null)

    const safeName = normalizeAnagraficaName(restaurantName)
    const safeEmail = clampBookingText(stripDirectionalFormattingChars(contactEmail), CONTACT_EMAIL_MAX_LENGTH)
    const safePhone = clampBookingText(stripDirectionalFormattingChars(contactPhone), CONTACT_PHONE_MAX_LENGTH)
    const safeAddress = clampBookingText(stripDirectionalFormattingChars(contactAddress), CONTACT_ADDRESS_MAX_LENGTH)

    setRestaurantName(safeName)
    setContactEmail(safeEmail)
    setContactPhone(safePhone)
    setContactAddress(safeAddress)

    const createdSlotIdMap = await persistServiceSlots()
    const slotCapValue = buildSlotCapacitiesPayload(createdSlotIdMap)

    await upsert.mutateAsync([
      { key: 'restaurant_name', value: safeName },
      { key: 'slot_guest_capacities', value: slotCapValue },
      { key: 'booking_time_slots_enabled', value: timeSlotsEnabled },
      { key: 'slot_limit_enabled', value: slotLimitEnabled },
      { key: 'booking_reject_out_of_slot', value: rejectOutOfSlot },
      { key: 'business_hours', value: businessHours },
      { key: 'contact_email', value: safeEmail },
      { key: 'contact_phone', value: safePhone },
      { key: 'contact_address', value: safeAddress },
      ...(bookingBgDirty
        ? ([
            { key: 'public_booking_page_background' as const, value: bookingPageBackground },
            { key: 'public_booking_strip_photo' as const, value: stripPhoto },
          ] as const)
        : []),
      { key: 'app_theme', value: appTheme },
    ])
    await refetchRestaurantSettings()

    if (!features.servizio) {
      await refreshSlotsStateAfterSave(createdSlotIdMap)
    }

    setSlotValidationError(null)
    clearAllSectionDirty()
    return true
  }

  useEffect(() => {
    registerUnsavedHandlers('restaurant-settings', {
      saveAll: handleCombinedSave,
      discardAll: handleCombinedDiscard,
    })
    return () => registerUnsavedHandlers('restaurant-settings', null)
  }, [handleCombinedDiscard, handleCombinedSave, registerUnsavedHandlers])

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {(loadError as Error).message || 'Errore nel caricamento delle impostazioni.'}
      </div>
    )
  }

  if (loading && !allSuccess) {
    return (
      <div className="flex items-center justify-center gap-3 py-20 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin" />
        Caricamento impostazioni…
      </div>
    )
  }

  const sectionSurfaceClass =
    'admin-warm-surface w-full max-w-2xl mx-auto space-y-4 rounded-xl border p-5 md:p-7 shadow-md text-center'
  /** Larghezza campi anagrafica: base 14rem, due incrementi +1/3 → ×(4/3)² = ×16/9 */
  const anagraficaFieldWrapClass =
    'mx-auto w-full min-w-0 max-w-[calc(14rem_*_16_/_9)] space-y-2'
  /** Spazio verticale tra i blocchi (inline: non dipende dalle utilities Tailwind arbitrary). */
  const anagraficaFieldStackStyle: React.CSSProperties = { marginTop: '1.75rem' }
  /** text-xl (1.25rem) ridotto di 1/6 → calc(1.25rem * 5/6) */
  const anagraficaInputClassName =
    'block w-full min-h-[3.667rem] rounded-[1.25rem] border-2 border-slate-200 bg-white px-4 py-2.5 text-center text-[calc(1.25rem_*_5_/_6)] font-medium leading-snug text-slate-900 shadow-sm outline-none placeholder:text-slate-400 placeholder:text-[calc(1.25rem_*_5_/_6)] transition-colors duration-150 focus:border-primary-400 focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:bg-white disabled:text-slate-500 disabled:opacity-80'

  const bookingBgBase = import.meta.env.BASE_URL

  const bookingBgPickButtonClass = (selected: boolean) =>
    [
      'flex min-h-0 flex-col gap-1 rounded-lg border-2 bg-white/85 p-1.5 text-center shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 sm:focus-visible:ring-offset-2',
      selected ? 'border-emerald-600 ring-2 ring-emerald-600/80 ring-offset-1 sm:ring-offset-2' : 'border-slate-200 hover:border-slate-300',
      upsert.isPending ? 'pointer-events-none opacity-65' : '',
    ]
      .filter(Boolean)
      .join(' ')

  const bookingBgSectionClass =
    'admin-warm-surface w-full space-y-4 rounded-xl border p-5 shadow-sm text-center'
  const bookingBgGridTopSpacingStyle: React.CSSProperties = { marginTop: '1.375rem' }
  const bookingBgModeButtonClass = (active: boolean) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-65',
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'bg-white text-slate-700 hover:bg-slate-50',
    )

  const appThemeSectionClass =
    'admin-warm-surface w-full max-w-3xl mx-auto space-y-4 rounded-xl border p-5 md:p-7 shadow-md text-center'

  const switchSettingsTab = (next: 'anagrafica' | 'form') => {
    if (settingsTab === next) return
    void confirmNavigation().then((ok) => {
      if (ok) setSettingsTab(next)
    })
  }

  const bookingPageBackgroundSection = (
    <section className={bookingBgSectionClass}>
      <h3 className="text-base font-semibold text-slate-800">Sfondo pagina Prenota</h3>
      <p className="text-sm text-slate-600">
        Scegli se usare una foto nella striscia laterale sinistra oppure uno sfondo a pagina intera.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={upsert.isPending}
          className={bookingBgModeButtonClass(bookingBgMode === 'strip')}
          onClick={() => {
            setBookingBgMode('strip')
            setStripPhoto((current) => current ?? savedStripPhoto ?? DEFAULT_BOOKING_STRIP_PHOTO)
          }}
        >
          Striscia laterale
        </button>
        <button
          type="button"
          disabled={upsert.isPending}
          className={bookingBgModeButtonClass(bookingBgMode === 'full')}
          onClick={() => {
            setBookingBgMode('full')
            setStripPhoto(null)
            setBookingPageBackground((current) =>
              String(current).startsWith('full-') ? current : DEFAULT_BOOKING_FULL_PAGE_BACKGROUND,
            )
          }}
        >
          Pagina intera
        </button>
      </div>

      {bookingBgMode === 'strip' ? (
        <div
          className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2 sm:gap-2.5"
          style={bookingBgGridTopSpacingStyle}
        >
          {BOOKING_STRIP_PHOTO_IDS.map((id, idx) => {
            const href = bookingStripPhotoPublicHref(id, bookingBgBase)
            const label = `Foto ${idx + 1}`
            return (
              <SettingsPreviewPickCard
                key={id}
                label={label}
                mutedLabel
                selected={stripPhoto === id}
                disabled={upsert.isPending}
                pickButtonClass={bookingBgPickButtonClass}
                aspectClass="aspect-[1/3]"
                pickEntity="foto laterale"
                modalConfirmLabel="Usa questa foto laterale"
                previewSrc={href}
                previewModalSrc={href}
                onPick={() => {
                  setStripPhoto(id)
                  setBookingBgMode('strip')
                }}
              />
            )
          })}
        </div>
      ) : (
        <div
          className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5"
          style={bookingBgGridTopSpacingStyle}
        >
          {BOOKING_FULL_PAGE_BACKGROUND_IDS.map((id, idx) => {
            const href = bookingFullPageBackgroundPublicHref(id, bookingBgBase)
            return (
              <SettingsPreviewPickCard
                key={id}
                label={`Sfondo ${idx + 1}`}
                selected={bookingPageBackground === id && stripPhoto == null}
                disabled={upsert.isPending}
                pickButtonClass={bookingBgPickButtonClass}
                aspectClass="aspect-[4/3]"
                pickEntity="sfondo pagina intera"
                modalConfirmLabel="Usa a pagina intera"
                previewSrc={href}
                previewModalSrc={href}
                onPick={() => {
                  setBookingPageBackground(id)
                  setStripPhoto(null)
                  setBookingBgMode('full')
                }}
              />
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* Tab pill: Anagrafica Azienda / Personalizza Form */}
      <div className="flex gap-1.5 rounded-xl bg-slate-100 p-0.5 self-start">
        <button
          type="button"
          onClick={() => switchSettingsTab('anagrafica')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            settingsTab === 'anagrafica'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Anagrafica Azienda
        </button>
        <button
          type="button"
          onClick={() => switchSettingsTab('form')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
            settingsTab === 'form'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Personalizza Form
        </button>
      </div>

      {settingsTab === 'form' && (
        <BookingFormConfigPanel
          ref={formConfigPanelRef}
          hideSaveUi
          onDirtyChange={setFormPanelDirty}
          afterBookingModesSection={
            bookingPageBackgroundSection
          }
          bookingBgDirty={bookingBgDirty}
          onSaveBookingBackground={handleSaveBookingBackgroundOnly}
          onCancelBookingBackground={handleCancelBookingBackgroundOnly}
        />
      )}

      {settingsTab === 'anagrafica' && (
      <React.Fragment>
      <div className="w-full max-w-2xl mx-auto">
      <section className={sectionSurfaceClass}>
        <h3 className="text-lg font-semibold text-slate-800">Anagrafica Azienda</h3>
        <div className="flex w-full flex-col items-center">
          <div
            id={SETTINGS_ERROR_FIELD_IDS.restaurant_name}
            className={cn(
              anagraficaFieldWrapClass,
              'rounded-2xl',
              getFormFieldAttentionProps('restaurant_name', attentionFieldKey, clearAttentionField).className,
            )}
            onPointerDown={
              getFormFieldAttentionProps('restaurant_name', attentionFieldKey, clearAttentionField).onPointerDown
            }
          >
            <Label htmlFor="restaurant_name" className="block w-full text-center">
              Nome ristorante
            </Label>
            <input
              id="restaurant_name"
              name="restaurant_name"
              type="text"
              maxLength={RESTAURANT_NAME_MAX_LENGTH}
              dir="ltr"
              autoComplete="off"
              value={typeof restaurantName === 'string' ? restaurantName : ''}
              disabled={upsert.isPending}
              onChange={handleRestaurantNameChange}
              onBlur={() => anagraficaAutosave.flushField('restaurant_name')}
              placeholder="Nome del locale"
              className={anagraficaInputClassName}
              style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
            />
            <p
              className={cn(
                'text-right text-[11px] tabular-nums',
                restaurantName.length >= RESTAURANT_NAME_MAX_LENGTH ? 'text-red-500' : 'text-slate-400',
              )}
            >
              {restaurantName.length}/{RESTAURANT_NAME_MAX_LENGTH}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={anagraficaAutosave.fieldStatus.restaurant_name} />
            ) : null}
          </div>
          <div className={anagraficaFieldWrapClass} style={anagraficaFieldStackStyle}>
            <Label htmlFor="contact_email" className="block w-full text-center">
              Email contatto
            </Label>
            <Input
              id="contact_email"
              type="email"
              value={contactEmail}
              disabled={upsert.isPending}
              className={anagraficaInputClassName}
              onChange={(e) => {
                if (!SETTINGS_AUTOSAVE_ENABLED) setAnagraficaDirty(true)
                setContactEmail(
                  clampBookingText(stripDirectionalFormattingChars(e.target.value), CONTACT_EMAIL_MAX_LENGTH),
                )
                anagraficaAutosave.notifyFieldChange('contact_email')
              }}
              onBlur={() => anagraficaAutosave.flushField('contact_email')}
              placeholder="ristorante@example.com"
              maxLength={CONTACT_EMAIL_MAX_LENGTH}
            />
            <p
              className={cn(
                'text-right text-[11px] tabular-nums',
                contactEmail.length >= CONTACT_EMAIL_MAX_LENGTH ? 'text-red-500' : 'text-slate-400',
              )}
            >
              {contactEmail.length}/{CONTACT_EMAIL_MAX_LENGTH}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={anagraficaAutosave.fieldStatus.contact_email} />
            ) : null}
          </div>
          <div className={anagraficaFieldWrapClass} style={anagraficaFieldStackStyle}>
            <Label htmlFor="contact_phone" className="block w-full text-center">
              Telefono contatto
            </Label>
            <Input
              id="contact_phone"
              value={contactPhone}
              disabled={upsert.isPending}
              className={anagraficaInputClassName}
              onChange={(e) => {
                if (!SETTINGS_AUTOSAVE_ENABLED) setAnagraficaDirty(true)
                setContactPhone(
                  clampBookingText(stripDirectionalFormattingChars(e.target.value), CONTACT_PHONE_MAX_LENGTH),
                )
                anagraficaAutosave.notifyFieldChange('contact_phone')
              }}
              onBlur={() => anagraficaAutosave.flushField('contact_phone')}
              placeholder="+39 ..."
              maxLength={CONTACT_PHONE_MAX_LENGTH}
            />
            <p
              className={cn(
                'text-right text-[11px] tabular-nums',
                contactPhone.length >= CONTACT_PHONE_MAX_LENGTH ? 'text-red-500' : 'text-slate-400',
              )}
            >
              {contactPhone.length}/{CONTACT_PHONE_MAX_LENGTH}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={anagraficaAutosave.fieldStatus.contact_phone} />
            ) : null}
          </div>
          <div className={anagraficaFieldWrapClass} style={anagraficaFieldStackStyle}>
            <Label htmlFor="contact_address" className="block w-full text-center">
              Indirizzo contatto
            </Label>
            <Input
              id="contact_address"
              value={contactAddress}
              disabled={upsert.isPending}
              className={anagraficaInputClassName}
              onChange={(e) => {
                if (!SETTINGS_AUTOSAVE_ENABLED) setAnagraficaDirty(true)
                setContactAddress(
                  clampBookingText(stripDirectionalFormattingChars(e.target.value), CONTACT_ADDRESS_MAX_LENGTH),
                )
                anagraficaAutosave.notifyFieldChange('contact_address')
              }}
              onBlur={() => anagraficaAutosave.flushField('contact_address')}
              placeholder="Via ..., Citta, CAP"
              maxLength={CONTACT_ADDRESS_MAX_LENGTH}
            />
            <p
              className={cn(
                'text-right text-[11px] tabular-nums',
                contactAddress.length >= CONTACT_ADDRESS_MAX_LENGTH ? 'text-red-500' : 'text-slate-400',
              )}
            >
              {contactAddress.length}/{CONTACT_ADDRESS_MAX_LENGTH}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={anagraficaAutosave.fieldStatus.contact_address} />
            ) : null}
          </div>
        </div>
      </section>
      </div>

      <div
        id={SETTINGS_ERROR_FIELD_IDS.business_hours}
        className="w-full max-w-2xl mx-auto rounded-xl"
      >
      <section
        className={cn(
          sectionSurfaceClass,
          getFormFieldAttentionProps('business_hours', attentionFieldKey, clearAttentionField).className,
        )}
        onPointerDown={
          getFormFieldAttentionProps('business_hours', attentionFieldKey, clearAttentionField).onPointerDown
        }
      >
        <h3 className="text-lg font-semibold text-slate-800">Orari di apertura</h3>
        <p className="text-sm text-slate-600">
          Modifica gli orari visibili al pubblico nella pagina di Prenotazione.
        </p>
        <BusinessHoursEditor
          value={businessHours}
          disabled={upsert.isPending}
          onChange={(next) => {
            setHoursDirty(true)
            setBusinessHours(next)
          }}
        />
      </section>
      </div>

      {!features.servizio && (
      <div
        id={SETTINGS_ERROR_FIELD_IDS.time_slots}
        className="w-full max-w-2xl mx-auto rounded-xl"
      >
      <section
        className={cn(
          sectionSurfaceClass,
          getFormFieldAttentionProps('time_slots', attentionFieldKey, clearAttentionField).className,
        )}
        onPointerDown={
          getFormFieldAttentionProps('time_slots', attentionFieldKey, clearAttentionField).onPointerDown
        }
      >
        <div className="mb-5 w-full space-y-1.5 md:mb-6">
          <h3 className="text-center text-lg font-semibold leading-tight text-slate-800">
            Imposta Fasce Orarie
          </h3>
          <div className="flex w-full items-center justify-between gap-3">
            <button
              type="button"
              aria-label={timeSlotsHelpOpen ? 'Nascondi informazioni fasce orarie' : 'Mostra informazioni fasce orarie'}
              aria-expanded={timeSlotsHelpOpen}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold leading-none text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1"
              onClick={() => setTimeSlotsHelpOpen((open) => !open)}
            >
              ?
            </button>
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={timeSlotsEnabled}
                disabled={upsert.isPending}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                onChange={(e) => {
                  setSlotsDirty(true)
                  setTimeSlotsEnabled(e.target.checked)
                }}
              />
              Attiva / Disattiva
            </label>
          </div>
        </div>
        {timeSlotsHelpOpen && (
          <p className="text-sm leading-relaxed text-slate-600">
            Cambia le fasce orarie in cui vengono raggruppate le prenotazioni nel calendario. Puoi
            impostare un numero massimo di coperti per ogni fascia oraria: ti serve come riferimento
            per organizzare il servizio e decidere se accettare le richieste, ma non blocca nulla in
            automatico.
          </p>
        )}

        <div className={cn('flex w-full flex-col items-center gap-4 transition-opacity', !timeSlotsEnabled && 'pointer-events-none opacity-50')}>
          {/* Vincoli verso la pagina pubblica (mai bloccano l'admin). Inerti se la sezione è OFF. */}
          <PublicSlotLimitToggles
            variant="classic"
            slotLimitEnabled={slotLimitEnabled}
            rejectOutOfSlot={rejectOutOfSlot}
            disabled={upsert.isPending}
            onSlotLimitChange={(checked) => {
              setSlotsDirty(true)
              setSlotLimitEnabled(checked)
            }}
            onRejectOutOfSlotChange={(checked) => {
              setSlotsDirty(true)
              setRejectOutOfSlot(checked)
            }}
          />

          {slotValidationError && (
            <div className="mx-auto w-full max-w-[14rem] rounded-[1.25rem] border-2 border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 shadow-sm">
              {slotValidationError}
            </div>
          )}

          {/* Bottone Aggiungi fascia */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddSlot}
            disabled={upsert.isPending}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Aggiungi fascia oraria
          </Button>

          {editingSlots.length === 0 ? (
            <p className="text-sm italic text-slate-500">
              Nessuna fascia configurata. Aggiungi la prima fascia con il pulsante sopra.
            </p>
          ) : null}

          {editingSlots.map((slot, idx) => {
            const crossesMidnight = slotCrossesMidnight({ start_time: slot.start_time, end_time: slot.end_time })
            return (
              <div
                key={slot.id}
                className="w-full rounded-xl border bg-white/75 p-4 text-center shadow-md backdrop-blur-[2px]"
                style={{ borderColor: ADMIN_WARM_BORDER }}
              >
                {/* Riga nome fascia + frecce ordine + bottone elimina */}
                <div className="mb-3 flex items-center justify-center gap-2">
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={upsert.isPending || idx === 0}
                      onClick={() => moveSlotUp(idx)}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label={`Sposta su fascia ${slot.name}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={upsert.isPending || idx === editingSlots.length - 1}
                      onClick={() => moveSlotDown(idx)}
                      className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      aria-label={`Sposta giù fascia ${slot.name}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                  <Input
                    aria-label={`Nome fascia ${idx + 1}`}
                    value={slot.name}
                    maxLength={SLOT_NAME_MAX_LENGTH}
                    disabled={upsert.isPending}
                    placeholder="Nome fascia"
                    className="max-w-xs rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500"
                    onChange={(e) => handleSlotNameChange(slot.id, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRequestRemoveSlot(slot)}
                    disabled={upsert.isPending}
                    aria-label={`Rimuovi fascia ${slot.name}`}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>

                <p className="mb-1 text-xs text-slate-500">
                  {slot.start_time} - {slot.end_time}
                </p>
                {crossesMidnight && (
                  <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-amber-700">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {OVERNIGHT_TIME_END_HINT}
                  </p>
                )}
                <div className="flex w-full flex-row flex-nowrap items-end justify-center gap-4 overflow-x-auto py-1 [scrollbar-width:thin] md:gap-8">
                  <div className="w-[11.5rem] max-w-none shrink-0 space-y-1.5 text-center">
                    <Label htmlFor={`slot_start_${idx}`} className="block w-full text-center">
                      Inizio
                    </Label>
                    <TimePicker24h
                      id={`slot_start_${idx}`}
                      value={slot.start_time}
                      disabled={upsert.isPending}
                      onChange={(v) => {
                        setSlotsDirty(true)
                        setEditingSlots((prev) =>
                          prev.map((s, i) => i === idx ? { ...s, start_time: v } : s)
                        )
                      }}
                    />
                  </div>
                  <div className="w-[11.5rem] max-w-none shrink-0 space-y-1.5 text-center">
                    <Label htmlFor={`slot_end_${idx}`} className="block w-full text-center">
                      Fine
                    </Label>
                    <TimePicker24h
                      id={`slot_end_${idx}`}
                      value={slot.end_time}
                      disabled={upsert.isPending}
                      onChange={(v) => {
                        setSlotsDirty(true)
                        setEditingSlots((prev) =>
                          prev.map((s, i) => i === idx ? { ...s, end_time: v } : s)
                        )
                      }}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Label htmlFor={`slot_cap_${idx}`} className="text-sm text-slate-600 whitespace-nowrap">
                    Coperti max:
                  </Label>
                  <Input
                    id={`slot_cap_${idx}`}
                    type="number"
                    min={1}
                    max={5000}
                    value={slotCapacities[slot.id] ?? ''}
                    disabled={upsert.isPending}
                    placeholder="Nessun limite"
                    className="w-32 rounded-xl border-2 border-slate-200 bg-white px-3 py-1.5 text-center text-sm font-medium text-slate-900 shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onChange={(e) => {
                      setSlotsDirty(true)
                      const raw = e.target.value
                      setSlotCapacities((prev) => ({
                        ...prev,
                        [slot.id]: raw === '' ? '' : parseInt(raw, 10),
                      }))
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Modal di conferma eliminazione fascia */}
        {deleteConfirmSlot && (
          <Modal
            isOpen
            onClose={() => setDeleteConfirmSlot(null)}
            title="Elimina fascia oraria"
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-700">
                Vuoi eliminare la fascia{' '}
                <strong className="font-semibold">{deleteConfirmSlot.name}</strong>
                {' '}({deleteConfirmSlot.start_time} – {deleteConfirmSlot.end_time})?
              </p>
              <p className="text-xs text-slate-500">
                Le prenotazioni che cadono in questa fascia non avranno più raggruppamento dedicato:
                verranno mostrate nella sezione &laquo;Fuori fascia&raquo; del calendario.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteConfirmSlot(null)}
                  disabled={deleteServiceSlot.isPending}
                >
                  Annulla
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleConfirmRemoveSlot}
                  disabled={deleteServiceSlot.isPending}
                >
                  Elimina
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </section>
      </div>
      )}

      {features.servizio && (
      <div className="w-full max-w-2xl mx-auto rounded-xl">
        <section className={sectionSurfaceClass}>
          <div className="mb-5 w-full space-y-1.5 md:mb-6">
            <h3 className="text-center text-lg font-semibold leading-tight text-slate-800">
              Limiti Prenotazioni
            </h3>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">
            Le fasce orarie a cui fanno riferimento i Limiti Prenotazioni, si possono configurare nella
            sezione &quot;Servizio&quot; della sidebar laterale.
          </p>
          <PublicSlotLimitToggles
            variant="pro"
            slotLimitEnabled={slotLimitEnabled}
            rejectOutOfSlot={rejectOutOfSlot}
            disabled={upsert.isPending}
            onSlotLimitChange={(checked) => {
              setSlotsDirty(true)
              setSlotLimitEnabled(checked)
            }}
            onRejectOutOfSlotChange={(checked) => {
              setSlotsDirty(true)
              setRejectOutOfSlot(checked)
            }}
          />
        </section>
      </div>
      )}

      <div className="w-full max-w-3xl mx-auto">
      <section className={appThemeSectionClass} aria-labelledby="app-theme-heading">
        <h3 id="app-theme-heading" className="text-lg font-semibold text-slate-800">
          Selezione tema app
        </h3>
        <p className="text-sm text-slate-600">
          Tocca l&apos;immagine o il nome del tema per selezionarlo subito. Tocca l&apos;icona occhio al centro per l&apos;anteprima
          grande (su desktop compare passando il mouse sull&apos;immagine). Usa il footer in basso a destra per salvare le modifiche al tema.
        </p>
        <div
          className="mx-auto grid w-full max-w-3xl grid-cols-3 gap-2 sm:gap-2.5"
          style={bookingBgGridTopSpacingStyle}
        >
          {APP_THEME_OPTIONS.map((opt) => (
            <SettingsPreviewPickCard
              key={opt.id}
              previewSrc={opt.previewSrc}
              previewModalSrc={opt.previewModalSrc}
              label={opt.label}
              selected={appTheme === opt.id}
              disabled={upsert.isPending}
              pickButtonClass={bookingBgPickButtonClass}
              pickEntity="tema"
              modalConfirmLabel="Usa questo tema"
              modalDescription="Anteprima a schermo intero. Puoi applicare il tema dalla finestra o chiudere e sceglierne un altro."
              onPick={() => {
                setAppTheme(opt.id)
                setThemeDirty(true)
              }}
            />
          ))}
        </div>
      </section>
      </div>
      </React.Fragment>
      )}

      {combinedDirty && (
        <SettingsSaveFooter
          onCancel={handleCombinedDiscard}
          onSave={handleFooterSaveClick}
          pending={upsert.isPending}
          cancelDisabled={upsert.isPending || !combinedDirty}
          saveDisabled={combinedSaveDisabled}
        />
      )}

      <PublicDataSaveConfirmModal
        isOpen={publicSaveConfirmOpen}
        pending={upsert.isPending}
        onConfirm={async () => {
          try {
            await handleCombinedSave()
            setPublicSaveConfirmOpen(false)
          } catch {
            /* toast gestito da useUpsertRestaurantSetting / figlio; modale resta aperta */
          }
        }}
        onCancel={() => setPublicSaveConfirmOpen(false)}
      />

      <p className="mt-6 text-center text-micro text-[var(--color-text-muted)] select-none">
        v{__APP_VERSION__} · {__BUILD_COMMIT__} · {__BUILD_DATE__}
      </p>
    </div>
  )
}
