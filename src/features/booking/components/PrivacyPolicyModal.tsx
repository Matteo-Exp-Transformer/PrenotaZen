import React from 'react'
import { Modal } from '@/components/ui'
import { useTenantContext } from '@/contexts/TenantContext'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import { PrivacyPolicyContent } from '@/pages/privacy/PrivacyPolicyContent'

interface PrivacyPolicyModalProps {
  onClose: () => void
}

/**
 * Privacy Policy come finestra in-page sopra il form Prenota.
 *
 * Sostituisce l'apertura in nuova scheda: il form sotto NON viene smontato, quindi
 * alla chiusura lo stato React (campi compilati) resta intatto. Nessuna dipendenza da
 * `window.opener`/`window.close()` → funziona ovunque (mobile, browser embedded).
 *
 * Montato solo quando aperto (gli hook tenant/nome girano solo all'apertura, non
 * vincolano il form a un TenantProvider quando la modale è chiusa).
 */
export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ onClose }) => {
  const { organizationName } = useTenantContext()
  const restaurantName = useRestaurantName() || organizationName || 'il ristorante'

  return (
    <Modal isOpen onClose={onClose} title="Privacy Policy" size="xl">
      <PrivacyPolicyContent restaurantName={restaurantName} />
    </Modal>
  )
}
