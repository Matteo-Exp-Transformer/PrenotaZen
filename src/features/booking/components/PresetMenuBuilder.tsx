import React, { useCallback, useMemo } from 'react'
import { CollapsibleCard } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useMenuItems } from '../hooks/useMenuItems'
import { useMenuCategories } from '../hooks/useMenuCategories'
import type { SelectedMenuItem } from '@/types/menu'
import {
  filterMenuCategoriesForPublic,
  filterMenuItemsForPublic,
} from '../constants/menuMagazzinoLimits'
import { groupMenuItemsByCategory } from '../utils/menuCatalogGrouping'
import {
  MENU_CATEGORY_COLLAPSIBLE_CLASS,
  MENU_CATEGORY_COLLAPSIBLE_HEADER_CLASS,
  MENU_CATEGORY_LABEL_TITLE_CLASS,
  MENU_CATEGORY_LABEL_TITLE_STYLE,
  MENU_INGREDIENT_DESC_CLASS,
  MENU_INGREDIENT_NAME_CLASS,
  MENU_INGREDIENT_OVERVIEW_GRID_CLASS,
  MENU_INGREDIENT_PRICE_CLASS,
} from './menuPricesCatalogLayout'

type NormalizedMenuItem = {
  id: string
  name: string
  price: number
  category: string
  description?: string
  sort_order: number
}

export interface PresetMenuBuilderProps {
  /** Righe selezionate come in Booking / MenuSelection */
  selectedItems: SelectedMenuItem[]
  onSelectionChange: (items: SelectedMenuItem[]) => void
}

/** Selezione ingredienti con la stessa UX visiva della panoramica «Modifica Ingredienti». */
export const PresetMenuBuilder: React.FC<PresetMenuBuilderProps> = ({
  selectedItems,
  onSelectionChange,
}) => {
  const { data: menuItems = [], isLoading, error } = useMenuItems()
  const { data: dbCategories = [] } = useMenuCategories()

  const publicMenuItems = useMemo(
    () => filterMenuItemsForPublic(menuItems, dbCategories),
    [menuItems, dbCategories],
  )

  const normalizedMenuItems = useMemo<NormalizedMenuItem[]>(() => {
    return publicMenuItems.map<NormalizedMenuItem>((item) => {
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        description: item.description ?? undefined,
        sort_order: item.sort_order ?? 0,
      }
    })
  }, [publicMenuItems])

  const categoryEntries = useMemo(
    () =>
      filterMenuCategoriesForPublic(dbCategories).map(
        (category) => [category.key, category.label] as const,
      ),
    [dbCategories],
  )

  const itemsByCategory = useMemo(
    () =>
      groupMenuItemsByCategory(
        normalizedMenuItems,
        categoryEntries.map(([key]) => key),
      ),
    [categoryEntries, normalizedMenuItems],
  )

  const emitChange = useCallback(
    (items: SelectedMenuItem[]) => {
      const itemsWithTotals = items.map((selected) => ({
        ...selected,
        totalPrice: selected.totalPrice ?? selected.price,
      }))
      onSelectionChange(itemsWithTotals)
    },
    [onSelectionChange],
  )

  const handleItemToggle = (item: NormalizedMenuItem) => {
    const isSelected = selectedItems.some((selected) => selected.id === item.id)

    if (isSelected) {
      emitChange(selectedItems.filter((selected) => selected.id !== item.id))
      return
    }

    const newItem: SelectedMenuItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
    }

    emitChange([
      ...selectedItems.filter((selected) => selected.id !== item.id),
      newItem,
    ])
  }

  const formatPrice = (item: NormalizedMenuItem) =>
    `€${item.price.toFixed(2)}`

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-600">Caricamento menu...</div>
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-red-600">Errore nel caricamento del menu.</p>
  }

  if (categoryEntries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-600">
        Nessuna categoria configurata. Aggiungine una dalla gestione categorie.
      </p>
    )
  }

  return (
    <div className={cn(MENU_INGREDIENT_OVERVIEW_GRID_CLASS, 'mt-6')}>
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
                <p className="px-2 py-4 text-center text-xs text-(--color-text-muted) sm:text-sm">
                  Nessun ingrediente in questa categoria.
                </p>
              ) : (
                categoryItems.map((item) => {
                  const isSelected = selectedItems.some((selected) => selected.id === item.id)
                  const hasDesc = Boolean(item.description?.trim())

                  return (
                    <div key={item.id} className="flex w-full min-w-0 flex-col items-stretch gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleItemToggle(item)}
                        aria-pressed={isSelected}
                        className={cn(
                          'menu-prices-item-row w-full min-w-0 flex-col items-stretch gap-1 py-2.5 px-3',
                          !hasDesc && 'min-h-0 items-center',
                          isSelected && 'menu-prices-item-row--selected',
                        )}
                        style={{
                          minHeight: hasDesc ? undefined : '3rem',
                        }}
                      >
                        <div className="flex w-full min-w-0 items-center justify-between gap-2">
                          <p className={cn(MENU_INGREDIENT_NAME_CLASS, 'menu-prices-item-text break-words')}>
                            {item.name}
                          </p>
                          <span className={MENU_INGREDIENT_PRICE_CLASS}>{formatPrice(item)}</span>
                        </div>
                        {hasDesc ? (
                          <p className={cn(MENU_INGREDIENT_DESC_CLASS, 'break-words')}>{item.description}</p>
                        ) : null}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </CollapsibleCard>
        )
      })}
    </div>
  )
}
