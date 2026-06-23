// @prenota-blindatura: flusso-utente
import { describe, it, expect } from 'vitest'
import {
  CreateBookingRequestError,
  inferTextTooLongErrorKey,
  mapCreateBookingError,
  BOOKING_PUBLIC_FORM_ERROR_TOAST_OPTIONS,
} from '../bookingPublicFormErrorFeedback'
import { BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE } from '../../constants/bookingPrenotaTextLimits'

describe('mapCreateBookingError', () => {
  it.each(['INVALID_ARRIVAL_STEP', 'CUTOFF_EXPIRED', 'INVALID_DURATION'])(
    '%s → feedback sul campo Ora', (code) => {
      const mapped = mapCreateBookingError('errore slot', code)
      expect(mapped.errorKey).toBe('desired_time')
      expect(mapped.toastMessage.length).toBeGreaterThan(10)
    },
  )
  it('SLOT_LIMIT → desired_time con copy azionabile', () => {
    const mapped = mapCreateBookingError('fascia piena', 'SLOT_LIMIT')
    expect(mapped.errorKey).toBe('desired_time')
    expect(mapped.inlineMessage).toMatch(/altro orario|altro giorno/i)
    expect(mapped.toastMessage).toMatch(/Fascia piena/i)
  })

  it('OUT_OF_SLOT → desired_time', () => {
    const mapped = mapCreateBookingError('fuori servizio', 'OUT_OF_SLOT')
    expect(mapped.errorKey).toBe('desired_time')
    expect(mapped.toastMessage).toMatch(/fuori servizio/i)
  })

  it('consenso alimentari → dietaryConsent + riapri modale', () => {
    const mapped = mapCreateBookingError('Consenso per dati alimentari obbligatorio')
    expect(mapped.errorKey).toBe('dietaryConsent')
    expect(mapped.reopenDietaryModal).toBe(true)
    expect(mapped.toastMessage).toMatch(/intolleranze/i)
  })

  it('Testo troppo lungo → campo inferito dal payload', () => {
    const mapped = mapCreateBookingError(BOOKING_CLIENT_TEXT_TOO_LONG_MESSAGE, undefined, {
      client_name: 'Mario',
      special_requests: 'x'.repeat(600),
    })
    expect(mapped.errorKey).toBe('special_requests')
  })

  it('rate limit → toast chiaro senza inline obbligatorio', () => {
    const mapped = mapCreateBookingError('Troppe richieste. Riprova tra un minuto.')
    expect(mapped.toastMessage).toMatch(/Attendi un minuto/i)
    expect(mapped.inlineMessage).toBe('')
  })
})

describe('inferTextTooLongErrorKey', () => {
  it('preferisce client_name se oltre cap', () => {
    expect(inferTextTooLongErrorKey({ client_name: 'x'.repeat(80) })).toBe('client_name')
  })
})

describe('CreateBookingRequestError', () => {
  it('porta code dalla risposta edge', () => {
    const err = new CreateBookingRequestError('msg', 'SLOT_LIMIT')
    expect(err.code).toBe('SLOT_LIMIT')
    expect(err.message).toBe('msg')
  })
})

describe('BOOKING_PUBLIC_FORM_ERROR_TOAST_OPTIONS', () => {
  it('usa top-center per visibilità sul form pubblico', () => {
    expect(BOOKING_PUBLIC_FORM_ERROR_TOAST_OPTIONS.position).toBe('top-center')
  })
})
