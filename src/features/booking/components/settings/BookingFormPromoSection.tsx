import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Edit, Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import { BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS } from '@/features/booking/constants/bookingPrenotaTextLimits'
import {
  applyMenuPromoWithReplacement,
  dedupeBookingTypes,
  dedupeSubTabRefs,
  findMenuPromoPlacementConflicts,
  getMenuPromoAdminLabel,
  hasMenuPromoPlacementConflicts,
  isMenuPromoVisibleOnBooking,
  MENU_PROMO_BOOKING_TYPE_OPTIONS,
  MENU_PROMO_PLACEHOLDER,
  normalizeMenuPromoPlacement,
  normalizeMenuPromosList,
  subTabRefKey,
  validateMenuPromoUniqueness,
  type MenuPromo,
  type MenuPromoPlacementConflicts,
  type MenuPromoSubTabRef,
} from '@/features/booking/constants/menuPromo'
import { useRestaurantSetting, useUpsertRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import type { BookingType } from '@/types/booking'
import { cn } from '@/lib/utils'

/** Riferimento stabile: `data ?? []` inline crea un array nuovo a ogni render → loop in useEffect sync. */
const EMPTY_MENU_PROMOS: MenuPromo[] = []

export type BookingFormPromoSectionHandle = {
  save: () => Promise<void>
  cancel: () => void
  isDirty: () => boolean
}

type BookingFormPromoSectionProps = {
  bookingModes: BookingMode[]
  onDirtyChange?: (dirty: boolean) => void
}

type EditorMode = 'list' | 'editor'

type SubTabOption = {
  ref: MenuPromoSubTabRef
  label: string
  display: 'cards' | 'carousel'
}

function SubTabPromoPickerGroup({
  title,
  options,
  draftSubTabRefs,
  onToggle,
}: {
  title: string
  options: SubTabOption[]
  draftSubTabRefs: MenuPromoSubTabRef[]
  onToggle: (ref: MenuPromoSubTabRef) => void
}) {
  if (options.length === 0) return null

  return (
    <div className="space-y-1">
      <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {options.map((opt) => {
        const key = subTabRefKey(opt.ref)
        const checked = draftSubTabRefs.some((r) => subTabRefKey(r) === key)
        return (
          <label
            key={key}
            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400"
              checked={checked}
              onChange={() => onToggle(opt.ref)}
            />
            <span className="text-slate-700">{opt.label}</span>
          </label>
        )
      })}
    </div>
  )
}

function formatPromoPlacementSummary(promo: MenuPromo, subTabOptions: SubTabOption[]): string {
  if (promo.placement === 'booking_type' && promo.booking_types?.length) {
    const labels = promo.booking_types.map((bt) => {
      const opt = MENU_PROMO_BOOKING_TYPE_OPTIONS.find((o) => o.value === bt)
      return opt?.label ?? bt
    })
    return labels.join(', ')
  }
  if (promo.placement === 'sub_tab' && promo.sub_tab_refs?.length) {
    const count = promo.sub_tab_refs.length
    if (count === 1) {
      const key = subTabRefKey(promo.sub_tab_refs[0])
      const match = subTabOptions.find((o) => subTabRefKey(o.ref) === key)
      return match?.label ?? '1 card / carosello'
    }
    const modeIds = new Set(promo.sub_tab_refs.map((r) => r.mode_id))
    const modeLabel =
      modeIds.size === 1
        ? subTabOptions.find((o) => o.ref.mode_id === promo.sub_tab_refs![0].mode_id)?.label.split(' · ')[0]
        : null
    return modeLabel ? `${count} card · ${modeLabel}` : `${count} card / caroselli`
  }
  return 'Nessun abbinamento'
}

function PromoPlacementConflictDialog({
  draft,
  conflicts,
  resolveSubTabLabel,
  onCancel,
  onConfirm,
}: {
  draft: MenuPromo
  conflicts: MenuPromoPlacementConflicts
  resolveSubTabLabel: (ref: MenuPromoSubTabRef) => string
  onCancel: () => void
  onConfirm: () => void
}) {
  const draftLabel = getMenuPromoAdminLabel(draft)
  const hasBookingTypes = conflicts.bookingTypes.length > 0
  const hasSubTabs = conflicts.subTabs.length > 0

  const introText =
    hasBookingTypes && !hasSubTabs
      ? 'Esistono altre promo associate a queste tipologie di prenotazioni scelte:'
      : !hasBookingTypes && hasSubTabs
        ? 'Esistono altre promo associate a queste card o caroselli scelti:'
        : 'Esistono altre promo associate agli abbinamenti scelti:'

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Abbinamento già in uso"
      size="md"
      closeOnOverlayClick={false}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{introText}</p>
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-800">
          {conflicts.bookingTypes.map((conflict) => {
            const typeLabel =
              MENU_PROMO_BOOKING_TYPE_OPTIONS.find((o) => o.value === conflict.type)?.label ??
              conflict.type
            return (
              <li key={conflict.type}>
                · <span className="font-medium">{typeLabel}</span> → «{conflict.existingLabel}»
              </li>
            )
          })}
          {conflicts.subTabs.map((conflict) => {
            const refLabel = resolveSubTabLabel(conflict.ref)
            const key = subTabRefKey(conflict.ref)
            return (
              <li key={key}>
                · <span className="font-medium">{refLabel}</span> → «{conflict.existingLabel}»
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-slate-700">
          Sostituire con «{draftLabel}»?
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            Sostituisci
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export const BookingFormPromoSection = forwardRef<BookingFormPromoSectionHandle, BookingFormPromoSectionProps>(
  function BookingFormPromoSection({ bookingModes, onDirtyChange }, ref) {
    const { data: savedPromosRaw } = useRestaurantSetting('booking_menu_promos')
    const savedPromos = savedPromosRaw ?? EMPTY_MENU_PROMOS
    const upsert = useUpsertRestaurantSetting()

    const [promos, setPromos] = useState<MenuPromo[]>([])
    const [dirty, setDirty] = useState(false)
    const dirtyRef = useRef(false)
    dirtyRef.current = dirty

    const [editorMode, setEditorMode] = useState<EditorMode>('list')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [draftLabel, setDraftLabel] = useState('')
    const [draftMessage, setDraftMessage] = useState('')
    const [draftBookingTypes, setDraftBookingTypes] = useState<BookingType[]>([])
    const [draftSubTabRefs, setDraftSubTabRefs] = useState<MenuPromoSubTabRef[]>([])
    const [conflictDialog, setConflictDialog] = useState<{
      row: MenuPromo
      conflicts: MenuPromoPlacementConflicts
    } | null>(null)

    const subTabOptions = useMemo((): SubTabOption[] => {
      const options: SubTabOption[] = []
      for (const mode of bookingModes) {
        if (!mode.sub_tabs_enabled || !mode.sub_tabs?.length) continue
        mode.sub_tabs.forEach((tab, idx) => {
          const tabTitle =
            tab.display === 'carousel'
              ? tab.label?.trim() || `Carosello ${idx + 1}`
              : tab.label?.trim()
                ? `${tab.label.trim()} · Card ${idx + 1}`
                : `Card ${idx + 1}`
          options.push({
            ref: { mode_id: mode.id, sub_tab_id: tab.id },
            label: `${mode.label?.trim() || mode.booking_type} · ${tabTitle}`,
            display: tab.display === 'carousel' ? 'carousel' : 'cards',
          })
        })
      }
      return options
    }, [bookingModes])

    const cardSubTabOptions = useMemo(
      () => subTabOptions.filter((o) => o.display === 'cards'),
      [subTabOptions],
    )
    const carouselSubTabOptions = useMemo(
      () => subTabOptions.filter((o) => o.display === 'carousel'),
      [subTabOptions],
    )

    useEffect(() => {
      if (!dirty) {
        setPromos(savedPromos)
      }
    }, [savedPromos, dirty])

    useEffect(() => {
      onDirtyChange?.(dirty)
    }, [dirty, onDirtyChange])

    const markDirty = () => setDirty(true)

    const resetEditorDraft = () => {
      setEditorMode('list')
      setEditingId(null)
      setDraftLabel('')
      setDraftMessage('')
      setDraftBookingTypes([])
      setDraftSubTabRefs([])
    }

    const startNewPromo = () => {
      resetEditorDraft()
      setEditorMode('editor')
    }

    const startEditPromo = (row: MenuPromo) => {
      setEditingId(row.id)
      setDraftLabel(row.label ?? '')
      setDraftMessage(row.message)
      setDraftBookingTypes(row.placement === 'booking_type' ? row.booking_types ?? [] : [])
      setDraftSubTabRefs(row.placement === 'sub_tab' ? row.sub_tab_refs ?? [] : [])
      setEditorMode('editor')
    }

    const clearAllSubTabRefs = () => {
      setDraftSubTabRefs([])
    }

    const toggleDraftBookingType = (bt: BookingType) => {
      setDraftSubTabRefs([])
      setDraftBookingTypes((prev) =>
        prev.includes(bt) ? prev.filter((x) => x !== bt) : dedupeBookingTypes([...prev, bt]),
      )
    }

    const toggleDraftSubTabRef = (ref: MenuPromoSubTabRef) => {
      setDraftBookingTypes([])
      const key = subTabRefKey(ref)
      setDraftSubTabRefs((prev) => {
        const exists = prev.some((r) => subTabRefKey(r) === key)
        if (exists) return prev.filter((r) => subTabRefKey(r) !== key)
        return dedupeSubTabRefs([...prev, ref])
      })
    }

    const selectAllBookingTypes = () => {
      setDraftSubTabRefs([])
      setDraftBookingTypes(MENU_PROMO_BOOKING_TYPE_OPTIONS.map((o) => o.value))
    }

    const clearAllBookingTypes = () => {
      setDraftBookingTypes([])
    }

    const selectAllSubTabRefs = (options: SubTabOption[]) => {
      setDraftBookingTypes([])
      setDraftSubTabRefs(dedupeSubTabRefs(options.map((o) => o.ref)))
    }

    const buildDraftRow = (): MenuPromo | null => {
      const trimmedLabel = draftLabel.trim()
      const trimmedMessage = draftMessage.trim()
      if (!trimmedLabel) {
        toast.error('Inserisci il nome della promozione')
        return null
      }
      if (!trimmedMessage) {
        toast.error('Inserisci il testo della promozione')
        return null
      }

      const base: MenuPromo = {
        id: editingId ?? crypto.randomUUID(),
        label: trimmedLabel,
        message: trimmedMessage,
        placement: 'none',
        visible_on_booking: true,
      }

      const types = dedupeBookingTypes(draftBookingTypes)
      const refs = dedupeSubTabRefs(draftSubTabRefs)

      if (types.length > 0 && refs.length > 0) {
        toast.error('Scegli tipologie oppure card/carosello per questa promo, non entrambi.')
        return null
      }

      if (refs.length > 0) {
        return normalizeMenuPromoPlacement({
          ...base,
          placement: 'sub_tab',
          sub_tab_refs: refs,
        })
      }
      if (types.length > 0) {
        return normalizeMenuPromoPlacement({
          ...base,
          placement: 'booking_type',
          booking_types: types,
        })
      }
      return normalizeMenuPromoPlacement({ ...base, placement: 'none' })
    }

    const resolveSubTabLabel = (ref: MenuPromoSubTabRef): string => {
      const key = subTabRefKey(ref)
      return subTabOptions.find((o) => subTabRefKey(o.ref) === key)?.label ?? key
    }

    const commitDraftToPromos = (next: MenuPromo[]) => {
      const uniqueness = validateMenuPromoUniqueness(next)
      if (!uniqueness.ok) {
        toast.error(uniqueness.message)
        return false
      }
      setPromos(next)
      markDirty()
      resetEditorDraft()
      return true
    }

    const applyEditorToList = () => {
      const row = buildDraftRow()
      if (!row) return false

      const excludeId = editingId ?? undefined
      const conflicts = findMenuPromoPlacementConflicts(row, promos, excludeId)

      if (hasMenuPromoPlacementConflicts(conflicts)) {
        setConflictDialog({ row, conflicts })
        return false
      }

      const next =
        excludeId !== undefined
          ? promos.map((p) => (p.id === excludeId ? row : p))
          : [...promos, row]

      return commitDraftToPromos(next)
    }

    const confirmConflictReplacement = () => {
      if (!conflictDialog) return
      const excludeId = editingId ?? undefined
      const next = applyMenuPromoWithReplacement(conflictDialog.row, promos, excludeId)
      if (commitDraftToPromos(next)) {
        setConflictDialog(null)
      }
    }

    const cancelConflictReplacement = () => {
      setConflictDialog(null)
    }

    const handleDeletePromo = (promoId: string, summary: string) => {
      if (!window.confirm(`Eliminare la promo «${summary}»?`)) return
      setPromos(promos.filter((p) => p.id !== promoId))
      markDirty()
      if (editingId === promoId) resetEditorDraft()
    }

    const toggleVisibility = (promoId: string) => {
      setPromos(
        promos.map((p) =>
          p.id === promoId ? { ...p, visible_on_booking: !isMenuPromoVisibleOnBooking(p) } : p,
        ),
      )
      markDirty()
    }

    const saveSection = async () => {
      const normalized = normalizeMenuPromosList(promos)
      const uniqueness = validateMenuPromoUniqueness(normalized)
      if (!uniqueness.ok) {
        toast.error(uniqueness.message)
        throw new Error(uniqueness.message)
      }
      await upsert.mutateAsync([{ key: 'booking_menu_promos', value: normalized }])
      setPromos(normalized)
      setDirty(false)
      resetEditorDraft()
      toast.success('Messaggi promozionali salvati')
    }

    const cancelSection = () => {
      setPromos(savedPromos)
      setDirty(false)
      resetEditorDraft()
    }

    useImperativeHandle(ref, () => ({
      save: saveSection,
      cancel: cancelSection,
      isDirty: () => dirtyRef.current,
    }))

    return (
      <>
        {conflictDialog ? (
          <PromoPlacementConflictDialog
            draft={conflictDialog.row}
            conflicts={conflictDialog.conflicts}
            resolveSubTabLabel={resolveSubTabLabel}
            onCancel={cancelConflictReplacement}
            onConfirm={confirmConflictReplacement}
          />
        ) : null}
        <section className="admin-warm-surface rounded-xl border p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Messaggio Promozionale</h3>
            <p className="mt-1 text-xs text-slate-600">
              Crea messaggi promo per la pagina Prenota. Abbinamento opzionale: spunta zero, una, due o tutte le voci che vuoi.
            </p>
          </div>

          {editorMode === 'list' && (
            <div className="flex justify-end">
              <Button
                variant="success"
                size="sm"
                type="button"
                onClick={startNewPromo}
                disabled={upsert.isPending}
                className="h-9 gap-1.5 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuova promo
              </Button>
            </div>
          )}

          {editorMode === 'editor' && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-white/70 p-4">
              <div>
                <label htmlFor="promo-label" className="mb-1 block text-xs font-semibold text-slate-600">
                  Nome promo (admin)
                </label>
                <Input
                  id="promo-label"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  placeholder="Es. Promo estate 2026"
                  maxLength={BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.promoTitle}
                  className="h-10"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {draftLabel.length}/{BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.promoTitle}
                </p>
              </div>

              <div>
                <label htmlFor="promo-message" className="mb-1 block text-xs font-semibold text-slate-600">
                  Testo promo (Prenota)
                </label>
                <Textarea
                  id="promo-message"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder={MENU_PROMO_PLACEHOLDER}
                  rows={4}
                  maxLength={BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.promoMessage}
                  className="text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  {draftMessage.length}/{BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.promoMessage}
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Tipologie di prenotazione</p>
                  <p className="mt-0.5 text-xs text-slate-500">Opzionale — nessuna, una, due o tutte e tre.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary-700 hover:underline"
                    onClick={selectAllBookingTypes}
                  >
                    Seleziona tutte
                  </button>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-600 hover:underline"
                    onClick={clearAllBookingTypes}
                  >
                    Deseleziona tutte
                  </button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {MENU_PROMO_BOOKING_TYPE_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-400"
                        checked={draftBookingTypes.includes(value)}
                        onChange={() => toggleDraftBookingType(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 bg-white/80 p-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Card e caroselli</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Opzionale — alternativo alle tipologie: nessuna, una o più card/caroselli.
                  </p>
                </div>
                {subTabOptions.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    Nessuna card o carosello configurato. Aggiungine uno in «Modalità di prenotazione».
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {cardSubTabOptions.length > 0 && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary-700 hover:underline"
                          onClick={() => selectAllSubTabRefs(cardSubTabOptions)}
                        >
                          Tutte le card
                        </button>
                      )}
                      {carouselSubTabOptions.length > 0 && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary-700 hover:underline"
                          onClick={() => selectAllSubTabRefs(carouselSubTabOptions)}
                        >
                          Tutti i caroselli
                        </button>
                      )}
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        className="text-xs font-medium text-slate-600 hover:underline"
                        onClick={clearAllSubTabRefs}
                      >
                        Deseleziona tutte
                      </button>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                      <SubTabPromoPickerGroup
                        title="Card"
                        options={cardSubTabOptions}
                        draftSubTabRefs={draftSubTabRefs}
                        onToggle={toggleDraftSubTabRef}
                      />
                      {cardSubTabOptions.length > 0 && carouselSubTabOptions.length > 0 ? (
                        <div className="border-t border-slate-200" role="separator" aria-hidden="true" />
                      ) : null}
                      <SubTabPromoPickerGroup
                        title="Carosello"
                        options={carouselSubTabOptions}
                        draftSubTabRefs={draftSubTabRefs}
                        onToggle={toggleDraftSubTabRef}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetEditorDraft}>
                  Annulla
                </Button>
                <Button type="button" size="sm" onClick={() => applyEditorToList()}>
                  {editingId ? 'Applica modifiche' : 'Aggiungi alla lista'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {promos.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-600">
                Nessuna promo configurata.
              </p>
            ) : (
              promos.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{getMenuPromoAdminLabel(row)}</p>
                    {row.message.trim() ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{row.message.trim()}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">{formatPromoPlacementSummary(row, subTabOptions)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEditPromo(row)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                      aria-label="Modifica promo"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-pressed={isMenuPromoVisibleOnBooking(row)}
                      disabled={upsert.isPending}
                      onClick={() => toggleVisibility(row.id)}
                      className={cn(
                        'inline-flex h-9 w-9 items-center justify-center rounded-lg border',
                        isMenuPromoVisibleOnBooking(row)
                          ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          : 'border-slate-200 text-slate-400 hover:bg-slate-50',
                      )}
                      aria-label={
                        isMenuPromoVisibleOnBooking(row)
                          ? 'Nascondi nella pagina Prenota'
                          : 'Mostra nella pagina Prenota'
                      }
                    >
                      {isMenuPromoVisibleOnBooking(row) ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(row.id, getMenuPromoAdminLabel(row))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                      aria-label="Elimina promo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </>
    )
  },
)
