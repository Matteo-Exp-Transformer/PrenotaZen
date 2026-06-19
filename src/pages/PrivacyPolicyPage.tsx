import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'
import { useTenantContext } from '@/contexts/TenantContext'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import {
  resolvePrivacyBackAction,
  resolvePrivacyReturnPath,
} from '@/features/booking/utils/privacyPolicyNavigation'
import { PrivacyPolicyContent } from './privacy/PrivacyPolicyContent'

/**
 * Privacy Policy — pagina pubblica standalone (`/privacy`).
 *
 * Usata per i link diretti alla policy. Dal form Prenota la policy si apre invece
 * come finestra in-page (`PrivacyPolicyModal`), così il form non viene smontato.
 * Il CONTENUTO legale vive in `PrivacyPolicyContent` (condiviso pagina + modale);
 * modifiche al testo passano per skill `legal-production`.
 */
export const PrivacyPolicyPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { organizationName } = useTenantContext()
  const restaurantName = useRestaurantName() || organizationName || 'il ristorante'
  const returnPath = resolvePrivacyReturnPath(location.search, location.state)

  const handleBack = () => {
    const action = resolvePrivacyBackAction(returnPath, {
      historyLength: window.history.length,
      locationKey: location.key,
    })
    if (action.kind === 'history-back') {
      navigate(-1)
      return
    }
    if (action.kind === 'replace') {
      navigate(action.path, { replace: true })
      return
    }
    navigate(action.path)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {returnPath ? 'Torna alla prenotazione' : 'Torna alla home'}
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-title-page font-bold text-slate-800">Privacy Policy</h1>
            <p className="text-body text-slate-500">Ai sensi del GDPR — Reg. UE 2016/679</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <PrivacyPolicyContent restaurantName={restaurantName} />
        </div>
      </div>
    </div>
  )
}
