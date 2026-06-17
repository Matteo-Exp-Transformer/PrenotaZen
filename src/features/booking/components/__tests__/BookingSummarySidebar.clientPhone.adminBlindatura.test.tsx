// @prenota-blindatura: flusso-utente
// Riepilogo mostra il telefono che Anna digita (client_phone), non contact_phone del ristorante.

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BookingSummarySidebar } from '../publicBooking/BookingSummarySidebar'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'

vi.mock('@/features/booking/hooks/useMenuCategories', () => ({
  useMenuCategories: () => ({ data: [] }),
}))

const MODES: BookingMode[] = [
  {
    id: 'm1',
    booking_type: 'tavolo',
    enabled: true,
    label: 'Tavolo',
    sub_tabs_enabled: false,
  } as BookingMode,
]

describe('BookingSummarySidebar — telefono cliente nel riepilogo', () => {
  it('mostra client_phone digitato dal cliente', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, client_phone: '333 1234567' }}
        modes={MODES}
      />,
    )
    expect(screen.getByText('Telefono')).toBeInTheDocument()
    expect(screen.getByText('333 1234567')).toBeInTheDocument()
  })

  it('mostra trattino se client_phone è vuoto', () => {
    render(
      <BookingSummarySidebar
        formData={{ num_guests: 2, client_phone: '' }}
        modes={MODES}
      />,
    )
    const phoneRow = screen.getByText('Telefono').closest('div')?.parentElement
    expect(phoneRow).toHaveTextContent('—')
  })
})
