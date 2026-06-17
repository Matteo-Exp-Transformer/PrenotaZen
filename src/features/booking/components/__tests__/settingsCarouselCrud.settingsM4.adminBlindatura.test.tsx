// @admin-blindatura: settings-carousel-crud
// Copre: crea carosello admin, CRUD slide (testi/reorder/delete/add mock), effetto Prenota pubblico;
// upload/replace foto reale → mock Vitest (storage Supabase non in suite)

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChangeEvent } from 'react'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import {
  DEFAULT_BOOKING_FORM_CONFIG,
  normalizeBookingPublicFormConfig,
  parseBookingHeaderStylesFromUnknown,
  type BookingPublicFormConfig,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { BookingFormCarouselEditor } from '../settings/BookingFormCarouselEditor'
import { BookingFormConfigPanel } from '../settings/BookingFormConfigPanel'
import { BookingRequestForm } from '../BookingRequestForm'
import type { CarouselItem } from '@/types/menu'

const MODE_ID = 'tavolo'
const CAROUSEL_ID = 'carousel-cccc-3333-3333-333333333333'

const restaurantSettingsData = vi.hoisted(() => ({
  booking_public_form_config: null as BookingPublicFormConfig | null,
  restaurant_name: 'Locale Test',
  booking_custom_staff_presets: [] as unknown[],
  booking_menu_promos: [] as unknown[],
}))

const carouselUploadMock = vi.hoisted(() => ({
  reset() {},
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

vi.mock('@/features/booking/hooks/useCarouselPhotoUpload', () => ({
  bookingCarouselStoragePrefix: (tenantId: string, modeId: string, subTabId: string) =>
    `${tenantId}/booking-form/${modeId}/${subTabId}`,
  useCarouselPhotoUpload: ({
    items,
    onChange,
  }: {
    items: CarouselItem[]
    onChange: (items: CarouselItem[]) => void
  }) => ({
    fileRef: { current: null },
    uploading: false,
    canUpload: true,
    handleAddFile: vi.fn(async (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0]) return
      onChange([
        ...items,
        {
          image_url: `https://cdn.test/slide-${items.length + 1}.webp`,
          sort_order: items.length,
        },
      ])
    }),
    removeAt: vi.fn(async (index: number) => {
      onChange(items.filter((_, i) => i !== index).map((x, idx) => ({ ...x, sort_order: idx })))
    }),
    replaceAt: vi.fn(async (index: number, e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.[0] || index < 0 || index >= items.length) return
      onChange(
        items.map((it, i) =>
          i === index ? { ...it, image_url: `https://cdn.test/replaced-${index + 1}.webp` } : it,
        ),
      )
    }),
  }),
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

function makeCarouselTab(items: CarouselItem[] = []): SubTab {
  return {
    id: CAROUSEL_ID,
    display: 'carousel',
    label: 'Offerte estate',
    icon: 'fork_knife',
    carousel_items: items,
  }
}

function makeConfig(subTabs: SubTab[]): BookingPublicFormConfig {
  return normalizeBookingPublicFormConfig({
    ...DEFAULT_BOOKING_FORM_CONFIG,
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode) =>
      mode.id === MODE_ID
        ? {
            ...mode,
            enabled: true,
            sub_tabs_enabled: true,
            sub_tabs_presentation: 'carousel',
            sub_tabs: subTabs,
          }
        : mode,
    ),
  })
}

function lastPatch(onPatchTab: ReturnType<typeof vi.fn>): Partial<SubTab> {
  const calls = onPatchTab.mock.calls
  return calls[calls.length - 1][0] as Partial<SubTab>
}

function renderCarouselEditor(tab: SubTab, onPatchTab = vi.fn()) {
  return render(
    <BookingFormCarouselEditor
      tenantId="tenant-test"
      modeId={MODE_ID}
      tab={tab}
      onPatchTab={onPatchTab}
    />,
  )
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

describe('settings-carousel-crud — BookingFormCarouselEditor', () => {
  beforeEach(() => {
    carouselUploadMock.reset()
  })

  it('aggiunge slide mock, modifica testi e sostituisce foto', async () => {
    const onPatchTab = vi.fn()
    const user = userEvent.setup()
    renderCarouselEditor(makeCarouselTab(), onPatchTab)

    expect(
      screen.getByText(/carica una foto per compilare etichetta, titolo, icona e descrizione/i),
    ).toBeInTheDocument()

    const addInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const addFile = new File(['photo'], 'slide.webp', { type: 'image/webp' })
    await user.upload(addInput, addFile)
    await waitFor(() => {
      expect(onPatchTab).toHaveBeenCalled()
      const patch = lastPatch(onPatchTab)
      expect(patch.carousel_items).toHaveLength(1)
      expect(patch.carousel_items![0].image_url).toContain('slide-1.webp')
    })

    onPatchTab.mockClear()
    cleanup()
    renderCarouselEditor(
      makeCarouselTab([{ image_url: 'https://cdn.test/slide-1.webp', sort_order: 0 }]),
      onPatchTab,
    )

    const eyebrowInput = screen.getByPlaceholderText('Nome mostrato al cliente')
    fireEvent.change(eyebrowInput, { target: { value: 'Antipasti' } })
    await waitFor(() => {
      expect(lastPatch(onPatchTab).carousel_items![0].eyebrow).toBe('Antipasti')
    })

    const titleInput = screen.getByPlaceholderText('es. Tonno in crosta')
    fireEvent.change(titleInput, { target: { value: 'Tonno in crosta' } })
    await waitFor(() => {
      expect(lastPatch(onPatchTab).carousel_items![0].title).toBe('Tonno in crosta')
    })

    const replaceInput = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement
    const replaceFile = new File(['new'], 'replace.webp', { type: 'image/webp' })
    await user.upload(replaceInput, replaceFile)
    await waitFor(() => {
      expect(lastPatch(onPatchTab).carousel_items![0].image_url).toContain('replaced-1.webp')
    })
  })

  it('riordina slide con Sposta su/giù', async () => {
    const onPatchTab = vi.fn()
    const user = userEvent.setup()
    const items: CarouselItem[] = [
      { image_url: 'https://cdn.test/a.webp', title: 'Prima', sort_order: 0 },
      { image_url: 'https://cdn.test/b.webp', title: 'Seconda', sort_order: 1 },
    ]
    renderCarouselEditor(makeCarouselTab(items), onPatchTab)

    const moveDownButtons = screen.getAllByRole('button', { name: /sposta giù/i })
    expect(moveDownButtons[0]).not.toBeDisabled()
    await user.click(moveDownButtons[0])

    await waitFor(() => {
      const patch = lastPatch(onPatchTab)
      expect(patch.carousel_items!.map((s) => s.title)).toEqual(['Seconda', 'Prima'])
      expect(patch.carousel_items!.map((s) => s.sort_order)).toEqual([0, 1])
    })
  })

  it('elimina slide senza modale (Rimuovi foto)', async () => {
    const onPatchTab = vi.fn()
    const user = userEvent.setup()
    const items: CarouselItem[] = [
      { image_url: 'https://cdn.test/a.webp', title: 'Prima', sort_order: 0 },
      { image_url: 'https://cdn.test/b.webp', title: 'Seconda', sort_order: 1 },
    ]
    renderCarouselEditor(makeCarouselTab(items), onPatchTab)

    const removeButtons = screen.getAllByRole('button', { name: /rimuovi foto/i })
    await user.click(removeButtons[0])

    await waitFor(() => {
      const patch = lastPatch(onPatchTab)
      expect(patch.carousel_items).toHaveLength(1)
      expect(patch.carousel_items![0].title).toBe('Seconda')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('settings-carousel-crud — crea carosello in admin', () => {
  beforeEach(() => {
    restaurantSettingsData.booking_public_form_config = makeConfig([])
    carouselUploadMock.reset()
  })

  it('bozza carosello: pulsante + Carosello apre editor vuoto e alza dirty', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    renderPanel(onDirtyChange)

    await expandMode(user)

    const subTabsSwitch = screen.getByRole('switch', { name: '' })
    if (subTabsSwitch.getAttribute('aria-checked') !== 'true') {
      await user.click(subTabsSwitch)
    }

    await user.click(screen.getByRole('button', { name: /\+ carosello/i }))

    await waitFor(() => {
      expect(screen.getByText('Nome carosello')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Nome tecnico per admin')).toBeInTheDocument()
      expect(
        screen.getByText(/carica una foto per compilare etichetta, titolo, icona e descrizione/i),
      ).toBeInTheDocument()
    })
    expect(onDirtyChange).toHaveBeenCalledWith(true)
  })

  it('un solo carosello per modalità: secondo + Carosello non compare se già presente', async () => {
    restaurantSettingsData.booking_public_form_config = makeConfig([
      makeCarouselTab([{ image_url: 'https://cdn.test/existing.webp', sort_order: 0 }]),
    ])

    const user = userEvent.setup()
    renderPanel()
    await expandMode(user)

    expect(screen.queryByRole('button', { name: /\+ carosello/i })).not.toBeInTheDocument()
    expect(screen.getByText(/offerte estate/i)).toBeInTheDocument()
  })
})

describe('settings-carousel-crud — effetto Prenota pubblico', () => {
  it('mostra overlay testi slide salvati nel carosello pubblico', async () => {
    const config = makeConfig([
      makeCarouselTab([
        {
          image_url: 'https://cdn.test/public-slide.webp',
          eyebrow: 'Menu fisso',
          title: 'Tonno in crosta',
          description: 'Con verdure di stagione',
          sort_order: 0,
        },
      ]),
    ])

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingRequestForm formConfig={config} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Menu fisso')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Tonno in crosta' })).toBeInTheDocument()
      expect(screen.getByText('Con verdure di stagione')).toBeInTheDocument()
    })

    const img = screen.getByRole('img', { name: 'Tonno in crosta' }) as HTMLImageElement
    expect(img.src).toContain('public-slide.webp')
  })

  it('config legacy senza slide valide non mostra carosello pubblico', () => {
    const config = normalizeBookingPublicFormConfig({
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: parseBookingHeaderStylesFromUnknown({}),
      booking_modes: [
        {
          id: 'tavolo',
          booking_type: 'tavolo',
          enabled: true,
          label: 'Tavolo',
          description: 'D',
          icon: 'fork_knife',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: CAROUSEL_ID,
              display: 'carousel',
              label: 'Vuoto',
              carousel_items: [],
            },
          ],
        },
      ],
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingRequestForm formConfig={config} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(config.booking_modes[0].sub_tabs).toEqual([])
    expect(container.querySelector('article img')).toBeNull()
  })
})
