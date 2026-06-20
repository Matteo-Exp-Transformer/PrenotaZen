import React from 'react'
import { Users, Clock, Euro } from 'lucide-react'
import type { BookingRequest } from '@/types/booking'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'
import { getAccurateStartTime } from '../../utils/dateUtils'
import { getResolvedMenuPriceDisplay } from '../../utils/menuPricing'
import { resolveSubTabFromBooking } from '../../utils/buildBookingEmailSummary'
import { getModeLabelByType } from '../../utils/bookingModeLabels'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

function formatPriceShort(amount: number): string {
  const [intPart, decPart] = Math.abs(amount).toFixed(2).split('.')
  const sign = amount < 0 ? '-' : ''
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  return decPart === '00' ? `${sign}${intWithSep}€` : `${sign}${intWithSep}.${decPart}€`
}

interface BookingDigestCardProps {
  booking: BookingRequest
  onOpen: (b: BookingRequest) => void
  showMenuPricing?: boolean
  /** Accettato per compatibilità con i call-site esistenti; ignorato nel layout carta. */
  compactGrid?: boolean
  /** Pro: prenotazione accettata senza tavolo assegnato. */
  unassigned?: boolean
  /** Pro: prenotazione con tavolo già assegnato. */
  assigned?: boolean
  /** Pro: mostrare lo stato tavolo. */
  hasTurns?: boolean
  bookingModes?: BookingMode[]
  customStaffPresets?: CustomStaffPreset[]
  /** Pro: click sullo stato tavolo → apre modal assegnazione rapida. */
  onDotClick?: (booking: BookingRequest, e: React.MouseEvent) => void
}

type DigestBadge = {
  key: string
  label: string
  variant: React.ComponentProps<typeof Badge>['variant']
}

function cleanBadgeLabel(value: string | null | undefined): string | null {
  const label = value?.trim()
  return label ? label : null
}

function addUniqueBadge(
  badges: DigestBadge[],
  seen: Set<string>,
  badge: DigestBadge,
): void {
  const normalized = badge.label.trim().toLocaleLowerCase('it-IT')
  if (!normalized || seen.has(normalized)) return
  seen.add(normalized)
  badges.push(badge)
}

function buildDigestBadges({
  booking,
  bookingModes = [],
  customStaffPresets = [],
}: {
  booking: BookingRequest
  bookingModes?: BookingMode[]
  customStaffPresets?: CustomStaffPreset[]
}): DigestBadge[] {
  const badges: DigestBadge[] = []
  const seen = new Set<string>()

  const mode = bookingModes.find((m) => m.booking_type === booking.booking_type && m.enabled)
  if (mode?.booking_badge_enabled !== false) {
    const modeLabel =
      cleanBadgeLabel(mode?.booking_badge_label) ||
      cleanBadgeLabel(mode?.label) ||
      cleanBadgeLabel(getModeLabelByType(bookingModes, booking.booking_type))
    if (modeLabel) {
      addUniqueBadge(badges, seen, {
        key: 'booking-type',
        label: modeLabel,
        variant: 'default',
      })
    }
  }

  const subTab = resolveSubTabFromBooking(booking, mode, customStaffPresets)
  if (subTab?.display === 'cards' && subTab.booking_badge_enabled !== false) {
    const subTabLabel =
      cleanBadgeLabel(subTab.booking_badge_label) || cleanBadgeLabel(subTab.label)
    if (subTabLabel) {
      addUniqueBadge(badges, seen, {
        key: 'sub-tab',
        label: subTabLabel,
        variant: 'outline',
      })
    }
  }

  return badges.slice(0, 3)
}

export function BookingDigestCard({
  booking,
  onOpen,
  showMenuPricing = false,
  compactGrid: _compactGrid,
  unassigned = false,
  hasTurns = false,
  bookingModes = [],
  customStaffPresets = [],
  onDotClick,
}: BookingDigestCardProps) {
  const menuPriceRow = showMenuPricing ? getResolvedMenuPriceDisplay(booking) : null
  const bookingTimeLabel =
    booking.desired_time || booking.confirmed_start ? getAccurateStartTime(booking) : null
  const badges = buildDigestBadges({ booking, bookingModes, customStaffPresets })
  const noBadges = badges.length === 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(booking)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(booking)
        }
      }}
      className={cn(
        'is-clickable relative w-full min-w-0 rounded-lg border text-left',
        'bg-surface border-(--color-border) shadow-sm',
        'transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
      )}
    >
      {/* DA ASSEGNARE — agganciato fuori bordo, top-right (PRO) */}
      {hasTurns && unassigned && (
        <span
          role="button"
          tabIndex={0}
          className="is-clickable absolute right-3 top-0 z-10 inline-flex -translate-y-full"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onDotClick?.(booking, e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              e.preventDefault()
              onDotClick?.(booking, e as unknown as React.MouseEvent)
            }
          }}
          aria-label="Assegna tavolo"
        >
          <Badge
            variant="warning"
            className="whitespace-nowrap rounded-b-none border-(--color-border)! bg-surface! text-[0.6875rem]! font-semibold shadow-sm"
          >
            DA ASSEGNARE
          </Badge>
        </span>
      )}

      <div className="px-4 py-4 md:px-5">
        {/* Contenuto auto-centrato: prende la larghezza naturale e si centra solo quando
            avanza spazio nella card; su card strette riempie e resta allineato a sinistra. */}
        <div className="mx-auto flex w-fit max-w-full flex-col gap-2.5 text-center">
          {/* Nome cliente */}
          <div
            className={cn(
              'min-w-0 max-w-full truncate font-semibold leading-snug text-primary-900',
              noBadges ? 'text-[1.0625rem] sm:text-lg' : 'text-base sm:text-[1.0625rem]',
            )}
          >
            {booking.client_name}
          </div>

          {/* Colonne statistiche: Ospiti · Orario · Prezzo/pers */}
          <div className="flex items-start justify-center gap-5">
            {/* Ospiti */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                <span className="text-xs text-(--color-text-muted)">Ospiti</span>
              </div>
              <span
                className={cn(
                  'font-semibold tabular-nums text-primary-900',
                  noBadges ? 'text-[1.0625rem] sm:text-lg' : 'text-base',
                )}
              >
                {booking.num_guests}
              </span>
            </div>

            {/* Orario */}
            {bookingTimeLabel && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                  <span className="text-xs text-(--color-text-muted)">Orario</span>
                </div>
                <span
                  className={cn(
                    'font-semibold tabular-nums text-primary-900',
                    noBadges ? 'text-[1.0625rem] sm:text-lg' : 'text-base',
                  )}
                >
                  {bookingTimeLabel}
                </span>
              </div>
            )}

            {/* Prezzo/pers (solo quando menuPriceRow è valorizzato) */}
            {menuPriceRow && (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                  <span className="text-xs text-(--color-text-muted)">Prezzo/pers</span>
                </div>
                <span
                  className={cn(
                    'font-semibold tabular-nums text-primary-900',
                    noBadges ? 'text-[1.0625rem] sm:text-lg' : 'text-base',
                  )}
                >
                  {formatPriceShort(menuPriceRow.prezzoMenu)}
                </span>
              </div>
            )}
          </div>

          {/* Badge tipologia prenotazione + card scorrevole (sotto i dati prenotazione) */}
          {badges.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              {badges.map((badge) => (
                <Badge
                  key={badge.key}
                  variant={badge.variant}
                  className="max-w-40 truncate text-label! font-normal"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
