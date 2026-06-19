// @admin-blindatura: crm
// Copre: destinatari confermati nel picker non si azzerano su refetch campagna (stesso id)

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailCampaign } from '@/features/booking/hooks/useEmailCampaigns'
import { CampaignEditor } from '../CampaignEditor'

const { mockMutatePrune, mockFilterEmailsWithMarketingConsent } = vi.hoisted(() => ({
  mockMutatePrune: vi.fn(),
  mockFilterEmailsWithMarketingConsent: vi.fn(),
}))

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
  usePruneCampaignRecipients: () => ({ mutate: mockMutatePrune, isPending: false }),
  useDeleteCampaign: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/booking/utils/promoRecipientEligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/booking/utils/promoRecipientEligibility')>()
  return {
    ...actual,
    filterEmailsWithMarketingConsent: mockFilterEmailsWithMarketingConsent,
  }
})

let customersMock = [
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
    marketing_consent: true,
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
    marketing_consent: true,
  },
]

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: customersMock, isLoading: false }),
}))

describe('CampaignEditor — stabilità gruppo destinatari', () => {
  beforeEach(() => {
    customersMock = [
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
        marketing_consent: true,
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
        marketing_consent: true,
      },
    ]
    mockMutatePrune.mockReset()
    mockFilterEmailsWithMarketingConsent.mockReset()
    mockFilterEmailsWithMarketingConsent.mockImplementation(async (_tenantId, emails: string[]) => ({
      allowed: emails,
      skipped: 0,
    }))
  })

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

  it('rimuove i destinatari senza consenso al load e aggiorna il gruppo salvato senza Salva', async () => {
    // @admin-blindatura: crm
    mockFilterEmailsWithMarketingConsent.mockResolvedValue({
      allowed: ['alice@example.com'],
      skipped: 1,
    })

    render(
      <CampaignEditor
        campaign={{
          ...baseCampaign(),
          recipient_emails: ['alice@example.com', 'no-consent@example.com'],
        }}
        onClose={vi.fn()}
      />,
    )

    expect(await screen.findByText(/1 contatt/i)).toBeVisible()
    expect(mockMutatePrune).toHaveBeenCalledWith(
      { id: 'camp-1', recipient_emails: ['alice@example.com'] },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('riallinea contatore e DB quando un cliente revoca il consenso con editor aperto', async () => {
    // @admin-blindatura: crm
    mockFilterEmailsWithMarketingConsent.mockResolvedValue({
      allowed: ['alice@example.com', 'bob@example.com'],
      skipped: 0,
    })

    const campaign = {
      ...baseCampaign(),
      recipient_emails: ['alice@example.com', 'bob@example.com'],
    }

    const { rerender } = render(<CampaignEditor campaign={campaign} onClose={vi.fn()} />)

    expect(await screen.findByText(/2 contatt/i)).toBeVisible()

    customersMock = [
      customersMock[0],
      { ...customersMock[1], marketing_consent: false },
    ]
    mockMutatePrune.mockClear()

    rerender(<CampaignEditor campaign={campaign} onClose={vi.fn()} />)

    expect(await screen.findByText(/1 contatt/i)).toBeVisible()
    expect(mockMutatePrune).toHaveBeenCalledWith(
      { id: 'camp-1', recipient_emails: ['alice@example.com'] },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('prune al load funziona anche sotto React.StrictMode', async () => {
    // @admin-blindatura: crm
    const { StrictMode } = await import('react')
    mockFilterEmailsWithMarketingConsent.mockResolvedValue({
      allowed: ['alice@example.com'],
      skipped: 1,
    })

    render(
      <StrictMode>
        <CampaignEditor
          campaign={{
            ...baseCampaign(),
            recipient_emails: ['alice@example.com', 'no-consent@example.com'],
          }}
          onClose={vi.fn()}
        />
      </StrictMode>,
    )

    expect(await screen.findByText(/1 contatt/i)).toBeVisible()
    expect(mockMutatePrune).toHaveBeenCalledWith(
      { id: 'camp-1', recipient_emails: ['alice@example.com'] },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })
})
