import type { BookingType } from '@/types/booking'

/** Placeholder textarea editor promo in Personalizza form. */
export const MENU_PROMO_PLACEHOLDER = 'Inserisci una promo'

export type MenuPromoPlacement = 'none' | 'booking_type' | 'sub_tab'

export interface MenuPromoSubTabRef {
  mode_id: string
  sub_tab_id: string
}

/** Promo banner configurabile dall'admin (Pagina Prenota pubblica). */
export interface MenuPromo {
  id: string
  /** Nome interno admin (non mostrato al cliente in pagina Prenota). */
  label: string
  message: string
  placement: MenuPromoPlacement
  /** Tipologie abbinata/e, se `placement === 'booking_type'`. Valori unici, subset opzioni promo. */
  booking_types?: BookingType[]
  /** Sottotab abbinata/e, se `placement === 'sub_tab'`. Coppie uniche per promo. */
  sub_tab_refs?: MenuPromoSubTabRef[]
  /** Se `false`, non mostrata in pagina Prenota. */
  visible_on_booking?: boolean
}

/** Input legacy / misto da DB (pre e post migrazione array). */
export type LegacyMenuPromoRow = {
  id: string
  label?: string
  message: string
  placement?: MenuPromoPlacement
  booking_type?: BookingType
  booking_types?: BookingType[]
  sub_tab_ref?: MenuPromoSubTabRef
  sub_tab_refs?: MenuPromoSubTabRef[]
  visible_on_booking?: boolean
}

const VALID_BOOKING_TYPES = new Set<BookingType>(['tavolo', 'rinfresco_laurea', 'menu_prezzo_fisso'])

export function subTabRefKey(ref: MenuPromoSubTabRef): string {
  return `${ref.mode_id}:${ref.sub_tab_id}`
}

export function dedupeBookingTypes(types: BookingType[]): BookingType[] {
  const seen = new Set<BookingType>()
  const result: BookingType[] = []
  for (const t of types) {
    if (!VALID_BOOKING_TYPES.has(t) || seen.has(t)) continue
    seen.add(t)
    result.push(t)
  }
  return result
}

export function dedupeSubTabRefs(refs: MenuPromoSubTabRef[]): MenuPromoSubTabRef[] {
  const seen = new Set<string>()
  const result: MenuPromoSubTabRef[] = []
  for (const ref of refs) {
    if (!ref.mode_id?.trim() || !ref.sub_tab_id?.trim()) continue
    const key = subTabRefKey(ref)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ mode_id: ref.mode_id.trim(), sub_tab_id: ref.sub_tab_id.trim() })
  }
  return result
}

/** Anteprima breve del testo promo (fallback lista admin se manca il nome). */
export function menuPromoMessageSummary(message: string): string {
  const line = message.trim().split(/\n/)[0] ?? ''
  if (!line) return 'Promo senza testo'
  return line.length > 72 ? `${line.slice(0, 72)}…` : line
}

/** Etichetta admin: nome promo, oppure anteprima del testo per righe legacy senza nome. */
export function getMenuPromoAdminLabel(promo: MenuPromo): string {
  const label = promo.label?.trim()
  if (label) return label
  return menuPromoMessageSummary(promo.message)
}

/** Opzioni allineate al `<select booking_type>` del form pubblico. */
export const MENU_PROMO_BOOKING_TYPE_OPTIONS: { value: BookingType; label: string }[] = [
  { value: 'tavolo', label: 'Prenota un tavolo' },
  { value: 'rinfresco_laurea', label: 'Rinfresco di Laurea' },
  { value: 'menu_prezzo_fisso', label: 'Menu a prezzo fisso' },
]

export function isMenuPromoVisibleOnBooking(p: MenuPromo): boolean {
  return p.visible_on_booking !== false
}

/** Promo senza target validi → `placement: 'none'` (abbinamento opzionale). */
export function normalizeMenuPromoPlacement(promo: MenuPromo): MenuPromo {
  if (promo.placement === 'booking_type') {
    const types = dedupeBookingTypes(promo.booking_types ?? [])
    if (types.length === 0) {
      const { booking_types: _bt, sub_tab_refs: _st, ...rest } = promo
      return { ...rest, placement: 'none' }
    }
    return { ...promo, booking_types: types, sub_tab_refs: undefined }
  }

  if (promo.placement === 'sub_tab') {
    const refs = dedupeSubTabRefs(promo.sub_tab_refs ?? [])
    if (refs.length === 0) {
      const { booking_types: _bt, sub_tab_refs: _st, ...rest } = promo
      return { ...rest, placement: 'none' }
    }
    return { ...promo, sub_tab_refs: refs, booking_types: undefined }
  }

  const { booking_types: _bt, sub_tab_refs: _st, ...rest } = promo
  return { ...rest, placement: 'none' }
}

export function normalizeMenuPromosList(promos: MenuPromo[]): MenuPromo[] {
  return promos.map(normalizeMenuPromoPlacement)
}

export function promoMatchesBookingType(promo: MenuPromo, bookingType: BookingType): boolean {
  return (
    promo.placement === 'booking_type' &&
    (promo.booking_types ?? []).includes(bookingType)
  )
}

export function promoMatchesSubTab(promo: MenuPromo, modeId: string, subTabId: string): boolean {
  if (promo.placement !== 'sub_tab') return false
  return (promo.sub_tab_refs ?? []).some(
    (ref) => ref.mode_id === modeId && ref.sub_tab_id === subTabId,
  )
}

function normalizeMenuPromoRow(raw: LegacyMenuPromoRow): MenuPromo {
  const base = {
    id: raw.id,
    label: raw.label?.trim() ?? '',
    message: raw.message,
    ...(raw.visible_on_booking === false ? { visible_on_booking: false as const } : {}),
  }

  if (raw.placement === 'none') {
    return { ...base, placement: 'none' }
  }

  const subTabRefs = dedupeSubTabRefs([
    ...(raw.sub_tab_refs ?? []),
    ...(raw.sub_tab_ref ? [raw.sub_tab_ref] : []),
  ])

  const bookingTypes = dedupeBookingTypes([
    ...(raw.booking_types ?? []),
    ...(raw.booking_type ? [raw.booking_type] : []),
  ])

  if (raw.placement === 'sub_tab' || (raw.placement !== 'booking_type' && subTabRefs.length > 0 && bookingTypes.length === 0)) {
    if (subTabRefs.length > 0) {
      return { ...base, placement: 'sub_tab', sub_tab_refs: subTabRefs }
    }
  }

  if (raw.placement === 'booking_type' || bookingTypes.length > 0) {
    if (bookingTypes.length > 0) {
      return { ...base, placement: 'booking_type', booking_types: bookingTypes }
    }
  }

  return { ...base, placement: 'none' }
}

/**
 * Migrazione regola (A): per ogni tipologia/sottotab, la prima promo in ordine lista
 * mantiene il target; le promo successive perdono quel target. Se una promo non ha più
 * target → `placement: 'none'`.
 */
export function migrateMenuPromosFromLegacy(rawRows: unknown[]): MenuPromo[] {
  if (!Array.isArray(rawRows)) return []

  const normalized = rawRows
    .filter((row): row is LegacyMenuPromoRow => row != null && typeof row === 'object' && 'id' in row)
    .map(normalizeMenuPromoRow)

  const usedBookingTypes = new Set<BookingType>()
  const usedSubTabs = new Set<string>()

  return normalized.map((promo) => {
    if (promo.placement === 'booking_type' && promo.booking_types?.length) {
      const kept = promo.booking_types.filter((bt) => {
        if (usedBookingTypes.has(bt)) return false
        usedBookingTypes.add(bt)
        return true
      })
      if (kept.length === 0) {
        return normalizeMenuPromoPlacement({ ...promo, placement: 'none', booking_types: undefined })
      }
      return normalizeMenuPromoPlacement({ ...promo, booking_types: kept })
    }

    if (promo.placement === 'sub_tab' && promo.sub_tab_refs?.length) {
      const kept = promo.sub_tab_refs.filter((ref) => {
        const key = subTabRefKey(ref)
        if (usedSubTabs.has(key)) return false
        usedSubTabs.add(key)
        return true
      })
      if (kept.length === 0) {
        return normalizeMenuPromoPlacement({ ...promo, placement: 'none', sub_tab_refs: undefined })
      }
      return normalizeMenuPromoPlacement({ ...promo, sub_tab_refs: kept })
    }

    return normalizeMenuPromoPlacement(promo)
  })
}

export type MenuPromoUniquenessResult =
  | { ok: true }
  | { ok: false; message: string }

/** Unicità intra-promo (no duplicati negli array) e globale (max 1 promo per target). */
export function validateMenuPromoUniqueness(promos: MenuPromo[]): MenuPromoUniquenessResult {
  const globalBookingTypes = new Map<BookingType, string>()
  const globalSubTabs = new Map<string, string>()

  for (const raw of promos) {
    if (raw.placement === 'booking_type' && (raw.booking_types?.length ?? 0) > 0) {
      const types = raw.booking_types ?? []
      const uniqueTypes = new Set(types)
      if (uniqueTypes.size !== types.length) {
        return { ok: false, message: 'Non puoi selezionare la stessa tipologia più volte sulla stessa promo.' }
      }
    }

    if (raw.placement === 'sub_tab' && (raw.sub_tab_refs?.length ?? 0) > 0) {
      const refs = raw.sub_tab_refs ?? []
      const uniqueKeys = new Set(refs.map(subTabRefKey))
      if (uniqueKeys.size !== refs.length) {
        return { ok: false, message: 'Non puoi selezionare la stessa card/carosello più volte sulla stessa promo.' }
      }
    }

    const promo = normalizeMenuPromoPlacement(raw)

    if (promo.placement === 'booking_type') {
      const types = promo.booking_types ?? []

      for (const bt of types) {
        const existing = globalBookingTypes.get(bt)
        if (existing && existing !== promo.id) {
          const label = MENU_PROMO_BOOKING_TYPE_OPTIONS.find((o) => o.value === bt)?.label
          return {
            ok: false,
            message: `Esiste già una promo abbinata a «${label ?? bt}». Modifica o rimuovi l'abbinamento duplicato.`,
          }
        }
        globalBookingTypes.set(bt, promo.id)
      }
    }

    if (promo.placement === 'sub_tab') {
      const refs = promo.sub_tab_refs ?? []

      for (const ref of refs) {
        const key = subTabRefKey(ref)
        const existing = globalSubTabs.get(key)
        if (existing && existing !== promo.id) {
          return {
            ok: false,
            message: 'Esiste già una promo abbinata a una delle card/caroselli selezionate. Modifica o rimuovi l\'abbinamento duplicato.',
          }
        }
        globalSubTabs.set(key, promo.id)
      }
    }
  }

  return { ok: true }
}

export type MenuPromoBookingTypeConflict = {
  type: BookingType
  existingPromoId: string
  existingLabel: string
}

export type MenuPromoSubTabConflict = {
  ref: MenuPromoSubTabRef
  existingPromoId: string
  existingLabel: string
}

export type MenuPromoPlacementConflicts = {
  bookingTypes: MenuPromoBookingTypeConflict[]
  subTabs: MenuPromoSubTabConflict[]
}

/** Target in bozza già occupati da altre promo (esclusa `excludePromoId` in modifica). */
export function findMenuPromoPlacementConflicts(
  draft: MenuPromo,
  existing: MenuPromo[],
  excludePromoId?: string,
): MenuPromoPlacementConflicts {
  const normalizedDraft = normalizeMenuPromoPlacement(draft)
  const bookingTypes: MenuPromoBookingTypeConflict[] = []
  const subTabs: MenuPromoSubTabConflict[] = []

  const draftTypes =
    normalizedDraft.placement === 'booking_type' ? (normalizedDraft.booking_types ?? []) : []
  const draftRefs =
    normalizedDraft.placement === 'sub_tab' ? (normalizedDraft.sub_tab_refs ?? []) : []
  const draftTypeSet = new Set(draftTypes)
  const draftRefKeys = new Set(draftRefs.map(subTabRefKey))

  for (const rawPromo of existing) {
    if (excludePromoId && rawPromo.id === excludePromoId) continue
    if (rawPromo.id === normalizedDraft.id) continue

    const promo = normalizeMenuPromoPlacement(rawPromo)
    const existingLabel = getMenuPromoAdminLabel(promo)

    if (promo.placement === 'booking_type' && promo.booking_types?.length) {
      for (const bt of promo.booking_types) {
        if (draftTypeSet.has(bt) && !bookingTypes.some((c) => c.type === bt)) {
          bookingTypes.push({ type: bt, existingPromoId: promo.id, existingLabel })
        }
      }
    }

    if (promo.placement === 'sub_tab' && promo.sub_tab_refs?.length) {
      for (const ref of promo.sub_tab_refs) {
        const key = subTabRefKey(ref)
        if (draftRefKeys.has(key) && !subTabs.some((c) => subTabRefKey(c.ref) === key)) {
          subTabs.push({ ref, existingPromoId: promo.id, existingLabel })
        }
      }
    }
  }

  return { bookingTypes, subTabs }
}

export function hasMenuPromoPlacementConflicts(conflicts: MenuPromoPlacementConflicts): boolean {
  return conflicts.bookingTypes.length > 0 || conflicts.subTabs.length > 0
}

/** Rimuove i target in conflitto dalle promo esistenti e inserisce/aggiorna la bozza. */
export function applyMenuPromoWithReplacement(
  draft: MenuPromo,
  existing: MenuPromo[],
  excludePromoId?: string,
): MenuPromo[] {
  const normalizedDraft = normalizeMenuPromoPlacement(draft)
  const conflicts = findMenuPromoPlacementConflicts(normalizedDraft, existing, excludePromoId)

  if (!hasMenuPromoPlacementConflicts(conflicts)) {
    if (excludePromoId) {
      return existing.map((p) => (p.id === excludePromoId ? normalizedDraft : p))
    }
    return [...existing, normalizedDraft]
  }

  const conflictingBookingTypes = new Set(conflicts.bookingTypes.map((c) => c.type))
  const conflictingSubTabKeys = new Set(conflicts.subTabs.map((c) => subTabRefKey(c.ref)))

  const stripped = existing.map((promo) => {
    if (excludePromoId && promo.id === excludePromoId) return promo

    let next = promo

    if (promo.placement === 'booking_type' && promo.booking_types?.length) {
      const remaining = promo.booking_types.filter((bt) => !conflictingBookingTypes.has(bt))
      if (remaining.length !== promo.booking_types.length) {
        next = normalizeMenuPromoPlacement({ ...promo, booking_types: remaining })
      }
    }

    if (promo.placement === 'sub_tab' && promo.sub_tab_refs?.length) {
      const remaining = promo.sub_tab_refs.filter(
        (ref) => !conflictingSubTabKeys.has(subTabRefKey(ref)),
      )
      if (remaining.length !== promo.sub_tab_refs.length) {
        next = normalizeMenuPromoPlacement({ ...promo, sub_tab_refs: remaining })
      }
    }

    return next
  })

  if (excludePromoId) {
    return stripped.map((p) => (p.id === excludePromoId ? normalizedDraft : p))
  }

  return [...stripped, normalizedDraft]
}

export type MenuPromoBookingViewContext = {
  bookingType: BookingType
  modeId: string
  subTabId: string | null
  promos: MenuPromo[]
}

function isPromoEligibleForBanner(promo: MenuPromo): boolean {
  return isMenuPromoVisibleOnBooking(promo) && Boolean(promo.message?.trim())
}

/** Promo da mostrare nel banner: priorità sottotab > tipologia. */
export function resolveMenuPromoForBookingView(ctx: MenuPromoBookingViewContext): MenuPromo | null {
  const { bookingType, modeId, subTabId, promos } = ctx

  if (subTabId) {
    const subTabPromo = promos.find(
      (p) => isPromoEligibleForBanner(p) && promoMatchesSubTab(p, modeId, subTabId),
    )
    if (subTabPromo) return subTabPromo
  }

  const typePromo = promos.find(
    (p) => isPromoEligibleForBanner(p) && promoMatchesBookingType(p, bookingType),
  )
  return typePromo ?? null
}

export function resolveMenuPromoMessageForBookingView(ctx: MenuPromoBookingViewContext): string | null {
  const promo = resolveMenuPromoForBookingView(ctx)
  const message = promo?.message?.trim()
  return message || null
}

/** Label per snapshot; promo senza label non entrano in `menu_promo_labels`. */
export function getMenuPromoLabelForSnapshot(promo: MenuPromo): string | null {
  const label = promo.label?.trim()
  return label || null
}

export function findMenuPromoById(promos: MenuPromo[], id: string | null | undefined): MenuPromo | null {
  if (!id) return null
  return promos.find((p) => p.id === id) ?? null
}

export type CollectMenuPromoLabelsInput = {
  viewedPromoIds: string[]
  finalSubTabPromoId: string | null | undefined
  promos: MenuPromo[]
}

/** Merge promo viste + selezione finale, dedupe per label, ordine prima apparizione. */
export function collectMenuPromoLabelsForSubmit(input: CollectMenuPromoLabelsInput): string[] {
  const { viewedPromoIds, finalSubTabPromoId, promos } = input
  const orderedIds: string[] = []

  for (const id of viewedPromoIds) {
    if (!orderedIds.includes(id)) orderedIds.push(id)
  }

  if (finalSubTabPromoId && !orderedIds.includes(finalSubTabPromoId)) {
    orderedIds.push(finalSubTabPromoId)
  }

  const seenLabels = new Set<string>()
  const result: string[] = []

  for (const id of orderedIds) {
    const promo = findMenuPromoById(promos, id)
    if (!promo) continue
    const label = getMenuPromoLabelForSnapshot(promo)
    if (!label || seenLabels.has(label)) continue
    seenLabels.add(label)
    result.push(label)
  }

  return result
}

/** Fallback admin: promo con abbinamento tipologia che include la tipologia richiesta. */
export function listMenuPromoLabelsForBookingType(
  bookingType: BookingType,
  promos: MenuPromo[],
): string[] {
  const rows = promos.filter(
    (p) =>
      isMenuPromoVisibleOnBooking(p) &&
      Boolean(p.message?.trim()) &&
      promoMatchesBookingType(p, bookingType),
  )
  return rows.map((p) => p.label?.trim()).filter((label): label is string => Boolean(label))
}

/** @deprecated Usare resolveMenuPromoMessageForBookingView per il banner singolo. */
export function listMenuPromoMessagesForBookingType(
  bookingType: BookingType,
  promos: MenuPromo[],
): string[] {
  const message = resolveMenuPromoMessageForBookingView({
    bookingType,
    modeId: bookingType,
    subTabId: null,
    promos,
  })
  return message ? [message] : []
}

/** Normalizza `menu_promo_labels` da DB (JSONB array o stringa JSON). */
export function parseMenuPromoLabelsFromBooking(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter((label) => label.length > 0)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? '').trim()).filter((label) => label.length > 0)
      }
    } catch {
      return [trimmed]
    }
  }
  return []
}

/**
 * Label promo da mostrare in admin: snapshot salvato sulla prenotazione,
 * oppure fallback dalle impostazioni correnti se manca (prenotazioni precedenti al deploy).
 */
export function resolveMenuPromoLabelsForBooking(
  booking: { booking_type?: BookingType | null; menu_promo_labels?: unknown },
  promos: MenuPromo[],
): string[] {
  const saved = parseMenuPromoLabelsFromBooking(booking.menu_promo_labels)
  if (saved.length > 0) return saved
  return listMenuPromoLabelsForBookingType(booking.booking_type ?? 'tavolo', promos)
}
