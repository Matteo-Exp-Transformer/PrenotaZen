import React from 'react'
import { Input } from '@/components/ui'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingPublicInsetField } from './publicBooking/BookingPublicInsetField'
import {
  BOOKING_PUBLIC_CLIENT_TEXT_LIMITS,
} from '../constants/bookingPrenotaTextLimits'

import {
  BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
  BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
  shouldDismissBookingPublicAttention,
} from '../utils/bookingPublicFormAttention'
import {
  buildPrenotaReturnPath,
  buildPrivacyPolicyLink,
} from '../utils/privacyPolicyNavigation'

const C = BOOKING_PUBLIC_CLIENT_TEXT_LIMITS

interface DietaryRestrictionsSectionProps {
  dietaryText: string
  onDietaryTextChange: (value: string) => void
  specialRequests: string
  onSpecialRequestsChange: (value: string) => void
  privacyAccepted?: boolean
  onPrivacyChange?: (value: boolean) => void
  privacyError?: string
  /** Lampeggio attenzione sul checkbox privacy. */
  showPrivacyAttention?: boolean
  onPrivacyAttentionInteract?: () => void
  /** Nasconde il blocco "Altre Richieste" (es. renderizzato sotto la griglia in AdminBookingForm) */
  omitSpecialRequestsSection?: boolean
  /** Layout /prenota: campi al 75% larghezza, stessa altezza e font delle card sottotab */
  publicFormFields?: boolean
  /** Testo privacy/obbligatori in bianco solo su sfondo full-page foto. */
  lightTextOnDarkBackground?: boolean
  /** Slug tenant: il link Privacy include ?from=/prenota/:slug per il ritorno. */
  tenantSlug?: string
}

const FIELD_LABEL_CLASS =
  'block text-left text-sm font-bold text-warm-wood md:text-base mb-1'

const CONTROL_CLASS =
  'w-full min-h-[50px] h-[50px] rounded-lg border border-slate-200 bg-white px-4 text-sm sm:text-base font-medium text-warm-wood focus:border-warm-wood focus:outline-none focus:ring-2 focus:ring-warm-wood/40'

/** Form pubblico Prenota: intolleranze come testo libero + altre richieste + privacy. */
export const DietaryRestrictionsSection: React.FC<DietaryRestrictionsSectionProps> = ({
  dietaryText,
  onDietaryTextChange,
  specialRequests,
  onSpecialRequestsChange,
  privacyAccepted,
  onPrivacyChange,
  privacyError,
  showPrivacyAttention = false,
  onPrivacyAttentionInteract,
  omitSpecialRequestsSection = false,
  publicFormFields = false,
  lightTextOnDarkBackground = false,
  tenantSlug,
}) => {
  const privacyReturnPath = buildPrenotaReturnPath(tenantSlug)
  const privacyPolicyTo = buildPrivacyPolicyLink(privacyReturnPath)

  return (
    <div className={publicFormFields ? 'w-full space-y-5' : 'space-y-5'}>
      <div className="space-y-1">
        {publicFormFields ? (
          <BookingPublicInsetField
            id="dietary-notes"
            label="Intolleranze o esigenze alimentari"
            multiline
            value={dietaryText}
            maxLength={C.dietaryText}
            autoComplete="off"
            onChange={(e) => onDietaryTextChange(e.target.value.slice(0, C.dietaryText))}
          />
        ) : (
          <>
            <label htmlFor="dietary-notes" className={FIELD_LABEL_CLASS}>
              Intolleranze o esigenze alimentari
            </label>
            <Input
              id="dietary-notes"
              value={dietaryText}
              maxLength={C.dietaryText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDietaryTextChange(e.target.value.slice(0, C.dietaryText))}
              className={CONTROL_CLASS}
            />
          </>
        )}
      </div>

      {!omitSpecialRequestsSection && (
        <div className="space-y-1">
          {publicFormFields ? (
            <BookingPublicInsetField
              id="special_requests"
              label="Altre Richieste"
              multiline
              value={specialRequests}
              maxLength={C.specialRequests}
              autoComplete="off"
              onChange={(e) => onSpecialRequestsChange(e.target.value.slice(0, C.specialRequests))}
            />
          ) : (
            <>
              <label htmlFor="special_requests" className={FIELD_LABEL_CLASS}>
                Altre Richieste
              </label>
              <Input
                id="special_requests"
                value={specialRequests}
                maxLength={C.specialRequests}
                onChange={(e) => onSpecialRequestsChange(e.target.value.slice(0, C.specialRequests))}
                className={CONTROL_CLASS}
              />
            </>
          )}
        </div>
      )}

      {privacyAccepted !== undefined && onPrivacyChange && (
        <div
          id="privacy-consent-dietary"
          className={cn('space-y-2 pt-1', BOOKING_PUBLIC_FIELD_SCROLL_MARGIN, showPrivacyAttention && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS, 'rounded-lg')}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="group relative size-5 shrink-0">
                <input
                  type="checkbox"
                  id="privacy-consent-dietary-input"
                  checked={privacyAccepted}
                  onChange={(e) => onPrivacyChange(e.target.checked)}
                  onFocus={(event) => {
                    if (showPrivacyAttention && shouldDismissBookingPublicAttention(event)) {
                      onPrivacyAttentionInteract?.()
                    }
                  }}
                  onPointerDown={(event) => {
                    if (showPrivacyAttention && shouldDismissBookingPublicAttention(event)) {
                      onPrivacyAttentionInteract?.()
                    }
                  }}
                  required
                  className="peer absolute inset-0 z-10 size-5 cursor-pointer appearance-none opacity-0 focus:outline-none"
                />
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 bg-white shadow-sm transition-all duration-300 group-hover:shadow-md peer-checked:border-warm-orange peer-checked:bg-warm-orange peer-checked:shadow-lg peer-focus-visible:ring-4 peer-focus-visible:ring-warm-wood/20 ${
                    privacyError || showPrivacyAttention
                      ? 'border-red-500 group-hover:border-red-600'
                      : 'border-warm-wood/40 group-hover:border-warm-wood'
                  }`}
                >
                  <Check
                    className={`h-3.5 w-3.5 text-white transition-all duration-300 ${
                      privacyAccepted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                    }`}
                    strokeWidth={3}
                  />
                </div>
              </div>
              <label
                htmlFor="privacy-consent-dietary-input"
                className={cn(
                  'cursor-pointer text-base',
                  lightTextOnDarkBackground ? 'font-medium text-white' : 'text-warm-wood-dark',
                )}
              >
                Accetto la{' '}
                <Link
                  to={privacyPolicyTo}
                  state={privacyReturnPath ? { from: privacyReturnPath } : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'font-semibold underline underline-offset-2',
                    lightTextOnDarkBackground
                      ? 'text-white decoration-white hover:text-white/90'
                      : 'text-warm-orange decoration-warm-orange hover:text-warm-orange',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                {' '}*
              </label>
            </div>
            <p
              className={cn(
                'text-sm font-semibold sm:text-base',
                lightTextOnDarkBackground ? 'text-white' : 'text-warm-wood-dark/80',
              )}
            >
              * I campi contrassegnati sono obbligatori
            </p>
          </div>
          {privacyError && (
            <p
              className={cn(
                'ml-8 text-sm font-semibold',
                lightTextOnDarkBackground ? 'text-white' : 'text-red-500',
              )}
            >
              {privacyError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
