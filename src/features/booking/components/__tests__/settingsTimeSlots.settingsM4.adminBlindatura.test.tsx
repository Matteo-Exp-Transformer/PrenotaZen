// @admin-blindatura: settings-time-slots
// Copre: enable/disable fasce, add, delete modale in-app (Annulla/Conferma), overlap blocca save,
// overnight hint, cap per-fascia in save, mutation fail + retry, riordino manuale fasce (FIX 3),
// scroll+pulse al primo errore overlap (FIX 4)

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

const mutateAsyncSpy = vi.fn()
const createServiceSlotSpy = vi.fn()
const updateServiceSlotSpy = vi.fn()
const deleteServiceSlotSpy = vi.fn()

const featuresState = vi.hoisted(() => ({ servizio: false }))

const restaurantSettingsData = vi.hoisted(() => ({
  restaurant_name: 'Locale Test',
  slot_guest_capacities: {} as Record<string, number | null>,
  slot_limit_enabled: false as boolean,
  booking_reject_out_of_slot: false as boolean,
  booking_time_slots_enabled: true,
  business_hours: {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  } as unknown,
  contact_email: '',
  contact_phone: '',
  contact_address: '',
  public_booking_page_background: 'strip-01',
  public_booking_strip_photo: 'strip-01',
  app_theme: 'classic-warm',
  booking_public_form_config: null as unknown,
  booking_custom_staff_presets: [] as unknown[],
}))

const serviceSlotsState = vi.hoisted(() => ({
  slots: [
    {
      id: 'slot-pranzo',
      tenant_id: 'tenant-test',
      name: 'Pranzo',
      start_time: '12:00:00',
      end_time: '15:00:00',
      max_turns: null,
      max_guests: null,
      display_order: 0,
      is_canonical: true,
      created_at: '',
      updated_at: '',
    },
  ] as Array<{
    id: string
    tenant_id: string
    name: string
    start_time: string
    end_time: string
    max_turns: null
    max_guests: null
    display_order: number
    is_canonical: boolean
    created_at: string
    updated_at: string
  }>,
}))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/config/settingsAutosave', () => ({
  SETTINGS_AUTOSAVE_ENABLED: false,
  SETTINGS_AUTOSAVE_RESTAURANT_KEYS: [
    'restaurant_name',
    'contact_email',
    'contact_phone',
    'contact_address',
  ],
  SETTINGS_AUTOSAVE_BOOKING_HEADER_FIELDS: ['page_title', 'page_description'],
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({
    tenantId: 'tenant-test',
    organizationName: 'Org Test',
  }),
}))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    servizio: featuresState.servizio,
    noShow: featuresState.servizio,
    sidebar: featuresState.servizio,
    home: false,
    crm: false,
    analytics: false,
    walkIn: false,
    tableAssignments: featuresState.servizio,
    qrMenu: false,
  }),
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettingsData[key as keyof typeof restaurantSettingsData] ?? null,
    isSuccess: true,
    isPending: false,
    error: null,
  }),
  useUpsertRestaurantSetting: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
  }),
}))

vi.mock('@/features/booking/hooks/useServiceSlots', () => ({
  useServiceSlots: () => ({
    data: serviceSlotsState.slots,
    isSuccess: true,
    isPending: false,
    error: null,
    refetch: vi.fn(async () => ({ data: serviceSlotsState.slots })),
  }),
  useUpdateServiceSlot: () => ({ mutateAsync: updateServiceSlotSpy }),
  useCreateServiceSlot: () => ({ mutateAsync: createServiceSlotSpy }),
  useDeleteServiceSlot: () => ({ mutateAsync: deleteServiceSlotSpy, isPending: false }),
  SERVICE_SLOTS_QUERY_KEY: 'service_slots',
}))

vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))

vi.mock('@/features/booking/hooks/useDebouncedSettingsAutosave', () => ({
  useDebouncedSettingsAutosave: () => ({
    notifyFieldChange: vi.fn(),
    flushField: vi.fn(),
    cancelPending: vi.fn(),
    fieldStatus: {},
  }),
}))

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getDefaultBusinessHours } from '@/lib/businessHours'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import {
  DEFAULT_BOOKING_PAGE_BACKGROUND,
  DEFAULT_BOOKING_STRIP_PHOTO,
} from '@/features/booking/constants/bookingPageBackground'
import { OVERNIGHT_TIME_END_HINT } from '@/features/booking/utils/bookingTimeSlots'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { RestaurantSettingsTab } from '../RestaurantSettingsTab'

function renderSettingsTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UnsavedChangesProvider>
        <RestaurantSettingsTab />
      </UnsavedChangesProvider>
    </QueryClientProvider>,
  )
}

function getUpsertPayloadKeys(): string[] {
  return mutateAsyncSpy.mock.calls.flatMap((call) => {
    const payload = call[0]
    if (Array.isArray(payload)) return payload.map((item: { key: string }) => item.key)
    return []
  })
}

function getUpsertItemValue(key: string): unknown {
  for (const call of mutateAsyncSpy.mock.calls) {
    const payload = call[0]
    if (!Array.isArray(payload)) continue
    const item = payload.find((entry: { key: string }) => entry.key === key)
    if (item) return item.value
  }
  return undefined
}

async function confirmPublicSave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
  const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
  await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))
}

describe('settings-time-slots M4 — fasce Classic in RestaurantSettingsTab', () => {
  beforeAll(() => {
    vi.stubGlobal('__APP_VERSION__', 'test')
    vi.stubGlobal('__BUILD_COMMIT__', 'test-commit')
    vi.stubGlobal('__BUILD_DATE__', '2026-01-01')
    // FIX 4 (16-06-26): overlap blocca il salvataggio e scrolla al primo errore — jsdom non
    // implementa scrollIntoView di default.
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncSpy.mockResolvedValue(undefined)
    createServiceSlotSpy.mockImplementation(async (payload: { name: string }) => ({
      id: 'slot-created',
      tenant_id: 'tenant-test',
      name: payload.name,
      start_time: '12:00:00',
      end_time: '14:00:00',
      max_turns: null,
      max_guests: null,
      display_order: 1,
      is_canonical: true,
      created_at: '',
      updated_at: '',
    }))
    updateServiceSlotSpy.mockResolvedValue(undefined)
    deleteServiceSlotSpy.mockResolvedValue(undefined)

    featuresState.servizio = false

    restaurantSettingsData.restaurant_name = 'Locale Test'
    restaurantSettingsData.slot_guest_capacities = {}
    restaurantSettingsData.slot_limit_enabled = false
    restaurantSettingsData.booking_reject_out_of_slot = false
    restaurantSettingsData.booking_time_slots_enabled = true
    restaurantSettingsData.business_hours = getDefaultBusinessHours()
    restaurantSettingsData.public_booking_page_background = DEFAULT_BOOKING_PAGE_BACKGROUND
    restaurantSettingsData.public_booking_strip_photo = DEFAULT_BOOKING_STRIP_PHOTO
    restaurantSettingsData.app_theme = DEFAULT_APP_THEME

    serviceSlotsState.slots = [
      {
        id: 'slot-pranzo',
        tenant_id: 'tenant-test',
        name: 'Pranzo',
        start_time: '12:00:00',
        end_time: '15:00:00',
        max_turns: null,
        max_guests: null,
        display_order: 0,
        is_canonical: true,
        created_at: '',
        updated_at: '',
      },
    ]
  })

  it('disattiva fasce → dirty e save persiste booking_time_slots_enabled false', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const toggle = await screen.findByRole('checkbox', { name: /attiva \/ disattiva/i })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    })

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
      expect(getUpsertItemValue('booking_time_slots_enabled')).toBe(false)
    })
  })

  it('aggiunge fascia valida con il pulsante Aggiungi fascia oraria', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByLabelText(/nome fascia 1/i)
    expect(screen.queryByLabelText(/nome fascia 2/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /aggiungi fascia oraria/i }))

    const secondSlotName = await screen.findByLabelText(/nome fascia 2/i)
    expect(secondSlotName).toHaveValue('Nuova fascia')
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
  })

  it('elimina fascia: modale in-app Annulla mantiene la fascia', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true)
    renderSettingsTab()

    await user.click(await screen.findByRole('button', { name: /rimuovi fascia pranzo/i }))

    const deleteDialog = await screen.findByRole('dialog', { name: /elimina fascia oraria/i })
    expect(within(deleteDialog).getByText(/vuoi eliminare la fascia/i)).toBeInTheDocument()
    expect(confirmSpy).not.toHaveBeenCalled()

    await user.click(within(deleteDialog).getByRole('button', { name: /^annulla$/i }))
    confirmSpy.mockRestore()

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /elimina fascia oraria/i })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText(/nome fascia 1/i)).toBeInTheDocument()
  })

  it('elimina fascia: Conferma rimuove la riga dall’editor', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await user.click(await screen.findByRole('button', { name: /rimuovi fascia pranzo/i }))
    const deleteDialog = await screen.findByRole('dialog', { name: /elimina fascia oraria/i })
    await user.click(within(deleteDialog).getByRole('button', { name: /^elimina$/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText(/nome fascia 1/i)).not.toBeInTheDocument()
    })
    expect(screen.getByText(/nessuna fascia configurata/i)).toBeInTheDocument()
  })

  it('overlap blocca il salvataggio strutturale senza mutation upsert', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await user.click(screen.getByRole('button', { name: /aggiungi fascia oraria/i }))
    await screen.findByLabelText(/nome fascia 2/i)

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    await waitFor(() => {
      expect(screen.getByText(/si sovrappongono/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
  })

  it('fascia overnight mostra avviso senza crash pagina', async () => {
    serviceSlotsState.slots = [
      {
        id: 'slot-notte',
        tenant_id: 'tenant-test',
        name: 'Notte',
        start_time: '22:00:00',
        end_time: '02:00:00',
        max_turns: null,
        max_guests: null,
        display_order: 0,
        is_canonical: true,
        created_at: '',
        updated_at: '',
      },
    ]

    renderSettingsTab()

    expect(await screen.findByText(OVERNIGHT_TIME_END_HINT)).toBeInTheDocument()
    expect(screen.getByLabelText(/nome fascia 1/i)).toHaveValue('Notte')
  })

  it('cap per-fascia + interruttori limiti/orario salvati come chiavi distinte', async () => {
    const user = userEvent.setup()
    restaurantSettingsData.slot_guest_capacities = { 'slot-pranzo': 80 }
    renderSettingsTab()

    const slotCapInput = await screen.findByLabelText(/coperti max:/i)
    await user.clear(slotCapInput)
    await user.type(slotCapInput, '120')

    await user.click(screen.getByRole('checkbox', { name: /attiva limiti coperti per fascia oraria/i }))
    await user.click(screen.getByRole('checkbox', { name: /rifiuta richieste fuori dalle fasce orarie/i }))

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })

    const slotCaps = getUpsertItemValue('slot_guest_capacities') as Record<string, number | null>
    expect(slotCaps['slot-pranzo']).toBe(120)
    expect(getUpsertItemValue('slot_limit_enabled')).toBe(true)
    expect(getUpsertItemValue('booking_reject_out_of_slot')).toBe(true)
    expect(getUpsertPayloadKeys()).toEqual(
      expect.arrayContaining(['slot_guest_capacities', 'slot_limit_enabled', 'booking_reject_out_of_slot']),
    )
  })

  it('edition Pro (servizio): interruttori limiti/orario visibili e salvabili senza editor fasce Classic', async () => {
    featuresState.servizio = true
    const user = userEvent.setup()
    renderSettingsTab()

    expect(screen.queryByLabelText(/coperti max:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /attiva \/ disattiva/i })).not.toBeInTheDocument()

    const limitToggle = await screen.findByRole('checkbox', { name: /attiva limiti coperti per fascia oraria/i })
    const rejectToggle = screen.getByRole('checkbox', { name: /rifiuta richieste fuori dalle fasce orarie/i })
    expect(limitToggle).not.toBeChecked()
    expect(rejectToggle).not.toBeChecked()

    await user.click(limitToggle)
    await user.click(rejectToggle)

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })
    expect(getUpsertItemValue('slot_limit_enabled')).toBe(true)
    expect(getUpsertItemValue('booking_reject_out_of_slot')).toBe(true)
  })

  it('cap per-fascia vuoto → null nel payload (nessun tetto)', async () => {
    const user = userEvent.setup()
    restaurantSettingsData.slot_guest_capacities = { 'slot-pranzo': 50 }
    renderSettingsTab()

    const slotCapInput = await screen.findByLabelText(/coperti max:/i)
    await user.clear(slotCapInput)

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })

    const slotCaps = getUpsertItemValue('slot_guest_capacities') as Record<string, number | null>
    expect(slotCaps['slot-pranzo']).toBeNull()
  })

  it('cap per-fascia invalido/alto non finisce nel payload o blocca save', async () => {
    const { restaurantSettingRegistry } = await import('@/features/booking/lib/restaurantSettingRegistry')
    const slotCapEntry = restaurantSettingRegistry.slot_guest_capacities
    expect(slotCapEntry.validate({ 'slot-pranzo': 0 })).not.toBeNull()
    expect(slotCapEntry.validate({ 'slot-pranzo': 5001 })).not.toBeNull()

    mutateAsyncSpy.mockImplementation(async (payload: unknown) => {
      if (!Array.isArray(payload)) return
      for (const item of payload) {
        const reg = restaurantSettingRegistry[item.key as keyof typeof restaurantSettingRegistry]
        const err = reg.validate(item.value)
        if (err) throw new Error(`${item.key}: ${err}`)
      }
    })

    const user = userEvent.setup()

    for (const invalid of ['0', '5001'] as const) {
      vi.clearAllMocks()
      mutateAsyncSpy.mockImplementation(async (payload: unknown) => {
        if (!Array.isArray(payload)) return
        for (const item of payload) {
          const reg = restaurantSettingRegistry[item.key as keyof typeof restaurantSettingRegistry]
          const err = reg.validate(item.value)
          if (err) throw new Error(`${item.key}: ${err}`)
        }
      })

      const { unmount } = renderSettingsTab()
      const slotCapInput = await screen.findByLabelText(/coperti max:/i)
      await user.clear(slotCapInput)
      await user.type(slotCapInput, invalid)

      await confirmPublicSave(user)

      await waitFor(() => {
        expect(mutateAsyncSpy).toHaveBeenCalled()
      })
      const attemptedCaps = getUpsertItemValue('slot_guest_capacities') as Record<string, number | null>
      expect(slotCapEntry.validate(attemptedCaps)).not.toBeNull()
      expect(screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
      unmount()
    }
  })

  it('elimina fascia Conferma + Salva chiama deleteServiceSlot', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await user.click(await screen.findByRole('button', { name: /rimuovi fascia pranzo/i }))
    const deleteDialog = await screen.findByRole('dialog', { name: /elimina fascia oraria/i })
    await user.click(within(deleteDialog).getByRole('button', { name: /^elimina$/i }))

    await waitFor(() => {
      expect(screen.queryByLabelText(/nome fascia 1/i)).not.toBeInTheDocument()
    })

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(deleteServiceSlotSpy).toHaveBeenCalledWith('slot-pranzo')
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })
  })

  it('errore mutation lascia dirty e consente retry', async () => {
    const user = userEvent.setup()
    mutateAsyncSpy
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)

    renderSettingsTab()

    await user.click(screen.getByRole('checkbox', { name: /attiva \/ disattiva/i }))
    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()

    const publicDialog = screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledTimes(2)
    })
  })
})

describe('settings-time-slots M4 — riordino manuale fasce (FIX 3, 16-06-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncSpy.mockResolvedValue(undefined)
    createServiceSlotSpy.mockResolvedValue(undefined)
    updateServiceSlotSpy.mockResolvedValue(undefined)
    deleteServiceSlotSpy.mockResolvedValue(undefined)

    restaurantSettingsData.restaurant_name = 'Locale Test'
    restaurantSettingsData.slot_guest_capacities = { 'slot-pranzo': 50 }
    restaurantSettingsData.slot_limit_enabled = false
    restaurantSettingsData.booking_reject_out_of_slot = false
    restaurantSettingsData.booking_time_slots_enabled = true
    restaurantSettingsData.business_hours = getDefaultBusinessHours()
    restaurantSettingsData.public_booking_page_background = DEFAULT_BOOKING_PAGE_BACKGROUND
    restaurantSettingsData.public_booking_strip_photo = DEFAULT_BOOKING_STRIP_PHOTO
    restaurantSettingsData.app_theme = DEFAULT_APP_THEME

    serviceSlotsState.slots = [
      {
        id: 'slot-pranzo',
        tenant_id: 'tenant-test',
        name: 'Pranzo',
        start_time: '12:00:00',
        end_time: '15:00:00',
        max_turns: null,
        max_guests: null,
        display_order: 0,
        is_canonical: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'slot-cena',
        tenant_id: 'tenant-test',
        name: 'Cena',
        start_time: '19:00:00',
        end_time: '22:00:00',
        max_turns: null,
        max_guests: null,
        display_order: 1,
        is_canonical: true,
        created_at: '',
        updated_at: '',
      },
    ]
  })

  it('freccia giù su Pranzo scambia l’ordine in UI e disabilita ai confini', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByLabelText(/nome fascia 1/i)
    expect(screen.getByLabelText(/nome fascia 1/i)).toHaveValue('Pranzo')
    expect(screen.getByLabelText(/nome fascia 2/i)).toHaveValue('Cena')
    expect(screen.getByRole('button', { name: /sposta su fascia pranzo/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /sposta giù fascia cena/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /sposta giù fascia pranzo/i }))

    expect(screen.getByLabelText(/nome fascia 1/i)).toHaveValue('Cena')
    expect(screen.getByLabelText(/nome fascia 2/i)).toHaveValue('Pranzo')
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
  })

  it('rompi: riordino + Salva → display_order persistito nel nuovo ordine, capienze restano per-id', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByLabelText(/nome fascia 1/i)
    await user.click(screen.getByRole('button', { name: /sposta giù fascia pranzo/i }))
    await confirmPublicSave(user)

    await waitFor(() => {
      expect(updateServiceSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-cena', display_order: 0 }),
      )
      expect(updateServiceSlotSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'slot-pranzo', display_order: 1 }),
      )
    })

    // Capienza agganciata a slot-pranzo per id, non per posizione — invariata dopo lo scambio.
    const slotCaps = getUpsertItemValue('slot_guest_capacities') as Record<string, number | null>
    expect(slotCaps['slot-pranzo']).toBe(50)
  })

  it('rompi: riordino + add + delete insieme non scambia gli id delle capienze', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByLabelText(/nome fascia 1/i)
    await user.click(screen.getByRole('button', { name: /sposta giù fascia pranzo/i }))
    await user.click(screen.getByRole('button', { name: /aggiungi fascia oraria/i }))
    await screen.findByLabelText(/nome fascia 3/i)

    await user.click(screen.getByRole('button', { name: /rimuovi fascia nuova fascia/i }))
    let deleteDialog = await screen.findByRole('dialog', { name: /elimina fascia oraria/i })
    await user.click(within(deleteDialog).getByRole('button', { name: /^elimina$/i }))

    await user.click(screen.getByRole('button', { name: /rimuovi fascia cena/i }))
    deleteDialog = await screen.findByRole('dialog', { name: /elimina fascia oraria/i })
    await user.click(within(deleteDialog).getByRole('button', { name: /^elimina$/i }))

    await confirmPublicSave(user)

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
      expect(deleteServiceSlotSpy).toHaveBeenCalledWith('slot-cena')
    })

    const slotCaps = getUpsertItemValue('slot_guest_capacities') as Record<string, number | null>
    expect(slotCaps['slot-pranzo']).toBe(50)
    expect(slotCaps['slot-cena']).toBeUndefined()
  })
})

describe('settings-time-slots M4 — scroll+pulse al primo errore (FIX 4, 16-06-26)', () => {
  beforeAll(() => {
    // jsdom non implementa scrollIntoView di default.
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncSpy.mockResolvedValue(undefined)

    restaurantSettingsData.restaurant_name = 'Locale Test'
    restaurantSettingsData.slot_guest_capacities = {}
    restaurantSettingsData.slot_limit_enabled = false
    restaurantSettingsData.booking_reject_out_of_slot = false
    restaurantSettingsData.booking_time_slots_enabled = true
    restaurantSettingsData.business_hours = getDefaultBusinessHours()
    restaurantSettingsData.public_booking_page_background = DEFAULT_BOOKING_PAGE_BACKGROUND
    restaurantSettingsData.public_booking_strip_photo = DEFAULT_BOOKING_STRIP_PHOTO
    restaurantSettingsData.app_theme = DEFAULT_APP_THEME

    serviceSlotsState.slots = [
      {
        id: 'slot-pranzo',
        tenant_id: 'tenant-test',
        name: 'Pranzo',
        start_time: '12:00:00',
        end_time: '15:00:00',
        max_turns: null,
        max_guests: null,
        display_order: 0,
        is_canonical: true,
        created_at: '',
        updated_at: '',
      },
    ]
  })

  it('overlap fasce → scroll sul primo errore + pulse sulla sezione «Imposta Fasce Orarie»', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    renderSettingsTab()

    await user.click(screen.getByRole('button', { name: /aggiungi fascia oraria/i }))
    await screen.findByLabelText(/nome fascia 2/i)

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    await waitFor(() => {
      expect(screen.getByText(/si sovrappongono/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    })

    const timeSlotsSection = document.getElementById('settings-error-time-slots')
    expect(timeSlotsSection).not.toBeNull()
    expect(timeSlotsSection?.querySelector('.booking-public-field-attention')).not.toBeNull()
  })
})
