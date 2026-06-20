import React from 'react'
import { ChevronDown } from 'lucide-react'
import type { BookingRequest } from '@/types/booking'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'
import type { DayServiceGroup } from '../../utils/dayDigestModel'
import { digestBookingHasMenuContext } from '../../utils/digestBookingUtils'
import { DayHourGroup } from './DayHourGroup'
import { BookingDigestCard } from './BookingDigestCard'
import { cn } from '@/lib/utils'

interface DayServiceGroupCardProps {
  group: DayServiceGroup
  isPro: boolean
  assignedBookingIds: Set<string>
  filterByTurn: (list: BookingRequest[]) => BookingRequest[]
  bookingModes?: BookingMode[]
  customStaffPresets?: CustomStaffPreset[]
  occupancyCapacity?: number | null
  onOpenBooking: (booking: BookingRequest) => void
  onDotClick?: (booking: BookingRequest, e: React.MouseEvent) => void
}

export function DayServiceGroupCard({
  group,
  isPro,
  assignedBookingIds,
  filterByTurn,
  bookingModes = [],
  customStaffPresets = [],
  occupancyCapacity = null,
  onOpenBooking,
  onDotClick,
}: DayServiceGroupCardProps) {
  const contentId = React.useId()
  const [expanded, setExpanded] = React.useState(false)
  const occupancyPercent =
    occupancyCapacity != null && occupancyCapacity > 0
      ? Math.round((group.totalGuests / occupancyCapacity) * 100)
      : null
  const occupancyBarWidth = occupancyPercent == null ? 0 : Math.min(100, Math.max(0, occupancyPercent))
  const occupancyTone =
    occupancyPercent == null
      ? 'bg-slate-300'
      : occupancyPercent > 110
        ? 'bg-red-600'
        : occupancyPercent >= 80
          ? 'bg-amber-500'
          : 'bg-primary-900'
  const visibleHourGroups = group.hourGroups
    .map((hourGroup) => ({ hourGroup, visibleBookings: filterByTurn(hourGroup.bookings) }))
    .filter(({ visibleBookings }) => visibleBookings.length > 0)

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-(--color-border) bg-white shadow-sm transition-shadow hover:shadow-md',
        group.isOutOfSlot && 'border-amber-300 bg-amber-50/30',
      )}
      data-expanded={expanded}
    >
      <button
        type="button"
        className="grid w-full grid-cols-1 items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(13rem,1fr)_auto_auto] sm:px-6 sm:py-5"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block truncate text-title-section font-bold leading-tight text-primary-950">
            {group.label}
          </span>
          <span className="mt-1 block text-value leading-tight text-(--color-text-muted)">
            {group.timeRange ?? 'Orari non coperti'}
          </span>
        </span>

        {!group.isOutOfSlot && (
          <span className="min-w-0 border-(--color-border) sm:border-l sm:pl-6">
            <span className="mb-2 block text-label font-semibold leading-tight text-(--color-text-muted)">
              % occupazione
            </span>
            <span className="flex min-w-0 items-center gap-3">
              <span
                className="h-2.5 w-full min-w-32 max-w-64 overflow-hidden rounded-full border border-slate-300 bg-slate-50"
                aria-hidden
              >
                <span
                  className={cn('block h-full rounded-full transition-[width]', occupancyTone)}
                  style={{ width: `${occupancyBarWidth}%` }}
                />
              </span>
              <span className="min-w-10 text-right text-title-subtitle font-semibold tabular-nums text-primary-950">
                {occupancyPercent == null ? '-' : `${occupancyPercent}%`}
              </span>
            </span>
          </span>
        )}

        <span
          className={cn(
            'grid min-w-0 grid-cols-2 gap-0 overflow-hidden rounded-lg border border-(--color-border) bg-white/70 sm:flex sm:rounded-none sm:border-0 sm:bg-transparent',
            isPro ? 'max-sm:grid-cols-3' : 'max-sm:grid-cols-2',
          )}
        >
          <GroupMetric label="Coperti" value={group.totalGuests} max={occupancyCapacity} />
          <GroupMetric label="Prenotazioni" value={group.totalBookings} />
          {isPro && <GroupMetric label="Da assegnare" value={group.pendingAssignments} />}
        </span>

        <span className="flex justify-end sm:justify-center" aria-hidden>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-primary-900 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </span>
      </button>

      {expanded && (
        <div id={contentId} className="border-t border-(--color-border)">
          {group.isOutOfSlot && (
            <p className="px-4 pt-4 text-body italic text-amber-700">
              Prenotazioni non coperte dalle fasce orarie configurate.
            </p>
          )}
          {group.totalBookings === 0 ? (
            <p className="py-7 text-center text-value italic text-(--color-text-muted)">
              Nessuna prenotazione
            </p>
          ) : (
            <div className="space-y-4 p-4 md:p-5">
              {visibleHourGroups.map(({ hourGroup, visibleBookings }, index) => (
                <DayHourGroup
                  key={hourGroup.hourLabel}
                  hourLabel={hourGroup.hourLabel}
                  withDivider={index > 0}
                >
                  {visibleBookings.map((booking) => (
                    <BookingDigestCard
                      key={booking.id}
                      booking={booking}
                      onOpen={onOpenBooking}
                      showMenuPricing={digestBookingHasMenuContext(booking)}
                      unassigned={isPro && !assignedBookingIds.has(booking.id)}
                      assigned={isPro && assignedBookingIds.has(booking.id)}
                      hasTurns={isPro}
                      bookingModes={bookingModes}
                      customStaffPresets={customStaffPresets}
                      onDotClick={onDotClick}
                    />
                  ))}
                </DayHourGroup>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function GroupMetric({ label, value, max }: { label: string; value: number; max?: number | null }) {
  const showMax = max != null && max > 0
  return (
    <span className="flex min-w-[5.75rem] flex-col items-center justify-center border-(--color-border) px-3 py-2 text-center first:border-l-0 sm:border-l sm:py-0">
      <span className="text-label leading-tight text-(--color-text-muted)">{label}</span>
      <span className="mt-1 text-title-subtitle font-semibold leading-none text-primary-950 tabular-nums">
        {showMax ? (
          <>
            <span className="text-base">{value}</span>
            {' / '}
            {max}
          </>
        ) : (
          value
        )}
      </span>
    </span>
  )
}
