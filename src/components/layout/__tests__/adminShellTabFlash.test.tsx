import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminShell } from '../AdminShell'

// @admin-blindatura: shell-refresh-back
// Copre: cambio tab dashboard in layout Pro NON deve far rimbalzare il corpo
// (la tab vecchia non deve riapparire per uno o più render intermedi). Regressione
// del "flash": activeTab deve essere derivato dall'URL, non stato duplicato che si
// rincorre via effetto (setActiveTab + navigate non atomici → render disallineati).

const { mockUseBlocker } = vi.hoisted(() => ({ mockUseBlocker: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useBlocker: mockUseBlocker }
})

// Pro edition: sidebar attiva, tutte le feature
vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    sidebar: true,
    home: true,
    crm: true,
    analytics: true,
    servizio: true,
    walkIn: true,
    noShow: true,
    tableAssignments: true,
    qrMenu: true,
  }),
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantSlug: 'test', edition: 'pro', featureOverrides: [] }),
}))

vi.mock('@/features/booking/hooks/useAdminAuth', () => ({
  useAdminAuth: () => ({ user: { email: 'admin@test.it' }, logout: vi.fn() }),
}))

vi.mock('@/hooks/useRestaurantName', () => ({ useRestaurantName: () => 'Ristorante Test' }))
vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: 'default', isPending: false }),
}))
vi.mock('@/features/booking/hooks/useBookingQueries', () => ({
  useBookingStats: () => ({ data: { pending: 0, totalDay: 0, totalWeek: 0, totalMonth: 0, rejected: 0 } }),
}))

// Ogni tab logga il render insieme al pathname corrente, così possiamo rilevare
// render in cui la tab montata non corrisponde all'URL (= flash).
const renderLog: string[] = []

vi.mock('@/features/booking/components/BookingCalendarTab', async () => {
  const RR = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    BookingCalendarTab: () => {
      const loc = RR.useLocation()
      renderLog.push(`calendar@${loc.pathname}`)
      return <section data-testid="tab-calendar">calendar</section>
    },
  }
})
vi.mock('@/features/booking/components/RestaurantSettingsTab', async () => {
  const RR = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    RestaurantSettingsIntro: () => <div />,
    RestaurantSettingsTab: () => {
      const loc = RR.useLocation()
      renderLog.push(`settings@${loc.pathname}`)
      return <section data-testid="tab-settings">settings</section>
    },
  }
})
vi.mock('@/features/booking/components/PendingRequestsTab', () => ({
  PendingRequestsTab: () => <section data-testid="tab-pending">pending</section>,
}))
vi.mock('@/features/booking/components/ArchiveTab', () => ({
  ArchiveFiltersCard: () => <div />,
  ArchiveTab: () => <section data-testid="tab-archive">archive</section>,
}))
vi.mock('@/features/booking/components/MenuPricesTab', async () => {
  const R = await import('react')
  return {
    MenuPricesHeroToolbar: () => <div />,
    MenuPricesTab: R.forwardRef(() => <section data-testid="tab-menu">menu</section>),
  }
})
vi.mock('@/features/booking/components/AdminBookingForm', () => ({
  AdminBookingForm: () => <form />,
}))

// Sezioni sidebar (lazy page) con sonda pathname
vi.mock('@/pages/CrmPage', async () => {
  const RR = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    CrmPage: () => {
      const loc = RR.useLocation()
      renderLog.push(`crm@${loc.pathname}`)
      return <section data-testid="page-crm">crm</section>
    },
  }
})
vi.mock('@/pages/ServizioPage', async () => {
  const RR = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ServizioPage: () => {
      const loc = RR.useLocation()
      renderLog.push(`servizio@${loc.pathname}`)
      return <section data-testid="page-servizio">servizio</section>
    },
  }
})
vi.mock('@/pages/AnalyticsPage', () => ({
  AnalyticsPage: () => <section data-testid="page-analytics">analytics</section>,
}))
vi.mock('@/pages/AdminHomePage', () => ({
  AdminHomePage: () => <section data-testid="page-home">home</section>,
}))

describe('AdminShell — no flash cambio tab (Pro)', () => {
  beforeEach(() => {
    renderLog.length = 0
    mockUseBlocker.mockReturnValue({ state: 'unblocked' })
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  })

  it('da Impostazioni a Calendario: nessun render disallineato tab↔URL', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/impostazioni']}>
        <AdminShell />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('tab-settings')).toBeInTheDocument())
    renderLog.length = 0

    const calendarButtons = screen.getAllByRole('button', { name: /Calendario/i })
    await user.click(calendarButtons[0])

    await waitFor(() => expect(screen.getByTestId('tab-calendar')).toBeInTheDocument())

    // Nessun render deve mostrare una tab il cui pathname non corrisponde:
    // - 'calendar@...' deve sempre essere su /admin/calendario
    // - 'settings@...' (la tab vecchia) NON deve più comparire dopo il click
    const misaligned = renderLog.filter(
      (entry) =>
        (entry.startsWith('calendar@') && !entry.endsWith('/admin/calendario')) ||
        entry.startsWith('settings@'),
    )
    expect(misaligned, `Render con flash rilevati: ${JSON.stringify(renderLog)}`).toHaveLength(0)
  })

  it('da una sezione sidebar (Servizio) torna a Prenotazioni: la sezione vecchia non riappare', async () => {
    // Stesso pattern del flash ma su `section` di AdminShell: openSection fa
    // setSection+navigate dentro un .then() async (non atomici), poi l'effetto
    // di sync URL→section rigira. Verifichiamo che non si crei un render in cui
    // la sezione vecchia (servizio) è ancora montata sull'URL nuovo.
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin/servizio']}>
        <AdminShell />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByTestId('page-servizio')).toBeInTheDocument())
    renderLog.length = 0

    // La X "Torna alla dashboard" riporta a prenotazioni → tab calendario
    await user.click(screen.getByRole('button', { name: /Torna alla dashboard/i }))

    await waitFor(() => expect(screen.getByTestId('tab-calendar')).toBeInTheDocument())

    const misaligned = renderLog.filter(
      (entry) =>
        // servizio non deve comparire su un URL diverso da /admin/servizio
        (entry.startsWith('servizio@') && !entry.endsWith('/admin/servizio')) ||
        // calendar deve sempre essere coerente con l'URL calendario
        (entry.startsWith('calendar@') && !entry.endsWith('/admin/calendario')),
    )
    expect(misaligned, `Render con flash sezione: ${JSON.stringify(renderLog)}`).toHaveLength(0)
  })
})
