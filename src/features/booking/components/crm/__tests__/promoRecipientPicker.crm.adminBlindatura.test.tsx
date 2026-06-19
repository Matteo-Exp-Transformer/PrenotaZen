// @admin-blindatura: crm
// Copre: selezione destinatari campagna stabile nel picker (refetch clienti, edit campagna) fino a Conferma/Annulla

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CustomerProfile } from '@/types/customer'
import { PromoRecipientPicker } from '../PromoRecipientPicker'

const bookingCustomer = (
  email: string,
  name: string,
  marketing_consent = true,
): CustomerProfile => ({
  email,
  name,
  source: 'booking',
  booking_count: 1,
  total_guests: 2,
  bookings: [],
  accepted_count: 1,
  pending_count: 0,
  cancelled_count: 0,
  marketing_consent,
})

let customersMock: CustomerProfile[] = [
  bookingCustomer('alice@example.com', 'Alice'),
  bookingCustomer('bob@example.com', 'Bob'),
]

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: customersMock }),
}))

function renderPicker(
  props: Partial<ComponentProps<typeof PromoRecipientPicker>> = {},
) {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  const utils = render(
    <PromoRecipientPicker
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      initialRecipients={[]}
      {...props}
    />,
  )
  return { onClose, onConfirm, ...utils }
}

describe('PromoRecipientPicker — stabilità selezione destinatari', () => {
  it('pre-seleziona i destinatari già confermati nell’editor all’apertura', async () => {
    // @admin-blindatura: crm
    renderPicker({ initialRecipients: ['alice@example.com'] })

    const alice = await screen.findByRole('checkbox', { name: /alice/i })
    const bob = screen.getByRole('checkbox', { name: /bob/i })

    expect(alice).toBeChecked()
    expect(bob).not.toBeChecked()
    expect(screen.getByText(/1 selezionat/i)).toBeVisible()
  })

  it('mantiene la selezione durante un refetch della rubrica clienti', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const { rerender } = renderPicker()

    await user.click(await screen.findByRole('checkbox', { name: /alice/i }))
    expect(screen.getByText(/1 selezionat/i)).toBeVisible()

    customersMock = [
      ...customersMock,
      bookingCustomer('carol@example.com', 'Carol'),
    ]

    rerender(
      <PromoRecipientPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialRecipients={[]}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /alice/i })).toBeChecked()
    expect(screen.getByText(/1 selezionat/i)).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /carol/i })).not.toBeChecked()
  })

  it('non resetta il draft se initialRecipients cambia mentre il modale è aperto', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const { rerender } = renderPicker({ initialRecipients: ['alice@example.com'] })

    await user.click(screen.getByRole('checkbox', { name: /bob/i }))
    expect(screen.getByText(/2 selezionat/i)).toBeVisible()

    rerender(
      <PromoRecipientPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialRecipients={['alice@example.com']}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /alice/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /bob/i })).toBeChecked()
    expect(screen.getByText(/2 selezionat/i)).toBeVisible()
  })

  it('propaga i destinatari solo su Conferma, non su Annulla', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    const { unmount } = render(
      <PromoRecipientPicker
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        initialRecipients={[]}
      />,
    )

    await user.click(await screen.findByRole('checkbox', { name: /alice/i }))
    await user.click(screen.getByRole('button', { name: /annulla/i }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()

    const onConfirm2 = vi.fn()
    render(
      <PromoRecipientPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm2}
        initialRecipients={[]}
      />,
    )

    await user.click(await screen.findByRole('checkbox', { name: /bob/i }))
    await user.click(screen.getByRole('button', { name: /^conferma$/i }))

    expect(onConfirm2).toHaveBeenCalledWith(['bob@example.com'])
  })

  it('esclude i clienti manuali dalla lista (solo prenotazione)', async () => {
    // @admin-blindatura: crm
    customersMock = [
      bookingCustomer('alice@example.com', 'Alice'),
      {
        ...bookingCustomer('manual@example.com', 'Manuale'),
        source: 'manual',
      },
    ]

    renderPicker()

    expect(await screen.findByRole('checkbox', { name: /alice/i })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /manuale/i })).not.toBeInTheDocument()
  })

  it('esclude i clienti senza consenso marketing', async () => {
    // @admin-blindatura: crm
    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('no-consent@example.com', 'No Consent', false),
    ]

    renderPicker()

    expect(await screen.findByRole('checkbox', { name: /alice/i })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /no consent/i })).not.toBeInTheDocument()
  })

  it('non propaga in Conferma email senza consenso presenti in initialRecipients', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    renderPicker({
      initialRecipients: ['alice@example.com', 'no-consent@example.com'],
      onConfirm,
    })

    expect(screen.getByText(/1 selezionat/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /^conferma$/i }))

    expect(onConfirm).toHaveBeenCalledWith(['alice@example.com'])
  })

  it('aggiorna contatore quando un cliente revoca il consenso con modale aperto', async () => {
    // @admin-blindatura: crm
    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('bob@example.com', 'Bob', true),
    ]

    const { rerender } = renderPicker({
      initialRecipients: ['alice@example.com', 'bob@example.com'],
    })

    expect(await screen.findByText(/2 selezionat/i)).toBeVisible()

    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('bob@example.com', 'Bob', false),
    ]

    rerender(
      <PromoRecipientPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialRecipients={['alice@example.com', 'bob@example.com']}
      />,
    )

    expect(screen.getByText(/1 selezionat/i)).toBeVisible()
    expect(screen.queryByRole('checkbox', { name: /bob/i })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /alice/i })).toBeChecked()
  })

  it('mantiene il draft valido se l’admin seleziona Bob e poi Bob revoca il consenso', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('bob@example.com', 'Bob', true),
    ]

    const { rerender } = renderPicker({ initialRecipients: ['alice@example.com'] })

    await user.click(screen.getByRole('checkbox', { name: /bob/i }))
    expect(screen.getByText(/2 selezionat/i)).toBeVisible()

    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('bob@example.com', 'Bob', false),
    ]

    rerender(
      <PromoRecipientPicker
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialRecipients={['alice@example.com']}
      />,
    )

    expect(screen.getByText(/1 selezionat/i)).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /alice/i })).toBeChecked()
  })
})
