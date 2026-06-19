import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BookingRequestForm } from '@/features/booking/components/BookingRequestForm'
import { BookingSummarySidebar } from '@/features/booking/components/publicBooking/BookingSummarySidebar'
import { BookingPhotoStrip } from '@/features/booking/components/publicBooking/BookingPhotoStrip'
import { MapPin, Clock, Phone, Mail, ChevronDown, Send } from 'lucide-react'
import { useBookingPublicViewport } from '@/hooks/useBookingPublicViewport'
import { useBusinessHours } from '@/hooks/useBusinessHours'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import { formatHours } from '@/lib/businessHours'
import { hasAnyBusinessHoursConfigured, type BusinessHours } from '@/lib/businessHours'
import { useTenantContext } from '@/contexts/TenantContext'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import { cn } from '@/lib/utils'
import {
  bookingFullPageBackgroundPublicHref,
  resolvePublicBookingPageLayout,
} from '@/features/booking/constants/bookingPageBackground'
import {
  DEFAULT_BOOKING_HEADER_STYLES,
  getBookingHeaderTextStyle,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import type { BookingRequestInput } from '@/types/booking'
import {
  BOOKING_FULL_PAGE_FORM_MAX_WIDTH_PX,
  BOOKING_FULL_PAGE_SUMMARY_WIDTH_PX,
} from '@/features/booking/constants/bookingPageLayout'
import { surfaceUsesLightText } from '@/features/booking/constants/bookingPublicFieldStyles'

/** Padding colonna contenuto — header e form condividono lo stesso inset (no -mx bleed). */
const BOOKING_PAGE_CONTENT_PAD_FULL = 'px-8 md:px-10 lg:px-10'
const BOOKING_PAGE_CONTENT_PAD_STRIP = 'px-4 md:px-6 lg:px-6'
/** Layer foto full-page: altezza large viewport — non segue hide/show barra URL Android. */
const FULL_PAGE_PHOTO_LAYER_CLASS =
  'pointer-events-none fixed top-0 left-0 right-0 h-[100lvh] min-h-[100svh] -z-10'

export const BookingRequestPage: React.FC = () => {
  useBookingPublicViewport()
  const { tenantSlug: routeTenantSlug } = useParams<{ tenantSlug: string }>()
  const {
    tenantId,
    tenantSlug: resolvedTenantSlug,
    isLoading: isTenantLoading,
    setTenantFromSlug,
  } = useTenantContext()
  const [resolvedRouteSlug, setResolvedRouteSlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!routeTenantSlug) {
      setResolvedRouteSlug(null)
      return undefined
    }

    setResolvedRouteSlug(null)
    void setTenantFromSlug(routeTenantSlug).finally(() => {
      if (!cancelled) {
        setResolvedRouteSlug(routeTenantSlug)
      }
    })

    return () => {
      cancelled = true
    }
  }, [routeTenantSlug, setTenantFromSlug])

  const tenantLookupFinished = !!routeTenantSlug && resolvedRouteSlug === routeTenantSlug && !isTenantLoading
  const tenantReady =
    tenantLookupFinished &&
    !!tenantId &&
    resolvedTenantSlug === routeTenantSlug
  const tenantStale =
    !!routeTenantSlug &&
    !!tenantId &&
    resolvedTenantSlug !== routeTenantSlug

  if (!routeTenantSlug) {
    return <BookingTenantUnavailable />
  }

  if (!tenantLookupFinished || isTenantLoading || tenantStale) {
    return <BookingTenantLoading />
  }

  if (!tenantReady) {
    return <BookingTenantUnavailable />
  }

  return <BookingRequestPageContent tenantSlug={routeTenantSlug} />
}

interface BookingRequestPageContentProps {
  tenantSlug?: string
}

const BookingTenantLoading: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
      <p className="mt-4 text-gray-600">Caricamento...</p>
    </div>
  </div>
)

const BookingTenantUnavailable: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Prenotazioni temporaneamente non disponibili</h1>
      <p className="text-gray-600">Il ristorante richiesto non esiste, e&apos;inattivo o l&apos;indirizzo non e&apos;corretto.</p>
    </div>
  </div>
)

const BookingRequestPageContent: React.FC<BookingRequestPageContentProps> = ({ tenantSlug }) => {
  const restaurantName = useRestaurantName()

  const { data: businessHours, isLoading } = useBusinessHours()
  const [mobileInfoOpen, setMobileInfoOpen] = useState<'hours' | 'contacts'>('hours')
  const { data: contactEmail } = useRestaurantSetting('contact_email')
  const { data: contactPhone } = useRestaurantSetting('contact_phone')
  const { data: contactAddress } = useRestaurantSetting('contact_address')
  const { data: publicBookingBg } = useRestaurantSetting('public_booking_page_background')
  const { data: stripPhotoId } = useRestaurantSetting('public_booking_strip_photo')
  const { data: formConfig, isLoading: isFormConfigLoading } = useRestaurantSetting(
    'booking_public_form_config',
  )
  const headerStyles = formConfig?.header_styles ?? DEFAULT_BOOKING_HEADER_STYLES

  // Stato form condiviso tra BookingRequestForm e BookingSummarySidebar
  const [sharedFormData, setSharedFormData] = useState<Partial<BookingRequestInput>>({})
  const [activeSubTab, setActiveSubTab] = useState<SubTab | null>(null)
  // Stato disabled del pulsante submit (sincronizzato da BookingRequestForm)
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true)

  const formatDayName = (day: string): string => {
    const dayMap: Record<string, string> = {
      monday: 'Lunedi',
      tuesday: 'Martedi',
      wednesday: 'Mercoledi',
      thursday: 'Giovedi',
      friday: 'Venerdi',
      saturday: 'Sabato',
      sunday: 'Domenica',
    }
    return dayMap[day] || day
  }

  const dayOrder: (keyof BusinessHours)[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  ]

  type WeekdayKey = (typeof dayOrder)[number]
  const openingHoursColumns: [WeekdayKey[], WeekdayKey[]] = [
    dayOrder.slice(0, 4),
    dayOrder.slice(4),
  ]

  // clamp usato 3 volte: mantiene allineamento simmetrico tra colonna Orari e Contatti
  const hoursInset = 'clamp(0.4rem, 2vw, 1rem)'

  const displayName = restaurantName?.trim() ?? ''
  const displayContactEmail = (contactEmail ?? '').trim()
  const displayContactPhone = (contactPhone ?? '').trim()
  const displayContactAddress = (contactAddress ?? '').trim()
  const showHoursSection =
    isLoading || (businessHours != null && hasAnyBusinessHoursConfigured(businessHours))
  const showContactSection = Boolean(displayContactEmail || displayContactPhone || displayContactAddress)
  const showInfoFooter = showHoursSection || showContactSection

  useEffect(() => {
    if (!showHoursSection && showContactSection && mobileInfoOpen === 'hours') {
      setMobileInfoOpen('contacts')
    }
  }, [mobileInfoOpen, showContactSection, showHoursSection])
  const pageLayout = resolvePublicBookingPageLayout({
    pageBackground: publicBookingBg ?? null,
    stripPhotoId: stripPhotoId ?? null,
  })
  const showPhotoStrip = pageLayout.mode === 'strip'
  const fullPagePhotoId = pageLayout.fullPagePhotoId
  const isFullPagePhoto = fullPagePhotoId != null
  const publicBookingSurface = pageLayout.surface
  const contentColumnPad = showPhotoStrip ? BOOKING_PAGE_CONTENT_PAD_STRIP : BOOKING_PAGE_CONTENT_PAD_FULL
  /** Cap form + riepilogo esterno: solo full-page senza striscia, desktop ≥1256px (CSS). */
  const useFullPageDesktopFreezeLayout = !showPhotoStrip && isFullPagePhoto
  const fullPagePhotoLandscapeUrl = fullPagePhotoId
    ? bookingFullPageBackgroundPublicHref(fullPagePhotoId, import.meta.env.BASE_URL, 'landscape')
    : null
  const fullPagePhotoPortraitUrl = fullPagePhotoId
    ? bookingFullPageBackgroundPublicHref(fullPagePhotoId, import.meta.env.BASE_URL, 'portrait')
    : null
  // Foto full-page: layer viewport `fixed` + cover (contenuto scrolla sopra). Root crema per
  // striscia, assenza scelta decorativa, primo paint / errore caricamento immagine.
  const fullPagePhotoLayerStyle = (url: string): React.CSSProperties => ({
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'top center',
    backgroundRepeat: 'no-repeat',
    // `position:fixed` sul div (non `background-attachment:fixed`) — equivalente robusto su iOS.
  })
  const pageRootFallbackStyle: React.CSSProperties = {
    backgroundColor: pageLayout.rootBackgroundColor,
  }

  const summaryFormData = {
    desired_date: sharedFormData.desired_date,
    desired_time: sharedFormData.desired_time,
    num_guests: sharedFormData.num_guests ?? 0,
    client_phone: sharedFormData.client_phone,
    booking_type: sharedFormData.booking_type,
    menu_selection: sharedFormData.menu_selection,
    menu_total_per_person: sharedFormData.menu_total_per_person,
    menu_total_booking: sharedFormData.menu_total_booking,
    preset_menu: sharedFormData.preset_menu,
  }
  const hasEnabledBookingModes =
    formConfig?.booking_modes.some((mode) => mode.enabled) ?? false
  const summarySubmitButton = (
    <button
      type="submit"
      form="booking-request-form"
      disabled={isSubmitDisabled}
      className="w-full flex items-center justify-center gap-2 py-3 px-5 text-sm font-bold text-white rounded-full bg-green-600 hover:bg-green-700 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wide transition-colors duration-200"
    >
      <Send className="h-4 w-4" />
      Invia Prenotazione
    </button>
  )
  const summarySidebarStacked = formConfig && hasEnabledBookingModes ? (
    <BookingSummarySidebar
      formData={summaryFormData}
      modes={formConfig.booking_modes}
      activeSubTab={activeSubTab}
      submitButton={summarySubmitButton}
      // Full-page: riepilogo sotto il form in flusso normale (niente sticky).
      // Griglia striscia: colonna laterale sticky da 1256px (layout legacy a 2 colonne),
      // resta `order-2` a tutte le viewport — comportamento confermato corretto (Matteo 02-06-26).
      className={
        useFullPageDesktopFreezeLayout
          ? 'mb-6'
          : 'order-2 mb-6 min-[1256px]:mb-0 min-[1256px]:sticky min-[1256px]:top-4'
      }
      // Scroll interno attivo solo quando la card è sticky (striscia/light ≥1256px).
      // Full-page stacked: niente sticky → niente scroll interno, la pagina scrolla normalmente.
      stickyScrollable={!useFullPageDesktopFreezeLayout}
    />
  ) : null
  const summarySidebarDesktopExternal = formConfig && hasEnabledBookingModes ? (
    <BookingSummarySidebar
      formData={summaryFormData}
      modes={formConfig.booking_modes}
      activeSubTab={activeSubTab}
      submitButton={summarySubmitButton}
      // Istanza esterna ≥1600px: colonna laterale sticky.
      className="sticky top-4"
    />
  ) : null
  const bookingFormNotConfiguredState = (
    <div
      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-6 py-10 text-center shadow-sm animate-fade-in"
      role="status"
    >
      <h2 className="text-lg md:text-xl font-serif text-warm-wood font-bold mb-3">
        Form prenotazione non ancora configurato
      </h2>
      <p className="text-sm md:text-base text-warm-wood-dark font-medium leading-relaxed max-w-md mx-auto">
        {displayContactPhone || displayContactEmail
          ? 'Per prenotare, contatta il ristorante usando i recapiti qui sotto.'
          : 'Per prenotare, contatta direttamente il ristorante.'}
      </p>
    </div>
  )

  const bookingFormLoadingState = (
    <div className="w-full py-10 text-center text-warm-wood-dark font-medium text-sm">
      Caricamento form...
    </div>
  )

  const bookingRequestForm = isFormConfigLoading ? (
    bookingFormLoadingState
  ) : formConfig === null ? (
    bookingFormNotConfiguredState
  ) : hasEnabledBookingModes ? (
    <BookingRequestForm
      tenantSlug={tenantSlug}
      formConfig={formConfig}
      publicFormLightTextOnDarkBackground={surfaceUsesLightText(publicBookingSurface)}
      onFormDataChange={setSharedFormData}
      onActiveSubTabChange={setActiveSubTab}
      onIsDisabledChange={setIsSubmitDisabled}
      externalSummaryLayout={useFullPageDesktopFreezeLayout}
      summarySidebar={summarySidebarStacked}
    />
  ) : null

  const fullPageDesktopCapStyle = {
    ['--booking-full-page-form-max' as string]: `${BOOKING_FULL_PAGE_FORM_MAX_WIDTH_PX}px`,
    ['--booking-full-page-summary-w' as string]: `${BOOKING_FULL_PAGE_SUMMARY_WIDTH_PX}px`,
  } as React.CSSProperties

  const bookingPageHeader = formConfig ? (
    <div className="flex w-full flex-col gap-1.5 py-1.5 animate-fade-in">
      {displayName && (
        <h1
          className="m-0 w-full"
          style={getBookingHeaderTextStyle('restaurant_name', headerStyles)}
        >
          {displayName}
        </h1>
      )}
      <div className="flex w-full flex-col gap-1.5">
        <h2
          className="m-0 w-full"
          style={getBookingHeaderTextStyle('page_title', headerStyles)}
        >
          {formConfig.page_title}
        </h2>
        <p
          className="opacity-90 m-0 w-full"
          style={getBookingHeaderTextStyle('page_description', headerStyles)}
        >
          {formConfig.page_description}
        </p>
      </div>
    </div>
  ) : displayName ? (
    <div className="flex w-full flex-col gap-1.5 py-1.5 animate-fade-in">
      <h1
        className="m-0 w-full"
        style={getBookingHeaderTextStyle('restaurant_name', headerStyles)}
      >
        {displayName}
      </h1>
    </div>
  ) : null

  return (
    <div className="min-h-screen font-bold relative isolate" style={pageRootFallbackStyle}>
      {/*
        Foto full-page (responsive): layer fixed con h-[100lvh] — crop stabile su Android Chrome
        (barra URL). Portrait <768px, landscape ≥768px; cover + top center, no-repeat (doc §2).
      */}
      {isFullPagePhoto && fullPagePhotoPortraitUrl && (
        <div
          aria-hidden
          className={cn(FULL_PAGE_PHOTO_LAYER_CLASS, 'md:hidden')}
          style={fullPagePhotoLayerStyle(fullPagePhotoPortraitUrl)}
        />
      )}
      {isFullPagePhoto && fullPagePhotoLandscapeUrl && (
        <div
          aria-hidden
          className={cn(FULL_PAGE_PHOTO_LAYER_CLASS, 'hidden md:block')}
          style={fullPagePhotoLayerStyle(fullPagePhotoLandscapeUrl)}
        />
      )}
      {/*
        Layout pagina Prenota — flex colonna:
        1. Griglia [striscia foto sx | contenuto form dx] — flex-1 si espande con il form
        2. Footer Orari+Contatti — larghezza piena pagina, copre anche la zona striscia foto
        La striscia foto è sticky top-0 h-screen: rimane visibile durante tutto lo scroll.
        Le foto si ripetono internamente per coprire form lunghi (es. 10 categorie ingredienti).
      */}
      <div className="min-h-screen flex flex-col relative z-10 w-full">

        {/* Griglia [striscia foto | form] — full viewport: la foto resta ancorata al bordo sinistro.
            Mobile/tablet: striscia 20vw. Desktop ≥900px: striscia 25vw. */}
        <div
          className={cn(
            'flex-1 w-full grid grid-cols-1 items-start',
            showPhotoStrip && 'grid-cols-[20vw_1fr] min-[900px]:grid-cols-[25vw_1fr]',
          )}
        >

          {/*
            Striscia foto laterale sinistra.
            sticky top-0 h-screen: rimane ancorata in cima mentre il form scorre.
            Le foto si ripetono per coprire qualsiasi lunghezza di form.
            Per cambiare larghezza: modificare i valori 20vw/25vw in grid-cols sopra.
            Non aggiungere mx-auto/max-w-* a questa griglia: staccherebbe la foto dal bordo sinistro desktop.
          */}
          {showPhotoStrip && (
            <BookingPhotoStrip
              selectedPhotoId={stripPhotoId}
              viteBase={import.meta.env.BASE_URL}
            />
          )}

          {/* Colonna contenuto destra — stesso padding orizzontale per header e form. */}
          <div className={cn('w-full min-w-0', contentColumnPad)}>

            {useFullPageDesktopFreezeLayout ? (
              <div
                className={cn(
                  'w-full',
                  'min-[1256px]:mx-auto min-[1256px]:w-fit min-[1256px]:max-w-full',
                  'min-[1256px]:flex min-[1256px]:flex-col',
                )}
                style={fullPageDesktopCapStyle}
              >
                {bookingPageHeader}
                <div
                  className={cn(
                    'w-full',
                    'min-[1600px]:flex min-[1600px]:w-fit min-[1600px]:items-start min-[1600px]:gap-6',
                  )}
                >
                  <div
                    className={cn(
                      'w-full min-w-0',
                      'min-[1256px]:w-[var(--booking-full-page-form-max)]',
                      'min-[1256px]:max-w-[var(--booking-full-page-form-max)]',
                      'min-[1256px]:shrink-0',
                    )}
                  >
                    {bookingRequestForm}
                  </div>
                  <div
                    className={cn(
                      'hidden min-[1600px]:block min-[1600px]:shrink-0 min-[1600px]:self-start',
                      'min-[1600px]:w-[var(--booking-full-page-summary-w)]',
                    )}
                  >
                    {summarySidebarDesktopExternal}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {bookingPageHeader}
                {bookingRequestForm}
              </>
            )}

          {/* Spacer: gap uniforme prima del footer (ultimo elemento colonna destra, §0 LOCK). */}
          <div className="h-4" aria-hidden />

          </div>{/* fine colonna contenuto destra */}
        </div>{/* fine griglia [striscia foto | contenuto] */}

        {/* Footer Orari+Contatti — fuori dalla griglia, a tutta larghezza viewport */}
        {showInfoFooter && (
        <div className="w-full px-0">
          <div className="rounded-none shadow-xl px-6 md:px-10 bg-white border-t border-slate-100 py-5 md:py-7 mt-0 animate-fade-in">

            {/* Layout desktop/tablet (≥480px): 2 colonne Orari | Contatti */}
            <div
              className={cn(
                'grid gap-x-6 gap-y-2 md:gap-x-10 items-start max-[480px]:hidden',
                showHoursSection && showContactSection ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >

              {showHoursSection && (
              <div className="min-w-0 w-full space-y-2 text-left pr-1.5">
                <div className="flex items-center gap-2 mb-2" style={{ paddingLeft: hoursInset }}>
                  <div className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-linear-to-br from-terracotta to-warm-orange shadow-md">
                    <Clock className="w-[18px] h-[18px] text-white" />
                  </div>
                  <h3 className="text-sm md:text-base font-serif text-warm-wood leading-tight font-bold">
                    Orari
                  </h3>
                </div>
                <div
                  className="flex flex-wrap items-start gap-y-0.5 leading-snug"
                  style={{ paddingLeft: hoursInset, columnGap: 'clamp(1.2rem, 6.4vw, 3.2rem)' }}
                >
                  {isLoading ? (
                    <div className="w-full font-medium text-sm text-warm-wood-dark">
                      Caricamento orari...
                    </div>
                  ) : (
                    openingHoursColumns.map((columnDays, colIdx) => (
                      <div key={colIdx} className="shrink-0 space-y-0.5">
                        {columnDays.map((day) => {
                          const dayHours = businessHours?.[day]
                          const isOpen = !!dayHours && dayHours.length > 0
                          return (
                            <div key={day} className="font-medium text-sm text-warm-wood-dark leading-snug">
                              {formatDayName(day)}: {isOpen ? formatHours(dayHours) : 'Chiuso'}
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
              )}

              {showContactSection && (
              <div className="min-w-0 space-y-1 justify-self-end text-right" style={{ paddingRight: hoursInset }}>
                <div className="flex items-center justify-end gap-2 mb-2">
                  <div className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center bg-linear-to-br from-terracotta to-warm-orange shadow-md">
                    <MapPin className="w-[18px] h-[18px] text-white" />
                  </div>
                  <h3 className="text-sm md:text-base font-serif text-warm-wood leading-tight font-bold">
                    Contatti e Indirizzo
                  </h3>
                </div>
                {displayContactEmail && (
                  <div className="flex min-w-0 items-center justify-end gap-2">
                    <Mail className="w-4 h-4 text-warm-orange shrink-0" />
                    <span className="min-w-0 break-all text-right text-sm text-warm-wood-dark font-medium leading-snug">
                      {displayContactEmail}
                    </span>
                  </div>
                )}
                {displayContactPhone && (
                  <div className="flex items-center justify-end gap-2">
                    <Phone className="w-4 h-4 text-warm-orange shrink-0" />
                    <span className="text-sm text-warm-wood-dark font-medium leading-snug">{displayContactPhone}</span>
                  </div>
                )}
                {displayContactAddress && (
                  <div className="flex items-center justify-end gap-2">
                    <MapPin className="w-4 h-4 text-warm-orange shrink-0" />
                    <span className="text-sm text-warm-wood-dark font-bold leading-snug">{displayContactAddress}</span>
                  </div>
                )}
              </div>
              )}

            </div>

            {/* Layout mobile (<480px): accordion Orari / Contatti */}
            <div className="hidden max-[480px]:block space-y-2">
              {showHoursSection && (
              <div className="rounded-xl bg-white border border-slate-100">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2"
                  onClick={() => setMobileInfoOpen('hours')}
                  aria-expanded={mobileInfoOpen === 'hours'}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-linear-to-br from-terracotta to-warm-orange shadow-md">
                      <Clock className="w-[14px] h-[14px] text-white" />
                    </div>
                    <h3 className="text-xs font-serif text-warm-wood leading-tight font-bold">
                      Orari
                    </h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-warm-wood transition-transform ${mobileInfoOpen === 'hours' ? 'rotate-180' : ''}`} />
                </button>
                {mobileInfoOpen === 'hours' && (
                  <div className="px-3 pb-2 space-y-0.5">
                    {isLoading ? (
                      <div className="font-medium text-xs text-warm-wood-dark">Caricamento orari...</div>
                    ) : (
                      dayOrder.map((day) => {
                        const dayHours = businessHours?.[day]
                        const isOpen = !!dayHours && dayHours.length > 0
                        return (
                          <div key={day} className="font-medium text-xs text-warm-wood-dark leading-tight">
                            {formatDayName(day)}: {isOpen ? formatHours(dayHours) : 'Chiuso'}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
              )}

              {showContactSection && (
              <div className="rounded-xl bg-white border border-slate-100">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2"
                  onClick={() => setMobileInfoOpen('contacts')}
                  aria-expanded={mobileInfoOpen === 'contacts'}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-linear-to-br from-terracotta to-warm-orange shadow-md">
                      <MapPin className="w-[14px] h-[14px] text-white" />
                    </div>
                    <h3 className="text-xs font-serif text-warm-wood leading-tight font-bold">
                      Contatti e Indirizzo
                    </h3>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-warm-wood transition-transform ${mobileInfoOpen === 'contacts' ? 'rotate-180' : ''}`} />
                </button>
                {mobileInfoOpen === 'contacts' && (
                  <div className="px-3 pb-2 space-y-0.5 text-left">
                    {displayContactEmail && (
                      <div className="flex min-w-0 items-center justify-start gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-warm-orange shrink-0" />
                        <span className="min-w-0 break-all text-left text-xs text-warm-wood-dark font-medium leading-tight">
                          {displayContactEmail}
                        </span>
                      </div>
                    )}
                    {displayContactPhone && (
                      <div className="flex items-center justify-start gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-warm-orange shrink-0" />
                        <span className="text-xs text-warm-wood-dark font-medium leading-tight">{displayContactPhone}</span>
                      </div>
                    )}
                    {displayContactAddress && (
                      <div className="flex items-center justify-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-warm-orange shrink-0" />
                        <span className="text-xs text-warm-wood-dark font-bold leading-tight">{displayContactAddress}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>

          </div>
        </div>
        )}

      </div>
    </div>
  )
}
