import React from 'react'
import type { BookingRequest } from '@/types/booking'
import { BookingDangerActionModal } from './BookingDangerActionModal'

interface RejectBookingModalProps {
  isOpen: boolean
  onClose: () => void
  booking: BookingRequest | null
  onConfirm: (reason: string) => void
  isLoading?: boolean
}

export const RejectBookingModal: React.FC<RejectBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isLoading = false,
}) => {
  if (!booking) return null

  return (
    <BookingDangerActionModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={(reason) => onConfirm(reason ?? '')}
      title="Rifiuta Prenotazione"
      subtitle={`Richiesta di ${booking.client_name}`}
      message="Stai per rifiutare questa richiesta. Il cliente non verrà confermato."
      detail="Puoi indicare un motivo facoltativo: resterà visibile in archivio."
      confirmLabel={isLoading ? 'Rifiuto…' : 'Rifiuta Prenotazione'}
      variant="danger"
      isLoading={isLoading}
      zIndex={9999}
      reasonField={{
        id: 'rejection-reason-textarea',
        label: 'Motivo rifiuto',
        placeholder:
          'Esempio: Sala già occupata, data non disponibile, sovrapposizione con altro evento…',
        optional: true,
      }}
    />
  )
}
