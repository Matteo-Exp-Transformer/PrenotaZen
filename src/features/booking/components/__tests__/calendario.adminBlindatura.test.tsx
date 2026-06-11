// @admin-blindatura: calendario
// Copre: blindatura tab Calendario M2 — scenari PLAN §3-ter.3 (Vitest/RTL, no E2E).

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import type { BookingRequest } from '@/types/booking'

const confirmSpy = vi.spyOn(window, 'confirm')

const {
  fcPropsCapture,
  featuresState,
  restaurantSettings,
  serviceSlotsState,
  tableAssignmentsState,
} = vi.hoisted(() => ({
  fcPropsCapture: { current: null as Record<string, unknown> | null },
  featuresState: { servizio: false },
  restaurantSettings: {
    daily_guest_limit: null as number | null,
    booking_time_slots_enabled: true,
  },
  serviceSlotsState: { slots: [] as Array<{ id: string; name: string; start_time: string; end_time: string }> },
  tableAssignmentsState: { data: [] as Array<{ booking_id: string; turn_number: number; checked_out_at: string | null }> },
}))

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef(function MockFullCalendar(props: Record<string, unknown>, ref: React.Ref<unknown>) {
    fcPropsCapture.current = props
    React.useImperativeHandle(ref, () => ({
      getApi: () => ({
        changeView: vi.fn(),
        gotoDate: vi.fn(),
        view: { type: 'dayGridMonth' },
      }),
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

function setupMatchMedia(desktop = true) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !desktop,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('@admin-blindatura calendario — solo accettate in vista', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.daily_guest_limit = null
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

  it('senza limite giornaliero: solo conteggio coperti, niente %', async () => {
    restaurantSettings.daily_guest_limit = null
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

  it('con limite N: solo percentuale (niente N/Nmax)', async () => {
    restaurantSettings.daily_guest_limit = 24
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
    restaurantSettings.daily_guest_limit = 100
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
    restaurantSettings.daily_guest_limit = 100
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
    restaurantSettings.daily_guest_limit = null
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
})

describe('@admin-blindatura calendario — crea da giorno (dateClick + pulsante)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fcPropsCapture.current = null
    featuresState.servizio = false
    restaurantSettings.daily_guest_limit = 100
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
    restaurantSettings.daily_guest_limit = null
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
    restaurantSettings.daily_guest_limit = null
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
