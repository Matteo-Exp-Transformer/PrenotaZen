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
  resolveMenuPromoMessageForBookingView,
} from '@/features/booking/constants/menuPromo'
import { BOOKING_PUBLIC_CLIENT_TEXT_LIMITS } from '@/features/booking/constants/bookingPrenotaTextLimits'
import { useFeatures } from '@/hooks/useFeatures'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import { resolveSubTabFromBooking } from '../utils/buildBookingEmailSummary'

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
    adminNotes: string
  }
  onFormDataChange: (field: string, value: any) => void
  onBookingTypeChange: (newType: BookingType) => void
}

const capitalizeFirst = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const ADMIN_INPUT_CLASS =
  'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[17px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 transition-colors duration-150'

const SECTION_CARD = 'rounded-xl border border-slate-200 bg-white p-4 space-y-3'

// Label colonna fissa | valore (allineati come tabella; niente wrap dell'etichetta sotto al valore)
const InfoRow: React.FC<{
  label: string
  value: string | React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}> = ({ label, value, icon: Icon }) => (
  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 text-base leading-snug md:text-lg">
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
  onBookingTypeChange: _onBookingTypeChange
}) => {
  const features = useFeatures()
  const { data: bookingFormConfig } = useRestaurantSetting('booking_public_form_config')
  const modes = bookingFormConfig?.booking_modes ?? DEFAULT_BOOKING_FORM_CONFIG.booking_modes
  const { data: menuPromos = [] } = useRestaurantSetting('booking_menu_promos')
  const { data: customStaffPresets = [] } = useRestaurantSetting('booking_custom_staff_presets')

  // Testo promo dalle impostazioni correnti per la tipologia (non il badge-label dello snapshot).
  // Se l'admin ha modificato la promo dopo la prenotazione, si vede il testo attuale.
  const promoMessage = resolveMenuPromoMessageForBookingView({
    bookingType: booking.booking_type ?? 'tavolo',
    modeId: booking.booking_type ?? 'tavolo',
    subTabId: null,
    promos: menuPromos,
  })

  // Card scorrevole (sotto-tab) scelta dal cliente — euristica da booking salvato.
  const bookingMode = modes.find((m) => m.booking_type === booking.booking_type)
  const resolvedSubTab = resolveSubTabFromBooking(booking, bookingMode, customStaffPresets)
  const subTabLabel =
    resolvedSubTab?.display === 'cards' && resolvedSubTab.booking_badge_enabled !== false
      ? (resolvedSubTab.booking_badge_label?.trim() || resolvedSubTab.label?.trim() || null)
      : null

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
    <div className="flex flex-col gap-4 md:gap-6">
      {/*
        Ordine mobile (grid-cols-1) garantito dall'ORDINE DEL DOM, non solo dalle classi CSS
        `order-*` (su alcuni browser mobile risultavano ignorate): Informazioni Cliente è il
        primo figlio, quindi su mobile appare per prima → Informazioni Cliente → Dati
        Prenotazione → Note Speciali.
        Desktop (md:grid-cols-2): le classi `md:order-*` riportano il layout a 2 colonne
        (md:order-1 = colonna sinistra = Dati Prenotazione; md:order-2 = colonna destra = Cliente).
      */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 md:items-start">
        {/* RIGHT column (desktop): Informazioni Cliente — primo nel DOM per ordine mobile corretto */}
        <div className="flex min-w-0 flex-col gap-4 md:order-2">
          <div className={SECTION_CARD}>
            <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
              Informazioni Cliente
            </h3>
            {isEditMode ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-base font-medium text-gray-700">Nome</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => onFormDataChange('client_name', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-base font-medium text-gray-700">
                    Email <span className="text-sm font-normal text-gray-500">(opzionale)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => onFormDataChange('client_email', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    placeholder="opzionale"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-base font-medium text-gray-700">Telefono</label>
                  <input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) => onFormDataChange('client_phone', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    placeholder="Opzionale"
                  />
                </div>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3">
                <InfoRow label="Nome" value={formData.client_name} />
                <InfoRow label="Email" value={formData.client_email ?? ''} />
                <InfoRow label="Telefono" value={formData.client_phone ?? ''} />
              </div>
            )}
          </div>
        </div>

        {/* LEFT column (desktop): Dati Prenotazione + Note/Intolleranze */}
        <div className="flex min-w-0 flex-col gap-4 md:order-1">
          {/* Dati Prenotazione (ex Dettagli Evento) */}
          <div className={SECTION_CARD}>
            <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
              Dati Prenotazione
            </h3>
            {isEditMode ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-base font-medium text-gray-700">Data</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => onFormDataChange('date', e.target.value)}
                    className={ADMIN_INPUT_CLASS}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-base font-medium text-gray-700">Ora Inizio</label>
                    <TimePicker24h
                      id="detail_start_time"
                      value={formData.startTime}
                      onChange={(v) => onFormDataChange('startTime', v)}
                      className="rounded-lg border-slate-200 bg-white text-gray-900 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/30"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-base font-medium text-gray-700">Ora Fine</label>
                    <TimePicker24h
                      id="detail_end_time"
                      value={formData.endTime}
                      onChange={(v) => onFormDataChange('endTime', v)}
                      className="rounded-lg border-slate-200 bg-white text-gray-900 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/30"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-base font-medium text-gray-700">Numero Ospiti</label>
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
                    className={ADMIN_INPUT_CLASS}
                    required
                  />
                </div>

                {features.servizio && (
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-base font-medium text-gray-700">
                      <MapPin className="h-5 w-5 shrink-0" />
                      Posizionamento
                    </label>
                    <Select
                      value={formData.placement || 'none'}
                      onValueChange={(value) => onFormDataChange('placement', value === 'none' ? null : value)}
                    >
                      <SelectTrigger className={ADMIN_INPUT_CLASS}>
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

          {/* Note Speciali (tavolo only) */}
          {formData.booking_type === 'tavolo' && (
            <div className={SECTION_CARD}>
              <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
                Note Speciali
              </h3>
              {isEditMode ? (
                <textarea
                  value={formData.specialRequests}
                  onChange={(e) => onFormDataChange('specialRequests', e.target.value)}
                  rows={4}
                  className="w-full resize-vertical rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[17px] text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Inserisci eventuali richieste particolari..."
                />
              ) : (
                <p className="whitespace-pre-wrap text-base text-gray-900 md:text-lg">
                  {formData.specialRequests || 'Nessuna nota aggiunta'}
                </p>
              )}
            </div>
          )}

          {/* Intolleranze alimentari — solo tavolo (tipologie con menu: tab Intolleranze e Note) */}
          {!bookingTypeUsesMenuSelections(formData.booking_type) &&
            (booking.dietary_data_consent === true || booking.dietary_off_platform_notice === true) && (
            <div className={SECTION_CARD}>
              <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
                Intolleranze Alimentari
              </h3>
              {booking.dietary_data_consent === true ? (
                <p className="text-base text-gray-700">
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
                <p className="text-base text-amber-700">
                  Il cliente comunicherà esigenze direttamente al ristorante.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Prenotazione — full width, sotto la griglia */}
      <div className={SECTION_CARD}>
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Info Prenotazione
        </h3>
        <div className="grid grid-cols-1 gap-3 min-w-0">
          <InfoRow
            label="Tipo"
            value={getModeLabelByType(modes, booking.booking_type)}
          />
          {subTabLabel && (
            <InfoRow label="Card" value={subTabLabel} />
          )}
          {!isEditMode && promoMessage && (
            <div className="space-y-1.5">
              <span className="text-sm font-semibold text-gray-700 md:text-base">
                Promo visualizzate dal cliente
              </span>
              <p className="whitespace-pre-wrap text-sm text-gray-700 md:text-base">{promoMessage}</p>
            </div>
          )}
          <InfoRow label="Creata il" value={creationDateLabel} />
        </div>
      </div>

      {/* Appunti admin — full width, sotto Info Prenotazione */}
      <div className={SECTION_CARD}>
        <h3 className="text-title-subtitle font-bold uppercase tracking-wide text-gray-900">
          Appunti
        </h3>
        {isEditMode ? (
          <textarea
            value={formData.adminNotes}
            onChange={(e) => onFormDataChange('adminNotes', e.target.value)}
            rows={4}
            className="w-full resize-vertical rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[17px] text-gray-900 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Scrivi un appunto interno su questa prenotazione…"
          />
        ) : (
          <p className="whitespace-pre-wrap text-base text-gray-900 md:text-lg">
            {formData.adminNotes || <span className="text-gray-400">Nessun appunto</span>}
          </p>
        )}
      </div>
    </div>
  )
}
