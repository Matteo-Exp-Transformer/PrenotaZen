import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Armchair,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DayDigestSummary } from '../../utils/dayDigestModel'

function parseLocalIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

interface DayDigestSummaryPanelProps {
  summary: DayDigestSummary
  /** Data selezionata in formato YYYY-MM-DD */
  date: string
  isPro: boolean
  onPreviousDay: () => void
  onNextDay: () => void
}

export function DayDigestSummaryPanel({
  summary,
  date,
  isPro,
  onPreviousDay,
  onNextDay,
}: DayDigestSummaryPanelProps) {
  const formattedDate = format(parseLocalIsoDate(date), 'EEEE, dd MMMM yyyy', { locale: it })

  return (
    <div className="mb-5">
      <div className="mx-auto mb-4 grid w-full max-w-3xl grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 text-center sm:grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] sm:gap-3">
        <DayNavButton direction="previous" onClick={onPreviousDay} />
        <h4 className="min-w-0 text-title-section font-semibold leading-snug text-primary-900">
          Prenotazioni del giorno:{' '}
          <span className="text-[0.92em] font-medium text-(--color-text-muted)">
            {formattedDate}
          </span>
        </h4>
        <DayNavButton direction="next" onClick={onNextDay} />
      </div>
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

function DayNavButton({
  direction,
  onClick,
}: {
  direction: 'previous' | 'next'
  onClick: () => void
}) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight
  const label = direction === 'previous' ? 'Giorno precedente' : 'Giorno successivo'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-primary-900 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2 sm:h-10 sm:w-10"
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
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
