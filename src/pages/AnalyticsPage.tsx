import type { FC } from 'react'
import { useState } from 'react'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Button } from '@/components/ui'
import { AnalyticsKpiCard } from '@/features/booking/components/analytics/AnalyticsKpiCard'
import { AnalyticsTrendChart } from '@/features/booking/components/analytics/AnalyticsTrendChart'
import { ShiftToggle } from '@/features/booking/components/analytics/ShiftToggle'
import { BookedByChart } from '@/features/booking/components/analytics/BookedByChart'
import {
  useAnalytics,
  useAnalyticsComparison,
  computeKpiDelta,
  computeOccupancyRate,
  getPeriodBounds,
  type DateRange,
  type ShiftFilter,
} from '@/features/booking/hooks/useAnalytics'
import { useRooms } from '@/features/booking/hooks/useRooms'
import { useTables } from '@/features/booking/hooks/useServizioTables'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'

const RANGE_LABELS: { value: DateRange; label: string }[] = [
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
  { value: 'year', label: 'Anno' },
]

function periodLabel(range: DateRange, offset: number): string {
  const { startDay, endDay } = getPeriodBounds(range, offset)
  if (range === 'week') {
    return `${format(startDay, 'd MMM', { locale: it })} – ${format(endDay, 'd MMM', { locale: it })}`
  }
  if (range === 'month') {
    return format(startDay, 'MMMM yyyy', { locale: it })
  }
  return format(startDay, 'yyyy')
}

export const AnalyticsPage: FC = () => {
  const [range, setRange] = useState<DateRange>('month')
  const [shift, setShift] = useState<ShiftFilter>('all')
  const [offset, setOffset] = useState(0)

  const { data: businessHoursRaw } = useRestaurantSetting('business_hours')
  const { data: rooms = [] } = useRooms()
  const { data: tables = [] } = useTables()

  const totalSeats = tables.filter((t) => t.active).reduce((sum, t) => sum + t.capacity, 0)

  const { data, isLoading, error } = useAnalytics(range, shift, businessHoursRaw, offset)
  const { data: prevData } = useAnalyticsComparison(range, shift, businessHoursRaw, offset)

  const kpi = data?.kpi
  const prevKpi = prevData?.kpi
  const trend = data?.trend ?? []
  const hasData = data?.hasData ?? false

  const roomsConfigured = rooms.length > 0 && totalSeats > 0
  const occupancyRate =
    roomsConfigured && kpi ? computeOccupancyRate(kpi.totalCovers, totalSeats, range, businessHoursRaw, offset) : null
  const prevOccupancyRate =
    roomsConfigured && prevKpi ? computeOccupancyRate(prevKpi.totalCovers, totalSeats, range, businessHoursRaw, offset - 1) : null

  const handleRangeChange = (r: DateRange) => {
    setRange(r)
    setOffset(0)
  }

  return (
    <div className="min-h-0 flex-1 bg-(--color-bg) px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-title-page font-bold text-primary-900">Analytics</h1>
            {/* Toggle turno — a destra del titolo */}
            <ShiftToggle value={shift} onChange={setShift} />
          </div>

          {/* Toggle range — centrato */}
          <div className="flex justify-center gap-2">
            {RANGE_LABELS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant={range === value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleRangeChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Navigator periodo */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border) bg-surface text-primary-900 shadow-sm transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Periodo precedente"
              title="Periodo precedente"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-label min-w-[160px] text-center font-semibold capitalize text-primary-900">
              {periodLabel(range, offset)}
            </span>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              disabled={offset >= 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border) bg-surface text-primary-900 shadow-sm transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Periodo successivo"
              title="Periodo successivo"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {error ? (
          <div className="text-body rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-red-800">
            <p className="font-semibold">Impossibile caricare gli analytics.</p>
            <p className="mt-1">{error.message}</p>
          </div>
        ) : (
          <>
            {/* KPI grid — 5 card su 2 righe */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <AnalyticsKpiCard
                label="Prenotazioni"
                value={kpi?.totalBookings ?? 0}
                isLoading={isLoading}
                delta={kpi && prevKpi ? computeKpiDelta(kpi.totalBookings, prevKpi.totalBookings) : null}
              />
              <AnalyticsKpiCard
                label="Coperti totali"
                value={kpi?.totalCovers ?? 0}
                isLoading={isLoading}
                delta={kpi && prevKpi ? computeKpiDelta(kpi.totalCovers, prevKpi.totalCovers) : null}
              />
              <AnalyticsKpiCard
                label="Tasso conferma"
                value={kpi?.confirmationRate ?? 0}
                suffix="%"
                isLoading={isLoading}
                delta={kpi && prevKpi ? computeKpiDelta(kpi.confirmationRate, prevKpi.confirmationRate) : null}
              />
              <AnalyticsKpiCard
                label="Media coperti/booking"
                value={kpi?.avgPartySize ?? 0}
                isLoading={isLoading}
                delta={kpi && prevKpi ? computeKpiDelta(kpi.avgPartySize, prevKpi.avgPartySize) : null}
              />
              <AnalyticsKpiCard
                label="Tasso no-show"
                value={kpi?.noShowRate ?? 0}
                suffix="%"
                isLoading={isLoading}
                delta={kpi && prevKpi ? computeKpiDelta(kpi.noShowRate, prevKpi.noShowRate) : null}
              />
            </div>

            {/* Card tasso occupazione — coperti / (posti × giorni periodo) */}
            <AnalyticsKpiCard
              label="Tasso occupazione"
              value={occupancyRate != null ? occupancyRate : '—'}
              suffix={occupancyRate != null ? '%' : undefined}
              isLoading={isLoading && roomsConfigured}
              disabled={!roomsConfigured}
              disabledTooltip="Configura sala e tavoli per attivare questo KPI"
              delta={
                occupancyRate != null && prevOccupancyRate != null
                  ? computeKpiDelta(occupancyRate, prevOccupancyRate)
                  : null
              }
            />

            {/* Trend */}
            <div className="space-y-3">
              <h2 className="text-title-section font-semibold text-primary-900">Trend prenotazioni e coperti</h2>

              {isLoading ? (
                <div
                  className="flex h-80 items-center justify-center rounded-xl border border-(--color-border) bg-surface"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-primary-600" aria-hidden />
                  <span className="sr-only">Caricamento grafico</span>
                </div>
              ) : hasData ? (
                <AnalyticsTrendChart data={trend} range={range} isEmpty={false} />
              ) : (
                <p className="text-body rounded-xl border border-(--color-border) bg-surface px-4 py-12 text-center text-(--color-text-muted) shadow-sm">
                  Nessuna prenotazione nel periodo selezionato. Scegli un altro intervallo o attendi nuove
                  richieste.
                </p>
              )}
            </div>

            {/* Booked By chart */}
            <BookedByChart data={kpi?.bookedBy ?? []} isLoading={isLoading} />
          </>
        )}
      </div>
    </div>
  )
}
