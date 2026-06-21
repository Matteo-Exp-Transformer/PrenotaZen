import React, { useState } from 'react'
import type { BookingRequest } from '@/types/booking'
import { DIETARY_RESTRICTIONS, type DietaryRestrictionType } from '@/types/menu'
import { Plus, Trash2 } from 'lucide-react'
import { BookingDangerActionModal } from './BookingDangerActionModal'
import {
  formatDietaryGuestCountLabel,
  shouldShowDietaryGuestCount,
} from '../utils/dietaryRestrictionsText'

interface Props {
  booking: BookingRequest
  isEditMode: boolean
  dietaryRestrictions: Array<{
    restriction: string
    guest_count: number
    notes?: string
  }>
  specialRequests: string
  onDietaryRestrictionsChange: (restrictions: Array<{restriction: string, guest_count: number, notes?: string}>) => void
  onSpecialRequestsChange: (value: string) => void
}

interface DietaryRestriction {
  restriction: string
  guest_count: number
  notes?: string
}

export const DietaryTab: React.FC<Props> = ({
  booking,
  isEditMode,
  dietaryRestrictions,
  specialRequests,
  onDietaryRestrictionsChange,
  onSpecialRequestsChange
}) => {
  const [selectedRestriction, setSelectedRestriction] = useState<DietaryRestrictionType | 'Altro'>('No Lattosio')
  const [guestCount, setGuestCount] = useState<number>(0)
  const [otherNotes, setOtherNotes] = useState<string>('')
  const [indexToDelete, setIndexToDelete] = useState<number | null>(null)

  const handleAdd = () => {
    if (guestCount < 1) {
      alert('Il numero di ospiti deve essere almeno 1')
      return
    }

    if (selectedRestriction === 'Altro' && !otherNotes.trim()) {
      alert('Inserisci una descrizione per "Altro"')
      return
    }

    // IMPORTANTE: guest_count qui è separato da num_guests della prenotazione.
    // Questo numero serve solo per associare quante persone hanno questa specifica intolleranza
    // e non viene sommato al totale ospiti della prenotazione.
    const newRestriction: DietaryRestriction = {
      restriction: selectedRestriction,
      guest_count: guestCount,
      notes: selectedRestriction === 'Altro' ? otherNotes.trim() : undefined
    }

    // Aggiungi nuovo
    onDietaryRestrictionsChange([...dietaryRestrictions, newRestriction])

    // Reset form
    setSelectedRestriction('No Lattosio')
    setGuestCount(1)
    setOtherNotes('')
  }

  const handleDelete = (index: number) => {
    const updated = dietaryRestrictions.filter((_, i) => i !== index)
    onDietaryRestrictionsChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Dietary Restrictions */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h3 className="text-title-card font-semibold text-gray-900 flex items-center gap-2">
          <span>⚠️</span>
          <span>Intolleranze e Allergie</span>
        </h3>

        {isEditMode ? (
          <>
            {/* Form Aggiunta/Modifica */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Intolleranza o Esigenza *
                    </label>
                    <select
                      value={selectedRestriction}
                      onChange={(e) => {
                        const value = e.target.value as DietaryRestrictionType | 'Altro'
                        setSelectedRestriction(value)
                        if (value !== 'Altro') {
                          setOtherNotes('')
                        }
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-[17px] text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:outline-none transition-colors"
                    >
                      {DIETARY_RESTRICTIONS.map((restriction) => (
                        <option key={restriction} value={restriction}>{restriction}</option>
                      ))}
                    </select>
                  </div>

                  {/* Campo Altro */}
                  {selectedRestriction === 'Altro' && (
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">
                        Specifica intolleranza o esigenza *
                      </label>
                      <input
                        type="text"
                        value={otherNotes}
                        onChange={(e) => setOtherNotes(e.target.value)}
                        placeholder="Descrivi l'intolleranza o esigenza"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-[17px] text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">
                      Numero ospiti con intolleranze alimentari *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={guestCount > 0 ? guestCount.toString() : ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                        setGuestCount(value)
                      }}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-[17px] text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg bg-green-600 hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  Aggiungi
                </button>
              </div>

              <p className="text-sm text-gray-600 mt-2">
                Nota: Questo numero è solo per associare l'intolleranza specifica e non viene sommato al totale ospiti della prenotazione.
              </p>
            </div>

            {/* Lista Recap */}
            {dietaryRestrictions.length > 0 && (
              <div className="mt-4">
                <h4 className="text-base font-semibold text-gray-700 mb-3">
                  Intolleranze inserite:
                </h4>
                <div className="space-y-3">
                  {dietaryRestrictions.map((restriction, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white"
                    >
                      <div className="flex-1 min-w-0 wrap-break-word">
                        <span className="text-base font-medium text-gray-900">{restriction.restriction}</span>
                        {restriction.restriction === 'Altro' && restriction.notes && (
                          <span className="text-sm text-gray-600 italic ml-2 wrap-break-word">({restriction.notes})</span>
                        )}
                        {shouldShowDietaryGuestCount(restriction) && (
                          <span className="text-base text-gray-600 ml-2">
                            - {formatDietaryGuestCountLabel(restriction.guest_count)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIndexToDelete(index)}
                          className="p-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <BookingDangerActionModal
              isOpen={indexToDelete !== null}
              onClose={() => setIndexToDelete(null)}
              onConfirm={() => {
                if (indexToDelete !== null) {
                  handleDelete(indexToDelete)
                  setIndexToDelete(null)
                }
              }}
              title="Elimina intolleranza"
              message="Confermi di voler rimuovere questa intolleranza dalla prenotazione?"
              confirmLabel="Elimina"
              variant="danger"
            />
          </>
        ) : (
          <div className="space-y-3">
            {/* Banner off-platform: nasconde la lista per sicurezza */}
            {booking.dietary_off_platform_notice === true ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-800">
                ⚠️ Il cliente comunicherà direttamente le proprie esigenze alimentari — nessun dettaglio su piattaforma.
              </div>
            ) : (
              <>
                {booking.dietary_data_consent === true && (
                  <span className="inline-block rounded-full bg-green-100 px-3 py-0.5 text-xs font-bold text-green-700">
                    ✓ Consenso esplicito fornito
                  </span>
                )}
                {dietaryRestrictions.length > 0 ? (
                  <ul className="space-y-2">
                    {dietaryRestrictions.map((restriction, index) => (
                      <li key={index} className="text-base text-gray-900 wrap-break-word">
                        <span className="font-medium">• {restriction.restriction}</span>
                        {shouldShowDietaryGuestCount(restriction) && (
                          <span className="text-gray-600">
                            {' '}
                            - {formatDietaryGuestCountLabel(restriction.guest_count)}
                          </span>
                        )}
                        {restriction.notes && restriction.restriction === 'Altro' && (
                          <span className="text-gray-500 italic block ml-4 wrap-break-word">Note: {restriction.notes}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-base text-gray-500 italic">Nessuna intolleranza segnalata</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Special Requests */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-title-card font-semibold text-gray-900 flex items-center gap-2">
          <span>📝</span>
          <span>Note Speciali</span>
        </h3>
        <div>
          {isEditMode ? (
            <textarea
              value={specialRequests}
              onChange={(e) => onSpecialRequestsChange(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg bg-white text-[17px] text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:outline-none resize-vertical transition-colors"
              placeholder="Inserisci eventuali richieste particolari..."
            />
          ) : (
            <p
              className={
                specialRequests
                  ? 'text-base text-gray-900 whitespace-pre-wrap'
                  : 'text-base text-gray-500 italic'
              }
            >
              {specialRequests || 'Nessuna nota aggiunta'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
