import React from 'react'
import type { BookingRequest, BookingType } from '@/types/booking'
import { DEFAULT_BOOKING_FORM_CONFIG } from '../constants/bookingPublicFormConfig'
import { getModeLabelByType } from '../utils/bookingModeLabels'
import { formatBookingDateTime } from '../utils/formatDateTime'
import { MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { TimePicker24h } from '@/components/ui'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import {
  resolveMenuPromoLabelsForBooking,
} from '@/features/booking/constants/menuPromo'
import { BOOKING_PUBLIC_CLIENT_TEXT_LIMITS } from '@/features/booking/constants/bookingPrenotaTextLimits'
import { Tag } from 'lucide-react'
import { useFeatures } from '@/hooks/useFeatures'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'

interface Props {
  booking: BookingRequest
  isEditMode: boolean
  formData: {
    booking_type: BookingType
    client_name: string
    client_email: string
    client_phone: string
    date: string
    startTime: string
    endTime: string
    numGuests: number
    specialRequests: string
    placement?: string | null
  }
  onFormDataChange: (field: string, value: any) => void
  onBookingTypeChange: (newType: BookingType) => void
}

// Helper to capitalize first letter of date string
const capitalizeFirst = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const FROSTED_CONTROL_SURFACE: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.85)',
  backdropFilter: 'blur(1px)',
  padding: '10px 16px',
  borderRadius: '12px',
  fontWeight: 500,
}

const FROSTED_TEXT_INPUT_CLASS_NAME =
  'block w-full border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 transition-colors duration-150 !border-black/20 text-center !text-[18px] sm:!text-[16px] !font-medium text-warm-wood placeholder:text-warm-wood/50 rounded-[12px] focus:!border-warm-wood focus:!ring-2 focus:!ring-warm-wood/40'

// Label colonna fissa | valore (allineati come tabella; niente wrap dell'etichetta sotto al valore)
const InfoRow: React.FC<{
  label: string
  value: string | React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}> = ({ label, value, icon: Icon }) => (
  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 text-sm leading-snug md:text-base">
    <span className="inline-flex shrink-0 items-start gap-2 pt-0.5 font-semibold text-gray-700">
      {Icon ? <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" /> : null}
      <span className="whitespace-nowrap">{label}:</span>
    </span>
    <span className="min-w-0 break-words text-gray-900">{value}</span>
  </div>
)

export const DetailsTab: React.FC<Props> = ({
  booking,
  isEditMode,
  formData,
  onFormDataChange,
  onBookingTypeChange
}) => {
  const features = useFeatures()
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const modes = bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes
  const { data: menuPromos = [] } = useRestaurantSetting('booking_menu_promos')
  const menuPromoLabels = resolveMenuPromoLabelsForBooking(booking, menuPromos)
  const { data: placementAreasSetting = [] } = useRestaurantSetting('booking_placement_areas', { authenticated: true })
  const normalizedPlacementAreas = Array.isArray(placementAreasSetting)
    ? placementAreasSetting
        .map((item) => String(item ?? '').trim())
        .filter((item) => item.length > 0)
    : []
  const currentPlacement =
    features.servizio &&
    formData.placement &&
    !normalizedPlacementAreas.includes(formData.placement)
      ? formData.placement
      : null

  // Format date with capitalized first letter
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const formatted = date.toLocaleDateString('it-IT', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      return capitalizeFirst(formatted)
    } catch {
      return dateString
    }
  }

  const creationDateLabel = formatBookingDateTime(booking.created_at)

  return (
    <div className="grid grid-cols-1 gap-6 text-sm leading-relaxed md:grid-cols-2 md:gap-8 md:items-start md:text-base">
      <div className="flex min-w-0 flex-col gap-6">
      {/* Section 1: Booking Type */}
      <div className="space-y-3">
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Tipo Prenotazione
        </h3>
        {isEditMode ? (
          <div className="w-full max-w-[55vw] mx-auto">
            <select
              value={formData.booking_type}
              onChange={(e) => onBookingTypeChange(e.target.value as BookingType)}
              className={FROSTED_TEXT_INPUT_CLASS_NAME}
              style={FROSTED_CONTROL_SURFACE}
            >
              {modes
                .filter((m) => m.enabled || m.booking_type === formData.booking_type)
                .map((m) => (
                  <option key={m.booking_type} value={m.booking_type}>
                    {getModeLabelByType(modes, m.booking_type)}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <p className="font-medium text-gray-900 md:text-lg">
            {getModeLabelByType(modes, formData.booking_type)}
          </p>
        )}
        {/* FU-001: promo viste dal cliente come chip distinti (non stringa unica). */}
        {!isEditMode && menuPromoLabels.length > 0 && (
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 md:text-base">
              <Tag className="h-4 w-4 shrink-0 text-primary-500" aria-hidden />
              Promo visualizzate dal cliente
            </span>
            <div className="flex flex-wrap gap-1.5">
              {menuPromoLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex max-w-full items-center break-words rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium leading-snug text-primary-700 ring-1 ring-inset ring-primary-100 md:text-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Client Information */}
      <div className="space-y-3">
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Informazioni Cliente
        </h3>
        {isEditMode ? (
          <div className="space-y-4 w-full max-w-[55vw] mx-auto">
            {/* Edit mode - vertical layout for usability */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 md:text-base">Nome</label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => onFormDataChange('client_name', e.target.value)}
                className={FROSTED_TEXT_INPUT_CLASS_NAME}
                style={FROSTED_CONTROL_SURFACE}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 md:text-base">
                Email <span className="text-xs font-normal text-gray-500 md:text-sm">(opzionale)</span>
              </label>
              <input
                type="email"
                value={formData.client_email}
                onChange={(e) => onFormDataChange('client_email', e.target.value)}
                className={FROSTED_TEXT_INPUT_CLASS_NAME}
                style={FROSTED_CONTROL_SURFACE}
                placeholder="opzionale"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 md:text-base">Telefono</label>
              <input
                type="tel"
                value={formData.client_phone}
                onChange={(e) => onFormDataChange('client_phone', e.target.value)}
                className={FROSTED_TEXT_INPUT_CLASS_NAME}
                style={FROSTED_CONTROL_SURFACE}
                placeholder="Opzionale"
              />
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3">
            {/* Una colonna: Nome → Email → Telefono impilati (Email non più in “seconda colonna” del sotto-griglia) */}
            <InfoRow label="Nome" value={formData.client_name} />
            <InfoRow label="Email" value={formData.client_email ?? ''} />
            <InfoRow label="Telefono" value={formData.client_phone ?? ''} />
          </div>
        )}
      </div>

      {/* Section 4: Data Creazione */}
      <div className="space-y-3">
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Data Creazione
        </h3>
        <p className="font-medium text-gray-900 md:text-lg">{creationDateLabel}</p>
      </div>

      {/* Section 5: Special Notes (tavolo only) */}
      {formData.booking_type === 'tavolo' && (
        <div className="space-y-3">
          <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
            Note Speciali
          </h3>
          {isEditMode ? (
            <textarea
              value={formData.specialRequests}
              onChange={(e) => onFormDataChange('specialRequests', e.target.value)}
              rows={4}
              className="w-full resize-vertical rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 md:text-base"
              placeholder="Inserisci eventuali richieste particolari..."
            />
          ) : (
            <p className="whitespace-pre-wrap text-gray-900 md:text-lg">
              {formData.specialRequests || 'Nessuna nota aggiunta'}
            </p>
          )}
        </div>
      )}

      {/* Intolleranze alimentari — solo tavolo (tipologie con menu: tab Intolleranze e Note) */}
      {!bookingTypeUsesMenuSelections(formData.booking_type) &&
        (booking.dietary_data_consent === true || booking.dietary_off_platform_notice === true) && (
        <div className="space-y-2">
          <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
            Intolleranze Alimentari
          </h3>
          {booking.dietary_data_consent === true ? (
            <p className="text-sm text-gray-700 md:text-base">
              <span className="mr-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">Consenso esplicito</span>
              {Array.isArray(booking.dietary_restrictions) && booking.dietary_restrictions.length > 0
                ? booking.dietary_restrictions
                    .map((r: any) =>
                      r.restriction === 'Altro' && r.notes ? r.notes : r.restriction,
                    )
                    .join(', ')
                : 'Dati comunicati con consenso esplicito'}
            </p>
          ) : (
            <p className="text-sm text-amber-700 md:text-base">
              Il cliente comunicherà esigenze direttamente al ristorante.
            </p>
          )}
        </div>
      )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
      {/* Section 3: Event Details */}
      <div className="space-y-3">
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Dettagli Evento
        </h3>
        {isEditMode ? (
          <div className="space-y-4 w-full max-w-[55vw] mx-auto">
            {/* Edit mode - vertical layout */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 md:text-base">Data</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => onFormDataChange('date', e.target.value)}
                className={FROSTED_TEXT_INPUT_CLASS_NAME}
                style={FROSTED_CONTROL_SURFACE}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 md:text-base">Ora Inizio</label>
                <TimePicker24h
                  id="detail_start_time"
                  value={formData.startTime}
                  onChange={(v) => onFormDataChange('startTime', v)}
                  className="rounded-[12px] border-black/20 bg-white/85 text-warm-wood focus-within:!border-warm-wood focus-within:!ring-2 focus-within:!ring-warm-wood/40"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 md:text-base">Ora Fine</label>
                <TimePicker24h
                  id="detail_end_time"
                  value={formData.endTime}
                  onChange={(v) => onFormDataChange('endTime', v)}
                  className="rounded-[12px] border-black/20 bg-white/85 text-warm-wood focus-within:!border-warm-wood focus-within:!ring-2 focus-within:!ring-warm-wood/40"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 md:text-base">Numero Ospiti</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={formData.numGuests > 0 ? formData.numGuests.toString() : ''}
                onChange={(e) => {
                  // L12: cap a video — clamp al massimo ospiti consentito.
                  const raw = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                  const value = Math.min(raw, BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.numGuestsMax)
                  onFormDataChange('numGuests', value)
                }}
                className={FROSTED_TEXT_INPUT_CLASS_NAME}
                style={FROSTED_CONTROL_SURFACE}
                required
              />
            </div>

            {features.servizio && (
              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700 md:text-base">
                  <MapPin className="h-5 w-5 shrink-0" />
                  Posizionamento
                </label>
                <Select
                  value={formData.placement || 'none'}
                  onValueChange={(value) => onFormDataChange('placement', value === 'none' ? null : value)}
                >
                  <SelectTrigger className={FROSTED_TEXT_INPUT_CLASS_NAME} style={FROSTED_CONTROL_SURFACE}>
                    <SelectValue placeholder="Seleziona sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna preferenza</SelectItem>
                    {currentPlacement && (
                      <SelectItem value={currentPlacement}>{currentPlacement}</SelectItem>
                    )}
                    {normalizedPlacementAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 min-w-0">
            {/* View mode - grid layout without box */}
            <InfoRow label="Data" value={formatDate(formData.date)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
              <InfoRow label="Ora Inizio" value={formData.startTime} />
              <InfoRow label="Ora Fine" value={formData.endTime} />
            </div>
            <InfoRow
              label="Numero Ospiti"
              value={`${formData.numGuests} ${formData.numGuests === 1 ? 'ospite' : 'ospiti'}`}
            />
            {features.servizio && (
              <InfoRow
                label="Posizionamento"
                value={booking.placement || 'Non specificato'}
              />
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
