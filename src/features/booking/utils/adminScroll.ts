/** Trova il contenitore scroll admin (Pro: `<main>` con overflow-y, non il main interno). */
function findAdminScrollContainer(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement
  while (node) {
    if (node.tagName === 'MAIN') {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return node
      }
    }
    node = node.parentElement
  }

  return (
    (document.querySelector('main.overflow-y-auto') as HTMLElement | null) ??
    (document.querySelector('main.pl-16') as HTMLElement | null) ??
    (document.querySelector('main') as HTMLElement | null)
  )
}

/** Scroll di un elemento nel `<main>` AdminShell (Pro) o in fallback su window. */
export function scrollIntoAdminShellView(
  element: HTMLElement | null,
  options: {
    behavior?: ScrollBehavior
    scrollMarginTop?: number
    /** Secondo passaggio rAF se l’elemento resta sopra il viewport (form categorie da card in fondo). */
    ensureVisible?: boolean
  } = {},
): void {
  if (!element) return

  const behavior = options.behavior ?? 'smooth'
  const scrollMarginTop = options.scrollMarginTop ?? 96
  const ensureVisible = options.ensureVisible ?? false

  const shellMain = findAdminScrollContainer(element)

  const isAboveShellMain = (main: HTMLElement) => {
    const elRect = element.getBoundingClientRect()
    const mainRect = main.getBoundingClientRect()
    return elRect.top < mainRect.top + scrollMarginTop
  }

  const scrollOnce = (scrollBehavior: ScrollBehavior) => {
    if (shellMain instanceof HTMLElement) {
      const elRect = element.getBoundingClientRect()
      const mainRect = shellMain.getBoundingClientRect()
      const targetTop = elRect.top - mainRect.top + shellMain.scrollTop - scrollMarginTop
      shellMain.scrollTo({ top: Math.max(0, targetTop), behavior: scrollBehavior })
      return
    }

    element.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
  }

  scrollOnce(behavior)

  if (!ensureVisible) return

  requestAnimationFrame(() => {
    if (shellMain instanceof HTMLElement && isAboveShellMain(shellMain)) {
      scrollOnce('auto')
    }

    requestAnimationFrame(() => {
      if (!(shellMain instanceof HTMLElement)) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' })
        return
      }

      if (isAboveShellMain(shellMain)) {
        const elRect = element.getBoundingClientRect()
        const mainRect = shellMain.getBoundingClientRect()
        const targetTop = elRect.top - mainRect.top + shellMain.scrollTop - scrollMarginTop
        shellMain.scrollTo({ top: Math.max(0, targetTop), behavior: 'auto' })
      }
    })
  })
}
