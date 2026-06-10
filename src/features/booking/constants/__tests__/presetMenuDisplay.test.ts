import { describe, expect, it } from 'vitest'
import {
  customPresetStorageId,
  isStaffPresetSelectableForBookingType,
  resolvePresetDisplayTitle,
  shouldShowComposeMenuHeader,
  type CustomStaffPreset,
} from '../presetMenus'

const composablePreset: CustomStaffPreset = {
  id: 'preset-a',
  name: 'Menù Pranzo o Cena',
  description: 'menu pranzo o cena a partire da 18 € !',
  item_ids: ['item-1'],
  booking_types: ['menu_prezzo_fisso', 'rinfresco_laurea'],
  is_fixed_menu: false,
}

const fixedPreset: CustomStaffPreset = {
  ...composablePreset,
  id: 'preset-b',
  name: 'Menù Aperitivo',
  is_fixed_menu: true,
}

describe('shouldShowComposeMenuHeader', () => {
  it('shows compose title for personalizzabile staff preset on any booking tab', () => {
    const storageId = customPresetStorageId(composablePreset.id)
    expect(
      shouldShowComposeMenuHeader(storageId, composablePreset, 'menu_prezzo_fisso'),
    ).toBe(true)
    expect(
      shouldShowComposeMenuHeader(storageId, composablePreset, 'rinfresco_laurea'),
    ).toBe(true)
  })

  it('shows preset title branch for fixed staff preset even on rinfresco tab', () => {
    const storageId = customPresetStorageId(fixedPreset.id)
    expect(
      shouldShowComposeMenuHeader(storageId, fixedPreset, 'rinfresco_laurea'),
    ).toBe(false)
    expect(
      shouldShowComposeMenuHeader(storageId, fixedPreset, 'menu_prezzo_fisso'),
    ).toBe(false)
  })

  it('shows compose title (no preset) per CAPACITÀ della tipologia, non per nome', () => {
    // Entrambe le tipologie che «usano menù» mostrano l'header quando non c'è ancora un preset.
    expect(shouldShowComposeMenuHeader(null, undefined, 'rinfresco_laurea')).toBe(true)
    expect(shouldShowComposeMenuHeader(null, undefined, 'menu_prezzo_fisso')).toBe(true)
    // Tipologia senza capacità menù (Livello C) → niente header.
    expect(shouldShowComposeMenuHeader(null, undefined, 'tavolo')).toBe(false)
    expect(shouldShowComposeMenuHeader(null, undefined, null)).toBe(false)
    expect(shouldShowComposeMenuHeader(null, undefined, undefined)).toBe(false)
  })
})

describe('resolvePresetDisplayTitle', () => {
  it('prefers sub tab label override over preset name', () => {
    const storageId = customPresetStorageId(composablePreset.id)
    expect(
      resolvePresetDisplayTitle(storageId, [composablePreset], [
        { preset_id: composablePreset.id, custom_label: 'Etichetta card' },
      ]),
    ).toBe('Etichetta card')
  })
})

describe('isStaffPresetSelectableForBookingType', () => {
  it('does not use preset booking_types as an admin-side association filter', () => {
    const onlyFixedPricePreset: CustomStaffPreset = {
      ...composablePreset,
      booking_types: ['menu_prezzo_fisso'],
    }

    // La selezionabilità NON dipende dai booking_types del preset: anche un preset associato
    // solo a menu_prezzo_fisso resta selezionabile su una tipologia rinfresco_laurea.
    expect(isStaffPresetSelectableForBookingType(onlyFixedPricePreset, 'rinfresco_laurea')).toBe(true)
    expect(
      isStaffPresetSelectableForBookingType(
        { ...onlyFixedPricePreset, visible_on_booking: false },
        'menu_prezzo_fisso',
      ),
    ).toBe(false)
  })

  it('decide per CAPACITÀ (Livello C), non per nome della tipologia', () => {
    // Tipi storici che «usano menù» → selezionabili (comportamento preservato).
    expect(isStaffPresetSelectableForBookingType(composablePreset, 'rinfresco_laurea')).toBe(true)
    expect(isStaffPresetSelectableForBookingType(composablePreset, 'menu_prezzo_fisso')).toBe(true)
    // Tipo senza capacità menù di default → non selezionabile (Livello C: tavolo uses_menu=false).
    expect(isStaffPresetSelectableForBookingType(composablePreset, 'tavolo')).toBe(false)
    // Tipologia assente → default niente menù → non selezionabile.
    expect(isStaffPresetSelectableForBookingType(composablePreset, null)).toBe(false)
    expect(isStaffPresetSelectableForBookingType(composablePreset, undefined)).toBe(false)
  })

  it('visible_on_booking=false vince sempre, anche su tipologia con menù', () => {
    expect(
      isStaffPresetSelectableForBookingType(
        { ...composablePreset, visible_on_booking: false },
        'rinfresco_laurea',
      ),
    ).toBe(false)
  })
})
