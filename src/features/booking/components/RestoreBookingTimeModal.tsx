import React, { useEffect, useState } from 'react'
import { Modal, TimePicker24h } from '@/components/ui'
import type { BookingRequest } from '@/types/booking'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { calculateEndTimeFromStart, createBookingDateTime } from '../utils/dateUtils'

export interface RestoreBookingTimePayload {
  confirmedStart: string
  confirmedEnd: string
  desiredTime: string
}

interface RestoreBookingTimeModalProps {
  isOpen: boolean
  onClose: () => void
  booking: BookingRequest | null
  onConfirm: (data: RestoreBookingTimePayload) => void
  isLoading?: boolean
}

function normalizeStartTime(raw?: string | null): string {
  const startTimeRaw = raw || '20:00'
  const [startHours, startMinutes] = startTimeRaw.split(':').map(Number)
  const normalizedStartMinutes = startMinutes === 0 || startMinutes === 30 ? startMinutes : 0
  return `${startHours.toString().padStart(2, '0')}:${normalizedStartMinutes.toString().padStart(2, '0')}`
}

export const RestoreBookingTimeModal: React.FC<RestoreBookingTimeModalProps> = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isLoading = false,
}) => {
  const [startTime, setStartTime] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (booking) {
      setStartTime(normalizeStartTime(booking.desired_time))
      setError('')
    }
  }, [booking])

  if (!booking) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!startTime.trim()) {
      setError('Inserisci un orario di inizio')
      return
    }

    const endTimeFormatted = calculateEndTimeFromStart(startTime)
    onConfirm({
      confirmedStart: createBookingDateTime(booking.desired_date, startTime, true),
      confirmedEnd: createBookingDateTime(booking.desired_date, endTimeFormatted, false, startTime),
      desiredTime: startTime,
    })
  }

  const formattedDate = (() => {
    try {
      return format(new Date(booking.desired_date), 'd MMMM yyyy', { locale: it })
    } catch {
      return booking.desired_date
    }
  })()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reinserisci nel calendario">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-700">
          Per reinserire <strong>{booking.client_name}</strong> nel calendario serve un orario di inizio.
        </p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong>Data prenotazione:</strong> {formattedDate}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="restore_start_time" className="text-sm font-medium text-gray-700">
            Orario di inizio *
          </label>
          <TimePicker24h
            id="restore_start_time"
            value={startTime}
            onChange={(v) => {
              setStartTime(v)
              setError('')
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-within:ring-2 focus-within:ring-primary-600"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50"
            disabled={isLoading}
          >
            Annulla
          </button>
          <button
            type="submit"
            className="min-h-[44px] flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Reinserimento…' : 'Reinserisci'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
