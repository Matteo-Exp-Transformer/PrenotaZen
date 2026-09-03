import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabasePublic } from '@/lib/supabasePublic'
import { usePublicMenuViewport } from '@/hooks/usePublicMenuViewport'
import { usePublicMenuQr } from '@/features/booking/hooks/useMenuQrCodes'
import { usePublicMenuQrcodeCategories } from '@/features/booking/hooks/useMenuQrcodeCategories'
import { isCategoryInQrFilter, applyQrItemSortOverride } from '@/features/booking/utils/menuQrAppearance'
import { categoryHeaderBackgroundStyle } from '@/features/public-menu/categoryHeaderBackgroundStyle'
import { getMenuTheme } from '@/features/public-menu/menuThemes'
import { MenuNavTabs } from '@/features/public-menu/MenuNavTabs'
import { usePublicMenuCategories } from '@/features/public-menu/usePublicMenuCategories'
import {
  PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS,
  PUBLIC_MENU_CATEGORY_MAIN_BOTTOM_PAD_CLASS,
} from '@/features/public-menu/publicMenuLayout'
import type { MenuItem } from '@/types/menu'
import {
  filterMenuItemsForPublicQr,
  isMenuCategoryAvailable,
} from '@/features/booking/constants/menuMagazzinoLimits'
import {
  BOOKING_MENU_COMPOSE_TEXT_LIMITS,
  clampBookingText,
} from '@/features/booking/constants/bookingPrenotaTextLimits'

const COMPOSE_L = BOOKING_MENU_COMPOSE_TEXT_LIMITS

function composeItemDisplay(item: MenuItem) {
  return {
    name: clampBookingText(item.name, COMPOSE_L.itemName),
    description: item.description?.trim()
      ? clampBookingText(item.description, COMPOSE_L.itemDescription)
      : undefined,
  }
}

/** Fascia header categoria — crop piccolo del PNG tema QR. Asset ottimizzati scroll: FU-021. */
const CATEGORY_HEADER_BAND_PX = 56

function useTenantBySlug(slug: string | undefined) {
  const { setTenantFromSlug, tenantId, tenantSlug, isLoading } = useTenantContext()
  useEffect(() => {
    if (slug) setTenantFromSlug(slug)
  }, [slug, setTenantFromSlug])

  const tenantReady = !!slug && !isLoading && !!tenantId && tenantSlug === slug

  return { tenantId, isLoading, tenantReady }
}

function usePublicCategoryItems(tenantId: string | null, categoryKey: string | undefined) {
  return useQuery({
    queryKey: ['public-menu-items-category', tenantId, categoryKey],
    queryFn: async () => {
      const { data, error } = await supabasePublic
        .from('menu_items')
        .select('id, name, description, price, image_url, sort_order, category, is_available')
        .eq('tenant_id', tenantId!)
        .eq('category', categoryKey!)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as MenuItem[]
    },
    enabled: !!tenantId && !!categoryKey,
  })
}

function usePublicCategoryMeta(tenantId: string | null, categoryKey: string | undefined) {
  return useQuery({
    queryKey: ['public-menu-category-meta', tenantId, categoryKey],
    queryFn: async () => {
      const { data } = await supabasePublic
        .from('menu_categories')
        .select('label, is_available')
        .eq('tenant_id', tenantId!)
        .eq('key', categoryKey!)
        .single()

      const row = data as { label: string; is_available?: boolean } | null
      return {
        label: row?.label ?? categoryKey ?? '',
        is_available: row?.is_available,
      }
    },
    enabled: !!tenantId && !!categoryKey,
  })
}

function ItemCardWithPhoto({ item }: { item: MenuItem }) {
  const { name, description } = composeItemDisplay(item)
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <img
        src={item.image_url!}
        alt={name}
        loading="lazy"
        className="h-44 w-full object-cover"
      />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 wrap-break-word text-base font-semibold leading-snug text-gray-900">
            {name}
          </span>
          <span className="shrink-0 text-base font-bold text-stone-700">€{item.price.toFixed(2)}</span>
        </div>
        {description ? (
          <p className="mt-1 min-w-0 wrap-break-word text-sm leading-snug text-gray-500">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function ItemCardText({ item }: { item: MenuItem }) {
  const { name, description } = composeItemDisplay(item)
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
      <div className="min-w-0">
        <p className="wrap-break-word text-base font-semibold leading-snug text-gray-900">{name}</p>
        {description ? (
          <p className="mt-0.5 wrap-break-word text-sm leading-snug text-gray-500">{description}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-base font-bold text-stone-700">€{item.price.toFixed(2)}</span>
    </div>
  )
}

export function PublicMenuCategoryPage() {
  usePublicMenuViewport()
  const { tenantSlug, shortCode, categoryKey } = useParams<{
    tenantSlug: string
    shortCode: string
    categoryKey: string
  }>()

  const { tenantId, isLoading: tenantLoading, tenantReady } = useTenantBySlug(tenantSlug)
  const { data: qr, isLoading: qrLoading } = usePublicMenuQr(
    tenantReady ? tenantId : null,
    shortCode ?? null,
  )
  const { data: qrCatOverrides = [] } = usePublicMenuQrcodeCategories(qr?.id ?? null)
  const { data: navCategories = [] } = usePublicMenuCategories(
    tenantReady && qr ? tenantId : null,
    qr?.category_filter ?? null,
  )
  const categoryOverride = useMemo(
    () => qrCatOverrides.find((o) => o.category_key === categoryKey),
    [qrCatOverrides, categoryKey],
  )
  const overridesByKey = useMemo(
    () => Object.fromEntries(qrCatOverrides.map((o) => [o.category_key, o])),
    [qrCatOverrides],
  )

  const categoryInQrFilter =
    !!categoryKey && !!qr && isCategoryInQrFilter(qr.category_filter, categoryKey)

  const { data: categoryMeta } = usePublicCategoryMeta(
    tenantReady ? tenantId : null,
    categoryKey,
  )

  const categoryAllowed =
    categoryInQrFilter && !!categoryMeta && isMenuCategoryAvailable(categoryMeta)

  const { data: rawItems = [], isLoading: itemsLoading } = usePublicCategoryItems(
    tenantReady && categoryInQrFilter && categoryMeta && isMenuCategoryAvailable(categoryMeta)
      ? tenantId
      : null,
    categoryKey,
  )

  const theme = getMenuTheme(qr?.theme_key)
  const headerBgStyle = categoryHeaderBackgroundStyle(theme.headerImage, theme.headerFallbackBg)
  const categoryPhotoUrl = qr?.category_images?.[categoryKey ?? ''] ?? null

  const items = useMemo(() => {
    if (!categoryKey || !categoryMeta) return []
    const filtered = filterMenuItemsForPublicQr(
      rawItems,
      [{ key: categoryKey, label: categoryMeta.label, is_available: categoryMeta.is_available }],
      qr?.hidden_menu_item_ids ?? [],
    )
    const sortOverrideIds = qr?.item_sort_overrides?.[categoryKey] ?? null
    if (sortOverrideIds) {
      return applyQrItemSortOverride(filtered, sortOverrideIds)
    }
    // Default: foto prima del testo
    return [
      ...filtered.filter((i) => i.image_url),
      ...filtered.filter((i) => !i.image_url),
    ]
  }, [rawItems, categoryKey, categoryMeta, qr?.hidden_menu_item_ids, qr?.item_sort_overrides])

  const categoryLabel = categoryOverride?.title || categoryMeta?.label || ''

  const backHref = `/menu/${tenantSlug}/qr/${shortCode}`

  const loading = tenantLoading || !tenantReady || qrLoading || (categoryAllowed && itemsLoading)

  return (
    <div className="min-h-svh bg-stone-50">
      {/* FU-025: shell stone-50 full viewport; header + lista nella stessa colonna ~1024px della homepage QR */}
      <div className={`${PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS} min-h-svh`}>
        <header
          className="sticky top-0 z-10 px-4 py-3 shadow-sm"
          style={{
            ...headerBgStyle,
            minHeight: CATEGORY_HEADER_BAND_PX,
          }}
        >
          <div className="flex items-center gap-3">
            <Link
              to={backHref}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80"
              style={{
                color: theme.headerTextColor,
                backgroundColor: `${theme.headerTextColor}1a`,
              }}
              aria-label="Torna al menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1
              className="flex-1 text-center text-lg font-bold leading-tight pr-9"
              style={{ color: theme.headerTextColor }}
            >
              {categoryLabel || '…'}
            </h1>
          </div>
        </header>

        {categoryAllowed && categoryPhotoUrl && (
          <div className="w-full overflow-hidden bg-stone-200">
            <img
              src={categoryPhotoUrl}
              alt={categoryLabel}
              loading="lazy"
              className="h-44 w-full object-cover"
            />
          </div>
        )}

        <main className={`flex flex-col gap-3 px-4 py-6 ${PUBLIC_MENU_CATEGORY_MAIN_BOTTOM_PAD_CLASS}`}>
        {loading && (
          <div className="py-16 text-center text-sm text-gray-500">Caricamento...</div>
        )}

        {!loading && qr && !categoryAllowed && (
          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              {categoryInQrFilter
                ? 'Questa categoria non è al momento disponibile.'
                : 'Questa categoria non fa parte di questo menù QR.'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Torna alla homepage del menù per vedere le categorie disponibili.
            </p>
            <Link
              to={backHref}
              className="is-clickable mt-4 inline-block text-sm font-semibold text-teal-700 underline"
            >
              Torna al menù QR
            </Link>
          </div>
        )}

        {!loading && categoryAllowed && items.length === 0 && (
          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-sm">
            <p className="text-sm text-gray-500">Nessun piatto visibile in questa categoria.</p>
          </div>
        )}

        {!loading &&
          categoryAllowed &&
          items.map((item) =>
            item.image_url ? (
              <ItemCardWithPhoto key={item.id} item={item} />
            ) : (
              <ItemCardText key={item.id} item={item} />
            ),
          )}
        </main>

        {tenantSlug && shortCode && navCategories.length > 0 && (
          <MenuNavTabs
            categories={navCategories}
            slug={tenantSlug}
            shortCode={shortCode}
            accentColor={theme.accentColor}
            tabBarStickyRgb={theme.tabBarStickyRgb}
            overridesByKey={overridesByKey}
            activeCategoryKey={categoryKey}
          />
        )}
      </div>
    </div>
  )
}
