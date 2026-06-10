import { describe, expect, it } from 'vitest'
import {
  dietaryRestrictionsToText,
  dietaryTextToRestrictions,
  normalizeDietaryRestrictionsForSubmit,
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
      { restriction: 'celiachia', guest_count: 1 },
    ])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(dietaryTextToRestrictions('   ')).toEqual([])
  })
})
