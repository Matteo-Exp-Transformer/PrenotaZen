import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '../UnsavedChangesContext'

vi.mock('react-toastify', () => ({
  toast: {
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}))

function DirtyGuardHarness() {
  const { confirmNavigation, registerUnsavedSource, clearUnsavedSource } = useUnsavedChangesGuard()

  return (
    <>
      <button
        type="button"
        onClick={() => registerUnsavedSource('settings', 'Impostazioni', true)}
      >
        Rendi dirty
      </button>
      <button type="button" onClick={() => clearUnsavedSource('settings')}>
        Azzera dirty
      </button>
      <button
        type="button"
        onClick={() => void confirmNavigation()}
      >
        Cambia schermata
      </button>
    </>
  )
}

function BlockingGuardHarness() {
  const { confirmNavigation, registerBlockingSource, clearBlockingSource } = useUnsavedChangesGuard()

  return (
    <>
      <button
        type="button"
        onClick={() => registerBlockingSource('booking-details', 'Dettaglio prenotazione', true)}
      >
        Attiva blocco
      </button>
      <button type="button" onClick={() => clearBlockingSource('booking-details')}>
        Disattiva blocco
      </button>
      <button
        type="button"
        onClick={() => void confirmNavigation()}
      >
        Cambia schermata
      </button>
    </>
  )
}

describe('UnsavedChangesProvider — Admin blindatura', () => {
  it('mostra il guard quando si cambia schermata con modifiche non salvate', async () => {
    // @admin-blindatura: shell-dirty-guard
    // Copre: cambio sezione/tab Admin non procede in silenzio se ci sono draft aperti.
    const user = userEvent.setup()

    render(
      <UnsavedChangesProvider>
        <DirtyGuardHarness />
      </UnsavedChangesProvider>,
    )

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /rendi dirty/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia schermata/i }))
    })

    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeVisible()
    expect(screen.getByText(/sezioni: impostazioni/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /resta qui/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /salva e continua/i })).toBeVisible()
    expect(screen.getByRole('button', { name: /annulla e continua/i })).toBeVisible()
  })

  it('chiude il guard stale quando le sorgenti dirty si azzerano', async () => {
    // @admin-blindatura: shell-dirty-guard
    const user = userEvent.setup()

    render(
      <UnsavedChangesProvider>
        <DirtyGuardHarness />
      </UnsavedChangesProvider>,
    )

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /rendi dirty/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia schermata/i }))
    })
    expect(await screen.findByRole('heading', { name: /modifiche non salvate/i })).toBeVisible()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /azzera dirty/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia schermata/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })

  it('blocca il cambio schermata durante operazioni in corso senza modale dirty', async () => {
    // @admin-blindatura: prenotazioni — U3 tab switch durante mutation
    const user = userEvent.setup()

    render(
      <UnsavedChangesProvider>
        <BlockingGuardHarness />
      </UnsavedChangesProvider>,
    )

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^attiva blocco$/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia schermata/i }))
    })

    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^disattiva blocco$/i }))
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /cambia schermata/i }))
    })
    expect(screen.queryByRole('heading', { name: /modifiche non salvate/i })).not.toBeInTheDocument()
  })
})
