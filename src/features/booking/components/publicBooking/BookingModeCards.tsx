import React from 'react'
import { cn } from '@/lib/utils'
import type { BookingMode } from '@/features/booking/constants/bookingPublicFormConfig'
import type { BookingType } from '@/types/booking'
import {
  BOOKING_PUBLIC_WIDE_CARDS_WIDTH,
  bookingPublicRowCardWidthClass,
} from '@/features/booking/constants/bookingPublicFieldStyles'
import { MenuQrCategoryIconGlyph } from '@/features/public-menu/MenuQrCategoryIconGlyph'

interface BookingModeCardsProps {
  modes: BookingMode[]
  activeModeId: string
  onChange: (modeId: string, bookingType: BookingType) => void
  /** Cap 1168px full-page: card a larghezza fissa in riga, senza lg:px-16 / icona assoluta. */
  fullPageFormCapLayout?: boolean
}

export const BookingModeCards: React.FC<BookingModeCardsProps> = ({
  modes,
  activeModeId,
  onChange,
  fullPageFormCapLayout = false,
}) => {
  const enabledModes = modes.filter((m) => m.enabled)
  if (enabledModes.length === 0) return null

  const isSingleMode = enabledModes.length === 1
  const useFixedRowWidths =
    fullPageFormCapLayout && enabledModes.length >= 2 && enabledModes.length <= 4
  const rowCardWidthClass = useFixedRowWidths
    ? bookingPublicRowCardWidthClass(enabledModes.length)
    : 'flex-1 min-w-0'

  return (
    <div className={cn('w-full space-y-2', BOOKING_PUBLIC_WIDE_CARDS_WIDTH)} data-testid="booking-mode-cards">
      <div
        className={cn(
          'flex w-full gap-1.5 sm:gap-2',
          isSingleMode ? 'flex-col' : 'flex-row',
        )}
      >
        {enabledModes.map((mode) => {
          const isActive = mode.id === activeModeId

          const cardClasses = cn(
            'relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-3 text-center transition-all duration-200',
            rowCardWidthClass,
            'min-h-[120px] sm:min-h-[110px] sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-4',
            !fullPageFormCapLayout && 'lg:px-16',
            'bg-white/85 backdrop-blur-[1px] shadow-sm',
            isSingleMode
              ? 'border-black/15'
              : isActive
                ? 'border-warm-orange ring-2 ring-warm-orange/30 shadow-md'
                : 'border-black/15 hover:border-warm-orange/50 hover:shadow-md',
          )

          const cardContent = (
            <>
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center transition-colors sm:h-10 sm:w-10',
                  !fullPageFormCapLayout &&
                    'lg:absolute lg:left-4 lg:top-1/2 lg:-translate-y-1/2',
                  !isSingleMode && isActive ? 'text-warm-orange' : 'text-warm-wood/80',
                )}
              >
                <MenuQrCategoryIconGlyph iconKey={mode.icon} className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 w-full text-center">
                <p
                  className={cn(
                    'text-[16px] font-bold leading-tight sm:text-[19px] lg:text-[17px] xl:text-[19px]',
                    !isSingleMode && isActive ? 'text-warm-orange' : 'text-warm-wood',
                  )}
                >
                  {mode.label}
                </p>
                {mode.description && (
                  <p className="mt-0.5 hidden text-sm leading-snug text-warm-wood-dark/70 line-clamp-3 min-[700px]:block sm:line-clamp-2">
                    {mode.description}
                  </p>
                )}
              </div>
            </>
          )

          if (isSingleMode) {
            return (
              <div key={mode.id} data-testid={`booking-mode-card-${mode.id}`} className={cardClasses}>
                {cardContent}
              </div>
            )
          }

          return (
            <button
              key={mode.id}
              type="button"
              data-testid={`booking-mode-card-${mode.id}`}
              onClick={() => onChange(mode.id, mode.booking_type)}
              className={cardClasses}
            >
              {cardContent}
            </button>
          )
        })}
      </div>
    </div>
  )
}
