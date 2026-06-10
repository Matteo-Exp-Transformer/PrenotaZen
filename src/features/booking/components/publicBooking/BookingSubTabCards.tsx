import React, { useCallback, useEffect, useState } from 'react'
import { CaretLeftIcon } from '@phosphor-icons/react/dist/csr/CaretLeft'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { cn } from '@/lib/utils'
import type { SubTab } from '@/features/booking/constants/bookingPublicFormConfig'
import {
  BOOKING_PUBLIC_WIDE_CARDS_WIDTH,
  bookingPublicSubTabScrollCardWidthClass,
} from '@/features/booking/constants/bookingPublicFieldStyles'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'
import { useBookingPublicScrollRowAlign } from '@/features/booking/hooks/useBookingPublicScrollRowAlign'

const SUB_TAB_SCROLL_STEP_PX = 240

interface BookingSubTabCardsProps {
  subTabs: SubTab[]
  activeSubTabId: string | null
  onChange: (subTab: SubTab | null) => void
}

/** Es. `18,00€` (senza spazio prima del simbolo €). */
function formatPriceAmountLabel(price?: number): string | null {
  if (price == null || price <= 0) return null
  const amount = new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
  return `${amount}€`
}

export const BookingSubTabCards: React.FC<BookingSubTabCardsProps> = ({
  subTabs,
  activeSubTabId,
  onChange,
}) => {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const { outerRef, innerRef, rowOverflows, innerRowAlignClass } =
    useBookingPublicScrollRowAlign(subTabs.length)

  const isScrollable = subTabs.length > 3

  useEffect(() => {
    const el = outerRef.current
    if (!el || !isScrollable) return
    const syncViewport = () => {
      el.style.setProperty('--booking-sub-tab-viewport-px', `${el.clientWidth}px`)
    }
    syncViewport()
    const ro = new ResizeObserver(syncViewport)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isScrollable, subTabs.length, outerRef])

  const updateScrollHints = useCallback(() => {
    const el = outerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }, [outerRef])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    updateScrollHints()
    el.addEventListener('scroll', updateScrollHints, { passive: true })
    const ro = new ResizeObserver(updateScrollHints)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollHints)
      ro.disconnect()
    }
  }, [subTabs.length, updateScrollHints, outerRef])

  const scrollBy = (delta: number) => {
    outerRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  if (subTabs.length === 0) return null
  // ≤3 card: flex-1 su ogni card → si espandono a riempire la riga, centrate (altezza fissa).
  // ≥4 card: comportamento responsive validato nel report agente:
  // 3 slot proporzionali su mobile, lato fisso da 782px e scatto a 1400px.
  const cardFlexClass = isScrollable
    ? bookingPublicSubTabScrollCardWidthClass()
    : 'flex-1 min-w-0'
  // Ramo scrollabile: mobile compatto (titolo, icona, prezzo), poi più basso da sm.
  const cardHeightClass = isScrollable
    ? 'aspect-[1/1.08] sm:aspect-[4/3.35]'
    : 'min-h-[154px] sm:min-h-[212px] lg:min-h-[248px]'

  return (
    <div
      className={cn('relative min-w-0', BOOKING_PUBLIC_WIDE_CARDS_WIDTH)}
      data-testid="booking-sub-tab-cards"
    >
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scorri opzioni menù indietro"
          className="absolute left-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warm-wood/15 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange md:flex"
          onClick={() => scrollBy(-SUB_TAB_SCROLL_STEP_PX)}
        >
          <CaretLeftIcon size={20} weight="bold" />
        </button>
      )}
      <div
        ref={outerRef}
        className="w-full min-w-0 overflow-x-auto overscroll-x-contain scrollbar-hide py-1 touch-pan-x [-webkit-overflow-scrolling:touch]"
      >
        <div
          ref={isScrollable ? innerRef : undefined}
          className={cn(
            'flex flex-nowrap gap-1.5 sm:gap-2 snap-x snap-mandatory scroll-px-2',
            isScrollable ? cn('w-max', innerRowAlignClass) : 'w-full justify-center',
          )}
        >
        {subTabs.map((tab) => {
          const isActive = activeSubTabId === tab.id
          const isCardDisplay = tab.display !== 'carousel'
          const coursesLabel =
            isCardDisplay && tab.courses_label?.trim() ? tab.courses_label.trim() : null
          const priceAmount = isCardDisplay
            ? formatPriceAmountLabel(tab.price_per_person)
            : null
          const showCardFooter = isCardDisplay && !!(coursesLabel || priceAmount)
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`booking-sub-tab-card-${tab.id}`}
              onClick={() => onChange(isActive ? null : tab)}
              className={cn(
                'flex flex-col rounded-xl border px-2.5 py-2.5 text-left transition-all sm:rounded-2xl sm:px-4 sm:py-4',
                isScrollable ? (rowOverflows ? 'snap-start' : 'snap-center') : 'snap-center',
                cardFlexClass,
                cardHeightClass,
                'bg-white/95 backdrop-blur-[1px] shadow-[0_12px_34px_rgba(49,22,12,0.10)]',
                isActive
                  ? 'border-warm-orange ring-2 ring-warm-orange/25'
                  : 'border-black/5 hover:border-warm-orange/45',
              )}
            >
              <div
                className={cn(
                  'flex min-h-0 w-full flex-1 flex-col',
                  isCardDisplay && !tab.icon && 'justify-center',
                )}
              >
                <p
                  className={cn(
                    'text-center text-sm font-bold leading-tight line-clamp-2 sm:text-base lg:text-base xl:text-lg',
                    isActive ? 'text-warm-orange' : 'text-warm-wood',
                  )}
                >
                  {tab.label}
                </p>
                {isCardDisplay && tab.icon ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center py-2 sm:py-3">
                    <span
                      className={cn(
                        'flex shrink-0 items-center justify-center',
                        // Mobile leggermente più grande ora che la card è più larga (icona non compressa).
                        'h-12 w-12 sm:h-14 sm:w-14 min-[782px]:h-16 min-[782px]:w-16',
                      )}
                      aria-hidden
                    >
                      <MenuQrCategoryIconGlyph
                        iconKey={tab.icon}
                        className="h-10 w-10 text-warm-wood-dark sm:h-11 sm:w-11 min-[782px]:h-12 min-[782px]:w-12"
                      />
                    </span>
                  </div>
                ) : null}
              </div>
              {showCardFooter ? (
                <>
                  <div
                    className={cn(
                      'mt-auto h-px w-full shrink-0',
                      isActive ? 'bg-warm-orange/35' : 'bg-warm-wood/15',
                    )}
                    aria-hidden
                  />
                  <div
                    className="mt-1.5 flex shrink-0 items-end justify-between gap-1 sm:mt-2 sm:gap-1.5"
                    data-testid={`booking-sub-tab-card-footer-${tab.id}`}
                  >
                    {coursesLabel ? (
                      <p
                        className="min-w-0 flex-1 text-left text-[11px] font-normal leading-tight line-clamp-1 text-warm-wood-dark sm:text-xs"
                        data-testid={`booking-sub-tab-card-courses-${tab.id}`}
                      >
                        {coursesLabel}
                      </p>
                    ) : (
                      <span className="min-w-0 flex-1" aria-hidden />
                    )}
                    {priceAmount ? (
                      <p className="shrink-0 text-sm font-normal tracking-normal text-warm-orange tabular-nums sm:text-lg min-[782px]:text-xl">
                        {priceAmount}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
            </button>
          )
        })}
        </div>
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scorri opzioni menù avanti"
          className="absolute right-2 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-warm-wood/15 bg-white/90 text-warm-wood shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-warm-orange md:flex"
          onClick={() => scrollBy(SUB_TAB_SCROLL_STEP_PX)}
        >
          <CaretRightIcon size={20} weight="bold" />
        </button>
      )}
    </div>
  )
}
