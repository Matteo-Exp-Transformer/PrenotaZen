// @prenota-blindatura: flusso-utente
// Verifica che errorKey 'menu' risolva sempre un elemento DOM esistente —
// sia che la sezione menù sia visibile (div#menu-section) sia che non lo sia (span#menu-section).

import { describe, it, expect, afterEach } from 'vitest'
import {
  BOOKING_PUBLIC_ERROR_FIELD_IDS,
  resolveBookingPublicErrorElementId,
} from '../bookingPublicFormAttention'

function createEl(id: string, tag = 'div'): HTMLElement {
  const el = document.createElement(tag)
  el.id = id
  document.body.appendChild(el)
  return el
}

describe('BOOKING_PUBLIC_ERROR_FIELD_IDS — menu', () => {
  it("mappa 'menu' → 'menu-section'", () => {
    expect(BOOKING_PUBLIC_ERROR_FIELD_IDS['menu']).toBe('menu-section')
  })
})

describe('resolveBookingPublicErrorElementId — menu', () => {
  let el: HTMLElement | null = null

  afterEach(() => {
    if (el) {
      el.remove()
      el = null
    }
    document.getElementById('booking-sub-tabs-section')?.remove()
  })

  it('restituisce menu-section quando il div è nel DOM (showMenuSelectionSection=true)', () => {
    el = createEl('menu-section')
    expect(resolveBookingPublicErrorElementId('menu')).toBe('menu-section')
  })

  it('cade su booking-sub-tabs-section quando menu-section non è nel DOM (showMenuSelectionSection=false)', () => {
    createEl('booking-sub-tabs-section')
    expect(resolveBookingPublicErrorElementId('menu')).toBe('booking-sub-tabs-section')
  })

  it('con anchor span#menu-section nel DOM (fix caso 1) — risolve menu-section', () => {
    el = createEl('menu-section', 'span')
    expect(resolveBookingPublicErrorElementId('menu')).toBe('menu-section')
  })
})
