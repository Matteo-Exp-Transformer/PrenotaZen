// @admin-blindatura: crm
// Copre: refresh rubrica/campagne alla chiusura editor — «Invia ora» allineato senza riaprire card

import '@testing-library/jest-dom/vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EmailCampaign } from '@/features/booking/hooks/useEmailCampaigns'
import type { CustomerProfile } from '@/types/customer'
import { CampaignsManager } from '../CampaignsManager'

const baseCampaign = (overrides: Partial<EmailCampaign> = {}): EmailCampaign => ({
  id: 'camp-1',
  tenant_id: 'tenant-1',
  name: 'Estate',
  subject: 'Offerta estate',
  body: 'Corpo',
  heading: null,
  links: [],
  recipient_emails: ['alice@example.com', 'bob@example.com'],
  enabled: true,
  cadence_type: 'none',
  cadence_config: null,
  last_sent_at: null,
  next_run_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

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

let campaignsMock: EmailCampaign[] = [baseCampaign()]
let customersMock: CustomerProfile[] = [
  bookingCustomer('alice@example.com', 'Alice', true),
  bookingCustomer('bob@example.com', 'Bob', true),
]

const {
  mockConfirmNavigation,
  mockRefetchQueries,
  mockPruneAsync,
  mockFilterEmailsWithMarketingConsent,
} = vi.hoisted(() => ({
  mockConfirmNavigation: vi.fn().mockResolvedValue(true),
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
  useEmailCampaigns: () => ({ data: campaignsMock, isLoading: false }),
  EMAIL_CAMPAIGNS_QUERY_KEY: 'email-campaigns',
  EMAIL_CAMPAIGNS_MAX: 5,
  parseCampaignLinks: () => [],
  parseCampaignRecipients: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}))

vi.mock('@/features/booking/hooks/useEmailCampaignMutations', () => ({
  usePruneCampaignRecipients: () => ({ mutateAsync: mockPruneAsync, isPending: false }),
}))

vi.mock('@/features/booking/hooks/useSendCampaignEmail', () => ({
  useSendCampaignEmail: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/booking/hooks/useEmailNotifications', () => ({
  areEmailNotificationsEnabled: () => true,
}))

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  CRM_QUERY_KEY: 'crm-customer-profiles',
  useCustomers: () => ({ customers: customersMock, isLoading: false }),
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

function getSendNowButton(row: HTMLElement) {
  return within(row).getByRole('button', { name: /^invia ora$/i })
}

describe('CampaignsManager — refresh alla chiusura editor', () => {
  beforeEach(() => {
    campaignsMock = [baseCampaign()]
    customersMock = [
      bookingCustomer('alice@example.com', 'Alice', true),
      bookingCustomer('bob@example.com', 'Bob', true),
    ]
    mockConfirmNavigation.mockReset()
    mockConfirmNavigation.mockResolvedValue(true)
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
    mockRefetchQueries.mockImplementation(async () => {
      customersMock = [bookingCustomer('alice@example.com', 'Alice', true)]
      campaignsMock = [
        baseCampaign({ recipient_emails: ['alice@example.com', 'bob@example.com'] }),
      ]
    })
  })

  it('allinea «Invia ora» dopo chiusura editor quando il refetch segnala revoca parziale (N=1)', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    expect(getSendNowButton(row)).toBeEnabled()

    await user.click(row)
    await user.click(screen.getByRole('button', { name: /chiudi editor mock/i }))

    await waitFor(() => {
      expect(screen.queryByTestId('campaign-editor')).not.toBeInTheDocument()
      expect(mockRefetchQueries).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(getSendNowButton(getCampaignRow('Estate'))).toBeEnabled()
    })

    await user.click(getSendNowButton(getCampaignRow('Estate')))
    expect(screen.getByRole('dialog', { name: /conferma invio campagna/i })).toBeInTheDocument()
    expect(screen.getByText(/1/)).toBeVisible()
  })

  it('disabilita «Invia ora» dopo chiusura quando nessun destinatario resta eleggibile', async () => {
    // @admin-blindatura: crm
    mockRefetchQueries.mockImplementation(async () => {
      customersMock = [
        bookingCustomer('alice@example.com', 'Alice', false),
        bookingCustomer('bob@example.com', 'Bob', false),
      ]
    })

    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    await user.click(row)
    await user.click(screen.getByRole('button', { name: /chiudi editor mock/i }))

    await waitFor(() => {
      expect(getSendNowButton(getCampaignRow('Estate'))).toBeDisabled()
    })
  })

  it('prune recipient_emails su DB se filterEmailsWithMarketingConsent trova diff alla chiusura', async () => {
    // @admin-blindatura: crm
    mockFilterEmailsWithMarketingConsent.mockResolvedValue({
      allowed: ['alice@example.com'],
      skipped: 1,
    })

    const user = userEvent.setup()
    render(<CampaignsManager />)

    await user.click(getCampaignRow('Estate'))
    await user.click(screen.getByRole('button', { name: /chiudi editor mock/i }))

    await waitFor(() => {
      expect(mockPruneAsync).toHaveBeenCalledWith({
        id: 'camp-1',
        recipient_emails: ['alice@example.com'],
      })
    })
    expect(mockRefetchQueries).toHaveBeenCalled()
  })

  it('refresh anche al toggle riga (secondo click) senza passare da CampaignEditor.onClose', async () => {
    // @admin-blindatura: crm
    mockRefetchQueries.mockImplementation(async () => {
      customersMock = [bookingCustomer('alice@example.com', 'Alice', true)]
    })

    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    await user.click(row)
    await user.click(row)

    await waitFor(() => {
      expect(mockRefetchQueries).toHaveBeenCalled()
      expect(getSendNowButton(getCampaignRow('Estate'))).toBeEnabled()
    })
  })

  it('modale «Invia a N contatti» non si apre se dopo chiusura non restano eleggibili', async () => {
    // @admin-blindatura: crm
    mockRefetchQueries.mockImplementation(async () => {
      customersMock = []
    })

    const user = userEvent.setup()
    render(<CampaignsManager />)

    const row = getCampaignRow('Estate')
    await user.click(row)
    await user.click(screen.getByRole('button', { name: /chiudi editor mock/i }))

    await waitFor(() => {
      expect(getSendNowButton(getCampaignRow('Estate'))).toBeDisabled()
    })

    await user.click(getSendNowButton(getCampaignRow('Estate')))

    expect(screen.queryByRole('dialog', { name: /conferma invio campagna/i })).not.toBeInTheDocument()
  })
})
