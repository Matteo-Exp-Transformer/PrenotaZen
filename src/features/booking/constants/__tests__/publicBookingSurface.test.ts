// @admin-blindatura: settings-background
// Copre: superficie pubblica Prenota (light = crema #faf7f1) e contrasto testo (surfaceUsesLightText)
import { describe, expect, it } from 'vitest'
import {
  resolvePublicBookingSurface,
  surfaceUsesLightText,
} from '../bookingPublicFieldStyles'

/**
 * FU-014 — blinda la mappa layout → superficie → palette.
 * Equivalenza con il vecchio booleano `!showPhotoStrip && isFullPagePhoto`:
 * testo bianco SOLO su foto a pagina intera senza striscia.
 */
describe('resolvePublicBookingSurface', () => {
  it('striscia attiva → strip (anche con full-page true: XOR, striscia vince)', () => {
    expect(resolvePublicBookingSurface({ showPhotoStrip: true, isFullPagePhoto: false })).toBe('strip')
    expect(resolvePublicBookingSurface({ showPhotoStrip: true, isFullPagePhoto: true })).toBe('strip')
  })

  it('niente striscia + foto full-page → full-page-photo', () => {
    expect(resolvePublicBookingSurface({ showPhotoStrip: false, isFullPagePhoto: true })).toBe(
      'full-page-photo',
    )
  })

  it('niente striscia, niente full-page → light (crema neutra, D-M2: niente gradiente/tile)', () => {
    expect(resolvePublicBookingSurface({ showPhotoStrip: false, isFullPagePhoto: false })).toBe('light')
  })

  it('legacy in DB (parse null) + niente striscia → light, non full-page-photo', () => {
    const surface = resolvePublicBookingSurface({ showPhotoStrip: false, isFullPagePhoto: false })
    expect(surface).toBe('light')
    expect(surfaceUsesLightText(surface)).toBe(false)
  })
})

describe('surfaceUsesLightText', () => {
  it('bianco solo su full-page-photo e dark', () => {
    expect(surfaceUsesLightText('full-page-photo')).toBe(true)
    expect(surfaceUsesLightText('dark')).toBe(true)
    expect(surfaceUsesLightText('strip')).toBe(false)
    expect(surfaceUsesLightText('light')).toBe(false)
  })

  it('equivale al vecchio booleano !showPhotoStrip && isFullPagePhoto', () => {
    for (const showPhotoStrip of [true, false]) {
      for (const isFullPagePhoto of [true, false]) {
        const legacy = !showPhotoStrip && isFullPagePhoto
        const surface = resolvePublicBookingSurface({ showPhotoStrip, isFullPagePhoto })
        expect(surfaceUsesLightText(surface)).toBe(legacy)
      }
    }
  })
})
