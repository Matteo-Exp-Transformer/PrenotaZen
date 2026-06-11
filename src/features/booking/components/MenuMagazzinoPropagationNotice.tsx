import { MENU_MAGAZZINO_SAVE_PROPAGATION_MESSAGE } from '../constants/menuMagazzinoLimits'

/** Avviso propagazione viva Prenota + QR (M3 Fase 1). */
export function MenuMagazzinoPropagationNotice() {
  return (
    <p
      role="note"
      className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-950 sm:text-sm"
    >
      {MENU_MAGAZZINO_SAVE_PROPAGATION_MESSAGE}
    </p>
  )
}
