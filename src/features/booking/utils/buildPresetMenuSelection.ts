import type { MenuItem } from '@/types/menu'
import type { SelectedMenuItem } from '@/types/menu'
import {
  customPresetStorageId,
  getCustomPresetUuid,
  getPresetMenu,
  isBuiltinPresetMenuType,
  isCustomPresetMenuType,
  type BuiltinPresetMenuType,
  type CustomStaffPreset,
  type PresetMenu,
  type PresetMenuType,
} from '../constants/presetMenus'

const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\//g, '/')
    .replace(/\/\s*/g, '/')
    .replace(/\s*\/\s*/g, '/')

const matchesName = (itemName: string, presetName: string): boolean => {
  const normalizedItem = normalizeName(itemName)
  const normalizedPreset = normalizeName(presetName)

  if (normalizedItem === normalizedPreset) return true

  if (normalizedItem.includes(normalizedPreset) || normalizedPreset.includes(normalizedItem)) return true

  return false
}

/** Costruisce le righe selezionate dal DB per un preset built-in (stessa logica del form prenotazioni). */
export function selectedItemsFromBuiltinPresetDefinition(
  preset: PresetMenu,
  menuItems: MenuItem[],
): SelectedMenuItem[] {
  return menuItems
    .filter((item) => preset.itemNames.some((presetName) => matchesName(item.name, presetName)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      totalPrice: item.price,
    }))
}

/** Selezione tramite UUID voci menu (preset admin). */
export function selectedItemsFromMenuItemIds(menuItems: MenuItem[], itemIds: string[]): SelectedMenuItem[] {
  const idSet = new Set(itemIds)
  return menuItems
    .filter((m) => idSet.has(m.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      totalPrice: item.price,
    }))
}

export function resolvePresetSelectedItems(
  presetType: Exclude<PresetMenuType, null>,
  menuItems: MenuItem[],
  customPresets: CustomStaffPreset[],
): SelectedMenuItem[] | null {
  const builtin = getPresetMenu(presetType)
  if (builtin) {
    return selectedItemsFromBuiltinPresetDefinition(builtin, menuItems)
  }
  if (isCustomPresetMenuType(presetType)) {
    const uuid = getCustomPresetUuid(presetType)
    if (!uuid) return null
    const def = customPresets.find((c) => c.id === uuid)
    if (!def) return null
    return selectedItemsFromMenuItemIds(menuItems, def.item_ids)
  }
  return null
}

/** Confronto come in BookingRequestForm (nomi ordinati). */
export function builtinPresetMatchesSelection(
  builtinType: BuiltinPresetMenuType,
  selectedItems: SelectedMenuItem[],
): boolean {
  const preset = getPresetMenu(builtinType)
  if (!preset) return false
  const presetItemNames = [...preset.itemNames].sort()
  const selectedItemNames = selectedItems.map((i) => i.name).sort()
  if (presetItemNames.length !== selectedItemNames.length) return false
  return presetItemNames.every((name, idx) => name === selectedItemNames[idx])
}

export function presetSelectionStillMatchesStoredPreset(
  currentPreset: Exclude<PresetMenuType, null>,
  selectedItems: SelectedMenuItem[],
  customPresets: CustomStaffPreset[],
): boolean {
  if (isBuiltinPresetMenuType(currentPreset)) {
    return builtinPresetMatchesSelection(currentPreset, selectedItems)
  }
  if (isCustomPresetMenuType(currentPreset)) {
    const uuid = getCustomPresetUuid(currentPreset)
    if (!uuid) return false
    const def = customPresets.find((c) => c.id === uuid)
    if (!def) return false
    const a = [...def.item_ids].sort().join('|')
    const b = [...selectedItems.map((i) => i.id)].sort().join('|')
    return a === b
  }
  return false
}

export type MenuTotalsPayload = {
  totalPerPerson: number
  menu_total_booking: number
}

export function computeMenuTotalsFromItems(
  items: SelectedMenuItem[],
  numGuests: number,
): MenuTotalsPayload {
  const totalPerPerson = items.reduce((sum, item) => sum + item.price, 0)
  return {
    totalPerPerson,
    menu_total_booking: totalPerPerson * Math.max(numGuests, 0),
  }
}

export function computeMenuTotalsWithPresetPrice(
  items: SelectedMenuItem[],
  numGuests: number,
  presetPricePerPerson?: number | null,
): MenuTotalsPayload {
  if (presetPricePerPerson != null && presetPricePerPerson > 0) {
    return {
      totalPerPerson: presetPricePerPerson,
      menu_total_booking: presetPricePerPerson * Math.max(numGuests, 0),
    }
  }
  return computeMenuTotalsFromItems(items, numGuests)
}

/** Menù staff personalizzabile dal cliente (nessuna voce pre-selezionata). */
export function isGuestComposableStaffPreset(
  presetType: PresetMenuType,
  customPresets: CustomStaffPreset[],
): boolean {
  if (!presetType || !isCustomPresetMenuType(presetType)) return false
  const uuid = getCustomPresetUuid(presetType)
  const preset = uuid ? customPresets.find((p) => p.id === uuid) : undefined
  return preset?.is_fixed_menu === false
}

export type ApplyPresetMenuSelectionOptions = {
  /** Card Prenota con toggle «Menù personalizzabile» ON (`subTab.is_fixed_menu === false`). */
  subTabGuestComposable?: boolean
}

/** Catalogo vuoto in partenza se il cliente compone (preset o card sottotab personalizzabile). */
export function isGuestComposableMenuSelection(
  presetType: PresetMenuType,
  customPresets: CustomStaffPreset[],
  options?: ApplyPresetMenuSelectionOptions,
): boolean {
  if (options?.subTabGuestComposable === true) return true
  return isGuestComposableStaffPreset(presetType, customPresets)
}

/** Catalogo preset valido per form pubblico (almeno una voce menu nel DB). */
export function presetCatalogHasMenuItems(
  presetType: Exclude<PresetMenuType, null>,
  menuItems: MenuItem[],
  customPresets: CustomStaffPreset[],
): boolean {
  if (isGuestComposableStaffPreset(presetType, customPresets)) {
    const uuid = getCustomPresetUuid(presetType)
    const def = uuid ? customPresets.find((c) => c.id === uuid) : undefined
    if (!def?.item_ids?.length) return false
    return selectedItemsFromMenuItemIds(menuItems, def.item_ids).length > 0
  }
  return (resolvePresetSelectedItems(presetType, menuItems, customPresets)?.length ?? 0) > 0
}

/** Applica preset: menù fisso/built-in = voci già selezionate; personalizzabile = catalogo vuoto (off). */
export function applyPresetTypeToBookingFormPayload(
  presetType: Exclude<PresetMenuType, null>,
  menuItems: MenuItem[],
  customPresets: CustomStaffPreset[],
  options?: ApplyPresetMenuSelectionOptions,
): { items: SelectedMenuItem[]; preset_menu: PresetMenuType } | null {
  if (!presetCatalogHasMenuItems(presetType, menuItems, customPresets)) {
    return null
  }

  if (isGuestComposableMenuSelection(presetType, customPresets, options)) {
    return {
      items: [],
      preset_menu: presetType,
    }
  }

  const items = resolvePresetSelectedItems(presetType, menuItems, customPresets)
  if (!items?.length) {
    return null
  }
  return {
    items,
    preset_menu: presetType,
  }
}

export { customPresetStorageId }
