import '@testing-library/jest-dom/vitest'
import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PresetMenuBuilder } from '../PresetMenuBuilder'

const menuItems = [
  {
    id: 'drink-premium',
    name: 'Drink Premium',
    category: 'bevande',
    price: 8,
    description: null,
    sort_order: 1,
  },
  {
    id: 'caraffe',
    name: 'Caraffe',
    category: 'bevande',
    price: 6,
    description: null,
    sort_order: 2,
  },
  {
    id: 'tiramisu',
    name: 'Tiramisù',
    category: 'dolci',
    price: 20,
    description: null,
    sort_order: 3,
  },
]

vi.mock('@/components/ui', () => ({
  CollapsibleCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
}))

vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: menuItems, isLoading: false, error: null }),
}))

vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({
    data: [
      { key: 'bevande', label: 'Bevande', sort_order: 1 },
      { key: 'dolci', label: 'Dolci', sort_order: 2 },
    ],
  }),
}))

describe('PresetMenuBuilder — nessuna regola prodotto-specifica hardcoded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('non sostituisce automaticamente drink/caraffe e non apre un controllo kg per Tiramisù', () => {
    const onSelectionChange = vi.fn()
    const { rerender } = render(
      <PresetMenuBuilder selectedItems={[]} onSelectionChange={onSelectionChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Drink Premium/i }))
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'drink-premium', totalPrice: 8 }),
    ])

    rerender(
      <PresetMenuBuilder
        selectedItems={[{ id: 'drink-premium', name: 'Drink Premium', category: 'bevande', price: 8 }]}
        onSelectionChange={onSelectionChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Caraffe/i }))
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: 'drink-premium' }),
      expect.objectContaining({ id: 'caraffe', totalPrice: 6 }),
    ])

    rerender(
      <PresetMenuBuilder selectedItems={[]} onSelectionChange={onSelectionChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Tiramisù/i }))
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: 'tiramisu',
        totalPrice: 20,
      }),
    ])
    expect(screen.queryByText(/Quanti Kg di Tiramisù/i)).not.toBeInTheDocument()
  })
})
