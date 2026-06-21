import React, { useMemo } from 'react'
import { Trash2, X } from 'lucide-react'
import type { SelectedMenuItem } from '@/types/menu'
import type { BookingType } from '@/types/booking'
import { bookingTypeUsesMenuSelections } from '../utils/bookingTypeMenu'
import {
  customPresetStorageId,
  getPresetMenu,
  getPresetMenuLabel,
  isBuiltinPresetMenuType,
  isCustomPresetMenuType,
  isStaffPresetSelectableForBookingType,
  type CustomStaffPreset,
  type PresetMenuType,
} from '../constants/presetMenus'

interface MenuTabProps {
  booking: any
  /** Tipologia effettiva in modifica (es. menù a prezzo fisso); default da `booking.booking_type`. */
  menuFlowBookingType?: BookingType
  isEditMode: boolean
  menuSelection?: {
    items: SelectedMenuItem[]
  }
  numGuests: number
  presetMenu?: string | null
  staffPresetsDropdownVisible?: boolean
  customStaffPresets?: CustomStaffPreset[]
  isMenuExpanded?: boolean
  onMenuExpandToggle?: () => void
  onMenuChange: (payload: {
    items: SelectedMenuItem[]
    totalPerPerson: number
  }) => void
  onPresetMenuChange?: (preset: PresetMenuType) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  bevande: 'BEVANDE',
  pizza: 'PIZZA',
  antipasti: 'ANTIPASTI',
  fritti: 'FRITTI',
  primi: 'PRIMI',
  secondi: 'SECONDI',
  dolci: 'DOLCI'
}

const CATEGORY_ICONS: Record<string, string> = {
  bevande: '🍹',
  pizza: '🍕',
  antipasti: '🥗',
  fritti: '🍟',
  primi: '🍝',
  secondi: '🥩',
  dolci: '🍰'
}

const categoryLabel = (category: string) => CATEGORY_LABELS[category] || category.toUpperCase()

export const MenuTab: React.FC<MenuTabProps> = ({
  booking,
  menuFlowBookingType,
  isEditMode,
  menuSelection,
  numGuests,
  presetMenu,
  staffPresetsDropdownVisible = true,
  customStaffPresets = [],
  isMenuExpanded: _isMenuExpanded,
  onMenuExpandToggle: _onMenuExpandToggle,
  onMenuChange,
  onPresetMenuChange
}) => {
  const resolvedMenuBookingType: BookingType =
    menuFlowBookingType ??
    (bookingTypeUsesMenuSelections(booking?.booking_type) ? booking.booking_type : 'rinfresco_laurea')
  // Group menu items by category
  const groupedItems = useMemo(() => {
    if (!menuSelection?.items) return {}

    const grouped: Record<string, SelectedMenuItem[]> = {}
    menuSelection.items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = []
      }
      grouped[item.category].push(item)
    })
    return grouped
  }, [menuSelection?.items])

  // Calculate totals
  const { totalPerPerson, totalBooking, itemCount, baseTotal } = useMemo(() => {
    if (!menuSelection?.items) return { totalPerPerson: 0, totalBooking: 0, itemCount: 0, baseTotal: 0 }
    const baseTotal = menuSelection.items.reduce((sum, item) => sum + item.price, 0)
    return {
      totalPerPerson: baseTotal,
      totalBooking: baseTotal * numGuests,
      itemCount: menuSelection.items.length,
      baseTotal,
    }
  }, [menuSelection, numGuests])

  // Menù predefiniti selezionabili per questa tipologia (stessa fonte del flusso pubblico),
  // più il preset corrente se non è già in lista (built-in legacy o custom non più selezionabile),
  // così Mario può sempre rivedere/cambiare il valore salvato sulla prenotazione.
  const presetOptions = useMemo(() => {
    const selectable = customStaffPresets.filter((p) =>
      isStaffPresetSelectableForBookingType(p, resolvedMenuBookingType),
    )
    const options: { value: string; label: string }[] = []

    if (presetMenu && isBuiltinPresetMenuType(presetMenu)) {
      options.push({ value: presetMenu, label: getPresetMenu(presetMenu)?.label ?? presetMenu })
    }
    if (
      presetMenu &&
      isCustomPresetMenuType(presetMenu) &&
      !selectable.some((p) => customPresetStorageId(p.id) === presetMenu)
    ) {
      options.push({ value: presetMenu, label: getPresetMenuLabel(presetMenu, customStaffPresets) })
    }
    for (const preset of selectable) {
      options.push({ value: customPresetStorageId(preset.id), label: preset.name })
    }
    return options
  }, [customStaffPresets, resolvedMenuBookingType, presetMenu])

  const showPresetSelect = Boolean(onPresetMenuChange) && staffPresetsDropdownVisible && presetOptions.length > 0

  const emitMenuChange = (items: SelectedMenuItem[]) => {
    const total = items.reduce((sum, item) => sum + item.price, 0)
    onMenuChange({ items, totalPerPerson: total })
  }

  // Snapshot prenotazione: rimuove dalla SINGOLA prenotazione aperta, mai dal magazzino menu.
  const handleRemoveItem = (itemId: string) => {
    emitMenuChange((menuSelection?.items ?? []).filter((item) => item.id !== itemId))
  }

  const handleRemoveCategory = (category: string) => {
    emitMenuChange((menuSelection?.items ?? []).filter((item) => item.category !== category))
  }

  // Vista admin (edit mode): coerente col drawer, niente layout pubblico della Pagina Prenota.
  const adminEditContent = (
    <div className="space-y-4">
      {showPresetSelect && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label
            htmlFor="admin-preset-menu"
            className="mb-2 block text-base font-semibold uppercase tracking-wide text-(--color-text-muted)"
          >
            Menù preselezionato
          </label>
          <select
            id="admin-preset-menu"
            value={presetMenu || ''}
            onChange={(e) => {
              const value = e.target.value
              onPresetMenuChange?.(value === '' ? null : (value as Exclude<PresetMenuType, null>))
            }}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-base font-semibold text-(--color-text) focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="">Nessun menù preselezionato</option>
            {presetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-base text-(--color-text-muted)">
            Cambiando menù si sostituiscono gli ingredienti di questa prenotazione.
          </p>
        </div>
      )}

      {itemCount > 0 ? (
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([category, items]) => {
            const categoryTotal = items.reduce((sum, item) => sum + item.price, 0)
            return (
              <div
                key={category}
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-lg font-bold text-(--color-text)">
                      {categoryLabel(category)}
                    </span>
                    <span className="flex-shrink-0 text-base text-(--color-text-muted)">
                      {items.length} {items.length === 1 ? 'voce' : 'voci'} · €{categoryTotal.toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(category)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Rimuovi categoria</span>
                    <span className="sm:hidden">Rimuovi</span>
                  </button>
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {items.map((item, idx) => (
                    <li
                      key={`${item.id}-${idx}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <span className="min-w-0 truncate text-base text-(--color-text)">{item.name}</span>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span className="text-lg font-semibold text-(--color-text)">
                          €{item.price.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Rimuovi ${item.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-red-600 transition-colors hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
            <div className="flex items-center justify-between text-lg">
              <span className="text-(--color-text)">Totale a persona</span>
              <span className="font-bold text-(--color-text)">€{totalPerPerson.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-primary-200 pt-2 text-lg font-bold">
              <span className="text-primary-900">Totale prenotazione</span>
              <span className="text-primary-900">€{totalBooking.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-base text-(--color-text-muted)">{numGuests} ospiti</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-center">
          <p className="text-base font-medium text-(--color-text)">Nessun ingrediente in questa prenotazione</p>
          <p className="mt-1 text-base text-(--color-text-muted)">
            Scegli un menù predefinito qui sopra, oppure salva la prenotazione senza menù.
          </p>
        </div>
      )}
    </div>
  )

  // Menu expanded content (view mode)
  const menuViewContent = (
    <div className="space-y-4">
      {Object.entries(groupedItems).map(([category, items]) => {
        return (
          <div key={category} className="space-y-2">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>{CATEGORY_ICONS[category] || '📦'}</span>
              <span>{categoryLabel(category)}</span>
              <span className="text-base text-gray-600">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
            </h4>
            <ul className="space-y-1 pl-6">
              {items.map((item, idx) => (
                <li key={`${item.id}-${idx}`} className="text-lg text-gray-700 flex items-center justify-between">
                  <span>• {item.name}</span>
                  <span className="text-lg font-semibold">€{item.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {/* Cost Breakdown Summary */}
      {(() => {
        const prezzoPersonaTotal = baseTotal * numGuests

        return (
          <div className="mt-6 pt-4 border-t-2 border-gray-300">
            <h4 className="text-lg font-bold text-gray-900 mb-3">RIEPILOGO COSTI</h4>

            <div className="flex justify-between items-center text-lg mb-2">
              <span className="text-gray-700">
                Prezzo a persona: €{baseTotal.toFixed(2)} × {numGuests} ospiti
              </span>
              <span className="font-bold text-gray-900">€{prezzoPersonaTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-lg font-bold mt-3 pt-3 border-t border-gray-300">
              <span className="text-gray-900">TOTALE</span>
              <span className="text-gray-900">€{prezzoPersonaTotal.toFixed(2)}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )

  if (isEditMode) {
    return adminEditContent
  }

  return (
    <div className="space-y-4">
      {/* Preset Menu Label (if applicable) — view mode */}
      {presetMenu && (
        <div>
          <p className="text-lg font-semibold text-gray-900">
            📋 Menu Preselezionato:{' '}
            <span>{getPresetMenuLabel(presetMenu as PresetMenuType, customStaffPresets)}</span>
          </p>
        </div>
      )}

      {menuSelection?.items && menuSelection.items.length > 0 ? (
        menuViewContent
      ) : (
        <div className="text-center">
          <p className="text-gray-600 italic">Nessun menu selezionato</p>
        </div>
      )}
    </div>
  )
}
