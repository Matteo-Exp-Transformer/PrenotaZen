// @admin-blindatura: settings-form-config-header
// Copre: persistenza page_description (footer PROD, cache stale) + font dropdown per opzione

import '@testing-library/jest-dom/vitest'
import { createRef } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  BOOKING_HEADER_FONT_OPTIONS,
  DEFAULT_BOOKING_FORM_CONFIG,
  normalizeBookingPublicFormConfig,
  type BookingPublicFormConfig,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import {
  BookingFormConfigPanel,
  type BookingFormConfigPanelHandle,
} from '../settings/BookingFormConfigPanel'

const MODE_ID = 'tavolo'
const CARD_ID = 'card-aaaa-1111-1111-111111111111'

const restaurantSettingsData = vi.hoisted(() => ({
  booking_public_form_config: null as BookingPublicFormConfig | null,
  restaurant_name: 'Locale Test',
  booking_custom_staff_presets: [] as unknown[],
  booking_menu_promos: [] as unknown[],
}))

const mutateAsyncSpy = vi.hoisted(() => vi.fn())

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/config/settingsAutosave', () => ({
  SETTINGS_AUTOSAVE_ENABLED: false,
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({
    tenantId: 'tenant-test',
    organizationName: 'Org Test',
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

vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))

vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({ data: [] }),
}))

vi.mock('@/features/booking/hooks/useDebouncedSettingsAutosave', () => ({
  useDebouncedSettingsAutosave: () => ({
    notifyFieldChange: vi.fn(),
    flushField: vi.fn(),
    cancelPending: vi.fn(),
    fieldStatus: {},
  }),
}))

vi.mock('@/features/booking/components/settings/BookingFormCarouselEditor', () => ({
  BookingFormCarouselEditor: () => <div data-testid="carousel-editor-stub" />,
}))

function makeCard(id: string, label: string): SubTab {
  return {
    id,
    display: 'cards',
    label,
    icon: 'fork_knife',
    hidden_category_keys: [],
    hidden_item_ids: [],
  }
}

function makeConfig(subTabs: SubTab[], pageDescription: string): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    ...DEFAULT_BOOKING_FORM_CONFIG,
    page_description: pageDescription,
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) =>
      mode.id === MODE_ID
        ? {
            ...mode,
            enabled: true,
            sub_tabs_enabled: true,
            sub_tabs_presentation: 'cards' as const,
            sub_tabs: subTabs,
          }
        : mode,
    ),
  })
}

function extractFormConfigPayloads(): BookingPublicFormConfig[] {
  return mutateAsyncSpy.mock.calls
    .flatMap((call) => {
      const arg = call[0]
      const items = Array.isArray(arg) ? arg : arg.items
      return items as { key: string; value: unknown }[]
    })
    .filter((item) => item.key === 'booking_public_form_config')
    .map((item) => item.value as BookingPublicFormConfig)
}

function renderPanelWithRef() {
  const panelRef = createRef<BookingFormConfigPanelHandle>()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <UnsavedChangesProvider>
        <BookingFormConfigPanel ref={panelRef} hideSaveUi />
      </UnsavedChangesProvider>
    </QueryClientProvider>,
  )
  return panelRef
}

describe('settings-form-config header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncSpy.mockResolvedValue(undefined)
    restaurantSettingsData.booking_public_form_config = makeConfig(
      [makeCard(CARD_ID, 'Pranzo domenicale')],
      DEFAULT_BOOKING_FORM_CONFIG.page_description,
    )
  })

  it('font dropdown: ogni option espone fontFamily del proprio font', async () => {
    renderPanelWithRef()

    const fontSelects = await screen.findAllByRole('combobox')
    const firstFontSelect = fontSelects[0]
    const options = Array.from(firstFontSelect.querySelectorAll('option'))

    expect(options).toHaveLength(BOOKING_HEADER_FONT_OPTIONS.length)
    options.forEach((option, index) => {
      expect(option).toHaveStyle({
        fontFamily: BOOKING_HEADER_FONT_OPTIONS[index].fontFamily,
      })
    })
  })

  it('salva page_description dal footer anche se la cache react-query è ancora stale', async () => {
    const user = userEvent.setup()
    const panelRef = renderPanelWithRef()

    const descriptionInput = await screen.findByLabelText(/^descrizione$/i)
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Descrizione personalizzata salvata')

    await panelRef.current?.saveAll()

    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalled()
    })

    const payloads = extractFormConfigPayloads()
    expect(payloads.length).toBeGreaterThanOrEqual(1)
    expect(payloads[payloads.length - 1].page_description).toBe('Descrizione personalizzata salvata')
  })

  it('save combinato header+modalità: il secondo upsert non ripristina page_description dal baseline stale', async () => {
    const user = userEvent.setup()
    const panelRef = renderPanelWithRef()

    const descriptionInput = await screen.findByLabelText(/^descrizione$/i)
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Testo descrizione nuovo')

    const modeButton = document.querySelector(`[data-mode-id="${MODE_ID}"]`)
    expect(modeButton).toBeTruthy()
    await user.click(modeButton as HTMLElement)

    const modeLabelInput = await screen.findByPlaceholderText(/nome della modalità/i)
    await user.clear(modeLabelInput)
    await user.type(modeLabelInput, 'Tavolo rinominato')

    await panelRef.current?.saveAll()

    await waitFor(() => {
      expect(mutateAsyncSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    const payloads = extractFormConfigPayloads()
    expect(payloads.length).toBeGreaterThanOrEqual(2)
    for (const payload of payloads) {
      expect(payload.page_description).toBe('Testo descrizione nuovo')
    }
  })
})
