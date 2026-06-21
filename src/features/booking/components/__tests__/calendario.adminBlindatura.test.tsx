// @admin-blindatura: calendario
// Copre: blindatura tab Calendario M2 — scenari PLAN §3-ter.3 (Vitest/RTL, no E2E).

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import type { BookingRequest } from '@/types/booking'
import type { BookingPublicFormConfig } from '@/features/booking/constants/bookingPublicFormConfig'

const confirmSpy = vi.spyOn(window, 'confirm')

const {
  fcPropsCapture,
  calendarApiState,
  featuresState,
  restaurantSettings,
  serviceSlotsState,
  tableAssignmentsState,
} = vi.hoisted(() => ({
  fcPropsCapture: { current: null as Record<string, unknown> | null },
  calendarApiState: {
    changeView: vi.fn(),
    gotoDate: vi.fn(),
    view: { type: 'dayGridMonth' },
  },
  featuresState: { servizio: false },
  restaurantSettings: {
    // Nuovo modello (18-06): badge % su SOMMA cap per-fascia, gated dall'interruttore globale.
    slot_limit_enabled: false as boolean,
    booking_time_slots_enabled: true,
    slot_guest_capacities: {} as Record<string, number | null>,
    booking_public_form_config: null as BookingPublicFormConfig | null,
    booking_custom_staff_presets: [] as Array<{
      id: string
      name: string
      item_ids: string[]
      booking_types: ['menu_prezzo_fisso']
    }>,
  },
  serviceSlotsState: { slots: [] as Array<{ id: string; name: string; start_time: string; end_time: string; max_guests?: number | null }> },
  tableAssignmentsState: { data: [] as Array<{ booking_id: string; turn_number: number; checked_out_at: string | null }> },
}))

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef(function MockFullCalendar(props: Record<string, unknown>, ref: React.Ref<unknown>) {
    fcPropsCapture.current = props
    React.useImperativeHandle(ref, () => ({
      getApi: () => calendarApiState,
    }))
    return <div data-testid="mock-fullcalendar" />
  }),
}))

vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))
vi.mock('@fullcalendar/list', () => ({ default: {} }))

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

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data: restaurantSettings[key as keyof typeof restaurantSettings] ?? null,
    isLoading: false,
  }),
}))

vi.mock('../../hooks/useServiceSlots', () => ({
  useServiceSlots: () => ({ data: serviceSlotsState.slots }),
  useDigestSlotConfigs: () => ({ data: [] }),
}))

vi.mock('../../hooks/useTableAssignments', () => ({
  useTableAssignments: () => ({ data: tableAssignmentsState.data }),
}))

vi.mock('../AdminBookingForm', () => ({
  AdminBookingForm: ({ initialDate }: { initialDate?: string }) => (
    <div data-testid="admin-booking-form" data-initial-date={initialDate ?? ''} />
  ),
}))

vi.mock('../QuickTableAssignModal', () => ({
  QuickTableAssignModal: () => <div data-testid="quick-table-assign-modal" />,
}))

vi.mock('../DetailsTab', () => ({
  DetailsTab: () => <div data-testid="details-tab-stub" />,
}))
vi.mock('../MenuTab', () => ({
  MenuTab: () => null,
}))
vi.mock('../DietaryTab', () => ({
  DietaryTab: () => null,
}))
vi.mock('../CapacityWarningModal', () => ({
  CapacityWarningModal: () => null,
}))
vi.mock('../PastStartTimeWarningModal', () => ({
  PastStartTimeWarningModal: () => null,
}))
vi.mock('../../hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))
vi.mock('../../hooks/useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  resolveSlotOverride: vi.fn(),
}))

const mockCancelMutate = vi.fn()
const mockAcceptedBookingsState = vi.hoisted(() => ({
  data: [] as BookingRequest[],
  isLoading: false,
  isFetching: false,
}))

vi.mock('../../hooks/useBookingMutations', () => ({
  useUpdateBooking: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelBooking: () => ({ mutate: mockCancelMutate, isPending: false }),
  useMarkNoShow: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => mockAcceptedBookingsState,
}))

import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { BookingCalendar } from '../BookingCalendar'

function renderCalendar(ui: React.ReactElement) {
  return render(<UnsavedChangesProvider>{ui}</UnsavedChangesProvider>)
}

function acceptedBooking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: partial.id ?? 'booking-1',
    status: 'accepted',
    no_show: false,
    num_guests: 4,
    client_name: partial.client_name ?? 'Mario Rossi',
    client_email: 'mario@test.it',
    confirmed_start: partial.confirmed_start ?? '2026-06-12T20:00:00+00:00',
    confirmed_end: partial.confirmed_end ?? '2026-06-12T23:00:00+00:00',
    desired_date: partial.desired_date ?? '2026-06-12',
    booking_type: 'tavolo',
    tenant_id: 'tenant-1',
    created_at: '2026-06-01T10:00:00Z',
    ...partial,
  } as BookingRequest
}

function mountDayBadge(
  dayCellDidMount: (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
  dateStr: string,
) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const frame = document.createElement('div')
  frame.className = 'fc-daygrid-day-frame'
  const dayEl = document.createElement('td')
  dayEl.appendChild(frame)
  dayCellDidMount({
    date: new Date(year, month - 1, day),
    view: { type: 'dayGridMonth' },
    el: dayEl,
  })
  return frame
}

async function clickAndFlush(user: UserEvent, target: HTMLElement) {
  await act(async () => {
    await user.click(target)
  })
}

type MatchMediaChangeListener = (event: { matches: boolean; media: string }) => void

function setupMatchMedia(desktopOrWidth: boolean | number = true) {
  let viewportWidth =
    typeof desktopOrWidth === 'number' ? desktopOrWidth : desktopOrWidth ? 1280 : 375
  const mediaQueries: Array<{
    media: string
    mql: MediaQueryList
    listeners: Set<MatchMediaChangeListener>
  }> = []

  const evaluate = (query: string) => {
    const minWidth = query.match(/min-width:\s*(\d+)px/)
    const maxWidth = query.match(/max-width:\s*(\d+)px/)
    if (minWidth && viewportWidth < Number(minWidth[1])) return false
    if (maxWidth && viewportWidth > Number(maxWidth[1])) return false
    return true
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const listeners = new Set<MatchMediaChangeListener>()
      const mql = {
        matches: evaluate(query),
        media: query,
        onchange: null,
        addListener: (listener: MatchMediaChangeListener) => listeners.add(listener),
        removeListener: (listener: MatchMediaChangeListener) => listeners.delete(listener),
        addEventListener: (_type: string, listener: MatchMediaChangeListener) => listeners.add(listener),
        removeEventListener: (_type: string, listener: MatchMediaChangeListener) => listeners.delete(listener),
        dispatchEvent: () => true,
      } as unknown as MediaQueryList
      mediaQueries.push({ media: query, mql, listeners })
      return mql
    }),
  })

  return {
    setWidth(width: number) {
      viewportWidth = width
      mediaQueries.forEach(({ media, mql, listeners }) => {
        const nextMatches = evaluate(media)
        if (nextMatches === mql.matches) return
        Object.defineProperty(mql, 'matches', {
          configurable: true,
          value: nextMatches,
        })
        listeners.forEach((listener) => listener({ matches: nextMatches, media }))
      })
    },
  }
}

describe('@admin-blindatura calendario — solo accettate in vista', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    restaurantSettings.booking_public_form_config = null
    restaurantSettings.booking_custom_staff_presets = []
    serviceSlotsState.slots = []
    tableAssignmentsState.data = []
    mockAcceptedBookingsState.data = []
    setupMatchMedia(true)
  })

  it('events FullCalendar escludono no-show (restano nel DB, non in calendario)', async () => {
    const bookings = [
      acceptedBooking({ id: 'visible', client_name: 'Visibile' }),
      acceptedBooking({ id: 'noshow', client_name: 'No Show', no_show: true }),
    ]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    await waitFor(() => expect(fcPropsCapture.current).toBeTruthy())
    const events = fcPropsCapture.current!.events as Array<{ extendedProps: BookingRequest }>
    expect(events).toHaveLength(1)
    expect(events[0].extendedProps.client_name).toBe('Visibile')
  })

  it('events FullCalendar e digest escludono pending anche se passate nel prop bookings', async () => {
    const bookings = [
      acceptedBooking({ id: 'accepted-1', client_name: 'Accettata' }),
      acceptedBooking({
        id: 'pending-1',
        client_name: 'In Attesa',
        status: 'pending',
      }),
    ]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    await waitFor(() => expect(fcPropsCapture.current).toBeTruthy())
    const events = fcPropsCapture.current!.events as Array<{ extendedProps: BookingRequest }>
    expect(events).toHaveLength(1)
    expect(events[0].extendedProps.client_name).toBe('Accettata')

    expect(screen.getByText('Accettata')).toBeInTheDocument()
    expect(screen.queryByText('In Attesa')).not.toBeInTheDocument()
  })

  it('digest giorno mostra solo accettate con orario confermato; esclude no-show', () => {
    const bookings = [
      acceptedBooking({ client_name: 'In calendario' }),
      acceptedBooking({
        client_name: 'No Show Digest',
        no_show: true,
        confirmed_start: '2026-06-12T13:00:00+00:00',
      }),
      acceptedBooking({
        client_name: 'Senza orario',
        confirmed_start: null as unknown as string,
        confirmed_end: null as unknown as string,
      }),
    ]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    expect(screen.getByText('In calendario')).toBeInTheDocument()
    expect(screen.queryByText('No Show Digest')).not.toBeInTheDocument()
    expect(screen.queryByText('Senza orario')).not.toBeInTheDocument()
  })
})

describe('@admin-blindatura calendario — badge % riempimento (dayCellDidMount)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    serviceSlotsState.slots = []
    tableAssignmentsState.data = []
    setupMatchMedia(true)
  })

  // Una sola fascia che copre la giornata; cap impostato via slot_guest_capacities (dove la UI scrive).
  const SLOT_ID = 'slot-cena'
  function setupCappedSlot(cap: number | null, limitOn = true) {
    serviceSlotsState.slots = [
      { id: SLOT_ID, name: 'Cena', start_time: '00:00', end_time: '23:59', max_guests: null },
    ]
    restaurantSettings.slot_limit_enabled = limitOn
    restaurantSettings.slot_guest_capacities = { [SLOT_ID]: cap }
  }

  it('interruttore globale OFF: solo conteggio coperti, niente %', async () => {
    setupCappedSlot(24, false)
    const bookings = [acceptedBooking({ num_guests: 18, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dayCellDidMount).toBeTypeOf('function'))

    const frame = mountDayBadge(
      fcPropsCapture.current!.dayCellDidMount as (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
      '2026-06-12',
    )

    expect(frame.textContent).toBe('18')
    expect(frame.innerHTML).not.toContain('%')
    expect(frame.innerHTML).not.toContain('booking-day-fill-sym')
  })

  it('limite ON ma fascia senza cap: solo conteggio, niente %', async () => {
    setupCappedSlot(null, true)
    const bookings = [acceptedBooking({ num_guests: 18, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dayCellDidMount).toBeTypeOf('function'))

    const frame = mountDayBadge(
      fcPropsCapture.current!.dayCellDidMount as (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
      '2026-06-12',
    )

    expect(frame.textContent).toBe('18')
    expect(frame.innerHTML).not.toContain('%')
  })

  it('limite per-fascia attivo con cap: percentuale sulla somma dei cap (niente N/Nmax)', async () => {
    setupCappedSlot(24)
    const bookings = [acceptedBooking({ num_guests: 18, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dayCellDidMount).toBeTypeOf('function'))

    const frame = mountDayBadge(
      fcPropsCapture.current!.dayCellDidMount as (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
      '2026-06-12',
    )

    expect(frame.textContent).toContain('75')
    expect(frame.textContent).toContain('%')
    expect(frame.innerHTML).not.toMatch(/18\/24/)
  })

  it('esattamente 100% usa tono high (pieno), non over', async () => {
    setupCappedSlot(100)
    const bookings = [acceptedBooking({ num_guests: 100, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dayCellDidMount).toBeTypeOf('function'))

    const frame = mountDayBadge(
      fcPropsCapture.current!.dayCellDidMount as (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
      '2026-06-12',
    )

    expect(frame.textContent).toContain('100')
    expect(frame.innerHTML).toContain('booking-day-fill--high')
    expect(frame.innerHTML).not.toContain('booking-day-fill--over')
  })

  it('oltre il 100% mostra valore reale (es. 108%), mai cappato', async () => {
    setupCappedSlot(100)
    const bookings = [acceptedBooking({ num_guests: 108, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dayCellDidMount).toBeTypeOf('function'))

    const frame = mountDayBadge(
      fcPropsCapture.current!.dayCellDidMount as (arg: { date: Date; view: { type: string }; el: HTMLElement }) => void,
      '2026-06-12',
    )

    expect(frame.textContent).toContain('108')
    expect(frame.innerHTML).toContain('booking-day-fill--over')
    expect(frame.innerHTML).not.toContain('100%')
  })
})

describe('@admin-blindatura calendario — gate tavolo Classic vs Pro', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    tableAssignmentsState.data = []
    setupMatchMedia(true)
  })

  it('Classic (servizio off): nessun pallino assegna tavolo nel digest', () => {
    featuresState.servizio = false
    serviceSlotsState.slots = []
    const bookings = [acceptedBooking({ client_name: 'Classic Cliente' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    expect(screen.queryByLabelText(/assegna tavolo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tavolo assegnato/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/turno 1/i)).not.toBeInTheDocument()
  })

  it('Pro+servizio (slot attivi): pallino assegna tavolo presente nel digest', () => {
    featuresState.servizio = true
    serviceSlotsState.slots = [
      { id: 'slot-1', name: 'Cena', start_time: '19:00', end_time: '23:00' },
    ]
    tableAssignmentsState.data = []
    const bookings = [acceptedBooking({ client_name: 'Pro Cliente' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    expect(screen.getByLabelText('Assegna tavolo')).toBeInTheDocument()
  })

  it('Pro con servizio on ma slot vuoti: nessun pallino turno/tavolo nel digest', () => {
    featuresState.servizio = true
    serviceSlotsState.slots = []
    const bookings = [acceptedBooking({ client_name: 'Pro Senza Slot' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    expect(screen.queryByLabelText(/assegna tavolo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/tavolo assegnato/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/turno 1/i)).not.toBeInTheDocument()
  })

  it('digest giorno mostra massimo tre badge configurati: da assegnare, tipologia, card scorrevole', () => {
    featuresState.servizio = true
    serviceSlotsState.slots = [
      { id: 'slot-1', name: 'Cena', start_time: '19:00', end_time: '23:00' },
    ]
    const presetId = '11111111-1111-4111-8111-111111111111'
    restaurantSettings.booking_custom_staff_presets = [
      {
        id: presetId,
        name: 'Preset degustazione',
        item_ids: [],
        booking_types: ['menu_prezzo_fisso'],
      },
    ]
    restaurantSettings.booking_public_form_config = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: {},
      booking_modes: [
        {
          id: 'mode-menu',
          booking_type: 'menu_prezzo_fisso',
          enabled: true,
          label: 'Menu degustazione lungo',
          booking_badge_label: 'Menu',
          description: 'D',
          icon: 'bowl_food',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'cards',
          sub_tabs: [
            {
              id: 'sub-menu',
              display: 'cards',
              label: 'Cena lunga',
              booking_badge_label: 'Degustazione',
              preset_id: presetId,
            },
          ],
        },
      ],
    } as BookingPublicFormConfig
    const booking = acceptedBooking({
      client_name: 'Cliente Badge',
      booking_type: 'menu_prezzo_fisso',
      preset_menu: `custom:${presetId}`,
      special_requests: 'Nota cliente',
    })

    renderCalendar(<BookingCalendar bookings={[booking]} initialDate="2026-06-12" />)

    expect(screen.getByText('DA ASSEGNARE')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.getByText('Degustazione')).toBeInTheDocument()
    expect(screen.queryByText('NOTE')).not.toBeInTheDocument()
    expect(screen.queryByText('ASSEGNATO')).not.toBeInTheDocument()
  })

  it('digest giorno non mostra il badge del carosello quando la prenotazione arriva da carosello', () => {
    featuresState.servizio = true
    serviceSlotsState.slots = [
      { id: 'slot-1', name: 'Cena', start_time: '19:00', end_time: '23:00' },
    ]
    restaurantSettings.booking_public_form_config = {
      page_title: 'Prenota',
      page_description: 'Desc',
      header_styles: {},
      booking_modes: [
        {
          id: 'mode-menu',
          booking_type: 'menu_prezzo_fisso',
          enabled: true,
          label: 'Menu degustazione lungo',
          booking_badge_label: 'Menu',
          description: 'D',
          icon: 'bowl_food',
          sub_tabs_enabled: true,
          sub_tabs_presentation: 'carousel',
          sub_tabs: [
            {
              id: 'sub-carousel',
              display: 'carousel',
              label: 'Carosello admin',
              booking_badge_label: 'CaroselloBadge',
              carousel_items: [{ image_url: 'https://example.com/offerta.jpg' }],
            },
          ],
        },
      ],
    } as BookingPublicFormConfig
    const booking = acceptedBooking({
      client_name: 'Cliente Carosello',
      booking_type: 'menu_prezzo_fisso',
    })

    renderCalendar(<BookingCalendar bookings={[booking]} initialDate="2026-06-12" />)

    expect(screen.getByText('DA ASSEGNARE')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
    expect(screen.queryByText('CaroselloBadge')).not.toBeInTheDocument()
    expect(screen.queryByText('Carosello admin')).not.toBeInTheDocument()
  })
})

describe('@admin-blindatura calendario — crea da giorno (dateClick + pulsante)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    serviceSlotsState.slots = []
    tableAssignmentsState.data = []
    setupMatchMedia(true)
  })

  it('dateClick seleziona il giorno senza aprire il form', async () => {
    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.dateClick).toBeTypeOf('function'))

    act(() => {
      ;(fcPropsCapture.current!.dateClick as (info: { date: Date }) => void)({
        date: new Date(2026, 5, 15),
      })
    })

    expect(screen.queryByTestId('admin-booking-form')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuova prenotazione il 15\/06/i })).toBeInTheDocument()
  })

  it('pulsante Nuova prenotazione apre form con data preselezionata', async () => {
    const user = userEvent.setup()
    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)

    await clickAndFlush(user, screen.getByRole('button', { name: /nuova prenotazione il 12\/06/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('admin-booking-form')).toHaveAttribute('data-initial-date', '2026-06-12')
  })

  it('giorno oltre limite coperti: form si apre comunque (avviso non bloccante a monte)', async () => {
    const user = userEvent.setup()
    const bookings = [acceptedBooking({ num_guests: 120, confirmed_start: '2026-06-12T20:00:00+00:00' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    await clickAndFlush(user, screen.getByRole('button', { name: /nuova prenotazione il 12\/06/i }))

    expect(screen.getByTestId('admin-booking-form')).toHaveAttribute('data-initial-date', '2026-06-12')
  })
})

describe('@admin-blindatura calendario — navigazione mese FC (datesSet)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    setupMatchMedia(true)
  })

  it('datesSet riallinea selectedDate al mese visibile (stesso giorno del mese)', async () => {
    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.datesSet).toBeTypeOf('function'))

    act(() => {
      ;(fcPropsCapture.current!.datesSet as (arg: {
        view: { type: string; currentStart: Date }
      }) => void)({
        view: { type: 'dayGridMonth', currentStart: new Date(2026, 6, 1) },
      })
    })

    expect(screen.getByRole('button', { name: /nuova prenotazione il 12\/07/i })).toBeInTheDocument()
  })

  it('datesSet ignora viste non-mese', async () => {
    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current?.datesSet).toBeTypeOf('function'))

    act(() => {
      ;(fcPropsCapture.current!.datesSet as (arg: {
        view: { type: string; currentStart: Date }
      }) => void)({
        view: { type: 'timeGridWeek', currentStart: new Date(2026, 6, 1) },
      })
    })

    expect(screen.getByRole('button', { name: /nuova prenotazione il 12\/06/i })).toBeInTheDocument()
  })
})

describe('@admin-blindatura calendario — selettore viste responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    serviceSlotsState.slots = []
    tableAssignmentsState.data = []
  })

  it.each([375, 834])('a %ipx mostra esclusivamente Mese e Lista', (width) => {
    setupMatchMedia(width)

    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    const viewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))

    expect(viewSelector.getByRole('button', { name: 'Mese' })).toBeInTheDocument()
    expect(viewSelector.getByRole('button', { name: 'Lista' })).toBeInTheDocument()
    expect(viewSelector.queryByRole('button', { name: 'Settimana' })).not.toBeInTheDocument()
    expect(viewSelector.queryByRole('button', { name: 'Giorno' })).not.toBeInTheDocument()
  })

  it('a 1280px mostra tutte le viste esistenti', () => {
    setupMatchMedia(1280)

    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    const viewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))

    expect(viewSelector.getByRole('button', { name: 'Mese' })).toBeInTheDocument()
    expect(viewSelector.getByRole('button', { name: 'Settimana' })).toBeInTheDocument()
    expect(viewSelector.getByRole('button', { name: 'Giorno' })).toBeInTheDocument()
    expect(viewSelector.getByRole('button', { name: 'Lista' })).toBeInTheDocument()
  })

  it.each([375, 834])(
    'passando da desktop a %ipx porta automaticamente Settimana a Mese',
    async (width) => {
      const user = userEvent.setup()
      const viewport = setupMatchMedia(1280)
      renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
      const desktopViewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))

      await clickAndFlush(user, desktopViewSelector.getByRole('button', { name: 'Settimana' }))
      expect(calendarApiState.changeView).toHaveBeenLastCalledWith('timeGridWeek')

      act(() => viewport.setWidth(width))

      await waitFor(() => {
        expect(calendarApiState.changeView).toHaveBeenLastCalledWith('dayGridMonth')
      })
      const narrowViewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))
      expect(narrowViewSelector.getByRole('button', { name: 'Mese' })).toHaveClass('bg-primary-50')
      expect(narrowViewSelector.queryByRole('button', { name: 'Settimana' })).not.toBeInTheDocument()
      expect(narrowViewSelector.queryByRole('button', { name: 'Giorno' })).not.toBeInTheDocument()
    },
  )

  it.each([375, 834])(
    'a %ipx permette Mese ↔ Lista e tornando desktop mantiene la vista corrente',
    async (width) => {
      const user = userEvent.setup()
      const viewport = setupMatchMedia(width)
      renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
      const narrowViewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))

      await clickAndFlush(user, narrowViewSelector.getByRole('button', { name: 'Mese' }))
      expect(calendarApiState.changeView).toHaveBeenLastCalledWith('dayGridMonth')
      await clickAndFlush(user, narrowViewSelector.getByRole('button', { name: 'Lista' }))
      expect(calendarApiState.changeView).toHaveBeenLastCalledWith('listWeek')

      const callsBeforeDesktop = calendarApiState.changeView.mock.calls.length
      act(() => viewport.setWidth(1280))

      await waitFor(() => {
        const desktopViewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))
        expect(desktopViewSelector.getByRole('button', { name: 'Settimana' })).toBeInTheDocument()
      })
      const desktopViewSelector = within(screen.getByRole('group', { name: 'Viste calendario' }))
      expect(desktopViewSelector.getByRole('button', { name: 'Giorno' })).toBeInTheDocument()
      expect(desktopViewSelector.getByRole('button', { name: 'Lista' })).toHaveClass('bg-primary-50')
      expect(calendarApiState.changeView).toHaveBeenCalledTimes(callsBeforeDesktop)
    },
  )
})

describe('@admin-blindatura calendario — no drag&drop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    setupMatchMedia(true)
  })

  it('config FullCalendar senza editable/eventDrop/selectable che spostino data/ora', async () => {
    renderCalendar(<BookingCalendar bookings={[]} initialDate="2026-06-12" />)
    await waitFor(() => expect(fcPropsCapture.current).toBeTruthy())

    const props = fcPropsCapture.current!
    expect(props.editable).toBeUndefined()
    expect(props.eventDrop).toBeUndefined()
    expect(props.eventResize).toBeUndefined()
    expect(props.selectable).toBeUndefined()
    expect(props.select).toBeUndefined()
    expect(props.eventDragStart).toBeUndefined()
  })
})

describe('@admin-blindatura calendario — elimina solo da modale dettaglio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.slot_limit_enabled = false
    restaurantSettings.slot_guest_capacities = {}
    serviceSlotsState.slots = []
    tableAssignmentsState.data = []
    mockAcceptedBookingsState.data = []
    setupMatchMedia(true)
  })

  it('superficie calendario senza Elimina/Rifiuta', () => {
    const bookings = [acceptedBooking({ client_name: 'Solo Dettaglio' })]

    renderCalendar(<BookingCalendar bookings={bookings} initialDate="2026-06-12" />)

    expect(screen.queryByRole('button', { name: /^elimina$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rifiuta/i })).not.toBeInTheDocument()
  })

  it('click digest apre modale dettaglio; Elimina usa conferma custom (no window.confirm)', async () => {
    const user = userEvent.setup()
    const booking = acceptedBooking({ client_name: 'Da Eliminare' })
    mockAcceptedBookingsState.data = [booking]

    renderCalendar(<BookingCalendar bookings={[booking]} initialDate="2026-06-12" />)

    await clickAndFlush(user, screen.getByRole('button', { name: /da eliminare/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /dettagli prenotazione/i })).toBeInTheDocument()
    })

    await clickAndFlush(user, screen.getByRole('button', { name: /^elimina$/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    const confirmDialog = await waitFor(() =>
      screen.getByRole('dialog', { name: /elimina prenotazione accettata/i }),
    )
    expect(within(confirmDialog).getByText(/sei sicuro di voler eliminare/i)).toBeInTheDocument()
  })
})
