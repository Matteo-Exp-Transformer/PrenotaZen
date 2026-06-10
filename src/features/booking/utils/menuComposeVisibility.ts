import type { MenuItem } from '@/types/menu'
import {
  getCustomPresetUuid,
  isBuiltinPresetMenuType,
  isCustomPresetMenuType,
  type CustomStaffPreset,
  type PresetMenuType,
} from '../constants/presetMenus'
import { resolvePresetSelectedItems } from './buildPresetMenuSelection'

/** Limiti selezione per categoria — nessuno configurato, feature da implementare. */
export const MENU_COMPOSE_CATEGORY_LIMITS: Partial<Record<string, number>> = {}

export type ComposeMenuItem = {
  id: string
  name: string
  price: number
  category: string
  description?: string
  sort_order: number
  priceSuffix?: string
  image_url?: string | null
}

/**
 * UUID consentiti quando il menù è bloccato (preset fisso o built-in).
 * `null` = nessun filtro (compose libero senza preset). Con preset personalizzabile = solo `item_ids` del catalogo.
 */
export function resolveLockedPresetAllowedItemIds(
  presetMenu: PresetMenuType | null | undefined,
  menuItems: MenuItem[],
  customStaffPresets: CustomStaffPreset[],
): Set<string> | null {
  if (!presetMenu) return null

  if (isCustomPresetMenuType(presetMenu)) {
    const uuid = getCustomPresetUuid(presetMenu)
    const preset = uuid ? customStaffPresets.find((p) => p.id === uuid) : undefined
    // Preset non ancora risolto (catalogo in caricamento): non filtrare la griglia.
    if (!preset) return null
    if (!preset.item_ids?.length) return new Set()
    // Personalizzabile: mostra solo il catalogo preset, senza pre-selezioni
    return new Set(preset.item_ids)
  }

  if (isBuiltinPresetMenuType(presetMenu)) {
    const resolved = resolvePresetSelectedItems(presetMenu, menuItems, customStaffPresets)
    if (!resolved?.length) return new Set()
    return new Set(resolved.map((i) => i.id))
  }

  return null
}

export function filterItemsForComposeCategory(
  categoryItems: ComposeMenuItem[],
  allowedItemIds: Set<string> | null,
): ComposeMenuItem[] {
  if (!allowedItemIds) return categoryItems
  return categoryItems.filter((item) => allowedItemIds.has(item.id))
}

export function countSelectedInCategory(
  selectedItems: { id: string; category: string }[],
  categoryKey: string,
): number {
  return selectedItems.filter((s) => s.category === categoryKey).length
}

export function selectionStatusLabel(
  _categoryKey: string,
  selectedCount: number,
): { hint: string; status: string } {
  return {
    hint: 'Scegli le opzioni',
    status:
      selectedCount === 0
        ? 'Nessuna selezionata'
        : selectedCount === 1
          ? '1 selezionata'
          : `${selectedCount} selezionate`,
  }
}
