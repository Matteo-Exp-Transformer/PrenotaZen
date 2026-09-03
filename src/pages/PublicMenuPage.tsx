import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTenantContext } from '@/contexts/TenantContext'
import { usePublicMenuQr, usePublicDefaultMenuQr } from '@/features/booking/hooks/useMenuQrCodes'
import { usePublicMenuQrcodeCategories } from '@/features/booking/hooks/useMenuQrcodeCategories'
import { categoryCardNoPhotoBackgroundStyle } from '@/features/public-menu/categoryHeaderBackgroundStyle'
import { getMenuTheme, type MenuTheme } from '@/features/public-menu/menuThemes'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'
import { usePublicMenuCategories } from '@/features/public-menu/usePublicMenuCategories'
import type { MenuCategoryRecord } from '@/features/booking/hooks/useMenuCategories'
import type { MenuQrCode, CarouselItem } from '@/types/menu'
import { usePublicMenuViewport } from '@/hooks/usePublicMenuViewport'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import { PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS } from '@/features/public-menu/publicMenuLayout'

function useTenantBySlug(slug: string | undefined) {
  const { setTenantFromSlug, tenantId, tenantSlug, organizationName, isLoading } = useTenantContext()

  useEffect(() => {
    if (slug) setTenantFromSlug(slug)
  }, [slug, setTenantFromSlug])

  /** Evita lookup QR con tenantId “stale” (es. sessione admin) prima che lo slug URL sia risolto. */
  const tenantReady = !!slug && !isLoading && !!tenantId && tenantSlug === slug

  return { tenantId, organizationName, isLoading, tenantReady }
}

/**
 * Homepage menu QR: un solo PNG (`bodyImage`) per tutto lo sfondo.
 * `headerImage` è solo su PublicMenuCategoryPage (barra categoria).
 * `repeat-y` + `100% auto` sul wrapper scrollabile — niente layer fixed separato.
 */
function useMenuPageBackgroundStyle(theme: MenuTheme): CSSProperties {
  const { bodyImage, bodyFallbackBg } = theme

  if (bodyImage) {
    return {
      backgroundImage: `url(${bodyImage})`,
      backgroundSize: '100% auto',
      backgroundPosition: 'center top',
      backgroundRepeat: 'repeat-y',
      backgroundColor: bodyFallbackBg,
    }
  }

  return { backgroundColor: bodyFallbackBg }
}

// ── Carosello ────────────────────────────────────────────────────────────────

function MenuCarousel({
  items,
  accentColor,
}: {
  items: CarouselItem[]
  accentColor: string
}) {
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.offsetWidth)
    setActiveIdx(idx)
  }

  const goToSlide = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    el.scrollTo({ left: clamped * el.offsetWidth, behavior: 'smooth' })
    setActiveIdx(clamped)
  }

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    isDragging.current = true
    startX.current = e.pageX - el.offsetLeft
    scrollLeft.current = el.scrollLeft
    el.style.cursor = 'grabbing'
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!isDragging.current || !el) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - startX.current) * 1.2
    el.scrollLeft = scrollLeft.current - walk
  }

  const onMouseUp = () => {
    const el = scrollRef.current
    isDragging.current = false
    if (el) el.style.cursor = 'grab'
  }

  const hasImages = items.length > 0

  return (
    <div>
      {hasImages ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl scrollbar-hide gap-0"
          style={{ scrollSnapType: 'x mandatory', cursor: 'grab', userSelect: 'none' }}
        >
          {items.map((item, i) => {
            const title = item.title ?? item.label
            const eyebrow = item.eyebrow?.trim()
            const description = item.description?.trim()
            // Testi slide facoltativi (03-09-26): senza nessun testo il gradiente scuro non ha
            // niente da rendere leggibile, quindi si mostra la foto pulita.
            const hasOverlayText = !!(eyebrow || title || description)
            return (
              <div
                key={i}
                className="relative h-52 w-full shrink-0 snap-start overflow-hidden rounded-2xl"
                style={{ scrollSnapAlign: 'start', minWidth: '100%' }}
              >
                <img
                  src={item.image_url}
                  alt={title ?? ''}
                  className="h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                />
                {/* Gradiente overlay 40% sinistro per testo — solo se c'è testo da leggere */}
                {hasOverlayText ? (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 50%)',
                    }}
                  />
                ) : null}
                {/* Testo su sinistra */}
                <div className="absolute inset-y-0 left-0 flex w-1/2 flex-col justify-end px-4 pb-4">
                  {eyebrow ? (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      {eyebrow}
                    </p>
                  ) : null}
                  {title && (
                    <p className="mt-0.5 text-base font-bold leading-snug text-white">{title}</p>
                  )}
                  {description && (
                    <p className="mt-0.5 text-xs leading-snug text-white/80">{description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Placeholder trasparente quando nessuna foto */
        <div className="h-28 w-full rounded-2xl" style={{ background: 'rgba(255,255,255,0.15)' }} />
      )}

      {/* Pallini tema — click per cambiare slide */}
      {items.length > 1 && (
        <div className="mt-2 flex justify-center gap-0.5" role="tablist" aria-label="Slide specialità">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`Slide ${i + 1} di ${items.length}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 cursor-pointer touch-manipulation"
              onClick={() => goToSlide(i)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span
                className="block rounded-full transition-all"
                style={{
                  width: i === activeIdx ? 16 : 8,
                  height: 8,
                  background: i === activeIdx ? accentColor : '#d6d3d1',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card categoria — stesso layout ovunque; descrizione nella fascia header 70%; altezza allineata se mix foto ──
// Griglia: 1 col <520 · 2 col ≥520

function CategoryCard({
  category,
  href,
  imageUrl,
  qrTitle,
  qrDescription,
  iconKey,
  theme,
  matchPhotoTileHeight,
}: {
  category: MenuCategoryRecord
  href: string
  imageUrl?: string
  qrTitle?: string | null
  qrDescription?: string | null
  iconKey?: string | null
  theme: MenuTheme
  /** Mix foto in griglia: card senza foto usa aspect 7/2 (<520) e 5/2 (≥520) come le tile con foto */
  matchPhotoTileHeight: boolean
}) {
  const displayTitle = qrTitle || category.label
  const displayDesc = qrDescription !== undefined ? qrDescription : category.description
  const descText = displayDesc?.trim() ?? ''
  const noPhotoBgStyle = categoryCardNoPhotoBackgroundStyle(theme.headerImage, theme.headerFallbackBg)

  const noPhotoRowClass = matchPhotoTileHeight
    ? 'flex aspect-[7/2] w-full overflow-hidden min-[520px]:aspect-[5/2]'
    : 'flex h-full min-h-[64px] w-full overflow-hidden min-[520px]:min-h-[72px]'

  return (
    <Link
      to={href}
      className="block h-full overflow-hidden rounded-xl bg-white shadow-sm active:bg-stone-50 transition-colors min-[1025px]:rounded-2xl"
    >
      <div className="relative h-full">
        {imageUrl ? (
          <div className="relative aspect-[7/2] w-full overflow-hidden bg-stone-100 min-[520px]:aspect-[5/2]">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-1 p-2 text-white min-[520px]:p-2.5">
              <h2 className="min-w-0 flex-1 text-xs font-bold uppercase leading-tight tracking-wide line-clamp-2 min-[520px]:text-sm">
                {displayTitle}
              </h2>
              <ChevronRight className="size-3.5 shrink-0 opacity-80 min-[520px]:size-4" aria-hidden />
            </div>
          </div>
        ) : (
          <div className={noPhotoRowClass}>
            <div className="flex w-[30%] shrink-0 items-center justify-center self-stretch bg-white">
              <MenuQrCategoryIconGlyph
                iconKey={iconKey}
                categoryKey={category.key}
                size={40}
                className="shrink-0"
                style={{ color: theme.accentColor }}
              />
            </div>
            <div
              className="flex w-[70%] min-w-0 flex-col items-center justify-center gap-0.5 self-stretch px-2.5 py-2 min-[520px]:gap-1 min-[520px]:px-3 min-[520px]:py-2.5"
              style={noPhotoBgStyle}
            >
              <div className="flex w-full min-w-0 items-center justify-center gap-1.5 min-[520px]:gap-2">
                <h2
                  className="min-w-0 text-center text-sm font-bold uppercase leading-tight tracking-wide line-clamp-2 min-[520px]:text-base"
                  style={{ color: theme.headerTextColor }}
                >
                  {displayTitle}
                </h2>
                <ChevronRight
                  className="size-4 shrink-0 opacity-85 min-[520px]:size-[18px]"
                  style={{ color: theme.headerTextColor }}
                  aria-hidden
                />
              </div>
              {descText ? (
                <p
                  className="min-w-0 max-w-full text-center text-[10px] font-normal normal-case leading-snug tracking-normal line-clamp-2 opacity-90 min-[520px]:text-xs"
                  style={{ color: theme.headerTextColor }}
                >
                  {descText}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Contenuto QR risolto ──────────────────────────────────────────────────────

function MenuContent({
  qr,
  slug,
  shortCode,
  organizationName,
}: {
  qr: MenuQrCode
  slug: string
  shortCode: string
  organizationName: string
}) {
  const { data: categories = [], isLoading: catLoading } = usePublicMenuCategories(
    qr.tenant_id,
    qr.category_filter,
  )
  const { data: qrCatOverrides = [] } = usePublicMenuQrcodeCategories(qr.id)

  const isLoading = catLoading

  const carouselItems = qr.carousel_items ?? []
  const categoryImages = qr.category_images ?? {}
  const theme = getMenuTheme(qr.theme_key)
  const pageBgStyle = useMenuPageBackgroundStyle(theme)

  const overridesByKey = Object.fromEntries(qrCatOverrides.map((o) => [o.category_key, o]))
  const hasAnyCategoryPhoto = categories.some((cat) => Boolean(categoryImages[cat.key]))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        Caricamento...
      </div>
    )
  }

  return (
    <div
      className="flex min-h-svh flex-col"
      style={pageBgStyle}
    >
      {/* FU-025: sfondo tema full viewport; contenuto congelato a larghezza tablet, centrato oltre 1024px */}
      <div className={PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS}>
      <header className="relative shrink-0 px-4 pt-8 pb-4">
        <div className="relative flex flex-col items-center gap-2 text-center">
          <h1
            className="text-2xl font-bold leading-tight tracking-wide"
            style={{ color: theme.headerTextColor }}
          >
            {organizationName}
          </h1>
          <div
            className="mt-1 h-0.5 w-16 rounded-full opacity-60"
            style={{ background: theme.headerTextColor }}
          />
        </div>
        <div className="relative mt-4">
          <MenuCarousel items={carouselItems} accentColor={theme.accentColor} />
        </div>
      </header>

      {categories.length > 0 ? (
        <main className="flex-1 px-4 pt-4 pb-8">
          <div className="grid grid-cols-1 items-stretch gap-1.5 min-[520px]:grid-cols-2 min-[520px]:gap-2 min-[1025px]:gap-3">
            {categories.map((cat) => {
              const ov = overridesByKey[cat.key]
              return (
                <CategoryCard
                  key={cat.key}
                  category={cat}
                  href={`/menu/${slug}/qr/${shortCode}/c/${cat.key}`}
                  imageUrl={categoryImages[cat.key]}
                  qrTitle={ov?.title}
                  qrDescription={ov?.description}
                  iconKey={ov?.icon}
                  theme={theme}
                  matchPhotoTileHeight={hasAnyCategoryPhoto}
                />
              )
            })}
          </div>
        </main>
      ) : (
        <main className="flex-1 px-4 py-6">
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
            Menu in preparazione
          </p>
        </main>
      )}
      </div>
    </div>
  )
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export function PublicMenuPage() {
  usePublicMenuViewport()
  const { tenantSlug, shortCode } = useParams<{ tenantSlug: string; shortCode?: string }>()
  const { tenantId, isLoading: tenantLoading, tenantReady } = useTenantBySlug(tenantSlug)
  const restaurantDisplayName = useRestaurantName()

  const { data: qrByCode, isLoading: qrLoading, isFetched: qrByCodeFetched } = usePublicMenuQr(
    tenantReady ? tenantId : null,
    shortCode ?? null,
  )
  const { data: qrDefault, isLoading: qrDefaultLoading } = usePublicDefaultMenuQr(
    shortCode ? null : tenantReady ? tenantId : null,
  )

  const qr = shortCode ? qrByCode : qrDefault
  const loading = shortCode
    ? tenantLoading || !tenantReady || qrLoading
    : tenantLoading || !tenantReady || qrDefaultLoading

  const qrNotFound =
    !!shortCode && tenantReady && qrByCodeFetched && !qrLoading && qrByCode === null

  if (!tenantSlug) return null

  if (loading) {
    return (
      <div className="min-h-svh bg-stone-50">
        <div className="sticky top-0 h-14 bg-stone-800" />
        <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
          Caricamento...
        </div>
      </div>
    )
  }

  if (!tenantId) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-stone-50 px-6">
        <p className="text-center text-sm text-gray-500">Ristorante non trovato.</p>
      </div>
    )
  }

  const resolvedShortCode = shortCode ?? qr?.short_code ?? ''

  return (
    <div className="min-h-svh">
      {qr ? (
        <MenuContent
          qr={qr}
          slug={tenantSlug}
          shortCode={resolvedShortCode}
          organizationName={restaurantDisplayName ?? 'Menu'}
        />
      ) : qrNotFound ? (
        <main className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">Menù QR non trovato</p>
          <p className="mt-2 text-xs text-gray-500">
            Il link non è valido, il QR è disattivato o non appartiene a questo ristorante.
          </p>
        </main>
      ) : (
        <main className="px-4 py-12 text-center">
          <p className="text-sm text-gray-500">Menu non ancora configurato.</p>
        </main>
      )}
    </div>
  )
}
