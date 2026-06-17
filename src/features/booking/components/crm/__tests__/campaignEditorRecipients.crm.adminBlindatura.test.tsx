// @admin-blindatura: crm
// Copre: destinatari confermati nel picker non si azzerano su refetch campagna (stesso id)

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EmailCampaign } from '@/features/booking/hooks/useEmailCampaigns'
import { CampaignEditor } from '../CampaignEditor'

const baseCampaign = (): EmailCampaign => ({
  id: 'camp-1',
  tenant_id: 'tenant-1',
  name: 'Estate',
  subject: 'Offerta',
  body: 'Corpo',
  heading: null,
  links: [],
  recipient_emails: ['alice@example.com'],
  enabled: true,
  cadence_type: 'none',
  cadence_config: null,
  last_sent_at: null,
  next_run_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/contexts/UnsavedChangesContext', () => ({
  useUnsavedChangesGuard: () => ({
    registerUnsavedSource: vi.fn(),
    registerUnsavedHandlers: vi.fn(),
    clearUnsavedSource: vi.fn(),
  }),
}))

vi.mock('@/features/booking/hooks/useEmailCampaignMutations', () => ({
  useCreateCampaign: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCampaign: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCampaign: () => ({ mutate: vi.fn(), isPending: false }),
}))

const customersMock = [
  {
    email: 'alice@example.com',
    name: 'Alice',
    source: 'booking' as const,
    booking_count: 1,
    total_guests: 2,
    bookings: [],
    accepted_count: 1,
    pending_count: 0,
    cancelled_count: 0,
  },
  {
    email: 'bob@example.com',
    name: 'Bob',
    source: 'booking' as const,
    booking_count: 1,
    total_guests: 2,
    bookings: [],
    accepted_count: 1,
    pending_count: 0,
    cancelled_count: 0,
  },
]

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: customersMock }),
}))

describe('CampaignEditor — stabilità gruppo destinatari', () => {
  it('non resetta i destinatari confermati nel picker quando la prop campaign viene rifetchata', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const campaign = baseCampaign()

    const { rerender } = render(<CampaignEditor campaign={campaign} onClose={vi.fn()} />)

    expect(screen.getByText(/1 contatt/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: /modifica gruppo/i }))
    await user.click(await screen.findByRole('checkbox', { name: /bob/i }))
    await user.click(screen.getByRole('button', { name: /^conferma$/i }))

    expect(screen.getByText(/2 contatt/i)).toBeVisible()

    rerender(
      <CampaignEditor
        campaign={{
          ...campaign,
          recipient_emails: ['alice@example.com'],
          name: 'Estate (refetch)',
        }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/2 contatt/i)).toBeVisible()
    expect(screen.getByDisplayValue('Estate')).toBeVisible()
  })
})
