import { useFeatures } from '@/hooks/useFeatures'
import { getMenuMagazzinoSavePropagationMessage } from '../constants/menuMagazzinoLimits'

/** Avviso propagazione viva su save ingredienti — copy edition-aware (M3 Fase 1). */
export function MenuMagazzinoPropagationNotice() {
  const { qrMenu } = useFeatures()

  return (
    <p
      role="note"
      className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-950 sm:text-sm"
    >
      {getMenuMagazzinoSavePropagationMessage(qrMenu)}
    </p>
  )
}
