// @admin-blindatura: crm
// Copre: toggle apertura/chiusura editor campagna al click riga (con guard se dirty)

import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailCampaign } from '@/features/booking/hooks/useEmailCampaigns'
import { CampaignsManager } from '../CampaignsManager'

const baseCampaign = (overrides: Partial<EmailCampaign> = {}): EmailCampaign => ({
  id: 'camp-1',
  tenant_id: 'tenant-1',
  name: 'Estate',
  subject: 'Offerta estate',
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
  ...overrides,
})

const campaigns = [
  baseCampaign(),
  baseCampaign({ id: 'camp-2', name: 'Inverno', subject: 'Offerta inverno' }),
]

const {
  mockConfirmNavigation,
  mockSendMutate,
  mockRefetchQueries,
  mockPruneAsync,
  mockFilterEmailsWithMarketingConsent,
} = vi.hoisted(() => ({
  mockConfirmNavigation: vi.fn().mockResolvedValue(true),
  mockSendMutate: vi.fn(),
  mockRefetchQueries: vi.fn().mockResolvedValue(undefined),
  mockPruneAsync: vi.fn().mockResolvedValue(undefined),
  mockFilterEmailsWithMarketingConsent: vi.fn(),
}))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-1' }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      refetchQueries: mockRefetchQueries,
    }),
  }
})

vi.mock('@/contexts/UnsavedChangesContext', () => ({
  useUnsavedChangesGuard: () => ({
    confirmNavigation: mockConfirmNavigation,
  }),
}))

vi.mock('@/features/booking/hooks/useEmailCampaigns', () => ({
  useEmailCampaigns: () => ({ data: campaigns, isLoading: false }),
  EMAIL_CAMPAIGNS_QUERY_KEY: 'email-campaigns',
  EMAIL_CAMPAIGNS_MAX: 5,
  parseCampaignLinks: () => [],
  parseCampaignRecipients: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}))

vi.mock('@/features/booking/hooks/useEmailCampaignMutations', () => ({
  usePruneCampaignRecipients: () => ({ mutateAsync: mockPruneAsync, isPending: false }),
}))

vi.mock('@/features/booking/hooks/useSendCampaignEmail', () => ({
  useSendCampaignEmail: () => ({ mutate: mockSendMutate, isPending: false }),
}))

vi.mock('@/features/booking/hooks/useEmailNotifications', () => ({
  areEmailNotificationsEnabled: () => true,
}))

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  CRM_QUERY_KEY: 'crm-customer-profiles',
  useCustomers: () => ({
    customers: [
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
    ],
    isLoading: false,
  }),
}))

vi.mock('@/features/booking/utils/promoRecipientEligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/booking/utils/promoRecipientEligibility')>()
  return {
    ...actual,
    filterEmailsWithMarketingConsent: mockFilterEmailsWithMarketingConsent,
  }
})

vi.mock('../CampaignEditor', () => ({
  CampaignEditor: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="campaign-editor">
      <button type="button" onClick={onClose}>
        Chiudi editor mock
      </button>
    </div>
  ),
}))

function getCampaignRow(name: string) {
  return screen.getByRole('button', { name: new RegExp(name, 'i') })
}

describe('CampaignsManager — toggle riga campagna', () => {
  beforeEach(() => {
    mockConfirmNavigation.mockReset()
    mockConfirmNavigation.mockResolvedValue(true)
    mockSendMutate.mockReset()
    mockRefetchQueries.mockReset()
    mockRefetchQueries.mockResolvedValue(undefined)
    mockPruneAsync.mockReset()
    mockPruneAsync.mockResolvedValue(undefined)
    mockFilterEmailsWithMarketingConsent.mockReset()
    mockFilterEmailsWithMarketingConsent.mockImplementation(
      async (_tenantId: string, emails: string[]) => ({
        allowed: emails,
        skipped: 0,
      }),
    )
  })

  it('apre l\'editor al primo clic sulla riga campagna', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    expect(screen.queryByTestId('campaign-editor')).not.toBeInTheDocument()

    await user.click(getCampaignRow('Estate'))

    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()
    expect(mockConfirmNavigation).not.toHaveBeenCalled()
  })

  it('chiude l\'editor al secondo clic sulla stessa riga (form pulito)', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    await user.click(row)
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()

    await user.click(row)

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(screen.queryByTestId('campaign-editor')).not.toBeInTheDocument()
  })

  it('resta aperto se il guard nega la chiusura al ri-click', async () => {
    // @admin-blindatura: crm
    mockConfirmNavigation.mockResolvedValue(false)
    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    await user.click(row)
    await user.click(row)

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()
  })

  it('passa dal guard prima di aprire un\'altra campagna con editor aperto', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    await user.click(getCampaignRow('Estate'))
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()

    await user.click(getCampaignRow('Inverno'))

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(screen.getByTestId('campaign-editor')).toBeInTheDocument()
  })

  it('passa dal guard prima di aprire «Nuova campagna» con editor aperto', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    await user.click(getCampaignRow('Estate'))
    await user.click(screen.getByRole('button', { name: /\+ nuova campagna/i }))

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: /nuova campagna/i })).toBeInTheDocument()
  })

  it('«Invia ora» non toggla l\'editor — apre solo la modale di conferma invio', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    const sendNowButton = within(row).getByRole('button', { name: /^invia ora$/i })

    await user.click(sendNowButton)

    expect(screen.queryByTestId('campaign-editor')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /conferma invio campagna/i })).toBeInTheDocument()
    expect(mockConfirmNavigation).not.toHaveBeenCalled()
  })
})
