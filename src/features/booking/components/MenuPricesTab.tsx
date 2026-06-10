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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Plus, Edit, Trash2, Save, X, Eye, EyeOff, QrCode, ImageIcon } from 'lucide-react'
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '../hooks/useMenuItems'
import {
  useCreateMenuCategory,
  useDeleteMenuCategory,
  useMenuCategories,
  useUpdateMenuCategory
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
  MENU_CATEGORY_LABEL_CARD_SHELL_CLASS,
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
  metaLine?: string
  /** Sotto la card bianca. */
  footer?: ReactNode
  /** Vista modifica: icone azione. */
  showActions?: boolean
}

const AdminMenuIngredientCard: React.FC<AdminMenuIngredientCardProps> = ({
  item,
  onEdit,
  onDelete,
  metaLine,
  footer,
  showActions = false,
}) => {
  const hasDesc = Boolean(item.description?.trim())
  return (
    <div
      className="flex w-full flex-col items-stretch gap-1.5"
      style={{
        maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div
        className={cn(
          'menu-prices-item-row flex-col items-stretch gap-1 py-2.5 px-3',
          !hasDesc && 'min-h-0 items-center',
        )}
        style={{
          width: '100%',
          maxWidth: `${MENU_CARD_MAX_WIDTH_PX}px`,
          minHeight: hasDesc ? undefined : '3rem',
        }}
      >
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <p className={cn(MENU_INGREDIENT_NAME_CLASS, 'menu-prices-item-text break-words')}>
            {item.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={MENU_INGREDIENT_PRICE_CLASS}>€{item.price.toFixed(2)}</span>
            {showActions ? (
              <div className="menu-prices-item-actions flex gap-1.5">
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
              </div>
            ) : null}
          </div>
        </div>
        {hasDesc ? (
          <p className={cn(MENU_INGREDIENT_DESC_CLASS, 'break-words')}>{item.description}</p>
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
  onEdit: () => void
  onDelete: () => void
}

const AdminMenuCategoryLabelCard: React.FC<AdminMenuCategoryLabelCardProps> = ({
  label,
  imageUrl,
  onEdit,
  onDelete,
}) => {
  const categoryThumbSrc = imageUrl?.trim() || undefined

  return (
    <div
      className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-2"
      style={{
        maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div
        className={cn(
          MENU_CARD_INNER_SHELL_CLASS,
          MENU_CATEGORY_LABEL_CARD_SHELL_CLASS,
          'w-full min-h-[80px]',
        )}
        style={{
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingLeft: '8px',
          paddingRight: '8px',
          marginBottom: '4px',
          width: '100%',
          maxWidth: `${MENU_CARD_MAX_WIDTH_PX}px`,
          boxSizing: 'border-box',
        }}
      >
        {categoryThumbSrc ? (
          <div className="menu-prices-category-label-card__thumb hidden min-[1050px]:block">
            <img src={categoryThumbSrc} alt="" />
          </div>
        ) : null}
        <div className="menu-prices-category-label-card__body">
          <div className="menu-prices-category-label-card__title">
            <span
              className={cn(
                MENU_CATEGORY_LABEL_TITLE_CLASS,
                'block w-full max-w-full min-w-0 text-center break-words',
              )}
              style={MENU_CATEGORY_LABEL_TITLE_STYLE}
            >
              {label}
            </span>
          </div>
          <div className="menu-prices-category-label-card__actions menu-prices-item-actions flex gap-2">
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

  const closePresetMenusSection = () => {
    resetPresetEditor()
    setViewMode('menu')
  }

  const startNewCustomPreset = () => {
    setEditingCustomPresetId(null)
    setPresetName('')
    setPresetDescription('')
    setPresetPriceInput('')
    setPresetSelectedItems([])
    setPresetEditorMode('editor')
  }

  const startEditCustomPreset = (preset: CustomStaffPreset) => {
    setEditingCustomPresetId(preset.id)
    setPresetName(preset.name)
    setPresetDescription(preset.description ?? '')
    setPresetPriceInput(preset.price_per_person != null ? String(preset.price_per_person) : '')
    setPresetSelectedItems(selectedItemsFromMenuItemIds(menuItems, preset.item_ids))
    setPresetEditorMode('editor')
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
    if (
      !confirm(
        `Eliminare il menù preselezionato "${label}"?\n\nLe card collegate a questo menù verranno eliminate anche da Personalizza form.`,
      )
    ) {
      return
    }
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
    upsertRestaurantSetting.mutate([
      { key: 'booking_custom_staff_presets', value: next },
      ...(nextFormConfig ? [{ key: 'booking_public_form_config' as const, value: nextFormConfig }] : []),
    ])
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

  const [formData, setFormData] = useState<MenuItemInput>({
    name: '',
    category: categoryKeys[0] ?? '',
    price: 0,
    description: '',
    sort_order: 0
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
      sort_order: 0
    })
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(null)
  }

  // Raggruppa per categoria
  const itemsByCategory = groupMenuItemsByCategory(menuItems, categoryKeys)

  const handleStartEdit = (item: MenuItem) => {
    setIngredientEditMode(true)
    setEditingId(item.id)
    setFormData({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description || '',
      sort_order: item.sort_order
    })
    setPriceInput(item.price === 0 ? '' : String(item.price))
    setIsAdding(false)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setCurrentImageUrl(item.image_url ?? null)
    scrollProductFormIntoViewAfterEditRef.current = true
  }

  const handleStartAdd = (preselectedCategory?: string) => {
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
      sort_order: 0
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
  }) => {
    const { editingCategoryId: catId, rawLabel, description, imageUrl, previousKey, newKey } = params

    if (catId && previousKey != null && newKey != null) {
      await updateCategoryMutation.mutateAsync({
        id: catId,
        key: newKey,
        previousKey,
        label: rawLabel,
        description,
        ...(imageUrl !== undefined ? { image_url: imageUrl } : {}),
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
        })
      } else {
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
  }

  const cancelCategoryForm = () => {
    setIsAddingCategory(false)
    setNewCategoryLabel('')
    setNewCategoryDescription('')
    setEditingCategoryId(null)
    resetCategoryPhotoState()
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

    const payload = { ...formData, price: parsedPrice }

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
        setFormData({
          ...formData,
          ...payload,
        })
        setPriceInput(parsedPrice === 0 ? '' : String(parsedPrice))
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
    if (confirm(`Sei sicuro di voler eliminare "${name}"?`)) {
      deleteMutation.mutate(id)
    }
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
              <Button
                variant="success"
                size="sm"
                type="button"
                onClick={() => handleStartAdd()}
                className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs self-center sm:self-end"
              >
                <Plus className="h-3.5 w-3.5" />
                Aggiungi nuovo ingrediente
              </Button>
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
                  <div className="mt-10 flex justify-center gap-3">
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
            {categoryEntries.map(([categoryKey, categoryLabel]) => {
              const categoryItems = itemsByCategory[categoryKey] ?? []
              const itemCount = categoryItems.length
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
                  className={MENU_CATEGORY_COLLAPSIBLE_CLASS}
                  headerClassName={MENU_CATEGORY_COLLAPSIBLE_HEADER_CLASS}
                  contentClassName="bg-transparent p-0"
                  titleClassName={cn(MENU_CATEGORY_LABEL_TITLE_CLASS, 'break-words')}
                  titleStyle={MENU_CATEGORY_LABEL_TITLE_STYLE}
                >
                  <div className="flex flex-col gap-2 px-1 pb-3 pt-0.5 sm:px-2">
                    {itemCount === 0 ? (
                      <div className="flex flex-col items-center gap-3 px-2 py-4">
                        <p className="text-center text-xs text-(--color-text-muted) sm:text-sm">
                          Nessun ingrediente in questa categoria.
                        </p>
                        {ingredientEditMode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => handleStartAdd(categoryKey)}
                            className="gap-1.5 text-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Aggiungi ingrediente
                          </Button>
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
              onClick={closePresetMenusSection}
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
                  <Button
                    variant="success"
                    size="sm"
                    type="button"
                    onClick={startNewCustomPreset}
                    className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs self-center sm:self-end"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuovo menù preselezionato
                  </Button>
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
                      onClick={() => {
                        resetPresetEditor()
                        setPresetEditorMode('list')
                      }}
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
            onClick={() => {
              setViewMode('menu')
              cancelCategoryForm()
            }}
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
                      onChange={(e) => setNewCategoryDescription(e.target.value)}
                      placeholder="Testo breve sotto il titolo (opzionale)"
                      rows={3}
                      className="w-full rounded-2xl border-gray-200 px-4 py-3 text-sm"
                    />
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
                    onClick={cancelCategoryForm}
                    className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-600 text-red-600 font-semibold rounded-xl transition-all duration-300 shadow-md hover:shadow-lg hover:bg-red-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-red-500/30"
                  >
                    <X className="h-4 w-4 shrink-0" />
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex w-full justify-end">
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
                  }}
                  className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuova categoria ingredienti
                </Button>
              </div>
            )}

            <div className={cn(menuPricesCategoryListWrapClass, 'mt-8')}>
              <div className="menu-prices-category-block flex w-full flex-col items-center px-1 sm:px-2">
                <div
                  className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 min-[1050px]:grid-cols-2"
                  style={{ marginTop: '0', paddingTop: '0.5rem' }}
                >
                  {categoryEntries.map(([key, label]) => (
                    <AdminMenuCategoryLabelCard
                      key={key}
                      label={label}
                      imageUrl={dbCategoryByKey.get(key)?.image_url}
                      onEdit={() => handleEditCategory(key, label)}
                      onDelete={() => handleDeleteCategory(key, label)}
                    />
                  ))}
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
    </div>
  )
})

MenuPricesTab.displayName = 'MenuPricesTab'
