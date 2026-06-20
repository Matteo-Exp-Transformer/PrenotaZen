// @admin-blindatura: settings-form-config
// Copre: delete card/carosello (riga collassata + editor/headerActions); zero modalità attive;
// cap testi header/modalità/card; config legacy/null safe; pubblico senza form inventato

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import {
  DEFAULT_BOOKING_FORM_CONFIG,
  normalizeBookingPublicFormConfig,
  type BookingPublicFormConfig,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS } from '@/features/booking/constants/bookingPrenotaTextLimits'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { BookingFormConfigPanel } from '../settings/BookingFormConfigPanel'
import { BookingRequestForm } from '../BookingRequestForm'

const MODE_ID = 'tavolo'
const CARD_ID_1 = 'card-aaaa-1111-1111-111111111111'
const CARD_ID_2 = 'card-bbbb-2222-2222-222222222222'
const CAROUSEL_ID = 'carousel-cccc-3333-3333-333333333333'

const restaurantSettingsData = vi.hoisted(() => ({
  booking_public_form_config: null as BookingPublicFormConfig | null,
  restaurant_name: 'Locale Test',
  booking_custom_staff_presets: [] as unknown[],
  booking_menu_promos: [] as unknown[],
}))

const scrollIntoCenterMock = vi.hoisted(() => ({
  scheduleScrollIntoCenter: vi.fn(() => vi.fn()),
}))

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
    mutateAsync: vi.fn(),
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

vi.mock('@/features/booking/lib/scrollIntoCenter', () => ({
  scheduleScrollIntoCenter: scrollIntoCenterMock.scheduleScrollIntoCenter,
}))

vi.mock('@/features/booking/components/settings/BookingFormCarouselEditor', () => ({
  BookingFormCarouselEditor: () => <div data-testid="carousel-editor-stub" />,
}))

vi.mock('@/features/booking/hooks/useBookingRequests', () => ({
  useCreateBookingRequest: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useRateLimit', () => ({
  useRateLimit: () => ({ checkRateLimit: () => true, isBlocked: false }),
}))
vi.mock('@/hooks/useBusinessHours', () => ({
  useBusinessHours: () => ({ data: null, isLoading: false, error: null }),
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

function makeCarousel(id: string, label: string): SubTab {
  return {
    id,
    display: 'carousel',
    label,
    icon: 'fork_knife',
    carousel_items: [{ image_url: 'https://example.com/photo.webp', title: 'Slide 1', sort_order: 0 }],
  }
}

function makeConfig(presentation: 'cards' | 'carousel', subTabs: SubTab[]): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    ...DEFAULT_BOOKING_FORM_CONFIG,
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) =>
      mode.id === MODE_ID
        ? {
            ...mode,
            enabled: true,
            sub_tabs_enabled: true,
            sub_tabs_presentation: presentation,
            sub_tabs: subTabs,
          }
        : mode,
    ),
  })
}

function renderPanel(onDirtyChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    onDirtyChange,
    ...render(
      <QueryClientProvider client={client}>
        <UnsavedChangesProvider>
          <BookingFormConfigPanel hideSaveUi onDirtyChange={onDirtyChange} />
        </UnsavedChangesProvider>
      </QueryClientProvider>,
    ),
  }
}

async function expandMode(user: ReturnType<typeof userEvent.setup>, modeId = MODE_ID) {
  const modeButton = document.querySelector(`[data-mode-id="${modeId}"]`)
  expect(modeButton).toBeTruthy()
  await user.click(modeButton as HTMLElement)
  await waitFor(() => {
    expect(screen.getByText(/abilita card o carosello/i)).toBeInTheDocument()
  })
}

function deleteButtonLabel(summary: string): RegExp {
  return new RegExp(`elimina ${summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
}

function latestCenterTarget(): Element | null {
  const calls = scrollIntoCenterMock.scheduleScrollIntoCenter.mock.calls as unknown as Array<
    [() => Element | null]
  >
  const resolveTarget = calls[calls.length - 1]?.[0] as (() => Element | null) | undefined
  return resolveTarget?.() ?? null
}

beforeEach(() => {
  scrollIntoCenterMock.scheduleScrollIntoCenter.mockClear()
})

describe('settings-form-config centratura elemento aperto', () => {
  it('apertura modalità, card scorrevole e carosello passano dal helper riusabile', async () => {
    const user = userEvent.setup()
    const card = makeCard(CARD_ID_1, 'Pranzo domenicale')
    restaurantSettingsData.booking_public_form_config = makeConfig('cards', [card])
    renderPanel()

    await expandMode(user)
    await waitFor(() => {
      expect(scrollIntoCenterMock.scheduleScrollIntoCenter).toHaveBeenCalled()
    })
    expect(latestCenterTarget()).toHaveAttribute('data-booking-center-target', `mode-${MODE_ID}`)

    scrollIntoCenterMock.scheduleScrollIntoCenter.mockClear()
    await user.click(screen.getByText(/pranzo domenicale · card 1/i))
    await waitFor(() => {
      expect(scrollIntoCenterMock.scheduleScrollIntoCenter).toHaveBeenCalled()
    })
    expect(latestCenterTarget()).toHaveAttribute(
      'data-booking-center-target',
      `subtab-${MODE_ID}-${CARD_ID_1}`,
    )

    scrollIntoCenterMock.scheduleScrollIntoCenter.mockClear()
    cleanup()
    restaurantSettingsData.booking_public_form_config = makeConfig('carousel', [])
    renderPanel()

    await expandMode(user)
    scrollIntoCenterMock.scheduleScrollIntoCenter.mockClear()
    await user.click(screen.getByRole('button', { name: /\+ carosello/i }))
    await waitFor(() => {
      expect(scrollIntoCenterMock.scheduleScrollIntoCenter).toHaveBeenCalled()
    })
    expect(latestCenterTarget()).toHaveAttribute('data-booking-center-target', `draft-${MODE_ID}`)
  })
})

describe('settings-form-config delete card/carosello', () => {
  const card1 = makeCard(CARD_ID_1, 'Pranzo domenicale')
  const card2 = makeCard(CARD_ID_2, 'Cena speciale')

  beforeEach(() => {
    restaurantSettingsData.booking_public_form_config = makeConfig('cards', [card1, card2])
  })

  it('mostra modale sulla riga collassata: annulla non rimuove, conferma alza dirty', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderPanel(onDirtyChange)

    await expandMode(user)
    await waitFor(() => {
      expect(screen.getByText(/pranzo domenicale · card 1/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: deleteButtonLabel('Pranzo domenicale · Card 1') }))

    const dialog = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
    expect(within(dialog).getByText(/pranzo domenicale · card 1/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/salva modifiche/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^annulla$/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /eliminare card\/carosello/i })).not.toBeInTheDocument()
    })
    expect(screen.getByText(/pranzo domenicale · card 1/i)).toBeInTheDocument()
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)

    await user.click(screen.getByRole('button', { name: deleteButtonLabel('Pranzo domenicale · Card 1') }))
    const dialogAgain = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
    await user.click(within(dialogAgain).getByRole('button', { name: /^elimina$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/pranzo domenicale · card 1/i)).not.toBeInTheDocument()
      expect(screen.getByText(/cena speciale · card 1/i)).toBeInTheDocument()
    })
    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('mostra modale dal cestino nell’editor (spostato in headerActions quando espanso)', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderPanel(onDirtyChange)

    await expandMode(user)
    await waitFor(() => {
      expect(screen.getByText(/cena speciale · card 2/i)).toBeInTheDocument()
    })

    await user.click(screen.getByText(/cena speciale · card 2/i))
    expect(screen.getByLabelText(/titolo card/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: deleteButtonLabel('Cena speciale · Card 2') })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: deleteButtonLabel('Cena speciale · Card 2') }))

    const dialog = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
    expect(within(dialog).getByText(/cena speciale · card 2/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^elimina$/i }))

    await waitFor(() => {
      expect(screen.queryByText(/cena speciale · card 2/i)).not.toBeInTheDocument()
      expect(screen.getByText(/pranzo domenicale · card 1/i)).toBeInTheDocument()
    })
    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  describe('carosello', () => {
    const carousel = makeCarousel(CAROUSEL_ID, 'Offerte estate')
    const carouselRowSummary = 'Offerte estate'

    beforeEach(() => {
      restaurantSettingsData.booking_public_form_config = makeConfig('carousel', [carousel])
    })

    it('riga collassata: annulla non rimuove, conferma alza dirty', async () => {
      const user = userEvent.setup()
      const onDirtyChange = vi.fn()
      renderPanel(onDirtyChange)

      await expandMode(user)
      await waitFor(() => {
        expect(screen.getByText(/offerte estate/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: deleteButtonLabel(carouselRowSummary) }))

      const dialog = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
      expect(within(dialog).getByText(/offerte estate/i)).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: /^annulla$/i }))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /eliminare card\/carosello/i })).not.toBeInTheDocument()
      })
      expect(screen.getByText(/offerte estate/i)).toBeInTheDocument()
      expect(onDirtyChange).not.toHaveBeenCalledWith(true)

      await user.click(screen.getByRole('button', { name: deleteButtonLabel(carouselRowSummary) }))
      const dialogAgain = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
      await user.click(within(dialogAgain).getByRole('button', { name: /^elimina$/i }))

      await waitFor(() => {
        expect(screen.queryByText(/offerte estate/i)).not.toBeInTheDocument()
      })
      expect(onDirtyChange).toHaveBeenCalledWith(true)
    })

    it('riga espansa: cestino in headerActions, delete con modale alza dirty', async () => {
      const user = userEvent.setup()
      const onDirtyChange = vi.fn()
      renderPanel(onDirtyChange)

      await expandMode(user)
      await waitFor(() => {
        expect(screen.getByText(/offerte estate/i)).toBeInTheDocument()
      })

      await user.click(screen.getByText(/offerte estate/i))

      await waitFor(() => {
        expect(screen.getByText('Nome carosello')).toBeInTheDocument()
        expect(screen.getByTestId('carousel-editor-stub')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: deleteButtonLabel(carouselRowSummary) })
      expect(deleteButtons).toHaveLength(1)

      await user.click(deleteButtons[0])

      const dialog = await screen.findByRole('dialog', { name: /eliminare card\/carosello/i })
      expect(within(dialog).getByText(/offerte estate/i)).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: /^elimina$/i }))

      await waitFor(() => {
        expect(screen.queryByText(/offerte estate/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('carousel-editor-stub')).not.toBeInTheDocument()
      })
      expect(onDirtyChange).toHaveBeenCalledWith(true)
    })
  })
})

function makeAllModesDisabledConfig(): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    ...DEFAULT_BOOKING_FORM_CONFIG,
    page_title: 'Titolo salvato',
    page_description: 'Descrizione salvata',
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) => ({
      ...mode,
      enabled: false,
    })),
  })
}

describe('settings-form-config zero modalità attive', () => {
  beforeEach(() => {
    restaurantSettingsData.booking_public_form_config = makeAllModesDisabledConfig()
  })

  it('admin: nessuna modalità abilitata mostra placeholder editor, non form demo pubblico', async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(await screen.findByText(/intestazione pagina prenota/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Titolo salvato')).toBeInTheDocument()

    await expandMode(user)
    expect(screen.getByPlaceholderText(/nome della modalità/i)).toHaveValue('Compila nome tipologia')
    expect(screen.queryByText(/pranzo al tavolo|menu degustazione|rinfresco di laurea/i)).not.toBeInTheDocument()
  })

  it('pubblico: BookingRequestForm non renderizza il form se tutte le modalità sono disabilitate', () => {
    const config = makeAllModesDisabledConfig()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingRequestForm formConfig={config} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(container.querySelector('#booking-request-form')).toBeNull()
    expect(screen.queryByRole('button', { name: /invia prenotazione/i })).not.toBeInTheDocument()
  })
})

describe('settings-form-config cap testi header/modalità', () => {
  beforeEach(() => {
    restaurantSettingsData.booking_public_form_config = makeConfig('cards', [])
  })

  it('page_title rispetta il cap UI senza superare il limite Prenota', async () => {
    renderPanel()

    const titleInput = await screen.findByLabelText(/^titolo$/i)
    const overCap = 'T'.repeat(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.pageTitle + 15)
    fireEvent.change(titleInput, { target: { value: overCap } })

    expect((titleInput as HTMLInputElement).value).toHaveLength(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.pageTitle,
    )
    expect(
      screen.getByText(`${BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.pageTitle}/${BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.pageTitle}`),
    ).toHaveClass('text-red-500')
  })

  it('titolo modalità rispetta il cap modeLabel in admin', async () => {
    const user = userEvent.setup()
    renderPanel()

    await expandMode(user)
    const modeLabelInput = await screen.findByLabelText(/titolo card/i)
    const overCap = 'M'.repeat(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.modeLabel + 10)
    fireEvent.change(modeLabelInput, { target: { value: overCap } })

    expect((modeLabelInput as HTMLInputElement).value).toHaveLength(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.modeLabel,
    )
  })

  it('card salvata in editor: titolo e descrizione rispettano subTabLabel/subTabDescription', async () => {
    const card = { ...makeCard(CARD_ID_1, 'Pranzo domenicale'), description: 'Breve intro' }
    restaurantSettingsData.booking_public_form_config = makeConfig('cards', [card])

    const user = userEvent.setup()
    renderPanel()

    await expandMode(user)
    await waitFor(() => {
      expect(screen.getByText(/pranzo domenicale · card 1/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/pranzo domenicale · card 1/i))

    const cardTitleInput = await screen.findByPlaceholderText('Nome card scorrevole')
    const cardDescInput = screen.getByPlaceholderText('Sottotitolo sulla card')

    const overLabel = 'L'.repeat(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel + 8)
    fireEvent.change(cardTitleInput, { target: { value: overLabel } })
    expect((cardTitleInput as HTMLInputElement).value).toHaveLength(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
    )

    const overDesc = 'D'.repeat(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription + 12)
    fireEvent.change(cardDescInput, { target: { value: overDesc } })
    expect((cardDescInput as HTMLTextAreaElement).value).toHaveLength(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription,
    )
  })
})

describe('settings-form-config legacy/null safe', () => {
  it('config null in DB: pannello admin monta con seed editor, non crash', async () => {
    restaurantSettingsData.booking_public_form_config = null
    renderPanel()

    expect(await screen.findByText(/intestazione pagina prenota/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue(DEFAULT_BOOKING_FORM_CONFIG.page_title)).toBeInTheDocument()
  })

  it('config legacy malformata parsata: pannello admin monta senza crash', async () => {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota',
      page_description: 'Desc',
      booking_modes: [
        'non-un-oggetto',
        {
          id: 'm2',
          booking_type: 'menu_prezzo_fisso',
          enabled: true,
          label: 'Menu valido',
          description: 'D',
          icon: 'bowl_food',
          sub_tabs_enabled: false,
          sub_tabs: [null, { id: 'ok', label: 'Card ok', display: 'cards' }],
        },
      ],
    })
    expect(parsed).not.toBeNull()
    restaurantSettingsData.booking_public_form_config = parsed
    renderPanel()

    expect(await screen.findByText(/intestazione pagina prenota/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Prenota')).toBeInTheDocument()
  })

  it('pubblico: config legacy parsata da parseFromDb monta BookingRequestForm senza crash', async () => {
    const parsed = restaurantSettingRegistry.booking_public_form_config.parseFromDb({
      page_title: 'Prenota legacy',
      page_description: 'Desc legacy',
      booking_modes: [
        'non-un-oggetto',
        {
          id: 'tavolo',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo storico',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: false,
          sub_tabs: [],
        },
      ],
    })
    expect(parsed).not.toBeNull()

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingRequestForm formConfig={parsed!} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(container.querySelector('#booking-request-form')).toBeTruthy()
    // Con 1 sola modalità la card è un div non interattivo (niente button).
    await waitFor(() => {
      expect(screen.getByTestId('booking-mode-card-tavolo')).toBeInTheDocument()
    })
  })
})
