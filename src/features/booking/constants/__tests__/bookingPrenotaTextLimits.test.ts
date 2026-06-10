import { describe, expect, it } from 'vitest'
import {
  BOOKING_MENU_COMPOSE_TEXT_LIMITS,
  BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS,
  BOOKING_PUBLIC_CLIENT_TEXT_LIMITS,
  clampBookingText,
  getDietaryRestrictionsTextLength,
  isWithinBookingTextLimit,
  normalizeBookingHeaderFontSizeForTarget,
} from '../bookingPrenotaTextLimits'

describe('bookingPrenotaTextLimits', () => {
  it('restaurantName max 40', () => {
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName).toBe(40)
    expect(clampBookingText('x'.repeat(50), BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName)).toHaveLength(
      40,
    )
  })

  it('clampBookingText tronca oltre max', () => {
    expect(clampBookingText('abcdef', 4)).toBe('abcd')
  })

  it('BOOKING_MENU_COMPOSE_TEXT_LIMITS allineato a sottotab (24/24/79)', () => {
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).toBe(79)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
    )
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription,
    )
  })

  it('clamp compose ingredienti tronca legacy oltre cap', () => {
    const longName = 'n'.repeat(30)
    const longDesc = 'd'.repeat(90)
    expect(clampBookingText(longName, BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName)).toHaveLength(24)
    expect(clampBookingText(longDesc, BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription)).toHaveLength(79)
  })

  it('isWithinBookingTextLimit', () => {
    expect(isWithinBookingTextLimit('a', BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName)).toBe(true)
    expect(isWithinBookingTextLimit('x'.repeat(66), BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName)).toBe(
      false,
    )
  })

  it('getDietaryRestrictionsTextLength somma restriction e notes', () => {
    expect(
      getDietaryRestrictionsTextLength([{ restriction: 'Glutine', notes: ' leggero' }]),
    ).toBe('Glutine'.length + 'leggero'.length)
  })

  it('page_description fontSize max 28', () => {
    expect(
      normalizeBookingHeaderFontSizeForTarget(50, 'page_description', 16),
    ).toBe(28)
    expect(
      normalizeBookingHeaderFontSizeForTarget(29, 'page_description', 16),
    ).toBe(28)
    expect(
      normalizeBookingHeaderFontSizeForTarget(28, 'page_description', 16),
    ).toBe(28)
    expect(
      normalizeBookingHeaderFontSizeForTarget(50, 'page_title', 30),
    ).toBe(38)
  })
})
