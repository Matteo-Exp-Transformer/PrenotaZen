// @prenota-blindatura: flusso-dati
// Copre: LOCK Parser/normalizer accoppiati (difesa input malformato),
//        LOCK Selezione preset pubblico (non perdere preset_id),
//        antipattern §6 (no resolver doppio: parser non risolve il preset).
//
// Caccia: il parser legge JSONB grezzo dal DB. Dati legacy/malformati (campo assente,
// tipo sbagliato, array dove serve oggetto) NON devono far crashare né produrre valori
// sballati. Questi test sbattono input "cattivi" contro le funzioni vere.

import { describe, it, expect } from 'vitest'
import { parseSubTabFromUnknown } from '../bookingPublicFormConfig'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'

const parseConfig = restaurantSettingRegistry.booking_public_form_config.parseFromDb

describe('parseSubTabFromUnknown — input non-oggetto / malformati', () => {
  it.each([null, undefined, 42, 'stringa', true, [], [1, 2]])(
    'input %p → null senza crash',
    (raw) => {
      expect(parseSubTabFromUnknown(raw as unknown)).toBeNull()
    },
  )

  it('id assente o vuoto → null', () => {
    expect(parseSubTabFromUnknown({ label: 'X', display: 'cards' })).toBeNull()
    expect(parseSubTabFromUnknown({ id: '   ', label: 'X', display: 'cards' })).toBeNull()
  })

  it('display sconosciuto ricade su cards', () => {
    const tab = parseSubTabFromUnknown({ id: 'a', label: 'X', display: 'pippo' })
    expect(tab?.display).toBe('cards')
  })
})

describe('parseSubTabFromUnknown — campi con tipo sbagliato', () => {
  it('price_per_person negativo o non numero → undefined', () => {
    expect(parseSubTabFromUnknown({ id: 'a', label: 'X', price_per_person: -5 })?.price_per_person).toBeUndefined()
    expect(parseSubTabFromUnknown({ id: 'a', label: 'X', price_per_person: 'venti' })?.price_per_person).toBeUndefined()
    expect(parseSubTabFromUnknown({ id: 'a', label: 'X', price_per_person: NaN })?.price_per_person).toBeUndefined()
  })

  it('hidden_item_ids con elementi non-stringa o vuoti → filtrati', () => {
    const tab = parseSubTabFromUnknown({
      id: 'a',
      label: 'X',
      hidden_item_ids: ['i1', 2, null, '  ', 'i2'],
    })
    expect(tab?.hidden_item_ids).toEqual(['i1', 'i2'])
  })

  it('hidden_category_keys non-array → undefined (non crasha)', () => {
    const tab = parseSubTabFromUnknown({
      id: 'a',
      label: 'X',
      hidden_category_keys: { dolci: true },
    })
    expect(tab?.hidden_category_keys).toBeUndefined()
  })

  it('category_order_keys con spazi → trimmati e filtrati', () => {
    const tab = parseSubTabFromUnknown({
      id: 'a',
      label: 'X',
      category_order_keys: [' dolci ', '', 'primi', 3],
    })
    expect(tab?.category_order_keys).toEqual(['dolci', 'primi'])
  })

  it('field_overrides con valori non-boolean → scartati (solo i boolean restano)', () => {
    const tab = parseSubTabFromUnknown({
      id: 'a',
      label: 'X',
      field_overrides: { label: true, price_per_person: 'sì', description: 1, hidden_item_ids: false },
    })
    expect(tab?.field_overrides).toEqual({ label: true, hidden_item_ids: false })
  })

  it('field_overrides array (malformato) → undefined', () => {
    const tab = parseSubTabFromUnknown({ id: 'a', label: 'X', field_overrides: ['label'] })
    expect(tab?.field_overrides).toBeUndefined()
  })

  it('preset_id non-stringa → undefined, ma la card resta valida', () => {
    const tab = parseSubTabFromUnknown({ id: 'a', label: 'X', preset_id: 123 })
    expect(tab).not.toBeNull()
    expect(tab?.preset_id).toBeUndefined()
  })

  it('legacy type=manual scarta il preset_id ma tiene la card', () => {
    const tab = parseSubTabFromUnknown({ id: 'a', label: 'X', type: 'manual', preset_id: 'p1' })
    expect(tab?.preset_id).toBeUndefined()
    expect(tab?.label).toBe('X')
  })

  it('carousel_items con item senza image_url → scartati; senza foto valide la card è null', () => {
    expect(
      parseSubTabFromUnknown({
        id: 'a',
        label: 'Car',
        display: 'carousel',
        carousel_items: [{ title: 'no foto' }, { image_url: 12 }],
      }),
    ).toBeNull()
  })
})

describe('parseFromDb — config grezza malformata non rompe il flusso', () => {
  it('raw non-oggetto o senza booking_modes utilizzabili → null (non configurato)', () => {
    expect(parseConfig(null)).toBeNull()
    expect(parseConfig(undefined)).toBeNull()
    expect(parseConfig('x')).toBeNull()
    expect(parseConfig([])).toBeNull()
    expect(parseConfig({ page_title: 'P', booking_modes: [] })).toBeNull()
    expect(parseConfig({ page_title: 'P', booking_modes: ['non-un-oggetto'] })).toBeNull()
  })

  it('parse null → null', () => {
    expect(parseConfig(null)).toBeNull()
  })

  it('una mode malformata in mezzo non fa cadere le altre (config parziale valida)', () => {
    const parsed = parseConfig({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        'non-un-oggetto',
        {
          id: 'm2',
          booking_type: 'menu_prezzo_fisso',
          enabled: true,
          label: 'Menu',
          description: 'D',
          icon: 'bowl_food',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [{ id: 's1', label: 'Card valida', display: 'cards' }],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.booking_modes).toHaveLength(2)
    // la mode malformata è sostituita dal default per posizione, senza crash
    expect(parsed!.booking_modes[1].sub_tabs[0].label).toBe('Card valida')
  })

  it('sub_tabs con elementi malformati: tiene solo le card valide', () => {
    const parsed = parseConfig({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            null,
            42,
            { id: '', label: 'no id', display: 'cards' },
            { id: 'ok', label: 'Buona', display: 'cards' },
          ],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    const subTabs = parsed!.booking_modes[0].sub_tabs
    expect(subTabs).toHaveLength(1)
    expect(subTabs[0].id).toBe('ok')
  })

  it('preset_id valido sopravvive al round-trip parseFromDb (LOCK selezione preset)', () => {
    const parsed = parseConfig({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        {
          id: 'm1',
          booking_type: 'rinfresco_laurea',
          enabled: true,
          label: 'Rinfresco',
          description: 'D',
          icon: 'lucide_chef_hat',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 's1',
              label: 'Menu Estate',
              display: 'cards',
              preset_id: 'preset-xyz',
              field_overrides: { label: true },
            },
          ],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    const tab = parsed!.booking_modes[0].sub_tabs[0]
    expect(tab.preset_id).toBe('preset-xyz')
    // il parser NON applica il resolver: l'override resta com'è salvato
    expect(tab.field_overrides).toEqual({ label: true })
  })
})
