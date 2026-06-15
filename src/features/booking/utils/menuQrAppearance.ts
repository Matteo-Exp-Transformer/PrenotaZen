import type { MenuCategoryRecord } from '../hooks/useMenuCategories'
import type { CarouselItem, MenuQrCode } from '@/types/menu'
import { DEFAULT_THEME_KEY } from '@/features/public-menu/menuThemes'

/** Ordine pubblico: sequenza `category_filter` del QR; legacy `null` = ordine già da query (`sort_order`). */
export function orderMenuCategoriesByFilter(
  categories: MenuCategoryRecord[],
  categoryFilter: string[] | null,
): MenuCategoryRecord[] {
  if (categoryFilter == null || categoryFilter.length === 0) {
    return categories
  }
  const byKey = new Map(categories.map((c) => [c.key, c]))
  const ordered: MenuCategoryRecord[] = []
  for (const key of categoryFilter) {
    const row = byKey.get(key)
    if (row) ordered.push(row)
  }
  return ordered
}

export function parseCarouselItems(raw: unknown): CarouselItem[] {
  const carouselRaw = Array.isArray(raw) ? raw : []
  return carouselRaw
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((x) => ({
      image_url: String(x.image_url ?? ''),
      eyebrow: x.eyebrow != null ? String(x.eyebrow) : undefined,
      title: x.title != null ? String(x.title) : undefined,
      description: x.description != null ? String(x.description) : undefined,
      label: x.label != null ? String(x.label) : undefined,
      sort_order: typeof x.sort_order === 'number' ? x.sort_order : 0,
    }))
    .filter((x) => x.image_url)
}

export function parseHiddenMenuItemIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

export function parseCategoryImages(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v) out[k] = v
  }
  return out
}

/** Legacy `null` = tutte le categorie; `[]` = nessuna; array esplicito = solo quelle chiavi. */
export function isCategoryInQrFilter(
  categoryFilter: string[] | null | undefined,
  categoryKey: string,
): boolean {
  if (categoryFilter == null) return true
  if (categoryFilter.length === 0) return false
  return categoryFilter.includes(categoryKey)
}

export function parseItemSortOverrides(raw: unknown): Record<string, string[]> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      out[k] = v.filter((x): x is string => typeof x === 'string' && x.length > 0)
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Applica l'override ordine piatti per-QR.
 * Gli UUID presenti nell'array override vengono messi in quella sequenza;
 * gli item non inclusi nell'override vengono appesi in coda (ordine originale).
 */
export function applyQrItemSortOverride<T extends { id: string }>(
  items: T[],
  overrideIds: string[] | null | undefined,
): T[] {
  if (!overrideIds || overrideIds.length === 0) return items
  const posMap = new Map(overrideIds.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const pa = posMap.get(a.id) ?? Infinity
    const pb = posMap.get(b.id) ?? Infinity
    return pa - pb
  })
}

export function parseMenuQrCodeRow(raw: Record<string, unknown>): MenuQrCode {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    short_code: String(raw.short_code),
    name: String(raw.name),
    category_filter: Array.isArray(raw.category_filter)
      ? (raw.category_filter as string[])
      : null,
    is_active: Boolean(raw.is_active),
    sort_order: typeof raw.sort_order === 'number' ? raw.sort_order : 0,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
    theme_key: typeof raw.theme_key === 'string' ? raw.theme_key : DEFAULT_THEME_KEY,
    carousel_items: parseCarouselItems(raw.carousel_items),
    category_images: parseCategoryImages(raw.category_images),
    hidden_menu_item_ids: parseHiddenMenuItemIds(raw.hidden_menu_item_ids),
    item_sort_overrides: parseItemSortOverrides(raw.item_sort_overrides),
  }
}
