import { ImagePlus, ChevronUp, ChevronDown, Trash2, Pencil } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'
import { AdminFieldWithCharCount } from './AdminFieldWithCharCount'
import {
  bookingCarouselStoragePrefix,
  useCarouselPhotoUpload,
} from '@/features/booking/hooks/useCarouselPhotoUpload'
import type { CarouselItem } from '@/types/menu'
import {
  BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { MenuCategoryIconPicker } from '@/features/public-menu/MenuCategoryIconPicker'

function syncCarouselSubTabFields(items: CarouselItem[]): Partial<SubTab> {
  return {
    carousel_items: items,
    description: undefined,
    icon: undefined,
  }
}

function CarouselSlideEditorCard({
  item,
  index,
  total,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
  onReplacePhoto,
  replaceDisabled,
  hideMobileSlideLabel = false,
}: {
  item: CarouselItem
  index: number
  total: number
  onPatch: (patch: Partial<CarouselItem>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onReplacePhoto: (e: ChangeEvent<HTMLInputElement>) => void
  replaceDisabled?: boolean
  /** Su mobile la prima slide mostra l'etichetta nella riga titolo del genitore (es. CAROSELLO 1). */
  hideMobileSlideLabel?: boolean
}) {
  const replaceFileRef = useRef<HTMLInputElement>(null)
  const slideLabel = `Foto N° ${index + 1}`

  return (
    <div
      className={cn(
        'w-full min-w-0 space-y-4',
        index > 0 && 'border-t border-slate-200 pt-5',
      )}
    >
      {!hideMobileSlideLabel ? (
        <div className="flex justify-end sm:hidden">
          <span className="text-xs font-semibold text-slate-600">{slideLabel}</span>
        </div>
      ) : null}

      <div className="flex w-full min-w-0 items-start gap-2 sm:items-center sm:gap-3">
        <img
          src={item.image_url}
          alt=""
          className="h-20 w-28 shrink-0 rounded-lg border border-slate-200 object-cover sm:h-24 sm:w-32"
        />
        <span className="hidden min-w-0 flex-1 text-left text-sm font-semibold text-slate-600 sm:block">
          {slideLabel}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
            aria-label="Sposta su"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"
            aria-label="Sposta giù"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
          <div className="flex shrink-0 items-center gap-0.5">
          <input
            ref={replaceFileRef}
            type="file"
            accept="image/webp,image/jpeg,image/png,image/avif"
            className="hidden"
            onChange={onReplacePhoto}
          />
          <button
            type="button"
            disabled={replaceDisabled}
            onClick={() => replaceFileRef.current?.click()}
            className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Modifica foto"
            title="Modifica foto"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={replaceDisabled}
            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Rimuovi foto"
            title="Rimuovi foto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-600">Inserisci o modifica il testo mostrato nelle foto del carosello.</p>

      <AdminFieldWithCharCount
        label="Testo Etichetta"
        value={item.eyebrow ?? ''}
        maxLength={BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.eyebrow}
        onChange={(eyebrow) => onPatch({ eyebrow: eyebrow || undefined })}
        placeholder="Nome mostrato al cliente"
        singleLine
      />

      <AdminFieldWithCharCount
        label="Testo Titolo"
        value={item.title ?? ''}
        maxLength={BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.title}
        onChange={(title) => onPatch({ title: title || undefined })}
        placeholder="es. Tonno in crosta"
        singleLine
      />

      <AdminFieldWithCharCount
        label="Testo Descrizione"
        value={item.description ?? ''}
        maxLength={BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS.description}
        onChange={(description) => onPatch({ description: description || undefined })}
        placeholder="Sottotitolo sulla card"
      />

      <div className="w-full min-w-0 space-y-1.5 -mt-2">
        <Label className="block text-sm">Scegli Icona</Label>
        <MenuCategoryIconPicker
          allowNone
          value={item.icon}
          onChange={(icon) => onPatch({ icon })}
          ariaLabel={`Icona slide ${slideLabel}`}
        />
      </div>
    </div>
  )
}

export function BookingFormCarouselEditor({
  tenantId,
  modeId,
  tab,
  onPatchTab,
  firstSlideLabelInParentHeader = false,
}: {
  tenantId: string
  modeId: string
  tab: SubTab
  onPatchTab: (patch: Partial<SubTab>) => void
  /** Su mobile la prima slide mostra «Foto N° 1» nella riga titolo del genitore. */
  firstSlideLabelInParentHeader?: boolean
}) {
  const items = tab.carousel_items ?? []

  const applyItems = (next: CarouselItem[]) => {
    onPatchTab(syncCarouselSubTabFields(next))
  }

  const { fileRef, uploading, canUpload, handleAddFile, removeAt, replaceAt } = useCarouselPhotoUpload({
    storagePrefix: bookingCarouselStoragePrefix(tenantId, modeId, tab.id),
    items,
    onChange: (next) => {
      const merged = next.map((it, idx) => {
        const prev = items.find((p) => p.image_url === it.image_url) ?? items[idx]
        if (prev) return { ...prev, image_url: it.image_url, sort_order: idx }
        return { ...it, icon: it.icon ?? 'fork_knife', sort_order: idx }
      })
      applyItems(merged)
    },
  })

  const patchItem = (index: number, patch: Partial<CarouselItem>) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    applyItems(next)
  }

  const moveUp = (i: number) => {
    if (i === 0) return
    const next = [...items]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    applyItems(next.map((x, idx) => ({ ...x, sort_order: idx })))
  }

  const moveDown = (i: number) => {
    if (i === items.length - 1) return
    const next = [...items]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    applyItems(next.map((x, idx) => ({ ...x, sort_order: idx })))
  }

  return (
    <div className="w-full min-w-0 space-y-12">
      <input
        ref={fileRef}
        type="file"
        accept="image/webp,image/jpeg,image/png,image/avif"
        className="hidden"
        onChange={handleAddFile}
      />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-white/80 px-3 py-4 text-center text-xs text-slate-500">
          Carica una foto per compilare etichetta, titolo, icona e descrizione della slide.
        </p>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-5">
          {items.map((item, i) => (
            <CarouselSlideEditorCard
              key={`${item.image_url}-${i}`}
              item={item}
              index={i}
              total={items.length}
              onPatch={(patch) => patchItem(i, patch)}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
              onRemove={() => void removeAt(i)}
              onReplacePhoto={(e) => void replaceAt(i, e)}
              replaceDisabled={uploading || !canUpload}
              hideMobileSlideLabel={firstSlideLabelInParentHeader && i === 0}
            />
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="md"
        type="button"
        disabled={uploading || !canUpload}
        onClick={() => fileRef.current?.click()}
        className="self-start"
      >
        <ImagePlus className="h-4 w-4" />
        {uploading ? 'Caricamento…' : `Aggiungi foto n ${items.length + 1}`}
      </Button>
    </div>
  )
}
