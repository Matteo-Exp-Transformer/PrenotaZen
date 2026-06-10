import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabasePublic } from '@/lib/supabasePublic'
import { usePublicMenuViewport } from '@/hooks/usePublicMenuViewport'
import { usePublicMenuQr } from '@/features/booking/hooks/useMenuQrCodes'
import { isCategoryInQrFilter } from '@/features/booking/utils/menuQrAppearance'
import { categoryHeaderBackgroundStyle } from '@/features/public-menu/categoryHeaderBackgroundStyle'
import { getMenuTheme } from '@/features/public-menu/menuThemes'
import { PUBLIC_MENU_CONTENT_MAX_WIDTH_CLASS } from '@/features/public-menu/publicMenuLayout'
import type { MenuItem } from '@/types/menu'

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
      const { data, error } = await (supabasePublic
        .from('menu_items') as any)
        .select('id, name, description, price, image_url, sort_order, category')
        .eq('tenant_id', tenantId)
        .eq('category', categoryKey)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      const items = (data ?? []) as MenuItem[]
      return [
        ...items.filter((i) => i.image_url),
        ...items.filter((i) => !i.image_url),
      ]
    },
    enabled: !!tenantId && !!categoryKey,
  })
}

function usePublicCategoryLabel(tenantId: string | null, categoryKey: string | undefined) {
  return useQuery({
    queryKey: ['public-menu-category-label', tenantId, categoryKey],
    queryFn: async () => {
      const { data } = await (supabasePublic
        .from('menu_categories') as any)
        .select('label')
        .eq('tenant_id', tenantId)
        .eq('key', categoryKey)
        .single()

      return (data as { label: string } | null)?.label ?? categoryKey ?? ''
    },
    enabled: !!tenantId && !!categoryKey,
  })
}

function ItemCardWithPhoto({ item }: { item: MenuItem }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <img
        src={item.image_url!}
        alt={item.name}
        loading="lazy"
        className="h-44 w-full object-cover"
      />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-gray-900 leading-snug">{item.name}</span>
          <span className="shrink-0 text-base font-bold text-stone-700">€{item.price.toFixed(2)}</span>
        </div>
        {item.description?.trim() && (
          <p className="mt-1 text-sm text-gray-500 leading-snug">{item.description}</p>
        )}
      </div>
    </div>
  )
}

function ItemCardText({ item }: { item: MenuItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-base font-semibold text-gray-900 leading-snug">{item.name}</p>
        {item.description?.trim() && (
          <p className="mt-0.5 text-sm text-gray-500 leading-snug">{item.description}</p>
        )}
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
  const categoryAllowed =
    !!categoryKey && !!qr && isCategoryInQrFilter(qr.category_filter, categoryKey)

  const { data: rawItems = [], isLoading: itemsLoading } = usePublicCategoryItems(
    tenantReady && categoryAllowed ? tenantId : null,
    categoryKey,
  )
  const { data: categoryLabel = '' } = usePublicCategoryLabel(
    tenantReady ? tenantId : null,
    categoryKey,
  )

  const theme = getMenuTheme(qr?.theme_key)
  const headerBgStyle = categoryHeaderBackgroundStyle(theme.headerImage, theme.headerFallbackBg)

  const hiddenSet = useMemo(
    () => new Set(qr?.hidden_menu_item_ids ?? []),
    [qr?.hidden_menu_item_ids],
  )

  const items = useMemo(
    () => rawItems.filter((i) => !hiddenSet.has(i.id)),
    [rawItems, hiddenSet],
  )

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

        <main className="flex flex-col gap-3 px-4 py-6">
        {loading && (
          <div className="py-16 text-center text-sm text-gray-500">Caricamento...</div>
        )}

        {!loading && qr && !categoryAllowed && (
          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Questa categoria non fa parte di questo menù QR.
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
      </div>
    </div>
  )
}
