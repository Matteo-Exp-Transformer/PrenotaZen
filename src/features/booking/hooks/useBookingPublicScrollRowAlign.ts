import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Outer scroll + inner flex: centra il gruppo se entra nel viewport, altrimenti
 * ancoraggio a sinistra (prima card/slide intera, scroll verso destra).
 */
export function useBookingPublicScrollRowAlign(itemCount: number) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [rowOverflows, setRowOverflows] = useState(false)

  const measureRow = useCallback(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    setRowOverflows(inner.scrollWidth > outer.clientWidth + 1)
  }, [])

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    measureRow()
    outer.addEventListener('scroll', measureRow, { passive: true })
    const ro = new ResizeObserver(measureRow)
    ro.observe(outer)
    ro.observe(inner)
    return () => {
      outer.removeEventListener('scroll', measureRow)
      ro.disconnect()
    }
  }, [itemCount, measureRow])

  const innerRowAlignClass = rowOverflows ? 'justify-start' : 'mx-auto justify-center'

  return { outerRef, innerRef, rowOverflows, measureRow, innerRowAlignClass }
}
