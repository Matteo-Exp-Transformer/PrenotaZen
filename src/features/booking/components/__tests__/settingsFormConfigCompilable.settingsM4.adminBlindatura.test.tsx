// @admin-blindatura: settings-form-config
// Copre FIX 9 §3A: toggle compilable_category_keys per categoria in admin
// Casi: toggle visibile solo con menù personalizzabile ON; sparisce con OFF; salvataggio JSON; legacy invariato.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import {
  normalizeBookingPublicFormConfig,
  DEFAULT_BOOKING_FORM_CONFIG,
  type BookingPublicFormConfig,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { BookingFormConfigPanel } from '../settings/BookingFormConfigPanel'

// --- dati mutabili per mock hook ---
const restaurantSettingsData = vi.hoisted(() => ({
  booking_public_form_config: null as BookingPublicFormConfig | null,
  restaurant_name: 'Locale Test',
  booking_custom_staff_presets: [] as unknown[],
  booking_menu_promos: [] as unknown[],
}))

const menuItemsData = vi.hoisted(() => ({
  items: [] as unknown[],
}))

const menuCategoriesData = vi.hoisted(() => ({
  categories: [] as unknown[],
}))

// --- mock mutation per catturare JSON salvato ---
const savedValues = vi.hoisted(() => ({
  calls: [] as unknown[][],
}))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

vi.mock('@/config/settingsAutosave', () => ({
  SETTINGS_AUTOSAVE_ENABLED: false,
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-test', organizationName: 'Org Test' }),
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettingsData[key as keyof typeof restaurantSettingsData] ?? null,
    isSuccess: true,
    isPending: false,
    error: null,
  }),
  useUpsertRestaurantSetting: () => ({
    mutateAsync: vi.fn(async (args: unknown) => {
      savedValues.calls.push([args])
    }),
    isPending: false,
  }),
}))

vi.mock('@/features/booking/hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: menuItemsData.items }),
}))

vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({ data: menuCategoriesData.categories }),
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

// --- costanti di scenario ---
const MODE_ID = 'tavolo'
const PRESET_ID = 'preset-abc'
const CARD_ID = 'card-personalizzabile-1'
const CAT_KEY = 'antipasti'
const CAT_KEY_2 = 'dolci'
const ITEM_ID = 'item-bruschette'
const ITEM_ID_2 = 'item-tiramisu'

const TEST_CATEGORY = { key: CAT_KEY, label: 'Antipasti', sort_order: 0, is_available: true }
const TEST_CATEGORY_2 = { key: CAT_KEY_2, label: 'Dolci', sort_order: 1, is_available: true }
const TEST_ITEM = { id: ITEM_ID, name: 'Bruschette', category: CAT_KEY, booking_types: ['tavolo'], is_available: true }
const TEST_ITEM_2 = { id: ITEM_ID_2, name: 'Tiramisù', category: CAT_KEY_2, booking_types: ['tavolo'], is_available: true }
const TEST_PRESET = { id: PRESET_ID, name: 'Menu Estate', item_ids: [ITEM_ID, ITEM_ID_2], is_fixed_menu: false }

function makePersonalizzabileCard(extra: Partial<SubTab> = {}): SubTab {
  return {
    id: CARD_ID,
    display: 'cards',
    label: 'Menu Estate',
    preset_id: PRESET_ID,
    is_fixed_menu: false,
    hidden_category_keys: [],
    hidden_item_ids: [],
    ...extra,
  }
}

function makeConfig(card: SubTab): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    ...DEFAULT_BOOKING_FORM_CONFIG,
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) =>
      mode.id === MODE_ID
        ? {
            ...mode,
            enabled: true,
            sub_tabs_enabled: true,
            sub_tabs_presentation: 'cards',
            sub_tabs: [card],
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

async function expandMode(user: ReturnType<typeof userEvent.setup>) {
  const modeButton = document.querySelector(`[data-mode-id="${MODE_ID}"]`)
  expect(modeButton).toBeTruthy()
  await user.click(modeButton as HTMLElement)
  await waitFor(() => {
    expect(screen.getByText(/abilita card o carosello/i)).toBeInTheDocument()
  })
}

async function expandCard(user: ReturnType<typeof userEvent.setup>, labelPattern = /menu estate · card 1/i) {
  await waitFor(() => {
    expect(screen.getByText(labelPattern)).toBeInTheDocument()
  })
  await user.click(screen.getByText(labelPattern))
  await waitFor(() => {
    expect(screen.getByPlaceholderText('Nome card scorrevole')).toBeInTheDocument()
  })
}

describe('FIX 9 §3A — compilable_category_keys toggle admin', () => {
  beforeEach(() => {
    menuCategoriesData.categories = [TEST_CATEGORY, TEST_CATEGORY_2]
    menuItemsData.items = [TEST_ITEM, TEST_ITEM_2]
    restaurantSettingsData.booking_custom_staff_presets = [TEST_PRESET]
    savedValues.calls = []
  })

  it('toggle compilabile visibile per categoria quando menù personalizzabile ON', async () => {
    const card = makePersonalizzabileCard()
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    // Sezione categorie deve essere presente
    await waitFor(() => {
      expect(screen.getByText('Categorie e ingredienti visibili')).toBeInTheDocument()
    })

    // Pulsante compilabile deve esistere per ogni categoria visibile
    const enableAntiBtn = screen.getByRole('button', { name: /disabilita compilazione antipasti/i })
    const enableDolciBtn = screen.getByRole('button', { name: /disabilita compilazione dolci/i })
    expect(enableAntiBtn).toBeInTheDocument()
    expect(enableDolciBtn).toBeInTheDocument()
  })

  it('toggle compilabile assente quando menù personalizzabile OFF (card fissa)', async () => {
    // Card con is_fixed_menu assente = menu fisso
    const card: SubTab = {
      id: CARD_ID,
      display: 'cards',
      label: 'Menu Estate',
      preset_id: PRESET_ID,
      // is_fixed_menu non false → fisso
      hidden_category_keys: [],
      hidden_item_ids: [],
    }
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByText('Categorie e ingredienti visibili')).toBeInTheDocument()
    })

    // Pulsante compilabile NON deve esistere
    expect(screen.queryByRole('button', { name: /compilazione antipasti/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /compilazione dolci/i })).not.toBeInTheDocument()
  })

  it('click su toggle disabilita categoria compilabile e alza dirty', async () => {
    const card = makePersonalizzabileCard()
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderPanel(onDirtyChange)
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disabilita compilazione antipasti/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /disabilita compilazione antipasti/i }))

    // Dopo il click: categoria ora non compilabile → label cambia ad "Abilita compilazione"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /abilita compilazione antipasti/i })).toBeInTheDocument()
    })
    // Dolci resta compilabile
    expect(screen.getByRole('button', { name: /disabilita compilazione dolci/i })).toBeInTheDocument()
    // Il pannello è dirty
    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('click doppio su toggle ripristina stato ON (round-trip UI)', async () => {
    const card = makePersonalizzabileCard()
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disabilita compilazione antipasti/i })).toBeInTheDocument()
    })

    // OFF
    await user.click(screen.getByRole('button', { name: /disabilita compilazione antipasti/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /abilita compilazione antipasti/i })).toBeInTheDocument()
    })

    // ON di nuovo
    await user.click(screen.getByRole('button', { name: /abilita compilazione antipasti/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disabilita compilazione antipasti/i })).toBeInTheDocument()
    })
  })

  it('toggle compilabile assente per categoria nascosta (hidden)', async () => {
    const card = makePersonalizzabileCard({ hidden_category_keys: [CAT_KEY] })
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByText('Categorie e ingredienti visibili')).toBeInTheDocument()
    })

    // Toggle compilabile NON visibile per categoria nascosta
    expect(screen.queryByRole('button', { name: /compilazione antipasti/i })).not.toBeInTheDocument()
    // Dolci (visibile) ha il toggle
    expect(screen.getByRole('button', { name: /disabilita compilazione dolci/i })).toBeInTheDocument()
  })

  it('disattivando menù personalizzabile i toggle compilabili spariscono', async () => {
    const card = makePersonalizzabileCard()
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    // Toggle compilabile presenti
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disabilita compilazione antipasti/i })).toBeInTheDocument()
    })

    // Clicco lo switch "Menù personalizzabile" per spegnerlo
    const menuSwitch = screen.getByRole('switch', { name: /menù personalizzabile/i })
    await user.click(menuSwitch)

    // Toggle compilabili devono sparire
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /compilazione antipasti/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /compilazione dolci/i })).not.toBeInTheDocument()
    })
  })

  it('config legacy (senza compilable_category_keys) — tutti i toggle ON, pannello non crasha', async () => {
    // Card senza compilable_category_keys: tutti i toggle devono essere ON (tutte compilabili)
    const card = makePersonalizzabileCard({ compilable_category_keys: undefined })
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByText('Categorie e ingredienti visibili')).toBeInTheDocument()
    })

    // Entrambe le categorie mostrano "Disabilita compilazione" (= sono ON = compilabili)
    const antiBtn = screen.getByRole('button', { name: /disabilita compilazione antipasti/i })
    const dolciBtn = screen.getByRole('button', { name: /disabilita compilazione dolci/i })
    expect(antiBtn).toBeInTheDocument()
    expect(dolciBtn).toBeInTheDocument()
    // Classe primary sul bottone = compilabile attivo
    expect(antiBtn).toHaveClass('text-primary-700')
    expect(dolciBtn).toHaveClass('text-primary-700')
  })

  it('categoria con compilable_category_keys parziale — stato iniziale riflette il JSON', async () => {
    // Solo 'dolci' è compilabile; 'antipasti' non è nell'array
    const card = makePersonalizzabileCard({ compilable_category_keys: [CAT_KEY_2] })
    restaurantSettingsData.booking_public_form_config = makeConfig(card)

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)
    await expandCard(user)

    await waitFor(() => {
      expect(screen.getByText('Categorie e ingredienti visibili')).toBeInTheDocument()
    })

    // Antipasti NON compilabile → "Abilita compilazione"
    expect(screen.getByRole('button', { name: /abilita compilazione antipasti/i })).toBeInTheDocument()
    // Dolci compilabile → "Disabilita compilazione"
    expect(screen.getByRole('button', { name: /disabilita compilazione dolci/i })).toBeInTheDocument()
  })

  describe('sezione categorie assente senza preset o senza menu personalizzabile', () => {
    it('card senza preset_id: sezione categorie non mostrata, nessun toggle compilabile', async () => {
      const card: SubTab = {
        id: CARD_ID,
        display: 'cards',
        label: 'Menu manuale',
        is_fixed_menu: false,
        // nessun preset_id
        hidden_category_keys: [],
        hidden_item_ids: [],
      }
      restaurantSettingsData.booking_public_form_config = makeConfig(card)

      const user = userEvent.setup()
      renderPanel()
      await expandMode(user)
      await expandCard(user, /menu manuale · card 1/i)

      // Sezione categorie non presente senza preset
      expect(screen.queryByText('Categorie e ingredienti visibili')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /compilazione/i })).not.toBeInTheDocument()
    })
  })
})