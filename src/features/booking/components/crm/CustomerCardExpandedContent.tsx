import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Textarea } from '@/components/ui'
import type { CustomerProfile } from '@/types/customer'
import type { BookingRequest } from '@/types/booking'
import { useUpdateCustomer } from '@/features/booking/hooks/useCustomerMutations'
import { DiscardChangesConfirmModal } from '@/features/booking/components/settings/SettingsSaveUi'
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/features/booking/constants/bookingPublicFormConfig'
import type { CustomStaffPreset } from '@/features/booking/constants/presetMenus'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import {
  buildCustomerBookingHistoryRow,
  DIETARY_NO_CONSENT_MESSAGE,
  sortBookingsByCreatedAtDesc,
} from '@/features/booking/utils/customerBookingHistoryDisplay'

interface CustomerCardExpandedContentProps {
  profile: CustomerProfile
  onRequestCollapse: () => void
}

const DietaryCell: FC<{
  hasDietary: boolean
  dietaryConsent: boolean
  dietaryText: string
}> = ({ hasDietary, dietaryConsent, dietaryText }) => {
  const [revealed, setRevealed] = useState(false)

  if (!hasDietary) {
    return <span className="text-(--color-text-muted)">No</span>
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className="font-medium text-primary-700 underline-offset-2 hover:underline"
        onClick={(e) => {
          e.stopPropagation()
          setRevealed((v) => !v)
        }}
      >
        Sì
      </button>
      {revealed && (
        <span className="max-w-full text-xs text-(--color-text)">
          {dietaryConsent ? dietaryText : DIETARY_NO_CONSENT_MESSAGE}
        </span>
      )}
    </span>
  )
}

const BookingHistoryRow: FC<{
  booking: BookingRequest
  modes: typeof DEFAULT_BOOKING_FORM_CONFIG.booking_modes
  customStaffPresets: CustomStaffPreset[]
}> = ({ booking, modes, customStaffPresets }) => {
  const row = buildCustomerBookingHistoryRow(booking, modes, customStaffPresets)

  return (
    <li className="rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-(--color-text-muted)">Tipologia: </span>
          <span className="font-medium text-primary-900">{row.bookingTypeLabel}</span>
        </span>
        {row.carouselCardLabel && (
          <span>
            <span className="text-(--color-text-muted)">Offerta: </span>
            <span className="text-(--color-text)">{row.carouselCardLabel}</span>
          </span>
        )}
        <span>
          <span className="text-(--color-text-muted)">Ospiti: </span>
          <span className="text-(--color-text)">{row.numGuests}</span>
        </span>
        <span>
          <span className="text-(--color-text-muted)">Prenotato il: </span>
          <span className="text-(--color-text)">{row.createdAtLabel}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <span className="text-(--color-text-muted)">Per il giorno: </span>
          <span className="text-(--color-text)">{row.desiredDateLabel}</span>
        </span>
        {row.amountLabel && (
          <span>
            <span className="text-(--color-text-muted)">Importo: </span>
            <span className="text-(--color-text)">{row.amountLabel}</span>
          </span>
        )}
        <span className="inline-flex items-baseline gap-1">
          <span className="text-(--color-text-muted)">Intolleranze: </span>
          <DietaryCell
            hasDietary={row.hasDietary}
            dietaryConsent={row.dietaryConsent}
            dietaryText={row.dietaryText}
          />
        </span>
      </div>
    </li>
  )
}

export const CustomerCardExpandedContent: FC<CustomerCardExpandedContentProps> = ({
  profile,
  onRequestCollapse,
}) => {
  const updateCustomer = useUpdateCustomer()
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const { data: customStaffPresets = [] } = useRestaurantSetting('booking_custom_staff_presets')

  const bookingModes =
    bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes

  const [notesDraft, setNotesDraft] = useState('')
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)

  useEffect(() => {
    setNotesDraft(profile.notes ?? '')
  }, [profile])

  const notesDirty = useMemo(
    () => notesDraft.trim() !== (profile.notes ?? '').trim(),
    [notesDraft, profile.notes],
  )

  const requestCollapse = useCallback(() => {
    if (notesDirty) {
      setDiscardConfirmOpen(true)
      return
    }
    onRequestCollapse()
  }, [notesDirty, onRequestCollapse])

  const confirmDiscardCollapse = useCallback(() => {
    setDiscardConfirmOpen(false)
    setNotesDraft(profile.notes ?? '')
    onRequestCollapse()
  }, [onRequestCollapse, profile.notes])

  const sortedBookings = useMemo(
    () => sortBookingsByCreatedAtDesc(profile.bookings),
    [profile.bookings],
  )

  const saveNotes = () => {
    updateCustomer.mutate({
      customerRowId: profile.manual_id ?? null,
      previousEmail: profile.email,
      previousName: profile.name,
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? null,
      notes: notesDraft.trim() || null,
    })
  }

  return (
    <>
      <div
        className="border-t border-(--color-border) bg-(--color-bg)/60 px-4 py-4 sm:px-5"
        onClick={(e) => e.stopPropagation()}
      >
        <section className="mb-5">
          <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">
            Storico prenotazioni
          </h3>
          {sortedBookings.length === 0 ? (
            <p className="text-sm text-(--color-text-muted)">Nessuna prenotazione.</p>
          ) : (
            <ul className="max-h-[min(420px,50vh)] space-y-2 overflow-y-auto pr-1">
              {sortedBookings.map((b) => (
                <BookingHistoryRow
                  key={b.id}
                  booking={b}
                  modes={bookingModes}
                  customStaffPresets={customStaffPresets as CustomStaffPreset[]}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-title-subtitle font-semibold text-primary-900">Note interne</h3>
          <Textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            placeholder="Note interne…"
            className="w-full"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={updateCustomer.isPending || !notesDirty}
              onClick={saveNotes}
            >
              Salva note
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={requestCollapse}>
              Chiudi dettaglio
            </Button>
          </div>
        </section>
      </div>

      <DiscardChangesConfirmModal
        isOpen={discardConfirmOpen}
        onStay={() => setDiscardConfirmOpen(false)}
        onDiscard={confirmDiscardCollapse}
        message="Hai note non salvate. Chiudendo perderai le modifiche."
      />
    </>
  )
}
