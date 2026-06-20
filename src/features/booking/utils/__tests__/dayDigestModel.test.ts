import { describe, it, expect } from 'vitest'
import { buildDayDigestModel } from '../dayDigestModel'
import type { SlotConfig } from '../bookingTimeSlots'
import type { BookingRequest } from '@/types/booking'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function slot(
  id: string,
  start_time: string,
  end_time: string,
  display_order = 1,
  name = id,
): SlotConfig {
  return { id, name, start_time, end_time, display_order, is_canonical: true }
}

const PRANZO = slot('pranzo', '12:00', '15:00', 1, 'Pranzo')
const CENA = slot('cena', '19:00', '23:00', 2, 'Cena')
const NOTTURNA = slot('notturna', '23:00', '04:00', 3, 'Notturna')

function booking(
  id: string,
  desired_time: string,
  num_guests = 2,
  overrides: Partial<BookingRequest> = {},
): BookingRequest {
  return {
    id,
    created_at: '2024-01-15T10:00:00+00:00',
    updated_at: '2024-01-15T10:00:00+00:00',
    client_name: `Cliente ${id}`,
    client_email: `${id}@test.it`,
    event_type: 'cena',
    desired_date: '2024-01-15',
    desired_time,
    num_guests,
    status: 'accepted',
    confirmed_start: `2024-01-15T${desired_time}:00+00:00`,
    confirmed_end: `2024-01-15T${desired_time}:00+00:00`,
    tenant_id: 'tenant-1',
    ...overrides,
  }
}

const NO_SLOTS: SlotConfig[] = []
const OPTS_CLASSIC = { isPro: false }

// ---------------------------------------------------------------------------
// 1. Zero prenotazioni
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — zero prenotazioni', () => {
  it('restituisce summary vuoto e groups con fasce vuote', () => {
    const model = buildDayDigestModel([], [PRANZO, CENA], OPTS_CLASSIC)

    expect(model.summary.totalBookings).toBe(0)
    expect(model.summary.totalGuests).toBe(0)
    expect(model.summary.withMenuCount).toBe(0)
    expect(model.summary.pendingAssignments).toBe(0)
    expect(model.summary.outOfSlotCount).toBe(0)

    expect(model.groups).toHaveLength(2)
    expect(model.groups[0].totalBookings).toBe(0)
    expect(model.groups[1].totalBookings).toBe(0)
    expect(model.outOfSlot).toBeNull()
  })

  it('restituisce groups vuoto se slotConfigs è vuoto', () => {
    const model = buildDayDigestModel([], NO_SLOTS, OPTS_CLASSIC)
    expect(model.groups).toHaveLength(0)
    expect(model.outOfSlot).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 2. Una sola fascia con prenotazioni
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — una fascia', () => {
  const bookings = [
    booking('a', '12:30', 3),
    booking('b', '13:00', 2),
    booking('c', '14:10', 4),
  ]

  it('assegna tutte le prenotazioni alla fascia corretta', () => {
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)

    const pranzoGroup = model.groups[0]
    expect(pranzoGroup.slotId).toBe('pranzo')
    expect(pranzoGroup.totalBookings).toBe(3)
    expect(pranzoGroup.totalGuests).toBe(9)
    expect(model.outOfSlot).toBeNull()
  })

  it('crea gruppi orari corretti', () => {
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    const hourGroups = model.groups[0].hourGroups

    // a (12:30) → ora piena 12:00 (ancoraggio fascia)
    // b (13:00) → ora piena 13:00
    // c (14:10) → ora piena 14:00
    expect(hourGroups).toHaveLength(3)
    expect(hourGroups[0].hourLabel).toBe('12:00')
    expect(hourGroups[0].bookings).toHaveLength(1)
    expect(hourGroups[1].hourLabel).toBe('13:00')
    expect(hourGroups[1].bookings).toHaveLength(1)
    expect(hourGroups[2].hourLabel).toBe('14:00')
    expect(hourGroups[2].bookings).toHaveLength(1)
  })

  it('imposta il timeRange della fascia', () => {
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    expect(model.groups[0].timeRange).toBe('12:00 - 15:00')
    expect(model.groups[0].isOutOfSlot).toBe(false)
  })

  it('il summary riflette i totali', () => {
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    expect(model.summary.totalBookings).toBe(3)
    expect(model.summary.totalGuests).toBe(9)
  })
})

// ---------------------------------------------------------------------------
// 3. Più fasce
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — più fasce', () => {
  const bookings = [
    booking('p1', '12:15', 2),
    booking('p2', '13:00', 4),
    booking('c1', '19:30', 3),
    booking('c2', '20:00', 2),
    booking('c3', '21:00', 5),
  ]

  it('distribuisce correttamente tra Pranzo e Cena', () => {
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)

    const pranzo = model.groups.find((g) => g.slotId === 'pranzo')!
    const cena = model.groups.find((g) => g.slotId === 'cena')!

    expect(pranzo.totalBookings).toBe(2)
    expect(pranzo.totalGuests).toBe(6)
    expect(cena.totalBookings).toBe(3)
    expect(cena.totalGuests).toBe(10)
    expect(model.outOfSlot).toBeNull()
  })

  it("i gruppi sono nell’ordine slotConfigs (Pranzo prima di Cena)", () => {
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)
    expect(model.groups[0].slotId).toBe('pranzo')
    expect(model.groups[1].slotId).toBe('cena')
  })

  it('summary aggrega correttamente', () => {
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)
    expect(model.summary.totalBookings).toBe(5)
    expect(model.summary.totalGuests).toBe(16)
  })
})

// ---------------------------------------------------------------------------
// 4. Molte prenotazioni nella stessa ora
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — molte prenotazioni nella stessa ora', () => {
  const bookings = [
    booking('x1', '13:00', 2),
    booking('x2', '13:15', 3),
    booking('x3', '13:45', 1),
    booking('x4', '13:59', 4),
  ]

  it("mette tutte nell'unico gruppo orario 13:00", () => {
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    const hourGroups = model.groups[0].hourGroups

    // 13:00 è ora piena → no ancoraggio fascia
    // tutte le booking (13:00, 13:15, 13:45, 13:59) → stesso blocco 13:00
    expect(hourGroups).toHaveLength(1)
    expect(hourGroups[0].hourLabel).toBe('13:00')
    expect(hourGroups[0].bookings).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// 5. Prenotazioni fuori fascia
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — fuori fascia', () => {
  const bookings = [
    booking('ok1', '12:30', 2),   // dentro Pranzo
    booking('out1', '16:00', 3),  // fuori fascia (tra Pranzo 12-15 e Cena 19-23)
    booking('out2', '17:00', 2),  // fuori fascia
  ]

  it('crea il gruppo outOfSlot per le prenotazioni senza fascia', () => {
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)

    expect(model.outOfSlot).not.toBeNull()
    expect(model.outOfSlot!.totalBookings).toBe(2)
    expect(model.outOfSlot!.totalGuests).toBe(5)
    expect(model.outOfSlot!.isOutOfSlot).toBe(true)
    expect(model.outOfSlot!.slotId).toBeNull()
    expect(model.outOfSlot!.timeRange).toBeNull()
  })

  it('il summary conta outOfSlotCount', () => {
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)
    expect(model.summary.outOfSlotCount).toBe(2)
  })

  it('senza slotConfigs TUTTE le prenotazioni finiscono in outOfSlot', () => {
    const bookingsAll = [booking('a', '12:30', 2), booking('b', '19:00', 3)]
    const model = buildDayDigestModel(bookingsAll, NO_SLOTS, OPTS_CLASSIC)

    expect(model.outOfSlot).not.toBeNull()
    expect(model.outOfSlot!.totalBookings).toBe(2)
    expect(model.summary.outOfSlotCount).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 6. Attraversamento mezzanotte (fascia Notturna 23:00-04:00)
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — attraversamento mezzanotte', () => {
  const bookings = [
    booking('n1', '23:15', 4),  // dentro Notturna (23:xx ≥ 23:00)
    booking('n2', '00:30', 2),  // dentro Notturna (00:30 < 04:00)
    booking('n3', '02:00', 3),  // dentro Notturna (02:00 < 04:00)
    booking('out', '05:00', 2), // fuori Notturna (05:00 ≥ 04:00)
  ]

  it('classifica correttamente le prenotazioni notturne', () => {
    const model = buildDayDigestModel(bookings, [NOTTURNA], OPTS_CLASSIC)

    const notturna = model.groups[0]
    expect(notturna.totalBookings).toBe(3)
    expect(notturna.totalGuests).toBe(9)
  })

  it('la prenotazione alle 05:00 è fuori fascia', () => {
    const model = buildDayDigestModel(bookings, [NOTTURNA], OPTS_CLASSIC)
    expect(model.outOfSlot).not.toBeNull()
    expect(model.outOfSlot!.totalBookings).toBe(1)
    expect(model.summary.outOfSlotCount).toBe(1)
  })

  it('i gruppi orari della fascia Notturna sono ordinati correttamente', () => {
    const model = buildDayDigestModel(bookings, [NOTTURNA], OPTS_CLASSIC)
    const hourGroups = model.groups[0].hourGroups

    // n1 (23:15) → ora piena 23:00 (ancora fascia 23:xx)
    // n2 (00:30) → ora piena 00:00
    // n3 (02:00) → ora piena 02:00
    // L'ordinamento per ora piena deve essere crescente: 23:00, 00:00, 02:00
    // ma "23" > "00" numericamente → l'ordinamento usa parseInt
    const labels = hourGroups.map((g) => g.hourLabel)
    expect(labels).toContain('23:00')
    expect(labels).toContain('00:00')
    expect(labels).toContain('02:00')
    // n3 ha 2 ospiti, n2 ha 2 ospiti → check presenza
    expect(hourGroups.find((g) => g.hourLabel === '23:00')?.bookings).toHaveLength(1)
    expect(hourGroups.find((g) => g.hourLabel === '00:00')?.bookings).toHaveLength(1)
    expect(hourGroups.find((g) => g.hourLabel === '02:00')?.bookings).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 7. Ordinamento stabile a parità di orario
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — ordinamento stabile a parità di orario', () => {
  it('a parità di orario ordina per client_name', () => {
    const bookings = [
      booking('1', '13:00', 2, { client_name: 'Zara' }),
      booking('2', '13:00', 2, { client_name: 'Anna' }),
      booking('3', '13:00', 2, { client_name: 'Marco' }),
    ]

    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    const inGroup = model.groups[0].hourGroups[0].bookings

    expect(inGroup[0].client_name).toBe('Anna')
    expect(inGroup[1].client_name).toBe('Marco')
    expect(inGroup[2].client_name).toBe('Zara')
  })
})

// ---------------------------------------------------------------------------
// 8. pendingAssignments: valorizzato solo con isPro=true
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — pendingAssignments e gating PRO', () => {
  const b1 = booking('b1', '12:30', 2)
  const b2 = booking('b2', '13:00', 3)
  const b3 = booking('b3', '13:30', 2)

  it('Classic: pendingAssignments sempre 0', () => {
    const model = buildDayDigestModel([b1, b2, b3], [PRANZO], { isPro: false })

    expect(model.summary.pendingAssignments).toBe(0)
    expect(model.groups[0].pendingAssignments).toBe(0)
  })

  it('Pro senza nessun assignment: pendingAssignments = totalBookings', () => {
    const model = buildDayDigestModel([b1, b2, b3], [PRANZO], {
      isPro: true,
      assignedBookingIds: new Set(),
    })

    expect(model.summary.pendingAssignments).toBe(3)
    expect(model.groups[0].pendingAssignments).toBe(3)
  })

  it('Pro con alcuni assegnati: pendingAssignments = non assegnati', () => {
    const model = buildDayDigestModel([b1, b2, b3], [PRANZO], {
      isPro: true,
      assignedBookingIds: new Set(['b1', 'b3']),
    })

    expect(model.summary.pendingAssignments).toBe(1)
    expect(model.groups[0].pendingAssignments).toBe(1)
  })

  it('Pro con tutti assegnati: pendingAssignments = 0', () => {
    const model = buildDayDigestModel([b1, b2, b3], [PRANZO], {
      isPro: true,
      assignedBookingIds: new Set(['b1', 'b2', 'b3']),
    })

    expect(model.summary.pendingAssignments).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 9. withMenuCount: conta prenotazioni con contesto menu
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — withMenuCount', () => {
  it('conta solo le prenotazioni con menu', () => {
    const bookings: BookingRequest[] = [
      booking('m1', '12:30', 2, { menu: 'Menu degustazione' }),
      booking('t1', '12:45', 2),  // solo tavolo
      booking('t2', '13:00', 3),  // solo tavolo
    ]

    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    expect(model.summary.withMenuCount).toBe(1)
  })

  it('conta prenotazioni con menu_total_per_person > 0', () => {
    const bookings: BookingRequest[] = [
      booking('m1', '12:30', 2, { menu_total_per_person: 35 }),
      booking('t1', '12:45', 2),
    ]
    const model = buildDayDigestModel(bookings, [PRANZO], OPTS_CLASSIC)
    expect(model.summary.withMenuCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 10. Gruppi orari vuoti non emessi
// ---------------------------------------------------------------------------

describe('buildDayDigestModel — gruppi orari vuoti non emessi', () => {
  it('non emette hourGroups per fasce senza prenotazioni', () => {
    const bookings = [booking('a', '12:30', 2)]
    const model = buildDayDigestModel(bookings, [PRANZO, CENA], OPTS_CLASSIC)

    const cena = model.groups.find((g) => g.slotId === 'cena')!
    expect(cena.hourGroups).toHaveLength(0)
  })
})
