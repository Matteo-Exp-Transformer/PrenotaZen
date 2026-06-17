import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MenuItem } from '@/types/menu'
import type { SelectedMenuItem } from '@/types/menu'
import type { CustomStaffPreset, PresetMenuType } from '../../constants/presetMenus'
import {
  filterItemsForComposeCategory,
  resolveLockedPresetAllowedItemIds,
  type ComposeMenuItem,
} from '../../utils/menuComposeVisibility'
import { BookingMenuCategoryCard } from './BookingMenuCategoryCard'
import { dispatchBookingMenuComposeCollapse } from '../../utils/bookingPublicFormAttention'

const COMPOSE_SCROLL_STEP_PX = 320

export interface BookingMenuComposeGridProps {
  categoryEntries: readonly (readonly [string, string])[]
  categoryImageByKey: Record<string, string | null | undefined>
  itemsByCategory: Record<string, ComposeMenuItem[]>
  selectedItems: SelectedMenuItem[]
  locked: boolean
  presetMenu?: PresetMenuType
  menuItems: MenuItem[]
  customStaffPresets: CustomStaffPreset[]
  formatPrice: (item: ComposeMenuItem) => string
  onToggleItem: (item: ComposeMenuItem) => void
  /** Incrementa per richiudere tutte le card ingredienti (es. submit con errori). */
  composeCollapseKey?: string
  /** false = sottotab con prezzo fisso: nasconde € per ingrediente. Default true. */
  showIngredientPrices?: boolean
}

type VisibleCategory = { key: string; label: string; items: ComposeMenuItem[] }

function ComposeCategoryCards({
  categories,
  layout,
  compact,
  categoryImageByKey,
  selectedItems,
  locked,
  formatPrice,
  onToggleItem,
  resetKey,
  horizontalScrollRef,
  showIngredientPrices,
}: {
  categories: VisibleCategory[]
  layout: 'grid' | 'scroll' | 'stack'
  compact?: boolean
  categoryImageByKey: Record<string, string | null | undefined>
  selectedItems: SelectedMenuItem[]
  locked: boolean
  formatPrice: (item: ComposeMenuItem) => string
  onToggleItem: (item: ComposeMenuItem) => void
  resetKey?: string
  horizontalScrollRef?: React.RefObject<HTMLElement | null>
  showIngredientPrices?: boolean
}) {
  return (
    <>
      {categories.map(({ key, label, items }) => (
        <BookingMenuCategoryCard
          key={key}
          categoryKey={key}
          categoryLabel={label}
          imageUrl={categoryImageByKey[key]}
          items={items}
          selectedItems={selectedItems}
          locked={locked}
          formatPrice={formatPrice}
          onToggleItem={onToggleItem}
          layout={layout}
          compact={compact}
          resetKey={resetKey}
          horizontalScrollRef={horizontalScrollRef}
          showIngredientPrices={showIngredientPrices}
        />
      ))}
    </>
  )
}

function ComposeScrollRow({
  categories,
  className,
  categoryImageByKey,
  selectedItems,
  locked,
  formatPrice,
  onToggleItem,
  resetKey,
  showIngredientPrices,
}: {
  categories: VisibleCategory[]
  className?: string
  categoryImageByKey: Record<string, string | null | undefined>
  selectedItems: SelectedMenuItem[]
  locked: boolean
  formatPrice: (item: ComposeMenuItem) => string
  onToggleItem: (item: ComposeMenuItem) => void
  resetKey?: string
  showIngredientPrices?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollHints()
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    const ro = new ResizeObserver(updateScrollHints)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollHints)
      ro.disconnect()
    }
  }, [categories.length, updateScrollHints])

  const scrollBy = (delta: number) => {
    dispatchBookingMenuComposeCollapse()
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative w-full min-w-0', className)} data-testid="booking-menu-compose-scroll">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scorri categorie menù indietro"
          className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warm-wood/15 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange min-[700px]:flex"
          onClick={() => scrollBy(-COMPOSE_SCROLL_STEP_PX)}
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex w-full min-w-0 flex-nowrap items-start gap-4 overflow-x-auto scroll-px-2 scrollbar-hide snap-x snap-mandatory py-1"
      >
        <ComposeCategoryCards
          categories={categories}
          layout="scroll"
          categoryImageByKey={categoryImageByKey}
          selectedItems={selectedItems}
          locked={locked}
          formatPrice={formatPrice}
          onToggleItem={onToggleItem}
          resetKey={resetKey}
          horizontalScrollRef={scrollRef}
          showIngredientPrices={showIngredientPrices}
        />
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scorri categorie menù avanti"
          className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warm-wood/15 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange min-[700px]:flex"
          onClick={() => scrollBy(COMPOSE_SCROLL_STEP_PX)}
        >
          <ChevronRight size={22} strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}

export const BookingMenuComposeGrid: React.FC<BookingMenuComposeGridProps> = ({
  categoryEntries,
  categoryImageByKey,
  itemsByCategory,
  selectedItems,
  locked,
  presetMenu,
  menuItems,
  customStaffPresets,
  formatPrice,
  onToggleItem,
  composeCollapseKey,
  showIngredientPrices = true,
}) => {
  const allowedItemIds = useMemo(
    () =>
      locked
        ? resolveLockedPresetAllowedItemIds(presetMenu, menuItems, customStaffPresets)
        : null,
    [locked, presetMenu, menuItems, customStaffPresets],
  )

  const visibleCategories = useMemo(() => {
    return categoryEntries
      .map(([key, label]) => {
        const items = filterItemsForComposeCategory(itemsByCategory[key] ?? [], allowedItemIds)
        return items.length > 0 ? { key, label, items } : null
      })
      .filter((row): row is VisibleCategory => row != null)
  }, [categoryEntries, itemsByCategory, allowedItemIds])

  const cardProps = {
    categoryImageByKey,
    selectedItems,
    locked,
    formatPrice,
    onToggleItem,
    resetKey: `${presetMenu ?? 'no-preset'}:${composeCollapseKey ?? '0'}`,
    showIngredientPrices,
  }

  if (visibleCategories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-warm-wood-dark/80">
        Nessun ingrediente disponibile per questa tipologia di prenotazione.
      </p>
    )
  }

  return (
    <div className="w-full min-w-0" data-testid="booking-menu-compose-grid">
      {/* ≤699px: griglia 2 colonne compatte — stesso layout per menù libero e preselezionato */}
      <div className="grid grid-cols-2 items-start gap-2 min-[700px]:hidden">
        <ComposeCategoryCards categories={visibleCategories} layout="grid" compact {...cardProps} />
      </div>

      {/* ≥700px: scroll orizzontale a larghezza fissa */}
      <div className="hidden min-[700px]:block">
        <ComposeScrollRow categories={visibleCategories} {...cardProps} />
      </div>
    </div>
  )
}
