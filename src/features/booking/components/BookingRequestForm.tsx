import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookingRequestInput } from '@/types/booking'
import { activeSubTabShowsMenu, modeUsesDietary } from '../utils/bookingCapabilities'
import { useCreateBookingRequest } from '../hooks/useBookingRequests'
import { useRateLimit } from '@/hooks/useRateLimit'
import { Send, Loader2, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { MenuSelection } from './MenuSelection'
import { DietaryRestrictionsSection } from './DietaryRestrictionsSection'
import {
  dietaryRestrictionsToText,
  dietaryTextToRestrictions,
  normalizeDietaryRestrictionsForSubmit,
} from '../utils/dietaryRestrictionsText'
import { useBusinessHours } from '@/hooks/useBusinessHours'
import { isValidBookingDateTime, getDayOfWeek, formatHours } from '@/lib/businessHours'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import type { PresetMenuType } from '../constants/presetMenus'
import { customPresetStorageId } from '../constants/presetMenus'
import { useMenuItems } from '../hooks/useMenuItems'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import {
  applyPresetTypeToBookingFormPayload,
  computeMenuTotalsWithPresetPrice,
  presetSelectionStillMatchesStoredPreset,
} from '../utils/buildPresetMenuSelection'
import { isValidEmail, isValidPhone } from '../utils/validation'
import { getTodayIso } from '../utils/bookingPublicDateHelpers'
import { resolveSubTabView } from '../services/bookingFormResolver'
import {
  collectMenuPromoLabelsForSubmit,
  resolveMenuPromoForBookingView,
} from '../constants/menuPromo'
import { useMenuPromoViewTracking } from '../hooks/useMenuPromoViewTracking'
import { MenuPromoBannerCards } from './MenuPromoBannerCards'
import { BookingModeCards } from './publicBooking/BookingModeCards'
import { BookingFormFields } from './publicBooking/BookingFormFields'
import type { BookingPublicFormConfig, SubTab } from '../constants/bookingPublicFormConfig'
import {
  applyLegacySubTabLabelOverrides,
  DEFAULT_BOOKING_FORM_CONFIG,
  getSubTabPricePerPerson,
} from '../constants/bookingPublicFormConfig'
import {
  BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE,
  BOOKING_PUBLIC_CLIENT_TEXT_LIMITS,
  isWithinBookingTextLimit,
} from '../constants/bookingPrenotaTextLimits'
import { BookingSubTabCards } from './publicBooking/BookingSubTabCards'
import { useBookingPublicScrollRowAlign } from '../hooks/useBookingPublicScrollRowAlign'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'
import { resolveBookingStoredIconKey } from '@/features/public-menu/categoryIcons'
import {
  BOOKING_PUBLIC_CONTENT_WIDTH,
  publicFormSectionErrorClass,
} from '../constants/bookingPublicFieldStyles'
import {
  BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
  BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
  dispatchBookingMenuComposeCollapse,
  scrollToBookingPublicError,
  shouldDismissBookingPublicAttention,
} from '../utils/bookingPublicFormAttention'

interface BookingRequestFormProps {
  onSubmit?: () => void
  tenantSlug?: string
  formConfig?: BookingPublicFormConfig
  onFormDataChange?: (data: Partial<BookingRequestInput>) => void
  onActiveSubTabChange?: (subTab: SubTab | null) => void
  /** Riepilogo a destra (desktop); il submit va sotto questa colonna. */
  summarySidebar?: React.ReactNode
  /**
   * Desktop full-page: il parent mette il riepilogo fuori dal cap del form;
   * sotto 1600px `summarySidebar` resta sotto il form; da 1600px è nascosto qui (colonna esterna).
   */
  externalSummaryLayout?: boolean
  /** Notifica il parent quando il pulsante submit cambia stato disabled. */
  onIsDisabledChange?: (disabled: boolean) => void
  /** Testo errore/privacy/riepilogo in bianco solo su sfondo full-page (no striscia). */
  publicFormLightTextOnDarkBackground?: boolean
}

const BOOKING_CAROUSEL_SLIDE_WIDTH_CLASS =
  'w-[min(280px,calc(var(--booking-carousel-viewport-px,100%)*0.72))] sm:w-[min(320px,calc(var(--booking-carousel-viewport-px,100%)*0.6))] md:w-[calc(var(--booking-carousel-viewport-px,100%)*0.46)]'

function BookingSubTabCarousel({ subTab }: { subTab: SubTab }) {
  const visible = (subTab.carousel_items ?? []).filter((item) => item.image_url?.trim())
  const { outerRef, innerRef, rowOverflows, innerRowAlignClass, measureRow } =
    useBookingPublicScrollRowAlign(visible.length)

  useEffect(() => {
    const el = outerRef.current
    if (!el || visible.length <= 1) return
    const syncViewport = () => {
      el.style.setProperty('--booking-carousel-viewport-px', `${el.clientWidth}px`)
      measureRow()
    }
    syncViewport()
    const ro = new ResizeObserver(syncViewport)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible.length, measureRow, outerRef])

  if (visible.length === 0) return null

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = outerRef.current
    if (!el) return
    const delta = Math.max(280, Math.round(el.clientWidth * 0.7))
    el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' })
  }

  if (visible.length === 1) {
    const item = visible[0]
    const cardLabel = item.eyebrow?.trim() || ''
    const title = item.title?.trim() || ''
    const description = item.description?.trim() || ''
    const hasOverlay = Boolean(cardLabel || title || description)

    return (
      <div className={cn('relative', BOOKING_PUBLIC_CONTENT_WIDTH)}>
        <div className="flex w-full justify-center">
          <article className="relative h-36 w-full max-w-[280px] shrink-0 overflow-hidden rounded-2xl bg-warm-wood text-white shadow-lg sm:h-52 sm:max-w-[320px] md:h-64">
            <img
              src={item.image_url}
              alt={title || cardLabel || ''}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
            {item.icon ? (
              <span
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-[1px] sm:right-4 sm:top-4 sm:h-10 sm:w-10"
                aria-hidden
              >
                <MenuQrCategoryIconGlyph
                  iconKey={resolveBookingStoredIconKey(item.icon)}
                  className="h-5 w-5 sm:h-6 sm:w-6 text-white"
                />
              </span>
            ) : null}
            {hasOverlay ? (
              <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                {cardLabel ? (
                  <p className="ml-[-9px] mr-[-9px] px-0 text-xs font-bold uppercase tracking-wide text-white/80">
                    {cardLabel}
                  </p>
                ) : null}
                {title ? (
                  <h3 className="mt-1 ml-[-9px] mr-[-11px] px-0 text-lg font-bold leading-tight">{title}</h3>
                ) : null}
                {description ? (
                  <p className="mt-1 ml-[-9px] mr-[-11px] line-clamp-3 text-sm font-medium leading-snug text-white/85">
                    {description}
                  </p>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative', BOOKING_PUBLIC_CONTENT_WIDTH)}>
      <button
        type="button"
        aria-label="Scorri foto precedenti"
        onClick={() => scrollCarousel('left')}
        className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange md:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Scorri foto successive"
        onClick={() => scrollCarousel('right')}
        className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange md:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div
        ref={outerRef}
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-1 scrollbar-hide touch-pan-x [-webkit-overflow-scrolling:touch]"
      >
        <div
          ref={innerRef}
          className={cn(
            'flex w-max flex-nowrap snap-x snap-mandatory scroll-px-2 gap-3',
            innerRowAlignClass,
          )}
        >
        {visible.map((item, idx) => {
          const cardLabel = item.eyebrow?.trim() || ''
          const title = item.title?.trim() || ''
          const description = item.description?.trim() || ''
          const hasOverlay = Boolean(cardLabel || title || description)

          return (
            <article
              key={`${item.image_url}-${idx}`}
              className={cn(
                'relative h-36 shrink-0 overflow-hidden rounded-2xl bg-warm-wood text-white shadow-lg sm:h-52 md:h-64',
                rowOverflows ? 'snap-start' : 'snap-center',
                BOOKING_CAROUSEL_SLIDE_WIDTH_CLASS,
              )}
            >
              <img
                src={item.image_url}
                alt={title || cardLabel || ''}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              {item.icon ? (
                <span
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow-md backdrop-blur-[1px] sm:right-4 sm:top-4 sm:h-10 sm:w-10"
                  aria-hidden
                >
                  <MenuQrCategoryIconGlyph
                    iconKey={resolveBookingStoredIconKey(item.icon)}
                    className="h-5 w-5 sm:h-6 sm:w-6 text-white"
                  />
                </span>
              ) : null}
              {hasOverlay ? (
                <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                  {cardLabel ? (
                    <p className="ml-[-9px] mr-[-9px] px-0 text-xs font-bold uppercase tracking-wide text-white/80">
                      {cardLabel}
                    </p>
                  ) : null}
                  {title ? (
                    <h3 className="mt-1 ml-[-9px] mr-[-11px] px-0 text-lg font-bold leading-tight">{title}</h3>
                  ) : null}
                  {description ? (
                    <p className="mt-1 ml-[-9px] mr-[-11px] line-clamp-3 text-sm font-medium leading-snug text-white/85">
                      {description}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
        </div>
      </div>
    </div>
  )
}

export const BookingRequestForm: React.FC<BookingRequestFormProps> = ({
  onSubmit,
  tenantSlug,
  formConfig = DEFAULT_BOOKING_FORM_CONFIG,
  onFormDataChange,
  onActiveSubTabChange,
  summarySidebar,
  externalSummaryLayout = false,
  onIsDisabledChange,
  publicFormLightTextOnDarkBackground = false,
}) => {
  const getCurrentDate = getTodayIso

  // Ora di default: prossima ora intera futura (es. se sono le 14:23 → 15:00)
  const getDefaultTime = (): string => {
    const now = new Date()
    const nextHour = now.getHours() + 1
    if (nextHour >= 24) return '00:00'
    return `${String(nextHour).padStart(2, '0')}:00`
  }

  const createInitialFormData = (): BookingRequestInput => ({
    client_name: '',
    client_email: '',
    client_phone: '',
    booking_type: formConfig.booking_modes.find((m) => m.enabled)?.booking_type ?? 'tavolo',
    desired_date: getCurrentDate(),
    desired_time: getDefaultTime(),
    num_guests: 0,
    special_requests: '',
    menu_selection: { items: [] },
    dietary_restrictions: [],
    preset_menu: null
  })

  const [formData, setFormData] = useState<BookingRequestInput>(createInitialFormData)

  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false) // Stato per triggerare re-render e disabilitare button
  const [selectedPreset, setSelectedPreset] = useState<PresetMenuType>(null)
  const [activeSubTabId, setActiveSubTabId] = useState<string | null>(null)
  const [touchCrossBurst, setTouchCrossBurst] = useState(0)
  const [composeCollapseNonce, setComposeCollapseNonce] = useState(0)
  const [attentionFieldKey, setAttentionFieldKey] = useState<string | null>(null)

  const enabledBookingModes = useMemo(
    () => formConfig.booking_modes.filter((m) => m.enabled),
    [formConfig.booking_modes],
  )
  const initialBookingType = enabledBookingModes[0]?.booking_type ?? 'tavolo'

  // Trova il modo attivo in base a booking_type
  const activeMode = enabledBookingModes.find(
    (m) => m.booking_type === formData.booking_type,
  ) ?? enabledBookingModes[0]

  const activeModeId = activeMode?.id ?? 'tavolo'

  useEffect(() => {
    if (enabledBookingModes.length === 0) return
    const currentStillEnabled = enabledBookingModes.some((m) => m.booking_type === formData.booking_type)
    if (currentStillEnabled) return
    setActiveSubTabId(null)
    setSelectedPreset(null)
    setFormData((prev) => ({
      ...prev,
      booking_type: initialBookingType,
      preset_menu: null,
      menu_selection: { items: [] },
      menu_total_per_person: undefined,
      menu_total_booking: undefined,
      dietary_restrictions: modeUsesDietary(enabledBookingModes[0]) ? prev.dietary_restrictions : [],
    }))
  }, [enabledBookingModes, formData.booking_type, initialBookingType])

  const {
    data: customStaffPresets = [],
    isLoading: customStaffPresetsLoading,
    isFetching: customStaffPresetsFetching,
  } = useRestaurantSetting('booking_custom_staff_presets')

  const activeModeSubTabs = useMemo(() => {
    if (!activeMode?.sub_tabs_enabled || (activeMode.sub_tabs?.length ?? 0) === 0) {
      return []
    }
    const raw = activeMode.sub_tabs ?? []
    const labeled = applyLegacySubTabLabelOverrides(
      raw,
      activeMode.sub_tabs_overrides,
      customStaffPresets,
    )
    // Filtro difensivo XOR: se sub_tabs_presentation è impostata, mostra solo il tipo coerente.
    // Gestisce dati legacy con mix cards/carousel senza richiede migrazione DB.
    const presentation = activeMode.sub_tabs_presentation
    const filtered = presentation === 'cards' || presentation === 'carousel'
      ? labeled.filter((t) => t.display === presentation)
      : labeled
    if (presentation && filtered.length < labeled.length && import.meta.env.DEV) {
      import('@/lib/logger').then(({ logger }) =>
        logger.warn(
          `[BookingRequestForm] Modalità "${activeMode.id}": sottotab con display misto. Mostrate solo "${presentation}".`,
        ),
      )
    }
    // Resolver: applica field_overrides → campi non personalizzati seguono il preset live
    return filtered.map((tab): SubTab => {
      const resolved = resolveSubTabView(tab, customStaffPresets)
      return {
        ...tab,
        label: resolved.label,
        description: resolved.description,
        price_per_person: resolved.price_per_person,
        is_fixed_menu: resolved.is_fixed_menu,
        courses_label: resolved.courses_label,
        hidden_category_keys: resolved.hidden_category_keys,
        hidden_item_ids: resolved.hidden_item_ids,
        category_order_keys: resolved.category_order_keys,
      }
    })
  }, [activeMode, customStaffPresets])

  const activeSubTab = activeModeSubTabs.find((t) => t.id === activeSubTabId) ?? null
  const activeSubTabLinkedPreset = activeSubTab?.preset_id
    ? customStaffPresets.find((preset) => preset.id === activeSubTab.preset_id) ?? null
    : null

  const activeSubTabUsesFixedPricing = getSubTabPricePerPerson(activeSubTab) != null
  const showIngredientPrices = getSubTabPricePerPerson(activeSubTab) == null

  const { data: menuItems = [], isLoading: menuItemsLoading, isFetching: menuItemsFetching } = useMenuItems()
  const presetCatalogLoading =
    menuItemsLoading || menuItemsFetching || customStaffPresetsLoading || customStaffPresetsFetching

  const activeSubTabOverrides = useMemo(() => {
    if (activeModeSubTabs.length > 0) {
      return activeModeSubTabs
        .filter((t): t is typeof t & { preset_id: string } => !!t.preset_id)
        .map((t) => ({ preset_id: t.preset_id, custom_label: t.label }))
    }
    return activeMode?.sub_tabs_overrides ?? []
  }, [activeMode, activeModeSubTabs])

  /**
   * Menu pubblico solo da sottotab valide: niente fallback legacy se non ci sono card salvate.
   * La visibilità dipende dalla CAPACITÀ calcolata (card scorrevole + preset risolto), non dal
   * nome della tipologia: una card con menù preselegato collegato mostra il menù per ogni
   * booking_type (rispetta la LOCK "Ingredienti preset custom").
   */
  const showMenuSelectionSection = useMemo(() => {
    if (activeModeSubTabs.length === 0) return false
    return activeSubTabShowsMenu(activeSubTab, activeSubTabLinkedPreset)
  }, [
    activeModeSubTabs.length,
    activeSubTab,
    activeSubTabLinkedPreset,
  ])

  // Notifica il parent ad ogni cambio formData (per sidebar riepilogo)
  useEffect(() => {
    onFormDataChange?.(formData)
  }, [formData, onFormDataChange])

  useEffect(() => {
    onActiveSubTabChange?.(activeSubTab)
  }, [activeSubTab, onActiveSubTabChange])

  // Modalità Carosello: c'è una sola sottotab; auto-selezionala senza richiedere click utente
  // (la strip BookingSubTabCards non viene renderizzata per questa presentazione).
  useEffect(() => {
    if (activeMode?.sub_tabs_presentation !== 'carousel') return
    if (activeSubTabId) return
    const first = activeModeSubTabs[0]
    if (first) setActiveSubTabId(first.id)
  }, [activeMode?.sub_tabs_presentation, activeModeSubTabs, activeSubTabId])

  useEffect(() => {
    if (!activeSubTab || activeSubTab.display !== 'carousel') return
    const price = getSubTabPricePerPerson(activeSubTab)
    setFormData((prev) => ({
      ...prev,
      menu_selection: { items: [] },
      menu_total_per_person: price,
      menu_total_booking: price && prev.num_guests > 0 ? price * prev.num_guests : undefined,
    }))
  }, [
    activeSubTab?.id,
    activeSubTab?.display,
    activeSubTab?.price_per_person,
    activeSubTab?.is_fixed_menu,
  ])

  const frostedInputCn =
    'min-h-[2.3rem] sm:min-h-[2.5rem] min-[900px]:min-h-[2.4rem] bg-white/75 backdrop-blur-sm px-2.5 sm:px-3 min-[900px]:px-3 rounded-lg border border-slate-200 text-left text-xs font-bold text-warm-wood sm:text-sm min-[900px]:text-xs focus:border-warm-wood focus:ring-2 focus:ring-warm-wood/40'
  
  // Ref per prevenire doppi submit (anche con React StrictMode)
  const isSubmittingRef = useRef(false)
  const submitLockIdRef = useRef<string | null>(null)
  
  // Protezione globale usando sessionStorage - lock atomico per prevenire race condition
  const GLOBAL_LOCK_KEY = 'booking-submit-global-lock'
  const LOCK_TIMEOUT = 10000 // 10 secondi
  
  // Lock atomico: controlla E imposta in modo atomico usando un timestamp univoco
  // IMPLEMENTAZIONE MIGLIORATA: verifica lock DOPO l'impostazione per rilevare race conditions
  const acquireGlobalLock = (): string | null => {
    // NOTA: Non può essere async perché viene chiamata sincronamente in handleSubmit
    try {
      // 🔒 MECCANISMO DI LOCK ATOMIC CON VERIFICA IMMEDIATA
      const now = Date.now()
      const randomPart = Math.random().toString(36).substring(2, 15) // Più lungo per maggiore unicità
      const lockId = `${now}-${randomPart}` // ID univoco per questo tentativo
      
      // PRIMA VERIFICA: lock esistente e valido?
      const existingLock = sessionStorage.getItem(GLOBAL_LOCK_KEY)
      
      if (existingLock) {
        const lockTime = parseInt(existingLock.split('-')[0], 10)
        const lockAge = now - lockTime
        
        if (lockAge < LOCK_TIMEOUT) {
          // Lock valido - BLOCCATO
          return null
        }
        // Lock scaduto, rimuovilo
        sessionStorage.removeItem(GLOBAL_LOCK_KEY)
      }
      
      // OPERAZIONE ATOMICA: imposta lock con ID univoco
      sessionStorage.setItem(GLOBAL_LOCK_KEY, lockId)
      
      // ⚠️ CRITICO: Verifica IMMEDIATAMENTE se il lock è nostro
      // Se due istanze fanno questo simultaneamente, solo una vedrà il proprio ID
      // Usa un piccolo delay per dare tempo alla race condition di manifestarsi
      const actualLock = sessionStorage.getItem(GLOBAL_LOCK_KEY)
      
      if (actualLock !== lockId) {
        // Race condition rilevata - un'altra istanza ha sovrascritto il nostro lock
        logger.error('[BookingForm] RACE CONDITION RILEVATA! Lock acquisito da altra istanza:', {
          ourId: lockId.substring(0, 30),
          actualLock: actualLock?.substring(0, 30),
          timestamp: now
        })
        return null
      }
      
      // Verifica doppia: controlla immediatamente dopo l'impostazione
      // Se due chiamate arrivano simultaneamente, solo una vedrà il proprio ID
      
      return lockId
    } catch (error) {
      return null
    }
  }
  
  const releaseGlobalLock = (lockId: string | null) => {
    if (!lockId) return
    
    try {
      const currentLock = sessionStorage.getItem(GLOBAL_LOCK_KEY)
      // Rilascia solo se è il nostro lock (non quello di un'altra istanza)
      if (currentLock === lockId) {
        sessionStorage.removeItem(GLOBAL_LOCK_KEY)
      } else {
      }
    } catch (error) {
    }
  }
  

  // Reset num_guests to 0 when cleared - only allow numeric input
  const handleNumGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.trim()
    const presetPricePerPerson = getSubTabPricePerPerson(activeSubTab)

    // Only allow numeric characters or empty string
    if (inputValue === '') {
      setFormData({ ...formData, num_guests: 0, menu_total_booking: 0 })
      setErrors({ ...errors, num_guests: '' })
      return
    }
    if (/^\d+$/.test(inputValue)) {
      const value = parseInt(inputValue, 10)
      if (!isNaN(value) && value >= 1 && value <= BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.numGuestsMax) {
        const totalPerPerson = activeSubTabUsesFixedPricing ? presetPricePerPerson : formData.menu_total_per_person
        setFormData({ ...formData, num_guests: value, menu_total_booking: totalPerPerson ? totalPerPerson * value : undefined })
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
  const handlePresetMenuChange = (presetType: PresetMenuType, sourceSubTab: SubTab | null = activeSubTab) => {
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

    const resolved = applyPresetTypeToBookingFormPayload(presetType, menuItems, customStaffPresets, {
      subTabGuestComposable: sourceSubTab?.is_fixed_menu === false,
    })
    if (!resolved) {
      if (presetCatalogLoading) {
        const fallbackPrice = getSubTabPricePerPerson(sourceSubTab)
        const numGuests = formData.num_guests || 0
        setFormData({
          ...formData,
          preset_menu: presetType,
          menu_selection: { items: [] },
          menu_total_per_person: fallbackPrice,
          menu_total_booking: fallbackPrice && numGuests > 0 ? fallbackPrice * numGuests : undefined,
        })
        return
      }

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
    const presetPricePerPerson = getSubTabPricePerPerson(sourceSubTab)
    const { totalPerPerson, menu_total_booking } =
      computeMenuTotalsWithPresetPrice(items, numGuests, presetPricePerPerson)
    const usesFixedSubTabPricing = presetPricePerPerson != null
    const effectiveTotalPerPerson = usesFixedSubTabPricing ? presetPricePerPerson : totalPerPerson

    setFormData({
      ...formData,
      preset_menu: presetType,
      menu_selection: { items },
      menu_total_per_person: effectiveTotalPerPerson,
      menu_total_booking:
        effectiveTotalPerPerson && numGuests > 0
          ? effectiveTotalPerPerson * numGuests
          : usesFixedSubTabPricing
            ? undefined
            : menu_total_booking,
    })
  }

  // Una sola card con preset: seleziona automaticamente così la griglia ingredienti è subito disponibile.
  useEffect(() => {
    if (activeMode?.sub_tabs_presentation !== 'cards') return
    if (activeSubTabId) return
    if (activeModeSubTabs.length !== 1) return
    const only = activeModeSubTabs[0]
    if (only.display !== 'cards' || !only.preset_id) return
    const linkedPreset = customStaffPresets.find((preset) => preset.id === only.preset_id)
    if (!linkedPreset) return

    setActiveSubTabId(only.id)
    const presetType = customPresetStorageId(linkedPreset.id)
    setSelectedPreset(presetType)

    if (presetCatalogLoading) {
      const fallbackPrice = getSubTabPricePerPerson(only)
      const numGuests = formData.num_guests || 0
      setFormData((prev) => ({
        ...prev,
        preset_menu: presetType,
        menu_selection: { items: [] },
        menu_total_per_person: fallbackPrice,
        menu_total_booking:
          fallbackPrice && numGuests > 0 ? fallbackPrice * numGuests : undefined,
      }))
      return
    }

    const resolved = applyPresetTypeToBookingFormPayload(
      presetType,
      menuItems,
      customStaffPresets,
      { subTabGuestComposable: only.is_fixed_menu === false },
    )
    if (!resolved) return

    const numGuests = formData.num_guests || 0
    const presetPricePerPerson = getSubTabPricePerPerson(only)
    const { totalPerPerson, menu_total_booking } = computeMenuTotalsWithPresetPrice(
      resolved.items,
      numGuests,
      presetPricePerPerson,
    )
    const usesFixedSubTabPricing = presetPricePerPerson != null
    const effectiveTotalPerPerson = usesFixedSubTabPricing ? presetPricePerPerson : totalPerPerson

    setFormData((prev) => ({
      ...prev,
      preset_menu: presetType,
      menu_selection: { items: resolved.items },
      menu_total_per_person: effectiveTotalPerPerson,
      menu_total_booking:
        effectiveTotalPerPerson && numGuests > 0
          ? effectiveTotalPerPerson * numGuests
          : usesFixedSubTabPricing
            ? undefined
            : menu_total_booking,
    }))
  }, [
    activeMode?.sub_tabs_presentation,
    activeModeSubTabs,
    activeSubTabId,
    customStaffPresets,
    formData.num_guests,
    menuItems,
    presetCatalogLoading,
  ])

  useEffect(() => {
    if (presetCatalogLoading || !selectedPreset) return
    if (formData.preset_menu !== selectedPreset) return
    if ((formData.menu_selection?.items.length ?? 0) > 0) return

    const resolved = applyPresetTypeToBookingFormPayload(selectedPreset, menuItems, customStaffPresets, {
      subTabGuestComposable: activeSubTab?.is_fixed_menu === false,
    })
    if (!resolved || resolved.items.length === 0) return

    const numGuests = formData.num_guests || 0
    const presetPricePerPerson = getSubTabPricePerPerson(activeSubTab)
    const { totalPerPerson, menu_total_booking } =
      computeMenuTotalsWithPresetPrice(resolved.items, numGuests, presetPricePerPerson)
    const usesFixedSubTabPricing = presetPricePerPerson != null
    const effectiveTotalPerPerson = usesFixedSubTabPricing ? presetPricePerPerson : totalPerPerson

    setFormData((prev) => ({
      ...prev,
      preset_menu: selectedPreset,
      menu_selection: { items: resolved.items },
      menu_total_per_person: effectiveTotalPerPerson,
      menu_total_booking:
        effectiveTotalPerPerson && numGuests > 0
          ? effectiveTotalPerPerson * numGuests
          : usesFixedSubTabPricing
            ? undefined
            : menu_total_booking,
    }))
  }, [
    activeSubTab,
    customStaffPresets,
    formData.menu_selection?.items.length,
    formData.num_guests,
    formData.preset_menu,
    getSubTabPricePerPerson,
    menuItems,
    presetCatalogLoading,
    selectedPreset,
  ])

  const { mutate, isPending } = useCreateBookingRequest()
  const { checkRateLimit, isBlocked } = useRateLimit({
    maxAttempts: 3,
    timeWindow: 60000 // 1 minuto
  })
  const { data: staffPresetsDropdownVisible = true } = useRestaurantSetting('booking_staff_presets_visible')

  // Notifica il parent quando cambia lo stato disabled del submit
  useEffect(() => {
    onIsDisabledChange?.(isPending || isBlocked || isSubmitting)
  }, [isPending, isBlocked, isSubmitting, onIsDisabledChange])
  const { data: menuPromos = [] } = useRestaurantSetting('booking_menu_promos')

  const { resolvedPromo, viewedPromoIdsRef, resetViewedPromos } = useMenuPromoViewTracking({
    bookingType: formData.booking_type ?? 'tavolo',
    modeId: activeModeId,
    subTabId: activeSubTabId,
    promos: menuPromos,
  })

  const menuPromoBannerMessages = resolvedPromo?.message?.trim() ? [resolvedPromo.message.trim()] : []

  const clearAttentionField = useCallback(() => {
    setAttentionFieldKey(null)
  }, [])

  const runAfterComposeCardsCollapsed = useCallback((callback: () => void) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback)
      })
    })
  }, [])

  const focusFirstValidationIssue = useCallback(
    (firstErrorKey: string | null) => {
      setComposeCollapseNonce((value) => value + 1)
      setAttentionFieldKey(firstErrorKey)
      dispatchBookingMenuComposeCollapse()
      if (!firstErrorKey) return
      runAfterComposeCardsCollapsed(() => {
        scrollToBookingPublicError(firstErrorKey)
      })
    },
    [runAfterComposeCardsCollapsed],
  )

  // Fetch business hours (non-blocking - form works even if loading/fails)
  const { data: businessHours, isLoading: isLoadingHours, error: hoursError } = useBusinessHours()

  // Helper function to scroll to first error field — vedi bookingPublicFormAttention.ts

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true
    let firstErrorKey: string | null = null
    const textTooLong = BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE
    const C = BOOKING_PUBLIC_CLIENT_TEXT_LIMITS

    // Name validation
    if (!formData.client_name.trim()) {
      newErrors.client_name = 'Nome obbligatorio'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_name'
    }

    // Email: opzionale, ma se compilata deve essere valida
    if (formData.client_email.trim() && !isValidEmail(formData.client_email)) {
      newErrors.client_email = 'Email non valida'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_email'
    }

    // Telefono: obbligatorio, almeno 6 cifre
    if (!formData.client_phone || !formData.client_phone.trim()) {
      newErrors.client_phone = 'Numero di telefono obbligatorio'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_phone'
    } else if (!isValidPhone(formData.client_phone)) {
      newErrors.client_phone = 'Telefono non valido (almeno 6 cifre)'
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

      // Validate year: only current year or next year allowed
      const currentYear = today.getFullYear()
      const selectedYear = selectedDate.getFullYear()
      if (selectedYear < currentYear || selectedYear > currentYear + 1) {
        newErrors.desired_date = 'Puoi prenotare solo per l\'anno corrente o il prossimo anno'
        isValid = false
        if (!firstErrorKey) firstErrorKey = 'desired_date'
      } else if (selectedDate < today) {
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

    // Business hours validation (non-blocking: only validate if hours are loaded)
    if (
      formData.desired_date &&
      formData.desired_time &&
      businessHours &&
      !isLoadingHours &&
      !hoursError
    ) {
      if (!isValidBookingDateTime(formData.desired_date, formData.desired_time, businessHours)) {
        const dayName = getDayOfWeek(formData.desired_date)
        const dayHours = businessHours[dayName]

        if (!dayHours || dayHours.length === 0) {
          newErrors.desired_date = 'Il ristorante è chiuso in questo giorno'
          isValid = false
          if (!firstErrorKey) firstErrorKey = 'desired_date'
        } else {
          const availableHours = formatHours(dayHours)
          newErrors.desired_time = `Orario non valido. Orari disponibili: ${availableHours}`
          isValid = false
          if (!firstErrorKey) firstErrorKey = 'desired_time'
        }
      }
    }

    // Num guests validation. Solo il minimo: l'input cappa già a C.numGuestsMax
    // (handleNumGuestsChange), quindi un check >max qui sarebbe un vicolo cieco
    // muto (blocca senza messaggio visibile). La rete server è l'edge create-booking.
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

    // Sottotab menù: obbligo scelta card prima del submit.
    // Allineato alla sezione resa visibile: se ci sono card configurate ma nessuna è
    // selezionata, blocca — qualunque sia il booking_type. Senza card (length===0) nessun obbligo.
    if (activeModeSubTabs.length > 0 && !activeSubTab) {
      newErrors.menu = 'Seleziona un\'opzione menù tra le card sopra'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'menu'
    }

    // Menu validation (card scorrevole con menù preselezionato collegato)
    if (showMenuSelectionSection) {
      if (
        !activeSubTabUsesFixedPricing &&
        (!formData.menu_selection || !formData.menu_selection.items || formData.menu_selection.items.length === 0)
      ) {
        newErrors.menu = 'Seleziona almeno un prodotto dal menù'
        isValid = false
        if (!firstErrorKey) firstErrorKey = 'menu'
      }
      if (!activeSubTabUsesFixedPricing && (!formData.menu_total_per_person || formData.menu_total_per_person <= 0)) {
        newErrors.menu = 'Il totale a persona deve essere maggiore di 0'
        isValid = false
        if (!firstErrorKey) firstErrorKey = 'menu'
      }
    }

    // Privacy consent validation
    if (!privacyAccepted) {
      newErrors.privacyAccepted = 'È necessario accettare la Privacy Policy per inviare la richiesta'
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'privacyAccepted'
    }

    if (!isWithinBookingTextLimit(formData.client_name, C.clientName)) {
      newErrors.client_name = textTooLong
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_name'
    }
    if (
      formData.client_email.trim() &&
      !isWithinBookingTextLimit(formData.client_email, C.clientEmail)
    ) {
      newErrors.client_email = textTooLong
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_email'
    }
    if (
      formData.client_phone &&
      !isWithinBookingTextLimit(formData.client_phone, C.clientPhone)
    ) {
      newErrors.client_phone = textTooLong
      isValid = false
      if (!firstErrorKey) firstErrorKey = 'client_phone'
    }
    // Intolleranze e «altre richieste»: nessun check qui. Il taglio è silenzioso
    // (maxLength + slice in DietaryRestrictionsSection, decisione PRENOTA_SKILL §3),
    // e a special_requests viene aggiunta DOPO la validate la nota sottotab (vedi
    // handleSubmit): la stringa finale può superare il cap senza che validate la veda.
    // La difesa vera sul payload completo è l'edge create-booking.

    setErrors(newErrors)

    // If validation failed, show toast and scroll to first error
    if (!isValid) {
      const errorCount = Object.keys(newErrors).length
      toast.error(`Compilazione non valida: ${errorCount} ${errorCount === 1 ? 'campo da correggere' : 'campi da correggere'}`, {
        position: 'top-center',
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true
      })

      focusFirstValidationIssue(firstErrorKey)
    }

    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // Previene propagazione eventi

    // 🚨 CRITICO: Imposta lock IMMEDIATAMENTE, PRIMA di qualsiasi log o controllo
    // Questo è fondamentale per prevenire race conditions sincronizzate
    const lockId = acquireGlobalLock()
    if (!lockId) {
      return
    }
    
    // Salva lockId immediatamente nel ref
    submitLockIdRef.current = lockId
    
    
    // ✅ PROTEZIONE MULTI-LIVELLO CONTRO DOPPI SUBMIT
    // IMPORTANTE: Il lock globale è già acquisito, ora verifica gli altri controlli
    
    // 1. Controllo stato locale (protezione istanza componente - triggera re-render)
    if (isSubmitting) {
      releaseGlobalLock(lockId)
      return
    }
    
    // 2. Controllo ref locale (backup - per casi edge)
    if (isSubmittingRef.current) {
      releaseGlobalLock(lockId)
      return
    }
    
    // 3. Controllo mutation state (protezione React Query)
    if (isPending) {
      releaseGlobalLock(lockId)
      return
    }

    // Check rate limit
    if (!checkRateLimit()) {
      releaseGlobalLock(lockId) // Rilascia lock se rate limit
      return
    }

    // Validazione form
    if (!validate()) {
      releaseGlobalLock(lockId)
      return
    }

    // Imposta tutti i flag per prevenire doppi submit
    isSubmittingRef.current = true
    setIsSubmitting(true)

    // Chiama mutate — il guard server-side in create-booking è la garanzia definitiva
    const finalSubTabPromo = resolveMenuPromoForBookingView({
      bookingType: formData.booking_type ?? initialBookingType,
      modeId: activeModeId,
      subTabId: activeSubTabId,
      promos: menuPromos,
    })
    const menuPromoLabels = collectMenuPromoLabelsForSubmit({
      viewedPromoIds: viewedPromoIdsRef.current,
      finalSubTabPromoId: finalSubTabPromo?.id,
      promos: menuPromos,
    })

    let specialRequests = formData.special_requests?.trim() ?? ''
    if (activeSubTab && !activeSubTab.preset_id && activeSubTab.label.trim()) {
      const subTabNote = activeSubTab.price_per_person
        ? `[${activeSubTab.label.trim()} - €${activeSubTab.price_per_person}/p]`
        : `[${activeSubTab.label.trim()}]`
      if (!specialRequests.includes(subTabNote)) {
        specialRequests = specialRequests ? `${subTabNote} ${specialRequests}` : subTabNote
      }
    }

    mutate(
      {
        ...formData,
        special_requests: specialRequests,
        dietary_restrictions: normalizeDietaryRestrictionsForSubmit(formData.dietary_restrictions),
        tenantSlug,
        menu_promo_labels: menuPromoLabels.length > 0 ? menuPromoLabels : null,
      },
      {
        onSuccess: () => {
        
        // Reset form (keep default date and time)
        setFormData({
          client_name: '',
          client_email: '',
          client_phone: '',
          booking_type: initialBookingType,
          desired_date: getCurrentDate(),
          desired_time: getDefaultTime(),
          num_guests: 0,
          special_requests: '',
          menu_selection: { items: [] },
          dietary_restrictions: [],
          preset_menu: null
        })
        setSelectedPreset(null)
        setActiveSubTabId(null)
        resetViewedPromos()
        setPrivacyAccepted(false)
        
        // Reset tutti i flag di submit e rilascia lock
        const savedLockId = submitLockIdRef.current
        isSubmittingRef.current = false
        submitLockIdRef.current = null
        setIsSubmitting(false)
        if (savedLockId) {
          releaseGlobalLock(savedLockId)
        }
        
        // Mostra la modal di conferma invece del toast
        setShowSuccessModal(true)
        onSubmit?.()
        },
        onError: (error) => {
          logger.error('[BookingForm] Mutation error:', error)
          // Reset tutti i flag in caso di errore per permettere nuovo tentativo
          const savedLockId = submitLockIdRef.current
          isSubmittingRef.current = false
          submitLockIdRef.current = null
          setIsSubmitting(false)
          if (savedLockId) {
            releaseGlobalLock(savedLockId)
          }
        },
      },
    )
  }

  if (enabledBookingModes.length === 0) return null

  return (
    <>
    <form
      id="booking-request-form"
      noValidate
      onSubmit={handleSubmit}
      className={cn(
        'grid w-full max-w-full grid-cols-1 gap-4 font-bold min-[1256px]:items-start min-[1256px]:gap-6',
        !externalSummaryLayout && 'min-[1256px]:grid-cols-[1fr_min(360px,32%)]',
      )}
    >
      {/* Tipologia + sottotab: fuori da md:px-2/lg:px-4 — stesso bordo laterale del box header */}
      <div
        className={cn(
          'col-span-1 flex w-full min-w-0 flex-col space-y-3 min-[1256px]:col-span-2',
          BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
          (attentionFieldKey === 'menu' ||
            attentionFieldKey === 'booking_type') &&
            BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
        )}
        id="booking-sub-tabs-section"
        onPointerDown={(event) => {
          if (
            shouldDismissBookingPublicAttention(event) &&
            (attentionFieldKey === 'menu' || attentionFieldKey === 'booking_type')
          ) {
            clearAttentionField()
          }
        }}
      >
        <BookingModeCards
          modes={formConfig.booking_modes}
          activeModeId={activeModeId}
          fullPageFormCapLayout={externalSummaryLayout}
          onChange={(_modeId, bookingType) => {
            setActiveSubTabId(null)
            setSelectedPreset(null)
            // Reset intolleranze per CAPACITÀ, non per NOME: la modalità esatta si trova dal modeId
            // (più preciso del booking_type). Se la nuova modalità non usa le intolleranze le si
            // svuota — per i tipi storici (tavolo sì, rinfresco/menu_fisso no) è identico a prima.
            const nextMode = formConfig.booking_modes.find((m) => m.id === _modeId)
            const baseReset = {
              ...formData,
              booking_type: bookingType,
              preset_menu: null,
              menu_selection: { items: [] },
              menu_total_per_person: undefined,
              menu_total_booking: undefined,
            }
            if (!modeUsesDietary(nextMode ?? { booking_type: bookingType })) {
              setFormData({ ...baseReset, dietary_restrictions: [] })
            } else {
              setFormData(baseReset)
            }
            setErrors({ ...errors, booking_type: '', menu: '' })
          }}
        />
        {errors.booking_type && (
          <p className={publicFormSectionErrorClass(publicFormLightTextOnDarkBackground)}>{errors.booking_type}</p>
        )}
        {menuPromoBannerMessages.length > 0 && (
          <MenuPromoBannerCards
            messages={menuPromoBannerMessages}
            className={cn('mt-3', BOOKING_PUBLIC_CONTENT_WIDTH)}
          />
        )}
        {activeModeSubTabs.length > 0 && activeMode?.sub_tabs_presentation !== 'carousel' && (
          <BookingSubTabCards
            subTabs={activeModeSubTabs}
            activeSubTabId={activeSubTabId}
            onChange={(tab) => {
              setActiveSubTabId(tab?.id ?? null)
              if (!tab) {
                handlePresetMenuChange(null)
                return
              }
              const linkedPreset = tab.preset_id
                ? customStaffPresets.find((preset) => preset.id === tab.preset_id)
                : null
              if (linkedPreset) {
                handlePresetMenuChange(customPresetStorageId(linkedPreset.id), tab)
                return
              }
              setSelectedPreset(null)
              if (tab.display === 'carousel') {
                setFormData({
                  ...formData,
                  preset_menu: null,
                  menu_selection: { items: [] },
                  menu_total_per_person: undefined,
                  menu_total_booking: undefined,
                })
                return
              }
              const price = getSubTabPricePerPerson(tab)
              const numGuests = formData.num_guests || 0
              setFormData({
                ...formData,
                preset_menu: null,
                menu_selection: { items: [] },
                menu_total_per_person: price,
                menu_total_booking: price && numGuests > 0 ? price * numGuests : undefined,
              })
            }}
          />
        )}
        {activeSubTab?.display === 'carousel' && <BookingSubTabCarousel subTab={activeSubTab} />}
        {!showMenuSelectionSection && errors.menu && activeModeSubTabs.length > 0 && (
          <p className={publicFormSectionErrorClass(publicFormLightTextOnDarkBackground, 'center')}>{errors.menu}</p>
        )}
      </div>

      {showMenuSelectionSection && (
        <div
          id="menu-section"
          className={cn(
            'col-span-1 flex w-full min-w-0 flex-col space-y-6 min-[1256px]:col-span-2',
            BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
            attentionFieldKey === 'menu' && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
            'rounded-xl',
          )}
          onPointerDown={(event) => {
            if (shouldDismissBookingPublicAttention(event) && attentionFieldKey === 'menu') {
              clearAttentionField()
            }
          }}
        >
          <MenuSelection
            key={`menu-compose-${composeCollapseNonce}`}
            selectedItems={formData.menu_selection?.items || []}
            numGuests={formData.num_guests || 0}
            bookingType={formData.booking_type}
            presetMenu={selectedPreset}
            staffPresetsDropdownVisible={
              activeModeSubTabs.length > 0 ? false : staffPresetsDropdownVisible
            }
            customStaffPresets={customStaffPresets}
            hideSummary={true}
            publicFormLayout
            publicFormLightTextOnDarkBackground={publicFormLightTextOnDarkBackground}
            hiddenCategoryKeys={activeSubTab?.hidden_category_keys ?? []}
            hiddenItemIds={activeSubTab?.hidden_item_ids ?? []}
            categoryOrderKeys={activeSubTab?.category_order_keys}
            subTabOverrides={activeSubTabOverrides}
            presetSectionTitle={activeSubTab?.label?.trim() || undefined}
            presetDescription={activeSubTab?.description}
            disablePresetDescriptionFallback={activeModeSubTabs.length > 0}
            hideMenuGrid={!activeSubTab?.preset_id || !activeSubTabLinkedPreset}
            menuSelectionLockedOverride={
              activeSubTab ? activeSubTab.is_fixed_menu !== false : undefined
            }
            composeCollapseKey={String(composeCollapseNonce)}
            showIngredientPrices={showIngredientPrices}
            onPresetMenuChange={handlePresetMenuChange}
            onMenuChange={({ items, totalPerPerson }) => {
              const numGuests = formData.num_guests || 0
              const currentPreset = selectedPreset
              let updatedPreset: PresetMenuType = currentPreset
              const presetPricePerPerson = getSubTabPricePerPerson(activeSubTab)
              const usesFixedSubTabPricing = presetPricePerPerson != null
              const effectiveTotalPerPerson = usesFixedSubTabPricing ? presetPricePerPerson : totalPerPerson

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
                menu_total_per_person: effectiveTotalPerPerson,
                menu_total_booking:
                  effectiveTotalPerPerson && numGuests > 0
                    ? effectiveTotalPerPerson * numGuests
                    : undefined,
              })
              setErrors({ ...errors, menu: '' })
            }}
          />
          {errors.menu && (
            <p className={publicFormSectionErrorClass(publicFormLightTextOnDarkBackground)}>{errors.menu}</p>
          )}
        </div>
      )}

      <div className="col-span-1 min-[1256px]:col-span-2 min-w-0 w-full max-w-full space-y-6">
      {/* Dati cliente — dopo tipologia e menù */}
      <div className="flex w-full min-w-0 flex-col space-y-3 text-start">
        <BookingFormFields
          lightTextOnDarkBackground={publicFormLightTextOnDarkBackground}
          formData={{
            client_name: formData.client_name,
            client_email: formData.client_email,
            client_phone: formData.client_phone,
            desired_date: formData.desired_date,
            desired_time: formData.desired_time,
            num_guests: formData.num_guests,
          }}
          errors={errors}
          businessHours={businessHours}
          isLoadingHours={isLoadingHours}
          hoursError={hoursError}
          frostedInputCn={frostedInputCn}
          attentionFieldKey={attentionFieldKey}
          onClearAttention={clearAttentionField}
          onFieldChange={(field, value) => {
            setFormData({ ...formData, [field]: value })
          }}
          onDateChange={(newDate) => {
            setFormData({ ...formData, desired_date: newDate })
          }}
          onTimeChange={(newTime) => {
            setFormData({ ...formData, desired_time: newTime })
          }}
          onNumGuestsChange={handleNumGuestsChange}
          onNumGuestsKeyPress={handleNumGuestsKeyPress}
          setErrors={(newErrors) => setErrors(newErrors)}
        />
        {/* Intolleranze e richieste — sempre sotto data/ora/ospiti, per ogni tipologia */}
        <div className="flex w-full min-w-0 flex-col space-y-6 pt-2">
          <DietaryRestrictionsSection
            dietaryText={dietaryRestrictionsToText(formData.dietary_restrictions)}
            onDietaryTextChange={(text) => {
              setFormData({
                ...formData,
                dietary_restrictions: dietaryTextToRestrictions(text),
              })
            }}
            specialRequests={formData.special_requests || ''}
            onSpecialRequestsChange={(value) => {
              setFormData({ ...formData, special_requests: value })
            }}
            privacyAccepted={privacyAccepted}
            onPrivacyChange={(newValue) => {
              setPrivacyAccepted(newValue)
              if (newValue && errors.privacyAccepted) {
                setErrors({ ...errors, privacyAccepted: '' })
              }
            }}
            privacyError={errors.privacyAccepted}
            showPrivacyAttention={attentionFieldKey === 'privacyAccepted'}
            onPrivacyAttentionInteract={clearAttentionField}
            publicFormFields
            lightTextOnDarkBackground={publicFormLightTextOnDarkBackground}
            tenantSlug={tenantSlug}
          />
        </div>
      </div>
      </div>

      {summarySidebar != null &&
        (externalSummaryLayout ? (
          // Full-page: riepilogo a piena larghezza sotto il form (stack). col-span-2 occupa
          // la stessa colonna implicita dei figli con col-span-2, evitando l'affiancamento.
          <div className="col-span-1 min-[1256px]:col-span-2 min-[1600px]:hidden">{summarySidebar}</div>
        ) : (
          summarySidebar
        ))}

      {/* Submit grande — solo ≥1256px; sotto il submit è nel riepilogo / sticky bar */}
      <div className="order-3 col-span-1 hidden min-[1256px]:flex w-full max-w-full justify-center items-center mt-3 mb-6 min-[1256px]:col-span-2">
        <button
            type="submit"
            disabled={isPending || isBlocked || isSubmitting}
            className="booking-cross-shine-btn group relative overflow-hidden px-12 md:px-20 py-7 text-xl md:text-2xl uppercase tracking-wide font-bold text-white rounded-full bg-green-600 hover:bg-green-700 shadow-2xl hover:shadow-[0_20px_40px_rgba(34,197,94,0.4)] hover:-translate-y-1 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-2xl w-full md:w-auto max-w-md md:max-w-2xl"
            onPointerDown={(e) => {
              if (isPending || isBlocked || isSubmitting) return
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
            {/* Glow effect on hover */}
            <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

            {/* Content */}
            <div className="relative z-10 flex items-center justify-center gap-3 whitespace-nowrap">
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-base md:text-lg">Invio in corso...</span>
                </>
              ) : isBlocked ? (
                <span className="text-base md:text-lg">Limite richieste raggiunto</span>
              ) : (
                <>
                  <span className="text-xl md:text-2xl">Invia Prenotazione</span>
                  <Send className="h-6 w-6 md:h-7 md:w-7 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </div>

            {/* Animated border glow */}
            <div className="absolute inset-0 z-0 pointer-events-none rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="absolute inset-[-2px] rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-green-600 blur-sm"></div>
            </div>
          </button>
        </div>
    </form>

    {/* Modal di Conferma Successo */}
    {showSuccessModal && (
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50">
        <div className="bg-white p-10 rounded-lg max-w-[500px] text-center">
          <div className="flex justify-center mb-5">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold mb-4">
            Richiesta di Prenotazione Inviata!
          </h3>
          <p className="text-lg mb-5">
            La tua richiesta di prenotazione è stata inoltrata correttamente.<br />
            Ti contatteremo a breve per confermare i dettagli.
          </p>
          <button
            onClick={() => {
              setShowSuccessModal(false)
              setFormData(createInitialFormData())
              setPrivacyAccepted(false)
              setErrors({})
              setSelectedPreset(null)
              // Redirect disabilitato su richiesta:
              // window.location.href = 'https://alritrovobologna.wixsite.com/alritrovobologna'
            }}
            className="py-3 px-8 text-lg font-bold text-white bg-green-500 rounded-full cursor-pointer border-none"
          >
            Chiudi
          </button>
        </div>
      </div>
    )}
    </>
  )
}
