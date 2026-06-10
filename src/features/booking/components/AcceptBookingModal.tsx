import React, { useState } from 'react'
import { Modal, TimePicker24h } from '@/components/ui'
import type { BookingRequest } from '@/types/booking'
import { format } from 'date-fns'
import { useCapacityCheck } from '../hooks/useCapacityCheck'
import { toast } from 'react-toastify'
import { createBookingDateTime, calculateEndTimeFromStart } from '../utils/dateUtils'
import { CapacityWarningModal } from './CapacityWarningModal'

interface AcceptBookingModalProps {
  isOpen: boolean
  onClose: () => void
  booking: BookingRequest | null
  acceptedBookings: BookingRequest[]
  onConfirm: (data: {
    confirmedStart: string
    confirmedEnd: string
    numGuests: number
    desiredTime: string
  }) => void
  isLoading?: boolean
}

export const AcceptBookingModal: React.FC<AcceptBookingModalProps> = ({
  isOpen,
  onClose,
  booking,
  acceptedBookings,
  onConfirm,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    numGuests: 0,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCapacityWarning, setShowCapacityWarning] = useState(false)

  // Check capacity in real-time
  const capacityCheck = useCapacityCheck({
    date: formData.date,
    startTime: formData.startTime,
    endTime: formData.endTime,
    numGuests: formData.numGuests,
    acceptedBookings,
    excludeBookingId: booking?.id,
  })

  // Initialize form when booking changes
  React.useEffect(() => {
    if (booking) {
      const date = booking.desired_date
      const startTimeRaw = booking.desired_time || '20:00'
      
      // Normalize minutes to 00 or 30
      const [startHours, startMinutes] = startTimeRaw.split(':').map(Number)
      const normalizedStartMinutes = startMinutes === 0 || startMinutes === 30 ? startMinutes : 0
      const startTime = `${startHours.toString().padStart(2, '0')}:${normalizedStartMinutes.toString().padStart(2, '0')}`
      
      // Calculate end time (default +3 hours) with normalized minutes via helper
      const endTime = calculateEndTimeFromStart(startTime)

      setFormData({
        date: date,
        startTime,
        endTime,
        numGuests: booking.num_guests,
      })
      setErrors({})
    }
  }, [booking])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.date) {
      newErrors.date = 'Data richiesta'
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Orario inizio richiesto'
    }

    if (!formData.endTime) {
      newErrors.endTime = 'Orario fine richiesto'
    }

    if (formData.numGuests < 1) {
      newErrors.numGuests = 'Numero ospiti minimo 1'
    }

    // Check if end time is before start time (convert to Date for proper comparison)
    if (formData.startTime && formData.endTime) {
      const startHour = parseInt(formData.startTime.split(':')[0])
      const endHour = parseInt(formData.endTime.split(':')[0])
      const startMin = parseInt(formData.startTime.split(':')[1])
      const endMin = parseInt(formData.endTime.split(':')[1])
      
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin
      
      // Check if end time is before start time (handling midnight crossover)
      // If start is late (22:00+) and end is early (00:00-06:00), it's valid
      const isCrossMidnight = startHour >= 22 && endHour <= 6
      
      if (!isCrossMidnight && endMinutes <= startMinutes) {
        newErrors.endTime = 'Orario fine deve essere dopo orario inizio'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    
    if (!validate() || !booking) {
      console.error('❌ [AcceptModal] Validation failed or no booking')
      return
    }

    // Check capacity before submitting - show modal if capacity exceeded
    if (!capacityCheck.isAvailable && capacityCheck.exceededSlots && capacityCheck.exceededSlots.length > 0) {
      setShowCapacityWarning(true)
      return
    }

    // If capacity check failed but no exceeded slots, proceed anyway (never block)
    if (!capacityCheck.isAvailable) {
      console.warn('⚠️ [AcceptModal] Capacity check failed but no slot details available, proceeding anyway')
      toast.warn('⚠️ Attenzione: la capienza potrebbe essere superata. La prenotazione verrà comunque accettata.')
    }
    
    confirmBooking()
  }

  const confirmBooking = () => {
    // Create ISO strings handling midnight crossover
    const confirmedStart = createBookingDateTime(formData.date, formData.startTime, true)
    const confirmedEnd = createBookingDateTime(formData.date, formData.endTime, false, formData.startTime)
    

    onConfirm({
      confirmedStart,
      confirmedEnd,
      numGuests: formData.numGuests,
      desiredTime: formData.startTime,
    })
  }

  if (!booking) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Accetta Prenotazione"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Cliente:</strong> {booking.client_name}<br />
            <strong>Evento:</strong> {booking.event_type}<br />
            <strong>Data richiesta:</strong> {format(new Date(booking.desired_date), 'dd/MM/yyyy')}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Data confermata *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => {
              setFormData({ ...formData, date: e.target.value })
              setErrors({ ...errors, date: '' })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
            required
          />
          {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Orario inizio *</label>
            <TimePicker24h
              id="accept_start_time"
              value={formData.startTime}
              onChange={(v) => {
                setFormData({ ...formData, startTime: v })
                setErrors({ ...errors, startTime: '' })
              }}
              className="rounded-md border-gray-300 bg-white px-3 py-2 text-gray-900 focus-within:ring-primary-600"
              required
            />
            {errors.startTime && <p className="text-sm text-red-500">{errors.startTime}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Orario fine *</label>
            <TimePicker24h
              id="accept_end_time"
              value={formData.endTime}
              onChange={(v) => {
                setFormData({ ...formData, endTime: v })
                setErrors({ ...errors, endTime: '' })
              }}
              className="rounded-md border-gray-300 bg-white px-3 py-2 text-gray-900 focus-within:ring-primary-600"
              required
            />
            {errors.endTime && <p className="text-sm text-red-500">{errors.endTime}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Numero ospiti *</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={formData.numGuests > 0 ? formData.numGuests.toString() : ''}
            onChange={(e) => {
              const value = e.target.value === '' ? 0 : Number(e.target.value) || 0
              setFormData({ ...formData, numGuests: value })
              setErrors({ ...errors, numGuests: '' })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
            required
          />
          {errors.numGuests && <p className="text-sm text-red-500">{errors.numGuests}</p>}
        </div>

        {/* Capacity Warning - mostra solo se data, ora e numero ospiti sono compilati */}
        {capacityCheck.errorMessage && formData.date && formData.startTime && formData.numGuests > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 isolate">
            <div className="flex items-start gap-2">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800 mb-1">
                  Capacità insufficiente
                </p>
                <p className="text-sm text-red-700">
                  {capacityCheck.errorMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            disabled={isLoading}
          >
            Annulla
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Conferma...' : '✅ Conferma Prenotazione'}
          </button>
        </div>
      </form>

      {/* Capacity Warning Modal */}
      {capacityCheck.exceededSlots && capacityCheck.exceededSlots.length > 0 && (
        <CapacityWarningModal
          isOpen={showCapacityWarning}
          onClose={() => setShowCapacityWarning(false)}
          onConfirm={() => {
            setShowCapacityWarning(false)
            confirmBooking()
          }}
          onCancel={() => setShowCapacityWarning(false)}
          exceededBy={capacityCheck.exceededSlots[0].exceededBy}
          slotName={capacityCheck.exceededSlots[0].slotName}
          totalOccupied={capacityCheck.exceededSlots[0].totalOccupied}
          capacity={capacityCheck.exceededSlots[0].capacity}
        />
      )}
    </Modal>
  )
}

