import { describe, expect, it } from 'vitest'
import {
  activeSubTabShowsMenu,
  defaultModeCapabilities,
  modeUsesDietary,
  modeUsesMenu,
  parseModeCapabilities,
} from '../bookingCapabilities'

describe('defaultModeCapabilities (Livello C — comportamento storico)', () => {
  it('tavolo: niente menù né intolleranze', () => {
    expect(defaultModeCapabilities('tavolo')).toEqual({ uses_menu: false, uses_dietary: false })
  })
  it('rinfresco_laurea: menù + intolleranze', () => {
    expect(defaultModeCapabilities('rinfresco_laurea')).toEqual({ uses_menu: true, uses_dietary: true })
  })
  it('menu_prezzo_fisso: menù + intolleranze', () => {
    expect(defaultModeCapabilities('menu_prezzo_fisso')).toEqual({ uses_menu: true, uses_dietary: true })
  })
  it('null/undefined: default niente menù', () => {
    expect(defaultModeCapabilities(null)).toEqual({ uses_menu: false, uses_dietary: false })
    expect(defaultModeCapabilities(undefined)).toEqual({ uses_menu: false, uses_dietary: false })
  })
})

describe('modeUsesMenu / modeUsesDietary (risoluzione A→C)', () => {
  it('senza capabilities: ricade sul default per tipo', () => {
    expect(modeUsesMenu({ booking_type: 'tavolo' })).toBe(false)
    expect(modeUsesMenu({ booking_type: 'rinfresco_laurea' })).toBe(true)
    expect(modeUsesDietary({ booking_type: 'menu_prezzo_fisso' })).toBe(true)
  })
  it('capability esplicita ha priorità sul default', () => {
    // tavolo che ATTIVA il menù
    expect(modeUsesMenu({ booking_type: 'tavolo', capabilities: { uses_menu: true } })).toBe(true)
    // rinfresco che DISATTIVA il menù
    expect(modeUsesMenu({ booking_type: 'rinfresco_laurea', capabilities: { uses_menu: false } })).toBe(false)
    // dietary disaccoppiato dal menù
    expect(modeUsesDietary({ booking_type: 'tavolo', capabilities: { uses_dietary: true } })).toBe(true)
  })
  it('capability parziale: solo il campo presente vince, l’altro ricade sul default', () => {
    const mode = { booking_type: 'rinfresco_laurea' as const, capabilities: { uses_menu: false } }
    expect(modeUsesMenu(mode)).toBe(false)
    expect(modeUsesDietary(mode)).toBe(true) // non specificato → default tipo
  })
  it('mode null/undefined → false', () => {
    expect(modeUsesMenu(null)).toBe(false)
    expect(modeUsesMenu(undefined)).toBe(false)
  })
})

describe('parseModeCapabilities (parse difensivo legacy)', () => {
  it('input non-oggetto → undefined', () => {
    expect(parseModeCapabilities(undefined)).toBeUndefined()
    expect(parseModeCapabilities(null)).toBeUndefined()
    expect(parseModeCapabilities('x')).toBeUndefined()
    expect(parseModeCapabilities([])).toBeUndefined()
  })
  it('oggetto vuoto o senza chiavi note → undefined', () => {
    expect(parseModeCapabilities({})).toBeUndefined()
    expect(parseModeCapabilities({ foo: true })).toBeUndefined()
  })
  it('valori non booleani ignorati', () => {
    expect(parseModeCapabilities({ uses_menu: 'yes' })).toBeUndefined()
    expect(parseModeCapabilities({ uses_menu: true, uses_dietary: 1 })).toEqual({ uses_menu: true })
  })
  it('booleani validi preservati', () => {
    expect(parseModeCapabilities({ uses_menu: true, uses_dietary: false })).toEqual({
      uses_menu: true,
      uses_dietary: false,
    })
  })
})

describe('activeSubTabShowsMenu (Livello B — pubblico)', () => {
  const preset = { id: 'p1' }
  it('card + preset_id + preset risolto → true', () => {
    expect(activeSubTabShowsMenu({ display: 'cards', preset_id: 'p1' }, preset)).toBe(true)
  })
  it('carosello → false', () => {
    expect(activeSubTabShowsMenu({ display: 'carousel', preset_id: 'p1' }, preset)).toBe(false)
  })
  it('senza preset_id ma con label → true (blocco titolo/descrizione in MenuSelection)', () => {
    expect(activeSubTabShowsMenu({ display: 'cards', label: 'Menu Laurea' }, null)).toBe(true)
  })
  it('senza preset_id e senza label → false', () => {
    expect(activeSubTabShowsMenu({ display: 'cards', label: '  ' }, null)).toBe(false)
    expect(activeSubTabShowsMenu({ display: 'cards' }, null)).toBe(false)
  })
  it('senza preset_id → false (legacy: richiedeva preset)', () => {
    expect(activeSubTabShowsMenu({ display: 'cards' }, preset)).toBe(false)
  })
  it('preset non risolto (null) → false', () => {
    expect(activeSubTabShowsMenu({ display: 'cards', preset_id: 'p1' }, null)).toBe(false)
  })
  it('subTab assente → false', () => {
    expect(activeSubTabShowsMenu(null, preset)).toBe(false)
  })
})
