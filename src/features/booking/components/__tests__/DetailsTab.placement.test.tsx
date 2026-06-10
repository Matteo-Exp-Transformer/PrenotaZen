import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetailsTab } from '../DetailsTab'
import type { BookingRequest } from '@/types/booking'

vi.mock('@/hooks/useFeatures', () => ({
  useFeatures: vi.fn(),
}))

vi.mock('@/features/booking/hooks/useRestaurantSetting', () => ({
  useRestaurantSetting: vi.fn((key: string) => {
    if (key === 'booking_placement_areas') {
      return { data: ['Sala A', 'Sala B'] }
    }
    if (key === 'booking_menu_promos') {
      return { data: [] }
    }
    return { data: undefined }
  }),
}))

import { useFeatures } from '@/hooks/useFeatures'

const mockUseFeatures = vi.mocked(useFeatures)

const BOOKING: BookingRequest = {
  id: 'booking-1',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
  client_name: 'Mario Rossi',
  client_email: 'mario@test.it',
  event_type: 'cena',
  desired_date: '2026-05-10',
  num_guests: 4,
  status: 'accepted',
  placement: 'Sala A',
  booking_type: 'tavolo',
  tenant_id: 'tenant-1',
}

const baseFormData = {
  booking_type: 'tavolo' as const,
  client_name: 'Mario Rossi',
  client_email: 'mario@test.it',
  client_phone: '',
  date: '2026-05-10',
  startTime: '20:00',
  endTime: '23:00',
  numGuests: 4,
  specialRequests: '',
  placement: 'Sala A',
}

describe('DetailsTab — Posizionamento edition gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Classic (servizio false): non mostra Posizionamento in view mode', () => {
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

    render(
      <DetailsTab
        booking={BOOKING}
        isEditMode={false}
        formData={baseFormData}
        onFormDataChange={vi.fn()}
        onBookingTypeChange={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Posizionamento/)).not.toBeInTheDocument()
  })

  it('Pro (servizio true): mostra Posizionamento in view mode', () => {
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

    render(
      <DetailsTab
        booking={BOOKING}
        isEditMode={false}
        formData={baseFormData}
        onFormDataChange={vi.fn()}
        onBookingTypeChange={vi.fn()}
      />,
    )

    expect(screen.getByText(/Posizionamento/)).toBeInTheDocument()
    expect(screen.getByText('Sala A')).toBeInTheDocument()
  })

  it('Classic (servizio false): non mostra select Posizionamento in edit mode', () => {
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

    render(
      <DetailsTab
        booking={BOOKING}
        isEditMode={true}
        formData={baseFormData}
        onFormDataChange={vi.fn()}
        onBookingTypeChange={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Posizionamento/)).not.toBeInTheDocument()
  })
})
