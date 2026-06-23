import React from 'react'
import type { BookingRequestInput } from '@/types/booking'
import type { BusinessHours } from '@/lib/businessHours'
import { isValidBookingDateTime, getDayOfWeek, formatHours, buildClosedDayMessage } from '@/lib/businessHours'
import { BookingPublicInsetField } from './BookingPublicInsetField'
import {
  BookingPublicDatePickerField,
  BookingPublicTimePickerField,
} from './BookingPublicDateTimePickers'
import { getCurrentTimeHHMM, getTodayIso } from '../../utils/bookingPublicDateHelpers'
import {
  BOOKING_PUBLIC_CLIENT_TEXT_LIMITS,
} from '../../constants/bookingPrenotaTextLimits'
import {
  publicFormDateTimeErrorClass,
  publicFormFieldErrorClass,
} from '../../constants/bookingPublicFieldStyles'

const C = BOOKING_PUBLIC_CLIENT_TEXT_LIMITS

interface BookingFormFieldsProps {
  formData: Pick<
    BookingRequestInput,
    | 'client_name'
    | 'client_email'
    | 'client_phone'
    | 'desired_date'
    | 'desired_time'
    | 'num_guests'
  >
  errors: Record<string, string>
  businessHours?: BusinessHours | null
  isLoadingHours?: boolean
  hoursError?: unknown
  frostedInputCn?: string
  /** Chiave del primo campo in errore — lampeggio attenzione. */
  attentionFieldKey?: string | null
  onClearAttention?: () => void
  onFieldChange: (field: string, value: string | number) => void
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onNumGuestsChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onNumGuestsKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void
  setErrors: (errors: Record<string, string>) => void
  /** Testo errore in bianco solo su sfondo full-page foto. */
  lightTextOnDarkBackground?: boolean
  slotGroups?: Array<{ slotId: string; slotName: string; times: string[] }>
}

export const BookingFormFields: React.FC<BookingFormFieldsProps> = ({
  formData,
  errors,
  businessHours,
  isLoadingHours,
  hoursError,
  onFieldChange,
  attentionFieldKey = null,
  onClearAttention,
  onDateChange,
  onTimeChange,
  onNumGuestsChange,
  onNumGuestsKeyPress,
  setErrors,
  lightTextOnDarkBackground = false,
  slotGroups,
}) => {
  const isDateToday = formData.desired_date === getTodayIso()
  // Ora minima selezionabile: solo se la data è oggi, blocca le ore passate
  const minTimeToday = isDateToday ? getCurrentTimeHHMM() : undefined

  const validateDateTime = (date: string, time: string): string | null => {
    if (!date || !time) return null
    // Blocca data+ora nel passato
    const todayIso = getTodayIso()
    if (date < todayIso) return 'Non puoi selezionare una data passata'
    if (date === todayIso && time < getCurrentTimeHHMM()) return "L'orario selezionato è già passato"
    // Valida orari di apertura ristorante
    if (!businessHours || isLoadingHours || hoursError) return null
    if (!isValidBookingDateTime(date, time, businessHours)) {
      const dayName = getDayOfWeek(date)
      const dayHours = businessHours[dayName]
      if (!dayHours || dayHours.length === 0) return buildClosedDayMessage(date, businessHours)
      return `Orario non valido. Orari disponibili: ${formatHours(dayHours)}`
    }
    return null
  }

  const handleDateChange = (newDate: string) => {
    onDateChange(newDate)
    // Giorno chiuso: avvisa subito (anche senza orario scelto) e proponi il primo giorno aperto.
    if (newDate && businessHours && !isLoadingHours && !hoursError) {
      const dayHours = businessHours[getDayOfWeek(newDate)]
      if (!dayHours || dayHours.length === 0) {
        setErrors({ ...errors, desired_date: buildClosedDayMessage(newDate, businessHours), desired_time: '' })
        return
      }
    }
    const timeError = newDate && formData.desired_time
      ? validateDateTime(newDate, formData.desired_time)
      : null
    if (timeError) {
      const dayName = businessHours ? getDayOfWeek(newDate) : null
      const dayHours = businessHours && dayName ? businessHours[dayName] : null
      if (dayHours === null || (Array.isArray(dayHours) && dayHours.length === 0)) {
        setErrors({ ...errors, desired_date: timeError, desired_time: '' })
      } else {
        setErrors({ ...errors, desired_date: '', desired_time: timeError })
      }
    } else {
      setErrors({ ...errors, desired_date: '', desired_time: '' })
    }
  }

  const handleTimeChange = (newTime: string) => {
    onTimeChange(newTime)
    const timeError = formData.desired_date && newTime
      ? validateDateTime(formData.desired_date, newTime)
      : null
    if (timeError) {
      const dayName = businessHours && formData.desired_date ? getDayOfWeek(formData.desired_date) : null
      const dayHours = businessHours && dayName ? businessHours[dayName] : null
      if (dayHours === null || (Array.isArray(dayHours) && dayHours.length === 0)) {
        setErrors({ ...errors, desired_date: timeError, desired_time: '' })
      } else {
        setErrors({ ...errors, desired_date: '', desired_time: timeError })
      }
    } else {
      setErrors({ ...errors, desired_date: '', desired_time: '' })
    }
  }

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1">
        <BookingPublicInsetField
          id="client_name"
          label="Nome Completo *"
          value={formData.client_name}
          autoComplete="name"
          maxLength={C.clientName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onFieldChange('client_name', e.target.value.slice(0, C.clientName))
            setErrors({ ...errors, client_name: '' })
          }}
          required
          hasError={!!errors.client_name}
          showAttention={attentionFieldKey === 'client_name'}
          onAttentionInteract={onClearAttention}
        />
        {errors.client_name && (
          <p id="client_name-error" className={publicFormFieldErrorClass(lightTextOnDarkBackground)}>{errors.client_name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <BookingPublicTimePickerField
            id="desired_time"
            label="Ora *"
            value={formData.desired_time || ''}
            onChange={handleTimeChange}
            required
            hasError={!!errors.desired_time}
            showAttention={attentionFieldKey === 'desired_time'}
            onAttentionInteract={onClearAttention}
            minTime={minTimeToday}
            slotGroups={slotGroups}
          />
          {errors.desired_time && (
            <div id="desired_time-error" className={publicFormDateTimeErrorClass(lightTextOnDarkBackground)}>
              {errors.desired_time}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <BookingPublicInsetField
            id="num_guests"
            label="Ospiti *"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={3}
            value={formData.num_guests > 0 ? formData.num_guests.toString() : ''}
            onChange={onNumGuestsChange}
            onKeyPress={onNumGuestsKeyPress}
            required
            hasError={!!errors.num_guests}
            showAttention={attentionFieldKey === 'num_guests'}
            onAttentionInteract={onClearAttention}
          />
          {errors.num_guests && (
            <p id="num_guests-error" className={publicFormFieldErrorClass(lightTextOnDarkBackground)}>{errors.num_guests}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <BookingPublicInsetField
          id="client_phone"
          label="Telefono *"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={C.clientPhone}
          value={formData.client_phone ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onFieldChange('client_phone', e.target.value.slice(0, C.clientPhone))
            setErrors({ ...errors, client_phone: '' })
          }}
          required
          hasError={!!errors.client_phone}
          showAttention={attentionFieldKey === 'client_phone'}
          onAttentionInteract={onClearAttention}
        />
        {errors.client_phone && (
          <p id="client_phone-error" className={publicFormFieldErrorClass(lightTextOnDarkBackground)}>{errors.client_phone}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_7rem] sm:items-start sm:gap-3">
        <div className="min-w-0 space-y-1">
          <BookingPublicDatePickerField
            id="desired_date"
            label="Data *"
            value={formData.desired_date}
            onChange={handleDateChange}
            required
            hasError={!!errors.desired_date}
            showAttention={attentionFieldKey === 'desired_date'}
            onAttentionInteract={onClearAttention}
          />
          {errors.desired_date && (
            <div id="desired_date-error" className={publicFormDateTimeErrorClass(lightTextOnDarkBackground)}>
              {errors.desired_date}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-1 sm:col-span-2">
          <BookingPublicInsetField
            id="client_email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={C.clientEmail}
            value={formData.client_email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onFieldChange('client_email', e.target.value.slice(0, C.clientEmail))
              setErrors({ ...errors, client_email: '' })
            }}
            hasError={!!errors.client_email}
            showAttention={attentionFieldKey === 'client_email'}
            onAttentionInteract={onClearAttention}
          />
          {errors.client_email && (
            <p id="client_email-error" className={publicFormFieldErrorClass(lightTextOnDarkBackground)}>{errors.client_email}</p>
          )}
        </div>
      </div>
    </div>
  )
}
