import { supabase } from '@/lib/supabase'
import type { CarouselItem } from '@/types/menu'

const BUCKET = 'menu-photos'

/** Segmento path Storage: id QR salvato oppure `draft/{shortCode}` per bozze pre-salvataggio. */
export function menuQrStorageSegment(menuQrCodeId: string | null, draftShortCode: string | null): string | null {
  if (menuQrCodeId) return menuQrCodeId
  if (draftShortCode) return `draft/${draftShortCode}`
  return null
}

export function menuQrStoragePrefix(tenantId: string, segment: string) {
  return `${tenantId}/qr/${segment}`
}

export function storagePathFromPublicUrl(url: string): string | null {
  const match = url.match(/menu-photos\/([^?]+)/)
  return match ? match[1] : null
}

export function isBookingCategoryPhotoUrl(url: string, tenantId: string): boolean {
  const path = storagePathFromPublicUrl(url)
  if (!path) return false
  return path.startsWith(`${tenantId}/booking-cat/`)
}

/** Thumb categoria già sul path QR del tenant (`qr/{segment}/cat/…`), incluso draft. */
export function isMenuQrCategoryPhotoUrl(url: string, tenantId: string): boolean {
  const path = storagePathFromPublicUrl(url)
  if (!path) return false
  return path.startsWith(`${tenantId}/qr/`) && path.includes('/cat/')
}

/** UUID categoria da path `booking-cat/{id}.webp`; null se URL non è catalogo del tenant. */
export function bookingCategoryIdFromPhotoUrl(url: string, tenantId: string): string | null {
  const path = storagePathFromPublicUrl(url)
  if (!path) return null
  const prefix = `${tenantId}/booking-cat/`
  if (!path.startsWith(prefix)) return null
  const rest = path.slice(prefix.length)
  const match = /^(.+)\.webp$/i.exec(rest)
  return match ? match[1] : null
}

/**
 * Anteprima modale: sostituire URL catalogo stale (booking-cat di altra categoria).
 * Non tocca thumb già su path QR né booking-cat con categoryId corretto.
 */
export function shouldRefreshCatalogPrefill(
  url: string,
  categoryId: string,
  tenantId: string,
): boolean {
  if (isMenuQrCategoryPhotoUrl(url, tenantId)) return false
  if (!isBookingCategoryPhotoUrl(url, tenantId)) return false
  return bookingCategoryIdFromPhotoUrl(url, tenantId) !== categoryId
}

export function applyCatalogPrefillForKey(
  existingUrl: string | undefined,
  catalogImageUrl: string,
  categoryId: string,
  tenantId: string,
): string {
  if (!existingUrl) return catalogImageUrl
  if (shouldRefreshCatalogPrefill(existingUrl, categoryId, tenantId)) {
    return catalogImageUrl
  }
  return existingUrl
}

export interface CatalogPrefillCategory {
  key: string
  id: string
  image_url?: string | null
}

/** Anteprima modale QR: prefill da `menu_categories.image_url` (solo draft, non Salva). */
export function buildCatalogPrefillForKeys(
  keys: string[],
  categories: CatalogPrefillCategory[],
  existing: Record<string, string>,
  tenantId: string | null | undefined,
): Record<string, string> {
  let changed = false
  const next = { ...existing }
  for (const key of keys) {
    const cat = categories.find((c) => c.key === key)
    if (!cat?.image_url) continue

    const current = next[key]
    if (!current) {
      next[key] = cat.image_url
      changed = true
      continue
    }

    if (!tenantId) continue

    const refreshed = applyCatalogPrefillForKey(current, cat.image_url, cat.id, tenantId)
    if (refreshed !== current) {
      next[key] = refreshed
      changed = true
    }
  }
  return changed ? next : existing
}

export function menuQrCategoryPhotoPath(
  tenantId: string,
  storageSegment: string,
  categoryKey: string,
): string {
  return `${menuQrStoragePrefix(tenantId, storageSegment)}/cat/${categoryKey}.webp`
}

/**
 * Copia thumb da catalogo Menu (`booking-cat/`) al path QR (`qr/{segment}/cat/`).
 * URL già sul path QR canonico restano invariati.
 */
export async function importCatalogCategoryImagesToQrStorage(
  tenantId: string,
  storageSegment: string,
  categoryImages: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  for (const [categoryKey, url] of Object.entries(categoryImages)) {
    const path = storagePathFromPublicUrl(url)
    if (!path) {
      result[categoryKey] = url
      continue
    }

    const destPath = menuQrCategoryPhotoPath(tenantId, storageSegment, categoryKey)
    if (path === destPath) {
      result[categoryKey] = url
      continue
    }

    const bookingPrefix = `${tenantId}/booking-cat/`
    if (path.startsWith(bookingPrefix)) {
      await copyStorageObject(path, destPath)
      result[categoryKey] = publicUrlForPath(destPath)
      continue
    }

    const qrPrefix = `${menuQrStoragePrefix(tenantId, storageSegment)}/`
    if (path.startsWith(qrPrefix)) {
      result[categoryKey] = url
      continue
    }

    result[categoryKey] = url
  }

  return result
}

async function copyStorageObject(fromPath: string, toPath: string): Promise<void> {
  const { error } = await (supabase.storage.from(BUCKET) as any).copy(fromPath, toPath)
  if (error) throw error
}

/** Copia thumb QR `cat/{previousKey}.webp` → `cat/{newKey}.webp` se il file sorgente esiste. */
export async function tryCopyQrCategoryPhotoOnRename(
  tenantId: string,
  storageSegment: string,
  previousKey: string,
  newKey: string,
): Promise<boolean> {
  if (previousKey === newKey) return false
  const fromPath = menuQrCategoryPhotoPath(tenantId, storageSegment, previousKey)
  const toPath = menuQrCategoryPhotoPath(tenantId, storageSegment, newKey)
  try {
    await copyStorageObject(fromPath, toPath)
    return true
  } catch {
    return false
  }
}

function publicUrlForPath(path: string): string {
  const { data } = (supabase.storage.from(BUCKET) as any).getPublicUrl(path)
  return (data as { publicUrl: string }).publicUrl
}

/** Dopo il primo insert, sposta file da `qr/draft/{shortCode}/` a `qr/{savedId}/`. */
export async function migrateMenuQrDraftAssets(
  tenantId: string,
  draftShortCode: string,
  savedId: string,
  carouselItems: CarouselItem[],
  categoryImages: Record<string, string>,
): Promise<{ carousel_items: CarouselItem[]; category_images: Record<string, string> }> {
  const draftSeg = `draft/${draftShortCode}`
  const draftPrefix = `${tenantId}/qr/${draftSeg}/`

  const migrateUrl = async (url: string): Promise<string> => {
    const path = storagePathFromPublicUrl(url)
    if (!path || !path.startsWith(draftPrefix)) return url
    const suffix = path.slice(draftPrefix.length)
    const destPath = `${menuQrStoragePrefix(tenantId, savedId)}/${suffix}`
    await copyStorageObject(path, destPath)
    return publicUrlForPath(destPath)
  }

  const carousel_items = await Promise.all(
    carouselItems.map(async (item) => ({
      ...item,
      image_url: await migrateUrl(item.image_url),
    })),
  )

  const category_images: Record<string, string> = {}
  for (const [key, url] of Object.entries(categoryImages)) {
    category_images[key] = await migrateUrl(url)
  }

  return { carousel_items, category_images }
}
