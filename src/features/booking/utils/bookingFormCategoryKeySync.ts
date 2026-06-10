import type { BookingPublicFormConfig, SubTab } from '../constants/bookingPublicFormConfig'
import { normalizeBookingPublicFormConfig } from '../constants/bookingPublicFormConfig'

function replaceKeyInStringArray(
  keys: string[] | undefined,
  previousKey: string,
  newKey: string,
): { next: string[] | undefined; changed: boolean } {
  if (!keys?.length || previousKey === newKey) {
    return { next: keys, changed: false }
  }
  let changed = false
  const mapped = keys.map((k) => {
    if (k === previousKey) {
      changed = true
      return newKey
    }
    return k
  })
  if (!changed) return { next: keys, changed: false }
  return { next: [...new Set(mapped)], changed: true }
}

function syncKeyInSubTabArrays(
  tab: SubTab,
  previousKey: string,
  newKey: string,
): { tab: SubTab; changed: boolean } {
  const hidden = replaceKeyInStringArray(tab.hidden_category_keys, previousKey, newKey)
  const order = replaceKeyInStringArray(tab.category_order_keys, previousKey, newKey)
  if (!hidden.changed && !order.changed) return { tab, changed: false }
  return {
    tab: {
      ...tab,
      hidden_category_keys: hidden.next,
      category_order_keys: order.next,
    },
    changed: true,
  }
}

/**
 * Sostituisce `previousKey` con `newKey` in `sub_tabs[].hidden_category_keys`
 * e `category_order_keys` (Personalizza form). Non modifica `field_overrides`.
 */
export function renameCategoryKeyInBookingPublicFormConfig(
  config: BookingPublicFormConfig,
  previousKey: string,
  newKey: string,
): { config: BookingPublicFormConfig; changed: boolean } {
  if (previousKey === newKey) {
    return { config, changed: false }
  }

  let anyChanged = false
  const booking_modes = config.booking_modes.map((mode) => {
    const sub_tabs = (mode.sub_tabs ?? []).map((tab) => {
      const { tab: nextTab, changed } = syncKeyInSubTabArrays(tab, previousKey, newKey)
      if (!changed) return tab
      anyChanged = true
      return nextTab
    })
    return sub_tabs === mode.sub_tabs ? mode : { ...mode, sub_tabs }
  })

  if (!anyChanged) {
    return { config, changed: false }
  }

  return {
    config: normalizeBookingPublicFormConfig({ ...config, booking_modes }),
    changed: true,
  }
}

function removeKeyFromStringArray(
  keys: string[] | undefined,
  categoryKey: string,
): { next: string[] | undefined; changed: boolean } {
  if (!keys?.length) {
    return { next: keys, changed: false }
  }
  const next = keys.filter((k) => k !== categoryKey)
  if (next.length === keys.length) {
    return { next: keys, changed: false }
  }
  return { next, changed: true }
}

/**
 * Rimuove `categoryKey` da `sub_tabs[].hidden_category_keys` e `category_order_keys`
 * (Personalizza form). Non modifica `field_overrides`.
 */
export function removeCategoryKeyFromBookingPublicFormConfig(
  config: BookingPublicFormConfig,
  categoryKey: string,
): { config: BookingPublicFormConfig; changed: boolean } {
  let anyChanged = false
  const booking_modes = config.booking_modes.map((mode) => {
    const sub_tabs = (mode.sub_tabs ?? []).map((tab) => {
      const hidden = removeKeyFromStringArray(tab.hidden_category_keys, categoryKey)
      const order = removeKeyFromStringArray(tab.category_order_keys, categoryKey)
      if (!hidden.changed && !order.changed) return tab
      anyChanged = true
      return {
        ...tab,
        hidden_category_keys: hidden.next,
        category_order_keys: order.next,
      }
    })
    return sub_tabs === mode.sub_tabs ? mode : { ...mode, sub_tabs }
  })

  if (!anyChanged) {
    return { config, changed: false }
  }

  return {
    config: normalizeBookingPublicFormConfig({ ...config, booking_modes }),
    changed: true,
  }
}
