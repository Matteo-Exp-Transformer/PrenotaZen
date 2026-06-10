import { useEffect } from 'react'

const PUBLIC_MENU_VIEWPORT =
  'width=device-width, initial-scale=1.0, interactive-widget=resizes-content, viewport-fit=cover'

/**
 * Stabilizza il viewport su Chrome Android per le pagine menu QR pubblico.
 * Evita scroll spurio al caricamento (100vh > area visibile) che sposta la barra URL in basso.
 */
export function usePublicMenuViewport() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prevContent = meta?.getAttribute('content') ?? null
    const html = document.documentElement

    meta?.setAttribute('content', PUBLIC_MENU_VIEWPORT)
    html.classList.add('public-menu-viewport')

    return () => {
      if (meta) {
        if (prevContent) meta.setAttribute('content', prevContent)
      }
      html.classList.remove('public-menu-viewport')
    }
  }, [])
}
