import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Armchair,
  CalendarDays,
  TriangleAlert,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DayDigestSummary } from '../../utils/dayDigestModel'

interface DayDigestSummaryPanelProps {
  summary: DayDigestSummary
  /** Data selezionata in formato YYYY-MM-DD */
  date: string
  isPro: boolean
}

export function DayDigestSummaryPanel({ summary, date, isPro }: DayDigestSummaryPanelProps) {
  const formattedDate = format(new Date(date), 'EEEE, dd MMMM yyyy', { locale: it })

  return (
    <div className="mb-5">
      <h4 className="mb-4 text-center text-title-section font-semibold leading-snug text-primary-900">
        Prenotazioni del giorno:{' '}
        <span className="text-value font-normal text-(--color-text-muted)">{formattedDate}</span>
      </h4>
      {summary.totalBookings > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <StatChip icon={CalendarDays} label="Prenotazioni" value={summary.totalBookings} />
          <StatChip icon={Users} label="Coperti" value={summary.totalGuests} />
          <StatChip icon={Utensils} label="Con menu" value={summary.withMenuCount} />
          {isPro && (
            <StatChip
              icon={Armchair}
              label="Da assegnare"
              value={summary.pendingAssignments}
              variant="warning"
            />
          )}
          {summary.outOfSlotCount > 0 && (
            <StatChip
              icon={TriangleAlert}
              label="Fuori fascia"
              value={summary.outOfSlotCount}
              variant="danger"
            />
          )}
        </div>
      )}
    </div>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: LucideIcon
  label: string
  value: number
  variant?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div
      className={cn(
        'grid min-h-[6.25rem] grid-cols-[2rem_auto] items-center justify-center gap-x-3 rounded-lg border px-4 py-3 sm:min-w-[10rem] sm:px-5',
        variant === 'warning' && 'bg-amber-50 border-amber-200 text-amber-800',
        variant === 'danger' && 'bg-red-50 border-red-200 text-red-800',
        variant === 'default' && 'bg-(--color-surface-2) border-(--color-border) text-(--color-text)',
      )}
    >
      <Icon className="row-span-2 h-7 w-7 justify-self-center text-primary-950" aria-hidden />
      <span className="text-center text-stat-big font-bold leading-tight text-primary-950 tabular-nums">
        {value}
      </span>
      <span className="text-center text-label leading-tight text-(--color-text-muted)">
        {label}
      </span>
    </div>
  )
}
