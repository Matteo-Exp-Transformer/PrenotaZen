// @admin-blindatura: settings-background
// Copre: resolver unico layout, XOR striscia/full-page, parse legacy → neutro, dirty admin

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BOOKING_FULL_PAGE_BACKGROUND,
  hydrateAdminBookingBackgroundEditor,
  isAdminBookingBackgroundDirty,
  parseBookingPageBackgroundFromDb,
  resolvePublicBookingPageLayout,
} from '../../constants/bookingPageBackground'
import { surfaceUsesLightText } from '../../constants/bookingPublicFieldStyles'
import { restaurantSettingRegistry } from '../restaurantSettingRegistry'

const bgEntry = restaurantSettingRegistry.public_booking_page_background
const stripEntry = restaurantSettingRegistry.public_booking_strip_photo

describe('settings-background — parse legacy → neutro sicuro', () => {
  it('full-01…04 validi; gradiente/tile/unknown → null', () => {
    expect(parseBookingPageBackgroundFromDb('full-01')).toBe('full-01')
    expect(parseBookingPageBackgroundFromDb('full-04')).toBe('full-04')
    expect(parseBookingPageBackgroundFromDb('noce-classico')).toBeNull()
    expect(parseBookingPageBackgroundFromDb('terracotta-viva')).toBeNull()
    expect(parseBookingPageBackgroundFromDb('tile-01')).toBeNull()
    expect(parseBookingPageBackgroundFromDb('tile-21')).toBeNull()
    expect(parseBookingPageBackgroundFromDb('gradient-foo')).toBeNull()
    expect(parseBookingPageBackgroundFromDb('strip-01')).toBeNull()
    expect(parseBookingPageBackgroundFromDb(null)).toBeNull()
    expect(parseBookingPageBackgroundFromDb('')).toBeNull()
  })

  it('registry parseFromDb allinea parseBookingPageBackgroundFromDb', () => {
    expect(bgEntry.parseFromDb('noce-classico')).toBeNull()
    expect(bgEntry.parseFromDb('tile-05')).toBeNull()
    expect(bgEntry.parseFromDb('full-02')).toBe('full-02')
  })

  it('validate accetta solo full-NN', () => {
    expect(bgEntry.validate('full-03')).toBeNull()
    expect(bgEntry.validate('noce-classico')).not.toBeNull()
    expect(bgEntry.validate('tile-01')).not.toBeNull()
  })
})

describe('settings-background — resolvePublicBookingPageLayout (contratto unico)', () => {
  it('striscia vince su full-page in DB', () => {
    const layout = resolvePublicBookingPageLayout({
      pageBackground: 'full-02',
      stripPhotoId: 'strip-01',
    })
    expect(layout.mode).toBe('strip')
    expect(layout.fullPagePhotoId).toBeNull()
    expect(layout.surface).toBe('strip')
    expect(surfaceUsesLightText(layout.surface)).toBe(false)
  })

  it('full-page senza striscia', () => {
    const layout = resolvePublicBookingPageLayout({
      pageBackground: 'full-03',
      stripPhotoId: null,
    })
    expect(layout.mode).toBe('full-page')
    expect(layout.fullPagePhotoId).toBe('full-03')
    expect(layout.surface).toBe('full-page-photo')
    expect(surfaceUsesLightText(layout.surface)).toBe(true)
  })

  it('legacy gradiente (parse null) → neutral + crema', () => {
    const legacy = parseBookingPageBackgroundFromDb('noce-classico')
    const layout = resolvePublicBookingPageLayout({
      pageBackground: legacy,
      stripPhotoId: null,
    })
    expect(layout.mode).toBe('neutral')
    expect(layout.fullPagePhotoId).toBeNull()
    expect(layout.surface).toBe('light')
    expect(layout.rootBackgroundColor).toBe('#faf7f1')
  })

  it('strip null serializza come stringa vuota (NOT NULL DB)', () => {
    expect(stripEntry.serializeToDb(null)).toBe('')
    expect(stripEntry.parseFromDb('')).toBeNull()
  })
})

describe('settings-background — admin hydrate e dirty', () => {
  it('hydrate legacy null: editor mostra default anteprima, dirty false vs DB', () => {
    const editor = hydrateAdminBookingBackgroundEditor({
      stripPhotoId: null,
      pageBackground: null,
    })
    expect(editor.mode).toBe('full')
    expect(editor.pageBackground).toBe(DEFAULT_BOOKING_FULL_PAGE_BACKGROUND)
    expect(
      isAdminBookingBackgroundDirty(
        { stripPhotoId: null, pageBackground: null },
        editor,
      ),
    ).toBe(false)
  })

  it('dirty solo se l’utente cambia striscia o full-page', () => {
    expect(
      isAdminBookingBackgroundDirty(
        { stripPhotoId: 'strip-02', pageBackground: 'full-01' },
        { stripPhoto: 'strip-03', pageBackground: 'full-01' },
      ),
    ).toBe(true)
    expect(
      isAdminBookingBackgroundDirty(
        { stripPhotoId: null, pageBackground: 'full-02' },
        { stripPhoto: null, pageBackground: 'full-03' },
      ),
    ).toBe(true)
  })
})
