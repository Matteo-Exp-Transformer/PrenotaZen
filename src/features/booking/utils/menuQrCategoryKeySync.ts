import {
  menuQrCategoryPhotoPath,
  storagePathFromPublicUrl,
} from './menuQrStorage'

export type MenuQrRowCategoryFields = {
  category_filter: string[] | null
  category_images: Record<string, string>
}

export type RenameCategoryKeyInQrRowResult = MenuQrRowCategoryFields & {
  /** True se `category_filter` o `category_images` sono cambiati */
  changed: boolean
  /** Copia storage consigliata se la riga aveva thumb QR sul path canonico della vecchia chiave */
  shouldCopyStoragePhoto: boolean
}

export type DeleteCategoryKeyInQrRowResult = MenuQrRowCategoryFields & {
  changed: boolean
  /** Rimuovi `qr/{id}/cat/{categoryKey}.webp` se la riga aveva thumb per quella chiave */
  shouldRemoveStoragePhoto: boolean
}

function removeKeyFromFilter(
  categoryFilter: string[] | null,
  categoryKey: string,
): { value: string[] | null; changed: boolean } {
  // Legacy `null` = tutte le categorie del tenant: non restringiamo il filtro al delete.
  if (categoryFilter == null) {
    return { value: null, changed: false }
  }
  const next = categoryFilter.filter((k) => k !== categoryKey)
  if (next.length === categoryFilter.length) {
    return { value: categoryFilter, changed: false }
  }
  return { value: next, changed: true }
}

function removeKeyFromCategoryImages(
  categoryImages: Record<string, string>,
  categoryKey: string,
): { value: Record<string, string>; changed: boolean } {
  if (!(categoryKey in categoryImages)) {
    return { value: categoryImages, changed: false }
  }
  const next = { ...categoryImages }
  delete next[categoryKey]
  return { value: next, changed: true }
}

/**
 * Rimuove `categoryKey` da `category_filter` e `category_images` di una riga `menu_qr_codes`.
 * Non tocca altri campi né righe `menu_qrcode_categories` (gestite dal sync DB).
 */
export function deleteCategoryKeyFromQrRow(
  categoryKey: string,
  row: MenuQrRowCategoryFields,
): DeleteCategoryKeyInQrRowResult {
  const filterResult = removeKeyFromFilter(row.category_filter, categoryKey)
  const imagesResult = removeKeyFromCategoryImages(row.category_images, categoryKey)
  const hadThumb = categoryKey in row.category_images

  return {
    category_filter: filterResult.value,
    category_images: imagesResult.value,
    changed: filterResult.changed || imagesResult.changed,
    shouldRemoveStoragePhoto: hadThumb,
  }
}

function replaceKeyInFilter(
  categoryFilter: string[] | null,
  previousKey: string,
  newKey: string,
): { value: string[] | null; changed: boolean } {
  if (categoryFilter == null || previousKey === newKey) {
    return { value: categoryFilter, changed: false }
  }
  let changed = false
  const next = categoryFilter.map((k) => {
    if (k === previousKey) {
      changed = true
      return newKey
    }
    return k
  })
  if (!changed) return { value: categoryFilter, changed: false }
  return { value: [...new Set(next)], changed: true }
}

function renameKeyInCategoryImages(
  categoryImages: Record<string, string>,
  previousKey: string,
  newKey: string,
): { value: Record<string, string>; changed: boolean } {
  if (previousKey === newKey || !(previousKey in categoryImages)) {
    return { value: categoryImages, changed: false }
  }

  const next = { ...categoryImages }
  const url = next[previousKey]!
  delete next[previousKey]

  if (!(newKey in next)) {
    next[newKey] = url
  }

  return { value: next, changed: true }
}

/**
 * Allinea `category_filter` e `category_images` di una riga `menu_qr_codes` dopo rename
 * categoria in magazzino. Non tocca title/icon in `menu_qrcode_categories` né altri campi QR.
 */
export function renameCategoryKeyInQrRow(
  previousKey: string,
  newKey: string,
  row: MenuQrRowCategoryFields,
): RenameCategoryKeyInQrRowResult {
  if (previousKey === newKey) {
    return {
      category_filter: row.category_filter,
      category_images: row.category_images,
      changed: false,
      shouldCopyStoragePhoto: false,
    }
  }

  const filterResult = replaceKeyInFilter(row.category_filter, previousKey, newKey)
  const imagesResult = renameKeyInCategoryImages(row.category_images, previousKey, newKey)
  const hadOldThumb = previousKey in row.category_images

  return {
    category_filter: filterResult.value,
    category_images: imagesResult.value,
    changed: filterResult.changed || imagesResult.changed,
    shouldCopyStoragePhoto: hadOldThumb,
  }
}

/** Riscrivi URL pubblico se punta al file `cat/{previousKey}.webp` del QR. */
export function rewriteQrCategoryImageUrlForKeyRename(
  url: string,
  tenantId: string,
  storageSegment: string,
  previousKey: string,
  newKey: string,
  publicUrlForPath: (path: string) => string,
): string {
  const path = storagePathFromPublicUrl(url)
  if (!path) return url

  const oldCanonical = menuQrCategoryPhotoPath(tenantId, storageSegment, previousKey)
  const newCanonical = menuQrCategoryPhotoPath(tenantId, storageSegment, newKey)

  if (path === oldCanonical || path.endsWith(`/cat/${previousKey}.webp`)) {
    return publicUrlForPath(newCanonical)
  }

  return url
}

export function applyCategoryImageUrlRewritesForRename(
  categoryImages: Record<string, string>,
  tenantId: string,
  storageSegment: string,
  previousKey: string,
  newKey: string,
  publicUrlForPath: (path: string) => string,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, url] of Object.entries(categoryImages)) {
    out[key] =
      key === newKey
        ? rewriteQrCategoryImageUrlForKeyRename(
            url,
            tenantId,
            storageSegment,
            previousKey,
            newKey,
            publicUrlForPath,
          )
        : url
  }
  return out
}
