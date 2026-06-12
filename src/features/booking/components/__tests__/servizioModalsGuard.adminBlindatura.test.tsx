// @admin-blindatura: servizio
// FU-023 — guard chiusura modali Servizio con form dirty (DiscardChangesConfirmModal).

import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UnsavedChangesProvider } from '@/contexts/UnsavedChangesContext'
import { RoomConfigModal } from '../servizio/RoomConfigModal'

const mutateCreate = vi.fn()
const mutateUpdate = vi.fn()
const mutateDelete = vi.fn()

vi.mock('@/features/booking/hooks/useRooms', () => ({
  useCreateRoom: () => ({ mutate: mutateCreate, isPending: false }),
  useUpdateRoom: () => ({ mutate: mutateUpdate, isPending: false }),
  useDeleteRoom: () => ({ mutate: mutateDelete, isPending: false }),
}))

function renderRoomModal(props: Partial<ComponentProps<typeof RoomConfigModal>> = {}) {
  const onClose = vi.fn()
  render(
    <UnsavedChangesProvider>
      <RoomConfigModal
        isOpen
        onClose={onClose}
        initial={null}
        tableCount={0}
        {...props}
      />
    </UnsavedChangesProvider>,
  )
  return { onClose }
}

describe('Servizio modals — guard modifiche non salvate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('RoomConfigModal: modifica nome e Annulla → modale conferma discard', async () => {
    const user = userEvent.setup()
    renderRoomModal()

    await user.type(screen.getByLabelText(/nome sala/i), 'Sala test')
    await user.click(screen.getByRole('button', { name: /^annulla$/i }))

    expect(screen.getByText(/annullare le modifiche/i)).toBeInTheDocument()
    expect(screen.getByText(/le modifiche non salvate verranno perse/i)).toBeInTheDocument()
  })

  it('RoomConfigModal: conferma discard chiude la modale sala', async () => {
    const user = userEvent.setup()
    const { onClose } = renderRoomModal()

    await user.type(screen.getByLabelText(/nome sala/i), 'Sala test')
    await user.click(screen.getByRole('button', { name: /^annulla$/i }))
    await user.click(screen.getByRole('button', { name: /annulla modifiche/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('RoomConfigModal: Resta qui mantiene il draft aperto', async () => {
    const user = userEvent.setup()
    const { onClose } = renderRoomModal()

    await user.type(screen.getByLabelText(/nome sala/i), 'Sala test')
    await user.click(screen.getByRole('button', { name: /^annulla$/i }))
    await user.click(screen.getByRole('button', { name: /resta qui/i }))

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /nuova sala/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nome sala/i)).toHaveValue('Sala test')
  })
})
