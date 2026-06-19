// @admin-blindatura: settings-save-guard
// Copre: footer unico padre, PublicDataSaveConfirmModal singola, no doppia mutation, fail retry, guard pill/sezione/logout durante pending, guard «Salva e continua» vs save pubblico pending
// FIX 4: Salva con nome/orari invalidi resta sulla pagina, scrolla al primo errore e applica pulse.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

const mutateAsyncSpy = vi.fn()
let autoConfirmNavigation = false

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
    servizio: false,
    noShow: false,
    sidebar: false,
    home: false,
    crm: false,
    analytics: false,
    walkIn: false,
    tableAssignments: false,
    qrMenu: false,
  }),
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', async () => {
  const ReactMod = await import('react')
  const { useCallback, useState } = ReactMod

  return {
    useRestaurantSetting: (key: string) => ({
      data: restaurantSettingsData[key as keyof typeof restaurantSettingsData] ?? null,
      isSuccess: true,
      isPending: false,
      error: null,
    }),
    useUpsertRestaurantSetting: () => {
      const [isPending, setIsPending] = useState(false)
      const mutateAsync = useCallback(async (payload: unknown) => {
        setIsPending(true)
        try {
          return await mutateAsyncSpy(payload)
        } finally {
          setIsPending(false)
        }
      }, [])
      return { mutateAsync, isPending }
    },
  }
})

vi.mock('@/features/booking/hooks/useServiceSlots', () => ({
  useServiceSlots: () => ({
    data: [],
    isSuccess: true,
    isPending: false,
    error: null,
    refetch: vi.fn(async () => ({ data: [] })),
  }),
  useUpdateServiceSlot: () => ({ mutateAsync: vi.fn() }),
  useCreateServiceSlot: () => ({ mutateAsync: vi.fn() }),
  useDeleteServiceSlot: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

vi.mock('@/contexts/UnsavedChangesContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/UnsavedChangesContext')>()
  const originalUseUnsavedChangesGuard = actual.useUnsavedChangesGuard
  return {
    ...actual,
    useUnsavedChangesGuard: () => {
      const ctx = originalUseUnsavedChangesGuard()
      return {
        ...ctx,
        confirmNavigation: autoConfirmNavigation
          ? () => Promise.resolve(true)
          : ctx.confirmNavigation,
      }
    },
  }
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/features/booking/constants/bookingPublicFormConfig'
import { getDefaultBusinessHours } from '@/lib/businessHours'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import {
  DEFAULT_BOOKING_PAGE_BACKGROUND,
  DEFAULT_BOOKING_STRIP_PHOTO,
} from '@/features/booking/constants/bookingPageBackground'
import {
  UnsavedChangesProvider,
  useUnsavedChangesGuard,
} from '@/contexts/UnsavedChangesContext'
import { RestaurantSettingsTab } from '../RestaurantSettingsTab'

function NavigationProbe() {
  const { confirmNavigation } = useUnsavedChangesGuard()
  return (
    <button type="button" onClick={() => void confirmNavigation()}>
      Simula logout
    </button>
  )
}

function renderSettingsTab(withNavigationProbe = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <UnsavedChangesProvider>
        {withNavigationProbe && <NavigationProbe />}
        <RestaurantSettingsTab />
      </UnsavedChangesProvider>
    </QueryClientProvider>,
  )
}

function extractMutationCallCount(): number {
  return mutateAsyncSpy.mock.calls.length
}

describe('settings-save-guard M4 — footer, modale pubblica, guard', () => {
  beforeAll(() => {
    vi.stubGlobal('__APP_VERSION__', 'test')
    vi.stubGlobal('__BUILD_COMMIT__', 'test-commit')
    vi.stubGlobal('__BUILD_DATE__', '2026-01-01')
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    autoConfirmNavigation = false
    mutateAsyncSpy.mockResolvedValue(undefined)
    restaurantSettingsData.restaurant_name = 'Locale Test'
    restaurantSettingsData.business_hours = getDefaultBusinessHours()
    restaurantSettingsData.public_booking_page_background = DEFAULT_BOOKING_PAGE_BACKGROUND
    restaurantSettingsData.public_booking_strip_photo = DEFAULT_BOOKING_STRIP_PHOTO
    restaurantSettingsData.app_theme = DEFAULT_APP_THEME
    restaurantSettingsData.booking_public_form_config = {
      ...DEFAULT_BOOKING_FORM_CONFIG,
      page_title: 'Titolo iniziale',
    }
  })

  it('Personalizza form con hideSaveUi: un solo footer Salva nel padre', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    const titleInput = await screen.findByLabelText(/^titolo$/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Titolo aggiornato')

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: /salva modifiche/i })).toHaveLength(1)
    expect(screen.queryAllByRole('dialog', { name: /salva modifiche pubbliche/i })).toHaveLength(0)
  })

  it('footer dirty → pulse su Salva modifiche e Annulla tutte', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    const footer = await screen.findByRole('region', { name: /modifiche non salvate/i })
    const saveBtn = within(footer).getByRole('button', { name: /salva modifiche/i })
    const cancelBtn = within(footer).getByRole('button', { name: /annulla tutte/i })

    expect(saveBtn).toHaveClass('settings-save-footer-btn-attention')
    expect(cancelBtn).toHaveClass('settings-save-footer-btn-attention')
  })

  it('Salva apre una sola PublicDataSaveConfirmModal', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })).toBeInTheDocument()
  })

  it('Salva con nome vuoto → niente modale pubblica, scroll + pulse sul nome locale', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('Il nome del ristorante è obbligatorio')
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    })
    expect(document.getElementById('settings-error-restaurant-name')).toHaveClass(
      'booking-public-field-attention',
    )
  })

  it('Salva con orari apertura sovrapposti → scroll + pulse su Orari prima della modale', async () => {
    restaurantSettingsData.business_hours = {
      ...getDefaultBusinessHours(),
      monday: [
        { open: '12:00', close: '15:00' },
        { open: '14:00', close: '16:00' },
      ],
    }
    const user = userEvent.setup()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/luned/i))
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ block: 'center' }))
    })
    const businessHoursSection = document.getElementById('settings-error-business-hours')
    expect(businessHoursSection?.querySelector('.booking-public-field-attention')).not.toBeNull()
  })

  it('doppio click footer Salva non apre modali duplicate', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    const saveFooter = screen.getByRole('button', { name: /salva modifiche/i })
    await user.dblClick(saveFooter)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('doppio click Salva nella modale pubblica non duplica mutation', async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    mutateAsyncSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    )

    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    const confirmBtn = within(publicDialog).getByRole('button', { name: /^salva$/i })

    await user.click(confirmBtn)
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(extractMutationCallCount()).toBe(1)
    })

    resolveSave?.()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    })
  })

  it('errore mutation mantiene modale aperta, dirty e consente retry', async () => {
    const user = userEvent.setup()
    mutateAsyncSpy
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)

    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Nome che fallisce')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()

    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))
    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledTimes(2)
    })
  })

  it('cambio pill Anagrafica↔Form con dirty passa dal guard, non dalla modale pubblica', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeInTheDocument()
    expect(screen.queryByText(/salva modifiche pubbliche/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/nome ristorante/i)).toBeInTheDocument()
  })

  it('cambio pill durante save pending non cambia tab in silenzio', async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    mutateAsyncSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    )

    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(within(publicDialog).getByText(/salvataggio/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    expect(screen.getByLabelText(/nome ristorante/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeInTheDocument()

    resolveSave?.()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    })
  })

  it('logout simulato durante save pending non procede in silenzio', async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    mutateAsyncSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    )

    renderSettingsTab(true)

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(within(publicDialog).getByText(/salvataggio/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /simula logout/i }))

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog', { name: /salva modifiche pubbliche/i }).length).toBeGreaterThanOrEqual(
      1,
    )

    resolveSave?.()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    })
  })

  it('guard Salva e continua durante save pubblico pending non duplica mutation', async () => {
    const user = userEvent.setup()
    let resolveSave: (() => void) | undefined
    mutateAsyncSpy.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve
        }),
    )

    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(within(publicDialog).getByText(/salvataggio/i)).toBeInTheDocument()
    })
    expect(extractMutationCallCount()).toBe(1)

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /salva e continua/i }))

    await waitFor(() => {
      expect(extractMutationCallCount()).toBe(1)
    })
    expect(toast.warn).not.toHaveBeenCalled()

    resolveSave?.()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /salva modifiche pubbliche/i })).not.toBeInTheDocument()
    })
  })

  it('save aggregato anagrafica + form: una modale e persist entrambe le aree', async () => {
    const user = userEvent.setup()
    autoConfirmNavigation = true
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Nome Aggregato')

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    const titleInput = await screen.findByLabelText(/^titolo$/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Titolo aggiornato')

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)

    const publicDialog = screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      const keys = mutateAsyncSpy.mock.calls.flatMap((call) => {
        const payload = call[0]
        if (Array.isArray(payload)) return payload.map((item: { key: string }) => item.key)
        return []
      })
      expect(keys).toEqual(expect.arrayContaining(['restaurant_name', 'booking_public_form_config']))
    })
  })
})
