/** Limiti duri tab Menu — valgono solo sui nuovi inserimenti (retroattività §9). */
export const MENU_MAGAZZINO_HARD_LIMITS = {
  staffPresets: 6,
  qrCodes: 6,
} as const

const MENU_MAGAZZINO_SAVE_PROPAGATION_SNAPSHOT_SUFFIX =
  'Le prenotazioni già inviate conservano lo storico di ciò che il cliente ha scelto.'

/** Copy avviso save ingredienti — edition-aware via `features.qrMenu` (tenant_features). */
export function getMenuMagazzinoSavePropagationMessage(qrMenuEnabled: boolean): string {
  const targets = qrMenuEnabled
    ? 'la Pagina Prenota e il Menu QR'
    : 'la Pagina Prenota'
  return `Salvando aggiorni subito ${targets}. ${MENU_MAGAZZINO_SAVE_PROPAGATION_SNAPSHOT_SUFFIX}`
}

export function canAddMenuCategory(_currentCount: number): boolean {
  return true
}

export function canAddMenuProductToCategory(_currentCount: number): boolean {
  return true
}

export function canAddStaffPreset(currentCount: number): boolean {
  return currentCount < MENU_MAGAZZINO_HARD_LIMITS.staffPresets
}

export function getStaffPresetLimitMessage(): string {
  return `Hai raggiunto il massimo di ${MENU_MAGAZZINO_HARD_LIMITS.staffPresets} menù preselezionati`
}

export function canAddMenuQrCode(currentCount: number): boolean {
  return currentCount < MENU_MAGAZZINO_HARD_LIMITS.qrCodes
}

export function getMenuQrCodeLimitMessage(): string {
  return `Hai raggiunto il massimo di ${MENU_MAGAZZINO_HARD_LIMITS.qrCodes} QR menu`
}

/** Conteggio prodotti in categoria (match su key o label legacy). */
export function countMenuProductsInCategory(
  menuItems: ReadonlyArray<{ category: string }>,
  categoryKey: string,
  categoryLabel?: string,
): number {
  return menuItems.filter(
    (item) =>
      item.category === categoryKey || (categoryLabel != null && item.category === categoryLabel),
  ).length
}

/** True se almeno una categoria può accettare un nuovo prodotto. */
export function canAddMenuProductAnywhere(
  menuItems: ReadonlyArray<{ category: string }>,
  categories: ReadonlyArray<{ key: string; label: string }>,
): boolean {
  return categories.some((cat) =>
    canAddMenuProductToCategory(countMenuProductsInCategory(menuItems, cat.key, cat.label)),
  )
}

/** Categoria magazzino disponibile al pubblico (assente/null = true retroattivo). */
export function isMenuCategoryAvailable(cat: { is_available?: boolean | null }): boolean {
  return cat.is_available !== false
}

export type MenuMagazzinoCategoryRef = {
  key: string
  label?: string | null
  is_available?: boolean | null
}

export type MenuMagazzinoItemRef = {
  id?: string
  category: string
  is_available?: boolean | null
}

function buildCategoriesByCategoryKey(
  categories: ReadonlyArray<MenuMagazzinoCategoryRef>,
): Map<string, MenuMagazzinoCategoryRef> {
  const map = new Map<string, MenuMagazzinoCategoryRef>()
  for (const cat of categories) {
    map.set(cat.key, cat)
    if (cat.label?.trim()) {
      map.set(cat.label, cat)
    }
  }
  return map
}

/** Item disponibile se on e la categoria parent è on (match key o label legacy). */
export function isMenuItemAvailableInMagazzino(
  item: MenuMagazzinoItemRef,
  categoriesByKey: ReadonlyMap<string, MenuMagazzinoCategoryRef>,
): boolean {
  if (item.is_available === false) return false
  const parent = categoriesByKey.get(item.category)
  if (!parent) return true
  return isMenuCategoryAvailable(parent)
}

/** Filtra categorie per vetrine pubbliche (Prenota compose header, QR homepage). */
export function filterMenuCategoriesForPublic<T extends MenuMagazzinoCategoryRef>(
  categories: readonly T[],
): T[] {
  return categories.filter(isMenuCategoryAvailable)
}

/** Filtra ingredienti per vetrine pubbliche dopo flag magazzino. */
export function filterMenuItemsForPublic<T extends MenuMagazzinoItemRef>(
  items: readonly T[],
  categories: ReadonlyArray<MenuMagazzinoCategoryRef>,
): T[] {
  const byKey = buildCategoriesByCategoryKey(categories)
  return items.filter((item) => isMenuItemAvailableInMagazzino(item, byKey))
}

/** Combina filtro magazzino + hidden per-QR (`menu_qr_codes.hidden_menu_item_ids`). */
export function filterMenuItemsForPublicQr<T extends MenuMagazzinoItemRef & { id: string }>(
  items: readonly T[],
  categories: ReadonlyArray<MenuMagazzinoCategoryRef>,
  hiddenItemIds: ReadonlyArray<string>,
): T[] {
  const hidden = new Set(hiddenItemIds)
  return filterMenuItemsForPublic(items, categories).filter((item) => !hidden.has(item.id))
}
