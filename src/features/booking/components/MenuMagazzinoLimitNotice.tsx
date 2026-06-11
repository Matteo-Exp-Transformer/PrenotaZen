import { cn } from '@/lib/utils'

type Props = {
  message: string
  className?: string
}

/** Messaggio limite duro raggiunto (pulsante disabilitato + testo chiaro). */
export function MenuMagazzinoLimitNotice({ message, className }: Props) {
  return (
    <p
      role="status"
      className={cn(
        'text-center text-xs font-medium text-red-600 sm:text-sm',
        className,
      )}
    >
      {message}
    </p>
  )
}
