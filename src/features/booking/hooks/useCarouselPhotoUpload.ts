import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'react-toastify'
import { supabase } from '@/lib/supabase'
import type { CarouselItem } from '@/types/menu'

const BUCKET = 'menu-photos'
const MAX_SIDE_PX = 1200
const MAX_BYTES = 450_000

/** Limite dimensione foto carosello (Prenota + Menu QR homepage). */
export const CAROUSEL_PHOTO_MAX_MB = 5
export const CAROUSEL_PHOTO_MAX_BYTES = CAROUSEL_PHOTO_MAX_MB * 1024 * 1024

const ACCEPTED_CAROUSEL_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

function isAcceptedCarouselPhoto(file: File): boolean {
  // file.type può essere vuoto su alcuni browser; in quel caso lasciamo passare:
  // il file viene comunque convertito in WebP prima dell'upload.
  return file.type === '' || ACCEPTED_CAROUSEL_MIME.has(file.type)
}

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
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
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
    img.onerror = () => reject(new Error('Impossibile leggere immagine'))
    img.src = url
  })
}

export async function uploadMenuPhotoFile(file: File, path: string): Promise<string> {
  const blob = await compressImage(file)
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw new Error(error.message ?? 'Upload fallito')
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function removeMenuPhotoPath(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export function storagePathFromMenuPhotoUrl(url: string): string | null {
  const match = url.match(/menu-photos\/([^?]+)/)
  return match ? match[1] : null
}

export function bookingCarouselStoragePrefix(tenantId: string, modeId: string, subTabId: string): string {
  return `${tenantId}/booking-form/${modeId}/${subTabId}`
}

export function useCarouselPhotoUpload({
  storagePrefix,
  items,
  onChange,
}: {
  /** Path base dentro bucket `menu-photos`; il hook aggiunge `/carousel/{uuid}.webp`. */
  storagePrefix: string | null
  items: CarouselItem[]
  onChange: (items: CarouselItem[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const canUpload = !!storagePrefix

  const validateFile = (file: File): boolean => {
    if (!isAcceptedCarouselPhoto(file)) {
      toast.error('Formato non supportato. Usa JPG, PNG, WebP o AVIF.')
      return false
    }
    if (file.size > CAROUSEL_PHOTO_MAX_BYTES) {
      toast.error(`Foto troppo grande (max ${CAROUSEL_PHOTO_MAX_MB} MB).`)
      return false
    }
    return true
  }

  const handleAddFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !storagePrefix || !validateFile(file)) return
    setUploading(true)
    try {
      const uuid = crypto.randomUUID()
      const path = `${storagePrefix}/carousel/${uuid}.webp`
      const url = await uploadMenuPhotoFile(file, path)
      onChange([...items, { image_url: url, sort_order: items.length }])
      toast.success('Foto aggiunta')
    } catch {
      toast.error('Errore caricamento foto')
    } finally {
      setUploading(false)
    }
  }

  const removeAt = async (index: number) => {
    const item = items[index]
    const path = storagePathFromMenuPhotoUrl(item.image_url)
    if (path) await removeMenuPhotoPath(path)
    onChange(items.filter((_, idx) => idx !== index).map((x, idx) => ({ ...x, sort_order: idx })))
  }

  const replaceAt = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !storagePrefix || index < 0 || index >= items.length || !validateFile(file)) return
    setUploading(true)
    try {
      const old = items[index]
      const uuid = crypto.randomUUID()
      const path = `${storagePrefix}/carousel/${uuid}.webp`
      const url = await uploadMenuPhotoFile(file, path)
      const oldPath = storagePathFromMenuPhotoUrl(old.image_url)
      if (oldPath) await removeMenuPhotoPath(oldPath)
      onChange(items.map((it, i) => (i === index ? { ...it, image_url: url } : it)))
      toast.success('Foto aggiornata')
    } catch {
      toast.error('Errore caricamento foto')
    } finally {
      setUploading(false)
    }
  }

  return { fileRef, uploading, canUpload, handleAddFile, removeAt, replaceAt }
}
