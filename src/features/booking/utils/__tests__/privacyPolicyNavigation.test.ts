import { describe, expect, it } from 'vitest'
import {
  buildPrenotaReturnPath,
  buildPrivacyPolicyLink,
  isValidPrivacyReturnPath,
  resolvePrivacyBackAction,
  resolvePrivacyReturnPath,
} from '../privacyPolicyNavigation'

describe('privacyPolicyNavigation', () => {
  it('builds prenota return path from tenant slug', () => {
    expect(buildPrenotaReturnPath('demo-slug')).toBe('/prenota/demo-slug')
    expect(buildPrenotaReturnPath(undefined)).toBeUndefined()
  })

  it('builds privacy link with encoded from query', () => {
    expect(buildPrivacyPolicyLink('/prenota/demo-slug')).toBe(
      '/privacy?from=%2Fprenota%2Fdemo-slug',
    )
    expect(buildPrivacyPolicyLink('https://evil.example')).toBe('/privacy')
  })

  it('accepts only internal prenota paths', () => {
    expect(isValidPrivacyReturnPath('/prenota/demo-slug')).toBe(true)
    expect(isValidPrivacyReturnPath('/')).toBe(false)
    expect(isValidPrivacyReturnPath('https://evil.example')).toBe(false)
    expect(isValidPrivacyReturnPath('/prenota/demo/slug')).toBe(false)
  })

  it('resolves return path from query or router state', () => {
    expect(resolvePrivacyReturnPath('?from=%2Fprenota%2Fdemo-slug', null)).toBe(
      '/prenota/demo-slug',
    )
    expect(resolvePrivacyReturnPath('', { from: '/prenota/demo-slug' })).toBe(
      '/prenota/demo-slug',
    )
    expect(resolvePrivacyReturnPath('?from=https://evil.example', null)).toBeNull()
    expect(resolvePrivacyReturnPath('', null)).toBeNull()
  })

  it('prefers history back when privacy was opened in-app from prenota (same tab)', () => {
    expect(
      resolvePrivacyBackAction('/prenota/demo-slug', {
        historyLength: 2,
        locationKey: 'abc123',
      }),
    ).toEqual({ kind: 'history-back' })
  })

  it('replaces to return path on a fresh standalone /privacy visit (no stacked entry)', () => {
    expect(
      resolvePrivacyBackAction('/prenota/demo-slug', {
        historyLength: 1,
        locationKey: 'default',
      }),
    ).toEqual({ kind: 'replace', path: '/prenota/demo-slug' })
  })

  it('navigates home when privacy opened without return path', () => {
    expect(
      resolvePrivacyBackAction(null, {
        historyLength: 1,
        locationKey: 'default',
      }),
    ).toEqual({ kind: 'navigate', path: '/' })
  })
})
