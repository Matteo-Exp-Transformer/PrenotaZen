// @admin-blindatura: servizio
// Copre: frecce riordino fasce in Pro (ServiceSlotsManager) — disabilitazione ai confini,
// persistenza display_order via mutateAsync al click su/giù.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'

// ── Spy per verifica chiamate ────────────────────────────────────────────────
const updateSlotSpy = vi.fn()

// ── Stato fasce condiviso tra i test ─────────────────────────────────────────
const slotsState = vi.hoisted(() => ({
  slots: [] as Array<{
    id: string
    tenant_id: string
    name: string
    start_time: string
    end_time: string
    max_turns: number | null
    max_guests: number | null
    display_order: number
    is_canonical: boolean
    created_at: string
    updated_at: string
    max_turns_resume?: number | null
    arrival_step_minutes: number
    min_duration: number | null
    turnover_buffer_minutes: number
  }>,
}))

// ── Mock hook fasce ───────────────────────────────────────────────────────────
vi.mock('@/features/booking/hooks/useServiceSlots', () => ({
  useServiceSlots: () => ({ data: slotsState.slots, isLoading: false, error: null }),
  useUpdateServiceSlot: () => ({ mutateAsync: updateSlotSpy, mutate: updateSlotSpy, isPending: false }),
  useCreateServiceSlot: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteServiceSlot: () => ({ mutate: vi.fn(), isPending: false }),
  isServiceSlotClosed: (slot: { max_turns: number | null }) => slot.max_turns === 0,
  SERVICE_SLOTS_QUERY_KEY: 'service_slots',
}))

// ── Mock override fasce ───────────────────────────────────────────────────────
vi.mock('@/features/booking/hooks/useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  useCreateServiceSlotOverride: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteServiceSlotOverride: () => ({ mutate: vi.fn(), isPending: false }),
  getActiveOverrides: () => [],
  hasActiveOverride: () => null,
  resolveSlotOverride: () => null,
  todayLocalISODate: () => '2026-06-19',
  resolveScopeDateRange: () => null,
  classifyOverrideScope: () => 'today',
  findActiveOverrideOfScope: () => null,
}))

// ── Mock dipendenze secondarie ────────────────────────────────────────────────
vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-test', organizationName: 'Test' }),
}))

vi.mock('@/hooks/useBusinessHours', () => ({
  useBusinessHours: () => ({ data: null }),
}))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/features/booking/utils/bookingTimeSlots', () => ({
  OVERNIGHT_TIME_END_HINT: 'Fascia a cavallo della mezzanotte.',
  slotCrossesMidnight: () => false,
}))

// ── Import componente DOPO i mock ─────────────────────────────────────────────
import { ServiceSlotsManager } from '../servizio/ServiceSlotsManager'

function makeSlot(id: string, name: string, displayOrder: number) {
  return {
    id,
    tenant_id: 'tenant-test',
    name,
    start_time: '12:00:00',
    end_time: '15:00:00',
    max_turns: null,
    max_guests: null,
    display_order: displayOrder,
    is_canonical: true,
    created_at: '',
    updated_at: '',
    arrival_step_minutes: 30,
    min_duration: null,
    turnover_buffer_minutes: 0,
  }
}

function renderManager() {
  return render(
    <UnsavedChangesProvider>
      <ServiceSlotsManager />
    </UnsavedChangesProvider>,
  )
}

describe('ServiceSlotsManager Pro — riordino manuale fasce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateSlotSpy.mockResolvedValue(undefined)
    slotsState.slots = [
      makeSlot('slot-pranzo', 'Pranzo', 0),
      makeSlot('slot-cena', 'Cena', 1),
    ]
  })

  it('freccia su disabilitata per prima fascia, freccia giù disabilitata per ultima', async () => {
    renderManager()

    await screen.findByText('Pranzo')

    expect(screen.getByRole('button', { name: /sposta su fascia pranzo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /sposta giù fascia pranzo/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /sposta su fascia cena/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /sposta giù fascia cena/i })).toBeDisabled()
  })

  it('modifica fascia mostra Intervallo di arrivo con valore preset; casella numerica nascosta su valore standard', async () => {
    const user = userEvent.setup()
    renderManager()
    await user.click(await screen.findByRole('button', { name: /modifica pranzo/i }))
    expect(screen.getByLabelText('Intervallo di arrivo')).toHaveValue('30')
    // Valore standard (30): la casella numerica è nascosta — appare solo su "Altro"
    expect(screen.queryByLabelText('Intervallo personalizzato in minuti')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: '15 minuti' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '60 minuti' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Altro' })).toBeInTheDocument()
  })

  it('con un solo slot entrambe le frecce sono disabilitate', async () => {
    slotsState.slots = [makeSlot('slot-unico', 'Solo', 0)]
    renderManager()

    await screen.findByText('Solo')

    expect(screen.getByRole('button', { name: /sposta su fascia solo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /sposta giù fascia solo/i })).toBeDisabled()
  })

  it('freccia giù su Pranzo → mutateAsync con display_order scambiati per entrambe le fasce', async () => {
    const user = userEvent.setup()
    renderManager()

    await screen.findByText('Pranzo')
    await user.click(screen.getByRole('button', { name: /sposta giù fascia pranzo/i }))

    await waitFor(() => {
      // Pranzo (idx 0) va in posizione 1; Cena (idx 1) va in posizione 0
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-cena', display_order: 0, skipToast: true }),
      )
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-pranzo', display_order: 1, skipToast: true }),
      )
    })
    expect(updateSlotSpy).toHaveBeenCalledTimes(2)
  })

  it('freccia su su Cena → stesso risultato di freccia giù su Pranzo', async () => {
    const user = userEvent.setup()
    renderManager()

    await screen.findByText('Cena')
    await user.click(screen.getByRole('button', { name: /sposta su fascia cena/i }))

    await waitFor(() => {
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-cena', display_order: 0, skipToast: true }),
      )
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-pranzo', display_order: 1, skipToast: true }),
      )
    })
    expect(updateSlotSpy).toHaveBeenCalledTimes(2)
  })

  it('con tre fasce: freccia giù sulla prima → solo le prime due si scambiano', async () => {
    slotsState.slots = [
      makeSlot('slot-pranzo', 'Pranzo', 0),
      makeSlot('slot-aperitivo', 'Aperitivo', 1),
      makeSlot('slot-cena', 'Cena', 2),
    ]
    const user = userEvent.setup()
    renderManager()

    await screen.findByText('Pranzo')
    await user.click(screen.getByRole('button', { name: /sposta giù fascia pranzo/i }))

    await waitFor(() => {
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-pranzo', display_order: 1, skipToast: true }),
      )
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-aperitivo', display_order: 0, skipToast: true }),
      )
      expect(updateSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-cena', display_order: 2, skipToast: true }),
      )
    })
    expect(updateSlotSpy).toHaveBeenCalledTimes(3)
  })
})
