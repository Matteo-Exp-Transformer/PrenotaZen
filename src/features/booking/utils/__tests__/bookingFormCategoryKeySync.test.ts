import { describe, expect, it } from 'vitest'
import { DEFAULT_BOOKING_FORM_CONFIG } from '../../constants/bookingPublicFormConfig'
import {
  removeCategoryKeyFromBookingPublicFormConfig,
  renameCategoryKeyInBookingPublicFormConfig,
} from '../bookingFormCategoryKeySync'

describe('renameCategoryKeyInBookingPublicFormConfig', () => {
  it('aggiorna hidden_category_keys nelle sub_tabs', () => {
    const config = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode, i) =>
        i === 0
          ? {
              ...mode,
              sub_tabs: [
                {
                  id: 'tab-1',
                  label: 'Menu',
                  display: 'cards' as const,
                  hidden_category_keys: ['primi', 'dolci'],
                },
              ],
            }
          : mode,
      ),
    }

    const { config: next, changed } = renameCategoryKeyInBookingPublicFormConfig(
      config,
      'primi',
      'secondi_piatti',
    )

    expect(changed).toBe(true)
    expect(next.booking_modes[0].sub_tabs?.[0].hidden_category_keys).toEqual([
      'secondi_piatti',
      'dolci',
    ])
  })

  it('aggiorna category_order_keys nelle sub_tabs', () => {
    const config = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode, i) =>
        i === 0
          ? {
              ...mode,
              sub_tabs: [
                {
                  id: 'tab-1',
                  label: 'Menu',
                  display: 'cards' as const,
                  category_order_keys: ['primi', 'dolci'],
                },
              ],
            }
          : mode,
      ),
    }

    const { config: next, changed } = renameCategoryKeyInBookingPublicFormConfig(
      config,
      'primi',
      'secondi_piatti',
    )

    expect(changed).toBe(true)
    expect(next.booking_modes[0].sub_tabs?.[0].category_order_keys).toEqual([
      'secondi_piatti',
      'dolci',
    ])
  })

  it('non modifica se la vecchia chiave non è referenziata', () => {
    const { changed } = renameCategoryKeyInBookingPublicFormConfig(
      DEFAULT_BOOKING_FORM_CONFIG,
      'inesistente',
      'nuova',
    )
    expect(changed).toBe(false)
  })
})

describe('removeCategoryKeyFromBookingPublicFormConfig', () => {
  it('rimuove categoryKey da hidden_category_keys nelle sub_tabs', () => {
    const config = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode, i) =>
        i === 0
          ? {
              ...mode,
              sub_tabs: [
                {
                  id: 'tab-1',
                  label: 'Menu',
                  display: 'cards' as const,
                  hidden_category_keys: ['primi', 'dolci'],
                },
              ],
            }
          : mode,
      ),
    }

    const { config: next, changed } = removeCategoryKeyFromBookingPublicFormConfig(config, 'primi')

    expect(changed).toBe(true)
    expect(next.booking_modes[0].sub_tabs?.[0].hidden_category_keys).toEqual(['dolci'])
  })

  it('rimuove categoryKey da category_order_keys nelle sub_tabs', () => {
    const config = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode, i) =>
        i === 0
          ? {
              ...mode,
              sub_tabs: [
                {
                  id: 'tab-1',
                  label: 'Menu',
                  display: 'cards' as const,
                  category_order_keys: ['primi', 'dolci'],
                },
              ],
            }
          : mode,
      ),
    }

    const { config: next, changed } = removeCategoryKeyFromBookingPublicFormConfig(config, 'primi')

    expect(changed).toBe(true)
    expect(next.booking_modes[0].sub_tabs?.[0].category_order_keys).toEqual(['dolci'])
  })

  it('non modifica se la chiave non è referenziata', () => {
    const { changed } = removeCategoryKeyFromBookingPublicFormConfig(
      DEFAULT_BOOKING_FORM_CONFIG,
      'inesistente',
    )
    expect(changed).toBe(false)
  })
})
