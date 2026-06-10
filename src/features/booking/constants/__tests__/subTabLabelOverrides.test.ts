import { describe, expect, it } from 'vitest'
import { applyLegacySubTabLabelOverrides, type SubTab } from '../bookingPublicFormConfig'

const tab: SubTab = {
  id: 'tab-1',
  display: 'cards',
  label: 'Menù Base',
  preset_id: 'preset-1',
}

describe('applyLegacySubTabLabelOverrides', () => {
  it('uses legacy custom_label when label still matches preset staff name', () => {
    const result = applyLegacySubTabLabelOverrides(
      [tab],
      [{ preset_id: 'preset-1', custom_label: 'Menù aperitivo di laurea' }],
      [{ id: 'preset-1', name: 'Menù Base' }],
    )
    expect(result[0]?.label).toBe('Menù aperitivo di laurea')
  })

  it('keeps explicit etichetta when already customized', () => {
    const customized: SubTab = { ...tab, label: 'Menù aperitivo di laurea' }
    const result = applyLegacySubTabLabelOverrides(
      [customized],
      [{ preset_id: 'preset-1', custom_label: 'Vecchio override' }],
      [{ id: 'preset-1', name: 'Menù Base' }],
    )
    expect(result[0]?.label).toBe('Menù aperitivo di laurea')
  })
})
