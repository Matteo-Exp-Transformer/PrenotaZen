import React, { useState, useMemo } from 'react'
import { usePendingBookings, useAcceptedBookings } from '../hooks/useBookingQueries'
import { useAcceptBooking, useRejectBooking } from '../hooks/useBookingMutations'
import { BookingRequestCard } from './BookingRequestCard'
import { RejectBookingModal } from './RejectBookingModal'
import { CapacityWarningModal } from './CapacityWarningModal'
import { PastStartTimeWarningModal } from './PastStartTimeWarningModal'
import { toast } from 'react-toastify'
import type { BookingRequest } from '@/types/booking'
import { getSlotsOccupiedByBookingV2 } from '../utils/capacityCalculator'
import { DEFAULT_SLOT_GUEST_CAPACITIES } from '../lib/restaurantSettingRegistry'
import { useRestaurantSetting } from '../hooks/useRestaurantSetting'
import { useDigestSlotConfigs, useServiceSlots } from '../hooks/useServiceSlots'
import { useServiceSlotOverrides, resolveSlotOverride } from '../hooks/useServiceSlotOverrides'
import {
  createBookingDateTime,
  extractDateFromISO,
  calculateEndTimeFromStart,
  isWallClockStartBeforeNow,
  trimTimeToHHmm,
} from '../utils/dateUtils'
import { logger } from '@/lib/logger'

export const PendingRequestsTab: React.FC = () => {
  const { data: pendingBookings, isLoading, error, refetch } = usePendingBookings()
  const { data: acceptedBookings = [] } = useAcceptedBookings()
  const { data: digestSlots = [] } = useDigestSlotConfigs()
  const { data: serviceSlots = [] } = useServiceSlots()
  const { data: slotOverrides = [] } = useServiceSlotOverrides()
  const { data: slotGuestCapacities = DEFAULT_SLOT_GUEST_CAPACITIES } =
    useRestaurantSetting('slot_guest_capacities', { authenticated: true })
  const acceptMutation = useAcceptBooking()
  const rejectMutation = useRejectBooking()

  // Stato per gestire il modal di rifiuto
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedBookingForReject, setSelectedBookingForReject] = useState<BookingRequest | null>(null)

  // Stato per gestire il modal di overbooking
  const [showOverbookingConfirm, setShowOverbookingConfirm] = useState(false)
  const [overbookingSlotInfo, setOverbookingSlotInfo] = useState<{
    slotName: string; totalOccupied: number; capacity: number; exceededBy: number
  } | null>(null)
  const [pendingAcceptData, setPendingAcceptData] = useState<{
    bookingId: string; confirmedStart: string; confirmedEnd: string;
    desiredTime: string; numGuests: number
  } | null>(null)

  const [showPastStartWarning, setShowPastStartWarning] = useState(false)
  const [pastStartPendingBooking, setPastStartPendingBooking] = useState<BookingRequest | null>(null)

  // ✅ FIX: Deduplicazione prenotazioni pending per evitare visualizzazioni doppie
  // Usa Set per tracciare ID già visti e filtra duplicati
  const uniquePendingBookings = useMemo(() => {
    if (!pendingBookings) return []

    const seenIds = new Set<string>()
    return pendingBookings.filter((booking) => {
      if (seenIds.has(booking.id)) {
        return false // Filtra duplicato
      }
      seenIds.add(booking.id)
      return true // Mantieni primo occurrence
    })
  }, [pendingBookings])

  // Ritorna info sul primo slot che supera la capacity, o null se tutto ok
  const getExceededSlotInfo = (
    booking: BookingRequest, startTime: string, endTime: string
  ): { slotName: string; totalOccupied: number; capacity: number; exceededBy: number } | null => {
    const date = booking.desired_date
    const numGuests = booking.num_guests || 0
    if (digestSlots.length === 0) return null

    const dayBookings = acceptedBookings.filter((b) => {
      if (!b.confirmed_start) return false
      return extractDateFromISO(b.confirmed_start) === date
    })

    const confirmedStart = `${date}T${startTime}:00+00:00`
    const confirmedEnd = `${date}T${endTime}:00+00:00`
    const newBookingSlotIds = getSlotsOccupiedByBookingV2(confirmedStart, confirmedEnd, digestSlots)

    // Calcola capienza: service_slots.max_guests > slot_guest_capacities fallback > override
    const getSlotCap = (slotId: string): number | null => {
      const svcSlot = serviceSlots.find((s) => s.id === slotId)
      if (svcSlot) {
        const ov = resolveSlotOverride(slotOverrides, slotId, date)
        if (ov) return ov.max_guests
        if (svcSlot.max_guests != null) return svcSlot.max_guests
      }
      return slotGuestCapacities[slotId] ?? null
    }

    // Occupazione esistente per fascia
    const occupied: Record<string, number> = {}
    for (const slot of digestSlots) occupied[slot.id] = 0
    for (const b of dayBookings) {
      if (!b.confirmed_start || !b.confirmed_end) continue
      for (const slotId of getSlotsOccupiedByBookingV2(b.confirmed_start, b.confirmed_end, digestSlots)) {
        if (slotId in occupied) occupied[slotId] += b.num_guests ?? 0
      }
    }

    for (const slotId of newBookingSlotIds) {
      const slot = digestSlots.find((s) => s.id === slotId)
      if (!slot) continue
      const cap = getSlotCap(slotId)
      if (cap == null) continue
      const totalOccupied = (occupied[slotId] ?? 0) + numGuests
      if (totalOccupied > cap) {
        return { slotName: slot.name, totalOccupied, capacity: cap, exceededBy: totalOccupied - cap }
      }
    }

    return null
  }

  const runAcceptMutate = (payload: {
    bookingId: string
    confirmedStart: string
    confirmedEnd: string
    desiredTime: string
    numGuests: number
  }) => {
    if (acceptMutation.isPending) return
    acceptMutation.mutate(
      {
        bookingId: payload.bookingId,
        confirmedStart: payload.confirmedStart,
        confirmedEnd: payload.confirmedEnd,
        desiredTime: payload.desiredTime,
        numGuests: payload.numGuests,
      },
      {
        onSuccess: async () => {
          toast.success('Prenotazione accettata con successo!')
          await refetch()
        },
        onError: (error) => {
          logger.error('❌ [PendingRequestsTab] Accept mutation error:', error)
          toast.error('Errore nell\'accettazione della prenotazione')
        },
      }
    )
  }

  /** Dopo conferma orario passato: controllo capienza (eventuale CapacityWarningModal) poi mutate. */
  const continueAcceptAfterPastStart = (booking: BookingRequest, startTimeFormatted: string, confirmedStart: string, confirmedEnd: string) => {
    const endTimeFormatted = calculateEndTimeFromStart(startTimeFormatted)
    const exceededInfo = getExceededSlotInfo(booking, startTimeFormatted, endTimeFormatted)

    if (exceededInfo) {
      setPendingAcceptData({
        bookingId: booking.id,
        confirmedStart,
        confirmedEnd,
        desiredTime: startTimeFormatted,
        numGuests: booking.num_guests,
      })
      setOverbookingSlotInfo(exceededInfo)
      setShowOverbookingConfirm(true)
      return
    }

    runAcceptMutate({
      bookingId: booking.id,
      confirmedStart,
      confirmedEnd,
      desiredTime: startTimeFormatted,
      numGuests: booking.num_guests,
    })
  }

  const handleAccept = (booking: BookingRequest) => {
    if (acceptMutation.isPending) return

    // ✅ VALIDAZIONE: desired_time deve essere presente
    if (!booking.desired_time || booking.desired_time.trim() === '') {
      logger.error('❌ [PendingRequestsTab] No desired_time found for booking:', booking.id)
      toast.error('Errore: Orario di prenotazione non specificato. Impossibile accettare la prenotazione.')
      return
    }

    // Calcola i dati per l'accettazione usando la stessa logica del modale
    const date = booking.desired_date
    const startTime = booking.desired_time
    
    // Ensure time format is HH:mm (not HH:mm:ss)
    const startTimeFormatted = startTime.includes(':') 
      ? startTime.split(':').slice(0, 2).join(':') 
      : startTime
    const endTimeFormatted = calculateEndTimeFromStart(startTimeFormatted)
    
    // Create ISO strings handling midnight crossover
    const confirmedStart = createBookingDateTime(date, startTimeFormatted, true)
    const confirmedEnd = createBookingDateTime(date, endTimeFormatted, false, startTimeFormatted)

    if (isWallClockStartBeforeNow(date, startTimeFormatted)) {
      setPastStartPendingBooking(booking)
      setShowPastStartWarning(true)
      return
    }

    continueAcceptAfterPastStart(booking, startTimeFormatted, confirmedStart, confirmedEnd)
  }

  // Apre il modal quando si clicca su "Rifiuta"
  const handleReject = (booking: BookingRequest) => {
    if (rejectMutation.isPending) return

    // Imposta entrambi gli stati contemporaneamente
    // React batching li applicherà insieme
    setSelectedBookingForReject(booking)
    setRejectModalOpen(true)
    
  }

  // Conferma il rifiuto con il motivo inserito dall'admin
  const handleRejectConfirm = async (rejectionReason: string) => {
    if (!selectedBookingForReject) {
      logger.error('❌ [PendingRequestsTab] No booking selected for rejection')
      return
    }

    
    try {
      await rejectMutation.mutateAsync({
        bookingId: selectedBookingForReject.id,
        rejectionReason: rejectionReason || undefined,
      })
      
      toast.success('Prenotazione rifiutata con successo!')
      
      // Chiudi il modal e resetta lo stato
      setRejectModalOpen(false)
      setSelectedBookingForReject(null)
      
      // Forza il refetch delle richieste pending
      await refetch()
    } catch (error) {
      logger.error('❌ [PendingRequestsTab] Reject mutation error:', error)
      toast.error('Errore nel rifiuto della prenotazione')
    }
  }

  // Chiude il modal senza confermare
  const handleRejectModalClose = () => {
    setRejectModalOpen(false)
    setSelectedBookingForReject(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento richieste...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-medium">Errore nel caricamento delle richieste</p>
        <p className="text-red-600 text-sm mt-2">{String(error)}</p>
      </div>
    )
  }

  if (!uniquePendingBookings || uniquePendingBookings.length === 0) {
    return (
      <div className="rounded-lg border shadow-sm px-6 py-6 text-center admin-warm-surface">
        <div className="mb-1 text-4xl leading-none">✅</div>
        <h3 className="mb-0.5 text-title-card font-semibold text-gray-900">
          Nessuna richiesta in attesa
        </h3>
        <p className="text-micro text-gray-500">
          Non ci sono prenotazioni pendenti al momento.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-title-section font-semibold text-gray-900">
          📋 Richieste in Attesa ({uniquePendingBookings.length})
        </h3>
      </div>

      <div className="space-y-6">
        {uniquePendingBookings.map((booking) => (
          <BookingRequestCard
            key={booking.id}
            booking={booking}
            onAccept={handleAccept}
            onReject={handleReject}
            acceptDisabled={acceptMutation.isPending}
            rejectDisabled={rejectMutation.isPending}
          />
        ))}
      </div>

      <PastStartTimeWarningModal
        isOpen={showPastStartWarning}
        variant="accept_pending"
        desiredDate={pastStartPendingBooking?.desired_date ?? ''}
        startTimeHHmm={trimTimeToHHmm(pastStartPendingBooking?.desired_time ?? '')}
        onClose={() => {
          setShowPastStartWarning(false)
          setPastStartPendingBooking(null)
        }}
        onCancel={() => {
          setShowPastStartWarning(false)
          setPastStartPendingBooking(null)
        }}
        onConfirm={() => {
          const b = pastStartPendingBooking
          setShowPastStartWarning(false)
          setPastStartPendingBooking(null)
          if (!b?.desired_time?.trim()) return
          const startTimeFormatted = trimTimeToHHmm(b.desired_time)
          const endTimeFormatted = calculateEndTimeFromStart(startTimeFormatted)
          const confirmedStart = createBookingDateTime(b.desired_date, startTimeFormatted, true)
          const confirmedEnd = createBookingDateTime(b.desired_date, endTimeFormatted, false, startTimeFormatted)
          continueAcceptAfterPastStart(b, startTimeFormatted, confirmedStart, confirmedEnd)
        }}
      />

      {/* Modal per overbooking (solo avviso, non blocca) */}
      {overbookingSlotInfo && (
        <CapacityWarningModal
          isOpen={showOverbookingConfirm}
          onClose={() => {
            setShowOverbookingConfirm(false)
            setOverbookingSlotInfo(null)
            setPendingAcceptData(null)
          }}
          onConfirm={() => {
            if (acceptMutation.isPending || !pendingAcceptData) return
            runAcceptMutate(pendingAcceptData)
            setShowOverbookingConfirm(false)
            setOverbookingSlotInfo(null)
            setPendingAcceptData(null)
          }}
          confirmDisabled={acceptMutation.isPending}
          onCancel={() => {
            setShowOverbookingConfirm(false)
            setOverbookingSlotInfo(null)
            setPendingAcceptData(null)
          }}
          exceededBy={overbookingSlotInfo.exceededBy}
          slotName={overbookingSlotInfo.slotName}
          totalOccupied={overbookingSlotInfo.totalOccupied}
          capacity={overbookingSlotInfo.capacity}
          variant="new_booking"
        />
      )}

      {/* Modal per il rifiuto con motivo */}
      <RejectBookingModal
        isOpen={rejectModalOpen}
        onClose={handleRejectModalClose}
        booking={selectedBookingForReject}
        onConfirm={handleRejectConfirm}
        isLoading={rejectMutation.isPending}
      />
    </div>
  )
}

