/**
 * Resolver puro per la card Prenota: dato uno `SubTab` salvato + il preset corrente,
 * restituisce la "vista finale" letta dal cliente sulla pagina Prenota.
 *
 * Regola «aggiorna solo se non personalizzato»:
 * - se `field_overrides[campo] === true` → usa il valore salvato sulla card (personalizzato)
 * - altrimenti → eredita dal preset live (segue cambi in tab Menu)
 *
 * Le sottotab senza `preset_id` (es. card manuali, caroselli) non hanno fonte di ereditarietà:
 * il resolver restituisce direttamente i campi salvati.
 */

import type { SubTab, SubTabOverridableField } from '../constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '../constants/presetMenus'

export interface ResolvedSubTab {
  id: string
  display: SubTab['display']
  label: string
  description?: string
  courses_label?: string
  price_per_person?: number
  is_fixed_menu?: boolean
  hidden_category_keys?: string[]
  hidden_item_ids?: string[]
  category_order_keys?: string[]
  preset_id?: string
  icon?: SubTab['icon']
  carousel_items?: SubTab['carousel_items']
  /** Snapshot delle bandierine usato — utile per debugging/UI admin. */
  field_overrides: Required<Pick<NonNullable<SubTab['field_overrides']>, never>> & NonNullable<SubTab['field_overrides']>
}

/** True se il campo è marcato come personalizzato dal ristoratore. */
export function isFieldOverridden(subTab: SubTab, field: SubTabOverridableField): boolean {
  return subTab.field_overrides?.[field] === true
}

/** Trova il preset collegato; restituisce null se sottotab senza preset o preset cancellato. */
function findPreset(
  subTab: SubTab,
  presets: CustomStaffPreset[],
): CustomStaffPreset | null {
  if (!subTab.preset_id) return null
  return presets.find((p) => p.id === subTab.preset_id) ?? null
}

/** Risolve la vista finale di una card Prenota applicando le bandierine field_overrides. */
export function resolveSubTabView(
  subTab: SubTab,
  presets: CustomStaffPreset[],
): ResolvedSubTab {
  const preset = findPreset(subTab, presets)
  const overrides = subTab.field_overrides ?? {}

  // label: campo obbligatorio sulla card; se non personalizzato e preset esiste, segue il nome del preset
  const label = isFieldOverridden(subTab, 'label') || !preset
    ? subTab.label
    : (preset.name?.trim() || subTab.label)

  // description: se non personalizzato e preset esiste, segue la descrizione del preset
  const description = isFieldOverridden(subTab, 'description') || !preset
    ? subTab.description
    : (preset.description?.trim() || subTab.description)

  const is_fixed_menu =
    subTab.display === 'cards' && (subTab.is_fixed_menu === false || preset?.is_fixed_menu === false)
      ? false
      : undefined

  // price_per_person:
  // - cards: se il menu è personalizzabile non esiste prezzo fisso, altrimenti si eredita dal preset se non personalizzato
  // - carousel: usa solo il prezzo salvato sulla vetrina, senza ereditarlo dal preset
  const price_per_person =
    subTab.display === 'carousel'
      ? subTab.price_per_person
      : is_fixed_menu === false
        ? undefined
        : isFieldOverridden(subTab, 'price_per_person') || !preset
          ? subTab.price_per_person
          : (preset.price_per_person ?? subTab.price_per_person)

  // hidden_item_ids / hidden_category_keys: vetrina-only. Senza personalizzazione → array vuoto
  // (= mostra tutti gli ingredienti del preset). Con personalizzazione → usa i salvati.
  const hidden_item_ids = isFieldOverridden(subTab, 'hidden_item_ids')
    ? subTab.hidden_item_ids
    : undefined
  const hidden_category_keys = isFieldOverridden(subTab, 'hidden_category_keys')
    ? subTab.hidden_category_keys
    : undefined
  const category_order_keys = isFieldOverridden(subTab, 'category_order_keys')
    ? subTab.category_order_keys
    : undefined

  return {
    id: subTab.id,
    display: subTab.display,
    label,
    description,
    courses_label: subTab.courses_label,
    price_per_person,
    is_fixed_menu,
    hidden_category_keys,
    hidden_item_ids,
    category_order_keys,
    preset_id: subTab.preset_id,
    icon: subTab.icon,
    carousel_items: subTab.carousel_items,
    field_overrides: overrides,
  }
}

/** Marca un campo come personalizzato (true) o ripristinato (false). */
export function markFieldOverridden(
  subTab: SubTab,
  field: SubTabOverridableField,
  value: boolean,
): SubTab {
  const next = { ...(subTab.field_overrides ?? {}), [field]: value }
  return { ...subTab, field_overrides: next }
}

/**
 * Patch della card preservando la bandierina come "personalizzato" per i campi modificati.
 * Usalo nell'editor admin: ogni volta che Mario cambia un campo, segna override=true.
 */
export function patchSubTabAsOverride(
  subTab: SubTab,
  patch: Partial<
    Pick<
      SubTab,
      | 'label'
      | 'description'
      | 'price_per_person'
      | 'hidden_item_ids'
      | 'hidden_category_keys'
      | 'category_order_keys'
    >
  >,
): SubTab {
  const overrides: NonNullable<SubTab['field_overrides']> = { ...(subTab.field_overrides ?? {}) }
  let next: SubTab = { ...subTab }

  if ('label' in patch) {
    next = { ...next, label: patch.label ?? '' }
    overrides.label = true
  }
  if ('description' in patch) {
    next = { ...next, description: patch.description }
    overrides.description = true
  }
  if ('price_per_person' in patch) {
    next = { ...next, price_per_person: patch.price_per_person }
    overrides.price_per_person = true
  }
  if ('hidden_item_ids' in patch) {
    next = { ...next, hidden_item_ids: patch.hidden_item_ids }
    overrides.hidden_item_ids = true
  }
  if ('hidden_category_keys' in patch) {
    next = { ...next, hidden_category_keys: patch.hidden_category_keys }
    overrides.hidden_category_keys = true
  }
  if ('category_order_keys' in patch) {
    next = { ...next, category_order_keys: patch.category_order_keys }
    overrides.category_order_keys = true
  }

  return { ...next, field_overrides: overrides }
}

/**
 * Re-importa il preset: tutti i field_overrides tornano a `false` per i campi
 * disponibili nel preset; i valori della card vengono riallineati al preset.
 * Carosello (display='carousel') resta invariato: non ha legame preset.
 */
export function resetSubTabToPreset(
  subTab: SubTab,
  presets: CustomStaffPreset[],
): SubTab {
  if (subTab.display === 'carousel') return subTab
  const preset = findPreset(subTab, presets)
  if (!preset) return subTab

  return {
    ...subTab,
    label: preset.name?.trim() || subTab.label,
    description: preset.description?.trim() || undefined,
    price_per_person: preset.price_per_person,
    is_fixed_menu: subTab.is_fixed_menu === false ? false : undefined,
    hidden_item_ids: undefined,
    hidden_category_keys: undefined,
    category_order_keys: undefined,
    field_overrides: {
      label: false,
      description: false,
      price_per_person: false,
      hidden_item_ids: false,
      hidden_category_keys: false,
      category_order_keys: false,
    },
  }
}
