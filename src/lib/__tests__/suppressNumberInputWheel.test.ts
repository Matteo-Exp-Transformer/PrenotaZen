import { describe, expect, it, vi } from 'vitest'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { suppressNumberInputWheel } from '../suppressNumberInputWheel'

function wheelEvent(target: HTMLInputElement, focused: boolean) {
  if (focused) {
    target.focus()
  } else {
    target.blur()
  }
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 })
  Object.defineProperty(event, 'currentTarget', { value: target, configurable: true })
  vi.spyOn(event, 'preventDefault')
  return event
}

describe('suppressNumberInputWheel', () => {
  it('blocca la rotella quando l input number ha focus', () => {
    const input = document.createElement('input')
    input.type = 'number'
    document.body.appendChild(input)

    const event = wheelEvent(input, true)
    suppressNumberInputWheel(event as unknown as ReactWheelEvent<HTMLInputElement>)

    expect(event.preventDefault).toHaveBeenCalled()
    input.remove()
  })

  it('non blocca la rotella quando l input number non ha focus', () => {
    const input = document.createElement('input')
    input.type = 'number'
    document.body.appendChild(input)

    const event = wheelEvent(input, false)
    suppressNumberInputWheel(event as unknown as ReactWheelEvent<HTMLInputElement>)

    expect(event.preventDefault).not.toHaveBeenCalled()
    input.remove()
  })
})
