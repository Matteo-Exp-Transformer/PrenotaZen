import React, { useMemo } from 'react'
import { CalendarDays, Clock, Users, UtensilsCrossed, Phone } from 'lucide-react'
import type { BookingRequestInput } from '@/types/booking'
import {
  getShowOfferDetailsInSummary,
  getSubTabPricePerPerson,
  resolveCarouselSummaryDisplay,
  type BookingMode,
  type SubTab,
} from '@/features/booking/constants/bookingPublicFormConfig'
import { useMenuCategories } from '@/features/booking/hooks/useMenuCategories'
import { orderCategoryKeys, buildCategorySortOrderMap } from '@/features/booking/utils/orderCategoryKeys'
import { computeMenuTotalsFromItems } from '@/features/booking/utils/buildPresetMenuSelection'
import { cn } from '@/lib/utils'
import { getModeLabelByType } from '../../utils/bookingModeLabels'
import { activeSubTabShowsMenu, modeUsesMenu } from '@/features/booking/utils/bookingCapabilities'

interface BookingSummarySidebarProps {
  formData: {
    desired_date?: string
    desired_time?: string
    num_guests: number
    booking_type?: BookingRequestInput['booking_type']
    menu_selection?: BookingRequestInput['menu_selection']
    menu_total_per_person?: number
    menu_total_booking?: number
    preset_menu?: BookingRequestInput['preset_menu']
  }
  modes: BookingMode[]
  contactPhone?: string
  activeSubTab?: SubTab | null
  /** Pulsante submit da mostrare in fondo al riepilogo (<1256px). */
  submitButton?: React.ReactNode
  /**
   * Classi posizionali del wrapper, decise dal chiamante (sticky/order/top).
   * Il componente è neutro: il parent passa lo sticky solo dove serve (colonna laterale),
   * lo lascia vuoto dove il riepilogo deve stare sotto il form in flusso normale.
   */
  className?: string
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatCurrency(amount?: number): string {
  if (!amount) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export const BookingSummarySidebar: React.FC<BookingSummarySidebarProps> = ({
  formData,
  modes,
  contactPhone,
  activeSubTab,
  submitButton,
  className,
}) => {
  const { data: menuCategories = [] } = useMenuCategories()
  // Mostra menù/totali per CAPACITÀ, non per NOME: risolve la modalità dal booking_type (come
  // getModeLabelByType) e chiede a modeUsesMenu. Per le tipologie storiche (tavolo no, rinfresco/
  // menu_fisso sì) il risultato è identico al precedente `booking_type !== 'tavolo'`.
  const activeMode = modes.find((m) => m.booking_type === formData.booking_type && m.enabled)
  const hasMenu = activeSubTab
    ? activeSubTabShowsMenu(activeSubTab, activeSubTab.preset_id ? true : null)
    : modeUsesMenu(activeMode ?? { booking_type: formData.booking_type })
  const items = formData.menu_selection?.items ?? []
  const totalPerPerson = formData.menu_total_per_person ?? 0
  const totalBooking = formData.menu_total_booking ?? 0
  const presetPricePerPerson = getSubTabPricePerPerson(activeSubTab)
  const hasPresetPrice = presetPricePerPerson != null
  const showIngredientPrices = presetPricePerPerson == null
  const isCarouselSummary = activeSubTab?.display === 'carousel'
  const showMenuPrices = hasPresetPrice || totalPerPerson > 0
  const showTotals = showMenuPrices && totalPerPerson > 0 && (hasMenu || isCarouselSummary)

  const categoryLabelByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of menuCategories) {
      map.set(cat.key, cat.label)
    }
    return map
  }, [menuCategories])

  const categorySortRank = useMemo(() => {
    const keys = [...new Set(items.map((item) => item.category))]
    const sortOrderMap = buildCategorySortOrderMap(menuCategories)
    const orderedKeys = orderCategoryKeys(
      keys,
      activeSubTab?.category_order_keys,
      sortOrderMap,
    )
    return new Map(orderedKeys.map((key, index) => [key, index]))
  }, [items, menuCategories, activeSubTab?.category_order_keys])

  const sortedMenuItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const orderA = categorySortRank.get(a.category) ?? 999
      const orderB = categorySortRank.get(b.category) ?? 999
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name, 'it')
    })
  }, [items, categorySortRank])

  const menuItemsTotalWithoutPreset = useMemo(
    () => computeMenuTotalsFromItems(items, formData.num_guests).menu_total_booking,
    [items, formData.num_guests],
  )
  const carouselSummaryDisplay = useMemo(
    () => (isCarouselSummary ? resolveCarouselSummaryDisplay(activeSubTab) : null),
    [activeSubTab, isCarouselSummary],
  )
  const subTabLabel = activeSubTab?.label?.trim() ?? ''
  const showCarouselOfferDetails =
    isCarouselSummary && getShowOfferDetailsInSummary(activeSubTab)
  const showTipoRow = isCarouselSummary ? showCarouselOfferDetails && subTabLabel.length > 0 : true
  const tipoValue = isCarouselSummary
    ? subTabLabel
    : getModeLabelByType(modes, formData.booking_type)
  const showOpzioneMenu =
    activeSubTab &&
    (isCarouselSummary
      ? showCarouselOfferDetails && subTabLabel.length > 0
      : subTabLabel.length > 0 ||
        (activeSubTab.price_per_person != null && activeSubTab.price_per_person > 0))

  return (
    <div className={cn('w-full max-w-full self-start', className)}>
      <aside
        className={cn(
          'w-full max-w-full rounded-2xl border border-slate-100 bg-white px-4 py-5 shadow-xl transition-all duration-300 ease-out',
          'space-y-4 min-[1256px]:min-h-[320px]',
        )}
        data-testid="booking-summary-sidebar"
      >
      <h3 className="font-serif text-warm-wood font-bold text-lg leading-tight">
        Riepilogo Prenotazione
      </h3>

      <div className="space-y-3">
        {/* Data */}
        <div className="flex items-start gap-2.5">
          <CalendarDays className="h-4 w-4 text-warm-orange mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">Data</p>
            <p className="text-base font-bold text-warm-wood leading-tight">
              {formData.desired_date ? formatDate(formData.desired_date) : '—'}
            </p>
          </div>
        </div>

        {/* Ora */}
        <div className="flex items-start gap-2.5">
          <Clock className="h-4 w-4 text-warm-orange mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">Orario</p>
            <p className="text-base font-bold text-warm-wood">{formData.desired_time || '—'}</p>
          </div>
        </div>

        {/* Ospiti */}
        <div className="flex items-start gap-2.5">
          <Users className="h-4 w-4 text-warm-orange mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">Ospiti</p>
            <p className="text-base font-bold text-warm-wood">
              {formData.num_guests > 0 ? `${formData.num_guests} persone` : '—'}
            </p>
          </div>
        </div>

        {/* Modalità / nome carosello (carosello: solo se show_offer_details_in_summary) */}
        {showTipoRow && (
          <div className="flex items-start gap-2.5">
            <UtensilsCrossed className="h-4 w-4 text-warm-orange mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">Tipo</p>
              <p className="text-base font-bold text-warm-wood">{tipoValue}</p>
            </div>
          </div>
        )}

        {/* Sottotab selezionata */}
        {showOpzioneMenu && activeSubTab && (
            <div className="border-t border-black/10 pt-3">
              <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">
                Opzione menu
              </p>
              <p className="text-base font-bold text-warm-wood leading-tight mt-0.5">
                {subTabLabel}
              </p>
            </div>
          )}

        {/* Carosello — offerta nel riepilogo (titoli slide e/o solo prezzo) */}
        {carouselSummaryDisplay && (
          <div className="border-t border-black/10 pt-3 space-y-1.5">
            {carouselSummaryDisplay.kind === 'titles' ? (
              <>
                <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">
                  Offerta selezionata
                </p>
                <ul className="space-y-1.5">
                  {carouselSummaryDisplay.titles.map((title, idx) => (
                    <li key={`${title}-${idx}`} className="text-sm text-warm-wood font-medium leading-tight">
                      {title}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-base font-bold text-warm-wood leading-tight">
                {formatCurrency(carouselSummaryDisplay.amount)}
                <span className="text-warm-wood-dark/80 font-semibold">/persona</span>
              </p>
            )}
          </div>
        )}

        {/* IL TUO MENU */}
        {hasMenu && sortedMenuItems.length > 0 && (
          <div className="border-t border-black/10 pt-3 space-y-1.5">
            <p className="text-[13px] text-warm-wood-dark/60 font-semibold uppercase tracking-wide">
              Il tuo menu
            </p>
            <ul className="space-y-1.5">
              {sortedMenuItems.map((item) => {
                const catLabel = categoryLabelByKey.get(item.category)
                return (
                  <li key={item.id} className="flex items-start justify-between gap-2">
                    <span className="text-sm text-warm-wood font-medium leading-tight min-w-0">
                      {catLabel ? (
                        <>
                          <span className="text-warm-wood-dark/55">{catLabel}: </span>
                          {item.name}
                        </>
                      ) : (
                        item.name
                      )}
                    </span>
                    {showMenuPrices && showIngredientPrices ? (
                      <span className="text-sm text-warm-wood-dark/70 font-semibold shrink-0 tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {hasPresetPrice && menuItemsTotalWithoutPreset > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1.5">
                <span className="text-xs font-semibold text-warm-wood-dark/55">
                  Totale senza menù preselezionato
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-warm-wood-dark/45 line-through">
                  {formatCurrency(menuItemsTotalWithoutPreset)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Totali */}
        {showTotals && (
          <div className="border-t border-black/10 pt-3 space-y-1">
            <p className="text-base font-bold text-warm-wood">
              {hasPresetPrice && formData.num_guests > 0
                ? `${formatCurrency(totalPerPerson)} x ${formData.num_guests} ospiti`
                : formatCurrency(totalPerPerson)}
            </p>
            {formData.num_guests > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-warm-wood-dark/70 font-semibold">Totale stimato</span>
                <span className="text-lg font-bold text-warm-orange">{formatCurrency(totalBooking)}</span>
              </div>
            )}
          </div>
        )}

        {/* Telefono contatto */}
        {contactPhone && (
          <div className="border-t border-black/10 pt-3 flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-warm-orange shrink-0" />
            <span className="text-sm text-warm-wood-dark font-medium">{contactPhone}</span>
          </div>
        )}
      </div>

      {/* Pulsante submit in fondo al riepilogo (sotto il breakpoint riepilogo laterale) */}
      {submitButton && (
        <div className="border-t border-black/10 pt-4 block min-[1256px]:hidden">
          {submitButton}
        </div>
      )}
      </aside>
    </div>
  )
}
