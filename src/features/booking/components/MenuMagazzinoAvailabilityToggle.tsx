import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type MenuMagazzinoAvailabilityToggleProps = {
  available: boolean
  disabled?: boolean
  onToggle: () => void
  entityLabel: string
  compact?: boolean
}

/** Toggle disponibilità magazzino (M3 Fase 2) — occhio = visibile al pubblico Prenota + QR. */
export function MenuMagazzinoAvailabilityToggle({
  available,
  disabled = false,
  onToggle,
  entityLabel,
  compact = false,
}: MenuMagazzinoAvailabilityToggleProps) {
  const title = available
    ? 'Visibile in Prenota e Menu QR: clic per nascondere'
    : 'Nascosto al pubblico: clic per rendere di nuovo visibile'
  const ariaLabel = available
    ? `Nascondi ${entityLabel} in Prenota e Menu QR`
    : `Mostra ${entityLabel} in Prenota e Menu QR`

  return (
    <button
      type="button"
      aria-pressed={available}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cn(
        'menu-prices-icon-btn',
        available
          ? 'menu-prices-icon-btn--visibility-visible'
          : 'menu-prices-icon-btn--visibility-hidden',
        compact && 'h-8 w-8',
      )}
    >
      {available ? (
        <Eye className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
      ) : (
        <EyeOff className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
      )}
    </button>
  )
}
