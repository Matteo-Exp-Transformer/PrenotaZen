import { describe, it, expect } from 'vitest'
import type { BookingRequest } from '@/types/booking'
import {
  formatEuroAmountForDisplay,
  getResolvedMenuPriceDisplay,
} from '../menuPricing'

const baseBooking = (overrides: Partial<BookingRequest> = {}): BookingRequest => ({
  id: 'test-id',
  created_at: '2026-05-29T00:00:00Z',
  updated_at: '2026-05-29T00:00:00Z',
  client_name: 'Test',
  client_email: 'test@example.com',
  event_type: 'laurea',
  desired_date: '2026-06-01',
  num_guests: 10,
  status: 'pending',
  tenant_id: 'tenant-id',
  ...overrides,
})

describe('formatEuroAmountForDisplay', () => {
  it('formatta migliaia con apostrofo (regressione label INC-07)', () => {
    expect(formatEuroAmountForDisplay(2425)).toBe("2'425.00")
    expect(formatEuroAmountForDisplay(13.98)).toBe('13.98')
  })
})

describe('getResolvedMenuPriceDisplay', () => {
  it('INC-01: items vuoti + menu_total_per_person valorizzato → fromDb, non €0', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      menu_total_per_person: 8,
      menu_total_booking: 168,
      menu_selection: { items: [] },
      num_guests: 21,
    })

    const display = getResolvedMenuPriceDisplay(booking)

    expect(display).not.toBeNull()
    expect(display?.prezzoMenuLabel).toBe('€8.00/persona')
    expect(display?.prezzoTotaleLabel).toBe('€168.00')
    expect(display?.prezzoMenu).toBe(8)
    expect(display?.prezzoTotale).toBe(168)
  })

  it('INC-07: somma items >> menu_total_per_person → fromDb vince', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      menu_total_per_person: 13.98,
      menu_total_booking: 153.78,
      menu_selection: {
        items: [
          { id: '1', name: 'A', price: 16, category: 'antipasti', totalPrice: 16 },
          { id: '2', name: 'B', price: 18, category: 'antipasti', totalPrice: 18 },
          { id: '3', name: 'C', price: 22, category: 'dolci', totalPrice: 22 },
          { id: '4', name: 'D', price: 23, category: 'fritti', totalPrice: 23 },
          { id: '5', name: 'E', price: 23, category: 'primi_piatti', totalPrice: 23 },
          { id: '6', name: 'F', price: 2323, category: 'secondi_piatti', totalPrice: 2323 },
        ],
      },
      num_guests: 11,
    })

    const display = getResolvedMenuPriceDisplay(booking)

    expect(display?.prezzoMenuLabel).toBe('€13.98/persona')
    expect(display?.prezzoTotaleLabel).toBe('€153.78')
    expect(display?.prezzoMenuLabel).not.toContain("2'425")
  })

  it('fallback: senza menu_total_per_person, overlay da somma items', () => {
    const booking = baseBooking({
      booking_type: 'rinfresco_laurea',
      menu_total_per_person: undefined,
      menu_total_booking: undefined,
      menu_selection: {
        items: [
          { id: '1', name: 'Piatto', price: 25, category: 'primi_piatti', totalPrice: 25 },
        ],
      },
      num_guests: 4,
    })

    const display = getResolvedMenuPriceDisplay(booking)

    expect(display?.prezzoMenuLabel).toBe('€25.00/persona')
    expect(display?.prezzoTotaleLabel).toBe('€100.00')
  })

  it('tavolo senza totali menù → null', () => {
    const booking = baseBooking({
      booking_type: 'tavolo',
      menu_selection: { items: [] },
    })

    expect(getResolvedMenuPriceDisplay(booking)).toBeNull()
  })
})
