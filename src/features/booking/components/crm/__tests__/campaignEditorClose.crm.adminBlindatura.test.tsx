// @admin-blindatura: crm
// Copre: chiusura editor campagna dopo Salva/Crea e Annulla (con guard se dirty)

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const { mockMutateCreate, mockMutateUpdate, mockConfirmNavigation } = vi.hoisted(() => ({
  mockMutateCreate: vi.fn(),
  mockMutateUpdate: vi.fn(),
  mockConfirmNavigation: vi.fn().mockResolvedValue(true),
}))

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/contexts/UnsavedChangesContext', () => ({
  useUnsavedChangesGuard: () => ({
    registerUnsavedSource: vi.fn(),
    registerUnsavedHandlers: vi.fn(),
    clearUnsavedSource: vi.fn(),
    confirmNavigation: mockConfirmNavigation,
  }),
}))

vi.mock('@/features/booking/hooks/useEmailCampaignMutations', () => ({
  useCreateCampaign: () => ({ mutate: mockMutateCreate, isPending: false }),
  useUpdateCampaign: () => ({ mutate: mockMutateUpdate, isPending: false }),
  useDeleteCampaign: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/features/booking/hooks/useCustomers', () => ({
  useCustomers: () => ({ customers: [] }),
}))

describe('CampaignEditor — chiusura dopo Salva / Annulla', () => {
  beforeEach(() => {
    mockMutateCreate.mockReset()
    mockMutateUpdate.mockReset()
    mockConfirmNavigation.mockReset()
    mockConfirmNavigation.mockResolvedValue(true)

    mockMutateCreate.mockImplementation((_payload, { onSuccess }) => onSuccess?.())
    mockMutateUpdate.mockImplementation((_payload, { onSuccess }) => onSuccess?.())
  })

  it('chiude l\'editor dopo Salva su campagna esistente', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onClose = vi.fn()
    const campaign = baseCampaign()

    render(<CampaignEditor campaign={campaign} onClose={onClose} />)

    await user.clear(screen.getByLabelText(/nome campagna/i))
    await user.type(screen.getByLabelText(/nome campagna/i), 'Estate aggiornata')
    await user.click(screen.getByRole('button', { name: /^salva$/i }))

    expect(mockMutateUpdate).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('chiude l\'editor dopo Crea campagna (regressione)', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CampaignEditor onClose={onClose} />)

    await user.type(screen.getByLabelText(/nome campagna/i), 'Nuova promo')
    await user.type(screen.getByLabelText(/oggetto email/i), 'Oggetto')
    await user.type(screen.getByLabelText(/corpo del messaggio/i), 'Testo')
    await user.click(screen.getByRole('button', { name: /crea campagna/i }))

    expect(mockMutateCreate).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Annulla senza modifiche chiude subito senza guard', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CampaignEditor campaign={baseCampaign()} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: /^annulla$/i }))

    expect(mockConfirmNavigation).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Annulla con form dirty passa dal guard e chiude se confermato', async () => {
    // @admin-blindatura: crm
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CampaignEditor campaign={baseCampaign()} onClose={onClose} />)

    await user.type(screen.getByLabelText(/oggetto email/i), ' modificato')
    await user.click(screen.getByRole('button', { name: /^annulla$/i }))

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Annulla con form dirty resta aperto se il guard nega la chiusura', async () => {
    // @admin-blindatura: crm
    mockConfirmNavigation.mockResolvedValue(false)
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CampaignEditor campaign={baseCampaign()} onClose={onClose} />)

    await user.type(screen.getByLabelText(/oggetto email/i), ' modificato')
    await user.click(screen.getByRole('button', { name: /^annulla$/i }))

    expect(mockConfirmNavigation).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })
})
