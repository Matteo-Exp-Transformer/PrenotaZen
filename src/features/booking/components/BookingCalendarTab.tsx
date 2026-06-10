import React from 'react'
import { useAcceptedBookings } from '../hooks/useBookingQueries'
import { BookingCalendar } from './BookingCalendar'

interface BookingCalendarTabProps {
  initialDate?: string | null
}

export const BookingCalendarTab: React.FC<BookingCalendarTabProps> = ({ initialDate }) => {
  const { data: acceptedBookings, isLoading, error } = useAcceptedBookings()
  const bookings = acceptedBookings ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento calendario...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-medium">Errore nel caricamento del calendario</p>
        <p className="text-red-600 text-sm mt-2">{String(error)}</p>
      </div>
    )
  }

  return <BookingCalendar bookings={bookings} initialDate={initialDate} />
}

