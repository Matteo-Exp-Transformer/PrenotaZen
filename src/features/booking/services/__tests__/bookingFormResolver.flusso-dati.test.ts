// @prenota-blindatura: flusso-dati
// Copre: LOCK Resolver puro, LOCK Owner field_overrides, LOCK Cancellazione preset staff
//        (fallback ai valori salvati), LOCK Card scorrevole senza preset,
//        LOCK Carosello = singolo / prezzo non ereditato.
//
// Caccia: il resolver è l'unico punto che decide "live vs congelato". Questi test
// blindano i casi limite che romperebbero la vetrina: preset cancellato/svuotato
// dopo essere stato collegato, override con valore mancante, prezzo card vs carosello,
// menù personalizzabile (is_fixed_menu=false).

import { describe, it, expect } from 'vitest'
import { resolveSubTabView } from '../bookingFormResolver'
import type { SubTab } from '../../constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '../../constants/presetMenus'

const PRESET: CustomStaffPreset = {
  id: 'preset-1',
  name: 'Menu Estate',
  description: 'Antipasti, primo, secondo, dolce',
  price_per_person: 35,
  item_ids: ['i1', 'i2', 'i3'],
  booking_types: ['rinfresco_laurea'],
}

function cardLinkedToPreset(extra: Partial<SubTab> = {}): SubTab {
  return {
    id: 'tab-1',
    display: 'cards',
    label: 'Etichetta salvata',
    description: 'Descrizione salvata',
    price_per_person: 32,
    preset_id: 'preset-1',
    ...extra,
  }
}

describe('resolveSubTabView — preset cancellato DOPO il collegamento (dati orfani)', () => {
  it('preset non più nel catalogo: la card non sparisce, usa i valori congelati salvati', () => {
    const tab = cardLinkedToPreset()
    // presets vuoto = preset cancellato in tab Menu
    const resolved = resolveSubTabView(tab, [])
    expect(resolved.label).toBe('Etichetta salvata')
    expect(resolved.description).toBe('Descrizione salvata')
    expect(resolved.price_per_person).toBe(32)
    // preset_id resta sulla card (il legame esiste ancora, è il preset che manca)
    expect(resolved.preset_id).toBe('preset-1')
  })

  it('preset di un ALTRO id presente ma non quello collegato: comunque fallback ai salvati', () => {
    const tab = cardLinkedToPreset()
    const other: CustomStaffPreset = { ...PRESET, id: 'preset-altro', name: 'Altro' }
    const resolved = resolveSubTabView(tab, [other])
    expect(resolved.label).toBe('Etichetta salvata')
    expect(resolved.price_per_person).toBe(32)
  })

  it('preset svuotato (name/description vuoti): non azzera i testi della card, tiene i salvati', () => {
    const emptyPreset: CustomStaffPreset = {
      ...PRESET,
      name: '   ',
      description: '   ',
    }
    const tab = cardLinkedToPreset({ field_overrides: {} })
    const resolved = resolveSubTabView(tab, [emptyPreset])
    // name vuoto del preset → si ricade sul valore salvato della card (non stringa vuota)
    expect(resolved.label).toBe('Etichetta salvata')
    expect(resolved.description).toBe('Descrizione salvata')
  })
})

describe('resolveSubTabView — override con valore mancante non crasha né inventa', () => {
  it('override label=true ma label salvata vuota → restituisce la stringa salvata (anche vuota), non il preset', () => {
    const tab = cardLinkedToPreset({ label: '', field_overrides: { label: true } })
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.label).toBe('')
  })

  it('override hidden_item_ids=true ma array assente → undefined (mostra tutto), nessun crash', () => {
    const tab = cardLinkedToPreset({
      hidden_item_ids: undefined,
      field_overrides: { hidden_item_ids: true },
    })
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.hidden_item_ids).toBeUndefined()
  })

  it('senza override hidden_category_keys non eredita nulla dal preset (array vuoto = mostra tutto)', () => {
    const tab = cardLinkedToPreset({ hidden_category_keys: ['dolci'] })
    const resolved = resolveSubTabView(tab, [PRESET])
    // senza override il valore salvato NON deve trapelare: vetrina mostra tutto il preset
    expect(resolved.hidden_category_keys).toBeUndefined()
  })
})

describe('resolveSubTabView — prezzo: card fisso/personalizzabile vs carosello', () => {
  it('card personalizzabile (is_fixed_menu=false): nessun prezzo fisso, anche se preset ha prezzo', () => {
    const tab = cardLinkedToPreset({ is_fixed_menu: false, price_per_person: 99 })
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.is_fixed_menu).toBe(false)
    expect(resolved.price_per_person).toBeUndefined()
  })

  it('card fissa non personalizzata: eredita il prezzo live del preset', () => {
    const tab = cardLinkedToPreset({ price_per_person: 10 })
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.price_per_person).toBe(35)
  })

  it('card fissa con preset senza prezzo: ricade sul prezzo salvato', () => {
    const noPricePreset: CustomStaffPreset = { ...PRESET, price_per_person: undefined }
    const tab = cardLinkedToPreset({ price_per_person: 28 })
    const resolved = resolveSubTabView(tab, [noPricePreset])
    expect(resolved.price_per_person).toBe(28)
  })

  it('carosello: prezzo SEMPRE quello salvato, mai ereditato dal preset', () => {
    const tab = cardLinkedToPreset({ display: 'carousel', price_per_person: 77 })
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.price_per_person).toBe(77)
  })
})

describe('resolveSubTabView — idempotenza (antipattern §6: applicare due volte)', () => {
  it('ri-risolvere una card già risolta non cambia il risultato finale', () => {
    const tab = cardLinkedToPreset()
    const once = resolveSubTabView(tab, [PRESET])
    // simula il merge che fa BookingRequestForm.activeModeSubTabs: { ...tab, ...campiRisolti }
    const merged: SubTab = {
      ...tab,
      label: once.label,
      description: once.description,
      price_per_person: once.price_per_person,
      is_fixed_menu: once.is_fixed_menu,
      hidden_category_keys: once.hidden_category_keys,
      hidden_item_ids: once.hidden_item_ids,
      category_order_keys: once.category_order_keys,
    }
    const twice = resolveSubTabView(merged, [PRESET])
    expect(twice.label).toBe(once.label)
    expect(twice.price_per_person).toBe(once.price_per_person)
    expect(twice.description).toBe(once.description)
  })
})
