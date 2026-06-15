import { describe, expect, it } from 'vitest'
import {
  applyMenuPromoWithReplacement,
  collectMenuPromoLabelsForSubmit,
  findMenuPromoPlacementConflicts,
  getMenuPromoBookingTypeOptions,
  listMenuPromoLabelsForBookingType,
  listMenuPromoMessagesForBookingType,
  migrateMenuPromosFromLegacy,
  normalizeMenuPromoPlacement,
  resolveMenuPromoForBookingView,
  resolveMenuPromoLabelsForBooking,
  resolveMenuPromoMessageForBookingView,
  validateMenuPromoUniqueness,
  type MenuPromo,
} from '../menuPromo'
import type { BookingMode } from '../bookingPublicFormConfig'

function makeMode(
  type: BookingMode['booking_type'],
  enabled: boolean,
  label: string,
): BookingMode {
  return {
    id: type,
    booking_type: type,
    enabled,
    label,
    description: '',
    icon: 'fork_knife',
    sub_tabs_enabled: false,
    sub_tabs_presentation: null,
    sub_tabs: [],
  }
}

const promoA: MenuPromo = {
  id: '11111111-1111-1111-1111-111111111111',
  label: 'Promo Laurea',
  message: 'Testo lungo mostrato al cliente',
  placement: 'booking_type',
  booking_types: ['rinfresco_laurea'],
  visible_on_booking: true,
}

const promoHidden: MenuPromo = {
  id: '22222222-2222-2222-2222-222222222222',
  label: 'Promo nascosta',
  message: 'Non visibile',
  placement: 'booking_type',
  booking_types: ['rinfresco_laurea'],
  visible_on_booking: false,
}

const promoLegacyNoLabel: MenuPromo = {
  id: '33333333-3333-3333-3333-333333333333',
  label: '',
  message: 'Solo testo senza nome admin',
  placement: 'booking_type',
  booking_types: ['menu_prezzo_fisso'],
}

const promoSubTab: MenuPromo = {
  id: '44444444-4444-4444-4444-444444444444',
  label: 'Promo Card 1',
  message: 'Offerta sulla card',
  placement: 'sub_tab',
  sub_tab_refs: [{ mode_id: 'menu_prezzo_fisso', sub_tab_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }],
}

const promoMultiType: MenuPromo = {
  id: '77777777-7777-7777-7777-777777777777',
  label: 'Promo doppia tipologia',
  message: 'Valida su due modalità',
  placement: 'booking_type',
  booking_types: ['rinfresco_laurea', 'menu_prezzo_fisso'],
}

describe('menuPromo labels', () => {
  it('listMenuPromoMessagesForBookingType returns single message for booking type', () => {
    expect(listMenuPromoMessagesForBookingType('rinfresco_laurea', [promoA, promoHidden])).toEqual([
      'Testo lungo mostrato al cliente',
    ])
  })

  it('listMenuPromoLabelsForBookingType returns admin labels, not message text', () => {
    expect(listMenuPromoLabelsForBookingType('rinfresco_laurea', [promoA, promoHidden])).toEqual([
      'Promo Laurea',
    ])
  })

  it('listMenuPromoLabelsForBookingType matches any type in booking_types array', () => {
    expect(listMenuPromoLabelsForBookingType('menu_prezzo_fisso', [promoMultiType])).toEqual([
      'Promo doppia tipologia',
    ])
  })

  it('skips promos without label when snapshotting booking', () => {
    expect(listMenuPromoLabelsForBookingType('menu_prezzo_fisso', [promoLegacyNoLabel])).toEqual([])
  })

  it('resolveMenuPromoLabelsForBooking uses snapshot when present', () => {
    expect(
      resolveMenuPromoLabelsForBooking(
        { booking_type: 'tavolo', menu_promo_labels: ['Promo salvata'] },
        [promoA],
      ),
    ).toEqual(['Promo salvata'])
  })

  it('resolveMenuPromoLabelsForBooking falls back to current promos when snapshot missing', () => {
    expect(
      resolveMenuPromoLabelsForBooking({ booking_type: 'rinfresco_laurea', menu_promo_labels: null }, [promoA]),
    ).toEqual(['Promo Laurea'])
  })
})

describe('migrateMenuPromosFromLegacy rule A', () => {
  it('keeps first promo targets; strips overlapping targets from later promos', () => {
    const raw = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        label: 'Prima',
        message: 'A',
        placement: 'booking_type',
        booking_types: ['rinfresco_laurea', 'menu_prezzo_fisso'],
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        label: 'Seconda',
        message: 'B',
        placement: 'booking_type',
        booking_types: ['rinfresco_laurea', 'tavolo'],
      },
    ]
    const migrated = migrateMenuPromosFromLegacy(raw)
    expect(migrated[0].booking_types).toEqual(['rinfresco_laurea', 'menu_prezzo_fisso'])
    expect(migrated[1].booking_types).toEqual(['tavolo'])
  })

  it('migrates singular booking_type to booking_types array', () => {
    const raw = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        label: 'Singola',
        message: 'A',
        placement: 'booking_type',
        booking_type: 'tavolo',
      },
    ]
    const migrated = migrateMenuPromosFromLegacy(raw)
    expect(migrated[0].booking_types).toEqual(['tavolo'])
  })

  it('demotes promo to none when all targets are taken', () => {
    const raw = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        label: 'Prima',
        message: 'A',
        booking_types: ['rinfresco_laurea'],
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        label: 'Seconda',
        message: 'B',
        booking_types: ['rinfresco_laurea'],
      },
    ]
    const migrated = migrateMenuPromosFromLegacy(raw)
    expect(migrated[1].placement).toBe('none')
  })
})

describe('resolveMenuPromoForBookingView', () => {
  it('prefers sub_tab promo over booking_type', () => {
    const promos = [promoA, promoSubTab]
    const resolved = resolveMenuPromoForBookingView({
      bookingType: 'menu_prezzo_fisso',
      modeId: 'menu_prezzo_fisso',
      subTabId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      promos,
    })
    expect(resolved?.id).toBe(promoSubTab.id)
  })

  it('matches booking_type when active type is in booking_types array', () => {
    const resolved = resolveMenuPromoForBookingView({
      bookingType: 'menu_prezzo_fisso',
      modeId: 'menu_prezzo_fisso',
      subTabId: null,
      promos: [promoMultiType],
    })
    expect(resolved?.id).toBe(promoMultiType.id)
  })

  it('falls back to booking_type when sub_tab has no promo', () => {
    const typePromo: MenuPromo = {
      ...promoA,
      id: '55555555-5555-5555-5555-555555555555',
      placement: 'booking_type',
      booking_types: ['menu_prezzo_fisso'],
    }
    const resolved = resolveMenuPromoForBookingView({
      bookingType: 'menu_prezzo_fisso',
      modeId: 'menu_prezzo_fisso',
      subTabId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      promos: [typePromo],
    })
    expect(resolved?.id).toBe(typePromo.id)
  })

  it('resolveMenuPromoMessageForBookingView returns null when no eligible promo', () => {
    expect(
      resolveMenuPromoMessageForBookingView({
        bookingType: 'tavolo',
        modeId: 'tavolo',
        subTabId: null,
        promos: [promoA],
      }),
    ).toBeNull()
  })
})

describe('validateMenuPromoUniqueness', () => {
  it('allows promo with placement none and no targets', () => {
    const orphan: MenuPromo = {
      id: '99999999-9999-9999-9999-999999999999',
      label: 'Senza abbinamento',
      message: 'Testo',
      placement: 'none',
    }
    expect(validateMenuPromoUniqueness([orphan])).toEqual({ ok: true })
  })

  it('normalizes empty booking_types to none before validating', () => {
    const emptyTypes: MenuPromo = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      label: 'Vuota tipologia',
      message: 'Testo',
      placement: 'booking_type',
      booking_types: [],
    }
    expect(validateMenuPromoUniqueness([emptyTypes])).toEqual({ ok: true })
  })

  it('rejects duplicate booking_type across promos', () => {
    const dup: MenuPromo = {
      id: '66666666-6666-6666-6666-666666666666',
      label: 'Dup',
      message: 'x',
      placement: 'booking_type',
      booking_types: ['rinfresco_laurea'],
    }
    const result = validateMenuPromoUniqueness([promoA, dup])
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate booking_type within same promo', () => {
    const invalid: MenuPromo = {
      id: '88888888-8888-8888-8888-888888888888',
      label: 'Dup interno',
      message: 'x',
      placement: 'booking_type',
      booking_types: ['tavolo', 'tavolo'],
    }
    const result = validateMenuPromoUniqueness([invalid])
    expect(result.ok).toBe(false)
  })

  it('allows multi-type promo when targets are globally unique', () => {
    const result = validateMenuPromoUniqueness([promoMultiType])
    expect(result.ok).toBe(true)
  })
})

describe('normalizeMenuPromoPlacement', () => {
  it('converts booking_type with empty array to none', () => {
    const promo: MenuPromo = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      label: 'Test',
      message: 'Msg',
      placement: 'booking_type',
      booking_types: [],
    }
    expect(normalizeMenuPromoPlacement(promo)).toEqual({
      id: promo.id,
      label: promo.label,
      message: promo.message,
      placement: 'none',
      visible_on_booking: undefined,
    })
  })

  it('converts sub_tab with empty refs to none', () => {
    const promo: MenuPromo = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      label: 'Test',
      message: 'Msg',
      placement: 'sub_tab',
      sub_tab_refs: [],
    }
    expect(normalizeMenuPromoPlacement(promo).placement).toBe('none')
    expect(normalizeMenuPromoPlacement(promo).sub_tab_refs).toBeUndefined()
  })
})

describe('findMenuPromoPlacementConflicts / applyMenuPromoWithReplacement', () => {
  const promoExisting: MenuPromo = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    label: 'Promo A',
    message: 'Messaggio A',
    placement: 'booking_type',
    booking_types: ['rinfresco_laurea', 'tavolo'],
  }

  const draftB: MenuPromo = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    label: 'Promo B',
    message: 'Messaggio B',
    placement: 'booking_type',
    booking_types: ['rinfresco_laurea'],
  }

  it('finds booking_type conflict against another promo', () => {
    const conflicts = findMenuPromoPlacementConflicts(draftB, [promoExisting])
    expect(conflicts.bookingTypes).toEqual([
      {
        type: 'rinfresco_laurea',
        existingPromoId: promoExisting.id,
        existingLabel: 'Promo A',
      },
    ])
    expect(conflicts.subTabs).toEqual([])
  })

  it('applyMenuPromoWithReplacement removes type from promo A and assigns to B', () => {
    const next = applyMenuPromoWithReplacement(draftB, [promoExisting])
    expect(validateMenuPromoUniqueness(next)).toEqual({ ok: true })

    const promoA = next.find((p) => p.id === promoExisting.id)!
    const promoB = next.find((p) => p.id === draftB.id)!
    expect(promoA.booking_types).toEqual(['tavolo'])
    expect(promoB.booking_types).toEqual(['rinfresco_laurea'])
  })

  it('applyMenuPromoWithReplacement on edit excludes self from conflict scan', () => {
    const editing: MenuPromo = {
      ...promoExisting,
      booking_types: ['rinfresco_laurea', 'menu_prezzo_fisso'],
    }
    const conflicts = findMenuPromoPlacementConflicts(editing, [promoExisting], promoExisting.id)
    expect(conflicts.bookingTypes).toEqual([])
  })

  it('leaves list unchanged when replacement is not applied (no helper call)', () => {
    const before = [promoExisting]
    const conflicts = findMenuPromoPlacementConflicts(draftB, before)
    expect(conflicts.bookingTypes.length).toBeGreaterThan(0)
    expect(before).toEqual([promoExisting])
    expect(before[0].booking_types).toEqual(['rinfresco_laurea', 'tavolo'])
  })

  it('demotes existing promo to none when last target is taken', () => {
    const onlyLaurea: MenuPromo = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      label: 'Solo laurea',
      message: 'x',
      placement: 'booking_type',
      booking_types: ['rinfresco_laurea'],
    }
    const next = applyMenuPromoWithReplacement(draftB, [onlyLaurea])
    const former = next.find((p) => p.id === onlyLaurea.id)!
    expect(former.placement).toBe('none')
    expect(former.booking_types).toBeUndefined()
  })

  it('resolves sub_tab conflict and strips ref from existing promo', () => {
    const cardA: MenuPromo = {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      label: 'Promo card A',
      message: 'x',
      placement: 'sub_tab',
      sub_tab_refs: [{ mode_id: 'm1', sub_tab_id: 's1' }],
    }
    const draftCardB: MenuPromo = {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      label: 'Promo card B',
      message: 'y',
      placement: 'sub_tab',
      sub_tab_refs: [{ mode_id: 'm1', sub_tab_id: 's1' }],
    }
    const next = applyMenuPromoWithReplacement(draftCardB, [cardA])
    expect(validateMenuPromoUniqueness(next)).toEqual({ ok: true })
    expect(next.find((p) => p.id === cardA.id)!.placement).toBe('none')
    expect(next.find((p) => p.id === draftCardB.id)!.sub_tab_refs).toEqual([
      { mode_id: 'm1', sub_tab_id: 's1' },
    ])
  })
})

describe('collectMenuPromoLabelsForSubmit', () => {
  it('deduplicates labels preserving first-view order', () => {
    const promos = [promoA, promoSubTab]
    const labels = collectMenuPromoLabelsForSubmit({
      viewedPromoIds: [promoA.id, promoSubTab.id, promoA.id],
      finalSubTabPromoId: promoSubTab.id,
      promos,
    })
    expect(labels).toEqual(['Promo Laurea', 'Promo Card 1'])
  })
})

describe('getMenuPromoBookingTypeOptions', () => {
  it('restituisce solo le tipologie abilitate con la label configurata', () => {
    const modes = [
      makeMode('tavolo', true, 'Tavolo Estivo'),
      makeMode('rinfresco_laurea', false, 'Rinfresco'),
      makeMode('menu_prezzo_fisso', true, 'Menu Degustazione'),
    ]
    const opts = getMenuPromoBookingTypeOptions(modes)
    expect(opts).toEqual([
      { value: 'tavolo', label: 'Tavolo Estivo' },
      { value: 'menu_prezzo_fisso', label: 'Menu Degustazione' },
    ])
  })

  it('mostra il nuovo nome se la modalità viene rinominata', () => {
    const modes = [makeMode('rinfresco_laurea', true, 'Evento Speciale')]
    const opts = getMenuPromoBookingTypeOptions(modes)
    expect(opts).toEqual([{ value: 'rinfresco_laurea', label: 'Evento Speciale' }])
  })
})
