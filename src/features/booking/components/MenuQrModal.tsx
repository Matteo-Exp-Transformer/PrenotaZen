import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'react-toastify'
import { Modal } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { generateShortCode } from '@/lib/shortCodeGenerator'
import { useTenantContext } from '@/contexts/TenantContext'
import { useMenuQrcodeCategoriesForQr } from '../hooks/useMenuQrcodeCategories'
import { useMenuItems } from '../hooks/useMenuItems'
import { groupMenuItemsByCategory } from '../utils/menuCatalogGrouping'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import {
  MenuQrCarouselSection,
  MenuQrCategoryCardsSection,
  MenuQrThemeSection,
  buildCategoryOverrideDrafts,
  type CategoryOverrideDraft,
} from './MenuHomepageConfigPanel'
import { DiscardChangesConfirmModal } from './settings/SettingsSaveUi'
import { DEFAULT_THEME_KEY, MENU_THEMES, type MenuThemeKey } from '@/features/public-menu/menuThemes'
import {
  defaultIconKeyForCategory,
  isMenuQrCategoryIconKey,
  MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
} from '@/features/public-menu/categoryIcons'
import {
  filterMenuCategoriesForPublic,
  filterMenuItemsForPublic,
} from '../constants/menuMagazzinoLimits'
import { validateMenuQrSettings, isMenuQrSettingsValid } from '../utils/menuQrValidation'
import { buildCatalogPrefillForKeys } from '../utils/menuQrStorage'
import type {
  CarouselItem,
  MenuItem,
  MenuQrCode,
  MenuQrSettingsSavePayload,
  MenuQrcodeCategoryOverride,
} from '@/types/menu'
import type { MenuCategoryRecord } from '../hooks/useMenuCategories'

const EMPTY_QR_CATEGORY_OVERRIDES: MenuQrcodeCategoryOverride[] = []

/** Calcola categoryFilter e hiddenItemIds da un preset staff esistente. */
function computeImportFromPreset(
  presetItemIds: string[],
  allCategoryKeys: string[],
  itemsByCategory: Record<string, import('@/types/menu').MenuItem[]>,
): { categoryFilter: string[]; hiddenItemIds: string[] } {
  const presetSet = new Set(presetItemIds)
  const categoryFilter: string[] = []
  const hiddenItemIds: string[] = []

  for (const key of allCategoryKeys) {
    const items = itemsByCategory[key] ?? []
    const hasPresetItem = items.some((i) => presetSet.has(i.id))
    if (!hasPresetItem) continue
    categoryFilter.push(key)
    for (const item of items) {
      if (!presetSet.has(item.id)) hiddenItemIds.push(item.id)
    }
  }

  return { categoryFilter, hiddenItemIds }
}

function normalizeThemeKey(key: string | undefined | null): MenuThemeKey {
  if (key && key in MENU_THEMES) return key as MenuThemeKey
  return DEFAULT_THEME_KEY
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (payload: MenuQrSettingsSavePayload) => void
  isPending: boolean
  editing: MenuQrCode | null
  categories: MenuCategoryRecord[]
  tenantSlug: string | null
}

function resolveCategoryFilterForUi(
  raw: string[] | null,
  keysWithItems: string[],
): string[] {
  const allowed = new Set(keysWithItems)
  if (raw === null) return [...keysWithItems]
  return raw.filter((key) => allowed.has(key))
}

function pruneHiddenItemIds(
  hiddenIds: string[],
  itemsByCategory: Record<string, MenuItem[]>,
  selectedKeys: string[],
): string[] {
  const allowedIds = new Set<string>()
  for (const key of selectedKeys) {
    for (const item of itemsByCategory[key] ?? []) {
      allowedIds.add(item.id)
    }
  }
  return hiddenIds.filter((id) => allowedIds.has(id))
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Link copiato')
  } catch {
    toast.error('Impossibile copiare')
  }
}

function serializeMenuQrDraft(input: {
  name: string
  categoryFilter: string[]
  carouselItems: CarouselItem[]
  categoryImages: Record<string, string>
  themeKey: MenuThemeKey
  overrideDrafts: CategoryOverrideDraft
  hiddenItemIds: string[]
  itemSortOverrides: Record<string, string[]>
}): string {
  const sortOverridesSerialized = Object.fromEntries(
    Object.keys(input.itemSortOverrides)
      .sort()
      .map((k) => [k, input.itemSortOverrides[k]]),
  )
  return JSON.stringify({
    name: input.name.trim(),
    categoryFilter: input.categoryFilter,
    carouselItems: input.carouselItems,
    categoryImages: input.categoryImages,
    themeKey: input.themeKey,
    overrideDrafts: input.overrideDrafts,
    hiddenItemIds: [...input.hiddenItemIds].sort(),
    itemSortOverrides: sortOverridesSerialized,
  })
}

export function MenuQrModal({
  isOpen,
  onClose,
  onSave,
  isPending,
  editing,
  categories,
  tenantSlug,
}: Props) {
  const { tenantId } = useTenantContext()
  const menuQrCodeId = editing?.id ?? null
  const { data: overrides = EMPTY_QR_CATEGORY_OVERRIDES, isLoading: overridesLoading } =
    useMenuQrcodeCategoriesForQr(menuQrCodeId)
  const { data: menuItems = [] } = useMenuItems()
  const { data: customPresets = [] } = useRestaurantSetting('booking_custom_staff_presets', {
    authenticated: true,
  })

  const [selectedPresetId, setSelectedPresetId] = useState('')

  const [draftShortCode, setDraftShortCode] = useState(() => generateShortCode())
  const [name, setName] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([])
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({})
  const [themeKey, setThemeKey] = useState<MenuThemeKey>(DEFAULT_THEME_KEY)
  const [overrideDrafts, setOverrideDrafts] = useState<CategoryOverrideDraft>({})
  const [hiddenItemIds, setHiddenItemIds] = useState<string[]>([])
  const [itemSortOverrides, setItemSortOverrides] = useState<Record<string, string[]>>({})
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  const baselineRef = useRef('')
  const baselineSessionRef = useRef<string | null>(null)
  const overridesHydratedSessionRef = useRef<string | null>(null)
  const [overridesHydratedVersion, setOverridesHydratedVersion] = useState(0)
  const [baselineReady, setBaselineReady] = useState(false)

  const publicMenuItems = useMemo(
    () => filterMenuItemsForPublic(menuItems, categories),
    [menuItems, categories],
  )

  const publicCategories = useMemo(
    () => filterMenuCategoriesForPublic(categories),
    [categories],
  )

  const categoriesWithItems = useMemo(() => {
    const keysWithItems = new Set(publicMenuItems.map((i) => i.category))
    return publicCategories.filter((c) => keysWithItems.has(c.key))
  }, [publicCategories, publicMenuItems])

  const categoryKeysWithItems = useMemo(
    () => categoriesWithItems.map((c) => c.key),
    [categoriesWithItems],
  )

  const allCategoryKeys = useMemo(() => publicCategories.map((c) => c.key), [publicCategories])

  const itemsByCategory = useMemo(
    () => groupMenuItemsByCategory(publicMenuItems, allCategoryKeys),
    [publicMenuItems, allCategoryKeys],
  )

  const categoryByKey = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c])),
    [categories],
  )

  const selectedCategories = useMemo(
    () =>
      categoryFilter
        .map((key) => categoryByKey[key])
        .filter((c): c is MenuCategoryRecord => !!c),
    [categoryFilter, categoryByKey],
  )

  const activeShortCode = editing?.short_code ?? draftShortCode

  useEffect(() => {
    if (isOpen) return
    baselineSessionRef.current = null
    overridesHydratedSessionRef.current = null
    setOverridesHydratedVersion(0)
    setBaselineReady(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const sessionKey = editing?.id ?? 'new'
    if (overridesHydratedSessionRef.current === sessionKey) return

    if (editing) {
      setName(editing.name)
      setCategoryFilter(resolveCategoryFilterForUi(editing.category_filter, categoryKeysWithItems))
      setCarouselItems(editing.carousel_items ?? [])
      setCategoryImages(editing.category_images ?? {})
      setThemeKey(normalizeThemeKey(editing.theme_key))
      setHiddenItemIds(editing.hidden_menu_item_ids ?? [])
      setItemSortOverrides(editing.item_sort_overrides ?? {})
      return
    }

    setDraftShortCode(generateShortCode())
    setName('')
    const initialFilter =
      categoryKeysWithItems.length > 0 ? [...categoryKeysWithItems] : []
    setCategoryFilter(initialFilter)
    setCarouselItems([])
    setCategoryImages(buildCatalogPrefillForKeys(initialFilter, categories, {}, tenantId))
    setThemeKey(DEFAULT_THEME_KEY)
    setHiddenItemIds([])
    setItemSortOverrides({})
    setOverrideDrafts(buildCategoryOverrideDrafts(categories, []))
    overridesHydratedSessionRef.current = 'new'
    setOverridesHydratedVersion((v) => v + 1)
  }, [isOpen, editing?.id, categoryKeysWithItems, categories])

  useEffect(() => {
    if (!isOpen || !editing || overridesLoading) return

    const sessionKey = editing.id
    if (overridesHydratedSessionRef.current === sessionKey) return

    setOverrideDrafts(buildCategoryOverrideDrafts(categories, overrides))
    overridesHydratedSessionRef.current = sessionKey
    setOverridesHydratedVersion((v) => v + 1)
  }, [isOpen, editing?.id, overridesLoading, categories, overrides])

  useEffect(() => {
    if (!isOpen) return

    const sessionKey = editing?.id ?? 'new'
    if (baselineSessionRef.current === sessionKey) return
    if (overridesHydratedSessionRef.current !== sessionKey) return

    baselineRef.current = serializeMenuQrDraft({
      name,
      categoryFilter,
      carouselItems,
      categoryImages,
      themeKey,
      overrideDrafts,
      hiddenItemIds,
      itemSortOverrides,
    })
    baselineSessionRef.current = sessionKey
    setBaselineReady(true)
  }, [isOpen, editing?.id, overridesHydratedVersion])

  const isDirty = useMemo(() => {
    if (!isOpen || !baselineReady) return false
    return (
      serializeMenuQrDraft({
        name,
        categoryFilter,
        carouselItems,
        categoryImages,
        themeKey,
        overrideDrafts,
        hiddenItemIds,
        itemSortOverrides,
      }) !== baselineRef.current
    )
  }, [
    isOpen,
    name,
    categoryFilter,
    carouselItems,
    categoryImages,
    themeKey,
    overrideDrafts,
    hiddenItemIds,
    itemSortOverrides,
    baselineReady,
  ])

  const requestClose = () => {
    if (isPending) return
    if (!isDirty) {
      onClose()
      return
    }
    setDiscardConfirmOpen(true)
  }

  const confirmDiscardClose = () => {
    setDiscardConfirmOpen(false)
    baselineSessionRef.current = null
    overridesHydratedSessionRef.current = null
    onClose()
  }

  const allCatsSelected =
    categoryKeysWithItems.length > 0 &&
    categoryKeysWithItems.every((k) => categoryFilter.includes(k))

  const toggleAllCategories = () => {
    if (allCatsSelected) {
      setCategoryFilter([])
      return
    }
    const keys = [...categoryKeysWithItems]
    setCategoryFilter(keys)
    setCategoryImages((prev) => buildCatalogPrefillForKeys(keys, categories, prev, tenantId))
  }

  const toggleCategory = (key: string) => {
    if (!categoryKeysWithItems.includes(key)) return
    if (categoryFilter.includes(key)) {
      setCategoryFilter((prev) => prev.filter((k) => k !== key))
      return
    }
    setCategoryFilter((prev) => [...prev, key])
    setCategoryImages((prev) => buildCatalogPrefillForKeys([key], categories, prev, tenantId))
  }

  const handleImportPreset = () => {
    const preset = customPresets.find((p) => p.id === selectedPresetId)
    if (!preset) return
    const { categoryFilter: newFilter, hiddenItemIds: newHidden } = computeImportFromPreset(
      preset.item_ids,
      categoryKeysWithItems,
      itemsByCategory,
    )
    if (newFilter.length === 0) {
      toast.warn('Nessuna categoria del menù corrisponde a questo preset.')
      return
    }
    setCategoryFilter(newFilter)
    setHiddenItemIds(newHidden)
    setCategoryImages(buildCatalogPrefillForKeys(newFilter, categories, {}, tenantId))
    setSelectedPresetId('')
    toast.info(`Preset "${preset.name}" importato — categorie e ingredienti precompilati.`)
  }

  const moveCategoryInFilter = (key: string, direction: -1 | 1) => {
    setCategoryFilter((prev) => {
      const i = prev.indexOf(key)
      if (i < 0) return prev
      const j = i + direction
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const validationInput = useMemo(
    () => ({
      carouselItems,
      categoryFilter,
      itemsByCategory,
      hiddenItemIds,
    }),
    [carouselItems, categoryFilter, itemsByCategory, hiddenItemIds],
  )

  const canSaveSettings = useMemo(
    () => isMenuQrSettingsValid(validationInput),
    [validationInput],
  )

  const canSave = !!name.trim() && canSaveSettings && !isPending

  const validateBeforeSave = (): boolean => {
    const validation = validateMenuQrSettings(validationInput)
    if (!validation.ok) {
      toast.warn(validation.message)
      return false
    }
    return true
  }

  const buildPayload = (): MenuQrSettingsSavePayload | null => {
    const trimmed = name.trim()
    if (!trimmed) return null

    const shortCode = activeShortCode
    const prunedHidden = pruneHiddenItemIds(hiddenItemIds, itemsByCategory, categoryFilter)

    const filteredCategoryImages = Object.fromEntries(
      Object.entries(categoryImages).filter(([key]) => categoryFilter.includes(key)),
    )

    const categoryOverrides = selectedCategories.map((cat) => {
      const d = overrideDrafts[cat.key] ?? {
        title: cat.label,
        description: cat.description ?? '',
        icon: defaultIconKeyForCategory(cat.key) ?? MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
      }
      const trimmedIcon = d.icon?.trim()
      return {
        category_key: cat.key,
        title: d.title.trim() || null,
        description: d.description.trim() || null,
        icon:
          trimmedIcon && isMenuQrCategoryIconKey(trimmedIcon)
            ? trimmedIcon
            : (defaultIconKeyForCategory(cat.key) ?? MENU_QR_DEFAULT_CATEGORY_ICON_KEY),
      }
    })

    const activeCategorySet = new Set(
      categoryFilter.filter((key) => categoryKeysWithItems.includes(key)),
    )
    const prunedItemSortOverrides = Object.fromEntries(
      Object.entries(itemSortOverrides).filter(([key]) => activeCategorySet.has(key)),
    )

    return {
      shortCode,
      qrId: editing?.id ?? null,
      draftShortCode: editing ? null : draftShortCode,
      input: {
        name: trimmed,
        category_filter: [...activeCategorySet],
        is_active: editing?.is_active ?? true,
        theme_key: themeKey,
        carousel_items: carouselItems,
        category_images: filteredCategoryImages,
        hidden_menu_item_ids: prunedHidden,
        item_sort_overrides: Object.keys(prunedItemSortOverrides).length > 0
          ? prunedItemSortOverrides
          : null,
      },
      categoryOverrides,
    }
  }

  const handleSave = () => {
    if (!validateBeforeSave()) return
    const payload = buildPayload()
    if (payload) onSave(payload)
  }

  const previewUrl =
    tenantSlug && activeShortCode
      ? `${window.location.origin}/menu/${tenantSlug}/qr/${activeShortCode}`
      : null

  const headerBelow = previewUrl ? (
    <div className="flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-500">
        {previewUrl}
      </p>
      <button
        type="button"
        className="is-clickable shrink-0 rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
        aria-label="Copia link menu QR"
        title="Copia link"
        onClick={() => void copyToClipboard(previewUrl)}
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  ) : null

  const bottomBar = (
    <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
      <Button variant="ghost" onClick={requestClose} disabled={isPending}>
        Annulla
      </Button>
      <Button variant="primary" onClick={handleSave} disabled={!canSave}>
        {isPending ? 'Salvataggio…' : 'Salva'}
      </Button>
    </div>
  )

  if (!tenantId) return null

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title="Impostazione Menù QR"
        headerBelow={headerBelow}
        size="lg"
        showCloseButton
        closeOnOverlayClick={!isPending}
        closeOnEscape={!isPending}
      >
      <div className="flex max-h-[min(80vh,720px)] flex-col gap-4 overflow-y-auto">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="text-sm font-semibold text-gray-800">Nome QR *</label>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!canSave}>
              {isPending ? 'Salvataggio…' : 'Salva'}
            </Button>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Tavoli sala, Menu eventi…"
            maxLength={80}
          />
        </div>

        {customPresets.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-gray-800">Importa da preset staff</p>
            <p className="mb-2 text-xs text-gray-500">
              Precompila categorie e ingredienti visibili in base a un preset esistente. Il carosello
              non viene toccato. Il preset originale rimane invariato.
            </p>
            <div className="flex items-center gap-2">
              <select
                className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 outline-none"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                <option value="">Scegli preset…</option>
                {customPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportPreset}
                disabled={!selectedPresetId}
              >
                Importa
              </Button>
            </div>
          </div>
        )}

        {publicCategories.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Categorie di prodotti visibili</p>
              {categoryKeysWithItems.length > 0 ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={allCatsSelected}
                    onChange={toggleAllCategories}
                  />
                  Attiva tutte
                </label>
              ) : null}
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Elenco allineato alle categorie disponibili in tab Menu (escluse quelle spente nel
              magazzino). Serve almeno una categoria con almeno un ingrediente visibile.
            </p>
            <div className="flex flex-wrap gap-2">
              {publicCategories.map((cat) => {
                const hasItems = categoryKeysWithItems.includes(cat.key)
                return (
                  <label
                    key={cat.key}
                    className={`flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm ${
                      hasItems ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 shrink-0"
                      checked={categoryFilter.includes(cat.key)}
                      disabled={!hasItems}
                      onChange={() => toggleCategory(cat.key)}
                    />
                    {cat.label}
                    {!hasItems ? (
                      <span className="text-[10px] text-gray-400">(nessun ingrediente)</span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Nessuna categoria nel menù — creane almeno una dalla tab Menu → Gestione categorie.
          </p>
        )}

        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-800">
            Carosello specialità
          </h4>
          <MenuQrCarouselSection
            tenantId={tenantId}
            menuQrCodeId={menuQrCodeId}
            draftShortCode={editing ? null : draftShortCode}
            items={carouselItems}
            onChange={setCarouselItems}
          />
        </section>

        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-800">
            Titoli e descrizioni categorie
          </h4>
          <p className="mb-3 text-xs text-gray-500">
            Titolo e descrizione visibili solo nella pagina di questo Menù QR che vedranno i clienti.
          </p>
          <MenuQrCategoryCardsSection
            tenantId={tenantId}
            menuQrCodeId={menuQrCodeId}
            draftShortCode={editing ? null : draftShortCode}
            categories={selectedCategories}
            categoryImages={categoryImages}
            overrideDrafts={overrideDrafts}
            onCategoryImagesChange={setCategoryImages}
            onOverrideDraftsChange={setOverrideDrafts}
            itemsByCategory={itemsByCategory}
            hiddenItemIds={hiddenItemIds}
            onHiddenItemIdsChange={setHiddenItemIds}
            itemSortOverrides={itemSortOverrides}
            onItemSortOverridesChange={setItemSortOverrides}
            onMoveCategoryUp={(key) => moveCategoryInFilter(key, -1)}
            onMoveCategoryDown={(key) => moveCategoryInFilter(key, 1)}
          />
        </section>

        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-800">Tema homepage</h4>
          <MenuQrThemeSection value={themeKey} onChange={setThemeKey} />
        </section>

        {bottomBar}
      </div>
    </Modal>

      <DiscardChangesConfirmModal
        isOpen={discardConfirmOpen}
        onStay={() => setDiscardConfirmOpen(false)}
        onDiscard={confirmDiscardClose}
      />
    </>
  )
}
