import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck } from 'lucide-react'
import { logger } from '@/lib/logger'

interface DietaryConsentModalProps {
  isOpen: boolean
  onAuthorize: () => void
  onCancel: () => void
  onDecline: () => void
}

export const DietaryConsentModal: React.FC<DietaryConsentModalProps> = ({
  isOpen,
  onAuthorize,
  onCancel,
  onDecline,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  if (!document.body) {
    logger.error('[DietaryConsentModal] document.body is null')
    return null
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel()
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100001] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dietary-consent-title"
      onClick={handleOverlayClick}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', pointerEvents: 'auto' }}
    >
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 0 }}
      />

      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg z-10"
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', backgroundColor: '#ffffff', borderRadius: '0.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: '32rem', zIndex: 10 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <ShieldCheck className="h-6 w-6 text-warm-orange shrink-0" aria-hidden="true" />
          <h2 id="dietary-consent-title" className="text-lg font-semibold text-gray-900">
            Informazioni su allergie o intolleranze
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            Hai inserito informazioni su allergie, intolleranze o esigenze alimentari. Questi dati
            rientrano nelle <strong>categorie particolari di dati personali (art. 9 GDPR)</strong> e
            richiedono il tuo consenso esplicito prima di essere trasmessi al ristorante.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800">
              <strong>Perché chiediamo questo?</strong> Il ristorante userà queste informazioni
              esclusivamente per garantire la tua sicurezza durante il pasto (gestione allergeni,
              preparazioni alternative). Non vengono condivise con terze parti.
            </p>
          </div>

          {/* Pulsanti */}
          <div className="flex flex-col gap-3 pt-2">
            {/* Autorizza — primary */}
            <button
              type="button"
              onClick={onAuthorize}
              className="w-full px-4 py-3 bg-warm-orange text-white font-semibold rounded-lg hover:bg-warm-orange/90 transition-colors focus:outline-none focus:ring-2 focus:ring-warm-orange focus:ring-offset-2"
            >
              Sì, autorizzo il trattamento per la mia sicurezza
            </button>

            {/* No, comunico direttamente — secondary */}
            <button
              type="button"
              onClick={onDecline}
              className="w-full px-4 py-3 bg-white text-warm-wood border border-warm-wood/40 font-semibold rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-warm-wood/40 focus:ring-offset-2"
            >
              No, le comunicherò io direttamente al ristorante
            </button>

            {/* Annulla — ghost */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
            >
              Annulla — torna al modulo
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  try {
    return createPortal(modalContent, document.body)
  } catch (error) {
    logger.error('[DietaryConsentModal] Error creating portal:', error)
    return modalContent
  }
}
