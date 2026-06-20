import { describe, expect, it } from 'vitest'
import type { BookingRequest } from '@/types/booking'
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/features/booking/constants/bookingPublicFormConfig'
import {
  buildCustomerBookingHistoryRow,
  DIETARY_NO_CONSENT_MESSAGE,
  hasDietaryRestrictionsFilled,
  sortBookingsByCreatedAtDesc,
} from '../customerBookingHistoryDisplay'
import { formatItalianDateDisplay } from '../formatItalianDateDisplay'

function booking(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    id: 'b1',
    tenant_id: 't1',
    client_name: 'Mario',
    client_email: 'm@example.com',
    desired_date: '2026-06-27',
    created_at: '2026-06-20T10:00:00Z',
    updated_at: '2026-06-20T10:00:00Z',
    status: 'accepted',
    num_guests: 4,
    ...overrides,
  } as BookingRequest
}

describe('formatItalianDateDisplay', () => {
  it('formatta YYYY-MM-DD come GG/MM/AAAA', () => {
    expect(formatItalianDateDisplay('2026-06-27')).toBe('27/06/2026')
  })

  it('formatta ISO timestamptz come GG/MM/AAAA', () => {
    expect(formatItalianDateDisplay('2026-06-20T10:00:00Z')).toMatch(/20\/06\/2026/)
  })
})

describe('sortBookingsByCreatedAtDesc', () => {
  it('ordina per created_at decrescente', () => {
    const sorted = sortBookingsByCreatedAtDesc([
      booking({ id: 'old', created_at: '2026-01-01T10:00:00Z' }),
      booking({ id: 'new', created_at: '2026-06-20T10:00:00Z' }),
    ])
    expect(sorted.map((b) => b.id)).toEqual(['new', 'old'])
  })
})

describe('buildCustomerBookingHistoryRow — intolleranze art. 9', () => {
  const modes = DEFAULT_BOOKING_FORM_CONFIG.booking_modes

  it('campo vuoto → hasDietary false', () => {
    const b = booking({ dietary_restrictions: [] })
    expect(hasDietaryRestrictionsFilled(b)).toBe(false)
    const row = buildCustomerBookingHistoryRow(b, modes, [])
    expect(row.hasDietary).toBe(false)
  })

  it('campo compilato con consenso → testo disponibile', () => {
    const b = booking({
      dietary_restrictions: [{ restriction: 'Celiachia', guest_count: 0 }],
      dietary_data_consent: true,
    })
    const row = buildCustomerBookingHistoryRow(b, modes, [])
    expect(row.hasDietary).toBe(true)
    expect(row.dietaryConsent).toBe(true)
    expect(row.dietaryText).toContain('Celiachia')
  })

  it('campo compilato senza consenso → flag consent false', () => {
    const b = booking({
      dietary_restrictions: [{ restriction: 'Celiachia', guest_count: 0 }],
      dietary_data_consent: false,
    })
    const row = buildCustomerBookingHistoryRow(b, modes, [])
    expect(row.hasDietary).toBe(true)
    expect(row.dietaryConsent).toBe(false)
    expect(DIETARY_NO_CONSENT_MESSAGE).toContain('non ha autorizzato')
  })
})
