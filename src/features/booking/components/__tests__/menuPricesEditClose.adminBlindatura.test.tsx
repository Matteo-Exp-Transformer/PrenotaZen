// @admin-blindatura: menu-prices-edit-close
// Copre: FIX 1 — la modifica di un ingrediente esistente chiude il form dopo «Salva»,
// con lo stesso reset di stato già usato dal flusso «Nuovo Prodotto» (no editingId residuo,
// niente form fantasma riaperto su un nuovo render).

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MenuItem } from '@/types/menu'
import type { MenuCategoryRecord } from '@/features/booking/hooks/useMenuCategories'

const menuItemsData = vi.hoisted(() => ({
  items: [
    {
      id: 'item-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      name: 'Pizza Margherita',
      category: 'pizze',
      price: 6.5,
      description: 'Pomodoro e mozzarella',
      sort_order: 0,
      is_available: true,
      image_url: null,
    } satisfies MenuItem,
  ],
}))

const menuCategoriesData = vi.hoisted(() => ({
  categories: [
    {
      id: 'cat-1',
      tenant_id: 'tenant-test',
      key: 'pizze',
      label: 'Pizze',
      description: null,
      image_url: null,
      is_available: true,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    } satisfies MenuCategoryRecord,
  ],
}))

const updateMutateAsync = vi.hoisted(() => vi.fn(async () => ({ id: 'item-1' })))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({
    tenantId: 'tenant-test',
    organizationName: 'Org Test',
    edition: 'classic',
    featureOverrides: undefined,
  }),
}))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({ qrMenu: false }),
}))

vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({
    data: menuItemsData.items,
    isLoading: false,
    refetch: vi.fn(async () => {}),
  }),
  useCreateMenuItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMenuItem: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
  useDeleteMenuItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetMenuItemAvailability: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({
    data: menuCategoriesData.categories,
    refetch: vi.fn(async () => {}),
  }),
  useCreateMenuCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMenuCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMenuCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetMenuCategoryAvailability: () => ({ mutate: vi.fn() }),
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: undefined, isSuccess: true, isPending: false, error: null }),
  useUpsertRestaurantSetting: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/lib/menuPhotoUpload', () => ({
  uploadMenuPhoto: vi.fn(),
  uploadMenuCategoryPhoto: vi.fn(),
  deleteMenuCategoryPhoto: vi.fn(),
}))

vi.mock('../PresetMenuBuilder', () => ({
  PresetMenuBuilder: () => null,
}))

vi.mock('../MenuQrManager', () => ({
  MenuQrManager: () => null,
}))

import { MenuPricesTab } from '../MenuPricesTab'

describe('MenuPricesTab — FIX 1 chiusura form dopo modifica ingrediente', () => {
  beforeEach(() => {
    cleanup()
    updateMutateAsync.mockClear()
    // jsdom non implementa scrollIntoView; il componente lo chiama per portare il form in vista.
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('chiude il form di modifica dopo «Salva», come già fa «Nuovo Prodotto»', async () => {
    const user = userEvent.setup()
    render(<MenuPricesTab />)

    await user.click(screen.getByRole('button', { name: /Crea \/ Modifica Prodotto/i }))

    const categoryHeaders = screen.getAllByRole('button', { name: /Pizze/i })
    const categoryToggle = categoryHeaders.find((el) => el.hasAttribute('aria-expanded'))
    expect(categoryToggle).toBeDefined()
    await user.click(categoryToggle!)

    await user.click(screen.getByRole('button', { name: /Modifica Pizza Margherita/i }))

    expect(screen.getByText('Modifica Prodotto')).toBeInTheDocument()
    const nameInput = screen.getByPlaceholderText('Es. Pizza Margherita')
    expect(nameInput).toHaveValue('Pizza Margherita')

    fireEvent.change(nameInput, { target: { value: 'Pizza Margherita DOC' } })

    await user.click(screen.getByRole('button', { name: /Salva/i }))

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1', name: 'Pizza Margherita DOC' }),
    )

    await waitFor(() => expect(screen.queryByText('Modifica Prodotto')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Aggiungi nuovo ingrediente/i })).toBeInTheDocument()
  })

  // Controtest "rompi" (MANUALE_BLINDATURA §3, fronte flusso utente): Modifica → Annulla → Modifica
  // non deve lasciare editingId/formData residui dal primo giro.
  it('rompi: Modifica → Annulla → Modifica riparte pulito, senza Save residuo', async () => {
    const user = userEvent.setup()
    render(<MenuPricesTab />)

    await user.click(screen.getByRole('button', { name: /Crea \/ Modifica Prodotto/i }))
    const categoryToggle = screen
      .getAllByRole('button', { name: /Pizze/i })
      .find((el) => el.hasAttribute('aria-expanded'))!
    await user.click(categoryToggle)

    await user.click(screen.getByRole('button', { name: /Modifica Pizza Margherita/i }))
    fireEvent.change(screen.getByPlaceholderText('Es. Pizza Margherita'), {
      target: { value: 'Bozza non salvata' },
    })

    await user.click(screen.getByRole('button', { name: /Annulla/i }))
    expect(screen.queryByText('Modifica Prodotto')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Modifica Pizza Margherita/i }))
    expect(screen.getByPlaceholderText('Es. Pizza Margherita')).toHaveValue('Pizza Margherita')

    await user.click(screen.getByRole('button', { name: /Salva/i }))
    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1))
    expect(updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1', name: 'Pizza Margherita' }),
    )
  })
})
