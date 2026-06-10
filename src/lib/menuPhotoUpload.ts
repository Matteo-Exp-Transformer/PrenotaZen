import { supabase } from '@/lib/supabase'

const BUCKET = 'menu-photos'
const MAX_SIDE_PX = 1200
const MAX_BYTES = 450_000 // target dopo compressione

/** Percorso deterministico piatto: {tenantId}/{menuItemId}.webp */
export function menuPhotoPath(tenantId: string, menuItemId: string): string {
  return `${tenantId}/${menuItemId}.webp`
}

/** Percorso foto categoria Prenota (non homepage QR: quella usa {tenantId}/cat/{key}.webp). */
export function menuCategoryPhotoPath(tenantId: string, categoryId: string): string {
  return `${tenantId}/booking-cat/${categoryId}.webp`
}

/**
 * Ridimensiona e comprime l'immagine lato client via Canvas.
 * Ritorna un Blob webp, max 1200px su lato lungo, qualità ridotta iterativamente.
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_SIDE_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)

      let quality = 0.82
      const tryEncode = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compressione fallita'))
            if (blob.size <= MAX_BYTES || quality <= 0.4) return resolve(blob)
            quality -= 0.12
            tryEncode()
          },
          'image/webp',
          quality,
        )
      }
      tryEncode()
    }
    img.onerror = () => reject(new Error('Impossibile leggere l\'immagine'))
    img.src = url
  })
}

/**
 * Carica la foto di un piatto su Storage e restituisce l'URL pubblico.
 * Sovrascrive automaticamente il file precedente (stesso path).
 */
export async function uploadMenuPhoto(
  file: File,
  tenantId: string,
  menuItemId: string,
): Promise<string> {
  const blob = await compressImage(file)
  const path = menuPhotoPath(tenantId, menuItemId)

  const { error } = await (supabase.storage
    .from(BUCKET) as any)
    .upload(path, blob, {
      contentType: 'image/webp',
      upsert: true,
    })

  if (error) throw new Error(`Errore upload foto: ${(error as any).message ?? error}`)

  const { data } = (supabase.storage.from(BUCKET) as any).getPublicUrl(path)
  return `${(data as { publicUrl: string }).publicUrl}?v=${Date.now()}`
}

/** Elimina la foto di un piatto da Storage (non lancia se non esiste). */
export async function deleteMenuPhoto(tenantId: string, menuItemId: string): Promise<void> {
  const path = menuPhotoPath(tenantId, menuItemId)
  await (supabase.storage.from(BUCKET) as any).remove([path])
}

/** Carica la foto di una categoria (pagina Prenota) e restituisce l'URL pubblico. */
export async function uploadMenuCategoryPhoto(
  file: File,
  tenantId: string,
  categoryId: string,
): Promise<string> {
  const blob = await compressImage(file)
  const path = menuCategoryPhotoPath(tenantId, categoryId)

  const { error } = await (supabase.storage.from(BUCKET) as any).upload(path, blob, {
    contentType: 'image/webp',
    upsert: true,
  })

  if (error) throw new Error(`Errore upload foto categoria: ${(error as any).message ?? error}`)

  const { data } = (supabase.storage.from(BUCKET) as any).getPublicUrl(path)
  return `${(data as { publicUrl: string }).publicUrl}?v=${Date.now()}`
}

/** Elimina la foto categoria Prenota da Storage. */
export async function deleteMenuCategoryPhoto(tenantId: string, categoryId: string): Promise<void> {
  const path = menuCategoryPhotoPath(tenantId, categoryId)
  await (supabase.storage.from(BUCKET) as any).remove([path])
}
