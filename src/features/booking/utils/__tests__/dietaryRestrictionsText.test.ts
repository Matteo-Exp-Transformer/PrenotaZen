import { describe, expect, it } from 'vitest'
import {
  dietaryRestrictionsToText,
  dietaryTextToRestrictions,
  normalizeDietaryRestrictionsForSubmit,
  shouldShowDietaryGuestCount,
  formatDietaryGuestCountLabel,
} from '../dietaryRestrictionsText'

describe('dietaryRestrictionsText', () => {
  it('preserves trailing spaces while typing (onChange round-trip)', () => {
    const text = 'celiachia '
    const restrictions = dietaryTextToRestrictions(text)
    expect(dietaryRestrictionsToText(restrictions)).toBe('celiachia ')
  })

  it('preserves spaces between words', () => {
    const text = 'no glutine e lattosio'
    const restrictions = dietaryTextToRestrictions(text)
    expect(dietaryRestrictionsToText(restrictions)).toBe(text)
  })

  it('trims only on submit', () => {
    const restrictions = dietaryTextToRestrictions('  celiachia  ')
    expect(normalizeDietaryRestrictionsForSubmit(restrictions)).toEqual([
      { restriction: 'celiachia', guest_count: 0 },
    ])
  })

  it('uses guest_count 0 for free-text public submissions', () => {
    expect(dietaryTextToRestrictions('no glutine')).toEqual([
      { restriction: 'no glutine', guest_count: 0 },
    ])
  })

  it('shouldShowDietaryGuestCount is true only when guest_count >= 1', () => {
    expect(shouldShowDietaryGuestCount({ guest_count: 0 })).toBe(false)
    expect(shouldShowDietaryGuestCount({ guest_count: 1 })).toBe(true)
    expect(shouldShowDietaryGuestCount({ guest_count: 3 })).toBe(true)
  })

  it('formatDietaryGuestCountLabel uses singular/plural', () => {
    expect(formatDietaryGuestCountLabel(1)).toBe('1 ospite')
    expect(formatDietaryGuestCountLabel(2)).toBe('2 ospiti')
  })

  it('returns empty array for whitespace-only input', () => {
    expect(dietaryTextToRestrictions('   ')).toEqual([])
  })
})
