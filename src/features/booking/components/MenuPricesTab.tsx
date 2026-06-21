import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'react-toastify'
import { ADMIN_WARM_GRADIENT_SURFACE } from '@/lib/adminWarmGradientSurface'
import { Button, CollapsibleCard, Input, Textarea } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { DiscardChangesConfirmModal } from './settings/SettingsSaveUi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Plus, Edit, Trash2, Save, X, Eye, EyeOff, QrCode, ImageIcon, ChevronUp, ChevronDown } from 'lucide-react'
import {
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useSetMenuItemAvailability,
} from '../hooks/useMenuItems'
import {
  useCreateMenuCategory,
  useDeleteMenuCategory,
  useMenuCategories,
  useUpdateMenuCategory,
  useSetMenuCategoryAvailability,
  useReorderMenuCategories,
} from '../hooks/useMenuCategories'
import { type MenuItem, type MenuItemInput } from '@/types/menu'
import type { SelectedMenuItem } from '@/types/menu'
import {
  STAFF_PRESET_DEFAULT_BOOKING_TYPES,
  type CustomStaffPreset,
  isStaffPresetVisibleOnBooking,
} from '../constants/presetMenus'
import { normalizeBookingPublicFormConfig } from '../constants/bookingPublicFormConfig'
import { useRestaurantSetting, useUpsertRestaurantSetting } from '../hooks/useRestaurantSetting'
import { selectedItemsFromMenuItemIds } from '../utils/buildPresetMenuSelection'
import { groupMenuItemsByCategory } from '../utils/menuCatalogGrouping'
import { PresetMenuBuilder } from './PresetMenuBuilder'
import {
  MENU_CARD_INNER_SHELL_CLASS,
  MENU_CARD_MAX_WIDTH_PX,
  MENU_CATEGORY_COLLAPSIBLE_CLASS,
  MENU_CATEGORY_COLLAPSIBLE_HEADER_CLASS,
  MENU_CATEGORY_LABEL_TITLE_CLASS,
  MENU_CATEGORY_LABEL_TITLE_STYLE,
  MENU_INGREDIENT_DESC_CLASS,
  MENU_INGREDIENT_NAME_CLASS,
  MENU_INGREDIENT_OVERVIEW_GRID_CLASS,
  MENU_INGREDIENT_OVERVIEW_SHELL_CLASS,
  MENU_INGREDIENT_PRICE_CLASS,
} from './menuPricesCatalogLayout'
import { MenuQrManager } from './MenuQrManager'
import { scrollIntoAdminShellView } from '../utils/adminScroll'
import {
  deleteMenuCategoryPhoto,
  uploadMenuCategoryPhoto,
  uploadMenuPhoto,
} from '@/lib/menuPhotoUpload'
import { useTenantContext } from '@/contexts/TenantContext'
import { useFeatures } from '@/hooks/useFeatures'
import { cn } from '@/lib/utils'
import { adminBlueCtaSurfaceClass } from '@/lib/adminBlueCtaClass'
import { CATEGORY_KEY_RENAME_INFO_MESSAGE } from '@/features/booking/services/syncMenuCategoryKeyRename'
import { CATEGORY_KEY_DELETE_INFO_MESSAGE } from '@/features/booking/services/syncMenuCategoryKeyDelete'
import { BOOKING_MENU_COMPOSE_TEXT_LIMITS } from '../constants/bookingPrenotaTextLimits'
import {
  canAddMenuCategory,
  canAddMenuProductAnywhere,
  canAddMenuProductToCategory,
  canAddStaffPreset,
  countMenuProductsInCategory,
  getMenuCategoryLimitMessage,
  getMenuProductPerCategoryLimitMessage,
  getStaffPresetLimitMessage,
  isMenuCategoryAvailable,
} from '../constants/menuMagazzinoLimits'
import { MenuMagazzinoLimitNotice } from './MenuMagazzinoLimitNotice'
import { MenuMagazzinoPropagationNotice } from './MenuMagazzinoPropagationNotice'
import { MenuMagazzinoAvailabilityToggle } from './MenuMagazzinoAvailabilityToggle'

const COMPOSE_L = BOOKING_MENU_COMPOSE_TEXT_LIMITS

/** Fascia lista categorie: griglia 1 colonna — classi Tailwind qui (STYLING_AGENT_CONTEXT §4). */
const menuPricesCategoryListWrapClass = cn(
  'menu-prices-category-list-wrap grid grid-cols-1 items-start gap-[28px]'
)

const menuPricesHeaderCtaButtonClass = cn(
  adminBlueCtaSurfaceClass,
  'h-9 min-h-9 w-full shrink-0 gap-1.5 min-w-0'
)

type StaffPresetsVisibilityIconButtonProps = {
  visible: boolean
  disabled: boolean
  onToggle: () => void
}

/** Occhio tra Modifica ed Elimina nella lista menù preselezionati — stessa hit-area degli altri `.menu-prices-icon-btn`. */
function StaffPresetsVisibilityIconButton({
  visible,
  disabled,
  onToggle,
}: StaffPresetsVisibilityIconButtonProps) {
  const title = visible
    ? 'Visibili nella pagina Prenota: clic per nascondere'
    : 'Nascosti nella pagina Prenota: clic per mostrare'
  const ariaLabel = visible
    ? 'Nascondi i menù consigliati nella pagina Prenota'
    : 'Mostra i menù consigliati nella pagina Prenota'

  return (
    <button
      type="button"
      aria-pressed={visible}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'menu-prices-icon-btn',
        visible ? 'menu-prices-icon-btn--visibility-visible' : 'menu-prices-icon-btn--visibility-hidden',
      )}
    >
      {visible ? <Eye className="h-4 w-4 shrink-0" aria-hidden /> : <EyeOff className="h-4 w-4 shrink-0" aria-hidden />}
    </button>
  )
}

export type MenuPricesHeroToolbarProps = {
  onAddProduct: () => void
  onAddCategory: () => void
  onPresetMenus: () => void
  onQrCodes?: () => void
  showQrCodes?: boolean
}

/** Fascia «Menu» con CTA: riutilizzabile nello sticky header della dashboard. */
export function MenuPricesHeroToolbar({
  onAddProduct,
  onAddCategory,
  onPresetMenus,
  onQrCodes,
  showQrCodes = false,
}: MenuPricesHeroToolbarProps) {
  return (
    <section
      aria-label="Gestione menu e prezzi"
      className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-solid px-4 py-4 shadow-sm md:gap-5 md:px-5 md:py-5 min-h-[148px]"
      style={ADMIN_WARM_GRADIENT_SURFACE}
    >
      <p
        className="min-w-0 w-full px-1 text-center text-sm leading-snug text-gray-600 sm:px-2 sm:text-base max-[729px]:hidden"
        title="Aggiungi, modifica, nascondi o elimina gli elementi del menù"
      >
        Aggiungi, modifica, nascondi o elimina gli elementi del menù
      </p>
      <div className="w-full border-t border-[var(--color-border)] pt-3">
        <div className={cn('grid w-full grid-cols-1 gap-2 min-[560px]:grid-cols-2', showQrCodes ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onAddProduct}
            className={cn(menuPricesHeaderCtaButtonClass)}
          >
            <Plus className="h-3.5 w-3.5" />
            Crea / Modifica Prodotto
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onAddCategory}
            className={cn(menuPricesHeaderCtaButtonClass)}
          >
            <Plus className="h-3.5 w-3.5" />
            Crea / Modifica Categoria
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={onPresetMenus}
            aria-label="Crea / Modifica Menù Preselezionati"
            title="Crea / Modifica Menù Preselezionati"
            className={cn(menuPricesHeaderCtaButtonClass, 'truncate')}
          >
            <Plus className="h-3.5 w-3.5" />
            Crea / Modifica Menù Preselezionati
          </Button>
          {showQrCodes && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onQrCodes}
              aria-label="I miei QR menu"
              title="I miei QR menu"
              className={cn(menuPricesHeaderCtaButtonClass, 'gap-1.5')}
            >
              <QrCode className="h-3.5 w-3.5" />
              I miei QR
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

export type MenuPricesTabHandle = {
  startAddProduct: () => void
  startAddCategory: () => void
  openPresetMenus: () => void
  openQrCodes: () => void
}

export type MenuPricesTabProps = {
  /** Toolbar principale spostata nello sticky header AdminDashboard */
  omitHeroSection?: boolean
}

const slugifyCategory = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

type AdminMenuIngredientCardProps = {
  item: MenuItem
  onEdit: () => void
  onDelete: () => void
  /** Es. nome categoria (vista elenco prodotti) */
  metaLine?: ReactNode
  /** Sotto la card bianca. */
  footer?: ReactNode
  /** Vista modifica: icone azione. */
  showActions?: boolean
  onToggleAvailability?: () => void
  availabilityToggleDisabled?: boolean
}

const AdminMenuIngredientCard: React.FC<AdminMenuIngredientCardProps> = ({
  item,
  onEdit,
  onDelete,
  metaLine,
  footer,
  showActions = false,
  onToggleAvailability,
  availabilityToggleDisabled = false,
}) => {
  const hasDesc = Boolean(item.description?.trim())
  const available = item.is_available !== false
  return (
    <div
      className={cn(
        'flex w-full flex-col items-stretch gap-1.5',
        !available && 'opacity-60',
      )}
      style={{
        maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div
        className={cn(
          'menu-prices-item-row flex-col items-stretch gap-2 py-2.5 px-3',
          !hasDesc && 'min-h-0',
        )}
        style={{
          width: '100%',
          maxWidth: `${MENU_CARD_MAX_WIDTH_PX}px`,
          minHeight: hasDesc ? undefined : '3rem',
        }}
      >
        <div className="flex w-full min-w-0 items-start justify-between gap-2">
          <p className={cn(MENU_INGREDIENT_NAME_CLASS, 'menu-prices-item-text break-words')}>
            {item.name}
          </p>
          <span className={MENU_INGREDIENT_PRICE_CLASS}>€{item.price.toFixed(2)}</span>
        </div>
        {hasDesc ? (
          <p className={cn(MENU_INGREDIENT_DESC_CLASS, 'break-words')}>{item.description}</p>
        ) : null}
        {onToggleAvailability || showActions ? (
          <div className="menu-prices-item-actions flex w-full shrink-0 justify-end gap-1.5">
            {onToggleAvailability ? (
              <MenuMagazzinoAvailabilityToggle
                available={available}
                disabled={availabilityToggleDisabled}
                onToggle={onToggleAvailability}
                entityLabel={item.name}
                compact
              />
            ) : null}
            {showActions ? (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="menu-prices-icon-btn menu-prices-icon-btn--edit"
                  aria-label={`Modifica ${item.name}`}
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  className="menu-prices-icon-btn menu-prices-icon-btn--delete"
                  aria-label={`Elimina ${item.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {footer}
      {metaLine ? (
        <p className="px-1 text-center text-xs text-(--color-text-muted) sm:text-left">{metaLine}</p>
      ) : null}
    </div>
  )
}


type AdminMenuCategoryLabelCardProps = {
  label: string
  imageUrl?: string | null
  available?: boolean
  onEdit: () => void
  onDelete: () => void
}

const AdminMenuCategoryLabelCard: React.FC<AdminMenuCategoryLabelCardProps> = ({
  label,
  imageUrl,
  available = true,
  onEdit,
  onDelete,
}) => {
  const categoryThumbSrc = imageUrl?.trim() || undefined

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col items-stretch',
        !available && 'opacity-60',
      )}
      style={{
        maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div
        className={cn(
          MENU_CARD_INNER_SHELL_CLASS,
          'menu-prices-item-row w-full min-w-0 flex-col items-stretch gap-2 py-2.5 px-3',
        )}
        style={{
          maxWidth: `${MENU_CARD_MAX_WIDTH_PX}px`,
          minHeight: '72px',
          marginBottom: '4px',
        }}
      >
        <div className="flex w-full min-w-0 items-start gap-3">
          {categoryThumbSrc ? (
            <div className="menu-prices-category-label-card__thumb hidden min-[1050px]:block shrink-0">
              <img src={categoryThumbSrc} alt="" />
            </div>
          ) : null}
          <div className="menu-prices-item-text min-w-0 flex-1">
            <span
              className={cn(
                MENU_CATEGORY_LABEL_TITLE_CLASS,
                'block w-full max-w-full min-w-0 text-center break-words sm:text-left',
              )}
              style={MENU_CATEGORY_LABEL_TITLE_STYLE}
            >
              {label}
            </span>
          </div>
        </div>
        <div className="menu-prices-item-actions flex w-full shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="menu-prices-icon-btn menu-prices-icon-btn--edit"
            aria-label={`Modifica ${label}`}
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="menu-prices-icon-btn menu-prices-icon-btn--delete"
            aria-label={`Elimina ${label}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

type MenuViewMode = 'menu' | 'categories' | 'preset_menus' | 'qr_codes'

export const MenuPricesTab = forwardRef<MenuPricesTabHandle, MenuPricesTabProps>(function MenuPricesTab(
  { omitHeroSection = false },
  ref,
) {
  const { tenantId } = useTenantContext()
  const features = useFeatures()
  const { data: menuItems = [], isLoading, refetch: refetchMenuItems } = useMenuItems()
  const { data: dbCategories = [], refetch: refetchCategories } = useMenuCategories()
  const createMutation = useCreateMenuItem()
  const createCategoryMutation = useCreateMenuCategory()
  const updateCategoryMutation = useUpdateMenuCategory()
  const deleteCategoryMutation = useDeleteMenuCategory()
  const updateMutation = useUpdateMenuItem()
  const deleteMutation = useDeleteMenuItem()
  const setItemAvailabilityMutation = useSetMenuItemAvailability()
  const setCategoryAvailabilityMutation = useSetMenuCategoryAvailability()
  const reorderCategoriesMutation = useReorderMenuCategories()

  const { data: customStaffPresets = [] } = useRestaurantSetting('booking_custom_staff_presets')
  const { data: bookingPublicFormConfig } = useRestaurantSetting('booking_public_form_config')
  const upsertRestaurantSetting = useUpsertRestaurantSetting()

  const [viewMode, setViewMode] = useState<MenuViewMode>('menu')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [categoryPhotoFile, setCategoryPhotoFile] = useState<File | null>(null)
  const [categoryPhotoPreviewUrl, setCategoryPhotoPreviewUrl] = useState<string | null>(null)
  const [categoryCurrentImageUrl, setCategoryCurrentImageUrl] = useState<string | null>(null)
  const [categoryPhotoUploading, setCategoryPhotoUploading] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryRenameConfirm, setCategoryRenameConfirm] = useState<{
    id: string
    previousKey: string
    newKey: string
    label: string
    description: string | null
    image_url?: string | null
  } | null>(null)
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{
    id: string
    categoryKey: string
    label: string
    itemsCount: number
  } | null>(null)
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{ id: string; name: string } | null>(null)
  const [deletePresetConfirm, setDeletePresetConfirm] = useState<{ id: string; label: string } | null>(null)
  /** Stringa controllata per l’input prezzo: evita lo 0 “incollato” con `parseFloat(...) || 0` su campo vuoto. */
  const [priceInput, setPriceInput] = useState('')
  const [presetEditorMode, setPresetEditorMode] = useState<'list' | 'editor'>('list')
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')
  const [presetPriceInput, setPresetPriceInput] = useState('')
  const [presetSelectedItems, setPresetSelectedItems] = useState<SelectedMenuItem[]>([])
  const [editingCustomPresetId, setEditingCustomPresetId] = useState<string | null>(null)
  const productFormCardRef = useRef<HTMLDivElement>(null)
  const productFormTitleRef = useRef<HTMLHeadingElement>(null)
  const categoryFormTitleRef = useRef<HTMLDivElement>(null)
  const scrollProductFormIntoViewAfterEditRef = useRef(false)
  const scrollCategoryFormIntoViewAfterEditRef = useRef(false)
  const categoryFormBaselineRef = useRef({
    label: '',
    description: '',
    imageUrl: null as string | null,
    hasPhotoFile: false,
    hasPhotoPreview: false,
  })
  const [categoryDiscardConfirmOpen, setCategoryDiscardConfirmOpen] = useState(false)
  const [categoryDiscardAction, setCategoryDiscardAction] = useState<'overlay' | 'form' | null>(null)

  // FU-023: guard chiusura editor preset (menù preselezionati) con bozza non salvata.
  const presetEditorBaselineRef = useRef('')
  const [presetDiscardConfirmOpen, setPresetDiscardConfirmOpen] = useState(false)
  const [presetDiscardAction, setPresetDiscardAction] = useState<'list' | 'section' | null>(null)

  const ADMIN_MENU_FORM_SCROLL_MARGIN = 132
  const scrollAdminMenuFormTitleIntoView = (element: HTMLElement | null) => {
    scrollIntoAdminShellView(element, {
      behavior: 'smooth',
      scrollMarginTop: ADMIN_MENU_FORM_SCROLL_MARGIN,
      ensureVisible: true,
    })
  }

  // Stato foto piatto (form prodotto)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  /** image_url corrente del piatto in modifica (per mostrare preview esistente) */
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)

  /** Attivo dopo «Crea / Modifica Prodotto»: titolo «Modifica Ingredienti» e righe ingrediente interattive. */
  const [ingredientEditMode, setIngredientEditMode] = useState(false)

  const resetPresetEditor = () => {
    setPresetEditorMode('list')
    setPresetName('')
    setPresetDescription('')
    setPresetPriceInput('')
    setPresetSelectedItems([])
    setEditingCustomPresetId(null)
  }

  /** Serializza la bozza editor preset per il confronto dirty (FU-023). */
  const serializePresetDraft = (
    name: string,
    description: string,
    price: string,
    items: SelectedMenuItem[],
  ) => JSON.stringify({ name: name.trim(), description: description.trim(), price: price.trim(), items })

  const closePresetMenusSection = () => {
    resetPresetEditor()
    setViewMode('menu')
  }

  const startNewCustomPreset = () => {
    if (!canAddStaffPreset(customStaffPresets.length)) {
      toast.error(getStaffPresetLimitMessage())
      return
    }
    setEditingCustomPresetId(null)
    setPresetName('')
    setPresetDescription('')
    setPresetPriceInput('')
    setPresetSelectedItems([])
    presetEditorBaselineRef.current = serializePresetDraft('', '', '', [])
    setPresetEditorMode('editor')
  }

  const startEditCustomPreset = (preset: CustomStaffPreset) => {
    const initialDescription = preset.description ?? ''
    const initialPrice = preset.price_per_person != null ? String(preset.price_per_person) : ''
    const initialItems = selectedItemsFromMenuItemIds(menuItems, preset.item_ids)
    setEditingCustomPresetId(preset.id)
    setPresetName(preset.name)
    setPresetDescription(initialDescription)
    setPresetPriceInput(initialPrice)
    setPresetSelectedItems(initialItems)
    presetEditorBaselineRef.current = serializePresetDraft(
      preset.name,
      initialDescription,
      initialPrice,
      initialItems,
    )
    setPresetEditorMode('editor')
  }

  const isPresetEditorDirty = () =>
    serializePresetDraft(presetName, presetDescription, presetPriceInput, presetSelectedItems) !==
    presetEditorBaselineRef.current

  /** Chiusura editor preset: se ci sono modifiche non salvate, conferma prima di scartare. */
  const requestClosePresetEditor = (action: 'list' | 'section') => {
    if (presetEditorMode === 'editor' && isPresetEditorDirty()) {
      setPresetDiscardAction(action)
      setPresetDiscardConfirmOpen(true)
      return
    }
    if (action === 'section') closePresetMenusSection()
    else resetPresetEditor()
  }

  const confirmPresetDiscard = () => {
    const action = presetDiscardAction
    setPresetDiscardConfirmOpen(false)
    setPresetDiscardAction(null)
    if (action === 'section') closePresetMenusSection()
    else resetPresetEditor()
  }

  const buildPresetRowPayload = (
    base: Pick<CustomStaffPreset, 'id' | 'name' | 'item_ids' | 'booking_types' | 'visible_on_booking'>,
  ): CustomStaffPreset => {
    const trimmedDesc = presetDescription.trim()
    const parsedPrice = presetPriceInput.trim() ? Math.max(0, parseFloat(presetPriceInput) || 0) : 0
    return {
      ...base,
      ...(trimmedDesc ? { description: trimmedDesc } : {}),
      ...(parsedPrice > 0 ? { price_per_person: parsedPrice } : {}),
    }
  }

  const handleSaveCustomPreset = async () => {
    const name = presetName.trim()
    if (!name) {
      toast.error('Inserisci il nome del menù')
      return
    }
    const ids = presetSelectedItems.map((i) => i.id).filter(Boolean)
    if (!ids.length) {
      toast.error('Seleziona almeno un ingrediente')
      return
    }
    if (editingCustomPresetId === null && !canAddStaffPreset(customStaffPresets.length)) {
      toast.error(getStaffPresetLimitMessage())
      return
    }
    const next: CustomStaffPreset[] =
      editingCustomPresetId !== null
        ? customStaffPresets.map((p) =>
            p.id === editingCustomPresetId
              ? buildPresetRowPayload({
                  ...p,
                  name,
                  item_ids: ids,
                  booking_types: [...STAFF_PRESET_DEFAULT_BOOKING_TYPES],
                })
              : p,
          )
        : [
            ...customStaffPresets,
            buildPresetRowPayload({
              id: crypto.randomUUID(),
              name,
              item_ids: ids,
              booking_types: [...STAFF_PRESET_DEFAULT_BOOKING_TYPES],
              visible_on_booking: true,
            }),
          ]

    try {
      await upsertRestaurantSetting.mutateAsync([{ key: 'booking_custom_staff_presets', value: next }])
      resetPresetEditor()
      setPresetEditorMode('list')
    } catch {
      //
    }
  }

  const handleDeleteCustomPreset = (presetId: string, label: string) => {
    setDeletePresetConfirm({ id: presetId, label })
  }

  const confirmDeleteCustomPreset = () => {
    if (!deletePresetConfirm) return
    const presetId = deletePresetConfirm.id
    const next = customStaffPresets.filter((p) => p.id !== presetId)
    const nextFormConfig = bookingPublicFormConfig
      ? normalizeBookingPublicFormConfig({
          ...bookingPublicFormConfig,
          booking_modes: bookingPublicFormConfig.booking_modes.map((mode) => {
            const subTabs = (mode.sub_tabs ?? []).filter((tab) => tab.preset_id !== presetId)
            return {
              ...mode,
              sub_tabs: subTabs,
              sub_tabs_overrides: mode.sub_tabs_overrides?.filter((override) => override.preset_id !== presetId),
              sub_tabs_presentation: subTabs.length === 0 ? null : mode.sub_tabs_presentation,
            }
          }),
        })
      : undefined
    upsertRestaurantSetting.mutate(
      [
        { key: 'booking_custom_staff_presets', value: next },
        ...(nextFormConfig ? [{ key: 'booking_public_form_config' as const, value: nextFormConfig }] : []),
      ],
      {
        onSettled: () => setDeletePresetConfirm(null),
      },
    )
  }

  const toggleStaffPresetBookingVisibility = (presetId: string) => {
    const next = customStaffPresets.map((p) =>
      p.id === presetId ? { ...p, visible_on_booking: !isStaffPresetVisibleOnBooking(p) } : p,
    )
    upsertRestaurantSetting.mutate([{ key: 'booking_custom_staff_presets', value: next }])
  }

  const categoryEntries = useMemo(
    () => dbCategories.map((category) => [category.key, category.label] as const),
    [dbCategories]
  )


  const categoryKeys = useMemo(
    () => categoryEntries.map(([key]) => key),
    [categoryEntries]
  )
  const dbCategoryByKey = useMemo(
    () => new Map(dbCategories.map((category) => [category.key, category])),
    [dbCategories]
  )

  const categoriesAtLimit = !canAddMenuCategory(dbCategories.length)
  const categoryLimitMessage = getMenuCategoryLimitMessage()
  const presetsAtLimit = !canAddStaffPreset(customStaffPresets.length)
  const presetLimitMessage = getStaffPresetLimitMessage()
  const canAddAnyProduct = canAddMenuProductAnywhere(menuItems, dbCategories)
  const productLimitMessage = getMenuProductPerCategoryLimitMessage()

  const getCategoryProductCount = (categoryKey: string, categoryLabel: string) =>
    countMenuProductsInCategory(menuItems, categoryKey, categoryLabel)

  const canAddProductToCategoryKey = (categoryKey: string) => {
    const label = dbCategoryByKey.get(categoryKey)?.label ?? categoryKey
    return canAddMenuProductToCategory(getCategoryProductCount(categoryKey, label))
  }

  const [formData, setFormData] = useState<MenuItemInput>({
    name: '',
    category: categoryKeys[0] ?? '',
    price: 0,
    description: '',
    sort_order: 0,
    is_available: true,
  })
  const resetProductFormState = () => {
    setIngredientEditMode(false)
    setIsAdding(false)
    setEditingId(null)
    setPriceInput('')
    setFormData({
      name: '',
      category: categoryKeys[0] ?? '',
      price: 0,
      description: '',
      sort_order: 0,
      is_available: true,
    })
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(null)
  }

  const openPresetMenusSection = () => {
    resetPresetEditor()
    resetProductFormState()
    setPresetEditorMode('list')
    setViewMode('preset_menus')
  }

  const openQrCodesSection = () => {
    setViewMode('qr_codes')
  }

  const openIngredientEditSection = () => {
    setViewMode('menu')
    setIsAddingCategory(false)
    setEditingCategoryId(null)
    setIngredientEditMode(true)
    setIsAdding(false)
    setEditingId(null)
    setPriceInput('')
    setFormData({
      name: '',
      category: categoryKeys[0] ?? '',
      price: 0,
      description: '',
      sort_order: 0,
      is_available: true,
    })
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(null)
  }

  // Raggruppa per categoria
  const itemsByCategory = groupMenuItemsByCategory(menuItems, categoryKeys)

  const toggleItemAvailability = (item: MenuItem) => {
    setItemAvailabilityMutation.mutate({
      id: item.id,
      is_available: item.is_available === false,
    })
  }

  const toggleCategoryAvailabilityById = (categoryId: string, currentlyAvailable: boolean) => {
    setCategoryAvailabilityMutation.mutate({
      id: categoryId,
      is_available: !currentlyAvailable,
    })
  }

  // Riordino categorie (ordine canonico magazzino) — frecce su/giù in panoramica.
  const handleMoveCategory = (categoryKey: string, direction: 'up' | 'down') => {
    const currentIndex = dbCategories.findIndex((c) => c.key === categoryKey)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= dbCategories.length) return

    const reordered = [...dbCategories]
    const [moved] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    reorderCategoriesMutation.mutate(reordered.map((c) => c.id))
  }

  const handleStartEdit = (item: MenuItem) => {
    setIngredientEditMode(true)
    setEditingId(item.id)
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description || '',
      sort_order: item.sort_order,
      is_available: item.is_available !== false,
    })
    setPriceInput(item.price === 0 ? '' : String(item.price))
    setIsAdding(false)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(item.image_url ?? null)
    scrollProductFormIntoViewAfterEditRef.current = true
  }

  const handleStartAdd = (preselectedCategory?: string) => {
    const category = preselectedCategory ?? categoryKeys[0] ?? ''
    if (category && !canAddProductToCategoryKey(category)) {
      toast.error(productLimitMessage)
      return
    }
    setViewMode('menu')
    setIsAddingCategory(false)
    setIngredientEditMode(true)
    setIsAdding(true)
    setEditingId(null)
    setPriceInput('')
    setFormData({
      name: '',
      category: preselectedCategory ?? categoryKeys[0] ?? '',
      price: 0,
      description: '',
      sort_order: 0,
      is_available: true,
    })
    scrollProductFormIntoViewAfterEditRef.current = true
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setPriceInput('')
    setFormData({
      name: '',
      category: categoryKeys[0] ?? '',
      price: 0,
      description: '',
      sort_order: 0,
      is_available: true,
    })
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(null)
  }

  const resetCategoryPhotoState = () => {
    if (categoryPhotoPreviewUrl) URL.revokeObjectURL(categoryPhotoPreviewUrl)
    setCategoryPhotoFile(null)
    setCategoryPhotoPreviewUrl(null)
    setCategoryCurrentImageUrl(null)
    setCategoryPhotoUploading(false)
  }

  const resolveCategoryImageOnSave = async (
    categoryId: string,
    previousImageUrl: string | null | undefined,
  ): Promise<string | null | undefined> => {
    if (!tenantId) return undefined

    if (categoryPhotoFile) {
      setCategoryPhotoUploading(true)
      try {
        return await uploadMenuCategoryPhoto(categoryPhotoFile, tenantId, categoryId)
      } finally {
        setCategoryPhotoUploading(false)
      }
    }

    const removedExisting =
      Boolean(previousImageUrl) && !categoryPhotoPreviewUrl && !categoryCurrentImageUrl
    if (removedExisting) {
      try {
        await deleteMenuCategoryPhoto(tenantId, categoryId)
      } catch {
        //
      }
      return null
    }

    return undefined
  }

  const executeSaveCategory = async (params: {
    editingCategoryId: string | null
    rawLabel: string
    description: string | null
    imageUrl?: string | null
    previousKey?: string
    newKey?: string
    is_available?: boolean
  }) => {
    const { editingCategoryId: catId, rawLabel, description, imageUrl, previousKey, newKey, is_available } =
      params

    if (catId && previousKey != null && newKey != null) {
      await updateCategoryMutation.mutateAsync({
        id: catId,
        key: newKey,
        previousKey,
        label: rawLabel,
        description,
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        ...(typeof is_available === 'boolean' ? { is_available } : {}),
      })
      return
    }

    if (!catId) {
      const key = newKey ?? slugifyCategory(rawLabel)
      if (!key) return

      const created = await createCategoryMutation.mutateAsync({
        key,
        label: rawLabel,
        description,
        sort_order: 999,
        is_available: is_available ?? true,
      })

      if (categoryPhotoFile && tenantId && created?.id) {
        const uploadedUrl = await resolveCategoryImageOnSave(created.id, null)
        if (uploadedUrl) {
          await updateCategoryMutation.mutateAsync({
            id: created.id,
            key,
            previousKey: key,
            label: rawLabel,
            description,
            image_url: uploadedUrl,
          })
        }
      }

      setFormData((prev) => ({ ...prev, category: key }))
    }
  }

  const handleSaveCategory = async () => {
    const rawLabel = newCategoryLabel.trim()
    if (!rawLabel) {
      toast.error('Inserisci il nome della categoria')
      return
    }

    try {
      if (editingCategoryId) {
        const editingCategory = dbCategories.find((category) => category.id === editingCategoryId)
        if (!editingCategory) {
          toast.error('Categoria non trovata')
          return
        }

        const newKey = slugifyCategory(rawLabel)
        if (!newKey) {
          toast.error('Nome categoria non valido')
          return
        }

        const duplicateCategory = dbCategories.find(
          (category) => category.key === newKey && category.id !== editingCategoryId
        )
        if (duplicateCategory) {
          toast.error('Categoria già presente')
          return
        }

        const imageUrl = await resolveCategoryImageOnSave(
          editingCategoryId,
          editingCategory.image_url,
        )

        const description = newCategoryDescription.trim() || null

        if (editingCategory.key !== newKey) {
          setCategoryRenameConfirm({
            id: editingCategoryId,
            previousKey: editingCategory.key,
            newKey,
            label: rawLabel,
            description,
            ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
          })
          return
        }

        await executeSaveCategory({
          editingCategoryId,
          rawLabel,
          description,
          imageUrl,
          previousKey: editingCategory.key,
          newKey,
          is_available: isMenuCategoryAvailable(editingCategory),
        })
      } else {
        if (!canAddMenuCategory(dbCategories.length)) {
          toast.error(categoryLimitMessage)
          return
        }

        const key = slugifyCategory(rawLabel)
        if (!key) {
          toast.error('Nome categoria non valido')
          return
        }

        if (categoryKeys.includes(key)) {
          toast.error('Categoria già presente')
          return
        }

        await executeSaveCategory({
          editingCategoryId: null,
          rawLabel,
          description: newCategoryDescription.trim() || null,
          newKey: key,
          is_available: true,
        })
      }

      await refetchCategories()
      await refetchMenuItems()
      cancelCategoryForm()
    } catch {
      // errore già gestito dalla mutation con toast
    }
  }

  const confirmCategoryRenameSave = async () => {
    if (!categoryRenameConfirm) return
    const pending = categoryRenameConfirm
    try {
      await executeSaveCategory({
        editingCategoryId: pending.id,
        rawLabel: pending.label,
        description: pending.description,
        imageUrl: pending.image_url,
        previousKey: pending.previousKey,
        newKey: pending.newKey,
        is_available: isMenuCategoryAvailable(
          dbCategories.find((c) => c.id === pending.id) ?? { is_available: true },
        ),
      })
      setCategoryRenameConfirm(null)
      await refetchCategories()
      await refetchMenuItems()
      cancelCategoryForm()
    } catch {
      // toast errore dalla mutation
    }
  }

  const handleEditCategory = (categoryKey: string, currentLabel: string) => {
    const dbCategory = dbCategoryByKey.get(categoryKey)
    if (!dbCategory) {
      toast.error('Categoria non modificabile')
      return
    }
    resetProductFormState()
    setViewMode('categories')
    setIsAddingCategory(true)
    setEditingCategoryId(dbCategory.id)
    setNewCategoryLabel(currentLabel)
    setNewCategoryDescription(dbCategory.description ?? '')
    resetCategoryPhotoState()
    setCategoryCurrentImageUrl(dbCategory.image_url ?? null)
    categoryFormBaselineRef.current = {
      label: currentLabel.trim(),
      description: (dbCategory.description ?? '').trim(),
      imageUrl: dbCategory.image_url ?? null,
      hasPhotoFile: false,
      hasPhotoPreview: false,
    }
    scrollCategoryFormIntoViewAfterEditRef.current = true
  }

  const countItemsForCategory = (categoryKey: string, categoryLabel: string) =>
    menuItems.filter(
      (item) => item.category === categoryKey || item.category === categoryLabel,
    ).length

  const handleDeleteCategory = (categoryKey: string, label: string) => {
    const dbCategory = dbCategoryByKey.get(categoryKey)
    if (!dbCategory) {
      toast.error('Categoria non eliminabile')
      return
    }

    setDeleteCategoryConfirm({
      id: dbCategory.id,
      categoryKey,
      label,
      itemsCount: countItemsForCategory(categoryKey, label),
    })
  }

  const confirmDeleteCategory = () => {
    if (!deleteCategoryConfirm) return
    deleteCategoryMutation.mutate(
      { id: deleteCategoryConfirm.id, categoryKey: deleteCategoryConfirm.categoryKey },
      { onSettled: () => setDeleteCategoryConfirm(null) },
    )
  }

  const handleStartAddCategory = () => {
    setViewMode('categories')
    resetProductFormState()
    setIsAddingCategory(false)
    setEditingCategoryId(null)
    setNewCategoryLabel('')
    setNewCategoryDescription('')
    resetCategoryPhotoState()
    categoryFormBaselineRef.current = {
      label: '',
      description: '',
      imageUrl: null,
      hasPhotoFile: false,
      hasPhotoPreview: false,
    }
  }

  const cancelCategoryForm = () => {
    setIsAddingCategory(false)
    setNewCategoryLabel('')
    setNewCategoryDescription('')
    setEditingCategoryId(null)
    resetCategoryPhotoState()
    categoryFormBaselineRef.current = {
      label: '',
      description: '',
      imageUrl: null,
      hasPhotoFile: false,
      hasPhotoPreview: false,
    }
  }

  const isCategoryFormDirty = useMemo(() => {
    if (!isAddingCategory) return false
    const baseline = categoryFormBaselineRef.current
    return (
      newCategoryLabel.trim() !== baseline.label ||
      newCategoryDescription.trim() !== baseline.description ||
      categoryCurrentImageUrl !== baseline.imageUrl ||
      Boolean(categoryPhotoFile) !== baseline.hasPhotoFile ||
      Boolean(categoryPhotoPreviewUrl) !== baseline.hasPhotoPreview
    )
  }, [
    isAddingCategory,
    newCategoryLabel,
    newCategoryDescription,
    categoryCurrentImageUrl,
    categoryPhotoFile,
    categoryPhotoPreviewUrl,
  ])

  const closeCategoriesOverlay = () => {
    setViewMode('menu')
    cancelCategoryForm()
  }

  const requestCloseCategoriesOverlay = () => {
    if (isCategoryFormDirty) {
      setCategoryDiscardAction('overlay')
      setCategoryDiscardConfirmOpen(true)
      return
    }
    closeCategoriesOverlay()
  }

  const requestCancelCategoryForm = () => {
    if (isCategoryFormDirty) {
      setCategoryDiscardAction('form')
      setCategoryDiscardConfirmOpen(true)
      return
    }
    cancelCategoryForm()
  }

  const confirmDiscardCategoryDraft = () => {
    setCategoryDiscardConfirmOpen(false)
    if (categoryDiscardAction === 'overlay') {
      setViewMode('menu')
    }
    setCategoryDiscardAction(null)
    cancelCategoryForm()
  }

  useImperativeHandle(
    ref,
    () => ({
      startAddProduct: openIngredientEditSection,
      startAddCategory: handleStartAddCategory,
      openPresetMenus: openPresetMenusSection,
      openQrCodes: openQrCodesSection,
    }),
    [openIngredientEditSection, handleStartAddCategory, openPresetMenusSection, openQrCodesSection],
  )

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Il nome è obbligatorio')
      return
    }
    if (!formData.category) {
      toast.error('Seleziona una categoria')
      return
    }

    const rawPrice = priceInput.trim().replace(',', '.')
    if (rawPrice === '') {
      toast.error('Il prezzo è obbligatorio')
      return
    }
    const parsedPrice = parseFloat(rawPrice)
    if (Number.isNaN(parsedPrice)) {
      toast.error('Inserisci un prezzo valido')
      return
    }
    if (parsedPrice < 0) {
      toast.error('Il prezzo non può essere negativo')
      return
    }

    const editingItem = editingId ? menuItems.find((item) => item.id === editingId) : undefined
    const payload = {
      ...formData,
      price: parsedPrice,
      is_available: editingItem ? editingItem.is_available !== false : true,
    }

    if (!editingId && !canAddProductToCategoryKey(formData.category)) {
      toast.error(productLimitMessage)
      return
    }

    try {
      if (editingId) {
        let imageUrl: string | null | undefined = undefined
        if (photoFile && tenantId) {
          setPhotoUploading(true)
          try {
            imageUrl = await uploadMenuPhoto(photoFile, tenantId, editingId)
            setCurrentImageUrl(imageUrl)
            setPhotoFile(null)
            setPhotoPreviewUrl(null)
          } finally {
            setPhotoUploading(false)
          }
        }
        await updateMutation.mutateAsync({
          id: editingId,
          ...payload,
          ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
        })
        await refetchMenuItems()
        await refetchCategories()
        setPriceInput('')
        setPhotoFile(null)
        setPhotoPreviewUrl(null)
        setCurrentImageUrl(null)
        setFormData({
          name: '',
          category: categoryKeys[0] ?? '',
          price: 0,
          description: '',
          sort_order: 0,
        })
        setIsAdding(false)
        setEditingId(null)
      } else {
        const created = await createMutation.mutateAsync(payload)
        // Upload foto dopo la creazione (serve l'id)
        if (photoFile && tenantId && created?.id) {
          setPhotoUploading(true)
          try {
            const imageUrl = await uploadMenuPhoto(photoFile, tenantId, created.id)
            await updateMutation.mutateAsync({ id: created.id, image_url: imageUrl })
          } finally {
            setPhotoUploading(false)
          }
        }
        await refetchMenuItems()
        await refetchCategories()
        setPriceInput('')
        setPhotoFile(null)
        setPhotoPreviewUrl(null)
        setCurrentImageUrl(null)
        setFormData({
          name: '',
          category: categoryKeys[0] ?? '',
          price: 0,
          description: '',
          sort_order: 0,
        })
        setIsAdding(false)
        setEditingId(null)
      }
    } catch {
      // errore già gestito dalla mutation con toast
    }
  }

  const handlePriceInputChange = (value: string) => {
    // Consente solo cifre con separatore decimale opzionale (max 2 decimali).
    if (/^\d*([.,]\d{0,2})?$/.test(value)) {
      setPriceInput(value)
    }
  }

  const handlePriceInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Blocca notazione scientifica e segni su input numerico.
    if (['e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault()
    }
  }

  const handleDelete = (id: string, name: string) => {
    setDeleteItemConfirm({ id, name })
  }

  const confirmDeleteItem = () => {
    if (!deleteItemConfirm) return
    deleteMutation.mutate(deleteItemConfirm.id, {
      onSettled: () => setDeleteItemConfirm(null),
    })
  }


  useLayoutEffect(() => {
    if (scrollProductFormIntoViewAfterEditRef.current && viewMode === 'menu' && (editingId || isAdding)) {
      scrollProductFormIntoViewAfterEditRef.current = false
      scrollAdminMenuFormTitleIntoView(productFormTitleRef.current)
    }
    if (
      scrollCategoryFormIntoViewAfterEditRef.current &&
      viewMode === 'categories' &&
      isAddingCategory
    ) {
      scrollCategoryFormIntoViewAfterEditRef.current = false
      scrollAdminMenuFormTitleIntoView(categoryFormTitleRef.current)
    }
  }, [viewMode, isAdding, editingId, isAddingCategory, editingCategoryId])

  if (isLoading) {
    return <div className="text-center py-8">Caricamento menu...</div>
  }

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      {!omitHeroSection && (
      <section
        aria-label="Gestione menu e prezzi"
        className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-solid px-4 py-4 shadow-sm md:gap-5 md:px-5 md:py-5 min-h-[148px]"
        style={ADMIN_WARM_GRADIENT_SURFACE}
      >
        <p
          className="min-w-0 w-full px-1 text-center text-sm leading-snug text-gray-600 sm:px-2 sm:text-base max-[729px]:hidden"
          title="Aggiungi, modifica, nascondi o elimina gli elementi del menù"
        >
          Aggiungi, modifica, nascondi o elimina gli elementi del menù
        </p>
        <div className="w-full border-t border-[var(--color-border)] pt-3">
          <div className={cn('grid w-full grid-cols-1 gap-2 min-[560px]:grid-cols-2', features.qrMenu ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={openIngredientEditSection}
              className={cn(menuPricesHeaderCtaButtonClass)}
            >
              <Plus className="h-3.5 w-3.5" />
              Crea / Modifica Prodotto
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleStartAddCategory}
              className={cn(menuPricesHeaderCtaButtonClass)}
            >
              <Plus className="h-3.5 w-3.5" />
              Crea / Modifica Categoria
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={openPresetMenusSection}
              aria-label="Crea / Modifica Menù Preselezionati"
              title="Crea / Modifica Menù Preselezionati"
              className={cn(menuPricesHeaderCtaButtonClass, 'truncate')}
            >
              <Plus className="h-3.5 w-3.5" />
              Crea / Modifica Menù Preselezionati
            </Button>
            {features.qrMenu && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setViewMode('qr_codes')}
                aria-label="I miei QR menu"
                title="I miei QR menu"
                className={cn(menuPricesHeaderCtaButtonClass, 'gap-1.5')}
              >
                <QrCode className="h-3.5 w-3.5" />
                I miei QR
              </Button>
            )}
          </div>
        </div>
      </section>
      )}
      {viewMode === 'menu' && (
      <>
      <div
        className={MENU_INGREDIENT_OVERVIEW_SHELL_CLASS}
        style={ADMIN_WARM_GRADIENT_SURFACE}
        role="region"
        aria-labelledby="menu-prices-ingredient-overview-heading"
      >
        <h3
          id="menu-prices-ingredient-overview-heading"
          className="text-center font-serif text-lg font-bold leading-tight text-primary-900 md:text-xl"
        >
          {ingredientEditMode ? 'Modifica Ingredienti' : 'Menu'}
        </h3>
        {ingredientEditMode ? (
          <p className="mt-2 text-center text-xs text-gray-600 sm:text-sm">
            Usa le icone per modificare o eliminare un ingrediente.
          </p>
        ) : null}

        {/* Pulsante Nuovo Prodotto + form inline, visibili solo in ingredientEditMode */}
        {ingredientEditMode && (
          <div className="mt-6 flex flex-col items-stretch gap-4">
            {!(isAdding || editingId) && (
              <div className="flex flex-col items-center gap-2 self-center sm:self-end">
                <Button
                  variant="success"
                  size="sm"
                  type="button"
                  onClick={() => handleStartAdd()}
                  disabled={!canAddAnyProduct}
                  className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Aggiungi nuovo ingrediente
                </Button>
                {!canAddAnyProduct && (
                  <MenuMagazzinoLimitNotice message={productLimitMessage} className="max-w-xs" />
                )}
              </div>
            )}
            {(isAdding || editingId) && (
              <div
                ref={productFormCardRef}
                className="mx-auto w-full max-w-3xl scroll-mt-24 pr-0 text-left sm:pr-10 md:scroll-mt-28"
              >
                  <h3
                    ref={productFormTitleRef}
                    className="text-center text-title-card font-bold text-warm-wood mb-4"
                  >
                    {editingId ? 'Modifica Prodotto' : 'Nuovo Prodotto'}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Nome prodotto *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            name: e.target.value.slice(0, COMPOSE_L.itemName),
                          })
                        }
                        maxLength={COMPOSE_L.itemName}
                        placeholder="Es. Pizza Margherita"
                        className="h-14 w-full rounded-2xl pl-6"
                        style={{ height: '56px', borderRadius: '18px', paddingLeft: '24px' }}
                      />
                      <p
                        className={cn(
                          'mt-1 text-right text-[11px] tabular-nums',
                          formData.name.length >= COMPOSE_L.itemName
                            ? 'text-red-500'
                            : 'text-gray-500',
                        )}
                      >
                        {formData.name.length}/{COMPOSE_L.itemName}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Categoria *
                      </label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger
                          className="h-14 w-full rounded-2xl border text-gray-600 shadow-sm"
                          style={{
                            borderColor: 'rgba(0,0,0,0.2)',
                            height: '56px',
                            minHeight: '56px',
                            fontSize: '16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '18px',
                            paddingLeft: '24px',
                            paddingRight: '24px'
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {categoryEntries.map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Prezzo (€) *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceInput}
                        onChange={(e) => handlePriceInputChange(e.target.value)}
                        onKeyDown={handlePriceInputKeyDown}
                        placeholder="Es. 4.50"
                        className="h-14 w-full rounded-2xl pl-6"
                        style={{ height: '56px', borderRadius: '18px', paddingLeft: '24px' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Foto piatto{' '}
                        <span className="font-normal normal-case text-gray-500">(opzionale)</span>
                      </label>
                      <div className="flex min-h-14 flex-col items-start justify-center gap-3">
                      {(photoPreviewUrl || currentImageUrl) && (
                        <div className="relative">
                          <img
                            src={photoPreviewUrl ?? currentImageUrl!}
                            alt="Anteprima foto piatto"
                            className="h-28 w-48 rounded-xl object-cover shadow"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (photoPreviewUrl) {
                                URL.revokeObjectURL(photoPreviewUrl)
                                setPhotoPreviewUrl(null)
                                setPhotoFile(null)
                              } else {
                                setCurrentImageUrl(null)
                                setPhotoFile(null)
                              }
                            }}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                            aria-label="Rimuovi foto"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {!photoPreviewUrl && !currentImageUrl && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-5 py-3 text-sm text-gray-600 hover:border-amber-400 hover:text-amber-700 transition-colors">
                          <ImageIcon className="h-4 w-4 shrink-0" />
                          Scegli foto
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
                              setPhotoFile(file)
                              setPhotoPreviewUrl(URL.createObjectURL(file))
                            }}
                          />
                        </label>
                      )}
                      {photoFile && !photoUploading && (
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{photoFile.name}</p>
                      )}
                      {photoUploading && (
                        <p className="text-xs text-amber-700">Caricamento foto…</p>
                      )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Descrizione
                        <span className="font-normal normal-case text-gray-500"> (opzionale)</span>
                      </label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value.slice(0, COMPOSE_L.itemDescription),
                          })
                        }
                        maxLength={COMPOSE_L.itemDescription}
                        placeholder="Es. 2 tranci a persona"
                        rows={3}
                        className="w-full rounded-2xl border-gray-200 px-4 py-3 text-sm"
                      />
                      <p
                        className={cn(
                          'mt-1 text-right text-[11px] tabular-nums',
                          (formData.description ?? '').length >= COMPOSE_L.itemDescription
                            ? 'text-red-500'
                            : 'text-gray-500',
                        )}
                      >
                        {(formData.description ?? '').length}/{COMPOSE_L.itemDescription}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Note visibili quando il prodotto compare nella selezione menù.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 md:col-span-2">
                    <MenuMagazzinoPropagationNotice />
                  </div>
                  <div className="mt-10 flex justify-center gap-3 md:col-span-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={createMutation.isPending || updateMutation.isPending || photoUploading}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl border-2 border-emerald-700 transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-emerald-500/35 hover:from-emerald-400 hover:to-emerald-500 hover:border-emerald-600 hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:brightness-100 disabled:hover:from-emerald-500 disabled:hover:to-emerald-600 disabled:hover:border-emerald-700"
                    >
                      <Save className="h-4 w-4 flex-shrink-0" />
                      Salva
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-600 text-red-600 font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-500/30"
                    >
                      <X className="h-4 w-4 flex-shrink-0" />
                      Annulla
                    </button>
                  </div>
              </div>
            )}
          </div>
        )}
        {categoryEntries.length === 0 ? (
          <p
            className={cn(
              'py-8 text-center text-sm text-gray-600',
              ingredientEditMode ? 'mt-8' : 'mt-6',
            )}
          >
            Nessuna categoria configurata. Aggiungine una dalla gestione categorie.
          </p>
        ) : (
          <div
            className={cn(MENU_INGREDIENT_OVERVIEW_GRID_CLASS, ingredientEditMode ? 'mt-8' : 'mt-6')}
          >
            {categoryEntries.map(([categoryKey, categoryLabel], categoryIndex) => {
              const categoryItems = itemsByCategory[categoryKey] ?? []
              const itemCount = categoryItems.length
              const dbCategory = dbCategoryByKey.get(categoryKey)
              const categoryAvailable = dbCategory ? isMenuCategoryAvailable(dbCategory) : true
              const canMoveUp = categoryIndex > 0
              const canMoveDown = categoryIndex < categoryEntries.length - 1
              return (
                <CollapsibleCard
                  key={categoryKey}
                  title={categoryLabel}
                  subtitle={
                    <span className="text-xs font-semibold text-(--color-text-muted) sm:text-sm">
                      {itemCount} {itemCount === 1 ? 'ingrediente' : 'ingredienti'}
                    </span>
                  }
                  defaultExpanded={false}
                  className={cn(MENU_CATEGORY_COLLAPSIBLE_CLASS, !categoryAvailable && 'opacity-60')}
                  headerClassName={MENU_CATEGORY_COLLAPSIBLE_HEADER_CLASS}
                  contentClassName="bg-transparent p-0"
                  titleClassName={cn(MENU_CATEGORY_LABEL_TITLE_CLASS, 'break-words')}
                  titleStyle={MENU_CATEGORY_LABEL_TITLE_STYLE}
                  actions={
                    <div className="flex items-center gap-1">
                      {dbCategory && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveCategory(categoryKey, 'up')
                            }}
                            disabled={!canMoveUp || reorderCategoriesMutation.isPending}
                            aria-label={`Sposta ${categoryLabel} su`}
                            title="Sposta su"
                            className="is-clickable rounded-md p-1 text-(--color-text-muted) hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMoveCategory(categoryKey, 'down')
                            }}
                            disabled={!canMoveDown || reorderCategoriesMutation.isPending}
                            aria-label={`Sposta ${categoryLabel} giù`}
                            title="Sposta giù"
                            className="is-clickable rounded-md p-1 text-(--color-text-muted) hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {dbCategory && (
                        <MenuMagazzinoAvailabilityToggle
                          available={categoryAvailable}
                          disabled={setCategoryAvailabilityMutation.isPending}
                          onToggle={() =>
                            toggleCategoryAvailabilityById(dbCategory.id, categoryAvailable)
                          }
                          entityLabel={categoryLabel}
                        />
                      )}
                    </div>
                  }
                >
                  <div className="flex flex-col gap-2 px-1 pb-3 pt-0.5 sm:px-2">
                    {itemCount === 0 ? (
                      <div className="flex flex-col items-center gap-3 px-2 py-4">
                        <p className="text-center text-xs text-(--color-text-muted) sm:text-sm">
                          Nessun ingrediente in questa categoria.
                        </p>
                        {ingredientEditMode && (
                          <div className="flex flex-col items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => handleStartAdd(categoryKey)}
                              disabled={!canAddProductToCategoryKey(categoryKey)}
                              className="gap-1.5 text-xs"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Aggiungi ingrediente
                            </Button>
                            {!canAddProductToCategoryKey(categoryKey) && (
                              <MenuMagazzinoLimitNotice
                                message={productLimitMessage}
                                className="max-w-xs px-2"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      categoryItems.map((item) => (
                        <AdminMenuIngredientCard
                          key={item.id}
                          item={item}
                          onEdit={() => handleStartEdit(item)}
                          onDelete={() => handleDelete(item.id, item.name)}
                          showActions={ingredientEditMode}
                          onToggleAvailability={() => toggleItemAvailability(item)}
                          availabilityToggleDisabled={setItemAvailabilityMutation.isPending}
                        />
                      ))
                    )}
                  </div>
                </CollapsibleCard>
              )
            })}
          </div>
        )}
      </div>
      </>
      )}

      {viewMode === 'preset_menus' && (
          <div
            className={MENU_INGREDIENT_OVERVIEW_SHELL_CLASS}
            style={ADMIN_WARM_GRADIENT_SURFACE}
            role="region"
            aria-labelledby="menu-prices-preset-menus-heading"
          >
            <button
              type="button"
              onClick={() => requestClosePresetEditor('section')}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-warm-wood/40 bg-white/90 text-warm-wood shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
              aria-label="Chiudi menù preselezionati"
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className={cn(
                'pr-10',
                presetEditorMode === 'list' && 'pb-12',
              )}
            >
              <h3
                id="menu-prices-preset-menus-heading"
                className="text-center font-serif text-title-card font-bold text-warm-wood"
              >
                Menù preselezionati
              </h3>
              <p className="mt-2 text-center text-xs text-gray-600 sm:text-sm">
                Dai un nome al Menù preselezionato e scegli quali ingredienti ne fanno parte.
              </p>

              {presetEditorMode === 'list' && (
                <div className="mx-auto mt-8 max-w-3xl flex flex-col items-stretch gap-4">
                  <div className="flex flex-col items-center gap-2 self-center sm:self-end">
                    <Button
                      variant="success"
                      size="sm"
                      type="button"
                      onClick={startNewCustomPreset}
                      disabled={presetsAtLimit}
                      className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuovo menù preselezionato
                    </Button>
                    {presetsAtLimit && (
                      <MenuMagazzinoLimitNotice message={presetLimitMessage} className="max-w-sm" />
                    )}
                  </div>
                  {customStaffPresets.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 py-12 text-center text-sm text-gray-600">
                      Nessun menù personalizzato. Crea il primo con il pulsante sopra.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {customStaffPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="menu-prices-item-row flex-wrap gap-y-3"
                          style={{ padding: '0.75rem 1rem', minHeight: '72px' }}
                        >
                          <div className="menu-prices-item-text min-w-[120px]">
                            <h4 className="text-left font-semibold text-gray-900">{preset.name}</h4>
                            <p className="text-left text-xs text-gray-500">
                              {preset.item_ids.length}{' '}
                              {preset.item_ids.length === 1 ? 'ingrediente' : 'ingredienti'}
                              {preset.price_per_person != null && preset.price_per_person > 0
                                ? ` · €${preset.price_per_person.toFixed(2)}/persona`
                                : ''}
                            </p>
                            {preset.description?.trim() && (
                              <p className="text-left text-xs text-gray-600 line-clamp-2">
                                {preset.description.trim()}
                              </p>
                            )}
                          </div>
                          <div className="menu-prices-item-actions shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditCustomPreset(preset)}
                              className="menu-prices-icon-btn menu-prices-icon-btn--edit"
                              aria-label={`Modifica ${preset.name}`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <StaffPresetsVisibilityIconButton
                              visible={isStaffPresetVisibleOnBooking(preset)}
                              disabled={upsertRestaurantSetting.isPending}
                              onToggle={() => toggleStaffPresetBookingVisibility(preset.id)}
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomPreset(preset.id, preset.name)}
                              className="menu-prices-icon-btn menu-prices-icon-btn--delete"
                              aria-label={`Elimina ${preset.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {presetEditorMode === 'editor' && (
                <div className="mt-8 flex flex-col gap-6 pb-12">
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Nome menù consigliato *
                      </label>
                      <Input
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="Es. Menù laurea vegan"
                        className="h-14 w-full rounded-2xl pl-6"
                        style={{ height: '56px', borderRadius: '18px', paddingLeft: '24px' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Descrizione
                        <span className="font-normal normal-case text-gray-500"> (opzionale)</span>
                      </label>
                      <Textarea
                        value={presetDescription}
                        onChange={(e) => setPresetDescription(e.target.value)}
                        placeholder="Testo mostrato sotto il nome sulle card in pagina Prenota"
                        maxLength={80}
                        rows={3}
                        className="w-full rounded-2xl border-gray-200 px-4 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Prezzo a persona
                        <span className="font-normal normal-case text-gray-500"> (opzionale)</span>
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={presetPriceInput}
                        onChange={(e) => setPresetPriceInput(e.target.value)}
                        placeholder="Es. 45"
                        className="h-14 w-full rounded-2xl pl-6"
                        style={{ height: '56px', borderRadius: '18px', paddingLeft: '24px' }}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Assegna un prezzo a persona al menù
                      </p>
                    </div>
                  </div>

                  <PresetMenuBuilder
                    selectedItems={presetSelectedItems}
                    onSelectionChange={setPresetSelectedItems}
                  />

                  <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      disabled={upsertRestaurantSetting.isPending}
                      onClick={() => void handleSaveCustomPreset()}
                      className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl border-2 border-emerald-700 transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-emerald-500/35 hover:from-emerald-400 hover:to-emerald-500 hover:border-emerald-600 hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:brightness-100 disabled:hover:from-emerald-500 disabled:hover:to-emerald-600 disabled:hover:border-emerald-700"
                    >
                      <Save className="h-4 w-4" />
                      Salva menù
                    </button>
                    <button
                      type="button"
                      onClick={() => requestClosePresetEditor('list')}
                      className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-600 text-red-600 font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-500/30"
                    >
                      <X className="h-4 w-4 shrink-0" />
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
      )}

      {viewMode === 'categories' && (
        <div
          className="relative w-full rounded-2xl border-2 p-4 md:p-6 shadow-lg"
          style={ADMIN_WARM_GRADIENT_SURFACE}
        >
          <button
            type="button"
            onClick={requestCloseCategoriesOverlay}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-warm-wood/40 bg-white/90 text-warm-wood shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
            aria-label="Chiudi gestione categorie"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto max-w-3xl pb-12 pr-4 sm:pr-10">
            <h3 className="text-center font-serif text-title-card font-bold text-warm-wood">
              Categorie Menu
            </h3>
            <p className="mt-2 text-center text-xs text-gray-600 sm:text-sm">
              Aggiungi, rinomina o elimina le categorie degli ingredienti. Una volta impostate inserisci degli
              ingredienti nelle categorie per completare il menù.
            </p>

            {isAddingCategory ? (
              <div className="mt-8 flex flex-col gap-4">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  <div ref={categoryFormTitleRef}>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Titolo categoria
                    </label>
                    <Input
                      value={newCategoryLabel}
                      onChange={(e) =>
                        setNewCategoryLabel(e.target.value.slice(0, COMPOSE_L.categoryLabel))
                      }
                      maxLength={COMPOSE_L.categoryLabel}
                      placeholder="Es. Antipasti"
                      className="h-14 w-full rounded-2xl pl-6"
                      style={{ height: '56px', borderRadius: '18px', paddingLeft: '24px' }}
                    />
                    <p
                      className={cn(
                        'mt-1 text-right text-[11px] tabular-nums',
                        newCategoryLabel.length >= COMPOSE_L.categoryLabel
                          ? 'text-red-500'
                          : 'text-gray-500',
                      )}
                    >
                      {newCategoryLabel.length}/{COMPOSE_L.categoryLabel}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Nome usato nel form prenotazione e come base per il menu QR.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Descrizione categoria
                    </label>
                    <Textarea
                      value={newCategoryDescription}
                      onChange={(e) =>
                        setNewCategoryDescription(
                          e.target.value.slice(0, COMPOSE_L.itemDescription),
                        )
                      }
                      maxLength={COMPOSE_L.itemDescription}
                      placeholder="Testo breve sotto il titolo (opzionale)"
                      rows={3}
                      className="w-full rounded-2xl border-gray-200 px-4 py-3 text-sm"
                    />
                    <p
                      className={cn(
                        'mt-1 text-right text-[11px] tabular-nums',
                        newCategoryDescription.length >= COMPOSE_L.itemDescription
                          ? 'text-red-500'
                          : 'text-gray-500',
                      )}
                    >
                      {newCategoryDescription.length}/{COMPOSE_L.itemDescription}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Visibile nella pagina Prenota. Nel menu QR puoi personalizzarla separatamente.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Foto categoria{' '}
                      <span className="font-normal normal-case text-gray-500">(opzionale)</span>
                    </label>
                    <div className="flex flex-col items-start gap-3">
                      {(categoryPhotoPreviewUrl || categoryCurrentImageUrl) && (
                        <div className="relative">
                          <img
                            src={categoryPhotoPreviewUrl ?? categoryCurrentImageUrl!}
                            alt="Anteprima foto categoria"
                            className="h-28 w-48 rounded-xl object-cover shadow"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (categoryPhotoPreviewUrl) {
                                URL.revokeObjectURL(categoryPhotoPreviewUrl)
                                setCategoryPhotoPreviewUrl(null)
                                setCategoryPhotoFile(null)
                              } else {
                                setCategoryCurrentImageUrl(null)
                                setCategoryPhotoFile(null)
                              }
                            }}
                            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow"
                            aria-label="Rimuovi foto categoria"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {!categoryPhotoPreviewUrl && !categoryCurrentImageUrl && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-5 py-3 text-sm text-gray-600 transition-colors hover:border-amber-400 hover:text-amber-700">
                          <ImageIcon className="h-4 w-4 shrink-0" />
                          Scegli foto
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              if (categoryPhotoPreviewUrl) URL.revokeObjectURL(categoryPhotoPreviewUrl)
                              setCategoryPhotoFile(file)
                              setCategoryPhotoPreviewUrl(URL.createObjectURL(file))
                            }}
                          />
                        </label>
                      )}
                      {categoryPhotoFile && !categoryPhotoUploading && (
                        <p className="max-w-[240px] truncate text-xs text-gray-500">{categoryPhotoFile.name}</p>
                      )}
                      {categoryPhotoUploading && (
                        <p className="text-xs text-amber-700">Caricamento foto…</p>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Salvata per la pagina Prenota. Le foto del menu QR si gestiscono nel pannello homepage QR.
                    </p>
                  </div>
                  <MenuMagazzinoPropagationNotice />
                </div>
                <div className="mt-10 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveCategory()}
                    disabled={
                      createCategoryMutation.isPending ||
                      updateCategoryMutation.isPending ||
                      categoryPhotoUploading
                    }
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl border-2 border-emerald-700 transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-emerald-500/35 hover:from-emerald-400 hover:to-emerald-500 hover:border-emerald-600 hover:brightness-105 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:brightness-100 disabled:hover:from-emerald-500 disabled:hover:to-emerald-600 disabled:hover:border-emerald-700"
                  >
                    <Save className="h-4 w-4 shrink-0" />
                    Salva
                  </button>
                  <button
                    type="button"
                    onClick={requestCancelCategoryForm}
                    className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-600 text-red-600 font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-500/30"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex w-full flex-col items-end gap-2">
                <Button
                  variant="success"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(true)
                    setEditingCategoryId(null)
                    setNewCategoryLabel('')
                    setNewCategoryDescription('')
                    resetCategoryPhotoState()
                    categoryFormBaselineRef.current = {
                      label: '',
                      description: '',
                      imageUrl: null,
                      hasPhotoFile: false,
                      hasPhotoPreview: false,
                    }
                  }}
                  disabled={categoriesAtLimit}
                  className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuova categoria ingredienti
                </Button>
                {categoriesAtLimit && (
                  <MenuMagazzinoLimitNotice message={categoryLimitMessage} className="w-full" />
                )}
              </div>
            )}

            <div className={cn(menuPricesCategoryListWrapClass, 'mt-8')}>
              <div className="menu-prices-category-block flex w-full flex-col items-center px-1 sm:px-2">
                <div
                  className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 min-[1050px]:grid-cols-2"
                  style={{ marginTop: '0', paddingTop: '0.5rem' }}
                >
                  {categoryEntries.map(([key, label]) => {
                    const dbCat = dbCategoryByKey.get(key)
                    const catAvailable = dbCat ? isMenuCategoryAvailable(dbCat) : true
                    return (
                      <AdminMenuCategoryLabelCard
                        key={key}
                        label={label}
                        imageUrl={dbCat?.image_url}
                        available={catAvailable}
                        onEdit={() => handleEditCategory(key, label)}
                        onDelete={() => handleDeleteCategory(key, label)}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'qr_codes' && features.qrMenu && (
        <MenuQrManager />
      )}

      <Modal
        isOpen={deleteItemConfirm != null}
        onClose={() => setDeleteItemConfirm(null)}
        title="Elimina ingrediente"
        size="sm"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        {deleteItemConfirm && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">
              Sei sicuro di voler eliminare{' '}
              <strong className="font-semibold">{deleteItemConfirm.name}</strong> dal magazzino Menu?
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Le prenotazioni già ricevute mantengono lo snapshot salvato; le vetrine future non mostreranno più
              questo ingrediente.
            </p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteItemConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDeleteItem}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminazione…' : 'Elimina ingrediente'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deletePresetConfirm != null}
        onClose={() => setDeletePresetConfirm(null)}
        title="Elimina menu preselezionato"
        size="sm"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        {deletePresetConfirm && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">
              Eliminare il menu preselezionato{' '}
              <strong className="font-semibold">{deletePresetConfirm.label}</strong>?
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Le card collegate a questo menu verranno eliminate anche da Personalizza form.
            </p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeletePresetConfirm(null)}
                disabled={upsertRestaurantSetting.isPending}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDeleteCustomPreset}
                disabled={upsertRestaurantSetting.isPending}
              >
                {upsertRestaurantSetting.isPending ? 'Eliminazione…' : 'Elimina menu'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={categoryRenameConfirm != null}
        onClose={() => setCategoryRenameConfirm(null)}
        title="Rinominare la categoria?"
        size="sm"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        {categoryRenameConfirm && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">{CATEGORY_KEY_RENAME_INFO_MESSAGE}</p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCategoryRenameConfirm(null)}
                disabled={updateCategoryMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={confirmCategoryRenameSave}
                disabled={updateCategoryMutation.isPending}
              >
                {updateCategoryMutation.isPending ? 'Salvataggio…' : 'Conferma e salva'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteCategoryConfirm != null}
        onClose={() => setDeleteCategoryConfirm(null)}
        title="Elimina categoria"
        size="sm"
        showCloseButton
        closeOnOverlayClick
        closeOnEscape
      >
        {deleteCategoryConfirm && (
          <div className="space-y-4">
            {deleteCategoryConfirm.itemsCount > 0 ? (
              <p className="text-sm leading-relaxed text-slate-700">
                La categoria <strong className="font-semibold">{deleteCategoryConfirm.label}</strong>{' '}
                contiene {deleteCategoryConfirm.itemsCount}{' '}
                {deleteCategoryConfirm.itemsCount === 1 ? 'ingrediente' : 'ingredienti'}. Eliminando la
                categoria verranno rimossi anche tutti gli ingredienti al suo interno.
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                Sei sicuro di voler eliminare la categoria{' '}
                <strong className="font-semibold">{deleteCategoryConfirm.label}</strong>?
              </p>
            )}
            <p className="text-sm leading-relaxed text-slate-600">{CATEGORY_KEY_DELETE_INFO_MESSAGE}</p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteCategoryConfirm(null)}
                disabled={deleteCategoryMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmDeleteCategory}
                disabled={deleteCategoryMutation.isPending}
              >
                {deleteCategoryMutation.isPending ? 'Eliminazione…' : 'Elimina categoria'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <DiscardChangesConfirmModal
        isOpen={categoryDiscardConfirmOpen}
        onStay={() => {
          setCategoryDiscardConfirmOpen(false)
          setCategoryDiscardAction(null)
        }}
        onDiscard={confirmDiscardCategoryDraft}
        message="Hai modifiche non salvate alla categoria. Vuoi annullarle?"
      />

      <DiscardChangesConfirmModal
        isOpen={presetDiscardConfirmOpen}
        onStay={() => {
          setPresetDiscardConfirmOpen(false)
          setPresetDiscardAction(null)
        }}
        onDiscard={confirmPresetDiscard}
        message="Hai modifiche non salvate al menù preselezionato. Vuoi annullarle?"
      />
    </div>
  )
})

MenuPricesTab.displayName = 'MenuPricesTab'
