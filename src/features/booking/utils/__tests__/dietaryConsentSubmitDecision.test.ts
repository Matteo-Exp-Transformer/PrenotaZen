import { describe, expect, it } from 'vitest'

type DietarySubmitAction =
  | 'intercept'
  | 'submit-with-consent'
  | 'submit-off-platform'
  | 'submit-clean'

function resolveDietarySubmitAction(
  dietaryText: string,
  dietaryConsent: boolean,
  offPlatform: boolean,
): DietarySubmitAction {
  const hasDietary = dietaryText.trim().length > 0
  if (!hasDietary) return 'submit-clean'
  if (offPlatform) return 'submit-off-platform'
  if (dietaryConsent) return 'submit-with-consent'
  return 'intercept'
}

describe('resolveDietarySubmitAction', () => {
  it('submit-clean se campo dietary vuoto', () => {
    expect(resolveDietarySubmitAction('', false, false)).toBe('submit-clean')
    expect(resolveDietarySubmitAction('   ', false, false)).toBe('submit-clean')
  })

  it('intercept se dietary presente ma nessun consenso', () => {
    expect(resolveDietarySubmitAction('glutine', false, false)).toBe('intercept')
  })

  it('submit-with-consent se dietary presente e consenso già dato', () => {
    expect(resolveDietarySubmitAction('glutine', true, false)).toBe('submit-with-consent')
  })

  it('submit-off-platform se offPlatform=true (indipendentemente da consent)', () => {
    expect(resolveDietarySubmitAction('glutine', false, true)).toBe('submit-off-platform')
    expect(resolveDietarySubmitAction('glutine', true, true)).toBe('submit-off-platform')
  })

  it('submit-clean con offPlatform ma campo vuoto', () => {
    expect(resolveDietarySubmitAction('', false, true)).toBe('submit-clean')
  })
})
