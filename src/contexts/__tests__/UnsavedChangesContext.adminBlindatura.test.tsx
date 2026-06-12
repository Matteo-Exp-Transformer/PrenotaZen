import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '../UnsavedChangesContext'

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
})
