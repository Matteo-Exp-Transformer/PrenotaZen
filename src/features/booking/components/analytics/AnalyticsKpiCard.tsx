import type { FC } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KpiDelta } from '@/features/booking/hooks/useAnalytics'

export interface AnalyticsKpiCardProps {
  label: string
  value: string | number
  suffix?: string
  isLoading?: boolean
  /** Delta vs periodo precedente. Se assente, il badge non viene mostrato. */
  delta?: KpiDelta | null
  /** Se true, mostra un tooltip invece del valore (es. tasso occupazione non disponibile). */
  disabled?: boolean
  disabledTooltip?: string
}

export const AnalyticsKpiCard: FC<AnalyticsKpiCardProps> = ({
  label,
  value,
  suffix,
  isLoading,
  delta,
  disabled,
  disabledTooltip,
}) => (
  <div
    className={cn(
      'rounded-xl border border-(--color-border) bg-surface p-4 shadow-sm md:p-5',
      disabled && 'opacity-60',
    )}
    title={disabled ? disabledTooltip : undefined}
  >
    <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted) md:text-sm">
      {label}
    </p>
    <div className="mt-2 flex min-h-8 items-baseline gap-1 md:min-h-9">
      {isLoading ? (
        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary-600" aria-hidden />
      ) : disabled ? (
        <span className="text-sm text-(--color-text-muted)">{disabledTooltip ?? '—'}</span>
      ) : (
        <>
          <span className="text-2xl font-bold tabular-nums text-primary-900 md:text-3xl">{value}</span>
          {suffix ? (
            <span className="text-sm font-medium text-(--color-text-muted) md:text-base">{suffix}</span>
          ) : null}
        </>
      )}
    </div>

    {/* Badge delta vs periodo precedente */}
    {!isLoading && !disabled && delta && (
      <div
        className={cn(
          'mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
          delta.direction === 'up' && 'bg-green-50 text-green-700',
          delta.direction === 'down' && 'bg-red-50 text-red-700',
          delta.direction === 'neutral' && 'bg-surface text-(--color-text-muted)',
        )}
      >
        {delta.direction === 'up' && <TrendingUp className="h-3 w-3" aria-hidden />}
        {delta.direction === 'down' && <TrendingDown className="h-3 w-3" aria-hidden />}
        {delta.direction === 'neutral' && <Minus className="h-3 w-3" aria-hidden />}
        {delta.label}
      </div>
    )}
  </div>
)
