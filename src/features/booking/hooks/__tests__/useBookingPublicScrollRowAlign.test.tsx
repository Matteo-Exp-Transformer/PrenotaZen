import { render, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBookingPublicScrollRowAlign } from '../useBookingPublicScrollRowAlign'

/**
 * FU-040 — blinda il ramo fit vs overflow dell'hook centratura card/slide Prenota.
 * jsdom non implementa ResizeObserver: lo mockiamo catturando la callback per
 * poterla scatenare a mano dopo aver forzato le larghezze dei nodi.
 */
let roCallback: ResizeObserverCallback | null = null

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    roCallback = cb
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function setWidth(node: HTMLElement, prop: 'clientWidth' | 'scrollWidth', value: number) {
  Object.defineProperty(node, prop, { configurable: true, value })
}

function Harness({ itemCount }: { itemCount: number }) {
  const { outerRef, innerRef, innerRowAlignClass } = useBookingPublicScrollRowAlign(itemCount)
  return (
    <div ref={outerRef} data-testid="outer">
      <div ref={innerRef} data-testid="inner" data-align={innerRowAlignClass} />
    </div>
  )
}

describe('useBookingPublicScrollRowAlign', () => {
  beforeEach(() => {
    roCallback = null
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function triggerMeasure() {
    act(() => {
      roCallback?.([], {} as ResizeObserver)
    })
  }

  it('gruppo che entra nel viewport → centrato (mx-auto justify-center)', () => {
    const { getByTestId } = render(<Harness itemCount={3} />)
    const outer = getByTestId('outer')
    const inner = getByTestId('inner')

    setWidth(outer, 'clientWidth', 400)
    setWidth(inner, 'scrollWidth', 300) // entra
    triggerMeasure()

    expect(inner.getAttribute('data-align')).toBe('mx-auto justify-center')
  })

  it('gruppo più largo del viewport → ancorato a sinistra (justify-start)', () => {
    const { getByTestId } = render(<Harness itemCount={5} />)
    const outer = getByTestId('outer')
    const inner = getByTestId('inner')

    setWidth(outer, 'clientWidth', 400)
    setWidth(inner, 'scrollWidth', 900) // sfora
    triggerMeasure()

    expect(inner.getAttribute('data-align')).toBe('justify-start')
  })

  it('tolleranza di 1px: scrollWidth = clientWidth+1 resta centrato', () => {
    const { getByTestId } = render(<Harness itemCount={2} />)
    const outer = getByTestId('outer')
    const inner = getByTestId('inner')

    setWidth(outer, 'clientWidth', 400)
    setWidth(inner, 'scrollWidth', 401) // entro la tolleranza (+1)
    triggerMeasure()

    expect(inner.getAttribute('data-align')).toBe('mx-auto justify-center')
  })

  it('passa da fit a overflow quando il contenuto cresce', () => {
    const { getByTestId } = render(<Harness itemCount={3} />)
    const outer = getByTestId('outer')
    const inner = getByTestId('inner')

    setWidth(outer, 'clientWidth', 400)
    setWidth(inner, 'scrollWidth', 200)
    triggerMeasure()
    expect(inner.getAttribute('data-align')).toBe('mx-auto justify-center')

    setWidth(inner, 'scrollWidth', 800)
    triggerMeasure()
    expect(inner.getAttribute('data-align')).toBe('justify-start')
  })
})
