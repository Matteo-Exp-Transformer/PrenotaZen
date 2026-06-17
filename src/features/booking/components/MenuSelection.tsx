import React, { useMemo, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMenuItems } from '../hooks/useMenuItems'
import { useMenuCategories } from '../hooks/useMenuCategories'
import type { SelectedMenuItem } from '@/types/menu'
import {
  customPresetStorageId,
  getCustomPresetUuid,
  getPresetMenu,
  getPresetMenuLabel,
  isBuiltinPresetMenuType,
  resolvePresetDisplayTitle,
  shouldShowComposeMenuHeader,
  isCustomPresetMenuType,
  isStaffPresetFixedMenu,
  isStaffPresetSelectableForBookingType,
  staffPresetDescriptionForCards,
  type CustomStaffPreset,
  type PresetMenuType,
} from '../constants/presetMenus'
import { groupMenuItemsByCategory } from '../utils/menuCatalogGrouping'
import { buildOrderedCategoryEntries } from '../utils/orderCategoryKeys'
import type { BookingType } from '@/types/booking'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import { isMenuItemVisibleForSelection } from '../utils/bookingCapabilities'
import {
  filterMenuCategoriesForPublic,
  filterMenuItemsForPublic,
  isMenuCategoryAvailable,
} from '../constants/menuMagazzinoLimits'
import { MENU_CARD_MAX_WIDTH_PX } from './menuPricesCatalogLayout'
import { BookingMenuComposeGrid } from './publicBooking/BookingMenuComposeGrid'
import { BOOKING_PUBLIC_CONTENT_WIDTH } from '@/features/booking/constants/bookingPublicFieldStyles'
import {
  type ComposeMenuItem,
} from '../utils/menuComposeVisibility'

interface MenuSelectionProps {
  selectedItems: SelectedMenuItem[]
  numGuests: number
  onMenuChange: (payload: {
    items: SelectedMenuItem[]
    totalPerPerson: number
  }) => void
  presetMenu?: PresetMenuType
  onPresetMenuChange?: (preset: PresetMenuType) => void
  bookingType?: BookingType
  /** Se false, nasconde il menu a tendina dei menù consigliati (impostazione admin). Default: true */
  staffPresetsDropdownVisible?: boolean
  /** Menù personalizzati dallo staff (da restaurant_settings). */
  customStaffPresets?: CustomStaffPreset[]
  /** Nasconde il blocco «Riepilogo Scelte» e i totali (evita duplicato con la sidebar). Default: false */
  hideSummary?: boolean
  /** Etichette custom per le card/opzioni preset (da booking_public_form_config). */
  subTabOverrides?: { preset_id: string; custom_label: string }[]
  /** Nasconde la griglia ingredienti (es. sottotab manuale). Default: false */
  hideMenuGrid?: boolean
  /** Categorie nascoste dalla card sottotab scelta. */
  hiddenCategoryKeys?: string[]
  /** Ordine categorie da Personalizza form (sub-tab); assente = sort_order DB. */
  categoryOrderKeys?: string[]
  /** Ingredienti nascosti dalla card sottotab scelta. */
  hiddenItemIds?: string[]
  /** Form /prenota: blocchi centrati al 75% larghezza viewport */
  publicFormLayout?: boolean
  /** Titolo/riepilogo menù in bianco solo su sfondo full-page foto. */
  publicFormLightTextOnDarkBackground?: boolean
  /** Descrizione menù preselezionato (sottotab o preset staff); opzionale, sotto «CREA IL TUO MENU». */
  presetDescription?: string
  /** Se true, non usa la descrizione del menù staff come fallback. */
  disablePresetDescriptionFallback?: boolean
  /** Titolo sezione menù da Etichetta card sottotab (priorità su nome preset staff). */
  presetSectionTitle?: string
  /** Forza blocco/sblocco ingredienti dalla card Prenota selezionata. */
  menuSelectionLockedOverride?: boolean
  /** Chiave per richiudere card ingredienti aperte (es. submit con errori). */
  composeCollapseKey?: string
  /** false = sottotab con prezzo fisso: nasconde € per ingrediente. Default true. */
  showIngredientPrices?: boolean
  /**
   * Chiavi categoria compilabili (da SubTab.compilable_category_keys).
   * Assente = tutte le categorie compilabili (backward compat).
   * Presente = solo le chiavi elencate mostrano checkbox; le altre restano visibili ma bloccate.
   */
  compilableCategoryKeys?: string[]
}

type NormalizedMenuItem = ComposeMenuItem

export const MenuSelection: React.FC<MenuSelectionProps> = ({
  selectedItems,
  numGuests,
  onMenuChange,
  presetMenu,
  onPresetMenuChange,
  bookingType,
  staffPresetsDropdownVisible = true,
  customStaffPresets = [],
  hideSummary = false,
  subTabOverrides = [],
  hideMenuGrid = false,
  hiddenCategoryKeys = [],
  hiddenItemIds = [],
  categoryOrderKeys,
  publicFormLayout = false,
  publicFormLightTextOnDarkBackground = false,
  presetDescription,
  disablePresetDescriptionFallback = false,
  presetSectionTitle,
  menuSelectionLockedOverride,
  composeCollapseKey,
  showIngredientPrices = true,
  compilableCategoryKeys,
}) => {
  const publicBlockClass = publicFormLayout ? BOOKING_PUBLIC_CONTENT_WIDTH : 'mx-auto w-full max-w-full'
  const { data: menuItems = [], isLoading, error } = useMenuItems()
  const { data: dbCategories = [] } = useMenuCategories()

  const formatPrice = (item: NormalizedMenuItem) =>
    `€${item.price.toFixed(2)}${item.priceSuffix ?? ''}`
  const formatCurrency = (value: number) => `€${value.toFixed(2)}`

  const selectableStaffPresets = useMemo(
    () => customStaffPresets.filter((p) => isStaffPresetSelectableForBookingType(p, bookingType)),
    [customStaffPresets, bookingType],
  )

  const menuSelectionLocked = useMemo(() => {
    if (typeof menuSelectionLockedOverride === 'boolean') return menuSelectionLockedOverride
    if (!presetMenu) return false
    if (isBuiltinPresetMenuType(presetMenu)) return true
    if (!isCustomPresetMenuType(presetMenu)) return false
    const uuid = getCustomPresetUuid(presetMenu)
    const preset = uuid ? customStaffPresets.find((p) => p.id === uuid) : undefined
    return preset ? isStaffPresetFixedMenu(preset) : false
  }, [presetMenu, customStaffPresets, menuSelectionLockedOverride])

  const showStaffPresetDropdown = useMemo(() => {
    if (!bookingTypeUsesMenuSelections(bookingType) || !onPresetMenuChange || !staffPresetsDropdownVisible) {
      return false
    }
    if (selectableStaffPresets.length > 0) return true
    if (presetMenu != null && isBuiltinPresetMenuType(presetMenu)) return true
    if (
      presetMenu != null &&
      isCustomPresetMenuType(presetMenu) &&
      customStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu) &&
      !selectableStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu)
    ) {
      return true
    }
    if (
      presetMenu != null &&
      isCustomPresetMenuType(presetMenu) &&
      !customStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu)
    ) {
      return true
    }
    return false
  }, [
    bookingType,
    onPresetMenuChange,
    staffPresetsDropdownVisible,
    customStaffPresets,
    selectableStaffPresets,
    presetMenu,
  ])

  const activeCustomPreset = useMemo(() => {
    if (!presetMenu || !isCustomPresetMenuType(presetMenu)) return undefined
    const uuid = getCustomPresetUuid(presetMenu)
    return uuid ? customStaffPresets.find((p) => p.id === uuid) : undefined
  }, [presetMenu, customStaffPresets])

  const publicMenuItems = useMemo(
    () => filterMenuItemsForPublic(menuItems, dbCategories),
    [menuItems, dbCategories],
  )

  const publicDbCategories = useMemo(
    () => filterMenuCategoriesForPublic(dbCategories),
    [dbCategories],
  )

  const normalizedMenuItems = useMemo<NormalizedMenuItem[]>(() => {
    const hiddenCategories = new Set(hiddenCategoryKeys)
    const hiddenItems = new Set(hiddenItemIds)
    const activePresetItemIds = new Set(activeCustomPreset?.item_ids ?? [])
    return publicMenuItems
      .filter((item) =>
        // Fonte unica testabile del predicato (LOCK Ingredienti preset custom): card con preset
        // → SOLO item del preset per ogni booking_type; senza preset → legacy per tipo.
        isMenuItemVisibleForSelection({
          itemId: item.id,
          itemCategory: item.category,
          itemBookingTypes: item.booking_types,
          bookingType,
          activePresetItemIds,
          hiddenCategoryKeys: hiddenCategories,
          hiddenItemIds: hiddenItems,
        }),
      )
      .map<NormalizedMenuItem>((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description ?? undefined,
        sort_order: item.sort_order ?? 0,
        image_url: item.image_url ?? null,
      }))
  }, [publicMenuItems, bookingType, hiddenCategoryKeys, hiddenItemIds, activeCustomPreset])

  const categoryEntries = useMemo(() => {
    // Parti SEMPRE dal catalogo DB: le card categoria non devono sparire quando
    // un preset/bookingType filtra via gli ingredienti (la griglia nasconde da
    // sé le categorie senza ingredienti visibili). Aggiungi solo le categorie
    // extra presenti negli item ma non in DB, per non perderle.
    const catalogKeys = publicDbCategories.map((category) => category.key)
    const itemCategoryKeys = [...new Set(normalizedMenuItems.map((item) => item.category))]
    const extraKeys = itemCategoryKeys.filter((key) => !catalogKeys.includes(key))
    const keys = [...catalogKeys, ...extraKeys]
    const categoriesForOrder = [
      ...publicDbCategories,
      ...extraKeys.map((key, index) => ({ key, label: key, sort_order: 1000 + index })),
    ]
    return buildOrderedCategoryEntries(categoriesForOrder, keys, categoryOrderKeys)
  }, [publicDbCategories, categoryOrderKeys, normalizedMenuItems])

  const categoryImageByKey = useMemo(() => {
    const map: Record<string, string | null | undefined> = {}
    for (const cat of publicDbCategories) {
      if (isMenuCategoryAvailable(cat)) {
        map[cat.key] = cat.image_url
      }
    }
    return map
  }, [publicDbCategories])

  const showComposeHeader =
    !hideMenuGrid &&
    !menuSelectionLocked &&
    shouldShowComposeMenuHeader(
      presetMenu ?? null,
      activeCustomPreset,
      bookingType,
    )

  const presetTitleLabel = resolvePresetDisplayTitle(
    presetMenu ?? null,
    customStaffPresets,
    subTabOverrides,
  )
  const lockedPresetTitle = presetSectionTitle?.trim() || presetTitleLabel

  const composePresetDescription = useMemo(() => {
    const fromTab = presetDescription?.trim()
    if (fromTab) return fromTab
    if (disablePresetDescriptionFallback) return undefined
    if (activeCustomPreset) return staffPresetDescriptionForCards(activeCustomPreset)
    return undefined
  }, [presetDescription, activeCustomPreset, disablePresetDescriptionFallback])

  // Raggruppa per categoria
  const itemsByCategory = useMemo(
    () =>
      groupMenuItemsByCategory(
        normalizedMenuItems,
        categoryEntries.map(([key]) => key),
      ),
    [categoryEntries, normalizedMenuItems],
  )

  const totalPerPerson = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.price, 0),
    [selectedItems],
  )

  const emitMenuSelectionChange = useCallback((items: SelectedMenuItem[]) => {
    const itemsChanged = items.length !== selectedItems.length ||
      items.some((item, index) => {
        const existing = selectedItems[index]
        return !existing || item.id !== existing.id
      })
    if (!itemsChanged) return

    const itemsWithTotals = items.map((selected) => ({
      ...selected,
      totalPrice: selected.totalPrice ?? selected.price,
    }))

    const total = itemsWithTotals.reduce((sum, item) => sum + item.price, 0)
    onMenuChange({ items: itemsWithTotals, totalPerPerson: total })
  }, [selectedItems, onMenuChange])

  const handleItemToggle = (item: NormalizedMenuItem) => {
    if (menuSelectionLocked) return

    const isSelected = selectedItems.some(selected => selected.id === item.id)

    if (isSelected) {
      const remainingItems = selectedItems.filter(selected => selected.id !== item.id)
      emitMenuSelectionChange(remainingItems)
      return
    }

    const newItem: SelectedMenuItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
    }

    emitMenuSelectionChange([
      ...selectedItems.filter(selected => selected.id !== item.id),
      newItem
    ])
  }

  const handleRemoveSelectedItem = (itemId: string) => {
    if (menuSelectionLocked) return

    const remainingItems = selectedItems.filter(item => item.id !== itemId)
    emitMenuSelectionChange(remainingItems)
  }

  if (isLoading) {
    return <div className="text-center py-4 text-gray-600">Caricamento menu...</div>
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600 font-semibold mb-2">Errore nel caricamento del menu</p>
        <p className="text-sm text-gray-600">Contatta l&apos;amministratore</p>
      </div>
    )
  }

  return (
    <div className={cn('isolate w-full min-w-0', publicFormLayout ? publicBlockClass : 'mx-auto w-full max-w-full')}>
      {/* Titolo sezione menù — compose: solo titolo grande (no etichetta piccola / descrizione) */}
      {showComposeHeader ? (
        <div
          className={cn('mb-4 w-full rounded-2xl bg-white/85 px-5 py-4 backdrop-blur-[1px]', publicFormLayout ? 'mr-auto' : 'mx-auto')}
          style={{ maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, 100%)` }}
        >
          <h2 className="font-serif text-xl font-bold text-warm-wood md:text-2xl">Crea il tuo menù</h2>
          {composePresetDescription ? (
            <p className="mt-2 text-sm font-medium text-warm-wood-dark/75">{composePresetDescription}</p>
          ) : null}
        </div>
      ) : lockedPresetTitle ? (
        <div
          className={cn('mb-4 w-full', publicFormLayout ? 'mr-auto' : 'mx-auto')}
          style={{ maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, 100%)` }}
        >
          <p
            className={cn(
              'text-[13px] font-bold leading-tight sm:text-base lg:text-sm xl:text-base',
              publicFormLightTextOnDarkBackground ? 'text-white' : 'text-warm-wood',
            )}
          >
            Hai selezionato :
          </p>
          <h2
            className={cn(
              'mt-1 font-serif text-xl font-bold md:text-2xl',
              publicFormLightTextOnDarkBackground ? 'text-white' : 'text-warm-wood',
            )}
          >
            {lockedPresetTitle}
          </h2>
          {composePresetDescription ? (
            <p
              className={cn(
                'mt-2 text-sm font-medium',
                publicFormLightTextOnDarkBackground ? 'text-white/90' : 'text-warm-wood-dark/75',
              )}
            >
              {composePresetDescription}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn('mb-4 w-full rounded-2xl bg-white/85 px-5 py-4 backdrop-blur-[1px]', publicFormLayout ? 'mr-auto' : 'mx-auto')}
          style={{ maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, 100%)` }}
        >
          <h2 className="font-serif text-xl font-bold text-warm-wood md:text-2xl">Menù</h2>
          {composePresetDescription ? (
            <p className="mt-2 text-sm font-medium text-warm-wood-dark/75">{composePresetDescription}</p>
          ) : null}
        </div>
      )}

      {/* Banner omaggio + menu a tendina menù consigliati — solo Rinfresco di Laurea */}
      {showStaffPresetDropdown && bookingTypeUsesMenuSelections(bookingType) && (
        <div
          className="w-full flex flex-col items-center px-1 sm:px-2"
          style={{
            paddingTop: '1rem',
            paddingBottom: '0',
            marginTop: '0',
            marginBottom: '0',
          }}
        >
          <select
            id="preset_menu"
            value={presetMenu || ''}
            onChange={(e) => {
              const value = e.target.value
              onPresetMenuChange?.(value === '' ? null : (value as Exclude<PresetMenuType, null>))
            }}
            className="block rounded-full border shadow-sm transition-all w-full"
            style={{
              borderColor: 'rgba(0,0,0,0.2)',
              height: '56px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              color: 'black',
              maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
              margin: '0 auto'
            }}
            onFocus={(e) => (e.target as HTMLSelectElement).style.borderColor = '#8B6914'}
            onBlur={(e) => (e.target as HTMLSelectElement).style.borderColor = 'rgba(0,0,0,0.2)'}
          >
            <option value="">Scegli un menù consigliato dallo staff</option>
            {presetMenu != null && isBuiltinPresetMenuType(presetMenu) && (
              <option value={presetMenu}>{getPresetMenu(presetMenu)?.label ?? presetMenu}</option>
            )}
            {presetMenu != null &&
              isCustomPresetMenuType(presetMenu) &&
              customStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu) &&
              !selectableStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu) && (
                <option value={presetMenu}>
                  {getPresetMenuLabel(presetMenu, customStaffPresets)}
                </option>
              )}
            {presetMenu != null &&
              isCustomPresetMenuType(presetMenu) &&
              !customStaffPresets.some((p) => customPresetStorageId(p.id) === presetMenu) && (
                <option value={presetMenu}>
                  {getPresetMenuLabel(presetMenu, customStaffPresets)}
                </option>
              )}
            {selectableStaffPresets.map((p) => {
              const override = subTabOverrides.find((o) => o.preset_id === p.id)
              return (
                <option key={p.id} value={customPresetStorageId(p.id)}>
                  {override?.custom_label?.trim() || p.name}
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* Card orizzontali per categoria (mockup CREA IL TUO MENU) */}
      {!hideMenuGrid && (
        <div className={cn('mt-4 w-full min-w-0', publicFormLayout && 'flex flex-col')}>
          <BookingMenuComposeGrid
            categoryEntries={categoryEntries}
            categoryImageByKey={categoryImageByKey}
            itemsByCategory={itemsByCategory}
            selectedItems={selectedItems}
            locked={menuSelectionLocked}
            presetMenu={presetMenu}
            menuItems={menuItems}
            customStaffPresets={customStaffPresets}
            formatPrice={formatPrice}
            onToggleItem={handleItemToggle}
            composeCollapseKey={composeCollapseKey}
            showIngredientPrices={showIngredientPrices}
            compilableCategoryKeys={compilableCategoryKeys}
          />
        </div>
      )}

      {/* Riepilogo Scelte — nascosto quando la sidebar mostra già il riepilogo */}
      {!hideSummary && selectedItems.length > 0 && (
        <div className="w-full flex justify-center">
          <div
            className="w-full max-w-[746px] border-2 rounded-xl bg-white/85 transition-all duration-200"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              borderColor: 'rgba(0,0,0,0.2)',
              borderRadius: '16px'
            }}
          >
            <div className="flex items-center justify-between" style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '22px', paddingBottom: '22px' }}>
              <h3 className="text-title-card font-semibold text-warm-wood">Riepilogo Scelte</h3>
              <span className="text-label font-medium text-gray-600">{selectedItems.length} elementi</span>
            </div>
            <div style={{ height: '2px', backgroundColor: '#60a5fa', marginLeft: '22px', marginRight: '22px' }} />
            <div style={{ paddingLeft: '22px', paddingRight: '22px', paddingTop: '18px', paddingBottom: '18px' }}>
              <div className="flex flex-wrap" style={{ gap: '16px' }}>
                {selectedItems.map((item) => {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleRemoveSelectedItem(item.id)}
                      disabled={menuSelectionLocked}
                      className={cn(
                        'group flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-semibold text-warm-wood shadow-sm transition-all',
                        menuSelectionLocked ? 'cursor-default' : 'hover:bg-warm-beige/30',
                      )}
                      style={{ borderColor: '#60a5fa' }}
                    >
                      <span className="truncate max-w-[180px] text-left">{item.name}</span>
                      <X className="h-4 w-4 transition-colors" style={{ color: '#60a5fa' }} />
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Totali — nascosti quando la sidebar mostra già i totali */}
      {!hideSummary && selectedItems.length > 0 && (
        <div className="w-full flex justify-center">
          <div
            className="w-full max-w-[746px] border-2 rounded-xl bg-white/85 transition-all duration-200"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              borderColor: 'rgba(0,0,0,0.2)',
              borderRadius: '16px'
            }}
          >
            <div className="space-y-4" style={{ paddingLeft: '30px', paddingRight: '30px', paddingTop: '30px', paddingBottom: '30px' }}>
              <div className="flex items-center justify-between text-lg font-semibold text-warm-wood">
                <span>Prezzo a persona</span>
                <span>{formatCurrency(totalPerPerson)}</span>
              </div>
              <div className="h-px bg-warm-beige/60" />
              <div className="flex items-center justify-between text-2xl font-bold text-warm-wood">
                <span>Prezzo totale rinfresco</span>
                <span>{formatCurrency(totalPerPerson * Math.max(numGuests, 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
