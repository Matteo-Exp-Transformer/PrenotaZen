// @admin-blindatura: menu-magazzino-propagation-notice
// Avviso save ingredienti — copy edition-aware (features.qrMenu).

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MenuMagazzinoPropagationNotice } from '../MenuMagazzinoPropagationNotice'

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: vi.fn(),
}))

import { useFeatures } from '@/hooks/useFeatures'

const mockUseFeatures = vi.mocked(useFeatures)

describe('@admin-blindatura menu-magazzino-propagation-notice — edition-aware copy', () => {
  it('Classic senza QR: banner senza riferimento a Menu QR', () => {
    mockUseFeatures.mockReturnValue({
      sidebar: false,
      home: false,
      crm: false,
      analytics: false,
      servizio: false,
      walkIn: false,
      noShow: false,
      tableAssignments: false,
      qrMenu: false,
    })

    render(<MenuMagazzinoPropagationNotice />)

    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/Pagina Prenota/)
    expect(note).not.toHaveTextContent(/Menu QR/)
    expect(note).toHaveTextContent(/prenotazioni già inviate/)
  })

  it('tenant con qrMenu: banner cita anche Menu QR', () => {
    mockUseFeatures.mockReturnValue({
      sidebar: true,
      home: true,
      crm: true,
      analytics: true,
      servizio: true,
      walkIn: true,
      noShow: true,
      tableAssignments: true,
      qrMenu: true,
    })

    render(<MenuMagazzinoPropagationNotice />)

    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/Pagina Prenota/)
    expect(note).toHaveTextContent(/Menu QR/)
  })
})
