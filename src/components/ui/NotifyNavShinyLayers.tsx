import { cn } from '@/lib/utils'

/**
 * Solo tab “Prenotazioni” con badge: scia luminosa bianca che attraversa il pulsante + bordo soft.
 */
export function NotifyNavShinyLayers({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden
        className={cn('admin-nav-notify-shiny-edge pointer-events-none absolute inset-0 z-[6] rounded-[inherit]', className)}
      />
      <span
        aria-hidden
        className="admin-nav-notify-shiny-fill pointer-events-none absolute inset-0 z-[5] rounded-[inherit]"
      />
    </>
  )
}
