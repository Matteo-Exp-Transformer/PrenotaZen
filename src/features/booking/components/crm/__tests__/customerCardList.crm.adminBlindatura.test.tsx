// @admin-blindatura: crm
// Copre: Rubrica clienti — lista card, espansione inline storico, date GG/MM/AAAA, intolleranze art. 9

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BookingRequest } from '@/types/booking'
import type { CustomerProfile } from '@/types/customer'
import { customerProfileKey } from '@/lib/customerEmail'
import { CustomerCardList } from '../CustomerCardList'

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: (key: string) => {
    if (key === 'booking_public_form_config') {
      return {
        data: {
          booking_modes: [
            {
              booking_type: 'tavolo',
              label: 'Prenota un Tavolo',
              enabled: true,
              sub_tabs: [],
            },
          ],
        },
      }
    }
    if (key === 'booking_custom_staff_presets') {
      return { data: [] }
    }
    return { data: null }
  },
}))

vi.mock('@/features/booking/hooks/useCustomerMutations', () => ({
  useUpdateCustomer: () => ({ mutate: vi.fn(), isPending: false }),
}))

function booking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'booking-1',
    tenant_id: 'tenant-1',
    client_name: 'Alice Rossi',
    client_email: 'alice@example.com',
    client_phone: '333',
    desired_date: '2026-06-27',
    created_at: '2026-06-20T14:30:00Z',
    updated_at: '2026-06-20T14:30:00Z',
    status: 'accepted',
    num_guests: 3,
    booking_type: 'tavolo',
    menu_total_booking: 120,
    dietary_restrictions: [],
    dietary_data_consent: false,
    ...overrides,
  } as BookingRequest
}

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    profileKey: customerProfileKey('alice@example.com', 'Alice Rossi'),
    email: 'alice@example.com',
    name: 'Alice Rossi',
    phone: '333',
    source: 'booking',
    booking_count: 1,
    total_guests: 3,
    last_booking_date: '2026-06-27',
    bookings: [booking()],
    accepted_count: 1,
    pending_count: 0,
    cancelled_count: 0,
    ...overrides,
  }
}

function renderList(props: Partial<ComponentProps<typeof CustomerCardList>> = {}) {
  const onToggleExpand = vi.fn()
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  const utils = render(
    <CustomerCardList
      rows={[profile()]}
      expandedProfileKey={null}
      onToggleExpand={onToggleExpand}
      onEdit={onEdit}
      onDelete={onDelete}
      {...props}
    />,
  )
  return { onToggleExpand, onEdit, onDelete, ...utils }
}

describe('CustomerCardList — Rubrica card + storico inline', () => {
  it('mostra card a tutta larghezza con date in GG/MM/AAAA', () => {
    // @admin-blindatura: crm
    renderList()

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Alice Rossi')).toBeVisible()
    expect(screen.getByText(/27\/06\/2026/)).toBeVisible()
  })

  it('click card espande storico con i campi richiesti', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    renderList({ onToggleExpand, expandedProfileKey: profile().profileKey })

    expect(screen.getByText(/Storico prenotazioni/i)).toBeVisible()
    expect(screen.getByText(/Prenota un Tavolo/i)).toBeVisible()
    expect(screen.getByText(/Prenotato il:/i)).toBeVisible()
    expect(screen.getByText(/Per il giorno:/i)).toBeVisible()
    expect(screen.getByText(/120,00/)).toBeVisible()

    const cardHeader = screen.getByText('Alice Rossi').closest('[role="button"]')
    expect(cardHeader).toBeTruthy()
    await user.click(cardHeader!)
    expect(onToggleExpand).toHaveBeenCalled()
  })

  it('Modifica ed Elimina non propagano il click sulla card', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const { onToggleExpand, onEdit, onDelete } = renderList()

    await user.click(screen.getByRole('button', { name: /Modifica contatti/i }))
    expect(onEdit).toHaveBeenCalled()
    expect(onToggleExpand).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Elimina/i }))
    expect(onDelete).toHaveBeenCalled()
    expect(onToggleExpand).toHaveBeenCalledTimes(0)
  })

  it('intolleranze: No se vuoto, Sì con messaggio consenso se compilato senza consenso', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const withDietary = profile({
      bookings: [
        booking({
          dietary_restrictions: [{ restriction: 'Celiachia', guest_count: 0 }],
          dietary_data_consent: false,
        }),
      ],
    })

    renderList({ rows: [withDietary], expandedProfileKey: withDietary.profileKey })

    const history = screen.getByText(/Storico prenotazioni/i).closest('section')
    expect(history).toBeTruthy()
    expect(within(history!).queryByText('No')).not.toBeInTheDocument()

    const siBtn = within(history!).getByRole('button', { name: 'Sì' })
    await user.click(siBtn)
    expect(
      screen.getByText(/Il cliente non ha autorizzato il salvataggio dei dati presso la piattaforma/i),
    ).toBeVisible()
  })

  it('intolleranze off-platform: dietary_restrictions vuoto + off_platform_notice=true → Sì + messaggio non autorizzato', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const withOffPlatform = profile({
      bookings: [
        booking({
          dietary_restrictions: [],
          dietary_data_consent: false,
          dietary_off_platform_notice: true,
        }),
      ],
    })

    renderList({ rows: [withOffPlatform], expandedProfileKey: withOffPlatform.profileKey })

    const history = screen.getByText(/Storico prenotazioni/i).closest('section')
    expect(history).toBeTruthy()
    expect(within(history!).queryByText('No')).not.toBeInTheDocument()

    const siBtn = within(history!).getByRole('button', { name: 'Sì' })
    await user.click(siBtn)
    expect(
      screen.getByText(/Il cliente non ha autorizzato il salvataggio dei dati presso la piattaforma/i),
    ).toBeVisible()
  })

  it('intolleranze vuote mostrano No non cliccabile', () => {
    // @admin-blindatura: crm
    renderList({ expandedProfileKey: profile().profileKey })

    const history = screen.getByText(/Storico prenotazioni/i).closest('section')
    expect(within(history!).getByText('No')).toBeVisible()
    expect(within(history!).queryByRole('button', { name: 'Sì' })).not.toBeInTheDocument()
  })
})
