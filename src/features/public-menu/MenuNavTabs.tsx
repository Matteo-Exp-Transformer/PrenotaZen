import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MenuCategoryRecord } from '@/features/booking/hooks/useMenuCategories'
import type { MenuQrcodeCategoryOverride } from '@/types/menu'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'

const TAB_BAR_SCROLL_STEP_PX = 220

type MenuNavTabItem = {
  key: string
  label: string
  href: string
  iconKey?: string | null
  categoryKey: string
}

export function MenuNavTabs({
  categories,
  slug,
  shortCode,
  accentColor,
  tabBarStickyRgb,
  overridesByKey,
  activeCategoryKey,
}: {
  categories: MenuCategoryRecord[]
  slug: string
  shortCode: string
  accentColor: string
  tabBarStickyRgb: string
  overridesByKey: Record<string, MenuQrcodeCategoryOverride>
  activeCategoryKey?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const items: MenuNavTabItem[] = categories.map((c) => {
    const ov = overridesByKey[c.key]
    return {
      key: c.key,
      label: ov?.title?.trim() || c.label,
      href: `/menu/${slug}/qr/${shortCode}/c/${c.key}`,
      iconKey: ov?.icon,
      categoryKey: c.key,
    }
  })

  const updateScrollHints = () => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 4)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4)
  }

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
  }, [items.length])

  if (items.length === 0) return null

  const barBg = `rgba(${tabBarStickyRgb}, 0.97)`
  const pillBg = `rgba(${tabBarStickyRgb}, 0.92)`

  const scrollTabs = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Categorie del menù"
      className="fixed inset-x-0 bottom-0 z-20"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        backgroundColor: barBg,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="relative mx-auto w-full max-w-[1024px]">
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scorri categorie indietro"
            className="absolute left-0 top-0 bottom-0 z-20 hidden min-[700px]:flex w-10 items-center justify-center rounded-r-md shadow-sm"
            style={{ backgroundColor: barBg, color: accentColor }}
            onClick={() => scrollTabs(-TAB_BAR_SCROLL_STEP_PX)}
          >
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide py-3 px-4 min-[700px]:px-11"
        >
          {items.map((item) => {
            const isActive = item.key === activeCategoryKey
            return (
              <Link
                key={item.key}
                to={item.href}
                aria-current={isActive ? 'page' : undefined}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium leading-none transition-colors"
                style={
                  isActive
                    ? {
                        borderColor: accentColor,
                        color: '#ffffff',
                        backgroundColor: accentColor,
                      }
                    : {
                        borderColor: accentColor,
                        color: accentColor,
                        backgroundColor: pillBg,
                      }
                }
              >
                <MenuQrCategoryIconGlyph
                  iconKey={item.iconKey}
                  categoryKey={item.categoryKey}
                  size={16}
                  className="shrink-0"
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </div>
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scorri categorie avanti"
            className="absolute right-0 top-0 bottom-0 z-20 hidden min-[700px]:flex w-10 items-center justify-center rounded-l-md shadow-sm"
            style={{ backgroundColor: barBg, color: accentColor }}
            onClick={() => scrollTabs(TAB_BAR_SCROLL_STEP_PX)}
          >
            <ChevronRight size={22} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </nav>
  )
}
