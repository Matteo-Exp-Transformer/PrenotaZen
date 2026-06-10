import { describe, it, expect } from 'vitest'
import {
  resolveSubTabView,
  markFieldOverridden,
  patchSubTabAsOverride,
  resetSubTabToPreset,
  isFieldOverridden,
} from '../bookingFormResolver'
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

const PRESET_UPDATED: CustomStaffPreset = {
  ...PRESET,
  name: 'Menu Estate 2026',
  description: 'Aggiornato',
  price_per_person: 40,
}

function baseSubTab(): SubTab {
  return {
    id: 'tab-1',
    display: 'cards',
    label: 'Menu Estate',
    description: 'Antipasti, primo, secondo, dolce',
    price_per_person: 35,
    preset_id: 'preset-1',
  }
}

describe('resolveSubTabView — campi non personalizzati seguono il preset live', () => {
  it('senza field_overrides usa il preset per label/description/price', () => {
    const tab = baseSubTab()
    const resolved = resolveSubTabView(tab, [PRESET_UPDATED])
    expect(resolved.label).toBe('Menu Estate 2026')
    expect(resolved.description).toBe('Aggiornato')
    expect(resolved.price_per_person).toBe(40)
  })

  it('con label override mantiene il valore salvato', () => {
    const tab = { ...baseSubTab(), label: 'Menu Speciale Mare', field_overrides: { label: true } }
    const resolved = resolveSubTabView(tab, [PRESET_UPDATED])
    expect(resolved.label).toBe('Menu Speciale Mare')
    expect(resolved.price_per_person).toBe(40) // resta live
  })

  it('mantiene il testo Numero Portate salvato sulla card', () => {
    const tab = { ...baseSubTab(), courses_label: '4 portate' }
    const resolved = resolveSubTabView(tab, [PRESET_UPDATED])
    expect(resolved.courses_label).toBe('4 portate')
  })

  it('con price override mantiene il prezzo salvato sulla card', () => {
    const tab = {
      ...baseSubTab(),
      price_per_person: 32,
      field_overrides: { price_per_person: true },
    }
    const resolved = resolveSubTabView(tab, [PRESET_UPDATED])
    expect(resolved.price_per_person).toBe(32)
  })

  it('senza override segue live il flag menù personalizzabile del preset', () => {
    const presetPersonalizzabile: CustomStaffPreset = { ...PRESET_UPDATED, is_fixed_menu: false }
    const tab = { ...baseSubTab(), is_fixed_menu: undefined }
    const resolved = resolveSubTabView(tab, [presetPersonalizzabile])
    expect(resolved.is_fixed_menu).toBe(false)
    expect(resolved.price_per_person).toBeUndefined()
  })

  it('senza preset collegato restituisce testi e prezzo salvati', () => {
    const tab: SubTab = { id: 't', display: 'cards', label: 'Manuale', price_per_person: 50 }
    const resolved = resolveSubTabView(tab, [])
    expect(resolved.label).toBe('Manuale')
    expect(resolved.price_per_person).toBe(50)
    expect(resolved.is_fixed_menu).toBeUndefined()
  })

  it('senza preset collegato non forza la griglia personalizzabile', () => {
    const tab: SubTab = { id: 't', display: 'cards', label: 'Manuale' }
    const resolved = resolveSubTabView(tab, [])
    expect(resolved.is_fixed_menu).toBeUndefined()
  })

  it('preset cancellato non blocca: fallback ai valori salvati', () => {
    const tab = baseSubTab()
    const resolved = resolveSubTabView(tab, [])
    expect(resolved.label).toBe('Menu Estate')
  })

  it('senza override category_order_keys restituisce undefined', () => {
    const tab = baseSubTab()
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.category_order_keys).toBeUndefined()
  })

  it('con category_order_keys override usa l\'ordine salvato', () => {
    const tab = {
      ...baseSubTab(),
      category_order_keys: ['dolci', 'primi'],
      field_overrides: { category_order_keys: true },
    }
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.category_order_keys).toEqual(['dolci', 'primi'])
  })

  it('carosello: mantiene il prezzo salvato senza ereditarlo dal preset', () => {
    const tab: SubTab = {
      ...baseSubTab(),
      display: 'carousel',
      price_per_person: 99,
    }
    const resolved = resolveSubTabView(tab, [PRESET])
    expect(resolved.price_per_person).toBe(99)
  })
})

describe('markFieldOverridden', () => {
  it('imposta override true', () => {
    const tab = markFieldOverridden(baseSubTab(), 'label', true)
    expect(isFieldOverridden(tab, 'label')).toBe(true)
  })

  it('reimposta override false senza cancellare la chiave', () => {
    const tab = markFieldOverridden(
      markFieldOverridden(baseSubTab(), 'price_per_person', true),
      'price_per_person',
      false,
    )
    expect(isFieldOverridden(tab, 'price_per_person')).toBe(false)
  })
})

describe('patchSubTabAsOverride', () => {
  it('marca come override solo i campi presenti nel patch', () => {
    const tab = patchSubTabAsOverride(baseSubTab(), { label: 'Custom' })
    expect(tab.label).toBe('Custom')
    expect(isFieldOverridden(tab, 'label')).toBe(true)
    expect(isFieldOverridden(tab, 'description')).toBe(false)
  })
})

describe('resetSubTabToPreset', () => {
  it('riallinea tutti i campi al preset e azzera gli override', () => {
    const tab = patchSubTabAsOverride(baseSubTab(), {
      label: 'Custom',
      description: 'desc custom',
      price_per_person: 99,
    })
    const reset = resetSubTabToPreset(tab, [PRESET_UPDATED])
    expect(reset.label).toBe('Menu Estate 2026')
    expect(reset.description).toBe('Aggiornato')
    expect(reset.price_per_person).toBe(40)
    expect(isFieldOverridden(reset, 'label')).toBe(false)
    expect(isFieldOverridden(reset, 'price_per_person')).toBe(false)
    expect(isFieldOverridden(reset, 'category_order_keys')).toBe(false)
  })

  it('carosello non viene toccato', () => {
    const tab: SubTab = { ...baseSubTab(), display: 'carousel' }
    const reset = resetSubTabToPreset(tab, [PRESET_UPDATED])
    expect(reset).toBe(tab)
  })
})
