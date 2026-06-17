// @admin-blindatura: settings-theme
// Copre: dirty tema, anteprima senza persist, Annulla ripristina, Salva app_theme, asset mancante safe

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest'

const mutateAsyncSpy = vi.fn()

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
  app_theme: 'midnight-blue',
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
  const { parseAppThemeFromDb } = await import('@/features/booking/constants/appTheme')
  return {
    useRestaurantSetting: (key: string) => {
      const raw = restaurantSettingsData[key as keyof typeof restaurantSettingsData] ?? null
      if (key === 'app_theme') {
        return {
          data: parseAppThemeFromDb(raw),
          isSuccess: true,
          isPending: false,
          error: null,
        }
      }
      return {
        data: raw,
        isSuccess: true,
        isPending: false,
        error: null,
      }
    },
    useUpsertRestaurantSetting: () => ({
      mutateAsync: mutateAsyncSpy,
      isPending: false,
    }),
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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { getDefaultBusinessHours } from '@/lib/businessHours'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import {
  DEFAULT_BOOKING_PAGE_BACKGROUND,
  DEFAULT_BOOKING_STRIP_PHOTO,
} from '@/features/booking/constants/bookingPageBackground'
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

function getLastSaveItems(): Array<{ key: string; value: unknown }> {
  const calls = mutateAsyncSpy.mock.calls
  const lastCall = calls.length > 0 ? calls[calls.length - 1][0] : undefined
  if (!lastCall) return []
  if (Array.isArray(lastCall)) return lastCall
  return lastCall.items ?? []
}

async function pickTheme(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`Seleziona tema: ${label}`, 'i') }))
}

async function discardAllChanges(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /annulla tutte/i }))
  const discardDialog = await screen.findByRole('dialog', { name: /annullare tutte le modifiche/i })
  await user.click(within(discardDialog).getByRole('button', { name: /annulla tutte/i }))
  await waitFor(() => {
    expect(screen.queryByRole('region', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })
}

async function clickModalFooterChiudi(
  dialog: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
) {
  const chiudiBtn = within(dialog)
    .getAllByRole('button', { name: /^chiudi$/i })
    .find((btn) => btn.textContent?.trim() === 'Chiudi')
  expect(chiudiBtn).toBeTruthy()
  await user.click(chiudiBtn!)
}

async function saveThroughPublicModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /salva modifiche/i }))
  const publicDialog = await screen.findByRole('dialog', { name: /salva modifiche pubbliche/i })
  await user.click(within(publicDialog).getByRole('button', { name: /^salva$/i }))
  await waitFor(() => {
    expect(mutateAsyncSpy).toHaveBeenCalled()
  })
}

describe('settings-theme M4 — UI Impostazioni', () => {
  beforeAll(() => {
    vi.stubGlobal('__APP_VERSION__', 'test')
    vi.stubGlobal('__BUILD_COMMIT__', 'test-commit')
    vi.stubGlobal('__BUILD_DATE__', '2026-01-01')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncSpy.mockResolvedValue(undefined)
    restaurantSettingsData.restaurant_name = 'Locale Test'
    restaurantSettingsData.business_hours = getDefaultBusinessHours()
    restaurantSettingsData.public_booking_page_background = DEFAULT_BOOKING_PAGE_BACKGROUND
    restaurantSettingsData.public_booking_strip_photo = DEFAULT_BOOKING_STRIP_PHOTO
    restaurantSettingsData.app_theme = DEFAULT_APP_THEME
    restaurantSettingsData.booking_public_form_config = null
  })

  it('scelta tema diversa imposta dirty e mostra footer', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    expect(screen.queryByRole('region', { name: /modifiche non salvate/i })).not.toBeInTheDocument()

    await pickTheme(user, 'Terracotta & Sand')

    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('anteprima grande: Chiudi non persiste e non chiama mutation', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    await user.click(screen.getByRole('button', { name: /ingrandisci anteprima: terracotta & sand/i }))

    const previewDialog = await screen.findByRole('dialog', { name: /terracotta & sand/i })
    expect(within(previewDialog).getByText(/anteprima a schermo intero/i)).toBeInTheDocument()

    await clickModalFooterChiudi(previewDialog, user)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /terracotta & sand/i })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('region', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('anteprima grande: Usa questo tema imposta dirty ma non salva da sola', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    await user.click(screen.getByRole('button', { name: /ingrandisci anteprima: sage & stone/i }))

    const previewDialog = await screen.findByRole('dialog', { name: /sage & stone/i })
    await user.click(within(previewDialog).getByRole('button', { name: /usa questo tema/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /sage & stone/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
    expect(mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('Annulla tutte ripristina il tema salvato', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    await pickTheme(user, 'Warm Sand Pro')
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()

    await discardAllChanges(user)

    await pickTheme(user, 'Warm Sand Pro')
    expect(screen.getByRole('region', { name: /modifiche non salvate/i })).toBeInTheDocument()
  })

  it('Salva tema-only persiste app_theme senza toccare sfondo Prenota', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    await pickTheme(user, 'Pearl Blue Minimal')
    await saveThroughPublicModal(user)

    const items = getLastSaveItems()
    const themeItem = items.find((item) => item.key === 'app_theme')
    expect(themeItem?.value).toBe('pearl-blue-minimal')
    expect(items.some((item) => item.key === 'public_booking_page_background')).toBe(false)
    expect(items.some((item) => item.key === 'public_booking_strip_photo')).toBe(false)
  })

  it('ID tema sconosciuto in DB: pagina renderizza con default', async () => {
    restaurantSettingsData.app_theme = 'tema-legacy-sconosciuto'
    renderSettingsTab()

    await screen.findByRole('heading', { name: /selezione tema app/i })
    expect(screen.getByRole('button', { name: /seleziona tema: midnight blue/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('anteprima asset mancante: fallback testuale senza crash', async () => {
    const user = userEvent.setup()
    renderSettingsTab()

    const heading = await screen.findByRole('heading', { name: /selezione tema app/i })
    const section = heading.closest('section')
    expect(section).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /ingrandisci anteprima: midnight blue/i }))
    const previewDialog = await screen.findByRole('dialog', { name: /midnight blue/i })
    const modalImg = previewDialog.querySelector('img')
    expect(modalImg).toBeTruthy()
    fireEvent.error(modalImg!)
    expect(within(previewDialog).getByText(/anteprima non disponibile/i)).toBeInTheDocument()
    await clickModalFooterChiudi(previewDialog, user)

    const cardImg = section!.querySelector('img')
    expect(cardImg).toBeTruthy()
    fireEvent.error(cardImg!)
    expect(await within(section!).findByText(/anteprima in arrivo/i)).toBeInTheDocument()
  })
})
