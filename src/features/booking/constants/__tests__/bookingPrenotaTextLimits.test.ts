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
  it('restaurantName max 45', () => {
    expect(BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName).toBe(45)
    expect(clampBookingText('x'.repeat(50), BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.restaurantName)).toHaveLength(
      45,
    )
  })

  it('clampBookingText tronca oltre max', () => {
    expect(clampBookingText('abcdef', 4)).toBe('abcd')
  })

  it('BOOKING_MENU_COMPOSE_TEXT_LIMITS: categoria 24/79, piatto 42/110', () => {
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(24)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryDescription).toBe(79)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName).toBe(42)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).toBe(110)
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel).toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
    )
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryDescription).toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription,
    )
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName).not.toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabLabel,
    )
    expect(BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription).not.toBe(
      BOOKING_PRENOTA_RESTAURANT_TEXT_LIMITS.subTabDescription,
    )
  })

  it('clamp compose: 42/110 interi, tronca solo oltre cap; categoria resta 24/79', () => {
    const nameAtCap = 'n'.repeat(42)
    const descAtCap = 'd'.repeat(110)
    expect(clampBookingText(nameAtCap, BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName)).toBe(nameAtCap)
    expect(clampBookingText(descAtCap, BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription)).toBe(
      descAtCap,
    )
    expect(
      clampBookingText('n'.repeat(50), BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemName),
    ).toHaveLength(42)
    expect(
      clampBookingText('d'.repeat(120), BOOKING_MENU_COMPOSE_TEXT_LIMITS.itemDescription),
    ).toHaveLength(110)
    expect(
      clampBookingText('c'.repeat(30), BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryLabel),
    ).toHaveLength(24)
    expect(
      clampBookingText('c'.repeat(90), BOOKING_MENU_COMPOSE_TEXT_LIMITS.categoryDescription),
    ).toHaveLength(79)
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
