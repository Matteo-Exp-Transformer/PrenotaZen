import { describe, expect, it } from 'vitest'
import {
  buildPrenotaReturnPath,
  buildPrivacyPolicyLink,
  isValidPrivacyReturnPath,
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
})
