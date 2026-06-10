import React, { useState } from 'react'
import { Input, Textarea } from '@/components/ui'
import { Link } from 'react-router-dom'
import { Plus, Trash2, X, Check } from 'lucide-react'
import { DIETARY_RESTRICTIONS, type DietaryRestrictionType } from '@/types/menu'

type RestrictionChoice = '' | DietaryRestrictionType | 'Altro'

interface DietaryRestriction {
  restriction: string
  guest_count: number
  notes?: string
}

interface DietaryRestrictionsSectionProps {
  restrictions: DietaryRestriction[]
  onRestrictionsChange: (restrictions: DietaryRestriction[]) => void
  specialRequests: string
  onSpecialRequestsChange: (value: string) => void
  privacyAccepted?: boolean
  onPrivacyChange?: (value: boolean) => void
  /** Nasconde il blocco "Altre Richieste" (es. renderizzato sotto la griglia in AdminBookingForm) */
  omitSpecialRequestsSection?: boolean
}

export const DietaryRestrictionsStructuredSection: React.FC<DietaryRestrictionsSectionProps> = ({
  restrictions,
  onRestrictionsChange,
  specialRequests,
  onSpecialRequestsChange,
  privacyAccepted,
  onPrivacyChange,
  omitSpecialRequestsSection = false
}) => {
  const [selectedRestriction, setSelectedRestriction] = useState<RestrictionChoice>('')
  const [guestCount, setGuestCount] = useState<number>(0)
  const [otherNotes, setOtherNotes] = useState<string>('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [addCrossBurst, setAddCrossBurst] = useState(0)

  const handleAdd = () => {
    if (!selectedRestriction) {
      alert("Seleziona un'intolleranza o esigenza dall'elenco")
      return
    }

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
      restriction: selectedRestriction as DietaryRestrictionType | 'Altro',
      guest_count: guestCount,
      notes: selectedRestriction === 'Altro' ? otherNotes.trim() : undefined
    }

    if (editingIndex !== null) {
      // Modifica esistente
      const updated = [...restrictions]
      updated[editingIndex] = newRestriction
      onRestrictionsChange(updated)
      setEditingIndex(null)
    } else {
      // Aggiungi nuovo
      onRestrictionsChange([...restrictions, newRestriction])
    }

    // Reset form
    setSelectedRestriction('')
    setGuestCount(0)
    setOtherNotes('')
  }

  const handleDelete = (index: number) => {
    const updated = restrictions.filter((_, i) => i !== index)
    onRestrictionsChange(updated)
    if (editingIndex === index) {
      setEditingIndex(null)
      setSelectedRestriction('')
      setGuestCount(0)
      setOtherNotes('')
    }
  }

  const handleCancel = () => {
    setEditingIndex(null)
    setSelectedRestriction('')
    setGuestCount(0)
    setOtherNotes('')
  }

  return (
    <div className="space-y-6">
      {/* Titolo Sezione */}
      <h2
        className="booking-section-title w-full text-center text-lg md:text-xl font-serif text-warm-wood mb-4 pb-3 border-b-2 border-warm-beige"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(1px)',
          padding: '12px 24px',
          borderRadius: '16px',
          fontWeight: '700'
        }}
      >
        Intolleranze e Richieste Speciali
      </h2>

      {/* Form Aggiunta/Modifica */}
      <div className="space-y-4">
        <div
          className={`grid max-w-full grid-cols-1 gap-4 md:gap-x-8 md:gap-y-2 ${selectedRestriction !== '' ? 'md:grid-cols-2' : ''}`}
        >
          {/* Ordine DOM: mobile = label, select, altro?, label ospiti, input. Su md le placement allineano select e input sulla stessa riga anche se la label destra va a capo. */}
          <label
            className="md:col-start-1 md:row-start-1 flex min-h-[4.5rem] w-full items-center justify-center text-center text-base leading-snug md:text-lg text-warm-wood"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              padding: '10px 16px',
              borderRadius: '12px',
              fontWeight: '700',
              marginBottom: '0.5rem'
            }}
          >
            Intolleranza o Esigenza *
          </label>
          <select
            value={selectedRestriction}
            onChange={(e) => {
              const value = e.target.value as RestrictionChoice
              setSelectedRestriction(value)
              if (value === '') {
                setGuestCount(0)
                setOtherNotes('')
              } else if (value !== 'Altro') {
                setOtherNotes('')
              }
            }}
            className={`md:col-start-1 md:row-start-2 flex w-full rounded-full border shadow-sm transition-all text-center ${selectedRestriction === '' ? 'text-slate-400' : 'text-gray-600'}`}
            style={{
              borderColor: 'rgba(0,0,0,0.2)',
              height: '56px',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              marginBottom: '0'
            }}
            onFocus={(e) => e.target.style.borderColor = '#8B6914'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(0,0,0,0.2)'}
          >
            <option value="">Seleziona…</option>
            {DIETARY_RESTRICTIONS.map((restriction) => (
              <option key={restriction} value={restriction}>{restriction}</option>
            ))}
          </select>
          {selectedRestriction === 'Altro' && (
            <div className="md:col-span-1 md:col-start-1 md:row-start-3 space-y-2">
              <label
                className="mb-2 block w-full text-center text-base md:text-lg text-warm-wood"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(1px)',
                  padding: '8px 16px',
                  borderRadius: '12px',
                  fontWeight: '700'
                }}
              >
                Specifica intolleranza o esigenza *
              </label>
              <Input
                value={otherNotes}
                onChange={(e) => setOtherNotes(e.target.value)}
                placeholder="Descrivi l'intolleranza o esigenza"
                className="w-full rounded-2xl border shadow-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
                style={{
                  borderColor: 'rgba(0,0,0,0.2)',
                  minHeight: '56px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '700',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(1px)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#8B6914'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(0,0,0,0.2)'
                }}
              />
            </div>
          )}
          {selectedRestriction !== '' && (
            <>
              <label
                className="md:col-start-2 md:row-start-1 flex min-h-[4.5rem] w-full items-center justify-center text-center text-base leading-snug md:text-lg text-warm-wood"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(1px)',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}
              >
                Quante persone?
              </label>
              <div className="guest-card-container md:col-start-2 md:row-start-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  value={guestCount > 0 ? guestCount.toString() : ''}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
                    setGuestCount(value)
                  }}
                  className="w-full rounded-full border text-center shadow-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
                  style={{
                    borderColor: 'rgba(0,0,0,0.2)',
                    height: '56px',
                    padding: '16px',
                    fontSize: '16px',
                    fontWeight: '700',
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(1px)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#8B6914'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0,0,0,0.2)'
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3" style={{ paddingTop: '0.5rem' }}>
          <button
            type="button"
            onClick={handleAdd}
            onPointerDown={(e) => {
              if (
                typeof window !== 'undefined' &&
                (e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches)
              ) {
                setAddCrossBurst((v) => v + 1)
              }
            }}
            className="booking-cross-shine-btn group relative min-h-[50px] min-w-[15.33rem] overflow-hidden flex items-center justify-center rounded-full border-2 border-green-700 bg-green-600 px-10 py-2.5 text-sm font-bold text-white shadow-xl hover:bg-green-700 hover:shadow-[0_12px_28px_rgba(34,197,94,0.35)] hover:-translate-y-0.5 active:scale-[0.995] transition-all duration-300 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <div className="booking-cross-shine-mount pointer-events-none absolute inset-0 z-[7] overflow-hidden rounded-[inherit]" aria-hidden>
              <div className="booking-cross-shine-beam booking-cross-shine-beam-desktop" />
              {addCrossBurst > 0 ? (
                <div
                  key={addCrossBurst}
                  className="booking-cross-shine-beam booking-cross-shine-touch-burst"
                />
              ) : null}
            </div>
            <div className="absolute inset-0 z-0 pointer-events-none bg-linear-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative z-10 inline-flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              {editingIndex !== null ? 'Salva Modifiche' : 'Aggiungi'}
            </span>
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-3 border-2 border-warm-wood text-warm-wood rounded-full bg-transparent hover:bg-warm-wood hover:text-white shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-warm-wood/30"
              style={{ fontWeight: '600' }}
            >
              <X className="h-4 w-4" />
              Annulla
            </button>
          )}
        </div>

        <p
          className="text-xs text-gray-700 mt-2"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(1px)',
            padding: '8px 16px',
            borderRadius: '12px',
            display: 'inline-block',
            fontWeight: '600'
          }}
        >
          Nota: Questo numero è solo per associare l'intolleranza specifica e non viene sommato al totale ospiti della prenotazione.
        </p>
      </div>

      {/* Lista Recap */}
      {restrictions.length > 0 && (
        <div>
          <h3
            className="text-lg md:text-xl text-gray-800 mb-4"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              padding: '8px 16px',
              borderRadius: '12px',
              fontWeight: '700'
            }}
          >
            Intolleranze inserite:
          </h3>
          <div className="space-y-4">
          {restrictions.map((restriction, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row items-start md:items-center gap-4 p-8 rounded-xl border hover:shadow-md transition-all w-full"
              style={{
                padding: '28px 32px',
                borderRadius: '16px',
                marginBottom: '4px',
                minHeight: '64px',
                maxWidth: '100%',
                borderColor: 'rgba(0, 0, 0, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(1px)'
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-1 min-w-0">
                <span className="font-bold text-gray-900 text-base md:text-lg" style={{ wordBreak: 'break-word', fontWeight: '700' }}>{restriction.restriction}</span>
                {restriction.restriction === 'Altro' && restriction.notes && (
                  <span className="text-sm md:text-base font-bold text-gray-600 italic" style={{ wordBreak: 'break-word', fontWeight: '700' }}>({restriction.notes})</span>
                )}
                <span className="text-warm-wood font-bold text-base md:text-lg" style={{ fontWeight: '700' }}>
                  {restriction.guest_count} {restriction.guest_count === 1 ? 'ospite' : 'ospiti'}
                </span>
              </div>
              <div className="flex gap-3 md:ml-auto flex-shrink-0 w-full md:w-auto justify-end md:justify-start">
                <button
                  type="button"
                  onClick={() => handleDelete(index)}
                  className="p-2.5 border-2 border-terracotta text-terracotta rounded-lg bg-white hover:bg-terracotta hover:text-white shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Note o Richieste Speciali */}
      {!omitSpecialRequestsSection && (
        <div className="space-y-3 mt-10" style={{ marginTop: '40px' }}>
          <label
            className="block text-base md:text-lg text-warm-wood mb-2"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              padding: '8px 16px',
              borderRadius: '12px',
              display: 'inline-block',
              fontWeight: '700',
              marginBottom: '0.5rem'
            }}
          >
            Altre Richieste
          </label>
          <Textarea
            id="special_requests"
            value={specialRequests}
            onChange={(e) => onSpecialRequestsChange(e.target.value)}
            rows={4}
            placeholder="Inserisci eventuali richieste particolari..."
            className="w-full rounded-2xl border shadow-sm text-black placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-warm-wood/40"
            style={{
              borderColor: 'rgba(0,0,0,0.2)',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '700',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(1px)',
              minHeight: '120px',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#8B6914'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(0,0,0,0.2)'
            }}
          />
        </div>
      )}

      {/* Privacy Policy - Solo se privacyAccepted e onPrivacyChange sono forniti */}
      {privacyAccepted !== undefined && onPrivacyChange && (
        <div style={{ paddingTop: '0.5rem' }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="group relative size-5 shrink-0">
                <input
                  type="checkbox"
                  id="privacy-consent-dietary"
                  checked={privacyAccepted}
                  onChange={(e) => onPrivacyChange(e.target.checked)}
                  required
                  className="peer absolute inset-0 z-10 size-5 cursor-pointer appearance-none opacity-0 focus:outline-none"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded border-2 border-warm-wood/40 bg-white shadow-sm transition-all duration-300 group-hover:border-warm-wood group-hover:shadow-md peer-checked:border-warm-orange peer-checked:bg-warm-orange peer-checked:shadow-lg peer-focus-visible:ring-4 peer-focus-visible:ring-warm-wood/20"
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
                htmlFor="privacy-consent-dietary"
                className="cursor-pointer text-sm text-gray-700"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)', padding: '8px 16px', borderRadius: '8px', backdropFilter: 'blur(1px)' }}
              >
                Accetto la{' '}
                <Link
                  to="/privacy"
                  target="_blank"
                  className="font-semibold text-warm-orange underline decoration-warm-orange hover:text-warm-orange hover:decoration-warm-orange"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </Link>
                {' '}*
              </label>
            </div>
            <p className="inline-flex shrink-0 items-center self-end rounded-md border border-warm-wood/20 bg-white px-2.5 py-1 text-sm font-semibold text-warm-wood-dark shadow-sm sm:self-center">
              * I campi contrassegnati sono obbligatori
            </p>
          </div>
        </div>
      )}
    </div>
  )
}


