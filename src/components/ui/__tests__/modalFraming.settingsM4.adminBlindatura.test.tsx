// @admin-blindatura: settings-modal-framing
// Copre: FIX 7 (16-06-26) — all'apertura il modale riceve focus + scrollIntoView (block:'start')
// così il dialog si inquadra dal titolo, niente più "centrato a metà" con contenuto più alto del
// viewport. NESSUNA modifica a z-index/struttura portal (LOCK): verificato che z-[10050] resta.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'

describe('settings-modal-framing M4 — FIX 7 inquadratura all’apertura', () => {
  beforeEach(() => {
    cleanup()
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('apertura modale → il dialog riceve focus e scrollIntoView block:start', async () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    render(
      <Modal isOpen onClose={vi.fn()} title="Anteprima foto">
        <p>Contenuto</p>
      </Modal>,
    )

    const dialog = await screen.findByRole('dialog', { name: /anteprima foto/i })

    const dialogEl = dialog.querySelector('[role="document"]') as HTMLElement
    expect(dialogEl).toHaveFocus()
    expect(scrollSpy).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
  })

  it('LOCK: la struttura portal e lo z-index z-[10050] non sono toccati dal fix', async () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Conferma">
        <p>Contenuto</p>
      </Modal>,
    )
    const dialog = await screen.findByRole('dialog', { name: /conferma/i })
    expect(dialog.className).toContain('z-[10050]')
  })

  it('rompi: modale chiusa (isOpen=false) non lancia errori e non chiama scrollIntoView', () => {
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy

    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Nascosta">
        <p>Contenuto</p>
      </Modal>,
    )

    expect(container).toBeEmptyDOMElement()
    expect(scrollSpy).not.toHaveBeenCalled()
  })
})
