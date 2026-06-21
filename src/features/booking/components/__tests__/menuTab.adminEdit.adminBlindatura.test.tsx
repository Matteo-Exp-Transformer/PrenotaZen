// @admin-blindatura: prenotazioni
// Fix 7 — vista admin tab «Menu e Prezzi» nel dettaglio prenotazione:
// cambio menù predefinito, rimozione singolo ingrediente / intera categoria,
// stato vuoto in edit, view mode leggibile.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SelectedMenuItem } from '@/types/menu'
import type { CustomStaffPreset } from '../../constants/presetMenus'
import { customPresetStorageId } from '../../constants/presetMenus'
import { MenuTab } from '../MenuTab'

const ITEMS: SelectedMenuItem[] = [
  { id: 'i1', name: 'Bruschetta', price: 4, category: 'antipasti' },
  { id: 'i2', name: 'Tagliere', price: 6, category: 'antipasti' },
  { id: 'i3', name: 'Spritz', price: 5, category: 'bevande' },
]

const PRESETS: CustomStaffPreset[] = [
  { id: 'p-1', name: 'Menù Gold', item_ids: ['i1', 'i2'], booking_types: ['rinfresco_laurea'] },
]

function renderEdit(overrides: {
  items?: SelectedMenuItem[]
  onMenuChange?: ReturnType<typeof vi.fn>
  onPresetMenuChange?: ReturnType<typeof vi.fn>
  presetMenu?: string | null
} = {}) {
  const onMenuChange = overrides.onMenuChange ?? vi.fn()
  const onPresetMenuChange = overrides.onPresetMenuChange ?? vi.fn()
  render(
    <MenuTab
      booking={{ booking_type: 'rinfresco_laurea' }}
      menuFlowBookingType="rinfresco_laurea"
      isEditMode
      menuSelection={{ items: overrides.items ?? ITEMS }}
      numGuests={10}
      presetMenu={overrides.presetMenu ?? null}
      customStaffPresets={PRESETS}
      isMenuExpanded
      onMenuExpandToggle={() => undefined}
      onMenuChange={onMenuChange}
      onPresetMenuChange={onPresetMenuChange}
    />,
  )
  return { onMenuChange, onPresetMenuChange }
}

describe('MenuTab — vista admin edit (fix 7)', () => {
  it('rimuove un singolo ingrediente dalla prenotazione aperta', async () => {
    const user = userEvent.setup()
    const { onMenuChange } = renderEdit()

    await user.click(screen.getByRole('button', { name: /rimuovi bruschetta/i }))

    expect(onMenuChange).toHaveBeenCalledTimes(1)
    const payload = onMenuChange.mock.calls[0][0]
    expect(payload.items.map((i: SelectedMenuItem) => i.id)).toEqual(['i2', 'i3'])
    // Totale a persona ricalcolato senza la voce rimossa.
    expect(payload.totalPerPerson).toBe(11)
  })

  it('rimuove un\'intera categoria lasciando le altre', async () => {
    const user = userEvent.setup()
    const { onMenuChange } = renderEdit()

    // Prima categoria renderizzata = antipasti (2 voci) → bottone «Rimuovi categoria».
    const removeCategoryButtons = screen.getAllByRole('button', { name: /rimuovi categoria/i })
    await user.click(removeCategoryButtons[0])

    const payload = onMenuChange.mock.calls[0][0]
    expect(payload.items.map((i: SelectedMenuItem) => i.id)).toEqual(['i3'])
  })

  it('cambia il menù preselezionato usando la pipeline preset del parent', async () => {
    const user = userEvent.setup()
    const { onPresetMenuChange } = renderEdit()

    await user.selectOptions(
      screen.getByLabelText(/menù preselezionato/i),
      customPresetStorageId('p-1'),
    )

    expect(onPresetMenuChange).toHaveBeenCalledWith(customPresetStorageId('p-1'))
  })

  it('mostra lo stato vuoto quando la prenotazione resta senza ingredienti', () => {
    renderEdit({ items: [] })
    expect(screen.getByText(/nessun ingrediente in questa prenotazione/i)).toBeInTheDocument()
  })

  it('view mode resta leggibile con il menù selezionato', () => {
    render(
      <MenuTab
        booking={{ booking_type: 'rinfresco_laurea' }}
        isEditMode={false}
        menuSelection={{ items: ITEMS }}
        numGuests={10}
        presetMenu={null}
        customStaffPresets={PRESETS}
        isMenuExpanded
        onMenuExpandToggle={() => undefined}
        onMenuChange={vi.fn()}
      />,
    )
    // FIX 4: il menù è già visibile senza click — CollapsibleSection rimosso.
    expect(screen.getByText('ANTIPASTI')).toBeInTheDocument()
    expect(screen.getByText(/bruschetta/i)).toBeInTheDocument()
    expect(screen.getByText('RIEPILOGO COSTI')).toBeInTheDocument()
  })
})
