import React, { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CaretUpIcon } from '@phosphor-icons/react/dist/csr/CaretUp'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import { TrashIcon } from '@phosphor-icons/react/dist/csr/Trash'
import { EyeIcon } from '@phosphor-icons/react/dist/csr/Eye'
import { EyeSlashIcon } from '@phosphor-icons/react/dist/csr/EyeSlash'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { useMenuItems } from '@/features/booking/hooks/useMenuItems'
import { useMenuCategories } from '@/features/booking/hooks/useMenuCategories'
import { BookingFormCarouselEditor } from '@/features/booking/components/settings/BookingFormCarouselEditor'
import {
  BookingFormPromoSection,
  type BookingFormPromoSectionHandle,
} from '@/features/booking/components/settings/BookingFormPromoSection'
import {
  useRestaurantSetting,
  useUpsertRestaurantSetting,
} from '@/features/booking/hooks/useRestaurantSetting'
import { useTenantContext } from '@/contexts/TenantContext'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
import {
  buildCategorySortOrderMap,
  orderCategoryKeys,
} from '@/features/booking/utils/orderCategoryKeys'
import {
  BOOKING_HEADER_FONT_OPTIONS,
  BOOKING_HEADER_FONT_SIZE_MIN,
  applyLegacySubTabLabelOverrides,
  DEFAULT_BOOKING_FORM_CONFIG,
  getBookingHeaderTextStyle,
  normalizeBookingHeaderColor,
  normalizeBookingHeaderFontSize,
  normalizeBookingPublicFormConfig,
  type BookingHeaderTextStyle,
  type BookingHeaderTextTarget,
  type BookingMode,
  type BookingPublicFormConfig,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { MenuCategoryIconPicker } from '@/features/public-menu/MenuCategoryIconPicker'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'
import type { MenuQrCategoryIconKey } from '@/features/public-menu/categoryIcons'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'
import type { SubTabOverridableField } from '@/features/booking/constants/bookingPublicFormConfig'
import { normalizeMenuItemBookingTypes, type MenuItem } from '@/types/menu'
import { toast } from 'react-toastify'
import { SETTINGS_AUTOSAVE_ENABLED } from '@/config/settingsAutosave'
import { useDebouncedSettingsAutosave } from '@/features/booking/hooks/useDebouncedSettingsAutosave'
import {
  FieldAutosaveIndicator,
  SettingsSaveFooter,
} from '@/features/booking/components/settings/SettingsSaveUi'
import { AdminFieldWithCharCount } from '@/features/booking/components/settings/AdminFieldWithCharCount'
import {
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
  getBookingHeaderFontSizeMax,
} from '@/features/booking/constants/bookingPrenotaTextLimits'

const L = BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS

const charCountClass = 'text-right text-[11px] text-slate-400 tabular-nums'

function newSubTab(display: SubTab['display']): SubTab {
  return {
    id: crypto.randomUUID(),
    display,
    label: display === 'carousel' ? 'Carosello' : '',
    icon: 'fork_knife',
    ...(display === 'cards'
      ? { hidden_category_keys: [], hidden_item_ids: [] }
      : {}),
  }
}

/** Riga collassata lista card salvate (non carosello). */
function getSubTabCollapsedRowTitle(tab: SubTab, number: number): string {
  if (tab.display === 'carousel') {
    const name = tab.label?.trim()
    return name || `Carosello ${number}`
  }
  const trimmed = tab.label?.trim() ?? ''
  const suffix = `Card ${number}`
  return trimmed ? `${trimmed} · ${suffix}` : suffix
}

/**
 * Campi della card che, se patchati direttamente dall'editor admin,
 * devono essere marcati come personalizzati dal ristoratore.
 * L'import preset usa un percorso separato che azzera tutti gli override.
 */
const SUB_TAB_OVERRIDABLE_KEYS: ReadonlyArray<SubTabOverridableField> = [
  'label',
  'description',
  'price_per_person',
  'hidden_item_ids',
  'hidden_category_keys',
  'category_order_keys',
]

/**
 * Applica un patch alla sottotab marcando come `field_overrides[campo]=true`
 * ogni campo «vetrina» presente nel patch. Usato da updateSubTab/updateDraftSubTab:
 * ogni modifica dell'admin diventa personalizzazione → quel campo non segue più il preset.
 */
function applyPatchWithOverrideTracking(current: SubTab, patch: Partial<SubTab>): SubTab {
  const next: SubTab = { ...current, ...patch }
  const touched = SUB_TAB_OVERRIDABLE_KEYS.filter((k) => k in patch)
  if (touched.length === 0) return next
  const overrides: NonNullable<SubTab['field_overrides']> = { ...(current.field_overrides ?? {}) }
  for (const k of touched) overrides[k] = true
  return { ...next, field_overrides: overrides }
}

/** Stato override post-import preset: tutto torna a «ereditato dal preset». */
function presetImportFieldOverrides(): NonNullable<SubTab['field_overrides']> {
  return {
    label: false,
    description: false,
    price_per_person: false,
    hidden_item_ids: false,
    hidden_category_keys: false,
    category_order_keys: false,
  }
}

function subTabCarouselHasPhoto(tab: SubTab): boolean {
  return tab.display !== 'carousel' || (tab.carousel_items ?? []).some((item) => item.image_url?.trim())
}

function subTabValidationError(tab: SubTab): string | null {
  if (tab.display === 'carousel' && !subTabCarouselHasPhoto(tab)) {
    return 'Aggiungi almeno una foto al carosello prima di salvarlo.'
  }
  if (tab.display === 'cards' && !tab.label.trim()) {
    return 'Inserisci il titolo della card prima di salvarla.'
  }
  return null
}

/** Integra bozze sottotab ancora aperte nell'editor prima del persist footer. */
function mergeOpenSubTabEditorsIntoModes(
  bookingModes: BookingPublicFormConfig['booking_modes'],
  drafts: Record<string, SubTab | null>,
): BookingPublicFormConfig['booking_modes'] {
  return bookingModes.map((mode) => {
    const draft = drafts[mode.id]
    if (!draft) return mode
    return { ...mode, sub_tabs: [...(mode.sub_tabs ?? []), draft] }
  })
}

function findSubTabValidationError(
  bookingModes: BookingPublicFormConfig['booking_modes'],
): string | null {
  for (const mode of bookingModes) {
    for (const tab of mode.sub_tabs ?? []) {
      const err = subTabValidationError(tab)
      if (err) return err
    }
  }
  return null
}

function bookingTypeUsesMenuItems(bookingType: BookingMode['booking_type'], items: MenuItem[]): boolean {
  return items.some((item) => normalizeMenuItemBookingTypes(item.booking_types).includes(bookingType))
}

function SubTabsDisplayHelpPanel() {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-expanded={open}
      className={cn(
        'flex w-full rounded-lg border border-blue-200 bg-blue-50 text-left text-blue-800',
        open
          ? 'items-start gap-2 px-4 py-3 text-sm'
          : 'items-center gap-2 px-3 py-2 text-sm font-semibold',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border border-blue-300 bg-white text-xs font-bold text-blue-700',
          open ? 'mt-0.5 h-5 w-5' : 'h-5 w-5',
        )}
      >
        ?
      </span>
      {!open ? (
        <span>Dettagli</span>
      ) : (
        <span className="min-w-0 space-y-2">
          <span className="block font-medium">Scegli se mostrare:</span>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Card scorrevole, per descrivere offerte al cliente</li>
            <li>Carosello, per mostrare immagini con testo ai clienti</li>
          </ul>
        </span>
      )}
    </button>
  )
}

const SUB_TAB_ADD_BUTTON_CLASS =
  'min-w-0 w-full bg-primary-50 px-2 py-1.5 text-xs leading-tight hover:bg-primary-100 active:bg-primary-100/90 sm:min-h-11 sm:px-3 sm:py-2 sm:text-sm md:min-h-[3.125rem] md:px-3 md:py-2.5 md:text-sm'

/**
 * Pulsanti aggiungi sottotab.
 * - presentation=null: mostra entrambi (prima scelta)
 * - presentation='cards': solo «+ Card scorrevole»
 * - presentation='carousel': **un solo carosello per modalità** — se già presente non mostra nulla
 */
function SubTabAddButtons({
  presentation,
  carouselAlreadyExists,
  onAddCards,
  onAddCarousel,
}: {
  presentation: 'cards' | 'carousel' | null
  /** True se esiste già una sottotab carousel (salvata o in bozza). */
  carouselAlreadyExists: boolean
  onAddCards: () => void
  onAddCarousel: () => void
}) {
  if (presentation === 'cards') {
    return (
      <Button type="button" variant="outline" size="sm" onClick={onAddCards} className={SUB_TAB_ADD_BUTTON_CLASS}>
        + Card scorrevole
      </Button>
    )
  }
  if (presentation === 'carousel') {
    // Un solo carosello per modalità: pulsante nascosto se ne esiste già uno.
    if (carouselAlreadyExists) return null
    return (
      <Button type="button" variant="outline" size="sm" onClick={onAddCarousel} className={SUB_TAB_ADD_BUTTON_CLASS}>
        + Carosello
      </Button>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <Button type="button" variant="outline" size="sm" onClick={onAddCards} className={SUB_TAB_ADD_BUTTON_CLASS}>
        + Card scorrevole
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onAddCarousel} className={SUB_TAB_ADD_BUTTON_CLASS}>
        + Carosello
      </Button>
    </div>
  )
}

/** Badge che mostra la presentazione scelta con link per cambiarla (previo reset). */
function SubTabsPresentationBadge({
  presentation,
  onReset,
}: {
  presentation: 'cards' | 'carousel'
  onReset: () => void
}) {
  const label = presentation === 'cards' ? 'Card scorrevoli' : 'Carosello'
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span>
        Modalità impostata: <strong className="text-slate-800">{label}</strong>
      </span>
      <button
        type="button"
        onClick={() => {
          const currentDataLabel = presentation === 'cards' ? 'Card scorrevole' : 'Carosello'
          const ok = window.confirm(
            `Se cambi presentazione perderai i dati del "${currentDataLabel}". Sei sicuro di voler procedere?`,
          )
          if (!ok) return
          onReset()
        }}
        className="ml-auto text-primary-700 underline hover:text-primary-900"
      >
        Cambia presentazione
      </button>
    </div>
  )
}

type BookingFormConfigPanelProps = {
  /** Es. sezione «Sfondo pagina Prenota» subito sotto le modalità. */
  afterBookingModesSection?: React.ReactNode
  /** Sfondo pagina Prenota: modifiche non ancora su DB. */
  bookingBgDirty?: boolean
  onSaveBookingBackground?: () => void | Promise<void>
  onCancelBookingBackground?: () => void
}

export { FormSectionFloatingActions } from '@/features/booking/components/settings/SettingsSaveUi'

export const BookingFormConfigPanel: React.FC<BookingFormConfigPanelProps> = ({
  afterBookingModesSection,
  bookingBgDirty = false,
  onSaveBookingBackground,
  onCancelBookingBackground,
}) => {
  const { organizationName, tenantId } = useTenantContext()
  const { registerUnsavedSource, registerUnsavedHandlers, clearUnsavedSource } =
    useUnsavedChangesGuard()
  const { data: savedConfig } = useRestaurantSetting('booking_public_form_config')
  const { data: restaurantName } = useRestaurantSetting('restaurant_name')
  const { data: customPresetsRaw } = useRestaurantSetting('booking_custom_staff_presets')
  const { data: menuItems = [] } = useMenuItems()
  const { data: menuCategories = [] } = useMenuCategories()
  const upsert = useUpsertRestaurantSetting()

  const displayRestaurantName =
    (typeof restaurantName === 'string' ? restaurantName.trim() : '') ||
    organizationName?.trim() ||
    ''

  const [config, setConfig] = useState<BookingPublicFormConfig>(DEFAULT_BOOKING_FORM_CONFIG)
  const [headerTextDirty, setHeaderTextDirty] = useState(false)
  const [headerStylesDirty, setHeaderStylesDirty] = useState(false)
  const [modesDirty, setModesDirty] = useState(false)
  const [promoDirty, setPromoDirty] = useState(false)
  const headerTextDirtyRef = useRef(false)
  const headerStylesDirtyRef = useRef(false)
  const modesDirtyRef = useRef(false)
  const promoDirtyRef = useRef(false)
  const promoSectionRef = useRef<BookingFormPromoSectionHandle>(null)
  headerTextDirtyRef.current = headerTextDirty
  headerStylesDirtyRef.current = headerStylesDirty
  modesDirtyRef.current = modesDirty
  promoDirtyRef.current = promoDirty
  const headerTextFooterDirty = SETTINGS_AUTOSAVE_ENABLED ? false : headerTextDirty
  const personalizzaFormDirty =
    headerTextFooterDirty || headerStylesDirty || modesDirty || promoDirty || bookingBgDirty
  const [expandedMode, setExpandedMode] = useState<string | null>(null)
  const [draftSubTabsByMode, setDraftSubTabsByMode] = useState<Record<string, SubTab | null>>({})
  const [expandedSubTabByMode, setExpandedSubTabByMode] = useState<Record<string, string | null>>({})
  /** Testo grezzo dimensione font mentre l'utente digita (evita clamp 8–38 fino al blur). */
  const [headerFontSizeDraftByTarget, setHeaderFontSizeDraftByTarget] = useState<
    Partial<Record<BookingHeaderTextTarget, string>>
  >({})
  const allPresets: CustomStaffPreset[] = Array.isArray(customPresetsRaw) ? customPresetsRaw : []

  const withMergedSubTabLabels = (cfg: BookingPublicFormConfig): BookingPublicFormConfig => ({
    ...cfg,
    booking_modes: cfg.booking_modes.map((m) => ({
      ...m,
      sub_tabs: applyLegacySubTabLabelOverrides(
        m.sub_tabs ?? [],
        m.sub_tabs_overrides,
        allPresets,
      ),
    })),
  })

  useEffect(() => {
    if (savedConfig && !headerTextDirty && !headerStylesDirty && !modesDirty) {
      setConfig(withMergedSubTabLabels(savedConfig))
      setHeaderFontSizeDraftByTarget({})
    }
  }, [savedConfig, headerTextDirty, headerStylesDirty, modesDirty, customPresetsRaw])

  useEffect(() => {
    setHeaderTextDirty(false)
    setHeaderStylesDirty(false)
    setModesDirty(false)
    setPromoDirty(false)
    setDraftSubTabsByMode({})
    setExpandedSubTabByMode({})
    setExpandedMode(null)
    clearUnsavedSource('booking-form-config')
  }, [tenantId, clearUnsavedSource])

  useEffect(() => {
    registerUnsavedSource('booking-form-config', 'Personalizza form', personalizzaFormDirty)
    return () => {
      if (
        !headerTextDirtyRef.current &&
        !headerStylesDirtyRef.current &&
        !modesDirtyRef.current &&
        !promoDirtyRef.current
      ) {
        clearUnsavedSource('booking-form-config')
      }
    }
  }, [clearUnsavedSource, personalizzaFormDirty, registerUnsavedSource])

  const markHeaderTextDirty = () => setHeaderTextDirty(true)
  const markHeaderStylesDirty = () => setHeaderStylesDirty(true)
  const markModesDirty = () => setModesDirty(true)

  const getSavedBaseline = () => savedConfig ?? DEFAULT_BOOKING_FORM_CONFIG

  const updateMode = (modeId: string, patch: Partial<BookingMode>) => {
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => (m.id === modeId ? { ...m, ...patch } : m)),
    }))
    markModesDirty()
  }

  const updateSubTab = (modeId: string, subTabId: string, patch: Partial<SubTab>) => {
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => {
        if (m.id !== modeId) return m
        return {
          ...m,
          sub_tabs: (m.sub_tabs ?? []).map((t) =>
            t.id === subTabId ? applyPatchWithOverrideTracking(t, patch) : t,
          ),
        }
      }),
    }))
    markModesDirty()
  }

  const addSubTab = (modeId: string, display: SubTab['display']) => {
    // Difesa runtime: un solo carosello per modalità (la UI nasconde il pulsante,
    // questa guard previene aggiunte da percorsi alternativi futuri).
    if (display === 'carousel') {
      const mode = config.booking_modes.find((m) => m.id === modeId)
      const hasCarousel = mode?.sub_tabs?.some((t) => t.display === 'carousel') ?? false
      if (hasCarousel) return
    }
    // Prima sottotab: imposta la presentazione XOR sulla modalità
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => {
        if (m.id !== modeId) return m
        if (m.sub_tabs_presentation != null) return m
        return { ...m, sub_tabs_presentation: display }
      }),
    }))
    setDraftSubTabsByMode((prev) => ({ ...prev, [modeId]: newSubTab(display) }))
    markModesDirty()
  }

  const resetSubTabsPresentation = (modeId: string) => {
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) =>
        m.id === modeId ? { ...m, sub_tabs_presentation: null, sub_tabs: [] } : m,
      ),
    }))
    closeSubTabEditors(modeId)
    markModesDirty()
  }

  const updateDraftSubTab = (modeId: string, patch: Partial<SubTab>) => {
    setDraftSubTabsByMode((prev) => {
      const current = prev[modeId]
      if (!current) return prev
      return { ...prev, [modeId]: applyPatchWithOverrideTracking(current, patch) }
    })
  }

  const cancelDraftSubTab = (modeId: string) => {
    setDraftSubTabsByMode((prev) => ({ ...prev, [modeId]: null }))
    const mode = config.booking_modes.find((m) => m.id === modeId)
    if ((mode?.sub_tabs ?? []).length === 0) {
      updateMode(modeId, { sub_tabs_presentation: null })
    }
  }

  /**
   * Snapshot della card dopo import preset: tutti i campi «vetrina» tornano a «ereditato dal preset»
   * (`field_overrides[*] = false`), così cambi futuri al preset si propagano in automatico.
   * Nota: il titolo card viene sempre riallineato al nome del preset importato.
   */
  const buildSubTabFromPreset = (_current: SubTab, preset: CustomStaffPreset): Partial<SubTab> => {
    const overrides = presetImportFieldOverrides()
    const isFixedMenu = preset.is_fixed_menu !== false
    return {
      preset_id: preset.id,
      label: preset.name.slice(0, L.subTabLabel),
      description: preset.description?.trim() || undefined,
      price_per_person:
        isFixedMenu && preset.price_per_person && preset.price_per_person > 0
          ? preset.price_per_person
          : undefined,
      is_fixed_menu: isFixedMenu ? undefined : false,
      hidden_item_ids: [],
      hidden_category_keys: [],
      category_order_keys: undefined,
      field_overrides: overrides,
    }
  }

  const importPresetIntoSubTab = (modeId: string, subTabId: string, presetId: string) => {
    const preset = allPresets.find((p) => p.id === presetId)
    if (!preset) return
    const current = config.booking_modes
      .find((m) => m.id === modeId)
      ?.sub_tabs?.find((t) => t.id === subTabId)
    if (!current) return
    // Bypass tracking: scriviamo field_overrides esplicito dentro il patch
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => {
        if (m.id !== modeId) return m
        return {
          ...m,
          sub_tabs: (m.sub_tabs ?? []).map((t) =>
            t.id === subTabId ? { ...t, ...buildSubTabFromPreset(current, preset) } : t,
          ),
        }
      }),
    }))
    markModesDirty()
  }

  const importPresetIntoDraftSubTab = (modeId: string, presetId: string) => {
    const preset = allPresets.find((p) => p.id === presetId)
    if (!preset) return
    const current = draftSubTabsByMode[modeId] ?? undefined
    if (!current) return
    setDraftSubTabsByMode((prev) => {
      const draft = prev[modeId]
      if (!draft) return prev
      return { ...prev, [modeId]: { ...draft, ...buildSubTabFromPreset(current, preset) } }
    })
  }

  const removeSubTab = (modeId: string, subTabId: string) => {
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => {
        if (m.id !== modeId) return m
        const subTabs = (m.sub_tabs ?? []).filter((t) => t.id !== subTabId)
        return {
          ...m,
          sub_tabs: subTabs,
          sub_tabs_presentation: subTabs.length === 0 ? null : m.sub_tabs_presentation,
        }
      }),
    }))
    setExpandedSubTabByMode((prev) => ({ ...prev, [modeId]: null }))
    markModesDirty()
  }

  const moveSubTab = (modeId: string, subTabId: string, direction: 'up' | 'down') => {
    setConfig((prev) => ({
      ...prev,
      booking_modes: prev.booking_modes.map((m) => {
        if (m.id !== modeId) return m
        const tabs = [...(m.sub_tabs ?? [])]
        const idx = tabs.findIndex((t) => t.id === subTabId)
        if (idx < 0) return m
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= tabs.length) return m
        ;[tabs[idx], tabs[swapIdx]] = [tabs[swapIdx], tabs[idx]]
        return { ...m, sub_tabs: tabs }
      }),
    }))
    markModesDirty()
  }

  const mergeConfigAfterPartialSave = (
    normalized: BookingPublicFormConfig,
    savedPart: 'header' | 'modes',
  ) => {
    setConfig((prev) => {
      if (savedPart === 'header' && modesDirty) {
        return { ...normalized, booking_modes: prev.booking_modes }
      }
      if (savedPart === 'modes' && (headerTextDirty || headerStylesDirty)) {
        return {
          ...normalized,
          page_title: prev.page_title,
          page_description: prev.page_description,
          header_styles: prev.header_styles,
        }
      }
      return normalized
    })
  }

  const headerAutosave = useDebouncedSettingsAutosave({
    enabled: SETTINGS_AUTOSAVE_ENABLED,
    tenantId,
    fields: {
      page_title: {
        value: config.page_title,
        baseline: getSavedBaseline().page_title,
      },
      page_description: {
        value: config.page_description,
        baseline: getSavedBaseline().page_description,
      },
    },
    onSave: async (keys) => {
      const saved = getSavedBaseline()
      const nextTitle = keys.includes('page_title') ? config.page_title : saved.page_title
      const nextDescription = keys.includes('page_description')
        ? config.page_description
        : saved.page_description
      const normalized = normalizeBookingPublicFormConfig({
        ...saved,
        page_title: nextTitle,
        page_description: nextDescription,
        header_styles: config.header_styles,
        booking_modes: config.booking_modes,
      })
      await upsert.mutateAsync({
        items: [{ key: 'booking_public_form_config', value: normalized }],
        options: { silent: true },
      })
      mergeConfigAfterPartialSave(normalized, 'header')
      setHeaderTextDirty(false)
    },
  })

  const updateField = (
    field: keyof Pick<BookingPublicFormConfig, 'page_title' | 'page_description'>,
    value: string,
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
    if (!SETTINGS_AUTOSAVE_ENABLED) markHeaderTextDirty()
    headerAutosave.notifyFieldChange(field)
  }

  const updateHeaderTextStyle = (
    target: BookingHeaderTextTarget,
    patch: Partial<BookingHeaderTextStyle>,
  ) => {
    setConfig((prev) => {
      const currentStyles = prev.header_styles ?? DEFAULT_BOOKING_FORM_CONFIG.header_styles
      const currentTarget = currentStyles[target] ?? DEFAULT_BOOKING_FORM_CONFIG.header_styles[target]
      return {
        ...prev,
        header_styles: {
          ...currentStyles,
          [target]: {
            ...currentTarget,
            ...patch,
            color: patch.color
              ? normalizeBookingHeaderColor(patch.color, currentTarget.color)
              : currentTarget.color,
          },
        },
      }
    })
    markHeaderStylesDirty()
  }

  const saveHeaderSection = async () => {
    const saved = getSavedBaseline()
    const normalized = normalizeBookingPublicFormConfig({
      ...saved,
      page_title: config.page_title,
      page_description: config.page_description,
      header_styles: config.header_styles,
    })
    await upsert.mutateAsync([{ key: 'booking_public_form_config', value: normalized }])
    mergeConfigAfterPartialSave(normalized, 'header')
    setHeaderTextDirty(false)
    setHeaderStylesDirty(false)
  }

  const closeSubTabEditors = (modeId?: string) => {
    if (modeId !== undefined) {
      setDraftSubTabsByMode((prev) => ({ ...prev, [modeId]: null }))
      setExpandedSubTabByMode((prev) => ({ ...prev, [modeId]: null }))
    } else {
      setDraftSubTabsByMode({})
      setExpandedSubTabByMode({})
    }
  }

  const persistModesSection = async (bookingModes: BookingPublicFormConfig['booking_modes']) => {
    const saved = getSavedBaseline()
    const modesForDb = bookingModes.map((m) => ({
      ...m,
      sub_tabs_overrides: undefined,
    }))
    const normalized = normalizeBookingPublicFormConfig({
      ...saved,
      booking_modes: modesForDb,
    })
    await upsert.mutateAsync([{ key: 'booking_public_form_config', value: normalized }])
    mergeConfigAfterPartialSave(normalized, 'modes')
    setModesDirty(false)
    closeSubTabEditors()
  }

  const saveModesSection = async () => {
    const bookingModes = mergeOpenSubTabEditorsIntoModes(config.booking_modes, draftSubTabsByMode)
    const validationError = findSubTabValidationError(bookingModes)
    if (validationError) {
      toast.error(validationError)
      return
    }
    const hasOpenDrafts = Object.values(draftSubTabsByMode).some(Boolean)
    if (hasOpenDrafts) {
      setConfig((prev) => ({ ...prev, booking_modes: bookingModes }))
    }
    try {
      await persistModesSection(bookingModes)
    } catch {
      markModesDirty()
      toast.error('Errore nel salvataggio modalità')
    }
  }

  const handleCancelFormChanges = () => {
    headerAutosave.cancelPending()
    const baseline = getSavedBaseline()
    const headerDirtyCombined = headerTextDirty || headerStylesDirty
    if (headerDirtyCombined && modesDirty) {
      setConfig(baseline)
    } else if (headerDirtyCombined) {
      setConfig((prev) => ({
        ...prev,
        page_title: baseline.page_title,
        page_description: baseline.page_description,
        header_styles: baseline.header_styles,
      }))
    } else if (modesDirty) {
      setConfig((prev) => ({ ...prev, booking_modes: baseline.booking_modes }))
    }
    closeSubTabEditors()
    setHeaderTextDirty(false)
    setHeaderStylesDirty(false)
    setModesDirty(false)
  }

  const pageHasUnsaved = personalizzaFormDirty

  const handleSaveAllPage = async () => {
    try {
      if (headerTextDirty || headerStylesDirty) await saveHeaderSection()
      if (modesDirty) await saveModesSection()
      if (promoDirty && promoSectionRef.current) await promoSectionRef.current.save()
      if (bookingBgDirty && onSaveBookingBackground) await onSaveBookingBackground()
    } catch {
      toast.error('Errore nel salvataggio')
    }
  }

  const handleCancelAllPage = () => {
    handleCancelFormChanges()
    if (promoDirty) promoSectionRef.current?.cancel()
    onCancelBookingBackground?.()
  }

  useEffect(() => {
    registerUnsavedHandlers('booking-form-config', {
      saveAll: handleSaveAllPage,
      discardAll: handleCancelAllPage,
    })
    return () => registerUnsavedHandlers('booking-form-config', null)
  }, [handleCancelAllPage, handleSaveAllPage, registerUnsavedHandlers])

  const headerStyles = config.header_styles ?? DEFAULT_BOOKING_FORM_CONFIG.header_styles

  const getSubTabEditorTitle = (tab: SubTab, number: number, isDraft: boolean) => {
    if (tab.display === 'carousel') {
      const name = tab.label?.trim()
      return name || `Carosello ${number}`
    }
    if (isDraft) {
      const trimmed = tab.label?.trim() ?? ''
      if (trimmed) return `${trimmed} · Card ${number}`
      return `Nuova card · Card ${number}`
    }
    return `Card ${number}`
  }
  const headerControlClass =
    'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-300'

  const headerStyleToggleClass = (active: boolean) =>
    cn(
      'h-9 min-w-9 rounded-lg border px-2 text-xs font-bold transition-colors',
      active
        ? 'border-primary-500 bg-primary-50 text-primary-700'
        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
    )

  const renderHeaderStyleControls = (target: BookingHeaderTextTarget) => {
    const style = headerStyles[target] ?? DEFAULT_BOOKING_FORM_CONFIG.header_styles[target]
    const currentAlign = style.textAlign ?? 'center'
    const fontSizeDraft = headerFontSizeDraftByTarget[target]
    const fontSizeMax = getBookingHeaderFontSizeMax(target)
    const fontSizeInputValue =
      fontSizeDraft !== undefined ? fontSizeDraft : String(style.fontSize)
    const isBold = style.fontWeight === 'bold'
    const isUnderlined = style.textDecoration === 'underline'
    return (
      <div className="mt-2 space-y-1">
        <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(3.25rem,4rem)_auto] gap-2 items-end">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Font</span>
            <select
              value={style.font}
              onChange={(e) =>
                updateHeaderTextStyle(target, {
                  font: e.target.value as BookingHeaderTextStyle['font'],
                })
              }
              className={headerControlClass}
            >
              {BOOKING_HEADER_FONT_OPTIONS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Colore</span>
            <input
              type="color"
              value={style.color}
              onChange={(e) => updateHeaderTextStyle(target, { color: e.target.value })}
              className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">
              Dimensione ({BOOKING_HEADER_FONT_SIZE_MIN}–{fontSizeMax})
            </span>
            <input
              type="text"
              inputMode="numeric"
              aria-valuemin={BOOKING_HEADER_FONT_SIZE_MIN}
              aria-valuemax={fontSizeMax}
              value={fontSizeInputValue}
              onChange={(e) => {
                const raw = e.target.value.trim()
                if (raw !== '' && !/^\d+$/.test(raw)) return
                setHeaderFontSizeDraftByTarget((prev) => ({ ...prev, [target]: raw }))
                if (raw === '') return
                const next = Number(raw)
                if (!Number.isFinite(next)) return
                updateHeaderTextStyle(target, { fontSize: next })
              }}
              onBlur={() => {
                const raw =
                  headerFontSizeDraftByTarget[target] ?? String(style.fontSize)
                setHeaderFontSizeDraftByTarget((prev) => {
                  const next = { ...prev }
                  delete next[target]
                  return next
                })
                const parsed = raw.trim() === '' ? style.fontSize : Number(raw)
                updateHeaderTextStyle(target, {
                  fontSize: normalizeBookingHeaderFontSize(parsed, target),
                })
              }}
              className={`${headerControlClass} w-full tabular-nums`}
            />
          </label>
          <div className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-500">Allineamento</span>
            <div className="flex gap-0.5">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => updateHeaderTextStyle(target, { textAlign: align })}
                  className={`h-9 w-9 rounded-lg border text-xs font-bold transition-colors ${
                    currentAlign === align
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                  title={align === 'left' ? 'Sinistra' : align === 'center' ? 'Centro' : 'Destra'}
                >
                  {align === 'left' ? '⬅' : align === 'center' ? '↔' : '➡'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Stile testo</span>
          <button
            type="button"
            onClick={() =>
              updateHeaderTextStyle(target, { fontWeight: isBold ? 'normal' : 'bold' })
            }
            className={headerStyleToggleClass(isBold)}
            title={isBold ? 'Grassetto attivo' : 'Attiva grassetto'}
            aria-pressed={isBold}
          >
            G
          </button>
          <button
            type="button"
            onClick={() =>
              updateHeaderTextStyle(target, {
                textDecoration: isUnderlined ? 'none' : 'underline',
              })
            }
            className={cn(headerStyleToggleClass(isUnderlined), 'underline')}
            title={isUnderlined ? 'Sottolineato attivo' : 'Attiva sottolineatura'}
            aria-pressed={isUnderlined}
          >
            S
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Valore da {BOOKING_HEADER_FONT_SIZE_MIN} a {fontSizeMax} (px)
        </p>
      </div>
    )
  }

  const renderSubTabEditor = ({
    mode,
    tab,
    relevantPresets,
    subTabNumber,
    isDraft,
    headerActions,
    embedded,
  }: {
    mode: BookingMode
    tab: SubTab
    relevantPresets: CustomStaffPreset[]
    subTabNumber: number
    isDraft: boolean
    headerActions?: React.ReactNode
    /** Dentro card collassabile: senza bordo/titolo duplicato. */
    embedded?: boolean
  }) => {
    const patchTab = (patch: Partial<SubTab>) => {
      if (isDraft) updateDraftSubTab(mode.id, patch)
      else updateSubTab(mode.id, tab.id, patch)
    }
    const toggleCategory = (categoryKey: string) => {
      const hidden = new Set(tab.hidden_category_keys ?? [])
      if (hidden.has(categoryKey)) hidden.delete(categoryKey)
      else hidden.add(categoryKey)
      patchTab({ hidden_category_keys: Array.from(hidden) })
    }
    const toggleItem = (itemId: string) => {
      const hidden = new Set(tab.hidden_item_ids ?? [])
      if (hidden.has(itemId)) hidden.delete(itemId)
      else hidden.add(itemId)
      patchTab({ hidden_item_ids: Array.from(hidden) })
    }
    const linkedPreset = tab.preset_id
      ? relevantPresets.find((preset) => preset.id === tab.preset_id)
      : undefined
    const presetItemIds = new Set(linkedPreset?.item_ids ?? [])
    const presetCategoryKeys =
      linkedPreset != null
        ? menuCategories
            .filter((cat) =>
              menuItems.some(
                (item) => item.category === cat.key && presetItemIds.has(item.id),
              ),
            )
            .map((cat) => cat.key)
        : []
    const categorySortOrderMap = buildCategorySortOrderMap(menuCategories)
    // Chiavi nascoste restano nell'array ordine; in Pagina Prenota vengono filtrate dopo l'ordinamento.
    const orderedPresetCategoryKeys = orderCategoryKeys(
      presetCategoryKeys,
      tab.field_overrides?.category_order_keys ? tab.category_order_keys : undefined,
      categorySortOrderMap,
    )
    const categoryByKey = new Map(menuCategories.map((cat) => [cat.key, cat]))
    // Lo swap delle frecce deve operare sulle STESSE chiavi mostrate all'admin
    // (`orderedPresetCategoryKeys`: orfane già filtrate, duplicati rimossi, ordine salvato
    // preservato). Usare il `tab.category_order_keys` grezzo disallineerebbe l'index della riga
    // visualizzata dall'array su cui si fa lo swap quando ci sono chiavi stale → la freccia
    // sposterebbe la categoria sbagliata o sembrerebbe inerte. Scrivere l'ordine pulito ripara
    // anche eventuali residui stale/duplicati salvati in precedenza.
    const resolveCategoryOrderForMove = (): string[] => [...orderedPresetCategoryKeys]
    const moveCategoryUp = (index: number) => {
      if (index <= 0) return
      const order = resolveCategoryOrderForMove()
      ;[order[index - 1], order[index]] = [order[index], order[index - 1]]
      patchTab({ category_order_keys: order })
    }
    const moveCategoryDown = (index: number) => {
      if (index >= orderedPresetCategoryKeys.length - 1) return
      const order = resolveCategoryOrderForMove()
      ;[order[index], order[index + 1]] = [order[index + 1], order[index]]
      patchTab({ category_order_keys: order })
    }

    const editorTitle = getSubTabEditorTitle(tab, subTabNumber, isDraft)
    const isLinkedCard = tab.display === 'cards' && Boolean(linkedPreset)
    const isFixedMenu = tab.display === 'carousel' || !isLinkedCard || tab.is_fixed_menu !== false
    const cardPriceInputValue =
      tab.display === 'cards' &&
      tab.field_overrides?.price_per_person !== true &&
      linkedPreset?.price_per_person != null
        ? linkedPreset.price_per_person
        : tab.price_per_person
    const renderEditorTitle = (extraClassName?: string) => (
      <span className={cn('min-w-0 truncate text-xs font-semibold uppercase text-slate-600', extraClassName)}>
        {editorTitle}
      </span>
    )
    const renderPriceInput = (disabled: boolean, value: number | undefined = tab.price_per_person) => (
      <div className="relative w-full max-w-xs">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={disabled ? '' : (value ?? '')}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value
            patchTab({
              price_per_person: v === '' ? undefined : Math.max(0, parseFloat(v) || 0),
            })
          }}
          placeholder="45.00"
          className="w-full pr-9 disabled:bg-slate-100 disabled:text-slate-400"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500">
          €
        </span>
      </div>
    )
    const cardPriceSection =
      tab.display === 'cards' ? (
        <div className="mt-4 w-full min-w-0 space-y-1.5">
          <Label className="block text-sm">Prezzo a persona</Label>
          {renderPriceInput(!isFixedMenu, cardPriceInputValue)}
        </div>
      ) : null
    const showOfferDetailsInSummary = tab.show_offer_details_in_summary !== false
    const carouselPriceSection =
      tab.display === 'carousel' ? (
        <div className="w-full min-w-0 space-y-3">
          <div className="space-y-1.5">
            <Label className="block text-sm">Prezzo a persona (opzionale)</Label>
            {renderPriceInput(false)}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Mostra dettaglio offerta</p>
              <p className="text-xs text-slate-500">
                Nel riepilogo Prenota mostra o nasconde il nome carosello e i titoli delle slide.
                Il prezzo a persona resta visibile solo se compilato sotto, indipendentemente da questo
                interruttore.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showOfferDetailsInSummary}
              aria-label="Mostra dettaglio offerta"
              onClick={() =>
                patchTab({
                  show_offer_details_in_summary: showOfferDetailsInSummary ? false : undefined,
                })
              }
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400',
                showOfferDetailsInSummary
                  ? 'border-primary-600 bg-primary-600'
                  : 'border-slate-300 bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                  showOfferDetailsInSummary ? 'translate-x-5' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        </div>
      ) : null

    return (
      <div
        className={cn(
          'w-full min-w-0 space-y-4',
          embedded ? 'p-4 md:p-5' : 'rounded-lg border border-slate-200 bg-slate-50/50 p-4 md:p-5',
        )}
      >
        {!embedded ? (
          <div className="flex items-center justify-between gap-2">
            {renderEditorTitle('max-w-[55%]')}
            <div className="flex shrink-0 items-center gap-2">
              {tab.display === 'carousel' && (tab.carousel_items?.length ?? 0) > 0 ? (
                <span className="text-xs font-semibold text-slate-600 sm:hidden">Foto N° 1</span>
              ) : null}
              {headerActions ??
                (!isDraft ? (
                  <button
                    type="button"
                    title="Elimina"
                    onClick={() => removeSubTab(mode.id, tab.id)}
                    className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <TrashIcon weight="regular" className="h-4 w-4" />
                  </button>
                ) : null)}
            </div>
          </div>
        ) : headerActions ? (
          <div className="flex items-center justify-end gap-3">{headerActions}</div>
        ) : null}

        {tab.display === 'carousel' && tenantId ? (
          <>
            <AdminFieldWithCharCount
              label="Nome carosello"
              value={tab.label}
              maxLength={L.subTabLabel}
              onChange={(label) => patchTab({ label })}
              placeholder="Nome tecnico per admin"
              singleLine
            />
            {carouselPriceSection}
            <BookingFormCarouselEditor
              tenantId={tenantId}
              modeId={mode.id}
              tab={tab}
              onPatchTab={patchTab}
              firstSlideLabelInParentHeader={!embedded}
            />
          </>
        ) : null}

        {tab.display === 'cards' && (
          <>
            <AdminFieldWithCharCount
              label="Titolo card"
              value={tab.label ?? ''}
              maxLength={L.subTabLabel}
              onChange={(label) => patchTab({ label })}
              placeholder="Nome card scorrevole"
              singleLine
            />
          </>
        )}

        {tab.display === 'cards' && (
          <div className="w-full min-w-0 space-y-1.5 -mt-2">
            <Label className="block text-sm">Importa menù preselezionato</Label>
            {relevantPresets.length > 0 ? (
              <select
                value={tab.preset_id ?? ''}
                onChange={(e) => {
                  const presetId = e.target.value
                  if (presetId) {
                    if (isDraft) importPresetIntoDraftSubTab(mode.id, presetId)
                    else importPresetIntoSubTab(mode.id, tab.id, presetId)
                  } else {
                    patchTab({
                      preset_id: undefined,
                      label: '',
                      hidden_category_keys: [],
                      hidden_item_ids: [],
                      category_order_keys: undefined,
                    })
                  }
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Compila manualmente</option>
                {relevantPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500">
                Nessun menù preselezionato per questa modalità (tab Menu in admin).
              </p>
            )}
          </div>
        )}

        {tab.display === 'cards' && (
          <AdminFieldWithCharCount
            label="Descrizione breve (opzionale)"
            value={tab.description ?? ''}
            maxLength={L.subTabDescription}
            onChange={(description) =>
              patchTab({
                description: description === '' ? undefined : description,
              })
            }
            placeholder="Sottotitolo sulla card"
          />
        )}

        {tab.display === 'cards' && (
          <div className="w-full min-w-0 space-y-1.5">
            <div>
              <Label htmlFor={`sub-tab-courses-${tab.id}`} className="block text-sm">
                Numero Portate
              </Label>
              <p className="mt-0.5 text-xs text-slate-500">
                Mostra a clienti da quante portate è composto il menù.
              </p>
            </div>
            <Input
              id={`sub-tab-courses-${tab.id}`}
              value={tab.courses_label ?? ''}
              onChange={(e) =>
                patchTab({
                  courses_label: e.target.value.slice(0, L.subTabCoursesLabel) || undefined,
                })
              }
              onBlur={(e) => {
                const trimmed = e.target.value.trim()
                if (trimmed !== (tab.courses_label ?? '')) {
                  patchTab({ courses_label: trimmed || undefined })
                }
              }}
              maxLength={L.subTabCoursesLabel}
              placeholder="es. 4 portate"
            />
          </div>
        )}

        {tab.display === 'cards' && (
          <div className="w-full min-w-0 space-y-1.5 -mt-2">
            <Label className="block text-sm">Icona</Label>
            <MenuCategoryIconPicker
              allowNone
              value={tab.icon}
              onChange={(icon) => patchTab({ icon })}
              ariaLabel={`Icona card ${tab.label || 'scorrevole'}`}
            />
          </div>
        )}

        {tab.display === 'cards' &&
          linkedPreset &&
          bookingTypeUsesMenuItems(mode.booking_type, menuItems) && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Categorie e ingredienti visibili
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                L&apos;ordine si vede nella pagina Prenota per questa tipologia. Non modifica il Menu QR.
              </p>
            </div>
            <div className="space-y-2">
              {orderedPresetCategoryKeys.map((categoryKey, categoryIndex) => {
                const cat = categoryByKey.get(categoryKey)
                if (!cat) return null
                const itemsForCat = menuItems.filter(
                  (item) =>
                    item.category === cat.key &&
                    presetItemIds.has(item.id),
                )
                if (itemsForCat.length === 0) return null
                const catHidden = (tab.hidden_category_keys ?? []).includes(cat.key)
                const hiddenItemIds = tab.hidden_item_ids ?? []
                const visibleInCat = catHidden
                  ? 0
                  : itemsForCat.filter((item) => !hiddenItemIds.includes(item.id)).length
                return (
                  <details key={cat.key} className="rounded-lg border border-slate-200 bg-slate-50">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                      <div className="flex shrink-0 flex-col gap-0.5">
                        <button
                          type="button"
                          disabled={categoryIndex === 0}
                          onClick={(e) => {
                            e.preventDefault()
                            moveCategoryUp(categoryIndex)
                          }}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          aria-label={`Sposta ${cat.label} su`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={categoryIndex === orderedPresetCategoryKeys.length - 1}
                          onClick={(e) => {
                            e.preventDefault()
                            moveCategoryDown(categoryIndex)
                          }}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          aria-label={`Sposta ${cat.label} giù`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={catHidden ? `Mostra ${cat.label}` : `Nascondi ${cat.label}`}
                        onClick={(e) => {
                          e.preventDefault()
                          toggleCategory(cat.key)
                        }}
                        className={cn(
                          'rounded-md border p-1.5',
                          catHidden
                            ? 'border-slate-300 text-slate-400'
                            : 'border-primary-200 bg-primary-50 text-primary-700',
                        )}
                      >
                        {catHidden ? (
                          <EyeSlashIcon weight="regular" className="h-4 w-4" />
                        ) : (
                          <EyeIcon weight="regular" className="h-4 w-4" />
                        )}
                      </button>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                        {cat.label}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">
                        {visibleInCat} / {itemsForCat.length}
                      </span>
                    </summary>
                    {!catHidden && (
                      <div className="grid grid-cols-1 gap-1 border-t border-slate-200 p-2 sm:grid-cols-2">
                        {itemsForCat.map((item) => {
                          const hidden = hiddenItemIds.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleItem(item.id)}
                              className={cn(
                                'flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs',
                                hidden
                                  ? 'border-slate-200 bg-slate-100 text-slate-400'
                                  : 'border-slate-200 bg-white text-slate-700',
                              )}
                            >
                              {hidden ? (
                                <EyeSlashIcon weight="regular" className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <EyeIcon weight="regular" className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="min-w-0 truncate">{item.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {tab.display === 'cards' && linkedPreset && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Menù personalizzabile</p>
              <p className="text-xs text-slate-500">
                {!isFixedMenu
                  ? 'Il cliente può scegliere dei piatti da questo menù e configurare un menù personalizzato.'
                  : 'Il cliente NON può comporsi un menù personalizzato.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!isFixedMenu}
              onClick={() => {
                const nextCustomizable = isFixedMenu
                patchTab({
                  is_fixed_menu: nextCustomizable ? false : undefined,
                  ...(nextCustomizable ? { price_per_person: undefined } : {}),
                })
              }}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400',
                !isFixedMenu
                  ? 'border-primary-600 bg-primary-600'
                  : 'border-slate-300 bg-slate-200',
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                  !isFixedMenu ? 'translate-x-5' : 'translate-x-1',
                )}
              />
            </button>
          </div>
        )}

        {tab.display === 'cards' && cardPriceSection}

        {isDraft ? (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => cancelDraftSubTab(mode.id)}>
              Annulla
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Blocco 1 — Intestazione pagina */}
      <section className="admin-warm-surface rounded-xl border p-5 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800">Intestazione pagina Prenota</h3>
          <div className="space-y-3">
          <div>
            <Label htmlFor="page_restaurant_name" className="block mb-1 text-sm">
              Nome azienda
            </Label>
            <Input
              id="page_restaurant_name"
              value={displayRestaurantName || '—'}
              readOnly
              disabled
              className="min-h-[3.25rem] cursor-default bg-slate-50/90 py-3 leading-tight text-slate-800 disabled:opacity-100 sm:min-h-[3rem] sm:py-2.5"
              style={getBookingHeaderTextStyle('restaurant_name', headerStyles)}
              aria-describedby="page_restaurant_name_hint"
            />
            <p id="page_restaurant_name_hint" className="mt-1 text-xs text-slate-500">
              Per modificare nome azienda usa la scheda{' '}
              <span className="font-medium text-slate-700">&quot;Anagrafica Azienda&quot;</span> nelle
              Impostazioni.
            </p>
            {renderHeaderStyleControls('restaurant_name')}
          </div>
          <div>
            <Label htmlFor="page_title" className="block mb-1 text-sm">Titolo</Label>
            <Input
              id="page_title"
              value={config.page_title}
              onChange={(e) => updateField('page_title', e.target.value.slice(0, L.pageTitle))}
              onBlur={() => headerAutosave.flushField('page_title')}
              placeholder="es. Richiesta Prenotazione"
              maxLength={L.pageTitle}
              className="min-h-[3rem] py-3 leading-tight sm:min-h-[2.625rem] sm:py-2.5"
              style={getBookingHeaderTextStyle('page_title', headerStyles)}
            />
            <p className={cn(charCountClass, config.page_title.length >= L.pageTitle && 'text-red-500')}>
              {config.page_title.length}/{L.pageTitle}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={headerAutosave.fieldStatus.page_title} />
            ) : null}
            {renderHeaderStyleControls('page_title')}
          </div>
          <div>
            <Label htmlFor="page_description" className="block mb-1 text-sm">Descrizione</Label>
            <textarea
              id="page_description"
              value={config.page_description}
              onChange={(e) =>
                updateField('page_description', e.target.value.slice(0, L.pageDescription))
              }
              onBlur={() => headerAutosave.flushField('page_description')}
              placeholder="Breve descrizione mostrata sotto il titolo"
              maxLength={L.pageDescription}
              rows={3}
              className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 sm:py-2.5"
              style={getBookingHeaderTextStyle('page_description', headerStyles)}
            />
            <p
              className={cn(
                charCountClass,
                config.page_description.length >= L.pageDescription && 'text-red-500',
              )}
            >
              {config.page_description.length}/{L.pageDescription}
            </p>
            {SETTINGS_AUTOSAVE_ENABLED ? (
              <FieldAutosaveIndicator status={headerAutosave.fieldStatus.page_description} />
            ) : null}
            {renderHeaderStyleControls('page_description')}
          </div>
        </div>
      </section>

      {/* Blocco 2 — Le modalità */}
      <section className="admin-warm-surface rounded-xl border p-5 space-y-4 shadow-sm">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800">Modalità di prenotazione</h3>
          <p className="text-sm text-slate-600">
            Scegli quali modalità di prenotazioni sono disponibili, e cosa mostrano.
          </p>
        </div>
        <div className="space-y-3">
          {config.booking_modes.map((mode) => {
            const isOpen = expandedMode === mode.id

            const relevantPresets = allPresets

            const subTabs = mode.sub_tabs ?? []
            const draftSubTab = draftSubTabsByMode[mode.id] ?? null
            const expandedSubTabId = expandedSubTabByMode[mode.id] ?? null

            return (
              <div key={mode.id} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedMode(isOpen ? null : mode.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center',
                        mode.enabled ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-400',
                      )}
                    >
                      <MenuQrCategoryIconGlyph iconKey={mode.icon} className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700">{mode.label}</span>
                    {!mode.enabled && (
                      <span className="text-xs text-slate-400 font-normal">(disabilitata)</span>
                    )}
                  </div>
                  <span className="text-slate-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="px-4 py-4 space-y-4 border-t border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`mode-enabled-${mode.id}`}
                        checked={mode.enabled}
                        onChange={(e) => updateMode(mode.id, { enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor={`mode-enabled-${mode.id}`} className="text-sm font-medium text-slate-700">
                        Modalità attiva
                      </label>
                    </div>

                    <AdminFieldWithCharCount
                      id={`mode-label-${mode.id}`}
                      label="Titolo Card"
                      singleLine
                      value={mode.label}
                      maxLength={L.modeLabel}
                      onChange={(value) => updateMode(mode.id, { label: value })}
                      placeholder="Nome della modalità"
                    />

                    <div>
                      <Label htmlFor={`mode-desc-${mode.id}`} className="block mb-1 text-sm">Descrizione breve</Label>
                      <textarea
                        id={`mode-desc-${mode.id}`}
                        value={mode.description}
                        onChange={(e) =>
                          updateMode(mode.id, {
                            description: e.target.value.slice(0, L.modeDescription),
                          })
                        }
                        maxLength={L.modeDescription}
                        rows={3}
                        placeholder="Una riga descrittiva"
                        className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <p className={charCountClass}>
                        {mode.description.length}/{L.modeDescription}
                      </p>
                    </div>

                    <div>
                      <Label className="block mb-1 text-sm">Icona</Label>
                      <MenuCategoryIconPicker
                        value={mode.icon}
                        onChange={(icon: MenuQrCategoryIconKey) => updateMode(mode.id, { icon })}
                        ariaLabel={`Icona tipologia ${mode.label}`}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <span className="text-sm font-medium text-slate-700">
                        Abilita Card o Carosello
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={mode.sub_tabs_enabled}
                        onClick={() => {
                          const nextEnabled = !mode.sub_tabs_enabled
                          if (!nextEnabled) {
                            cancelDraftSubTab(mode.id)
                            closeSubTabEditors(mode.id)
                          }
                          updateMode(mode.id, { sub_tabs_enabled: nextEnabled })
                        }}
                        className={cn(
                          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400',
                          mode.sub_tabs_enabled
                            ? 'border-primary-600 bg-primary-600'
                            : 'border-slate-300 bg-slate-200',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                            mode.sub_tabs_enabled ? 'translate-x-5' : 'translate-x-1',
                          )}
                        />
                      </button>
                    </div>

                    <div className="-mt-2">
                      <SubTabsDisplayHelpPanel />
                    </div>

                    {mode.sub_tabs_enabled && (
                      <div className="mt-5 space-y-3">
                        {mode.sub_tabs_presentation != null ? (
                          <SubTabsPresentationBadge
                            presentation={mode.sub_tabs_presentation}
                            onReset={() => resetSubTabsPresentation(mode.id)}
                          />
                        ) : null}
                        {!draftSubTab && (
                          <SubTabAddButtons
                            presentation={mode.sub_tabs_presentation}
                            carouselAlreadyExists={subTabs.some((t) => t.display === 'carousel')}
                            onAddCards={() => addSubTab(mode.id, 'cards')}
                            onAddCarousel={() => addSubTab(mode.id, 'carousel')}
                          />
                        )}

                        {draftSubTab && (
                          <div className="w-full min-w-0">
                            {renderSubTabEditor({
                              mode,
                              tab: draftSubTab,
                              relevantPresets,
                              subTabNumber: subTabs.length + 1,
                              isDraft: true,
                            })}
                          </div>
                        )}

                        {subTabs.length === 0 && !draftSubTab ? (
                          <p className="text-xs text-slate-500">
                            Nessuna sottotab: aggiungine almeno una o disattiva l&apos;opzione sopra.
                          </p>
                        ) : (
                          <div className="w-full min-w-0 space-y-3">
                            {subTabs.map((tab, tabIdx) => {
                              const savedOpen = expandedSubTabId === tab.id
                              const toggleSavedSubTab = () =>
                                setExpandedSubTabByMode((prev) => ({
                                  ...prev,
                                  [mode.id]: savedOpen ? null : tab.id,
                                }))

                              return (
                                <div
                                  key={tab.id}
                                  className="w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
                                >
                                  <div className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/80">
                                    <button
                                      type="button"
                                      aria-expanded={savedOpen}
                                      onClick={toggleSavedSubTab}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <span className="block min-w-0 truncate text-xs font-semibold uppercase text-slate-500">
                                        {getSubTabCollapsedRowTitle(tab, tabIdx + 1)}
                                      </span>
                                    </button>
                                    <div className="flex shrink-0 items-center gap-1">
                                      {tab.display !== 'carousel' ? (
                                        <>
                                          <button
                                            type="button"
                                            title="Sposta su"
                                            disabled={tabIdx === 0}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              moveSubTab(mode.id, tab.id, 'up')
                                            }}
                                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
                                          >
                                            <CaretUpIcon weight="regular" className="h-4 w-4" />
                                          </button>
                                          <button
                                            type="button"
                                            title="Sposta giù"
                                            disabled={tabIdx === subTabs.length - 1}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              moveSubTab(mode.id, tab.id, 'down')
                                            }}
                                            className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40"
                                          >
                                            <CaretDownIcon weight="regular" className="h-4 w-4" />
                                          </button>
                                        </>
                                      ) : null}
                                      <button
                                        type="button"
                                        title="Elimina"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          removeSubTab(mode.id, tab.id)
                                        }}
                                        className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                      >
                                        <TrashIcon weight="regular" className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                  {savedOpen ? (
                                    <div className="border-t border-slate-200 bg-slate-50/50">
                                      {renderSubTabEditor({
                                        mode,
                                        tab,
                                        relevantPresets,
                                        subTabNumber: tabIdx + 1,
                                        isDraft: false,
                                        embedded: true,
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <BookingFormPromoSection
        ref={promoSectionRef}
        bookingModes={config.booking_modes}
        onDirtyChange={setPromoDirty}
      />

      {afterBookingModesSection != null && afterBookingModesSection}

      {pageHasUnsaved && (
        <SettingsSaveFooter
          onCancel={handleCancelAllPage}
          onSave={() => void handleSaveAllPage()}
          pending={upsert.isPending}
          cancelDisabled={upsert.isPending}
          saveDisabled={upsert.isPending}
        />
      )}
    </div>
  )
}
