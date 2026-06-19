import { useState } from 'react'
import { toast } from 'react-toastify'
import { ImagePlus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { MENU_THEMES, type MenuThemeKey } from '@/features/public-menu/menuThemes'
import type { CarouselItem, MenuItem } from '@/types/menu'
import type { MenuCategoryRecord } from '../hooks/useMenuCategories'
import {
  isBookingCategoryPhotoUrl,
  menuQrCategoryPhotoPath,
  menuQrStoragePrefix,
  menuQrStorageSegment,
} from '../utils/menuQrStorage'
import {
  removeMenuPhotoPath,
  storagePathFromMenuPhotoUrl,
  uploadMenuPhotoFile,
  useCarouselPhotoUpload,
} from '@/features/booking/hooks/useCarouselPhotoUpload'
import { AdminFieldWithCharCount } from './settings/AdminFieldWithCharCount'
import {
  defaultIconKeyForCategory,
  isMenuQrCategoryIconKey,
  MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
  type MenuQrCategoryIconKey,
} from '@/features/public-menu/categoryIcons'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'
import { MenuCategoryIconPicker } from '@/features/public-menu/MenuCategoryIconPicker'

export const CAROUSEL_SLIDE_TITLE_MAX = 60
export const CAROUSEL_SLIDE_DESCRIPTION_MAX = 125
export const CAROUSEL_SLIDE_EYEBROW_MAX = 40
export const CAROUSEL_SLIDE_EYEBROW_PLACEHOLDER = 'Esempio: Specialità della casa'

// Cap titolo/descrizione card categoria per-QR (FU-MQR-1). Stesso principio anti-rottura
// mobile del carosello: il titolo vive nello spazio del nome categoria (card "senza foto"
// 30/70), la descrizione nella riga sotto al titolo dentro la fascia header. Vedi
// docs/Menu-QR-Skill/contesto/MENU_QR_TEXT_LIMITS_MAP.md.
export const QR_CATEGORY_TITLE_MAX = 30
export const QR_CATEGORY_DESCRIPTION_MAX = 70

export function MenuQrThemeSection({
  value,
  onChange,
}: {
  value: MenuThemeKey
  onChange: (k: MenuThemeKey) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {Object.values(MENU_THEMES).map((theme) => (
        <label
          key={theme.key}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
        >
          <input
            type="radio"
            name="menu-theme"
            value={theme.key}
            checked={value === theme.key}
            onChange={() => onChange(theme.key)}
            className="h-4 w-4 shrink-0"
          />
          <span
            className="h-5 w-5 shrink-0 rounded-full border border-gray-200"
            style={{ background: theme.accentColor }}
          />
          <span className="text-sm text-gray-800">{theme.label}</span>
        </label>
      ))}
    </div>
  )
}

const carouselAddPhotoButtonClass = 'gap-1.5 text-xs'

export function MenuQrCarouselSection({
  tenantId,
  menuQrCodeId,
  draftShortCode,
  items,
  onChange,
}: {
  tenantId: string
  menuQrCodeId: string | null
  draftShortCode: string | null
  items: CarouselItem[]
  onChange: (items: CarouselItem[]) => void
}) {
  const [slideToRemove, setSlideToRemove] = useState<number | null>(null)
  const storageSegment = menuQrStorageSegment(menuQrCodeId, draftShortCode)
  const { fileRef, uploading, canUpload, handleAddFile } = useCarouselPhotoUpload({
    storagePrefix: storageSegment ? menuQrStoragePrefix(tenantId, storageSegment) : null,
    items,
    onChange,
  })

  const moveUp = (i: number) => {
    if (i === 0) return
    const next = [...items]
    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
    onChange(next.map((x, idx) => ({ ...x, sort_order: idx })))
  }

  const moveDown = (i: number) => {
    if (i === items.length - 1) return
    const next = [...items]
    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
    onChange(next.map((x, idx) => ({ ...x, sort_order: idx })))
  }

  const remove = async (i: number) => {
    const item = items[i]
    const path = storagePathFromMenuPhotoUrl(item.image_url)
    if (path) await removeMenuPhotoPath(path)
    onChange(items.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, sort_order: idx })))
    setSlideToRemove(null)
  }

  const updateField = (i: number, field: 'eyebrow' | 'title' | 'description', value: string) => {
    const maxLen =
      field === 'title'
        ? CAROUSEL_SLIDE_TITLE_MAX
        : field === 'description'
          ? CAROUSEL_SLIDE_DESCRIPTION_MAX
          : CAROUSEL_SLIDE_EYEBROW_MAX
    const clipped = value.slice(0, maxLen)
    onChange(items.map((x, idx) => (idx === i ? { ...x, [field]: clipped || undefined } : x)))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <input
          ref={fileRef}
          type="file"
          accept="image/webp,image/jpeg,image/png,image/avif"
          className="hidden"
          onChange={handleAddFile}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={uploading || !canUpload}
          onClick={() => fileRef.current?.click()}
          className={carouselAddPhotoButtonClass}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          {uploading ? 'Caricamento…' : 'Aggiungi foto'}
        </Button>
      </div>

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-xs text-gray-400">
          Nessuna foto. Nella homepage il carosello mostrerà uno spazio vuoto con il colore del tema.
        </p>
      )}

      {items.map((item, i) => (
        <div
          key={item.image_url}
          className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3"
        >
          <div className="flex items-center gap-3">
            <img src={item.image_url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
            <div className="flex shrink-0 flex-col gap-0.5">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => moveUp(i)}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Sposta su"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => moveDown(i)}
                className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                aria-label="Sposta giù"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSlideToRemove(i)}
              className="ml-auto shrink-0 rounded p-1 text-red-400 hover:text-red-600"
              aria-label="Rimuovi"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <AdminFieldWithCharCount
            id={`qr-carousel-eyebrow-${i}`}
            label="Etichetta"
            value={item.eyebrow ?? ''}
            maxLength={CAROUSEL_SLIDE_EYEBROW_MAX}
            onChange={(value) => updateField(i, 'eyebrow', value)}
            placeholder={CAROUSEL_SLIDE_EYEBROW_PLACEHOLDER}
            singleLine
          />
          <AdminFieldWithCharCount
            id={`qr-carousel-title-${i}`}
            label="Titolo slide"
            value={item.title ?? ''}
            maxLength={CAROUSEL_SLIDE_TITLE_MAX}
            onChange={(value) => updateField(i, 'title', value)}
            placeholder="Es. Tonno in crosta"
            singleLine
          />
          <AdminFieldWithCharCount
            id={`qr-carousel-desc-${i}`}
            label="Descrizione breve"
            value={item.description ?? ''}
            maxLength={CAROUSEL_SLIDE_DESCRIPTION_MAX}
            onChange={(value) => updateField(i, 'description', value)}
            placeholder="Testo breve (opzionale)"
            singleLine
          />
        </div>
      ))}

      <Modal
        isOpen={slideToRemove !== null}
        onClose={() => setSlideToRemove(null)}
        title="Elimina slide"
        size="sm"
      >
        <p className="text-sm text-gray-600">Eliminare questa slide?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setSlideToRemove(null)}>
            Annulla
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => slideToRemove !== null && void remove(slideToRemove)}
          >
            Elimina
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export type CategoryOverrideDraft = Record<
  string,
  { title: string; description: string; icon?: string | null }
>

const MENU_QR_FIELD_CLASS =
  'w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 outline-none'

/** Applica l'override ordine piatti per-QR sul display UI. */
function applyItemSortForUi(items: MenuItem[], overrideIds: string[] | null | undefined): MenuItem[] {
  if (!overrideIds || overrideIds.length === 0) return items
  const posMap = new Map(overrideIds.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const pa = posMap.get(a.id) ?? Infinity
    const pb = posMap.get(b.id) ?? Infinity
    return pa - pb
  })
}

export function MenuQrHiddenItemsPicker({
  categoryLabel,
  items,
  hiddenItemIds,
  onHiddenItemIdsChange,
  itemSortOverride,
  onItemSortOverrideChange,
}: {
  categoryLabel: string
  items: MenuItem[]
  hiddenItemIds: string[]
  onHiddenItemIdsChange: (ids: string[]) => void
  itemSortOverride?: string[] | null
  onItemSortOverrideChange?: (ids: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const hiddenSet = new Set(hiddenItemIds)
  const sortedItems = applyItemSortForUi(items, itemSortOverride)

  const toggleItem = (itemId: string) => {
    if (hiddenSet.has(itemId)) {
      onHiddenItemIdsChange(hiddenItemIds.filter((id) => id !== itemId))
    } else {
      onHiddenItemIdsChange([...hiddenItemIds, itemId])
    }
  }

  const moveItem = (index: number, direction: -1 | 1) => {
    if (!onItemSortOverrideChange) return
    const j = index + direction
    if (j < 0 || j >= sortedItems.length) return
    const next = [...sortedItems]
    ;[next[index], next[j]] = [next[j], next[index]]
    onItemSortOverrideChange(next.map((i) => i.id))
  }

  const hasOrdering = !!onItemSortOverrideChange

  return (
    <div className={MENU_QR_FIELD_CLASS}>
      <button
        type="button"
        className="is-clickable flex w-full items-center justify-between gap-2 text-left hover:text-gray-900"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="min-w-0 truncate">
          {hasOrdering ? 'Visibilità e ordine ingredienti' : 'Scegli quali ingredienti non mostrare'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2">
          {sortedItems.map((item, index) => {
            const isHidden = hiddenSet.has(item.id)
            return (
              <div
                key={item.id}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700" title={item.name}>
                  {item.name}
                </span>
                {hasOrdering && (
                  <div className="flex shrink-0 flex-col gap-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, -1)}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label={`Sposta ${item.name} su`}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedItems.length - 1}
                      onClick={() => moveItem(index, 1)}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                      aria-label={`Sposta ${item.name} giù`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="is-clickable shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label={
                    isHidden
                      ? `Mostra ${item.name} nel menu QR ${categoryLabel}`
                      : `Nascondi ${item.name} dal menu QR ${categoryLabel}`
                  }
                  onClick={() => toggleItem(item.id)}
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function MenuQrCategoryCardsSection({
  tenantId,
  menuQrCodeId,
  draftShortCode,
  categories,
  categoryImages,
  overrideDrafts,
  onCategoryImagesChange,
  onOverrideDraftsChange,
  itemsByCategory,
  hiddenItemIds,
  onHiddenItemIdsChange,
  itemSortOverrides,
  onItemSortOverridesChange,
  onMoveCategoryUp,
  onMoveCategoryDown,
}: {
  tenantId: string
  menuQrCodeId: string | null
  draftShortCode: string | null
  categories: MenuCategoryRecord[]
  categoryImages: Record<string, string>
  overrideDrafts: CategoryOverrideDraft
  onCategoryImagesChange: (images: Record<string, string>) => void
  onOverrideDraftsChange: (drafts: CategoryOverrideDraft) => void
  itemsByCategory: Record<string, MenuItem[]>
  hiddenItemIds: string[]
  onHiddenItemIdsChange: (ids: string[]) => void
  itemSortOverrides: Record<string, string[]>
  onItemSortOverridesChange: (overrides: Record<string, string[]>) => void
  onMoveCategoryUp: (categoryKey: string) => void
  onMoveCategoryDown: (categoryKey: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [photoToRemove, setPhotoToRemove] = useState<string | null>(null)
  const storageSegment = menuQrStorageSegment(menuQrCodeId, draftShortCode)
  const canUpload = !!storageSegment

  const handleFile = async (catKey: string, file: File) => {
    if (!storageSegment) return
    setUploading(catKey)
    try {
      const path = `${menuQrStoragePrefix(tenantId, storageSegment)}/cat/${catKey}.webp`
      const url = await uploadMenuPhotoFile(file, path)
      onCategoryImagesChange({ ...categoryImages, [catKey]: url })
      toast.success('Foto categoria salvata')
    } catch {
      toast.error('Errore caricamento foto')
    } finally {
      setUploading(null)
    }
  }

  const removeCategoryPhoto = async (catKey: string) => {
    const url = categoryImages[catKey]
    if (storageSegment && url && !isBookingCategoryPhotoUrl(url, tenantId)) {
      await removeMenuPhotoPath(menuQrCategoryPhotoPath(tenantId, storageSegment, catKey))
    }
    const next = { ...categoryImages }
    delete next[catKey]
    onCategoryImagesChange(next)
    setPhotoToRemove(null)
  }

  if (categories.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        Riattiva almeno una categoria sopra per personalizzare titoli, foto e visibilità ingredienti.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat, index) => {
        const imgUrl = categoryImages[cat.key]
        const isUp = uploading === cat.key
        const draft = overrideDrafts[cat.key] ?? {
          title: cat.label,
          description: cat.description ?? '',
          icon: defaultIconKeyForCategory(cat.key) ?? MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
        }
        return (
          <div
            key={cat.key}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {cat.label}
              </span>
              {categories.length > 1 ? (
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveCategoryUp(cat.key)}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Sposta su"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === categories.length - 1}
                    onClick={() => onMoveCategoryDown(cat.key)}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Sposta giù"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-600">Foto categoria</p>
              <div className="flex items-center gap-3">
                {imgUrl ? (
                  <img src={imgUrl} alt={cat.label} className="h-12 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div
                    className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500"
                    aria-hidden
                  >
                    <MenuQrCategoryIconGlyph
                      iconKey={draft.icon}
                      categoryKey={cat.key}
                      className="h-6 w-6"
                    />
                  </div>
                )}
                <label className={canUpload ? 'is-clickable shrink-0' : 'shrink-0 opacity-50'}>
                  <input
                    type="file"
                    accept="image/webp,image/jpeg,image/png,image/avif"
                    className="hidden"
                    disabled={isUp || !canUpload}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) void handleFile(cat.key, f)
                    }}
                  />
                  <span className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-gray-500">
                    {isUp ? 'Upload…' : imgUrl ? 'Cambia' : 'Carica'}
                  </span>
                </label>
                {imgUrl && canUpload && (
                  <button
                    type="button"
                    onClick={() => setPhotoToRemove(cat.key)}
                    className="shrink-0 rounded p-1 text-red-400 hover:text-red-600"
                    aria-label={`Rimuovi foto ${cat.label}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {!imgUrl ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600">Icona categoria (senza foto)</p>
                <MenuCategoryIconPicker
                  value={
                    (draft.icon ??
                      defaultIconKeyForCategory(cat.key) ??
                      MENU_QR_DEFAULT_CATEGORY_ICON_KEY) as MenuQrCategoryIconKey
                  }
                  onChange={(icon) =>
                    onOverrideDraftsChange({
                      ...overrideDrafts,
                      [cat.key]: { ...draft, icon },
                    })
                  }
                  ariaLabel={`Icona per ${cat.label}`}
                />
              </div>
            ) : null}
            <AdminFieldWithCharCount
              id={`qr-cat-title-${cat.key}`}
              label="Titolo card"
              value={draft.title}
              maxLength={QR_CATEGORY_TITLE_MAX}
              onChange={(value) =>
                onOverrideDraftsChange({
                  ...overrideDrafts,
                  [cat.key]: { ...draft, title: value },
                })
              }
              placeholder={`Default: "${cat.label}"`}
              singleLine
            />
            <AdminFieldWithCharCount
              id={`qr-cat-desc-${cat.key}`}
              label="Descrizione breve"
              value={draft.description}
              maxLength={QR_CATEGORY_DESCRIPTION_MAX}
              onChange={(value) =>
                onOverrideDraftsChange({
                  ...overrideDrafts,
                  [cat.key]: { ...draft, description: value },
                })
              }
              placeholder="Descrizione breve (opzionale)"
              singleLine
            />
            <MenuQrHiddenItemsPicker
              categoryLabel={cat.label}
              items={itemsByCategory[cat.key] ?? []}
              hiddenItemIds={hiddenItemIds}
              onHiddenItemIdsChange={onHiddenItemIdsChange}
              itemSortOverride={itemSortOverrides[cat.key]}
              onItemSortOverrideChange={(ids) =>
                onItemSortOverridesChange({ ...itemSortOverrides, [cat.key]: ids })
              }
            />
          </div>
        )
      })}

      <Modal
        isOpen={photoToRemove !== null}
        onClose={() => setPhotoToRemove(null)}
        title="Rimuovi foto categoria"
        size="sm"
      >
        <p className="text-sm text-gray-600">Rimuovere la foto di questa categoria?</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setPhotoToRemove(null)}>
            Annulla
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => photoToRemove !== null && void removeCategoryPhoto(photoToRemove)}
          >
            Rimuovi
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/** Hook helper per inizializzare draft override da categorie DB + override salvati. */
export function buildCategoryOverrideDrafts(
  categories: MenuCategoryRecord[],
  overrides: {
    category_key: string
    title: string | null
    description: string | null
    icon?: string | null
  }[],
): CategoryOverrideDraft {
  const overrideMap = Object.fromEntries(overrides.map((o) => [o.category_key, o]))
  const initial: CategoryOverrideDraft = {}
  for (const cat of categories) {
    const ov = overrideMap[cat.key]
    const savedIcon = ov?.icon?.trim()
    initial[cat.key] = {
      title: ov?.title ?? cat.label ?? '',
      description: ov?.description ?? cat.description ?? '',
      icon:
        savedIcon && isMenuQrCategoryIconKey(savedIcon)
          ? savedIcon
          : (defaultIconKeyForCategory(cat.key) ?? MENU_QR_DEFAULT_CATEGORY_ICON_KEY),
    }
  }
  return initial
}
