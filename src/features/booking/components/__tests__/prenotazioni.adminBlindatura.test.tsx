// @admin-blindatura: prenotazioni
// Copre: conferme coerenti — niente window.confirm nativo; modale custom su archivio e no-show.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ArchiveTab } from '../ArchiveTab'
import { BookingDangerActionModal } from '../BookingDangerActionModal'
import { calculateDailyCapacityV2 } from '../../utils/capacityCalculator'
import type { SlotConfig } from '../../utils/bookingTimeSlots'
import type { BookingRequest } from '@/types/booking'

const confirmSpy = vi.spyOn(window, 'confirm')

const mockMutateAsyncRestore = vi.fn()
const mockMutateAsyncRequeue = vi.fn()

const { mockAllBookingsState, DEFAULT_ARCHIVE_BOOKINGS } = vi.hoisted(() => {
  const defaults = [
    {
      id: 'deleted-1',
      status: 'deleted',
      client_name: 'Anna Bianchi',
      client_email: 'anna@test.it',
      desired_date: '2026-06-10',
      confirmed_start: '2026-06-10T20:00:00+00:00',
      confirmed_end: '2026-06-10T23:00:00+00:00',
      num_guests: 2,
      created_at: '2026-06-01T10:00:00Z',
    },
    {
      id: 'rejected-1',
      status: 'rejected',
      client_name: 'Luigi Verdi',
      client_email: 'luigi@test.it',
      desired_date: '2026-06-11',
      rejection_reason: 'Completo',
      num_guests: 4,
      created_at: '2026-06-02T10:00:00Z',
    },
  ]
  return {
    DEFAULT_ARCHIVE_BOOKINGS: defaults,
    mockAllBookingsState: {
      data: [...defaults] as unknown[],
      isLoading: false,
      error: null as null,
    },
  }
})

vi.mock('../../hooks/useBookingQueries', () => ({
  useAllBookings: () => mockAllBookingsState,
}))

vi.mock('../../hooks/useBookingMutations', () => ({
  useRestoreBooking: () => ({
    mutateAsync: mockMutateAsyncRestore,
    isPending: false,
  }),
  useRequeueRejectedBooking: () => ({
    mutateAsync: mockMutateAsyncRequeue,
    isPending: false,
  }),
}))

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => ({
    data:
      key === 'booking_public_form_config'
        ? { booking_modes: [] }
        : key === 'booking_custom_staff_presets'
          ? []
          : key === 'booking_menu_promos'
            ? []
            : null,
    isLoading: false,
  }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const LONG_TEXT = 'X'.repeat(5000)

async function expandArchiveCard(user: UserEvent, clientName: string) {
  const cardHeader = screen.getByText(clientName).closest('button')
  expect(cardHeader).toBeTruthy()
  await act(async () => {
    await user.click(cardHeader!)
  })
  // Il dettaglio espanso non ripete più i campi base (Nome/Email/Data…): sono già a card chiusa.
  // Segnale stabile di espansione = il bottone azione (Reinserisci / Riporta in attesa / Calendario).
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /reinserisci|riporta in attesa|visualizza nel calendario/i }),
    ).toBeInTheDocument()
  })
}

async function clickAndFlush(user: UserEvent, target: HTMLElement) {
  await act(async () => {
    await user.click(target)
  })
}

describe('ArchiveTab — conferme coerenti', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutateAsyncRestore.mockResolvedValue(undefined)
    mockMutateAsyncRequeue.mockResolvedValue(undefined)
    mockAllBookingsState.data = [...DEFAULT_ARCHIVE_BOOKINGS]
    mockAllBookingsState.isLoading = false
    mockAllBookingsState.error = null
  })

  it('reinserisci apre modale custom e non usa window.confirm', async () => {
    const user = userEvent.setup()

    render(
      <ArchiveTab filter="deleted" sortOrder="booking_date" />,
      { wrapper },
    )

    await expandArchiveCard(user, 'Anna Bianchi')

    await clickAndFlush(user, screen.getByRole('button', { name: /reinserisci/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    expect(within(dialog).getByText(/reinserisci prenotazione/i)).toBeInTheDocument()

    await clickAndFlush(user, within(dialog).getByRole('button', { name: /^Reinserisci$/i }))

    await waitFor(() => {
      expect(mockMutateAsyncRestore).toHaveBeenCalledWith('deleted-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('deleted senza orari — bottone Reinserisci apre modale orario; annulla resta in archivio', async () => {
    const user = userEvent.setup()
    mockAllBookingsState.data = [{
      id: 'deleted-no-times',
      status: 'deleted',
      client_name: 'Senza Orari',
      client_email: 'no-times@test.it',
      desired_date: '2026-06-10',
      num_guests: 2,
      created_at: '2026-06-01T10:00:00Z',
    }]

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    await expandArchiveCard(user, 'Senza Orari')

    expect(screen.getByRole('button', { name: /reinserisci/i })).toBeInTheDocument()
    expect(screen.queryByText(/reinserimento non disponibile/i)).not.toBeInTheDocument()

    await clickAndFlush(user, screen.getByRole('button', { name: /reinserisci/i }))

    const dialog = await waitFor(() => screen.getByRole('dialog'))
    expect(within(dialog).getByRole('heading', { name: /reinserisci nel calendario/i })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/orario di inizio/i)).toBeInTheDocument()

    await clickAndFlush(user, within(dialog).getByRole('button', { name: /^Annulla$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(mockMutateAsyncRestore).not.toHaveBeenCalled()
  })

  it('deleted senza orari — conferma orario chiama restore con slot calcolati', async () => {
    const user = userEvent.setup()
    mockAllBookingsState.data = [{
      id: 'deleted-no-times',
      status: 'deleted',
      client_name: 'Senza Orari',
      client_email: 'no-times@test.it',
      desired_date: '2026-06-10',
      num_guests: 2,
      created_at: '2026-06-01T10:00:00Z',
    }]

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    await expandArchiveCard(user, 'Senza Orari')
    await clickAndFlush(user, screen.getByRole('button', { name: /reinserisci/i }))

    const dialog = await waitFor(() => screen.getByRole('dialog'))
    await clickAndFlush(user, within(dialog).getByRole('button', { name: /^Reinserisci$/i }))

    await waitFor(() => {
      expect(mockMutateAsyncRestore).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 'deleted-no-times',
          desiredTime: '20:00',
          confirmedStart: expect.any(String),
          confirmedEnd: expect.any(String),
        }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('riporta in attesa apre modale custom e chiama requeue', async () => {
    const user = userEvent.setup()

    render(
      <ArchiveTab filter="rejected" sortOrder="booking_date" />,
      { wrapper },
    )

    await expandArchiveCard(user, 'Luigi Verdi')

    await clickAndFlush(user, screen.getByRole('button', { name: /riporta in attesa/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    expect(within(dialog).getByRole('heading', { name: /riporta in attesa/i })).toBeInTheDocument()

    await clickAndFlush(user, within(dialog).getByRole('button', { name: /^Riporta in attesa$/i }))

    await waitFor(() => {
      expect(mockMutateAsyncRequeue).toHaveBeenCalledWith('rejected-1')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('@admin-blindatura prenotazioni — LIMIT UI archivio', () => {
  beforeEach(() => {
    mockAllBookingsState.data = [...DEFAULT_ARCHIVE_BOOKINGS]
    mockAllBookingsState.isLoading = false
    mockAllBookingsState.error = null
  })

  it('L1: nome client lunghissimo — digest e dettaglio senza crash', async () => {
    const user = userEvent.setup()
    mockAllBookingsState.data = [{
      id: 'deleted-long-name',
      status: 'deleted',
      client_name: LONG_TEXT,
      client_email: 'long@test.it',
      desired_date: '2026-06-10',
      confirmed_start: '2026-06-10T20:00:00+00:00',
      confirmed_end: '2026-06-10T23:00:00+00:00',
      num_guests: 2,
      created_at: '2026-06-01T10:00:00Z',
    }]

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    expect(screen.getByText(LONG_TEXT)).toBeInTheDocument()
    await expandArchiveCard(user, LONG_TEXT)
    // Dedup: il nome non è più ripetuto nel dettaglio → compare una sola volta (header), senza crash.
    await waitFor(() => {
      const detailLabels = screen.getAllByText(LONG_TEXT)
      expect(detailLabels.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('L2: note e motivo rifiuto lunghissimi — render break-words', async () => {
    const user = userEvent.setup()
    mockAllBookingsState.data = [{
      id: 'rejected-long-reason',
      status: 'rejected',
      client_name: 'Cliente Note',
      client_email: 'note@test.it',
      desired_date: '2026-06-12',
      special_requests: LONG_TEXT,
      rejection_reason: LONG_TEXT,
      num_guests: 3,
      created_at: '2026-06-03T10:00:00Z',
    }]

    render(<ArchiveTab filter="rejected" sortOrder="booking_date" />, { wrapper })

    await expandArchiveCard(user, 'Cliente Note')
    await waitFor(() => {
      expect(screen.getAllByText(LONG_TEXT).length).toBeGreaterThanOrEqual(2)
    })
  })

  it('L3: motivo cancellazione lunghissimo — visibile su deleted', async () => {
    const user = userEvent.setup()
    mockAllBookingsState.data = [{
      id: 'deleted-long-cancel',
      status: 'deleted',
      client_name: 'Cliente Cancel',
      client_email: 'cancel@test.it',
      desired_date: '2026-06-10',
      confirmed_start: '2026-06-10T20:00:00+00:00',
      confirmed_end: '2026-06-10T23:00:00+00:00',
      cancellation_reason: LONG_TEXT,
      num_guests: 2,
      created_at: '2026-06-01T10:00:00Z',
    }]

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    await expandArchiveCard(user, 'Cliente Cancel')
    await waitFor(() => {
      expect(screen.getByText(/motivo eliminazione/i)).toBeInTheDocument()
      expect(screen.getByText(LONG_TEXT)).toBeInTheDocument()
    })
  })

  it('L4: num ospiti 0 e negativo — digest mostra valore grezzo', () => {
    mockAllBookingsState.data = [
      {
        id: 'deleted-zero',
        status: 'deleted',
        client_name: 'Zero Ospiti',
        client_email: 'zero@test.it',
        desired_date: '2026-06-10',
        num_guests: 0,
        created_at: '2026-06-01T10:00:00Z',
      },
      {
        id: 'deleted-negative',
        status: 'deleted',
        client_name: 'Negativo Ospiti',
        client_email: 'neg@test.it',
        desired_date: '2026-06-11',
        num_guests: -3,
        created_at: '2026-06-02T10:00:00Z',
      },
    ]

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    expect(screen.getByText('0 ospiti')).toBeInTheDocument()
    expect(screen.getByText('-3 ospiti')).toBeInTheDocument()
  })

  it('L5: archivio con 200 prenotazioni — contatore e card senza crash', () => {
    mockAllBookingsState.data = Array.from({ length: 200 }, (_, i) => ({
      id: `bulk-${i}`,
      status: 'deleted',
      client_name: `Cliente ${i}`,
      client_email: `c${i}@test.it`,
      desired_date: '2026-06-10',
      num_guests: 2,
      created_at: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`,
    }))

    render(<ArchiveTab filter="deleted" sortOrder="booking_date" />, { wrapper })

    expect(screen.getByText(/mostrando 200 prenotazioni/i)).toBeInTheDocument()
    expect(screen.getByText('Cliente 0')).toBeInTheDocument()
    expect(screen.getByText('Cliente 199')).toBeInTheDocument()
  })
})

describe('@admin-blindatura prenotazioni — LIMIT capienza (calculateDailyCapacityV2)', () => {
  const DATE = '2026-06-10'
  const cena: SlotConfig = {
    id: 'cena',
    name: 'Cena',
    start_time: '19:00',
    end_time: '23:00',
    display_order: 1,
    is_canonical: true,
  }

  function acceptedBooking(id: string, guests: number): BookingRequest {
    return {
      id,
      status: 'accepted',
      confirmed_start: `${DATE}T20:00:00+00:00`,
      confirmed_end: `${DATE}T22:00:00+00:00`,
      num_guests: guests,
    } as unknown as BookingRequest
  }

  it('L6: capienza al bordo esatto — available=0, nessun superamento', () => {
    const bookings = [acceptedBooking('b1', 10)]
    const result = calculateDailyCapacityV2(DATE, bookings, [cena], { cena: 10 })
    const slot = result.slots[0]
    expect(slot.occupied).toBe(10)
    expect(slot.available).toBe(0)
    expect((slot.available ?? 0) >= 0).toBe(true)
  })

  it('L7: capienza +1 oltre limite — available negativo (overbooking matematico)', () => {
    const bookings = [acceptedBooking('b1', 11)]
    const result = calculateDailyCapacityV2(DATE, bookings, [cena], { cena: 10 })
    const slot = result.slots[0]
    expect(slot.occupied).toBe(11)
    expect(slot.available).toBe(-1)
  })
})

describe('BookingDangerActionModal — regressione conferme', () => {
  it('espone titolo e azioni Annulla/Conferma coerenti', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <BookingDangerActionModal
        isOpen
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Segna come No-show"
        message="Confermi che il cliente non si è presentato?"
        confirmLabel="Conferma No-show"
        variant="warning"
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /conferma no-show/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
  })

  it('R1: textarea lunga — pannello scrollabile e bottoni nel DOM (Elimina)', () => {
    render(
      <BookingDangerActionModal
        isOpen
        onClose={() => undefined}
        onConfirm={() => undefined}
        title="Elimina Prenotazione"
        message="Sei sicuro di voler eliminare questa prenotazione?"
        confirmLabel="Elimina Prenotazione"
        variant="danger"
        reasonField={{
          id: 'cancel-reason',
          label: 'Motivo eliminazione',
          placeholder: 'Descrivi il motivo…',
        }}
      />,
    )

    const dialog = screen.getByRole('dialog')
    const panel = dialog.querySelector('.max-h-\\[90vh\\]')
    expect(panel).toBeTruthy()
    expect(panel?.className).toMatch(/overflow-y-auto|overflow-hidden/)
    expect(screen.getByRole('button', { name: /elimina prenotazione/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /annulla/i })).toBeInTheDocument()
  })

  it('D2: doppio click conferma — onConfirm una sola volta con isLoading', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <BookingDangerActionModal
        isOpen
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Elimina Prenotazione"
        message="Conferma eliminazione"
        confirmLabel="Elimina"
        isLoading
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: /^…$/i })
    expect(confirmBtn).toBeDisabled()
    await user.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('U4: doppio click rapido senza isLoading — guard sincrono, onConfirm una sola volta', async () => {
    // Il chiamante non ha ancora settato isLoading (arriva async): il guard useRef
    // interno deve impedire la seconda mutation prima del re-render.
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    render(
      <BookingDangerActionModal
        isOpen
        onClose={() => undefined}
        onConfirm={onConfirm}
        title="Elimina Prenotazione"
        message="Conferma eliminazione"
        confirmLabel="Elimina"
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: /^Elimina$/i })
    await user.dblClick(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
