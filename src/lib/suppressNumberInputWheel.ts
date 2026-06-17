import type { WheelEventHandler } from 'react'

/**
 * Evita che la rotella del mouse incrementi/decrementi un input `type="number"`.
 * Con focus: blocca l'azione nativa del browser. Senza focus: no-op (lo scroll pagina resta libero).
 */
export const suppressNumberInputWheel: WheelEventHandler<HTMLInputElement> = (event) => {
  if (document.activeElement === event.currentTarget) {
    event.preventDefault()
  }
}

export function mergeWheelHandlers(
  base: WheelEventHandler<HTMLInputElement>,
  user?: WheelEventHandler<HTMLInputElement>
): WheelEventHandler<HTMLInputElement> {
  if (!user) return base
  return (event) => {
    base(event)
    user(event)
  }
}
