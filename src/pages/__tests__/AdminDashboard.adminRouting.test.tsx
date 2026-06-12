import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminDashboard } from '../AdminDashboard'

const { mockConfirmNavigation, mockUseBlocker } = vi.hoisted(() => ({
  mockConfirmNavigation: vi.fn(),
  mockUseBlocker: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useBlocker: mockUseBlocker,
  }
})

vi.mock('@/features/booking/hooks/useBookingQueries', () => ({
  useBookingStats: () => ({
    data: { pending: 0, totalDay: 0, totalWeek: 0, totalMonth: 0, rejected: 0 },
  }),
}))

vi.mock('@/features/booking/components/PendingRequestsTab', () => ({
  PendingRequestsTab: () => <section data-testid="tab-pending">Tab Prenotazioni</section>,
}))

vi.mock('@/features/booking/components/ArchiveTab', () => ({
  ArchiveFiltersCard: () => <div data-testid="archive-filters" />,
  ArchiveTab: () => <section data-testid="tab-archive">Tab Archivio</section>,
}))

vi.mock('@/features/booking/components/BookingCalendarTab', () => ({
  BookingCalendarTab: () => <section data-testid="tab-calendar">Tab Calendario</section>,
}))

vi.mock('@/features/booking/components/AdminBookingForm', () => ({
  AdminBookingForm: () => <form data-testid="admin-booking-form" />,
}))

vi.mock('@/features/booking/components/MenuPricesTab', async () => {
  const ReactModule = await import('react')
  return {
    MenuPricesHeroToolbar: () => <div data-testid="menu-toolbar" />,
    MenuPricesTab: ReactModule.forwardRef(() => <section data-testid="tab-menu">Tab Menu</section>),
  }
})

vi.mock('@/features/booking/components/RestaurantSettingsTab', () => ({
  RestaurantSettingsIntro: () => <div data-testid="settings-intro" />,
  RestaurantSettingsTab: () => <section data-testid="tab-settings">Tab Impostazioni</section>,
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantSlug: 'test' }),
}))

vi.mock('@/features/booking/hooks/useAdminAuth', () => ({
  useAdminAuth: () => ({
    user: { email: 'admin@test.it' },
    logout: vi.fn(),
  }),
}))

vi.mock('@/hooks/useRestaurantName', () => ({
  useRestaurantName: () => 'Ristorante Test',
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: 'default', isPending: false }),
}))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({ qrMenu: true }),
}))

vi.mock('@/contexts/UnsavedChangesContext', () => ({
  useUnsavedChangesGuard: () => ({
    confirmNavigation: mockConfirmNavigation,
    hasUnsavedChanges: false,
    registerUnsavedSource: vi.fn(),
    clearUnsavedSource: vi.fn(),
  }),
}))

describe('AdminDashboard routing tab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirmNavigation.mockResolvedValue(true)
    mockUseBlocker.mockReturnValue({ state: 'unblocked' })
  })

  it('apre la tab Prenotazioni dall’URL /admin/prenotazioni', async () => {
    // @admin-blindatura: shell-refresh-back
    // Copre: refresh/back su tab dashboard — URL prenotazioni non ricade su Calendario.
    render(
      <MemoryRouter initialEntries={['/admin/prenotazioni']}>
        <AdminDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('tab-pending')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-calendar')).not.toBeInTheDocument()
  })

  it('cambia tab via NavItem e mostra Archivio', async () => {
    // @admin-blindatura: shell-refresh-back
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/admin/calendario']}>
        <AdminDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('tab-calendar')).toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^Archivio$/i }))
    })

    await waitFor(() => expect(screen.getByTestId('tab-archive')).toBeInTheDocument())
  })
})
