import type { Dispatch, SetStateAction } from 'react'
import { toast } from 'react-toastify'
import {
  BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE,
  BOOKING_PUBLIC_CLIENT_TEXT_LIMITS,
  isWithinBookingTextLimit,
} from '../constants/bookingPrenotaTextLimits'
import { dietaryRestrictionsToText } from './dietaryRestrictionsText'
import type { BookingRequestInput } from '@/types/booking'

/** Toast errori form Prenota: top-center, più visibile del laterale admin. */
export const BOOKING_PUBLIC_FORM_ERROR_TOAST_OPTIONS = {
  position: 'top-center' as const,
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
}

export function showBookingPublicFormErrorToast(message: string): void {
  toast.error(message, BOOKING_PUBLIC_FORM_ERROR_TOAST_OPTIONS)
}

export class CreateBookingRequestError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'CreateBookingRequestError'
    this.code = code
  }
}

export function isCreateBookingRequestError(error: unknown): error is CreateBookingRequestError {
  return error instanceof CreateBookingRequestError
}

export interface BookingPublicFormErrorMapping {
  errorKey: string
  inlineMessage: string
  toastMessage: string
  reopenDietaryModal?: boolean
}

export interface InferTextTooLongFieldInput {
  client_name?: string
  client_email?: string
  client_phone?: string | null
  num_guests?: number
  dietary_restrictions?: BookingRequestInput['dietary_restrictions']
  special_requests?: string | null
}

/** Indovina il campo oltre cap quando l'edge risponde solo «Testo troppo lungo». */
export function inferTextTooLongErrorKey(form: InferTextTooLongFieldInput): string {
  const C = BOOKING_PUBLIC_CLIENT_TEXT_LIMITS
  if (!isWithinBookingTextLimit(form.client_name ?? '', C.clientName)) return 'client_name'
  if (
    (form.client_email ?? '').trim() &&
    !isWithinBookingTextLimit(form.client_email ?? '', C.clientEmail)
  ) {
    return 'client_email'
  }
  if (
    form.client_phone &&
    !isWithinBookingTextLimit(form.client_phone, C.clientPhone)
  ) {
    return 'client_phone'
  }
  if (
    dietaryRestrictionsToText(form.dietary_restrictions ?? []).length > C.dietaryText
  ) {
    return 'dietary'
  }
  if (
    (form.special_requests ?? '').length > C.specialRequests
  ) {
    return 'special_requests'
  }
  if ((form.num_guests ?? 0) > C.numGuestsMax) return 'num_guests'
  return 'special_requests'
}

export function mapCreateBookingError(
  errorMessage: string,
  code?: string,
  formContext?: InferTextTooLongFieldInput,
): BookingPublicFormErrorMapping {
  switch (code) {
    case 'SLOT_LIMIT':
      return {
        errorKey: 'desired_time',
        inlineMessage:
          'Questa fascia oraria è al completo per la data scelta. Prova un altro orario o un altro giorno.',
        toastMessage:
          'Fascia piena: prova un altro orario o scegli un altro giorno.',
      }
    case 'OUT_OF_SLOT':
      return {
        errorKey: 'desired_time',
        inlineMessage:
          'L\'orario scelto non rientra negli orari di servizio. Scegli una fascia valida.',
        toastMessage:
          'Orario fuori servizio: scegli un orario disponibile.',
      }
    default:
      break
  }

  const normalized = errorMessage.trim()

  if (normalized === BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE) {
    const errorKey = formContext ? inferTextTooLongErrorKey(formContext) : 'special_requests'
    return {
      errorKey,
      inlineMessage: BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE,
      toastMessage: 'Uno dei testi inseriti è troppo lungo. Accorcialo e riprova.',
    }
  }

  if (
    normalized.includes('Consenso per dati alimentari') ||
    (normalized.toLowerCase().includes('consenso') &&
      normalized.toLowerCase().includes('alimentari'))
  ) {
    return {
      errorKey: 'dietaryConsent',
      inlineMessage:
        'Per inviare le intolleranze devi autorizzare il trattamento dei dati alimentari.',
      toastMessage:
        'Conferma il consenso per le intolleranze alimentari, poi invia di nuovo.',
      reopenDietaryModal: true,
    }
  }

  if (normalized.includes('Troppe richieste') || normalized.includes('troppi tentativi')) {
    return {
      errorKey: 'desired_time',
      inlineMessage: '',
      toastMessage: normalized.includes('24 ore')
        ? 'Accesso temporaneamente bloccato: riprova tra 24 ore.'
        : 'Hai inviato troppe richieste. Attendi un minuto e riprova.',
    }
  }

  if (normalized.includes('Limite annuale')) {
    return {
      errorKey: 'desired_date',
      inlineMessage: '',
      toastMessage:
        'Il locale ha raggiunto il limite annuale di richieste. Contatta il ristorante per assistenza.',
    }
  }

  if (normalized.includes('client_name') || normalized === 'Nome obbligatorio') {
    return {
      errorKey: 'client_name',
      inlineMessage: 'Nome obbligatorio',
      toastMessage: 'Inserisci il tuo nome per inviare la richiesta.',
    }
  }

  if (normalized.includes('num_guests')) {
    return {
      errorKey: 'num_guests',
      inlineMessage: 'Numero ospiti obbligatorio (min 1)',
      toastMessage: 'Indica quante persone partecipano alla prenotazione.',
    }
  }

  if (normalized.includes('desired_date')) {
    return {
      errorKey: 'desired_date',
      inlineMessage: 'Data obbligatoria',
      toastMessage: 'Scegli la data della prenotazione.',
    }
  }

  if (normalized.includes('Organizzazione non trovata')) {
    return {
      errorKey: 'client_name',
      inlineMessage: '',
      toastMessage: 'Pagina non disponibile. Verifica il link o riprova più tardi.',
    }
  }

  if (normalized.includes('Una richiesta è già in corso')) {
    return {
      errorKey: 'client_name',
      inlineMessage: '',
      toastMessage: 'Invio già in corso: attendi qualche secondo prima di riprovare.',
    }
  }

  if (normalized.includes('orari di servizio') || normalized.includes('OUT_OF_SLOT')) {
    return {
      errorKey: 'desired_time',
      inlineMessage:
        'L\'orario scelto non rientra negli orari di servizio. Scegli una fascia valida.',
      toastMessage: 'Orario fuori servizio: scegli un orario disponibile.',
    }
  }

  if (normalized.includes('al completo') || normalized.includes('fascia')) {
    return {
      errorKey: 'desired_time',
      inlineMessage:
        'Questa fascia oraria è al completo per la data scelta. Prova un altro orario o un altro giorno.',
      toastMessage: 'Fascia piena: prova un altro orario o scegli un altro giorno.',
    }
  }

  return {
    errorKey: 'client_name',
    inlineMessage: normalized || 'Invio non riuscito. Controlla i dati e riprova.',
    toastMessage: normalized || 'Invio non riuscito. Controlla i dati e riprova.',
  }
}

export interface ApplyBookingPublicFormErrorParams {
  errorKey: string
  message: string
  toastMessage?: string
  setErrors: Dispatch<SetStateAction<Record<string, string>>>
  focusFirstValidationIssue: (errorKey: string | null) => void
}

/** Triplo feedback: inline + pulse/scroll + toast chiaro. */
export function applyBookingPublicFormError({
  errorKey,
  message,
  toastMessage,
  setErrors,
  focusFirstValidationIssue,
}: ApplyBookingPublicFormErrorParams): void {
  if (message) {
    setErrors((prev) => ({ ...prev, [errorKey]: message }))
  }
  showBookingPublicFormErrorToast(toastMessage ?? message)
  focusFirstValidationIssue(errorKey)
}
