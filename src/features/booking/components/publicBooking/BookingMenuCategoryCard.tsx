import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Utensils } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SelectedMenuItem } from '@/types/menu'
import {
  BOOKING_MENU_CATEGORY_EXPANDED_PORTAL_CLASS,
  BOOKING_MENU_CATEGORY_PANEL_SCROLL_CLASS,
} from '../../constants/bookingMenuComposePanelLayout'
import {
  type ComposeMenuItem,
  countSelectedInCategory,
  selectionStatusLabel,
} from '../../utils/menuComposeVisibility'
import { BOOKING_MENU_COMPOSE_COLLAPSE_EVENT } from '../../utils/bookingPublicFormAttention'
import {
  BOOKING_MENU_COMPOSE_TEXT_LIMITS,
  clampBookingText,
} from '../../constants/bookingPrenotaTextLimits'

const COMPOSE_L = BOOKING_MENU_COMPOSE_TEXT_LIMITS

export interface BookingMenuCategoryCardProps {
  categoryKey: string
  categoryLabel: string
  imageUrl?: string | null
  items: ComposeMenuItem[]
  selectedItems: SelectedMenuItem[]
  locked: boolean
  formatPrice: (item: ComposeMenuItem) => string
  onToggleItem: (item: ComposeMenuItem) => void
  /** `scroll` = strip orizzontale; `grid` = griglia desktop; `stack` = colonna mobile con collapse. */
  layout?: 'grid' | 'scroll' | 'stack'
  resetKey?: string
  /** Contenitore scroll orizzontale categorie (desktop): sync posizione overlay. */
  horizontalScrollRef?: React.RefObject<HTMLElement | null>
  /** Riduce padding e testo per griglie strette (es. 3 col su mobile). */
  compact?: boolean
  /** false = sottotab con prezzo fisso: nasconde € per ingrediente. Default true. */
  showIngredientPrices?: boolean
}

function ComposeMenuItemPanelContent({
  item,
  formatPrice,
  showPrice,
  locked,
  inputId,
  isSelected,
  onToggleItem,
}: {
  item: ComposeMenuItem
  formatPrice: (item: ComposeMenuItem) => string
  showPrice: boolean
  locked: boolean
  inputId: string
  isSelected: boolean
  onToggleItem: (item: ComposeMenuItem) => void
}) {
  const displayName = clampBookingText(item.name, COMPOSE_L.itemName)
  const displayDescription = item.description?.trim()
    ? clampBookingText(item.description, COMPOSE_L.itemDescription)
    : undefined
  const hasDesc = Boolean(displayDescription)
  const showActionRow = !locked || showPrice
  const itemImageSrc = item.image_url?.trim() || undefined

  const imageBlock = itemImageSrc ? (
    <div className="aspect-4/3 overflow-hidden rounded-lg border border-black/10 bg-warm-beige/20 sm:aspect-3/2">
      <img src={itemImageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
    </div>
  ) : null

  const textBlock = (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <span className="w-full min-w-0 text-sm font-bold leading-snug text-warm-wood wrap-break-word">
        {displayName}
      </span>
      {hasDesc ? (
        <span className="w-full min-w-0 text-xs leading-snug text-warm-wood-dark/65 wrap-break-word">
          {displayDescription}
        </span>
      ) : null}
      {showActionRow ? (
        <div
          className={cn(
            'flex min-h-[44px] w-full items-center gap-2',
            showPrice || !locked ? 'justify-between' : 'justify-start',
          )}
        >
          {!locked ? (
            <input
              id={inputId}
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleItem(item)}
              className="h-4 w-4 shrink-0 accent-warm-orange"
            />
          ) : null}
          {showPrice ? (
            <span
              className={cn(
                'shrink-0 text-sm font-bold tabular-nums text-warm-wood',
                locked && 'ml-auto',
              )}
            >
              {formatPrice(item)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      {imageBlock}
      {textBlock}
    </div>
  )
}

export const BookingMenuCategoryCard: React.FC<BookingMenuCategoryCardProps> = ({
  categoryKey,
  categoryLabel,
  imageUrl,
  items,
  selectedItems,
  locked,
  formatPrice,
  onToggleItem,
  layout = 'grid',
  resetKey,
  horizontalScrollRef,
  compact = false,
  showIngredientPrices = true,
}) => {
  const selectedCount = countSelectedInCategory(selectedItems, categoryKey)
  const { hint, status } = selectionStatusLabel(categoryKey, selectedCount)

  const heroSrc = imageUrl?.trim() || undefined
  const [expanded, setExpanded] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const portalArticleRef = useRef<HTMLElement | null>(null)

  const collapseExpanded = useCallback(() => {
    setExpanded(false)
  }, [])

  useLayoutEffect(() => {
    collapseExpanded()
  }, [resetKey, collapseExpanded])

  useEffect(() => {
    const onForceCollapse = () => collapseExpanded()
    window.addEventListener(BOOKING_MENU_COMPOSE_COLLAPSE_EVENT, onForceCollapse)
    return () => window.removeEventListener(BOOKING_MENU_COMPOSE_COLLAPSE_EVENT, onForceCollapse)
  }, [collapseExpanded])

  const applyOverlayPosition = useCallback(() => {
    const shell = shellRef.current
    const portal = portalArticleRef.current
    if (!shell || !portal) return
    const { top, left, width } = shell.getBoundingClientRect()
    portal.style.top = `${top}px`
    portal.style.left = `${left}px`
    portal.style.width = `${width}px`
  }, [])

  useLayoutEffect(() => {
    if (!expanded) return

    applyOverlayPosition()

    let rafId = 0
    const tick = () => {
      applyOverlayPosition()
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    const onScrollOrResize = () => applyOverlayPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)

    const ro = new ResizeObserver(onScrollOrResize)
    if (shellRef.current) ro.observe(shellRef.current)

    const horizontalScrollEl = horizontalScrollRef?.current ?? null
    horizontalScrollEl?.addEventListener('scroll', onScrollOrResize, { passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      ro.disconnect()
      horizontalScrollEl?.removeEventListener('scroll', onScrollOrResize)
    }
  }, [expanded, applyOverlayPosition, horizontalScrollRef])

  const shellClass = cn(
    'relative',
    layout === 'scroll'
      // ≥1400px: scatto coordinato con le card sottotab scrollabili (280→320px) per bilanciare
      // la pagina su laptop/desktop; sotto resta cappata a 280px.
      ? 'w-[min(280px,calc(100vw-4rem))] min-w-[240px] max-w-[280px] shrink-0 snap-center sm:min-w-[260px] min-[1400px]:w-[320px] min-[1400px]:min-w-[320px] min-[1400px]:max-w-[320px]'
      : layout === 'stack'
        ? 'w-full min-w-0'
        : 'w-full min-w-0 self-start',
  )

  const articleSurfaceClass = cn(
    '@container flex flex-col border-2 border-black/15 bg-white/90 backdrop-blur-[1px] shadow-md',
    layout === 'scroll' ? 'rounded-2xl' : layout === 'stack' ? 'rounded-xl' : 'w-full rounded-2xl',
  )

  const itemsList = (
    <ul className="flex flex-col px-0 pb-2">
      {items.map((item, index) => {
        const isSelected = selectedItems.some((s) => s.id === item.id)
        const inputId = `compose-${categoryKey}-${item.id}`
        const divider =
          index > 0 ? (
            <li key={`${item.id}-divider`} aria-hidden className="list-none px-3">
              <div className="h-px bg-black/10" />
            </li>
          ) : null

        if (locked) {
          return (
            <React.Fragment key={item.id}>
              {divider}
              <li className="min-w-0">
              <div className="min-w-0 rounded-xl px-2 py-2">
                <ComposeMenuItemPanelContent
                  item={item}
                  formatPrice={formatPrice}
                  showPrice={showIngredientPrices}
                  locked
                  inputId={inputId}
                  isSelected={false}
                  onToggleItem={onToggleItem}
                />
              </div>
              </li>
            </React.Fragment>
          )
        }

        return (
          <React.Fragment key={item.id}>
            {divider}
            <li className="min-w-0">
            <label
              htmlFor={inputId}
              className={cn(
                'flex cursor-pointer flex-col rounded-xl px-2 py-2 transition-colors',
                isSelected && 'bg-warm-orange/10',
                !isSelected && 'hover:bg-warm-beige/50',
              )}
            >
              <ComposeMenuItemPanelContent
                item={item}
                formatPrice={formatPrice}
                showPrice={showIngredientPrices}
                locked={false}
                inputId={inputId}
                isSelected={isSelected}
                onToggleItem={onToggleItem}
              />
            </label>
            </li>
          </React.Fragment>
        )
      })}
    </ul>
  )

  const headerId = `booking-menu-cat-header-${categoryKey}`
  const panelId = `booking-menu-cat-panel-${categoryKey}`
  const lockedOpenSummary = selectedCount > 0 ? 'Incluso nel menù' : 'Menù preselezionato'
  const lockedClosedTeaser = 'Scopri cosa è incluso'
  const closedImageClass = layout === 'stack' ? 'aspect-video sm:aspect-4/3' : 'aspect-4/3'
  const displayCategoryLabel = clampBookingText(categoryLabel, COMPOSE_L.categoryLabel)

  const expandedPanel = (
    <>
      <button
        type="button"
        id={headerId}
        aria-expanded={true}
        aria-controls={panelId}
        className="flex w-full shrink-0 items-center gap-3 border-b border-black/10 px-4 py-3 text-left"
        onClick={() => setExpanded(false)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold uppercase tracking-wide text-warm-wood sm:text-base">
            {displayCategoryLabel}
          </h3>
          {!locked ? (
            <div className="mt-1">
              <p className="text-xs font-semibold text-warm-wood-dark/70">{hint}</p>
              <p className="text-xs font-bold text-warm-orange">{status}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm font-semibold text-warm-wood-dark/70">{lockedOpenSummary}</p>
          )}
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 rotate-180 text-warm-wood" aria-hidden />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={cn('min-h-0', BOOKING_MENU_CATEGORY_PANEL_SCROLL_CLASS)}
      >
        {itemsList}
      </div>
    </>
  )

  const expandedPortal =
    expanded
      ? createPortal(
          <article
            ref={portalArticleRef}
            className={cn(articleSurfaceClass, BOOKING_MENU_CATEGORY_EXPANDED_PORTAL_CLASS)}
            data-testid={`booking-menu-category-card-${categoryKey}`}
            data-booking-menu-expanded="true"
          >
            {expandedPanel}
          </article>,
          document.body,
        )
      : null

  if (!expanded) {
    return (
      <div ref={shellRef} className={shellClass}>
        <article className={articleSurfaceClass} data-testid={`booking-menu-category-card-${categoryKey}`}>
          <button
            type="button"
            id={headerId}
            aria-expanded={false}
            aria-controls={panelId}
            className="group relative block w-full overflow-hidden rounded-[inherit] text-left"
            onClick={() => setExpanded(true)}
          >
            <div className={cn('relative w-full overflow-hidden bg-warm-beige/40', closedImageClass)}>
              {heroSrc ? (
                <img
                  src={heroSrc}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-warm-wood/40">
                  <Utensils className="h-10 w-10" strokeWidth={1.25} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className={cn('absolute inset-x-0 bottom-0 flex items-end gap-1 text-white', compact ? 'p-1.5' : 'p-4 gap-3')}>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h3 className={cn('font-bold uppercase leading-tight', compact ? 'text-[10px] tracking-tight line-clamp-2' : 'text-base tracking-wide sm:text-lg')}>
                    {displayCategoryLabel}
                  </h3>
                  {!compact && (
                    <p className={cn('mt-1 font-bold text-white/85', locked ? 'text-sm' : 'text-xs')}>
                      {!locked ? status : lockedClosedTeaser}
                    </p>
                  )}
                </div>
                <ChevronDown className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-5 w-5')} aria-hidden />
              </div>
            </div>
          </button>
        </article>
      </div>
    )
  }

  return (
    <>
      <div ref={shellRef} className={shellClass}>
        <div
          className={cn('pointer-events-none invisible w-full', closedImageClass, layout === 'scroll' && 'rounded-2xl')}
          aria-hidden
        />
      </div>
      {expandedPortal}
    </>
  )
}
