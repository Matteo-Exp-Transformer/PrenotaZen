// @admin-blindatura: prenotazioni
// U3 — blocking source durante mutation; U9 — banner errore inline su save fallito.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BookingRequest } from '@/types/booking'
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const mockMutate = vi.fn()
const mutationState = { isPending: false }

vi.mock('react-toastify', () => ({
  toast: {
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: () => ({
    noShow: true,
    servizio: false,
    sidebar: false,
    home: false,
    crm: false,
    analytics: false,
    walkIn: false,
    tableAssignments: false,
    qrMenu: false,
  }),
}))

vi.mock('../../hooks/useBookingMutations', () => ({
  useUpdateBooking: () => ({ mutate: mockMutate, isPending: mutationState.isPending }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkNoShow: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('../../hooks/useBookingQueries', () => ({
  useAcceptedBookings: () => ({ data: [], isSuccess: true, isFetching: false }),
}))

vi.mock('../../hooks/useMenuItems', () => ({
  useMenuItems: () => ({ data: [] }),
}))

vi.mock('../../hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: () => ({ data: null }),
}))

vi.mock('../../hooks/useServiceSlots', () => ({
  useDigestSlotConfigs: () => ({ data: [] }),
  useServiceSlots: () => ({ data: [] }),
}))

vi.mock('../../hooks/useServiceSlotOverrides', () => ({
  useServiceSlotOverrides: () => ({ data: [] }),
  resolveSlotOverride: vi.fn(),
}))

vi.mock('../../utils/dateUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/dateUtils')>()
  return {
    ...actual,
    isWallClockStartBeforeNow: () => false,
  }
})

vi.mock('../DetailsTab', () => ({
  DetailsTab: ({
    isEditMode,
    onFormDataChange,
  }: {
    isEditMode: boolean
    onFormDataChange: (field: string, value: unknown) => void
  }) =>
    isEditMode ? (
      <button type="button" onClick={() => onFormDataChange('client_name', 'Luigi Aggiornato')}>
        Modifica nome
      </button>
    ) : (
      <div data-testid="details-tab-stub" />
    ),
}))
vi.mock('../MenuTab', () => ({ MenuTab: () => null }))
vi.mock('../DietaryTab', () => ({ DietaryTab: () => null }))
vi.mock('../CapacityWarningModal', () => ({ CapacityWarningModal: () => null }))
vi.mock('../PastStartTimeWarningModal', () => ({ PastStartTimeWarningModal: () => null }))
vi.mock('../BookingDangerActionModal', () => ({ BookingDangerActionModal: () => null }))

import { BookingDetailsModal } from '../BookingDetailsModal'

function acceptedBooking(partial: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'b-u9-1',
    status: 'accepted',
    no_show: false,
    client_name: 'Mario Rossi',
    client_email: 'mario@test.it',
    num_guests: 4,
    booking_type: 'tavolo',
    tenant_id: 'tenant-1',
    created_at: '2026-06-01T10:00:00Z',
    confirmed_start: '2026-06-12T20:00:00+00:00',
    confirmed_end: '2026-06-12T23:00:00+00:00',
    desired_date: '2026-06-12',
    ...partial,
  } as BookingRequest
}

function BlockingProbe() {
  const { hasBlockingOperations, confirmNavigation } = useUnsavedChangesGuard()
  return (
    <>
      <span data-testid="blocking-flag">{hasBlockingOperations ? 'blocked' : 'free'}</span>
      <button type="button" onClick={() => void confirmNavigation()}>
        Cambia tab
      </button>
    </>
  )
}

function renderDrawer(extra?: { pending?: boolean }) {
  mutationState.isPending = extra?.pending ?? false
  return render(
    <UnsavedChangesProvider>
      <BookingDetailsModal isOpen onClose={() => undefined} booking={acceptedBooking()} />
      <BlockingProbe />
    </UnsavedChangesProvider>,
  )
}

describe('BookingDetailsModal — U3/U9 (admin-blindatura prenotazioni)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutationState.isPending = false
    mockMutate.mockImplementation((_payload, options) => {
      options?.onError?.(new Error('Rete non disponibile'))
    })
  })

  it('U3: registra blocking source mentre updateMutation è in corso', async () => {
    const { rerender } = renderDrawer()

    expect(screen.getByTestId('blocking-flag')).toHaveTextContent('free')

    mutationState.isPending = true
    rerender(
      <UnsavedChangesProvider>
        <BookingDetailsModal isOpen onClose={() => undefined} booking={acceptedBooking()} />
        <BlockingProbe />
      </UnsavedChangesProvider>,
    )

    expect(screen.getByTestId('blocking-flag')).toHaveTextContent('blocked')

    const user = userEvent.setup()
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia tab/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('U9: mostra banner inline quando il salvataggio fallisce', async () => {
    const user = userEvent.setup()
    renderDrawer()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^modifica$/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /modifica nome/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^salva$/i }))
    })

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rete non disponibile')
    })
  })
})
