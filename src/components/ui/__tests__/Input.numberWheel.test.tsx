// @admin-blindatura: input-number-wheel
// Copre: rotella mouse su input numerici admin — non deve cambiare il valore con focus.

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Input } from '../Input'

describe('Input type=number wheel', () => {
  it('applica suppressNumberInputWheel quando type è number', () => {
    render(<Input type="number" value={10} onChange={() => {}} aria-label="Coperti" />)
    const input = screen.getByLabelText('Coperti')
    input.focus()

    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    fireEvent(input, event)

    expect(preventDefault).toHaveBeenCalled()
  })

  it('non intercetta la rotella su input testo', () => {
    render(<Input type="text" value="10" onChange={() => {}} aria-label="Nome" />)
    const input = screen.getByLabelText('Nome')
    input.focus()

    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
    const preventDefault = vi.spyOn(event, 'preventDefault')
    fireEvent(input, event)

    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('chiama anche onWheel custom su input number', () => {
    const onWheel = vi.fn()
    render(
      <Input type="number" value={3} onChange={() => {}} onWheel={onWheel} aria-label="Prezzo" />
    )
    const input = screen.getByLabelText('Prezzo')
    input.focus()
    fireEvent.wheel(input, { deltaY: -50 })
    expect(onWheel).toHaveBeenCalled()
  })
})
