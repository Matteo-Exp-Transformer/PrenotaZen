import { useEffect } from 'react'

const BOOKING_PUBLIC_VIEWPORT =
  'width=device-width, initial-scale=1.0, interactive-widget=resizes-content, viewport-fit=cover'

/**
 * Stabilizza il viewport su Chrome Android per Pagina Prenota pubblica.
 * Evita ricalcoli del layer sfondo fixed quando la barra URL si nasconde/mostra in scroll.
 */
export function useBookingPublicViewport() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prevContent = meta?.getAttribute('content') ?? null
    const html = document.documentElement

    meta?.setAttribute('content', BOOKING_PUBLIC_VIEWPORT)
    html.classList.add('booking-public-viewport')

    return () => {
      if (meta) {
        if (prevContent) meta.setAttribute('content', prevContent)
      }
      html.classList.remove('booking-public-viewport')
    }
  }, [])
}
