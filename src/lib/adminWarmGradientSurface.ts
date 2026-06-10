import type { CSSProperties } from 'react'

/** Bordo pannelli admin — segue `--color-border` del tema attivo (`data-admin-theme`). */
export const ADMIN_WARM_BORDER = 'var(--color-border)' as const

/**
 * Superficie card pannelli admin (toolbar Menu, editor, panoramiche).
 * Nome storico `ADMIN_WARM_GRADIENT_*`: niente più gradient arancio; valori dal tema CSS.
 */
export const ADMIN_WARM_GRADIENT_SURFACE: CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  backgroundImage: 'none',
  borderColor: 'var(--color-border)',
}
