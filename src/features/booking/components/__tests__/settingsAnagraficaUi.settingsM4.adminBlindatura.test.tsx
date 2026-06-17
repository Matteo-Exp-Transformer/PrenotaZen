// @admin-blindatura: settings-anagrafica-ui
// Copre: flusso reale RestaurantSettingsTab — modale pubblica unica, save aggregato, errore non chiude modale, guard tab

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

const mutateAsyncSpy = vi.fn()
const registerUnsavedHandlersSpy = vi.fn()
let autoConfirmNavigation = false

const restaurantSettingsData = vi.hoisted(() => ({
  restaurant_name: 'Locale Test',
  slot_guest_capacities: {} as Record<string, number | null>,
  daily_guest_limit: null as number | null,
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
        registerUnsavedHandlers: (id: string, handlers: unknown) => {
          registerUnsavedHandlersSpy(id, handlers)
          return ctx.registerUnsavedHandlers(id, handlers as never)
        },
      }
    },
  }
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/features/booking/constants/bookingPublicFormConfig'
import { getDefaultBusinessHours } from '@/lib/businessHours'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import {
  DEFAULT_BOOKING_PAGE_BACKGROUND,
  DEFAULT_BOOKING_STRIP_PHOTO,
} from '@/features/booking/constants/bookingPageBackground'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { RestaurantSettingsTab } from '../RestaurantSettingsTab'
import { BookingFormConfigPanel } from '../settings/BookingFormConfigPanel'

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

function extractSavedKeys(): string[] {
  return mutateAsyncSpy.mock.calls.flatMap((call) => {
    const payload = call[0]
    if (Array.isArray(payload)) return payload.map((item) => item.key)
    if (payload?.items) return payload.items.map((item: { key: string }) => item.key)
    return []
  })
}

describe('settings-anagrafica-ui M4 — flusso reale Impostazioni', () => {
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

  it('registry accetta anagrafica con solo nome e contatti vuoti', async () => {
    const { restaurantSettingRegistry } = await import('@/features/booking/lib/restaurantSettingRegistry')
    expect(restaurantSettingRegistry.restaurant_name.validate('Ristorante Demo')).toBeNull()
    expect(restaurantSettingRegistry.contact_email.validate('')).toBeNull()
    expect(restaurantSettingRegistry.contact_phone.validate('')).toBeNull()
    expect(restaurantSettingRegistry.contact_address.validate('')).toBeNull()
  })

  it('footer Salva con nome vuoto scrolla e lampeggia sul campo, senza aprire la modale pubblica', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)
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

  it('footer Salva apre una sola PublicDataSaveConfirmModal', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Nuovo Nome')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))

    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(within(dialogs[0]).getByText(/salva modifiche pubbliche/i)).toBeInTheDocument()
  })

  it('cambio pill Anagrafica↔Form con dirty mostra guard navigazione, non modale pubblica', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.type(nameInput, 'X')

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeInTheDocument()
    expect(screen.queryByText(/salva modifiche pubbliche/i)).not.toBeInTheDocument()
  })

  it('errore save anagrafica non chiude la modale pubblica e mantiene dirty', async () => {
    const user = userEvent.setup()
    mutateAsyncSpy.mockRejectedValueOnce(new Error('network'))
    renderSettingsTab()

    const nameInput = await screen.findByLabelText(/nome ristorante/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Nome che fallisce')

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })
    expect(screen.getByRole('dialog', { name: /salva modifiche pubbliche/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
  })

  it('save Personalizza form via modale pubblica del padre', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await user.click(screen.getByRole('button', { name: /personalizza form/i }))

    const titleInput = await screen.findByLabelText(/^titolo$/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Nuovo titolo pagina')

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
    const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
    await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))

    await waitFor(() => {
      expect(extractSavedKeys()).toContain('booking_public_form_config')
    })
  })

  it('save aggregato: una modale pubblica con anagrafica e form dirty', async () => {
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
      expect(mutateAsyncSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(extractSavedKeys()).toEqual(
        expect.arrayContaining(['restaurant_name', 'booking_public_form_config']),
      )
    })
  })

  it('BookingFormConfigPanel con hideSaveUi non registra handler paralleli sul guard', async () => {
    registerUnsavedHandlersSpy.mockClear()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>
          <BookingFormConfigPanel hideSaveUi onDirtyChange={() => undefined} />
        </UnsavedChangesProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const bookingFormHandlerCalls = registerUnsavedHandlersSpy.mock.calls.filter(
        ([id]) => id === 'booking-form-config',
      )
      expect(bookingFormHandlerCalls).toHaveLength(0)
    })
  })
})
