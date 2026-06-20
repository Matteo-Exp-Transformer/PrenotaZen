type ScrollIntoCenterTarget = Element | null | (() => Element | null)

type ScrollIntoCenterOptions = {
  behavior?: ScrollBehavior
  tolerancePx?: number
}

const SCROLLABLE_OVERFLOW_RE = /(auto|scroll|overlay)/

function resolveTarget(target: ScrollIntoCenterTarget): Element | null {
  return typeof target === 'function' ? target() : target
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function isScrollableY(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const overflow = `${style.overflowY} ${style.overflow}`
  return SCROLLABLE_OVERFLOW_RE.test(overflow) && element.scrollHeight > element.clientHeight + 1
}

function findNearestScrollableAncestor(element: Element): HTMLElement | null {
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement) {
    if (isScrollableY(current)) return current
    current = current.parentElement
  }
  return null
}

export function scrollIntoCenter(
  target: Element | null,
  options: ScrollIntoCenterOptions = {},
): boolean {
  if (!target) return false

  const behavior = prefersReducedMotion() ? 'auto' : (options.behavior ?? 'smooth')
  const tolerancePx = options.tolerancePx ?? 24
  const targetRect = target.getBoundingClientRect()
  const scrollContainer = findNearestScrollableAncestor(target)

  if (!scrollContainer) {
    if (typeof target.scrollIntoView !== 'function') return false
    target.scrollIntoView({ behavior, block: 'center', inline: 'nearest' })
    return true
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const targetCenter = targetRect.top + targetRect.height / 2
  const containerCenter = containerRect.top + containerRect.height / 2
  const delta = targetCenter - containerCenter

  if (Math.abs(delta) <= tolerancePx) return false

  const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight)
  const nextTop = Math.min(maxScrollTop, Math.max(0, scrollContainer.scrollTop + delta))
  if (Math.abs(nextTop - scrollContainer.scrollTop) <= 1) return false

  scrollContainer.scrollTo({ top: nextTop, behavior })
  return true
}

export function scheduleScrollIntoCenter(
  target: ScrollIntoCenterTarget,
  options?: ScrollIntoCenterOptions,
): () => void {
  let cancelled = false
  const run = () => {
    if (!cancelled) scrollIntoCenter(resolveTarget(target), options)
  }

  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    const timeoutId = setTimeout(run, 0)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }

  const frameId = window.requestAnimationFrame(run)
  return () => {
    cancelled = true
    window.cancelAnimationFrame(frameId)
  }
}
